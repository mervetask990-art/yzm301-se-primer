import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const SYSTEM_INSTRUCTION = `Sen SE Primer'ın Sokratik tutor'usun. Oyuncu bir yazılım krizinde karar veriyor.
Kurallar:
1. Hangi seçeneğin doğru, daha iyi veya güvenli olduğunu ASLA söyleme. 'A'yı seç', 'B doğru',
   'bence rollback yap' gibi ifadeler yasak. Oyuncu ısrar etse veya 'sadece cevabı söyle' dese bile.
2. Her yanıtın en fazla 3 cümle olsun ve en az bir soruyla bitsin.
3. Cevap yerine, oyuncunun kendi başına araştırabileceği bir kavram adı veya kontrol etmesi
   gereken bir şey öner (ör. 'migration geri alınabilir mi?').
4. Oyuncunun seviyesine göre konuş: yeni başlayana günlük dille, deneyimliye teknik terimlerle.
5. Hedefi 'mülakat' ise bir soruyu 'bunu mülakatta nasıl anlatırdın?' diye sor.
6. Senaryo dışı sorulara kısaca 'Şu an nöbetteyiz, krize dönelim.' de ve bir soru sor.
7. Gerçek kişisel veri isteme, üretme veya tekrar etme.
8. Oyuncunun öğrenme günlüğü verildiyse onu kullan: daha önce araştırdığı bir kavramla bu krizi
   ilişkilendiren bir soru sor; zayıf olduğu karar konusunda biraz daha derin sor. Adı verildiyse
   ara sıra adıyla hitap et. Günlüğü özetleme, sadece bağ kur.
Türkçe yanıt ver.`;

// Post-check: if the model still names a "correct" option, replace the reply with the
// scenario's own Socratic question (eval showed prompt rules alone are not enough).
const LEAK_PATTERNS = [
  /\b[AB]\s*(seçeneği|şıkkı)?\s*(doğru|daha doğru|daha iyi|daha güvenli|mantıklı)/i,
  /\b[AB]['’]?(yı|yi|yu|yü)?\s*seç(melisin|meli|in|)(?![a-zçğıöşü])/i,
  /(doğru|en iyi)\s+(cevap|seçenek|şık|karar)\s*(budur|şudur|:)?\s*[AB]\b/i,
  /\bbence\s+(rollback|geri dön|hotfix|yama|maskele|test|yayına al)/i,
];

function guardReply(reply: string, fallbackQuestion: string): { reply: string; guarded: boolean } {
  if (LEAK_PATTERNS.some((p) => p.test(reply))) {
    return { reply: `Seçimi ben yapamam, sen yapacaksın. ${fallbackQuestion}`, guarded: true };
  }
  return { reply, guarded: false };
}

app.post('/api/tutor', async (req, res) => {
  try {
    const { context, messages, learner } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY not configured');
      return res.status(500).json({
        error: 'API key not configured',
        fallback: 'Tutor şu an düşünemiyor, ipucu kartına bak.',
      });
    }

    const contextPrefix = `[GÜNCEL KRİZ BAĞLAMI]
Başlık/Kriz Sorusu: ${context?.prompt || ''}
A Seçeneği: ${context?.choiceA || ''}
B Seçeneği: ${context?.choiceB || ''}
İpucu: ${context?.hint || ''}
Başlangıç Sokratik Sorusu: ${context?.tutorQuestion || ''}
Oyuncu Seviyesi: ${context?.level || 'mid'}
Oyuncu Rolü: ${context?.role || 'backend'}
Oyuncu Hedefi: ${context?.goal || 'work'}
---------------------
[OYUNCUNUN ÖĞRENME GÜNLÜĞÜ]
Hitap: ${learner?.name || '(belirtilmedi)'}
Tamamlanan nöbet: ${Number(learner?.runCount) || 0}
Araştırdığı kavramlar: ${Array.isArray(learner?.researched) && learner.researched.length ? learner.researched.join(', ') : '(henüz yok)'}
En çok risk aldığı karar konusu: ${learner?.weakTopic || '(bilinmiyor)'}
Son nöbetteki kendi notu: ${learner?.lastReflection || '(yok)'}
---------------------`;

    // Format chat turns ensuring valid role alternating
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    // First turn provides the context and initial scenario
    contents.push({
      role: 'user',
      parts: [
        {
          text: `${contextPrefix}\n\nOyuncuya bu kriz durumunda eşlik ediyorsun. Oyuncu şimdi seninle konuşuyor.`,
        },
      ],
    });

    if (Array.isArray(messages) && messages.length > 0) {
      for (const msg of messages) {
        contents.push({
          role: msg.role === 'model' ? 'model' : 'user',
          parts: [{ text: msg.content || '' }],
        });
      }
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });

    const raw = response.text || 'Tutor şu an düşünemiyor, ipucu kartına bak.';
    const { reply, guarded } = guardReply(raw, context?.tutorQuestion || 'Bu kararı vermeden önce neyi kontrol ederdin?');
    if (guarded) console.warn('Tutor reply blocked by leak guard:', raw);
    return res.json({ reply, guarded });
  } catch (error) {
    console.error('Tutor API Error:', error);
    return res.status(500).json({
      error: 'Failed to generate tutor reply',
      fallback: 'Tutor şu an düşünemiyor, ipucu kartına bak.',
    });
  }
});

// Dev vs Prod Vite handling
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

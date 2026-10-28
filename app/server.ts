import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  MAX_DEPTH,
  PusulaRequest,
  clarifySchema,
  evaluateSchema,
  mapSchema,
  normalizePath,
  offlineClarify,
  offlineEvaluate,
  offlineMap,
} from './src/pusula/model.ts';

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

const PUSULA_INSTRUCTION = `Sen "Pusula"sın: yazılım mühendisleri için yol gösterici bir asistan.
Oyuncu kendi gerçek veya hayali sorusunu/krizini yazar. Görevin CEVAP VERMEK DEĞİL, düşünme haritası çıkarmaktır.
Kurallar:
1. Hangi yolun doğru, en iyi veya önerilen olduğunu ASLA söyleme. "şunu yap", "bence", "önerim", "-malısın" gibi ifadeler yasak.
   Yolları eşit ciddiyetle anlat; her birinin gerçekten mantıklı olduğu bir koşul olsun.
2. Her yol için: title (kısa yaklaşım adı), logic (hangi ilke veya ödünleşim bu yolu seçtirir),
   leadsTo (bu yoldan gidilirse büyük olasılıkla nereye varılır), risk (bu yolda ne ters gidebilir),
   whenItFits ("Eğer ... ise" ile başlayan koşul), research (araştırılacak 2-3 kavram ADI, açıklama değil),
   selfQuestion (oyuncunun kendine sorması gereken tek soru, "?" ile biter).
3. Her alan en fazla 2 kısa cümle. Türkçe yaz; teknik terimlerin İngilizcesini parantezde verebilirsin.
4. Oyuncunun seviyesine göre konuş: "new" ise günlük dil ve somut örnek, "senior" ise teknik ve ödünleşim odaklı.
   Rolüne göre (backend/frontend/devops/qa) o rolün göreceği ayrıntıyı öne çıkar. Hedefi "interview" ise
   selfQuestion'ı mülakatta anlatılabilecek biçimde sor.
5. Öğrenme günlüğü verildiyse daha önce araştırdığı kavramlarla bağ kur, aynı kavramları tekrar tekrar önerme.
6. Soru yazılım mühendisliğiyle ilgisizse tek bir yol üret: title "Yazılım dünyasına dönelim" ve selfQuestion ile
   oyuncuyu bir yazılım sorusu sormaya davet et.
7. Gerçek kişisel veri üretme veya isteme.`;

function profileBlock(body: any) {
  const p = body?.profile ?? {};
  const l = body?.learner ?? {};
  return `[OYUNCU] seviye=${p.level || 'mid'} rol=${p.role || 'backend'} hedef=${p.goal || 'work'} hitap=${p.name || '-'}
[GÜNLÜK] araştırdığı kavramlar: ${Array.isArray(l.researched) && l.researched.length ? l.researched.join(', ') : '-'}; zayıf konu: ${l.weakTopic || '-'}; daha önce sorduğu sorular: ${Array.isArray(l.recentQuestions) && l.recentQuestions.length ? l.recentQuestions.join(' | ') : '-'}`;
}

async function askJson(prompt: string, schema: object) {
  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      systemInstruction: PUSULA_INSTRUCTION,
      temperature: 0.6,
      responseMimeType: 'application/json',
      responseJsonSchema: schema,
    },
  });
  return JSON.parse(response.text || '{}');
}

app.post('/api/pusula', async (req, res) => {
  const body = req.body as PusulaRequest;
  const question = typeof body?.question === 'string' ? body.question.trim().slice(0, 600) : '';
  if (!question) return res.status(400).json({ error: 'Soru boş olamaz.' });

  const offline = !process.env.GEMINI_API_KEY;
  try {
    if (body.mode === 'clarify') {
      if (offline) return res.json(offlineClarify());
      const out = await askJson(
        `${profileBlock(body)}\n[SORU] ${question}\n\nHarita çıkarmadan önce durumu anlamak için oyuncuya 2-3 kısa netleştirme sorusu sor. Cevap veya yol önerme.`,
        clarifySchema,
      );
      const questions = (Array.isArray(out.questions) ? out.questions : [])
        .map((q: unknown) => String(q).trim())
        .filter(Boolean)
        .slice(0, 3);
      return res.json(questions.length ? { questions } : offlineClarify());
    }

    if (body.mode === 'map') {
      const depth = Math.min(Math.max(Number(body.depth) || 1, 1), MAX_DEPTH);
      if (offline) return res.json(offlineMap(depth));
      const clar = (body.clarifications ?? []).map((c) => `- ${c.question} → ${c.answer || '(boş bıraktı)'}`).join('\n');
      const trail = (body.trail ?? []).map((t, i) => `${i + 1}. ${t.situation} → seçtiği yol: ${t.chosen}`).join('\n');
      const out = await askJson(
        `${profileBlock(body)}\n[SORU] ${question}\n[NETLEŞTİRME]\n${clar || '-'}\n[ŞİMDİYE KADAR SEÇTİĞİ YOLLAR]\n${trail || '-'}\n\n` +
          `Bu ${depth}. karar noktası (en fazla ${MAX_DEPTH}). ${depth === 1 ? 'İlk karar noktasını' : 'Seçtiği yolun sonrasında karşılaşacağı bir sonraki karar noktasını'} ` +
          `"situation" alanında tek cümleyle anlat ve 2-3 farklı yol üret.${depth === MAX_DEPTH ? ' Bu son karar noktası; yollar kalıcı bir sonuca veya öğrenmeye varsın.' : ''}`,
        mapSchema,
      );
      let guarded = false;
      const paths = (Array.isArray(out.paths) ? out.paths : []).slice(0, 3).map((raw: unknown, i: number) => {
        const r = normalizePath(raw, `d${depth}-${String.fromCharCode(97 + i)}`);
        guarded = guarded || r.guarded;
        return r.path;
      });
      if (paths.length < 2) return res.json(offlineMap(depth));
      if (guarded) console.warn('Pusula: directive language removed from map');
      return res.json({ situation: String(out.situation || '').trim(), paths, guarded });
    }

    if (body.mode === 'evaluate') {
      const customPath = typeof body.customPath === 'string' ? body.customPath.trim().slice(0, 200) : '';
      if (!customPath) return res.status(400).json({ error: 'Yol boş olamaz.' });
      if (offline) return res.json(offlineEvaluate(customPath));
      const out = await askJson(
        `${profileBlock(body)}\n[SORU] ${question}\n[KARAR NOKTASI] ${body.situation}\n[OYUNCUNUN KENDİ ÖNERDİĞİ YOL] ${customPath}\n\n` +
          'Bu yolu diğerleriyle aynı biçimde analiz et. İyi ya da kötü diye yargılama; mantığını, varacağı yeri ve riskini göster.',
        evaluateSchema,
      );
      const { path, guarded } = normalizePath(out, `custom-${Date.now()}`);
      return res.json({ path: { ...path, title: customPath.slice(0, 60), custom: true }, guarded });
    }

    return res.status(400).json({ error: 'Bilinmeyen mod.' });
  } catch (error) {
    console.error('Pusula API Error:', error);
    return res.status(502).json({ error: 'Pusula şu an harita çıkaramadı.' });
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

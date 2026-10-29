import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  MAX_DEPTH,
  PusulaRequest,
  clarifySchema,
  evaluateSchema,
  mapSchema,
  normalizePath,
  offlineClarify,
  offlineCompare,
  offlineEvaluate,
  offlineMap,
  compareSchema,
  neutralize,
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
    // Fail instead of leaving the player waiting forever on a hung request
    timeout: 60_000,
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Model and thinking depth are configurable in .env. gemini-3.8-flash (the AI Studio default) and some
// others hit "high demand" / deadline errors, and free-tier keys run out of per-model quota (429),
// so calls fall back through GEMINI_FALLBACK_MODELS; lite models keep separate quota and answer fast.
// Set GEMINI_FALLBACK_MODELS="" to pin a single model (e.g. while running the eval).
// gemini-3.5-flash-lite is the main model: fastest in our checks, separate free-tier quota, and the
// model the tutor eval measured (eval/README.md).
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const GEMINI_FALLBACK_MODELS = (
  process.env.GEMINI_FALLBACK_MODELS ?? 'gemini-flash-lite-latest,gemini-3.6-flash,gemini-2.5-flash'
)
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
const GEMINI_THINKING = (process.env.GEMINI_THINKING || 'default').toLowerCase(); // minimal | low | default

function thinkingConfig(level = GEMINI_THINKING) {
  if (level === 'minimal') return { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } };
  if (level === 'low') return { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } };
  return {};
}

// Overload, rate limit and deadline errors are worth retrying on another model; bad requests are not
const isTransient = (error: unknown) =>
  /\b(429|500|503|504)\b|UNAVAILABLE|DEADLINE_EXCEEDED|RESOURCE_EXHAUSTED|high demand|timed? ?out|aborted/i.test(
    String((error as Error)?.message ?? error),
  );

type GenerateParams = Parameters<typeof ai.models.generateContent>[0];

async function generate(params: Omit<GenerateParams, 'model'>) {
  const models = [GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS.filter((m) => m !== GEMINI_MODEL)];
  let lastError: unknown;
  for (const [i, model] of models.entries()) {
    try {
      // Thinking options are model-specific, so fallbacks run with the model's defaults
      const config = i === 0 ? params.config : { ...params.config, thinkingConfig: undefined };
      const response = await ai.models.generateContent({
        ...params,
        model,
        config: { ...config, httpOptions: { timeout: 25_000 } },
      });
      // Which model answered matters for the eval: a mixed set of models is not one measurement
      if (i > 0) console.info(`Gemini: answered by fallback ${model}`);
      return response;
    } catch (error) {
      lastError = error;
      // A retired model (404) is skipped like an overloaded one; other bad requests stop the chain
      const retired = /\b404\b|NOT_FOUND|no longer available/i.test(String((error as Error)?.message ?? error));
      if ((!isTransient(error) && !retired) || i === models.length - 1) break;
      console.warn(`Gemini: ${model} unavailable, trying ${models[i + 1]}`);
    }
  }
  throw lastError;
}

// In development, surface a short reason for Gemini failures (never the key) to make setup issues visible
const errorDetail = (error: unknown) =>
  process.env.NODE_ENV === 'production'
    ? undefined
    : String((error as Error)?.message ?? error)
        .replace(/key=[^&\s"]+/gi, 'key=***')
        .slice(0, 300);

const SYSTEM_INSTRUCTION = `Sen SE Primer'ın Sokratik tutor'usun. Oyuncu bir yazılım krizinde karar veriyor.
Kurallar:
1. Hangi seçeneğin doğru, daha iyi veya güvenli olduğunu ASLA söyleme. 'A'yı seç', 'B doğru',
   'bence rollback yap' gibi ifadeler yasak. Oyuncu ısrar etse veya 'sadece cevabı söyle' dese bile.
2. Her yanıtın en fazla 3 cümle olsun ve en az bir soruyla bitsin.
3. Cevap yerine, oyuncunun kendi başına araştırabileceği bir kavram adı veya kontrol etmesi
   gereken bir şey öner (ör. 'migration geri alınabilir mi?').
4. Oyuncunun seviyesine göre konuş: yeni başlayana günlük dille, deneyimliye teknik terimlerle.
5. Hedefi 'mülakat' ise bir soruyu 'bunu mülakatta nasıl anlatırdın?' diye sor.
6. Oyuncu cevabı isterse ("hangisi doğru?", "A mı B mi?", "sadece söyle") bu KONU İÇİDİR:
   kararın ona ait olduğunu tek cümleyle sakince söyle (ör. "Bu kararı sen vereceksin, birlikte düşünelim.")
   ve hemen krize ait bir soru sor. Bu durumda "krize dönelim" deme.
   Yalnızca krizle ilgisi olmayan isteklere (şiir, başka bir teknoloji seçimi, sohbet) kısaca
   'Şu an nöbetteyiz, krize dönelim.' de ve krize ait bir soru sor.
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

    const response = await generate({
      contents,
      config: {
        ...thinkingConfig(),
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
      detail: errorDetail(error),
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
   Beceri haritasında "senior" olduğu konularda daha zor ödünleşimler, "new" olduğu konularda somut örnekler kullan.
   Her yolun "topic" alanına en çok çalıştırdığı konuyu yaz: deploy, test, security, observability, performance, team.
6. Soru yazılım mühendisliğiyle ilgisizse tek bir yol üret: title "Yazılım dünyasına dönelim" ve selfQuestion ile
   oyuncuyu bir yazılım sorusu sormaya davet et.
7. Gerçek kişisel veri üretme veya isteme.`;

function profileBlock(body: any) {
  const p = body?.profile ?? {};
  const l = body?.learner ?? {};
  return `[OYUNCU] seviye=${p.level || 'mid'} rol=${p.role || 'backend'} hedef=${p.goal || 'work'} hitap=${p.name || '-'}
[BECERİ HARİTASI] ${l.skills && typeof l.skills === 'object' && Object.keys(l.skills).length ? Object.entries(l.skills).map(([k, v]) => `${k}=${v}`).join(', ') : '-'}
[GÜNLÜK] araştırdığı kavramlar: ${Array.isArray(l.researched) && l.researched.length ? l.researched.join(', ') : '-'}; zayıf konu: ${l.weakTopic || '-'}; daha önce sorduğu sorular: ${Array.isArray(l.recentQuestions) && l.recentQuestions.length ? l.recentQuestions.join(' | ') : '-'}`;
}

async function askJson(prompt: string, schema: object) {
  const response = await generate({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      ...thinkingConfig(),
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

    if (body.mode === 'compare') {
      const prediction = typeof body.prediction === 'string' ? body.prediction.trim().slice(0, 400) : '';
      const path = body.path;
      if (!prediction || !path?.leadsTo) return res.status(400).json({ error: 'Tahmin boş olamaz.' });
      if (offline) return res.json(offlineCompare(path, prediction));
      const out = await askJson(
        `${profileBlock(body)}\n[SORU] ${question}\n[YOL] ${path.title}\nMantık: ${path.logic}\nVarış: ${path.leadsTo}\nRisk: ${path.risk}\n` +
          `[OYUNCUNUN TAHMİNİ] ${prediction}\n\n` +
          'Oyuncu bu yolun nereye varacağını görmeden tahmin etti. Tahmini varış ve riskle karşılaştır. ' +
          'alignment: close (ana sonucu ve riski gördü), partial (ikisinden birini somut olarak gördü), ' +
          'missed (ikisini de kaçırdı ya da tahmin bu yolla ilgisiz/şaka). Tahmin yolun sonucuna veya riskine ' +
          'somut bir gönderme yapmıyorsa partial verme; arada kalırsan düşük olanı seç. ' +
          '"matched": tahminin neyi zaten gördüğünü tek cümleyle söyle. "missedQuestion": kaçırdığı noktayı SÖYLEMEDEN ' +
          'oraya yönelten tek bir soru sor. Doğru/yanlış, puan veya not verme.',
        compareSchema,
      );
      const alignment = ['close', 'partial', 'missed'].includes(out.alignment) ? out.alignment : 'partial';
      const matched = neutralize(String(out.matched || ''));
      const missed = neutralize(String(out.missedQuestion || path.selfQuestion));
      return res.json({
        alignment,
        matched: matched.text,
        missedQuestion: missed.text,
        guarded: matched.changed || missed.changed,
      });
    }

    return res.status(400).json({ error: 'Bilinmeyen mod.' });
  } catch (error) {
    console.error('Pusula API Error:', error);
    // Every model busy: keep the player moving with the generic map, flagged so the UI says why
    if (isTransient(error)) {
      const busy = { busy: true, detail: errorDetail(error) };
      if (body.mode === 'clarify') return res.json({ ...offlineClarify(), ...busy });
      if (body.mode === 'map') return res.json({ ...offlineMap(Math.min(Math.max(Number(body.depth) || 1, 1), MAX_DEPTH)), ...busy });
      if (body.mode === 'evaluate' && typeof body.customPath === 'string')
        return res.json({ ...offlineEvaluate(body.customPath.trim().slice(0, 200)), ...busy });
      if (body.mode === 'compare' && body.path && typeof body.prediction === 'string')
        return res.json({ ...offlineCompare(body.path, body.prediction), ...busy });
    }
    return res.status(502).json({ error: 'Pusula şu an harita çıkaramadı.', detail: errorDetail(error) });
  }
});

// Spaced review: the player re-explains a concept in their own words; we point at gaps with a question
const reviewSchema = {
  type: 'object',
  properties: {
    result: { type: 'string', enum: ['solid', 'partial', 'gap'] },
    followUp: { type: 'string' },
  },
  required: ['result', 'followUp'],
};

app.post('/api/review', async (req, res) => {
  const concept = typeof req.body?.concept === 'string' ? req.body.concept.trim().slice(0, 120) : '';
  const explanation = typeof req.body?.explanation === 'string' ? req.body.explanation.trim().slice(0, 600) : '';
  const previous = typeof req.body?.previous === 'string' ? req.body.previous.trim().slice(0, 600) : '';
  if (!concept || !explanation) return res.status(400).json({ error: 'Kavram ve açıklama gerekli.' });

  if (!process.env.GEMINI_API_KEY) {
    // Offline we cannot judge content; only a very short answer is treated as a gap
    const result = explanation.length < 25 ? 'gap' : 'partial';
    return res.json({
      offline: true,
      result,
      followUp: `${concept} kavramını hangi durumda KULLANMAZDIN? Bir örnekle düşün.`,
    });
  }

  try {
    const response = await generate({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                `${profileBlock(req.body)}\n[KAVRAM] ${concept}\n[ÖNCEKİ KENDİ AÇIKLAMASI] ${previous || '-'}\n[BUGÜNKÜ AÇIKLAMASI] ${explanation}\n\n` +
                'Oyuncu bu kavramı aralıklı tekrar için kendi kelimeleriyle yeniden açıkladı. result: solid (özü doğru ve kendi cümlesi), ' +
                'partial (kısmen doğru ya da ezber), gap (önemli bir yanlış veya eksik). followUp: eksik kalan yeri SÖYLEMEDEN ' +
                'oraya yönelten tek bir soru; solid ise kavramı bir adım ileri taşıyan bir soru. Doğru tanımı yazma.',
            },
          ],
        },
      ],
      config: {
        ...thinkingConfig(),
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.4,
        responseMimeType: 'application/json',
        responseJsonSchema: reviewSchema,
      },
    });
    const out = JSON.parse(response.text || '{}');
    const result = ['solid', 'partial', 'gap'].includes(out.result) ? out.result : 'partial';
    const followUp = neutralize(String(out.followUp || `${concept} kavramını bir örnekle açıklar mısın?`));
    return res.json({ result, followUp: followUp.text, guarded: followUp.changed });
  } catch (error) {
    console.error('Review API Error:', error);
    if (isTransient(error)) {
      // Cannot judge content without a model: never punish the player for an outage
      return res.json({
        offline: true,
        busy: true,
        result: 'partial',
        followUp: `${concept} kavramını hangi durumda KULLANMAZDIN? Bir örnekle düşün.`,
      });
    }
    return res.status(502).json({ error: 'Tekrar şu an değerlendirilemedi.', detail: errorDetail(error) });
  }
});

// Development-only setup check: which model / thinking settings answer, and how fast
app.get('/api/_diag', async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).end();
  if (!process.env.GEMINI_API_KEY) return res.json({ key: false });

  const timeCall = async (model: string, thinking: string) => {
    const t = Date.now();
    try {
      const r = await ai.models.generateContent({
        model,
        contents: 'Sadece "tamam" yaz.',
        config: { ...thinkingConfig(thinking), httpOptions: { timeout: 60_000 } },
      });
      return { model, thinking, ok: true, ms: Date.now() - t, text: (r.text || '').trim().slice(0, 20) };
    } catch (e) {
      return { model, thinking, ok: false, ms: Date.now() - t, error: errorDetail(e) };
    }
  };

  let models: string[] = [];
  try {
    const pager = await ai.models.list();
    for await (const m of pager) {
      const name = String(m.name || '').replace('models/', '');
      if (/flash/.test(name)) models.push(name);
      if (models.length >= 30) break;
    }
  } catch (e) {
    models = [`liste alınamadı: ${errorDetail(e)}`];
  }

  // ?models=a,b times other candidates (default thinking) instead of the configured one
  const candidates = String(req.query.models || '')
    .split(',')
    .map((m) => m.trim())
    .filter((m) => /^[\w.-]+$/.test(m))
    .slice(0, 8);
  const attempts = await Promise.all(
    candidates.length
      ? candidates.map((m) => timeCall(m, 'default'))
      : [timeCall(GEMINI_MODEL, 'default'), timeCall(GEMINI_MODEL, 'low'), timeCall(GEMINI_MODEL, 'minimal')],
  );
  return res.json({ key: true, configured: { model: GEMINI_MODEL, fallbacks: GEMINI_FALLBACK_MODELS, thinking: GEMINI_THINKING }, attempts, models });
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

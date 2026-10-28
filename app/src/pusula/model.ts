// Pusula: the player's own question becomes a map of paths. Shared by server.ts and the UI.
// A path never says "do this"; it explains the logic and where it leads.

export interface PusulaPath {
  id: string;
  title: string; // short name of the approach, e.g. "Önce etkiyi durdur"
  logic: string; // which principle / trade-off makes someone choose this
  leadsTo: string; // where this path most likely ends up
  risk: string; // what can go wrong on this path
  whenItFits: string; // condition: "Eğer ... ise bu yol anlamlıdır"
  research: string[]; // concept names to research, never answers
  selfQuestion: string; // the question the player should ask themselves
  custom?: boolean; // proposed by the player
}

export interface PusulaNode {
  id: string;
  depth: number; // 1..MAX_DEPTH
  situation: string; // what the player faces at this decision point
  paths: PusulaPath[];
  chosenPathId?: string;
}

export interface Clarification {
  question: string;
  answer: string;
}

export interface PusulaProfile {
  level: string;
  role: string;
  goal: string;
  name?: string;
}

export type PusulaRequest =
  | { mode: 'clarify'; question: string; profile: PusulaProfile; learner?: unknown }
  | {
      mode: 'map';
      question: string;
      clarifications: Clarification[];
      trail: { situation: string; chosen: string }[]; // decisions taken so far
      depth: number;
      profile: PusulaProfile;
      learner?: unknown;
    }
  | {
      mode: 'evaluate';
      question: string;
      clarifications: Clarification[];
      situation: string;
      customPath: string;
      profile: PusulaProfile;
      learner?: unknown;
    };

export interface ClarifyResponse {
  questions: string[];
  offline?: boolean;
}

export interface MapResponse {
  situation: string;
  paths: PusulaPath[];
  offline?: boolean;
  guarded?: boolean;
}

export interface EvaluateResponse {
  path: PusulaPath;
  offline?: boolean;
  guarded?: boolean;
}

export const MAX_DEPTH = 3;

// ---------- JSON schemas for Gemini structured output ----------

const pathSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    logic: { type: 'string' },
    leadsTo: { type: 'string' },
    risk: { type: 'string' },
    whenItFits: { type: 'string' },
    research: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 },
    selfQuestion: { type: 'string' },
  },
  required: ['title', 'logic', 'leadsTo', 'risk', 'whenItFits', 'research', 'selfQuestion'],
};

export const clarifySchema = {
  type: 'object',
  properties: { questions: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 } },
  required: ['questions'],
};

export const mapSchema = {
  type: 'object',
  properties: {
    situation: { type: 'string' },
    paths: { type: 'array', items: pathSchema, minItems: 2, maxItems: 3 },
  },
  required: ['situation', 'paths'],
};

export const evaluateSchema = pathSchema;

// ---------- Guard: strip prescriptive language the model may still produce ----------

// \b does not treat Turkish letters (ö, ş, ı...) as word characters, so use Unicode lookarounds
const word = (body: string) => new RegExp(`(?<!\\p{L})(?:${body})(?!\\p{L})`, 'iu');

const DIRECTIVE_PATTERNS = [
  word('en doğru(?:su)?|en iyi(?:si)?|doğru (?:cevap|yol|seçenek)'),
  word('önerim|tavsiyem|bence'),
  new RegExp('(?<!\\p{L})kesinlikle(?!\\p{L}).*(?<!\\p{L})(?:yap|seç|git|uygula)', 'iu'),
  word('(?:bu yolu|bunu) (?:seç|tercih et)'),
  // Turkish necessity suffix aimed at the player: "almalısın", "seçmelisin", "yapmalısınız"...
  word('\\p{L}+(?:malısın|melisin|malısınız|melisiniz)'),
];

export function isDirective(text: string): boolean {
  return DIRECTIVE_PATTERNS.some((p) => p.test(text));
}

// Drops sentences that tell the player what to do; reports whether anything was removed.
export function neutralize(text: string): { text: string; changed: boolean } {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((s) => !isDirective(s));
  if (kept.length === sentences.length) return { text, changed: false };
  return {
    text: kept.join(' ').trim() || 'Bu yolun sonucunu kendi koşullarına göre değerlendir.',
    changed: true,
  };
}

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v.trim() : fallback);

export function normalizePath(raw: any, id: string): { path: PusulaPath; guarded: boolean } {
  let guarded = false;
  const clean = (v: unknown) => {
    const r = neutralize(str(v));
    guarded = guarded || r.changed;
    return r.text;
  };
  const path: PusulaPath = {
    id,
    title: clean(raw?.title) || 'Yol',
    logic: clean(raw?.logic),
    leadsTo: clean(raw?.leadsTo),
    risk: clean(raw?.risk),
    whenItFits: clean(raw?.whenItFits),
    research: Array.isArray(raw?.research)
      ? raw.research.map((r: unknown) => str(r)).filter(Boolean).slice(0, 3)
      : [],
    selfQuestion: clean(raw?.selfQuestion) || 'Bu yolu seçmeden önce neyi bilmen gerekir?',
  };
  return { path, guarded };
}

// ---------- Offline fallback (no API key): a generic but honest map ----------

export function offlineClarify(): ClarifyResponse {
  return {
    offline: true,
    questions: [
      'Şu anda kim veya ne etkileniyor ve bu etki ne kadar süre tolere edilebilir?',
      'En son ne değişti (kod, ayar, veri, trafik) ve bunu nereden doğrulayabilirsin?',
      'Yanlış bir adım atarsan geri alabilir misin, yoksa kalıcı bir iz bırakır mı?',
    ],
  };
}

export function offlineMap(depth: number): MapResponse {
  const prefix = `d${depth}`;
  if (depth === 1) {
    return {
      offline: true,
      situation: 'İlk karar noktası: önce etkiyi mi durduracaksın, yoksa önce nedeni mi anlayacaksın?',
      paths: [
        {
          id: `${prefix}-a`,
          title: 'Önce etkiyi durdur',
          logic: 'Kullanıcıya verilen zararı en kısa sürede kesmek, nedeni anlamaktan önce gelir (MTTR odaklı düşünce).',
          leadsTo: 'Sistem hızlıca stabil hale gelir ama kök neden hâlâ bilinmez ve sorun tekrarlayabilir.',
          risk: 'Geri alma veya kapatma adımı, değişen veri ya da şema yüzünden yeni bir sorun yaratabilir.',
          whenItFits: 'Etki büyükse ve geri alma adımı güvenli olduğunu doğrulayabildiğin bir işlemse.',
          research: ['Rollback vs roll-forward', 'Feature flag', 'MTTR'],
          selfQuestion: 'Bu adımı geri alabileceğinden nasıl emin olursun?',
        },
        {
          id: `${prefix}-b`,
          title: 'Önce kök nedeni bul',
          logic: 'Nedeni bilmeden yapılan müdahale tahmindir; doğru teşhis yanlış tedaviyi önler.',
          leadsTo: 'Kalıcı bir çözüme yaklaşırsın ama bu sürede etki devam eder.',
          risk: 'Teşhis beklenenden uzun sürer, baskı altında aceleci bir yama riski artar.',
          whenItFits: 'Etki sınırlıysa veya hızlı geri alma seçeneği yoksa.',
          research: ['Root cause analysis (5 Neden)', 'Gözlemlenebilirlik: log, metrik, trace'],
          selfQuestion: 'Elindeki loglar ve metrikler hangi hipotezi çürütebilir?',
        },
        {
          id: `${prefix}-c`,
          title: 'Önce etkiyi sınırla ve haber ver',
          logic: 'Sorunu çözmeden önce yayılmasını engellemek ve doğru kişileri bilgilendirmek koordinasyonu sağlar.',
          leadsTo: 'Ekip ve paydaşlar aynı resme bakar; teknik çözüm biraz gecikebilir.',
          risk: 'İletişime harcanan zaman, teknik müdahaleyi geciktirebilir.',
          whenItFits: 'Birden fazla ekip veya kullanıcı grubu etkileniyorsa.',
          research: ['Incident commander rolü', 'Blast radius', 'Status page iletişimi'],
          selfQuestion: 'Şu an bu sorundan haberdar olması gereken ama olmayan kim var?',
        },
      ],
    };
  }
  return {
    offline: true,
    situation:
      depth === 2
        ? 'Seçtiğin yolda ikinci karar: değişikliği nasıl doğrulayacaksın?'
        : 'Son karar: bu deneyimden kalıcı ne çıkaracaksın?',
    paths: [
      {
        id: `${prefix}-a`,
        title: depth === 2 ? 'Ölç, sonra ilerle' : 'Postmortem yaz',
        logic:
          depth === 2
            ? 'Bir değişikliğin işe yaradığını varsaymak yerine kanıtla görmek gerekir.'
            : 'Suçlamadan geriye bakmak, aynı hatanın tekrarlanmasını engeller.',
        leadsTo: depth === 2 ? 'Daha yavaş ama daha güvenli ilerlersin.' : 'Ekip bir sonraki krize daha hazır olur.',
        risk: depth === 2 ? 'Ölçüm yanlış metriğe bakarsa yanlış güven verir.' : 'Postmortem kâğıtta kalırsa hiçbir şey değişmez.',
        whenItFits: depth === 2 ? 'Değişikliğin etkisi belirsizse.' : 'Sorunun tekrar etme ihtimali varsa.',
        research: depth === 2 ? ['Smoke test', 'SLO ve hata bütçesi'] : ['Blameless postmortem', 'Aksiyon maddesi takibi'],
        selfQuestion: depth === 2 ? 'Hangi metrik "düzeldi" demeni sağlar?' : 'Bu olaydan sonra hangi kural değişmeli?',
      },
      {
        id: `${prefix}-b`,
        title: depth === 2 ? 'Kademeli yayına al' : 'Otomatik koruma ekle',
        logic:
          depth === 2
            ? 'Değişikliği önce küçük bir kitleye açmak, hatanın etkisini sınırlar.'
            : 'İnsan hafızasına güvenmek yerine sistemin kendisi hatayı yakalamalı.',
        leadsTo: depth === 2 ? 'Sorun varsa az kişi etkilenir, yoksa güvenle genişletirsin.' : 'Aynı hata bir dahaki sefere otomatik yakalanır.',
        risk: depth === 2 ? 'Küçük kitle sorunu ortaya çıkaracak kadar temsilci olmayabilir.' : 'Çok fazla alarm, ekibi alarmlara duyarsızlaştırır.',
        whenItFits: depth === 2 ? 'Altyapı trafiği bölmeye izin veriyorsa.' : 'Hatanın tespit edilebilir bir sinyali varsa.',
        research: depth === 2 ? ['Canary deployment', 'Blue–green deployment'] : ['Alerting best practices', 'CI kalite kapıları'],
        selfQuestion: depth === 2 ? 'Kademeli yayında neyi görürsen geri çekersin?' : 'Bu hatayı hangi sinyal en erken gösterirdi?',
      },
    ],
  };
}

export function offlineEvaluate(customPath: string): EvaluateResponse {
  return {
    offline: true,
    path: {
      id: `custom-${Date.now()}`,
      custom: true,
      title: customPath.slice(0, 60),
      logic: 'Bu senin önerdiğin yol. Hangi ilkeye dayandığını kendine sor: hız mı, güvenlik mi, öğrenme mi?',
      leadsTo: 'Çevrimdışı moddayız; bu yolun nereye varacağını değerlendirmek için API anahtarı gerekli.',
      risk: 'Bu yolun geri alınabilir olup olmadığını düşün.',
      whenItFits: 'Hangi koşulda bu yol diğerlerinden daha anlamlı olur?',
      research: ['Trade-off analizi', 'Pre-mortem tekniği'],
      selfQuestion: 'Bu yol başarısız olursa ilk nerede fark edersin?',
    },
  };
}

// Zorlanma modeli: tarayıcıda onnxruntime-web ile çıkarım (spec §8).
// Model ve sözleşme (config.json) Hugging Face'ten COMMIT'E SABİT URL ile indirilir; main dalı kullanılmaz.
import * as ort from 'onnxruntime-web/wasm'; // yalnız WASM (~11 MB), WebGPU paketi (~22 MB) gereksiz
import modelSource from './model-source.json';
import { FEATURES, Features } from './telemetry';

export interface ModelConfig {
  version: string;
  decision_threshold: number;
  features: { name: string; label: string; unit: string }[];
  input: { name: string };
  output: { name: string; index: number };
}

export interface LoadedModel {
  config: ModelConfig;
  source: string; // indirilen taban URL (rollback/teşhis için ekranda ve kayıtta görünür)
  predict: (f: Features) => Promise<number>;
}

// Güvenli devreye alma (RELEASE.md): shadow = hesapla ve kaydet ama oyunu değiştirme;
// canary = oyuncuların yalnızca `percent`'i; full = herkes. Kova oyuncu kimliğinden sabit hesaplanır.
export type RolloutMode = 'shadow' | 'canary' | 'full';
export function rollout(): { mode: RolloutMode; percent: number } {
  const r = (modelSource as { rollout?: { mode: RolloutMode; percent: number } }).rollout;
  return r ?? { mode: 'full', percent: 100 };
}

export function bucketOf(id: string): number {
  let h = 2166136261; // FNV-1a: aynı oyuncu her zaman aynı kovaya (0–99) düşer
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100;
}

export function modelAppliesTo(playerId: string): boolean {
  const { mode, percent } = rollout();
  if (mode === 'full') return true;
  if (mode === 'canary') return bucketOf(playerId) < percent;
  return false; // shadow
}

// HF commit'i varsa oradan; yoksa (yayından önce, yerel geliştirme) app/public/model/ kopyasından
export function modelBaseUrl(): string {
  const { repo, commit } = modelSource as { repo: string; commit: string };
  return repo && commit ? `https://huggingface.co/${repo}/resolve/${commit}/` : '/model/';
}

// Sürüm, package.json'daki onnxruntime-web ile aynı olmalı
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
ort.env.wasm.numThreads = 1; // AI Studio / GitHub Pages cross-origin isolation vermez

let loading: Promise<LoadedModel> | null = null;

export function loadModel(): Promise<LoadedModel> {
  if (loading) return loading;
  const base = modelBaseUrl();
  loading = (async () => {
    const config = (await (await fetch(base + 'config.json')).json()) as ModelConfig;
    // Sözleşme kontrolü: uygulamanın gönderdiği sıra ile modelin beklediği sıra aynı olmalı
    const expected = config.features.map((f) => f.name).join(',');
    if (expected !== FEATURES.join(',')) {
      throw new Error(`Sözleşme uyuşmuyor: model ${expected} bekliyor`);
    }
    const session = await ort.InferenceSession.create(base + 'model.onnx');
    const predict = async (f: Features) => {
      const x = new ort.Tensor('float32', Float32Array.from(FEATURES.map((n) => f[n])), [1, FEATURES.length]);
      const out = await session.run({ [config.input.name]: x });
      const probs = out[config.output.name].data as Float32Array;
      return probs[config.output.index];
    };
    return { config, source: base, predict };
  })();
  loading.catch(() => {
    loading = null; // sonraki denemede yeniden dene; oyun bu arada v1 kurallarıyla devam eder
  });
  return loading;
}

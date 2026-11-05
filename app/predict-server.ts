// Üçüncü tüketici (bonus): aynı model.onnx'i sunucuda onnxruntime-node ile çalıştırır.
// POST /api/predict {"inputs": {karar_no: 2, ...}} → {"p": 0.73, "destek": true, "version": "2.0.0", ...}
// Model kaynağı tarayıcıyla aynı: HF commit'e sabit URL; yayın yoksa repo kökündeki model/.
import fs from 'fs';
import path from 'path';
import type { Express } from 'express';
import modelSource from './src/model-source.json' with { type: 'json' };
import { FEATURES } from './src/telemetry';

type Ort = typeof import('onnxruntime-node');
interface Loaded {
  ort: Ort;
  session: import('onnxruntime-node').InferenceSession;
  config: {
    version: string;
    decision_threshold: number;
    features: { name: string }[];
    input: { name: string };
    output: { name: string; index: number };
  };
  source: string;
}

let loading: Promise<Loaded> | null = null;

async function load(rootDir: string): Promise<Loaded> {
  const ort: Ort = await import('onnxruntime-node');
  const { repo, commit } = modelSource as { repo: string; commit: string };
  let modelBytes: Uint8Array;
  let configText: string;
  let source: string;
  if (repo && commit) {
    source = `https://huggingface.co/${repo}/resolve/${commit}/`;
    modelBytes = new Uint8Array(await (await fetch(source + 'model.onnx')).arrayBuffer());
    configText = await (await fetch(source + 'config.json')).text();
  } else {
    source = path.resolve(rootDir, '..', 'model') + path.sep;
    modelBytes = fs.readFileSync(source + 'model.onnx');
    configText = fs.readFileSync(source + 'config.json', 'utf-8');
  }
  const config = JSON.parse(configText) as Loaded['config'];
  if (config.features.map((f) => f.name).join(',') !== FEATURES.join(',')) {
    throw new Error('Sözleşme uyuşmuyor: config.json features sırası FEATURES ile aynı değil');
  }
  const session = await ort.InferenceSession.create(modelBytes);
  return { ort, session, config, source };
}

export function registerPredict(app: Express, rootDir: string) {
  const get = () => {
    if (!loading) {
      loading = load(rootDir);
      loading.catch(() => (loading = null));
    }
    return loading;
  };

  app.get('/api/model', async (_req, res) => {
    try {
      const m = await get();
      res.json({ version: m.config.version, source: m.source, features: FEATURES, threshold: m.config.decision_threshold });
    } catch (e) {
      res.status(503).json({ error: String(e) });
    }
  });

  app.post('/api/predict', async (req, res) => {
    const inputs = req.body?.inputs ?? {};
    const missing = FEATURES.filter((f) => typeof inputs[f] !== 'number' || !Number.isFinite(inputs[f]));
    if (missing.length) return res.status(422).json({ error: 'eksik veya sayı olmayan girdi', missing });
    try {
      const m = await get();
      const x = new m.ort.Tensor('float32', Float32Array.from(FEATURES.map((f) => inputs[f])), [1, FEATURES.length]);
      const out = await m.session.run({ [m.config.input.name]: x });
      const p = (out[m.config.output.name].data as Float32Array)[m.config.output.index];
      res.json({ p, destek: p >= m.config.decision_threshold, version: m.config.version, source: m.source });
    } catch (e) {
      res.status(503).json({ error: String(e) });
    }
  });
}

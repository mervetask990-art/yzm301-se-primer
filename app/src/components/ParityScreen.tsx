import React, { useEffect, useState } from 'react';
import { LoadedModel, loadModel } from '../model';
import { FEATURES, Features } from '../telemetry';

// Diferansiyel test paneli (?parite=1): tests/parite.json'daki girdiyi uygulama içindeki
// ONNX çıkarımıyla hesaplar; Cypress sonucu `data-cy="p"`'den okuyup Python kahiniyle kıyaslar (KÖ-14).
export const ParityScreen: React.FC = () => {
  const [model, setModel] = useState<LoadedModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [p, setP] = useState<number | null>(null);

  useEffect(() => {
    loadModel().then(setModel).catch((e) => setError(String(e)));
  }, []);

  const run = async () => {
    if (!model) return;
    try {
      const raw = JSON.parse(input) as Partial<Features>;
      const missing = FEATURES.filter((f) => typeof raw[f] !== 'number');
      if (missing.length) throw new Error(`Eksik girdi: ${missing.join(', ')}`);
      setError(null);
      setP(await model.predict(raw as Features));
    } catch (e) {
      setError(String(e));
      setP(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1B2D] text-[#E8EEF5] p-5 flex flex-col gap-3 max-w-[430px] mx-auto font-mono text-[12px]">
      <h1 className="text-[15px] font-bold">Parite testi (onnxruntime-web)</h1>
      <p data-cy="model-status" className="text-[#9FB0C3]">
        {model ? `hazır · v${model.config.version} · ${model.source}` : error ? 'hata' : 'yükleniyor…'}
      </p>
      <textarea
        data-cy="parite-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={8}
        placeholder={JSON.stringify(Object.fromEntries(FEATURES.map((f) => [f, 0])))}
        className="bg-[#17263C] border border-[#2A3E5C] rounded-lg p-2"
      />
      <button
        type="button"
        data-cy="parite-run"
        disabled={!model}
        onClick={run}
        className="min-h-[44px] rounded-lg bg-[#5FB3A8] text-[#0F1B2D] font-bold disabled:opacity-50"
      >
        Hesapla
      </button>
      <p>
        p = <span data-cy="p">{p === null ? '—' : p.toFixed(8)}</span>
      </p>
      {error && <p data-cy="parite-error" className="text-[#E58A7B]">{error}</p>}
    </div>
  );
};

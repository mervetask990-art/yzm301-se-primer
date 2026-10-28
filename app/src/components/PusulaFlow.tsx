import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  Loader2,
  Search,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GitBranch,
  HelpCircle,
  Lightbulb,
  PenLine,
  Plus,
  AlertTriangle,
  Flag,
  RotateCcw,
} from 'lucide-react';
import {
  Clarification,
  ClarifyResponse,
  EvaluateResponse,
  MAX_DEPTH,
  MapResponse,
  PusulaNode,
  PusulaPath,
  PusulaProfile,
} from '../pusula/model';
import { PusulaRecord } from '../journal';

type Stage = 'ask' | 'clarify' | 'map' | 'summary';

interface PusulaFlowProps {
  profile: PusulaProfile;
  learner: unknown;
  researched: string[];
  onToggleResearched: (item: string) => void;
  onSaveRecord: (record: PusulaRecord) => void;
  onUpdateReflection: (id: string, text: string) => void;
  onExit: () => void;
}

const EXAMPLES = [
  'Canlıda veritabanı sorguları aniden yavaşladı, nereden başlamalıyım?',
  'Monolitten mikroservise geçmeli miyiz?',
  'Code review sürecimiz çok yavaş, ekip şikâyetçi.',
  'Dün gece çıkan sürümden sonra randevu sistemi 500 hatası veriyor.',
];

async function callPusula<T>(body: object): Promise<T> {
  const response = await fetch('/api/pusula', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('Pusula API failed');
  return response.json() as Promise<T>;
}

export const PusulaFlow: React.FC<PusulaFlowProps> = ({
  profile,
  learner,
  researched,
  onToggleResearched,
  onSaveRecord,
  onUpdateReflection,
  onExit,
}) => {
  const [stage, setStage] = useState<Stage>('ask');
  const [question, setQuestion] = useState('');
  const [clarifyQuestions, setClarifyQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [nodes, setNodes] = useState<PusulaNode[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [reflection, setReflection] = useState('');
  const [reflectionSaved, setReflectionSaved] = useState(false);

  const isNew = profile.level === 'new';
  const clarifications: Clarification[] = clarifyQuestions.map((q, i) => ({
    question: q,
    answer: answers[i]?.trim() ?? '',
  }));
  const activeNode = nodes[activeIndex];
  const firstName = profile.name?.trim();

  const run = async (label: string, task: () => Promise<void>) => {
    setLoading(label);
    setError(null);
    try {
      await task();
    } catch {
      setError('Pusula şu an harita çıkaramadı. Biraz sonra tekrar dene.');
    } finally {
      setLoading(null);
    }
  };

  const ask = () =>
    run('Durumunu anlamaya çalışıyorum…', async () => {
      const res = await callPusula<ClarifyResponse>({ mode: 'clarify', question, profile, learner });
      setOffline(Boolean(res.offline));
      setClarifyQuestions(res.questions);
      setAnswers(res.questions.map(() => ''));
      setStage('clarify');
    });

  const fetchNode = async (depth: number, trailNodes: PusulaNode[]) => {
    const trail = trailNodes.map((n) => ({
      situation: n.situation,
      chosen: n.paths.find((p) => p.id === n.chosenPathId)?.title ?? '',
    }));
    const res = await callPusula<MapResponse>({
      mode: 'map',
      question,
      clarifications,
      trail,
      depth,
      profile,
      learner,
    });
    setOffline((prev) => prev || Boolean(res.offline));
    return { id: `node-${depth}-${Date.now()}`, depth, situation: res.situation, paths: res.paths } as PusulaNode;
  };

  const startMap = () =>
    run('Yolları çiziyorum…', async () => {
      const node = await fetchNode(1, []);
      setNodes([node]);
      setActiveIndex(0);
      setExpanded(isNew ? node.paths[0]?.id ?? null : null);
      setStage('map');
    });

  const finish = (finalNodes: PusulaNode[]) => {
    const chosen = finalNodes.filter((n) => n.chosenPathId);
    const trail = chosen.map((n) => n.paths.find((p) => p.id === n.chosenPathId)!);
    const record: PusulaRecord = {
      id: recordId ?? `pusula-${Date.now()}`,
      date: new Date().toISOString(),
      question,
      trail: trail.map((p) => p.title),
      research: Array.from(new Set(trail.flatMap((p) => p.research))),
    };
    setRecordId(record.id);
    onSaveRecord(record);
    setStage('summary');
  };

  const choosePath = (path: PusulaPath) => {
    // Choosing on an earlier node rewrites the rest of the map from there
    const updated = nodes.slice(0, activeIndex + 1).map((n, i) =>
      i === activeIndex ? { ...n, chosenPathId: path.id } : n,
    );
    if (activeNode.depth >= MAX_DEPTH) {
      setNodes(updated);
      finish(updated);
      return;
    }
    run('Bu yolun ilerisine bakıyorum…', async () => {
      const next = await fetchNode(activeNode.depth + 1, updated);
      setNodes([...updated, next]);
      setActiveIndex(updated.length);
      setExpanded(isNew ? next.paths[0]?.id ?? null : null);
    });
  };

  const addCustomPath = () =>
    run('Senin yolunu analiz ediyorum…', async () => {
      const res = await callPusula<EvaluateResponse>({
        mode: 'evaluate',
        question,
        clarifications,
        situation: activeNode.situation,
        customPath: customText,
        profile,
        learner,
      });
      setOffline((prev) => prev || Boolean(res.offline));
      setNodes((prev) =>
        prev.map((n, i) => (i === activeIndex ? { ...n, paths: [...n.paths, res.path] } : n)),
      );
      setExpanded(res.path.id);
      setCustomText('');
    });

  const restart = () => {
    setStage('ask');
    setQuestion('');
    setClarifyQuestions([]);
    setAnswers([]);
    setNodes([]);
    setActiveIndex(0);
    setRecordId(null);
    setReflection('');
    setReflectionSaved(false);
    setOffline(false);
  };

  return (
    <div data-testid="pusula" className="flex flex-col w-full min-h-screen px-5 pt-4 pb-8 max-w-[430px] mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between pb-3 mb-4 border-b border-[#2A3E5C]">
        <button
          type="button"
          data-testid="pusula-home"
          onClick={onExit}
          className="min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center rounded-full text-[#9FB0C3] hover:text-[#E8EEF5] hover:bg-[#17263C] cursor-pointer"
          aria-label="Ana ekrana dön"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-[#F2B266]" />
          <span className="font-heading text-base font-bold text-[#E8EEF5]">Pusula</span>
        </div>
        <span className="font-mono text-[11px] text-[#9FB0C3] w-11 text-right">
          {stage === 'map' && activeNode ? `${activeNode.depth}/${MAX_DEPTH}` : ''}
        </span>
      </header>

      {offline && (
        <div
          data-testid="pusula-offline"
          className="mb-4 px-3 py-2 rounded-xl bg-[#F2B266]/10 border border-[#F2B266]/30 text-[12px] text-[#F2B266]"
        >
          Çevrimdışı örnek harita: genel bir düşünme iskeleti gösteriliyor. Sorununa özel yollar için sunucuda API anahtarı gerekli.
        </div>
      )}

      {error && (
        <div
          data-testid="pusula-error"
          className="mb-4 px-3 py-2 rounded-xl bg-[#E58A7B]/15 border border-[#E58A7B]/30 text-[12px] text-[#E58A7B] flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && (
        <div data-testid="pusula-loading" className="flex flex-col items-center justify-center gap-3 py-16 text-[#9FB0C3]">
          <Loader2 className="w-6 h-6 animate-spin text-[#A7A3D9]" />
          <span className="text-sm">{loading}</span>
        </div>
      )}

      {/* Stage 1: ask */}
      {!loading && stage === 'ask' && (
        <main className="flex flex-col gap-4 flex-1">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-[#E8EEF5]">
              {firstName ? `${firstName}, neyle uğraşıyorsun?` : 'Neyle uğraşıyorsun?'}
            </h1>
            <p className="text-sm text-[#9FB0C3] mt-1.5 leading-relaxed">
              Sorunu veya kararını yaz. Sana cevap vermeyeceğim; hangi yoldan gidersen hangi mantıkla nereye varacağını göstereceğim.
            </p>
          </div>

          <textarea
            data-testid="pusula-question"
            rows={4}
            maxLength={600}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Örn. Canlıda bir hata var ve yeni sürüm dün gece çıktı…"
            className="w-full px-4 py-3 rounded-[16px] bg-[#17263C] border border-[#2A3E5C] text-[#E8EEF5] text-[15px] leading-relaxed placeholder:text-[#9FB0C3]/60 focus:outline-none focus:border-[#5FB3A8] resize-none"
          />

          <div className="flex flex-col gap-2">
            <span className="font-mono text-[11px] text-[#9FB0C3] uppercase tracking-wider">Örnek sorular</span>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  data-testid="pusula-example"
                  onClick={() => setQuestion(example)}
                  className="text-left min-h-[40px] px-3 py-2 rounded-[14px] bg-[#101C2E] border border-[#2A3E5C] text-[12px] text-[#9FB0C3] hover:border-[#A7A3D9]/60 hover:text-[#E8EEF5] cursor-pointer"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            data-testid="pusula-ask"
            disabled={question.trim().length < 8}
            onClick={ask}
            className={`mt-auto w-full min-h-[52px] rounded-[14px] font-mono text-[14px] font-bold flex items-center justify-center gap-2 border ${
              question.trim().length >= 8
                ? 'bg-[#5FB3A8] text-[#0F1B2D] border-[#5FB3A8] cursor-pointer hover:bg-[#529F95]'
                : 'bg-[#17263C] text-[#9FB0C3]/50 border-[#2A3E5C] cursor-not-allowed'
            }`}
          >
            <span>Yol haritası çıkar</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </main>
      )}

      {/* Stage 2: clarify — Pusula asks before it maps */}
      {!loading && stage === 'clarify' && (
        <main className="flex flex-col gap-4 flex-1">
          <div className="rounded-[16px] bg-[#101C2E] border border-[#2A3E5C] p-3.5">
            <span className="font-mono text-[11px] text-[#9FB0C3] uppercase tracking-wider">Sorun</span>
            <p className="text-sm text-[#E8EEF5] mt-1">{question}</p>
          </div>
          <div>
            <h2 className="font-heading text-lg font-bold text-[#E8EEF5]">Önce seni anlayayım</h2>
            <p className="text-[13px] text-[#9FB0C3] mt-1">
              Bu sorular haritayı sana göre çizer. Bilmediğini boş bırakabilirsin; bilmemek de bir bilgi.
            </p>
          </div>
          {clarifyQuestions.map((q, i) => (
            <label
              key={q}
              className="flex flex-col gap-2 rounded-[16px] bg-[#17263C] border border-[#2A3E5C] border-l-[3px] border-l-[#A7A3D9] p-4"
            >
              <span data-testid="pusula-clarify-question" className="text-sm text-[#E8EEF5] flex gap-2">
                <HelpCircle className="w-4 h-4 text-[#A7A3D9] shrink-0 mt-0.5" />
                {q}
              </span>
              <input
                data-testid={`pusula-answer-${i}`}
                type="text"
                maxLength={200}
                value={answers[i] ?? ''}
                onChange={(e) => setAnswers((prev) => prev.map((a, j) => (j === i ? e.target.value : a)))}
                placeholder="Kısaca yaz…"
                className="min-h-[44px] px-3.5 rounded-[12px] bg-[#0F1B2D] border border-[#2A3E5C] text-[#E8EEF5] text-sm placeholder:text-[#9FB0C3]/60 focus:outline-none focus:border-[#5FB3A8]"
              />
            </label>
          ))}
          <button
            type="button"
            data-testid="pusula-map-start"
            onClick={startMap}
            className="mt-auto w-full min-h-[52px] rounded-[14px] bg-[#5FB3A8] text-[#0F1B2D] font-mono text-[14px] font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-[#529F95]"
          >
            <span>Haritayı çiz</span>
            <GitBranch className="w-5 h-5" />
          </button>
        </main>
      )}

      {/* Stage 3: map */}
      {!loading && stage === 'map' && activeNode && (
        <main className="flex flex-col gap-4 flex-1">
          {/* Trail: every earlier decision point stays reachable */}
          {nodes.length > 1 && (
            <nav data-testid="pusula-trail" className="flex flex-wrap items-center gap-1.5" aria-label="İzlediğin yol">
              {nodes.map((n, i) => {
                const chosen = n.paths.find((p) => p.id === n.chosenPathId);
                const isActive = i === activeIndex;
                return (
                  <button
                    key={n.id}
                    type="button"
                    data-testid={`pusula-trail-${i}`}
                    onClick={() => {
                      setActiveIndex(i);
                      setExpanded(null);
                    }}
                    className={`min-h-[36px] px-3 rounded-full font-mono text-[11px] border cursor-pointer ${
                      isActive
                        ? 'bg-[#5FB3A8] text-[#0F1B2D] border-[#5FB3A8] font-bold'
                        : 'bg-[#17263C] text-[#9FB0C3] border-[#2A3E5C] hover:text-[#E8EEF5]'
                    }`}
                  >
                    {i + 1}. {chosen && !isActive ? chosen.title.slice(0, 22) : 'Karar noktası'}
                  </button>
                );
              })}
            </nav>
          )}

          <div className="rounded-[16px] bg-[#17263C] border border-[#2A3E5C] p-4">
            <span className="font-mono text-[11px] font-bold text-[#5FB3A8] uppercase tracking-wider">
              Karar noktası {activeNode.depth}
            </span>
            <p data-testid="pusula-situation" className="text-[15px] font-medium text-[#E8EEF5] leading-relaxed mt-1.5">
              {activeNode.situation}
            </p>
          </div>

          {isNew && (
            <p className="flex items-start gap-2 text-[12px] text-[#9FB0C3]">
              <Lightbulb className="w-4 h-4 text-[#F2B266] shrink-0" />
              İpucu: Her yolun "Ne zaman anlamlı" satırını kendi durumunla karşılaştır. Doğru yol yok; sana uyan koşul var.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {activeNode.paths.map((path, i) => {
              const isOpen = expanded === path.id;
              const isChosen = activeNode.chosenPathId === path.id;
              return (
                <article
                  key={path.id}
                  data-testid="pusula-path"
                  className={`rounded-[16px] border ${
                    isChosen ? 'bg-[#1F3150] border-[#5FB3A8]' : 'bg-[#17263C] border-[#2A3E5C]'
                  }`}
                >
                  <button
                    type="button"
                    data-testid="pusula-path-toggle"
                    aria-expanded={isOpen}
                    onClick={() => setExpanded(isOpen ? null : path.id)}
                    className="w-full min-h-[56px] p-4 flex items-center gap-3 text-left cursor-pointer"
                  >
                    <span className="w-8 h-8 rounded-full bg-[#101C2E] border border-[#2A3E5C] flex items-center justify-center font-mono text-sm font-bold text-[#5FB3A8] shrink-0">
                      {path.custom ? '✎' : String.fromCharCode(65 + i)}
                    </span>
                    <span className="flex-1 font-heading text-[15px] font-semibold text-[#E8EEF5]">
                      {path.title}
                      {isChosen && (
                        <span className="block font-mono text-[11px] font-normal text-[#5FB3A8] mt-0.5">izlediğin yol</span>
                      )}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-[#9FB0C3]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#9FB0C3]" />
                    )}
                  </button>

                  {isOpen && (
                    <div data-testid="pusula-path-details" className="px-4 pb-4 flex flex-col gap-3 text-[13px] leading-relaxed">
                      <Detail label="Hangi mantıkla" text={path.logic} testId="path-logic" />
                      <Detail label="Bu yoldan gidersen" text={path.leadsTo} testId="path-leads-to" />
                      <Detail label="Risk" text={path.risk} tone="danger" testId="path-risk" />
                      <Detail label="Ne zaman anlamlı" text={path.whenItFits} testId="path-when" />
                      <div className="flex flex-wrap gap-1.5">
                        {path.research.map((r) => (
                          <span
                            key={r}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#101C2E] border border-[#2A3E5C] font-mono text-[11px] text-[#E8EEF5]"
                          >
                            <Search className="w-3 h-3 text-[#A7A3D9]" />
                            {r}
                          </span>
                        ))}
                      </div>
                      <p
                        data-testid="path-self-question"
                        className="rounded-xl bg-[#A7A3D9]/10 border border-[#A7A3D9]/25 px-3 py-2 text-[#E8EEF5]"
                      >
                        <span className="font-mono text-[11px] text-[#A7A3D9] block mb-0.5">Kendine sor</span>
                        {path.selfQuestion}
                      </p>
                      <button
                        type="button"
                        data-testid="pusula-choose"
                        onClick={() => choosePath(path)}
                        className="w-full min-h-[48px] rounded-[14px] bg-[#5FB3A8] text-[#0F1B2D] font-mono text-[13px] font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-[#529F95]"
                      >
                        {activeNode.depth >= MAX_DEPTH ? 'Bu yolda haritayı tamamla' : 'Bu yoldan ilerle'}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {/* Player proposes their own path */}
          <div className="flex flex-col gap-2 rounded-[16px] bg-[#101C2E] border border-dashed border-[#2A3E5C] p-4">
            <label htmlFor="pusula-custom" className="text-[13px] text-[#E8EEF5] font-semibold">
              Aklında başka bir yol mu var?
            </label>
            <div className="flex gap-2">
              <input
                id="pusula-custom"
                data-testid="pusula-custom"
                type="text"
                maxLength={200}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Kendi yolunu yaz, mantığını birlikte açalım"
                className="flex-1 min-h-[44px] px-3.5 rounded-[12px] bg-[#0F1B2D] border border-[#2A3E5C] text-[#E8EEF5] text-sm placeholder:text-[#9FB0C3]/60 focus:outline-none focus:border-[#5FB3A8]"
              />
              <button
                type="button"
                data-testid="pusula-custom-add"
                disabled={customText.trim().length < 3}
                onClick={addCustomPath}
                aria-label="Yolu ekle"
                className={`min-h-[44px] min-w-[44px] rounded-[12px] flex items-center justify-center border ${
                  customText.trim().length >= 3
                    ? 'bg-[#A7A3D9]/15 border-[#A7A3D9]/50 text-[#A7A3D9] cursor-pointer'
                    : 'border-[#2A3E5C] text-[#9FB0C3]/40 cursor-not-allowed'
                }`}
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          <button
            type="button"
            data-testid="pusula-finish"
            onClick={() => finish(nodes)}
            className="w-full min-h-[48px] rounded-[14px] bg-[#17263C] border border-[#2A3E5C] text-[#E8EEF5] font-mono text-[13px] flex items-center justify-center gap-2 cursor-pointer hover:bg-[#1F3150]"
          >
            <Flag className="w-4 h-4 text-[#9FB0C3]" />
            Haritayı burada bitir
          </button>
        </main>
      )}

      {/* Stage 4: summary */}
      {!loading && stage === 'summary' && (
        <SummaryView
          question={question}
          nodes={nodes}
          researched={researched}
          onToggleResearched={onToggleResearched}
          reflection={reflection}
          reflectionSaved={reflectionSaved}
          onReflectionChange={(t) => {
            setReflection(t);
            setReflectionSaved(false);
          }}
          onSaveReflection={() => {
            if (recordId) onUpdateReflection(recordId, reflection);
            setReflectionSaved(true);
          }}
          onBackToMap={(i) => {
            setActiveIndex(i);
            setExpanded(null);
            setStage('map');
          }}
          onNewQuestion={restart}
        />
      )}
    </div>
  );
};

const Detail: React.FC<{ label: string; text: string; tone?: 'danger'; testId: string }> = ({
  label,
  text,
  tone,
  testId,
}) =>
  text ? (
    <div data-testid={testId}>
      <span className={`font-mono text-[11px] uppercase tracking-wider ${tone === 'danger' ? 'text-[#E58A7B]' : 'text-[#9FB0C3]'}`}>
        {label}
      </span>
      <p className="text-[#E8EEF5] mt-0.5">{text}</p>
    </div>
  ) : null;

interface SummaryViewProps {
  question: string;
  nodes: PusulaNode[];
  researched: string[];
  onToggleResearched: (item: string) => void;
  reflection: string;
  reflectionSaved: boolean;
  onReflectionChange: (text: string) => void;
  onSaveReflection: () => void;
  onBackToMap: (index: number) => void;
  onNewQuestion: () => void;
}

const SummaryView: React.FC<SummaryViewProps> = ({
  question,
  nodes,
  researched,
  onToggleResearched,
  reflection,
  reflectionSaved,
  onReflectionChange,
  onSaveReflection,
  onBackToMap,
  onNewQuestion,
}) => {
  const chosen = nodes
    .map((n, i) => ({ node: n, index: i, path: n.paths.find((p) => p.id === n.chosenPathId) }))
    .filter((c) => c.path);
  const research = Array.from(new Set(chosen.flatMap((c) => c.path!.research)));
  const untaken = nodes.reduce((sum, n) => sum + n.paths.filter((p) => p.id !== n.chosenPathId).length, 0);

  return (
    <main data-testid="pusula-summary" className="flex flex-col gap-4 flex-1">
      <div>
        <span className="font-mono text-[11px] text-[#9FB0C3] uppercase tracking-wider">Senin haritan</span>
        <h1 className="font-heading text-xl font-bold text-[#E8EEF5] mt-1">{question}</h1>
      </div>

      <div className="rounded-[16px] bg-[#17263C] border border-[#2A3E5C] p-4 flex flex-col gap-2">
        <span className="font-mono text-[11px] text-[#9FB0C3] uppercase tracking-wider font-semibold">İzlediğin yol</span>
        {chosen.length === 0 && <p className="text-sm text-[#9FB0C3]">Henüz bir yol seçmedin.</p>}
        {chosen.map(({ node, index, path }) => (
          <div key={node.id} className="flex items-start gap-3 p-2.5 rounded-xl bg-[#101C2E] border border-[#2A3E5C]">
            <span className="w-6 h-6 rounded-full bg-[#5FB3A8]/20 text-[#5FB3A8] flex items-center justify-center font-mono text-[11px] shrink-0">
              {index + 1}
            </span>
            <div className="flex flex-col min-w-0">
              <span data-testid="pusula-summary-step" className="font-heading text-sm font-semibold text-[#E8EEF5]">
                {path!.title}
              </span>
              <span className="text-[12px] text-[#9FB0C3]">→ {path!.leadsTo}</span>
            </div>
          </div>
        ))}
        {untaken > 0 && (
          <button
            type="button"
            data-testid="pusula-other-paths"
            onClick={() => onBackToMap(0)}
            className="self-start mt-1 min-h-[44px] inline-flex items-center gap-2 font-mono text-[12px] text-[#A7A3D9] hover:text-[#E8EEF5] cursor-pointer"
          >
            <GitBranch className="w-4 h-4" />
            Seçmediğin {untaken} yol var. Başka bir senaryodan geçseydin?
          </button>
        )}
      </div>

      <div className="rounded-[16px] bg-[#17263C] border border-[#2A3E5C] p-4 flex flex-col gap-2.5">
        <span className="font-heading text-sm font-semibold text-[#E8EEF5]">Araştırman gereken noktalar</span>
        <p className="text-xs text-[#9FB0C3]">Cevap haritada değil, bu kavramlarda. Araştırdıkça işaretle.</p>
        <div className="flex flex-wrap gap-2">
          {research.map((item) => {
            const done = researched.includes(item);
            return (
              <button
                key={item}
                type="button"
                data-testid="pusula-research-item"
                aria-pressed={done}
                onClick={() => onToggleResearched(item)}
                className={`inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-full border font-mono text-[11px] cursor-pointer ${
                  done
                    ? 'bg-[#5FB3A8]/15 border-[#5FB3A8] text-[#5FB3A8]'
                    : 'bg-[#1F3150] border-[#2A3E5C] text-[#E8EEF5] hover:border-[#A7A3D9]/60'
                }`}
              >
                {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Search className="w-3 h-3 text-[#A7A3D9]" />}
                {item}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[16px] bg-[#17263C] border border-[#2A3E5C] border-l-[3px] border-l-[#A7A3D9] p-4 flex flex-col gap-2.5">
        <label htmlFor="pusula-reflection" className="flex items-center gap-2 font-heading text-sm font-semibold text-[#E8EEF5]">
          <PenLine className="w-4 h-4 text-[#A7A3D9]" />
          Şimdi kendi cevabın ne?
        </label>
        <p className="text-xs text-[#9FB0C3]">Haritaya bakarak tek cümleyle yaz. Bu senin kararın, Pusula'nın değil.</p>
        <textarea
          id="pusula-reflection"
          data-testid="pusula-reflection"
          rows={2}
          maxLength={200}
          value={reflection}
          onChange={(e) => onReflectionChange(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#0F1B2D] border border-[#2A3E5C] text-[#E8EEF5] text-sm focus:outline-none focus:border-[#5FB3A8] resize-none"
        />
        <button
          type="button"
          data-testid="pusula-save"
          disabled={!reflection.trim()}
          onClick={onSaveReflection}
          className={`self-end min-h-[44px] px-4 rounded-[14px] font-mono text-[12px] font-semibold border ${
            reflection.trim()
              ? 'bg-[#A7A3D9]/15 border-[#A7A3D9]/50 text-[#A7A3D9] cursor-pointer'
              : 'border-[#2A3E5C] text-[#9FB0C3]/50 cursor-not-allowed'
          }`}
        >
          {reflectionSaved ? 'Günlüğe kaydedildi ✓' : 'Günlüğe kaydet'}
        </button>
      </div>

      <button
        type="button"
        data-testid="pusula-new"
        onClick={onNewQuestion}
        className="mt-auto w-full min-h-[52px] rounded-[14px] bg-[#5FB3A8] text-[#0F1B2D] font-mono text-[14px] font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-[#529F95]"
      >
        <RotateCcw className="w-4 h-4" />
        Yeni soru sor
      </button>
    </main>
  );
};

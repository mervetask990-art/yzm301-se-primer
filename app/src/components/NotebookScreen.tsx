import React, { useState } from 'react';
import { ArrowLeft, BookOpen, Clock, Loader2, PenLine, RefreshCw } from 'lucide-react';
import {
  NotebookEntry,
  REVIEW_INTERVAL_DAYS,
  ReviewResult,
  TopicId,
  isDue,
  topicLabel,
} from '../skills';
import { PusulaProfile } from '../pusula/model';

interface NotebookScreenProps {
  entries: NotebookEntry[];
  pending: { concept: string; topic: TopicId }[]; // researched but not yet explained
  profile: Partial<PusulaProfile>;
  onAddEntry: (concept: string, topic: TopicId, explanation: string) => void;
  onReviewed: (concept: string, result: ReviewResult, explanation: string) => void;
  onExit: () => void;
}

const RESULT_TEXT: Record<ReviewResult, { label: string; color: string }> = {
  solid: { label: 'Oturmuş', color: '#7BC8A4' },
  partial: { label: 'Yolda', color: '#F2B266' },
  gap: { label: 'Boşluk var', color: '#E58A7B' },
};

const DAY = 86_400_000;

function relativeDay(iso: string): string {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / DAY);
  if (days <= 0) return 'bugün';
  if (days === 1) return 'yarın';
  return `${days} gün sonra`;
}

export const NotebookScreen: React.FC<NotebookScreenProps> = ({
  entries,
  pending,
  profile,
  onAddEntry,
  onReviewed,
  onExit,
}) => {
  const due = entries.filter((e) => isDue(e));

  return (
    <div data-testid="notebook" className="flex flex-col w-full min-h-screen px-5 pt-4 pb-8 max-w-[430px] mx-auto">
      <header className="flex items-center justify-between pb-3 mb-4 border-b border-[#2A3E5C]">
        <button
          type="button"
          data-testid="notebook-home"
          onClick={onExit}
          className="min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center rounded-full text-[#9FB0C3] hover:text-[#E8EEF5] hover:bg-[#17263C] cursor-pointer"
          aria-label="Ana ekrana dön"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#F2B266]" />
          <span className="font-heading text-base font-bold text-[#E8EEF5]">Defterim</span>
        </div>
        <span className="w-11" />
      </header>

      <p className="text-[13px] text-[#9FB0C3] leading-relaxed mb-4">
        Araştırdığın kavramları kendi kelimelerinle yaz. Her biri 1, 3, 7 ve 14 gün sonra geri gelir; her seferinde yeniden açıklarsın.
        Unuttuğunu fark etmek de öğrenmenin parçası.
      </p>

      {due.length > 0 && (
        <section data-testid="notebook-due" className="flex flex-col gap-3 mb-6">
          <h2 className="flex items-center gap-2 font-heading text-[15px] font-semibold text-[#E8EEF5]">
            <RefreshCw className="w-4 h-4 text-[#A7A3D9]" />
            Bugün tekrar zamanı ({due.length})
          </h2>
          {due.map((entry) => (
            <ReviewCard key={entry.concept} entry={entry} profile={profile} onReviewed={onReviewed} />
          ))}
        </section>
      )}

      {pending.length > 0 && (
        <section data-testid="notebook-pending" className="flex flex-col gap-3 mb-6">
          <h2 className="flex items-center gap-2 font-heading text-[15px] font-semibold text-[#E8EEF5]">
            <PenLine className="w-4 h-4 text-[#A7A3D9]" />
            Kendi kelimelerinle açıkla ({pending.length})
          </h2>
          {pending.map((p) => (
            <ExplainCard key={p.concept} concept={p.concept} topic={p.topic} onSave={onAddEntry} />
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-[15px] font-semibold text-[#E8EEF5]">Defterin</h2>
        {entries.length === 0 && (
          <p data-testid="notebook-empty" className="text-[13px] text-[#9FB0C3]">
            Henüz kayıt yok. Bir nöbetin veya Pusula haritasının sonunda kavramları "araştırdım" diye işaretle, buraya düşsünler.
          </p>
        )}
        {entries.map((e) => {
          const mastered = e.stage >= REVIEW_INTERVAL_DAYS.length;
          return (
            <article
              key={e.concept}
              data-testid="notebook-entry"
              className="rounded-[16px] bg-[#17263C] border border-[#2A3E5C] p-3.5 flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[12px] font-semibold text-[#E8EEF5]">{e.concept}</span>
                <span className="flex gap-1" aria-label={`Tekrar aşaması ${e.stage}/${REVIEW_INTERVAL_DAYS.length}`}>
                  {REVIEW_INTERVAL_DAYS.map((_, i) => (
                    <span
                      key={i}
                      className={`w-2 h-2 rounded-full ${i < e.stage ? 'bg-[#5FB3A8]' : 'bg-[#2A3E5C]'}`}
                    />
                  ))}
                </span>
              </div>
              <p className="text-[12px] text-[#9FB0C3] italic">“{e.explanation}”</p>
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-[#9FB0C3]">
                <Clock className="w-3 h-3" />
                {topicLabel(e.topic)} · {mastered ? 'oturdu, ayda bir' : `sonraki tekrar ${relativeDay(e.nextReview)}`}
              </span>
            </article>
          );
        })}
      </section>
    </div>
  );
};

const ExplainCard: React.FC<{
  concept: string;
  topic: TopicId;
  onSave: (concept: string, topic: TopicId, explanation: string) => void;
}> = ({ concept, topic, onSave }) => {
  const [text, setText] = useState('');
  return (
    <div data-testid="notebook-pending-item" className="rounded-[16px] bg-[#17263C] border border-[#2A3E5C] border-l-[3px] border-l-[#A7A3D9] p-4 flex flex-col gap-2">
      <span className="font-mono text-[12px] font-semibold text-[#E8EEF5]">{concept}</span>
      <span className="font-mono text-[11px] text-[#9FB0C3]">{topicLabel(topic)}</span>
      <textarea
        data-testid="explain-input"
        rows={2}
        maxLength={400}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Bir arkadaşına anlatır gibi, 1-2 cümle…"
        className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#0F1B2D] border border-[#2A3E5C] text-[#E8EEF5] text-sm placeholder:text-[#9FB0C3]/60 focus:outline-none focus:border-[#5FB3A8] resize-none"
      />
      <button
        type="button"
        data-testid="explain-save"
        disabled={text.trim().length < 10}
        onClick={() => onSave(concept, topic, text)}
        className={`self-end min-h-[44px] px-4 rounded-[14px] font-mono text-[12px] font-semibold border ${
          text.trim().length >= 10
            ? 'bg-[#5FB3A8] border-[#5FB3A8] text-[#0F1B2D] cursor-pointer'
            : 'border-[#2A3E5C] text-[#9FB0C3]/50 cursor-not-allowed'
        }`}
      >
        Deftere yaz
      </button>
    </div>
  );
};

const ReviewCard: React.FC<{
  entry: NotebookEntry;
  profile: Partial<PusulaProfile>;
  onReviewed: (concept: string, result: ReviewResult, explanation: string) => void;
}> = ({ entry, profile, onReviewed }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState<{ result: ReviewResult; followUp: string } | null>(null);
  const [error, setError] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept: entry.concept, explanation: text, previous: entry.explanation, profile }),
      });
      if (!response.ok) throw new Error('review failed');
      const data = await response.json();
      setOutcome({ result: data.result, followUp: data.followUp });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="notebook-due-item" className="rounded-[16px] bg-[#1F3150] border border-[#A7A3D9]/40 p-4 flex flex-col gap-2.5">
      <span className="font-mono text-[13px] font-semibold text-[#E8EEF5]">{entry.concept}</span>
      {!outcome && (
        <>
          <label className="text-[13px] text-[#E8EEF5]" htmlFor={`review-${entry.concept}`}>
            Eski notuna bakmadan, şimdi nasıl açıklarsın?
          </label>
          <textarea
            id={`review-${entry.concept}`}
            data-testid="review-input"
            rows={2}
            maxLength={600}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#0F1B2D] border border-[#2A3E5C] text-[#E8EEF5] text-sm focus:outline-none focus:border-[#5FB3A8] resize-none"
          />
          {error && <p className="text-[12px] text-[#E58A7B]">Şu an değerlendirilemedi, biraz sonra tekrar dene.</p>}
          <button
            type="button"
            data-testid="review-submit"
            disabled={text.trim().length < 5 || loading}
            onClick={submit}
            className={`self-end min-h-[44px] px-4 rounded-[14px] font-mono text-[12px] font-semibold border flex items-center gap-2 ${
              text.trim().length >= 5 && !loading
                ? 'bg-[#A7A3D9]/15 border-[#A7A3D9]/50 text-[#A7A3D9] cursor-pointer'
                : 'border-[#2A3E5C] text-[#9FB0C3]/50 cursor-not-allowed'
            }`}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Kontrol et
          </button>
        </>
      )}
      {outcome && (
        <div data-testid="review-result" className="flex flex-col gap-2 text-[13px]">
          <span
            data-testid="review-result-label"
            className="font-mono text-[11px] font-bold uppercase tracking-wider"
            style={{ color: RESULT_TEXT[outcome.result].color }}
          >
            {RESULT_TEXT[outcome.result].label}
          </span>
          <p className="text-[#A7A3D9]">{outcome.followUp}</p>
          <p className="text-[12px] text-[#9FB0C3] italic">Geçen seferki açıklaman: “{entry.explanation}”</p>
          <button
            type="button"
            data-testid="review-done"
            onClick={() => onReviewed(entry.concept, outcome.result, text)}
            className="self-end min-h-[44px] px-4 rounded-[14px] bg-[#5FB3A8] text-[#0F1B2D] font-mono text-[12px] font-bold cursor-pointer"
          >
            Deftere işle
          </button>
        </div>
      )}
    </div>
  );
};

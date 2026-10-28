import React, { useState } from 'react';
import {
  Check,
  AlertTriangle,
  RotateCcw,
  GitBranch,
  BookOpen,
  Search,
  Clock,
  Sparkles,
  CheckCircle2,
  PenLine,
} from 'lucide-react';
import { ChoiceId, ScenarioData } from '../types';
import { SkillEvent, TOPICS, TopicId, tierFor, tierLabel } from '../skills';

interface EndingScreenProps {
  scenario: ScenarioData;
  choices: Record<string, ChoiceId>; // K1, K2, K3
  finalClock: string;
  collectedResearch: string[];
  viewAlternate: boolean;
  onToggleAlternate: () => void;
  onRestart: () => void;
  name: string;
  runNumber: number;
  researched: string[];
  onToggleResearched: (item: string) => void;
  onSaveReflection: (text: string) => void;
  skillEvents: SkillEvent[]; // what this run changed in the skill map
  skills: Partial<Record<TopicId, number>>;
}

export const EndingScreen: React.FC<EndingScreenProps> = ({
  scenario,
  choices,
  finalClock,
  collectedResearch,
  viewAlternate,
  onToggleAlternate,
  onRestart,
  name,
  runNumber,
  researched,
  onToggleResearched,
  onSaveReflection,
  skillEvents,
  skills,
}) => {
  // Net change per topic in this run, in skill-map order
  const deltas = TOPICS.map((t) => ({
    ...t,
    delta: skillEvents.filter((e) => e.topic === t.id).reduce((s, e) => s + e.delta, 0),
    touched: skillEvents.some((e) => e.topic === t.id),
    score: skills[t.id],
  })).filter((t) => t.touched);
  const [reflection, setReflection] = useState('');
  const [reflectionSaved, setReflectionSaved] = useState(false);
  const firstName = name.trim();
  const researchedHere = collectedResearch.filter((item) => researched.includes(item)).length;
  // Real outcome rule from scenario: K3 === 'A' ? 'A' : 'B'
  const realEndingType = choices.K3 === 'A' ? 'A' : 'B';
  const displayEndingType = viewAlternate
    ? realEndingType === 'A'
      ? 'B'
      : 'A'
    : realEndingType;

  const isSuccess = displayEndingType === 'A';
  const endingData = scenario.endings[displayEndingType];
  const endingText = endingData.text.replace('{clock}', finalClock);

  // Labels for the path summary
  const k1Choice = choices.K1 || 'A';
  const k2Choice = choices.K2 || 'A';
  const k3Choice = viewAlternate ? (choices.K3 === 'A' ? 'B' : 'A') : choices.K3 || 'A';

  const isComboBB = k1Choice === 'B' && k2Choice === 'B';

  return (
    <div
      data-testid={isSuccess ? 'ending-A' : 'ending-B'}
      className="flex flex-col w-full min-h-screen px-5 pt-4 pb-8 max-w-[430px] mx-auto"
    >
      {/* Status Badge & Clock Indicator */}
      <header className="flex items-center justify-between pb-3 mb-3 border-b border-[#2A3E5C]">
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${
            isSuccess
              ? 'bg-[#17263C] text-[#7BC8A4] border border-[#7BC8A4]/30'
              : 'bg-[#E58A7B]/15 text-[#E58A7B] border border-[#E58A7B]/30'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="font-mono text-[10px] font-bold tracking-widest uppercase">
            {isSuccess
              ? 'NÖBET TAMAMLANDI · KRİZ ÇÖZÜLDÜ'
              : 'NÖBET TAMAMLANDI · KVKK RİSKİ'}
          </span>
        </div>

        <div className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-[#F2B266] bg-[#17263C] px-2.5 py-1 rounded-full border border-[#2A3E5C]">
          <Clock className="w-3.5 h-3.5 text-[#F2B266]" />
          <span data-testid="ending-clock">{finalClock}</span>
        </div>
      </header>

      {/* Hero Accomplishment Block */}
      <section className="flex flex-col gap-1 mb-5">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`w-2 h-2 rounded-full ${
              isSuccess ? 'bg-[#5FB3A8]' : 'bg-[#E58A7B]'
            } animate-pulse`}
          />
          <span className="font-mono text-[11px] text-[#9FB0C3] uppercase tracking-wider">
            MÜDAHALE RAPORU #409
          </span>
        </div>

        <h1
          className={`font-heading text-2xl font-bold tracking-tight ${
            isSuccess ? 'text-[#7BC8A4]' : 'text-[#E58A7B]'
          }`}
        >
          {endingData.title}
        </h1>

        <p className="text-sm text-[#9FB0C3] mt-1 leading-relaxed">
          {endingText}
        </p>
        <p data-testid="ending-run-number" className="font-mono text-[11px] text-[#9FB0C3] mt-1">
          {firstName ? `${firstName}, bu` : 'Bu'} senin {runNumber}. nöbetin.
        </p>
      </section>

      {/* Skill map changes from this run */}
      {deltas.length > 0 && (
        <div data-testid="skill-delta" className="flex flex-col rounded-[16px] bg-[#17263C] border border-[#2A3E5C] p-4 mb-4 gap-2">
          <span className="font-mono text-[11px] text-[#9FB0C3] uppercase tracking-wider font-semibold">
            Bu nöbette becerilerin
          </span>
          {deltas.map((d) => (
            <div key={d.id} data-testid={`skill-delta-${d.id}`} className="flex items-center gap-3">
              <span className="flex-1 text-[13px] text-[#E8EEF5]">{d.label}</span>
              <span
                className={`font-mono text-[13px] font-bold ${
                  d.delta > 0 ? 'text-[#7BC8A4]' : d.delta < 0 ? 'text-[#E58A7B]' : 'text-[#9FB0C3]'
                }`}
              >
                {d.delta > 0 ? `+${d.delta}` : d.delta}
              </span>
              {d.score !== undefined && (
                <span className="font-mono text-[11px] text-[#9FB0C3] w-24 text-right">
                  {d.score}/100 · {tierLabel[tierFor(d.score)]}
                </span>
              )}
            </div>
          ))}
          <p className="text-[11px] text-[#9FB0C3] mt-1">
            Puan doğru cevabı değil, dikkatli karar kanıtını ölçer. Bir sonraki nöbette destek buna göre ayarlanır.
          </p>
        </div>
      )}

      {/* Card 1: Izlenen Yol (Path Summary) */}
      <div className="flex flex-col rounded-[16px] bg-[#17263C] border border-[#2A3E5C] p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-[11px] text-[#9FB0C3] uppercase tracking-wider font-semibold">
            İZLENEN YOL
          </span>
          <span className="font-mono text-[11px] text-[#5FB3A8]">
            3/3 Adım
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {/* Step 1 */}
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#101C2E] border border-[#2A3E5C]">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#5FB3A8]/20 text-[#5FB3A8] shrink-0">
              <Check className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-mono text-[13px] font-semibold text-[#E8EEF5]">
                K1 · {k1Choice === 'A' ? 'Rollback' : 'Hotfix'}
              </span>
              <span className="text-[12px] text-[#9FB0C3] truncate">
                {scenario.decisions[0].choices[k1Choice].label}
              </span>
            </div>
          </div>

          <div className="flex items-center pl-5 text-[#9FB0C3]/40 text-xs">
            ↓
          </div>

          {/* Step 2 */}
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#101C2E] border border-[#2A3E5C]">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#5FB3A8]/20 text-[#5FB3A8] shrink-0">
              <Check className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-mono text-[13px] font-semibold text-[#E8EEF5]">
                K2 · {k2Choice === 'A' ? 'Smoke test' : isComboBB ? 'Denenmemiş yama' : 'Hemen yayına al'}
              </span>
              <span className="text-[12px] text-[#9FB0C3] truncate">
                {scenario.decisions[1].choices[k2Choice].label}
              </span>
            </div>
          </div>

          <div className="flex items-center pl-5 text-[#9FB0C3]/40 text-xs">
            ↓
          </div>

          {/* Step 3 */}
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#101C2E] border border-[#2A3E5C]">
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${
                k3Choice === 'A'
                  ? 'bg-[#5FB3A8]/20 text-[#5FB3A8]'
                  : 'bg-[#E58A7B]/20 text-[#E58A7B]'
              }`}
            >
              {k3Choice === 'A' ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span
                className={`font-mono text-[13px] font-semibold ${
                  k3Choice === 'A' ? 'text-[#E8EEF5]' : 'text-[#E58A7B]'
                }`}
              >
                K3 · {k3Choice === 'A' ? 'Maskeleme' : 'Olduğu gibi gönder'}
              </span>
              <span className="text-[12px] text-[#9FB0C3] truncate">
                {scenario.decisions[2].choices[k3Choice].label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Card 2: Araştırman Gereken Noktalar */}
      <div className="flex flex-col rounded-[16px] bg-[#17263C] border border-[#2A3E5C] p-4 mb-6">
        <div className="flex items-center gap-2 mb-1.5">
          <BookOpen className="w-5 h-5 text-[#F2B266]" />
          <h2 className="font-heading text-sm font-semibold text-[#E8EEF5]">
            Araştırman gereken noktalar
          </h2>
        </div>
        <p className="text-xs text-[#9FB0C3] mb-3">
          Araştırdığın kavrama dokun, günlüğüne işlensin. Bir sonraki nöbette tutor bunun üzerine soru sorar.
          <span data-testid="research-progress" className="block mt-1 font-mono text-[#A7A3D9]">
            {researchedHere}/{collectedResearch.length} araştırıldı
          </span>
        </p>

        {/* Research checklist chips */}
        <div
          data-testid="ending-research"
          className="flex flex-wrap gap-2 mb-3"
        >
          {collectedResearch.map((item) => {
            const done = researched.includes(item);
            return (
              <button
                key={item}
                type="button"
                data-testid="research-item"
                aria-pressed={done}
                onClick={() => onToggleResearched(item)}
                className={`inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-full border font-mono text-[11px] cursor-pointer active:scale-95 ${
                  done
                    ? 'bg-[#5FB3A8]/15 border-[#5FB3A8] text-[#5FB3A8]'
                    : 'bg-[#1F3150] border-[#2A3E5C] text-[#E8EEF5] hover:border-[#A7A3D9]/60'
                }`}
              >
                {done ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Search className="w-3 h-3 text-[#A7A3D9]" />
                )}
                <span>{item}</span>
              </button>
            );
          })}
        </div>

        {/* Quiet Thoughtful Note */}
        <div className="flex items-start gap-2 pt-2 border-t border-[#2A3E5C] text-[#9FB0C3]">
          <BookOpen className="w-4 h-4 text-[#F2B266] shrink-0 mt-0.5" />
          <p className="text-xs italic text-[#9FB0C3]">
            Cevaplar burada değil. Bu kavramları araştır, sonra tekrar oyna.
          </p>
        </div>
      </div>

      {/* Card 3: One-line reflection saved to the journal */}
      <div className="flex flex-col rounded-[16px] bg-[#17263C] border border-[#2A3E5C] border-l-[3px] border-l-[#A7A3D9] p-4 mb-6 gap-2.5">
        <label htmlFor="reflection" className="flex items-center gap-2">
          <PenLine className="w-4 h-4 text-[#A7A3D9]" />
          <span className="font-heading text-sm font-semibold text-[#E8EEF5]">
            Bu nöbetten tek cümle
          </span>
        </label>
        <p className="text-xs text-[#9FB0C3]">
          Kendi kelimelerinle yaz: bir dahaki krizde neyi farklı yapacaksın?
        </p>
        <textarea
          id="reflection"
          data-testid="reflection-input"
          rows={2}
          maxLength={200}
          value={reflection}
          onChange={(e) => {
            setReflection(e.target.value);
            setReflectionSaved(false);
          }}
          placeholder="Örn. Geri dönmeden önce migration'ı kontrol ederim."
          className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#0F1B2D] border border-[#2A3E5C] text-[#E8EEF5] text-sm placeholder:text-[#9FB0C3]/60 focus:outline-none focus:border-[#5FB3A8] resize-none"
        />
        <button
          type="button"
          data-testid="reflection-save"
          disabled={!reflection.trim()}
          onClick={() => {
            onSaveReflection(reflection);
            setReflectionSaved(true);
          }}
          className={`self-end min-h-[44px] px-4 rounded-[14px] font-mono text-[12px] font-semibold border ${
            reflection.trim()
              ? 'bg-[#A7A3D9]/15 border-[#A7A3D9]/50 text-[#A7A3D9] cursor-pointer hover:bg-[#A7A3D9]/25'
              : 'bg-transparent border-[#2A3E5C] text-[#9FB0C3]/50 cursor-not-allowed'
          }`}
        >
          {reflectionSaved ? 'Günlüğe kaydedildi ✓' : 'Günlüğe kaydet'}
        </button>
      </div>

      {/* Bottom Interactive Action Area */}
      <footer className="flex flex-col gap-2.5 mt-auto pt-2">
        {/* Primary Action: Replay */}
        <button
          type="button"
          data-testid="restart"
          onClick={onRestart}
          className="flex items-center justify-center gap-2 w-full min-h-[48px] h-[52px] rounded-[14px] bg-[#5FB3A8] text-[#0F1B2D] font-mono text-[14px] font-bold cursor-pointer hover:bg-[#529F95] active:scale-95 transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Yeniden oyna</span>
        </button>

        {/* Secondary Action: Explore alternate ending */}
        <button
          type="button"
          onClick={onToggleAlternate}
          className="flex items-center justify-center gap-2 w-full min-h-[48px] h-[48px] rounded-[14px] bg-[#17263C] border border-[#2A3E5C] hover:border-[#5FB3A8]/40 hover:bg-[#1F3150] text-[#E8EEF5] font-mono text-[13px] cursor-pointer active:scale-98 transition-all"
        >
          <GitBranch className="w-4 h-4 text-[#9FB0C3]" />
          <span>{viewAlternate ? 'Gerçek sonuna dön' : 'Diğer sonu gör'}</span>
        </button>
      </footer>
    </div>
  );
};

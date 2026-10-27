import React from 'react';
import { CheckCircle2, AlertOctagon, Lightbulb, Search, ArrowRight, Clock } from 'lucide-react';
import { DecisionData, ChoiceId, ScenarioData } from '../types';

interface OutcomeScreenProps {
  decision: DecisionData;
  choice: ChoiceId;
  decisionNumber: number; // 1, 2, 3
  isComboBB: boolean;
  isTimeout: boolean;
  scenario: ScenarioData;
  onNext: () => void;
}

export const OutcomeScreen: React.FC<OutcomeScreenProps> = ({
  decision,
  choice,
  decisionNumber,
  isComboBB,
  isTimeout,
  scenario,
  onNext,
}) => {
  // Determine effective what, why, research
  let effectiveWhat: string;
  let effectiveWhy: string;
  let effectiveResearch: string[];
  let effectiveMinutes: number;

  if (isComboBB && decision.combo?.['B+B']) {
    const combo = decision.combo['B+B'];
    effectiveWhat = combo.what;
    effectiveWhy = combo.why;
    effectiveResearch = combo.research;
    effectiveMinutes = decision.choices[choice].minutes + combo.minutes;
  } else {
    const choiceData = decision.choices[choice];
    effectiveWhat = choiceData.what;
    effectiveWhy = choiceData.why;
    effectiveResearch = choiceData.research;
    effectiveMinutes = choiceData.minutes;
  }

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-65px)] px-5 pt-4 pb-8 max-w-[430px] mx-auto">
      {/* Header Banner */}
      <div className="flex items-center justify-between mb-3">
        <div className="inline-flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#5FB3A8]" />
          <span className="font-mono text-[11px] font-bold text-[#5FB3A8] uppercase tracking-wider">
            SONUÇ · KARAR {decisionNumber}
          </span>
        </div>
        <div className="inline-flex items-center gap-1 font-mono text-[11px] text-[#F2B266] bg-[#17263C] px-2.5 py-0.5 rounded-full border border-[#2A3E5C]">
          <Clock className="w-3 h-3 text-[#F2B266]" />
          <span>+{effectiveMinutes} dk</span>
        </div>
      </div>

      <h1 className="font-heading text-xl font-bold tracking-tight text-[#E8EEF5] mb-4">
        {decision.choices[choice].label}
      </h1>

      <main className="flex flex-col gap-3.5 mb-6">
        {/* Timeout Notice if timed out */}
        {isTimeout && (
          <div
            data-testid="timeout-notice"
            className="p-4 rounded-[16px] bg-[#E58A7B]/15 border border-[#E58A7B]/40 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2 text-[#E58A7B]">
              <AlertOctagon className="w-4 h-4 shrink-0" />
              <span className="font-mono text-[12px] font-bold uppercase tracking-wider">
                Süre Doldu · Otomatik Karar
              </span>
            </div>
            <p className="text-sm text-[#E8EEF5]">{scenario.timeout.what}</p>
            <p className="text-xs text-[#9FB0C3] italic">{scenario.timeout.why}</p>
          </div>
        )}

        {/* Card 1: Ne Oldu */}
        <div
          data-testid="outcome-what"
          className="bg-[#17263C] rounded-[16px] border border-[#2A3E5C] p-4 flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#7BC8A4]" />
            <span className="font-mono text-[12px] font-bold text-[#7BC8A4] uppercase tracking-wider">
              Ne oldu?
            </span>
          </div>
          <p className="text-sm text-[#E8EEF5] leading-relaxed">{effectiveWhat}</p>
        </div>

        {/* Card 2: Neden Oldu */}
        <div
          data-testid="outcome-why"
          className="bg-[#17263C] rounded-[16px] border border-[#2A3E5C] p-4 flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-[#F2B266]" />
            <span className="font-mono text-[12px] font-bold text-[#F2B266] uppercase tracking-wider">
              Neden oldu?
            </span>
          </div>
          <p className="text-sm text-[#9FB0C3] leading-relaxed">{effectiveWhy}</p>
        </div>

        {/* Card 3: Araştırman Gereken Noktalar */}
        <div
          data-testid="outcome-research"
          className="bg-[#17263C] rounded-[16px] border border-[#2A3E5C] p-4 flex flex-col gap-2.5"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-[#A7A3D9]" />
            <span className="font-mono text-[12px] font-bold text-[#A7A3D9] uppercase tracking-wider">
              Araştırman gereken noktalar
            </span>
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {effectiveResearch.map((item, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1F3150] border border-[#2A3E5C] text-[#E8EEF5] font-mono text-[11px]"
              >
                <Search className="w-3 h-3 text-[#A7A3D9]" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </main>

      {/* Action Footer */}
      <footer className="mt-auto pt-2">
        <button
          type="button"
          data-testid="next-button"
          onClick={onNext}
          className="w-full min-h-[48px] h-[52px] bg-[#5FB3A8] text-[#0F1B2D] font-mono text-[14px] font-bold rounded-[14px] flex items-center justify-center gap-2 cursor-pointer hover:bg-[#529F95] active:scale-95 transition-all"
        >
          <span>Devam</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </footer>
    </div>
  );
};

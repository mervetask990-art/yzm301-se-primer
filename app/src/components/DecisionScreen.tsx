import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Lightbulb, MessageSquareText, ShieldCheck } from 'lucide-react';
import { DecisionData, ChoiceId, LevelId } from '../types';

interface DecisionScreenProps {
  decision: DecisionData;
  decisionNumber: number; // 1, 2, 3
  level: LevelId;
  revealedHint: boolean;
  onToggleHint: () => void;
  onMakeChoice: (choice: ChoiceId, isTimeout?: boolean) => void;
  onOpenTutor: () => void;
  onTimeUpdate?: (secondsLeft: number) => void;
}

export const DecisionScreen: React.FC<DecisionScreenProps> = ({
  decision,
  decisionNumber,
  level,
  revealedHint,
  onToggleHint,
  onMakeChoice,
  onOpenTutor,
  onTimeUpdate,
}) => {
  const isSenior = level === 'senior';
  const isMid = level === 'mid';
  const isNew = level === 'new';

  // Senior 60-second countdown using Date.now() and setInterval as requested
  const choiceMadeRef = useRef(false);

  // Parent passes new callback instances on every render; keep them in refs so the
  // countdown effect does not restart (which previously reset the timer forever).
  const onMakeChoiceRef = useRef(onMakeChoice);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onMakeChoiceRef.current = onMakeChoice;
  onTimeUpdateRef.current = onTimeUpdate;

  useEffect(() => {
    choiceMadeRef.current = false;
    if (!isSenior) return;

    const durationMs = 60 * 1000;
    const targetEndTime = Date.now() + durationMs;
    onTimeUpdateRef.current?.(60);

    const intervalId = setInterval(() => {
      if (choiceMadeRef.current) {
        clearInterval(intervalId);
        return;
      }

      const remainingSec = Math.max(0, Math.ceil((targetEndTime - Date.now()) / 1000));
      onTimeUpdateRef.current?.(remainingSec);

      if (remainingSec <= 0) {
        clearInterval(intervalId);
        choiceMadeRef.current = true;
        // Apply timeout default choice ('B') automatically
        onMakeChoiceRef.current('B', true);
      }
    }, 250);

    return () => {
      clearInterval(intervalId);
    };
  }, [decision.id, isSenior]);

  const handleSelectChoice = (choice: ChoiceId) => {
    if (choiceMadeRef.current) return;
    choiceMadeRef.current = true;
    onMakeChoice(choice, false);
  };

  const showHint = isNew || (isMid && revealedHint);

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-65px)] px-5 pt-4 pb-8 max-w-[430px] mx-auto">
      {/* Category Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="inline-flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#5FB3A8]" />
          <span
            data-testid="decision-title"
            className="font-mono text-[11px] font-bold text-[#5FB3A8] uppercase tracking-wider"
          >
            KARAR {decisionNumber} · {decision.topic.toLocaleUpperCase('tr-TR')}
          </span>
        </div>
        <span className="font-mono text-[11px] text-[#9FB0C3]">
          CANLI OLAY #204
        </span>
      </div>

      {/* Incident Box */}
      <div className="bg-[#17263C] rounded-[16px] border border-[#2A3E5C] p-4 flex flex-col gap-3.5 mb-4">
        {/* Warning Indicator (coral on 15% coral bg, no bright red) */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#E58A7B]/15 border border-[#E58A7B]/30 text-[#E58A7B]">
          <AlertTriangle className="w-4 h-4 shrink-0 text-[#E58A7B]" />
          <span className="font-mono text-[11px] font-bold tracking-wide">
            HATA: HTTP 500 · 300 ETKİLENEN KULLANICI
          </span>
        </div>

        {/* Story / Decision Prompt */}
        <p className="text-[15px] font-medium text-[#E8EEF5] leading-relaxed">
          {decision.prompt}
        </p>

        {/* Server status pill */}
        <div className="pt-2 border-t border-[#2A3E5C] flex items-center justify-between text-[11px] font-mono text-[#9FB0C3]">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5FB3A8]" />
            srv-prod-api01
          </span>
          <span className="text-[#E58A7B]">DB Pool: %98 Doygun</span>
        </div>
      </div>

      {/* Hint Area (Level-dependent) */}
      {/* Mid Level Toggle Button */}
      {isMid && !revealedHint && (
        <div className="mb-4">
          <button
            type="button"
            data-testid="hint-toggle"
            onClick={onToggleHint}
            className="w-full min-h-[48px] py-2.5 px-4 rounded-[14px] bg-[#17263C] border border-[#2A3E5C] hover:border-[#A7A3D9]/50 text-[#A7A3D9] font-mono text-[13px] flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
          >
            <Lightbulb className="w-4 h-4 text-[#F2B266]" />
            <span>İpucu göster</span>
          </button>
        </div>
      )}

      {/* Visible Hint Card for Newbie or Revealed Mid */}
      {showHint && (
        <div
          data-testid="hint-card"
          className="bg-[#1F3150] rounded-[16px] border border-[#2A3E5C] border-l-[3px] border-l-[#A7A3D9] p-4 flex items-start gap-3 mb-4"
        >
          <div className="p-2 rounded-xl bg-[#F2B266]/15 text-[#F2B266] shrink-0">
            <Lightbulb className="w-5 h-5 text-[#F2B266]" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-heading text-sm font-semibold text-[#E8EEF5]">
              Düşünmen gereken
            </span>
            <p className="text-xs text-[#9FB0C3] leading-relaxed">
              {decision.hint}
            </p>
          </div>
        </div>
      )}

      {/* Choice Options A and B */}
      <div className="flex flex-col gap-3 mb-6">
        {/* Choice A */}
        <button
          type="button"
          data-testid="choice-A"
          onClick={() => handleSelectChoice('A')}
          className="min-h-[56px] p-4 rounded-[16px] bg-[#17263C] border border-[#2A3E5C] hover:border-[#5FB3A8] hover:bg-[#1F3150] text-left flex items-center gap-3.5 cursor-pointer active:scale-98 transition-all group"
        >
          <div className="w-9 h-9 rounded-full bg-[#101C2E] border border-[#2A3E5C] group-hover:border-[#5FB3A8] group-hover:bg-[#5FB3A8] group-hover:text-[#0F1B2D] flex items-center justify-center font-mono font-bold text-sm text-[#5FB3A8] shrink-0 transition-colors">
            A
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-heading text-sm font-semibold text-[#E8EEF5] group-hover:text-[#5FB3A8] transition-colors">
              {decision.choices.A.label}
            </span>
            <span className="font-mono text-[11px] text-[#9FB0C3] mt-0.5">
              +{decision.choices.A.minutes} dk
            </span>
          </div>
        </button>

        {/* Choice B */}
        <button
          type="button"
          data-testid="choice-B"
          onClick={() => handleSelectChoice('B')}
          className="min-h-[56px] p-4 rounded-[16px] bg-[#17263C] border border-[#2A3E5C] hover:border-[#5FB3A8] hover:bg-[#1F3150] text-left flex items-center gap-3.5 cursor-pointer active:scale-98 transition-all group"
        >
          <div className="w-9 h-9 rounded-full bg-[#101C2E] border border-[#2A3E5C] group-hover:border-[#5FB3A8] group-hover:bg-[#5FB3A8] group-hover:text-[#0F1B2D] flex items-center justify-center font-mono font-bold text-sm text-[#5FB3A8] shrink-0 transition-colors">
            B
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-heading text-sm font-semibold text-[#E8EEF5] group-hover:text-[#5FB3A8] transition-colors">
              {decision.choices.B.label}
            </span>
            <span className="font-mono text-[11px] text-[#9FB0C3] mt-0.5">
              +{decision.choices.B.minutes} dk
            </span>
          </div>
        </button>
      </div>

      {/* Floating / Bottom Area */}
      <div className="mt-auto pt-4 flex items-center justify-between">
        <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#17263C] border border-[#2A3E5C] text-[#9FB0C3] text-xs">
          <ShieldCheck className="w-4 h-4 text-[#5FB3A8]" />
          <span className="font-mono text-[11px]">Nöbet modu aktif</span>
        </div>

        {/* Floating AI Tutor Button */}
        <button
          type="button"
          data-testid="tutor-open"
          onClick={onOpenTutor}
          className="min-h-[48px] px-4 py-2.5 rounded-full bg-[#17263C] border border-[#A7A3D9]/40 hover:border-[#A7A3D9] hover:bg-[#1F3150] text-[#E8EEF5] font-mono text-[13px] flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 transition-all"
        >
          <MessageSquareText className="w-4 h-4 text-[#A7A3D9]" />
          <span>Tutor'a sor</span>
        </button>
      </div>
    </div>
  );
};

import React from 'react';
import { Moon } from 'lucide-react';

interface TopBarProps {
  clock: string;
  currentDecisionIndex: number; // 0, 1, 2
  isSenior: boolean;
  timeLeftSeconds?: number | null;
  totalTimeSeconds?: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  clock,
  currentDecisionIndex,
  isSenior,
  timeLeftSeconds,
  totalTimeSeconds = 60,
}) => {
  // SVG circular timer calculation
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const remaining = timeLeftSeconds !== null && timeLeftSeconds !== undefined ? timeLeftSeconds : totalTimeSeconds;
  const strokeDashoffset =
    circumference - (remaining / totalTimeSeconds) * circumference;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between w-full px-5 py-3 bg-[#0F1B2D]/95 backdrop-blur-md border-b border-[#2A3E5C]">
      {/* Clock display */}
      <div className="flex items-center gap-2">
        <Moon className="w-4 h-4 text-[#F2B266]" aria-hidden="true" />
        <span
          data-testid="clock"
          className="font-mono text-base font-semibold tracking-wider text-[#F2B266]"
        >
          {clock}
        </span>
      </div>

      {/* 3 Progress Dots / Steps */}
      <div
        data-testid="progress"
        className="flex items-center gap-1.5 px-3 py-1 bg-[#17263C] rounded-full border border-[#2A3E5C]"
      >
        {(['K1', 'K2', 'K3'] as const).map((stepLabel, idx) => {
          const isActive = idx === currentDecisionIndex;
          const isPassed = idx < currentDecisionIndex;

          return (
            <React.Fragment key={stepLabel}>
              {idx > 0 && (
                <span className="text-[10px] text-[#9FB0C3]/40 select-none">·</span>
              )}
              <span
                className={`font-mono text-[11px] px-2 py-0.5 rounded-full transition-colors ${
                  isActive
                    ? 'bg-[#5FB3A8] text-[#0F1B2D] font-bold'
                    : isPassed
                    ? 'bg-[#1F3150] text-[#5FB3A8] font-medium'
                    : 'text-[#9FB0C3] opacity-60'
                }`}
              >
                {stepLabel}
              </span>
            </React.Fragment>
          );
        })}
      </div>

      {/* Senior Timer Ring */}
      <div className="flex items-center justify-end w-12 h-10">
        {isSenior && timeLeftSeconds !== null && timeLeftSeconds !== undefined ? (
          <div
            data-testid="timer"
            className="relative flex items-center justify-center w-10 h-10"
            title={`${remaining} saniye kaldı`}
          >
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 44 44">
              <circle
                cx="22"
                cy="22"
                r={radius}
                className="stroke-[#1F3150]"
                strokeWidth="3"
                fill="none"
              />
              <circle
                cx="22"
                cy="22"
                r={radius}
                className={`transition-all duration-200 ${
                  remaining <= 10 ? 'stroke-[#E58A7B]' : 'stroke-[#5FB3A8]'
                }`}
                strokeWidth="3"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            <span
              className={`absolute font-mono text-[11px] font-bold ${
                remaining <= 10 ? 'text-[#E58A7B]' : 'text-[#5FB3A8]'
              }`}
            >
              {remaining}s
            </span>
          </div>
        ) : (
          <div className="w-6 h-6" />
        )}
      </div>
    </header>
  );
};

import React from 'react';
import { Terminal, Server, Flag, CheckCircle2, ArrowRight, BookMarked, User, TrendingUp, Search } from 'lucide-react';
import { LanternLogo } from './LanternLogo';
import { LevelId, RoleId, GoalId, ScenarioData } from '../types';
import { Insights, levelLabel } from '../journal';

interface IntakeScreenProps {
  scenario: ScenarioData;
  level: LevelId | null;
  role: RoleId | null;
  goal: GoalId | null;
  onSelectLevel: (lvl: LevelId) => void;
  onSelectRole: (role: RoleId) => void;
  onSelectGoal: (goal: GoalId) => void;
  onStart: () => void;
  name: string;
  onNameChange: (name: string) => void;
  insights: Insights;
  onResetJournal: () => void;
}

export const IntakeScreen: React.FC<IntakeScreenProps> = ({
  scenario,
  level,
  role,
  goal,
  onSelectLevel,
  onSelectRole,
  onSelectGoal,
  onStart,
  name,
  onNameChange,
  insights,
  onResetJournal,
}) => {
  const isComplete = Boolean(level && role && goal);
  const isReturning = insights.runCount > 0;
  const firstName = name.trim();

  return (
    <div className="flex flex-col w-full min-h-screen px-5 pt-6 pb-8 max-w-[430px] mx-auto">
      {/* Header & Lantern Motif */}
      <header className="flex flex-col items-center text-center mt-2 mb-6">
        <div className="relative flex items-center justify-center w-16 h-16 mb-3 rounded-full bg-[#1F3150]/60 border border-[#2A3E5C]">
          <LanternLogo size={38} className="drop-shadow-[0_0_12px_rgba(242,178,102,0.35)]" />
        </div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-[#E8EEF5]">
          SE Primer
        </h1>
        <p className="font-heading text-base font-semibold text-[#F2B266] mt-1">
          Oynanan bir yazılım mühendisliği kitabı
        </p>
        <p className="text-sm text-[#9FB0C3] mt-1.5 max-w-[300px]">
          {isReturning && firstName
            ? `Tekrar hoş geldin, ${firstName}. Kaldığımız yerden birlikte öğrenelim.`
            : 'Seni tanıyalım, hikâye sana göre yazılsın.'}
        </p>

        {/* Shift Badge */}
        <div className="inline-flex items-center gap-2 mt-3 px-3 py-1 rounded-full bg-[#17263C] border border-[#2A3E5C]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#5FB3A8]" />
          <span className="font-mono text-[11px] text-[#9FB0C3] uppercase tracking-wider font-medium">
            NÖBET #{String(insights.runCount + 1).padStart(3, '0')}
          </span>
        </div>
      </header>

      {/* Personal learning journey (only for returning players) */}
      {isReturning && (
        <section
          data-testid="journal-card"
          className="bg-[#17263C] rounded-[16px] border border-[#2A3E5C] border-l-[3px] border-l-[#A7A3D9] p-4 flex flex-col gap-3 mb-4"
        >
          <div className="flex items-center gap-2">
            <BookMarked className="w-[18px] h-[18px] text-[#A7A3D9]" />
            <span className="font-heading text-[15px] font-semibold text-[#E8EEF5]">
              Öğrenme yolculuğun
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-[#101C2E] border border-[#2A3E5C] py-2">
              <div className="font-mono text-lg font-bold text-[#F2B266]">{insights.runCount}</div>
              <div className="text-[11px] text-[#9FB0C3]">nöbet</div>
            </div>
            <div className="rounded-xl bg-[#101C2E] border border-[#2A3E5C] py-2">
              <div className="font-mono text-lg font-bold text-[#7BC8A4]">{insights.goodEndings}</div>
              <div className="text-[11px] text-[#9FB0C3]">iyi son</div>
            </div>
            <div className="rounded-xl bg-[#101C2E] border border-[#2A3E5C] py-2">
              <div className="font-mono text-lg font-bold text-[#A7A3D9]">{insights.researchedCount}</div>
              <div className="text-[11px] text-[#9FB0C3]">kavram</div>
            </div>
          </div>

          {insights.weakTopic && (
            <p data-testid="journal-weak-topic" className="text-[13px] text-[#E8EEF5] leading-relaxed">
              <TrendingUp className="inline w-4 h-4 mr-1.5 text-[#F2B266] -mt-0.5" />
              En çok risk aldığın karar: <strong className="text-[#F2B266]">{insights.weakTopic}</strong>. Bu nöbette ona daha uzun düşün.
            </p>
          )}

          {insights.nextResearch && (
            <p data-testid="journal-next-research" className="text-[13px] text-[#E8EEF5] leading-relaxed">
              <Search className="inline w-4 h-4 mr-1.5 text-[#A7A3D9] -mt-0.5" />
              Sıradaki araştırman: <span className="font-mono text-[12px] text-[#A7A3D9]">{insights.nextResearch}</span>
            </p>
          )}

          {insights.suggestedLevel && insights.suggestedLevel !== level && (
            <button
              type="button"
              data-testid="level-suggestion"
              onClick={() => onSelectLevel(insights.suggestedLevel!)}
              className="text-left min-h-[48px] px-3.5 py-2.5 rounded-[14px] bg-[#5FB3A8]/10 border border-[#5FB3A8]/40 text-[13px] text-[#E8EEF5] hover:bg-[#5FB3A8]/20 cursor-pointer"
            >
              {insights.suggestionReason}{' '}
              <span className="font-mono text-[#5FB3A8]">→ {levelLabel(scenario, insights.suggestedLevel)}</span>
            </button>
          )}

          {insights.lastRun?.reflection && (
            <p className="text-[12px] italic text-[#9FB0C3]">
              Geçen sefer şunu yazmıştın: “{insights.lastRun.reflection}”
            </p>
          )}
        </section>
      )}

      {/* Intake Options Cards */}
      <main className="flex flex-col gap-4 w-full">
        {/* Section 0: Name (optional, stays on this device) */}
        <section className="bg-[#17263C] rounded-[16px] border border-[#2A3E5C] p-4 flex flex-col gap-3">
          <label htmlFor="intake-name" className="flex items-center gap-2">
            <User className="w-[18px] h-[18px] text-[#9FB0C3]" />
            <span className="font-heading text-[15px] font-semibold text-[#E8EEF5]">
              Sana nasıl hitap edelim?
            </span>
            <span className="ml-auto font-mono text-[11px] text-[#9FB0C3]">isteğe bağlı</span>
          </label>
          <input
            id="intake-name"
            data-testid="intake-name"
            type="text"
            maxLength={24}
            autoComplete="off"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Adın veya takma adın"
            className="min-h-[48px] px-3.5 rounded-[14px] bg-[#0F1B2D] border border-[#2A3E5C] text-[#E8EEF5] text-[15px] placeholder:text-[#9FB0C3]/60 focus:outline-none focus:border-[#5FB3A8]"
          />
        </section>

        {/* Section 1: Level */}
        <section className="bg-[#17263C] rounded-[16px] border border-[#2A3E5C] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-[18px] h-[18px] text-[#5FB3A8]" />
              <span className="font-heading text-[15px] font-semibold text-[#E8EEF5]">
                Seviyen?
              </span>
            </div>
            <span className="font-mono text-[11px] text-[#9FB0C3] bg-[#1F3150] px-2 py-0.5 rounded">
              01/03
            </span>
          </div>

          <div
            className="flex flex-wrap gap-2.5"
            role="radiogroup"
            aria-label="Seviye seçimi"
          >
            {scenario.intake.level.map((lvl) => {
              const isSelected = level === lvl.id;
              return (
                <button
                  key={lvl.id}
                  type="button"
                  data-testid={`intake-level-${lvl.id}`}
                  onClick={() => onSelectLevel(lvl.id)}
                  className={`min-h-[48px] px-4 py-2 rounded-full font-mono text-[13px] flex items-center gap-2 border transition-all cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'bg-[#1F3150] border-[#5FB3A8] text-[#E8EEF5] font-semibold'
                      : 'bg-[#101C2E] border-[#2A3E5C] text-[#9FB0C3] hover:border-[#9FB0C3]/40'
                  }`}
                >
                  {isSelected ? (
                    <CheckCircle2 className="w-4 h-4 text-[#5FB3A8] shrink-0" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-[#2A3E5C] shrink-0" />
                  )}
                  <span>{lvl.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Section 2: Role */}
        <section className="bg-[#17263C] rounded-[16px] border border-[#2A3E5C] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-[18px] h-[18px] text-[#F2B266]" />
              <span className="font-heading text-[15px] font-semibold text-[#E8EEF5]">
                Rolün?
              </span>
            </div>
            <span className="font-mono text-[11px] text-[#9FB0C3] bg-[#1F3150] px-2 py-0.5 rounded">
              02/03
            </span>
          </div>

          <div
            className="flex flex-wrap gap-2.5"
            role="radiogroup"
            aria-label="Rol seçimi"
          >
            {scenario.intake.role.map((r) => {
              const isSelected = role === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  data-testid={`intake-role-${r.id}`}
                  onClick={() => onSelectRole(r.id)}
                  className={`min-h-[48px] px-4 py-2 rounded-full font-mono text-[13px] flex items-center gap-2 border transition-all cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'bg-[#1F3150] border-[#5FB3A8] text-[#E8EEF5] font-semibold'
                      : 'bg-[#101C2E] border-[#2A3E5C] text-[#9FB0C3] hover:border-[#9FB0C3]/40'
                  }`}
                >
                  {isSelected ? (
                    <CheckCircle2 className="w-4 h-4 text-[#5FB3A8] shrink-0" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-[#2A3E5C] shrink-0" />
                  )}
                  <span>{r.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Section 3: Goal */}
        <section className="bg-[#17263C] rounded-[16px] border border-[#2A3E5C] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flag className="w-[18px] h-[18px] text-[#A7A3D9]" />
              <span className="font-heading text-[15px] font-semibold text-[#E8EEF5]">
                Hedefin?
              </span>
            </div>
            <span className="font-mono text-[11px] text-[#9FB0C3] bg-[#1F3150] px-2 py-0.5 rounded">
              03/03
            </span>
          </div>

          <div
            className="flex flex-wrap gap-2.5"
            role="radiogroup"
            aria-label="Hedef seçimi"
          >
            {scenario.intake.goal.map((g) => {
              const isSelected = goal === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  data-testid={`intake-goal-${g.id}`}
                  onClick={() => onSelectGoal(g.id)}
                  className={`min-h-[48px] px-4 py-2 rounded-full font-mono text-[13px] flex items-center gap-2 border transition-all cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'bg-[#1F3150] border-[#5FB3A8] text-[#E8EEF5] font-semibold'
                      : 'bg-[#101C2E] border-[#2A3E5C] text-[#9FB0C3] hover:border-[#9FB0C3]/40'
                  }`}
                >
                  {isSelected ? (
                    <CheckCircle2 className="w-4 h-4 text-[#5FB3A8] shrink-0" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-[#2A3E5C] shrink-0" />
                  )}
                  <span>{g.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      {/* Bottom Sticky Action Area */}
      <footer className="flex flex-col gap-3 mt-8 pt-2">
        <button
          type="button"
          data-testid="intake-start"
          disabled={!isComplete}
          onClick={onStart}
          className={`w-full min-h-[48px] h-[52px] rounded-[14px] font-mono text-[14px] font-bold flex items-center justify-center gap-2 border transition-all ${
            isComplete
              ? 'bg-[#5FB3A8] text-[#0F1B2D] border-[#5FB3A8] cursor-pointer hover:bg-[#529F95] active:scale-95'
              : 'bg-[#17263C] text-[#9FB0C3]/50 border-[#2A3E5C] cursor-not-allowed opacity-60'
          }`}
        >
          <span>Nöbete başla</span>
          <ArrowRight className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center justify-center gap-1 text-center mt-1">
          <span className="font-mono text-[11px] text-[#9FB0C3]">
            Günlüğün yalnızca bu cihazda saklanır.
          </span>
          {isReturning && (
            <button
              type="button"
              data-testid="journal-reset"
              onClick={() => {
                if (window.confirm('Öğrenme günlüğün silinsin mi?')) onResetJournal();
              }}
              className="min-h-[44px] px-3 font-mono text-[11px] text-[#9FB0C3] underline underline-offset-4 hover:text-[#E58A7B] cursor-pointer"
            >
              Günlüğü sıfırla
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};

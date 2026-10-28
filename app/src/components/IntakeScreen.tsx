import React from 'react';
import { Terminal, Server, Flag, CheckCircle2, ArrowRight, BookMarked, User, TrendingUp, Search, Compass, Siren, BookOpen, Target } from 'lucide-react';
import { LanternLogo } from './LanternLogo';
import { LevelId, RoleId, GoalId, ScenarioData } from '../types';
import { Insights, levelLabel } from '../journal';
import { SkillEvent, TopicId, topicLabel } from '../skills';
import { SkillRadar } from './SkillRadar';

interface IntakeScreenProps {
  scenario: ScenarioData;
  level: LevelId | null;
  role: RoleId | null;
  goal: GoalId | null;
  onSelectLevel: (lvl: LevelId) => void;
  onSelectRole: (role: RoleId) => void;
  onSelectGoal: (goal: GoalId) => void;
  onStart: () => void;
  onStartPusula: () => void;
  onOpenNotebook: () => void;
  skills: Partial<Record<TopicId, number>>;
  skillEvents: SkillEvent[];
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
  onStartPusula,
  onOpenNotebook,
  skills,
  skillEvents,
  name,
  onNameChange,
  insights,
  onResetJournal,
}) => {
  const isComplete = Boolean(level && role && goal);
  const hasSkills = Object.keys(skills).length > 0;
  // Any evidence counts: a prediction or a notebook entry alone also makes a returning player
  const isReturning = insights.runCount > 0 || insights.pusulaCount > 0 || hasSkills;
  const showNotebook = insights.researchedCount > 0;
  const recentGrowth = skillEvents.slice(-4).reverse();
  const accuracy = insights.predictionAccuracy;
  const pct = (v: number) => `%${Math.round(v * 100)}`;
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
              <div data-testid="journal-pusula-count" className="font-mono text-lg font-bold text-[#7BC8A4]">
                {insights.pusulaCount}
              </div>
              <div className="text-[11px] text-[#9FB0C3]">harita</div>
            </div>
            <div className="rounded-xl bg-[#101C2E] border border-[#2A3E5C] py-2">
              <div className="font-mono text-lg font-bold text-[#A7A3D9]">{insights.researchedCount}</div>
              <div className="text-[11px] text-[#9FB0C3]">kavram</div>
            </div>
          </div>

          {hasSkills && (
            <div className="flex flex-col items-center gap-1 pt-1">
              <SkillRadar skills={skills} />
              <p className="text-[11px] text-[#9FB0C3] text-center">
                Destek konu başına ayarlanır: kesikli iç çizgi gelişen, dış çizgi güçlü sınırı.
              </p>
            </div>
          )}

          {recentGrowth.length > 0 && (
            <ul data-testid="skill-timeline" className="flex flex-col gap-1">
              {recentGrowth.map((e, i) => (
                <li key={`${e.date}-${i}`} className="flex items-center gap-2 text-[12px]">
                  <span className={`font-mono font-bold w-8 ${e.delta > 0 ? 'text-[#7BC8A4]' : e.delta < 0 ? 'text-[#E58A7B]' : 'text-[#9FB0C3]'}`}>
                    {e.delta > 0 ? `+${e.delta}` : e.delta}
                  </span>
                  <span className="text-[#9FB0C3] truncate">
                    {topicLabel(e.topic)} · {e.reason}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {accuracy && (
            <p data-testid="prediction-accuracy" className="text-[13px] text-[#E8EEF5] leading-relaxed">
              <Target className="inline w-4 h-4 mr-1.5 text-[#7BC8A4] -mt-0.5" />
              Tahmin isabetin: <strong className="text-[#7BC8A4]">{pct(accuracy.recent)}</strong>
              {accuracy.earlier !== undefined && (
                <span className="text-[#9FB0C3]">
                  {' '}(önceki 5 tahmin {pct(accuracy.earlier)}
                  {accuracy.recent > accuracy.earlier ? ', yükseliyor' : accuracy.recent < accuracy.earlier ? ', düşüyor' : ''})
                </span>
              )}
            </p>
          )}

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

          {insights.lastPusula && (
            <p data-testid="journal-last-question" className="text-[12px] text-[#9FB0C3] leading-relaxed">
              Son sorduğun: <span className="text-[#E8EEF5]">“{insights.lastPusula.question}”</span>
              {insights.lastPusula.reflection && <> · Kendi cevabın: “{insights.lastPusula.reflection}”</>}
            </p>
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
        {!isComplete && (
          <p className="text-center text-[12px] text-[#9FB0C3]">Başlamak için seviye, rol ve hedef seç.</p>
        )}

        {showNotebook && (
          <button
            type="button"
            data-testid="intake-notebook"
            onClick={onOpenNotebook}
            className="w-full min-h-[52px] px-4 rounded-[14px] flex items-center gap-3 border bg-[#17263C] border-[#A7A3D9]/40 text-[#E8EEF5] text-left cursor-pointer hover:bg-[#1F3150]"
          >
            <BookOpen className="w-5 h-5 shrink-0 text-[#A7A3D9]" />
            <span className="flex-1 flex flex-col">
              <span className="font-mono text-[13px] font-bold">Defterim</span>
              <span className="text-[12px] text-[#9FB0C3]">
                {insights.dueReviews > 0
                  ? `${insights.dueReviews} kavramın tekrar zamanı geldi`
                  : insights.pendingExplanations.length > 0
                  ? `${insights.pendingExplanations.length} kavram kendi kelimelerini bekliyor`
                  : 'Tekrarların planlı'}
              </span>
            </span>
            {insights.dueReviews + insights.pendingExplanations.length > 0 && (
              <span
                data-testid="notebook-badge"
                className="min-w-[24px] h-6 px-1.5 rounded-full bg-[#A7A3D9] text-[#0F1B2D] font-mono text-[12px] font-bold flex items-center justify-center"
              >
                {insights.dueReviews + insights.pendingExplanations.length}
              </span>
            )}
          </button>
        )}

        {/* Main mode: the player's own question */}
        <button
          type="button"
          data-testid="intake-pusula"
          disabled={!isComplete}
          onClick={onStartPusula}
          className={`w-full min-h-[64px] px-4 rounded-[14px] flex items-center gap-3 border text-left transition-all ${
            isComplete
              ? 'bg-[#5FB3A8] text-[#0F1B2D] border-[#5FB3A8] cursor-pointer hover:bg-[#529F95] active:scale-95'
              : 'bg-[#17263C] text-[#9FB0C3]/50 border-[#2A3E5C] cursor-not-allowed opacity-60'
          }`}
        >
          <Compass className="w-6 h-6 shrink-0" />
          <span className="flex-1 flex flex-col">
            <span className="font-mono text-[14px] font-bold">Kendi sorunu sor</span>
            <span className="text-[12px] opacity-80">Pusula cevap vermez, yollarını gösterir</span>
          </span>
          <ArrowRight className="w-5 h-5 shrink-0" />
        </button>

        {/* Example scenario required by the assignment */}
        <button
          type="button"
          data-testid="intake-start"
          disabled={!isComplete}
          onClick={onStart}
          className={`w-full min-h-[56px] px-4 rounded-[14px] flex items-center gap-3 border text-left transition-all ${
            isComplete
              ? 'bg-[#17263C] text-[#E8EEF5] border-[#2A3E5C] cursor-pointer hover:bg-[#1F3150] hover:border-[#F2B266]/50 active:scale-95'
              : 'bg-[#17263C] text-[#9FB0C3]/50 border-[#2A3E5C] cursor-not-allowed opacity-60'
          }`}
        >
          <Siren className="w-5 h-5 shrink-0 text-[#F2B266]" />
          <span className="flex-1 flex flex-col">
            <span className="font-mono text-[13px] font-bold">Örnek krizi oyna</span>
            <span className="text-[12px] text-[#9FB0C3]">08:00, randevu sistemi çöktü · 3 karar</span>
          </span>
          <ArrowRight className="w-5 h-5 shrink-0 text-[#9FB0C3]" />
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

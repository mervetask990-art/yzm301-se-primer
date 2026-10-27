import React from 'react';
import { AlertTriangle, Clock, ArrowRight, ShieldAlert, Cpu, BookMarked } from 'lucide-react';
import { RoleId, ScenarioData } from '../types';
import { Insights } from '../journal';

interface IntroScreenProps {
  scenario: ScenarioData;
  role: RoleId;
  name: string;
  insights: Insights;
  onStart: () => void;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({
  scenario,
  role,
  name,
  insights,
  onStart,
}) => {
  const roleLine = scenario.intro.roleLine[role] || '';
  const roleLabel = scenario.intake.role.find((r) => r.id === role)?.label ?? role;
  const firstName = name.trim();

  return (
    <div className="flex flex-col w-full min-h-screen px-5 pt-4 pb-8 max-w-[430px] mx-auto">
      {/* Top Header / Clock */}
      <header className="flex items-center justify-between pb-4 mb-4 border-b border-[#2A3E5C]">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#F2B266]" />
          <span
            data-testid="clock"
            className="font-mono text-base font-semibold text-[#F2B266] tracking-wider"
          >
            {scenario.startClock}
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E58A7B]/15 border border-[#E58A7B]/30 text-[#E58A7B]">
          <span className="w-2 h-2 rounded-full bg-[#E58A7B] animate-pulse" />
          <span className="font-mono text-[11px] font-semibold tracking-wide uppercase">
            CANLI KRİZ
          </span>
        </div>
      </header>

      {/* Main Incident Card */}
      <main className="flex flex-col gap-4 flex-1">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#17263C] border border-[#2A3E5C] w-fit">
          <ShieldAlert className="w-4 h-4 text-[#F2B266]" />
          <span className="font-mono text-[11px] text-[#9FB0C3] uppercase tracking-wider">
            NÖBETÇİ MÜHENDİS ATANDI
          </span>
        </div>

        <h1 className="font-heading text-2xl font-bold tracking-tight text-[#E8EEF5]">
          {scenario.title}
        </h1>

        <div className="bg-[#17263C] rounded-[16px] border border-[#2A3E5C] p-5 flex flex-col gap-4">
          {/* Warning badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#E58A7B]/15 border border-[#E58A7B]/30 text-[#E58A7B]">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="font-mono text-[11px] font-bold tracking-wide">
              HATA: HTTP 500 · 300 HASTA BEKLİYOR
            </span>
          </div>

          {/* Intro Story Text */}
          <div data-testid="intro-text" className="flex flex-col gap-3 text-sm text-[#E8EEF5] leading-relaxed">
            {firstName && (
              <p data-testid="intro-greeting" className="font-heading font-semibold text-[#F2B266]">
                Günaydın {firstName}, telefonun çalıyor.
              </p>
            )}
            <p>{scenario.intro.text}</p>

            {/* Role-specific situational context */}
            <div className="p-3.5 rounded-xl bg-[#1F3150] border border-[#2A3E5C] flex items-start gap-2.5">
              <Cpu className="w-4 h-4 text-[#5FB3A8] shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[11px] font-bold text-[#5FB3A8] uppercase tracking-wider">
                  Senin ekranın ({roleLabel}):
                </span>
                <p className="text-sm text-[#E8EEF5]">{roleLine}</p>
              </div>
            </div>
          </div>

          {/* Incident Telemetry info */}
          <div className="pt-3 border-t border-[#2A3E5C] flex items-center justify-between text-[11px] font-mono text-[#9FB0C3]">
            <span>Sunucu: srv-prod-api01</span>
            <span className="text-[#E58A7B]">DB Pool: %98 Doygun</span>
          </div>
        </div>

        {/* Memory from earlier shifts: what the player should watch this time */}
        {insights.runCount > 0 && (insights.weakTopic || insights.nextResearch) && (
          <div
            data-testid="intro-memory"
            className="rounded-[16px] bg-[#17263C] border border-[#2A3E5C] border-l-[3px] border-l-[#A7A3D9] p-4 flex items-start gap-3"
          >
            <BookMarked className="w-4 h-4 text-[#A7A3D9] shrink-0 mt-0.5" />
            <p className="text-[13px] text-[#E8EEF5] leading-relaxed">
              {insights.weakTopic
                ? `Önceki nöbetlerinde ${insights.weakTopic} kararında risk aldın. Bu sefer o kararda neyi farklı kontrol edeceğini düşün.`
                : `Geçen nöbetten kalan araştırman: ${insights.nextResearch}. Bu krizde nerede işe yarar?`}
            </p>
          </div>
        )}
      </main>

      {/* Action Footer */}
      <footer className="mt-8 pt-2">
        <button
          type="button"
          data-testid="intro-start"
          onClick={onStart}
          className="w-full min-h-[48px] h-[52px] bg-[#5FB3A8] text-[#0F1B2D] font-mono text-[14px] font-bold rounded-[14px] flex items-center justify-center gap-2 cursor-pointer hover:bg-[#529F95] active:scale-95 transition-all"
        >
          <span>Başla</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </footer>
    </div>
  );
};

import React from 'react';
import { TOPICS, TopicId, tierFor, tierLabel } from '../skills';

interface SkillRadarProps {
  skills: Partial<Record<TopicId, number>>;
  size?: number;
}

// Hexagon radar of the six skill topics; unmeasured topics sit at the centre and show "–"
export const SkillRadar: React.FC<SkillRadarProps> = ({ skills, size = 240 }) => {
  const c = size / 2;
  const r = size / 2 - 42; // room for labels
  const angle = (i: number) => (Math.PI * 2 * i) / TOPICS.length - Math.PI / 2;
  const point = (i: number, value: number) => {
    const d = (r * value) / 100;
    return [c + d * Math.cos(angle(i)), c + d * Math.sin(angle(i))];
  };
  const polygon = (value: (i: number) => number) =>
    TOPICS.map((_, i) => point(i, value(i)).join(',')).join(' ');

  const summary = TOPICS.map((t) => {
    const s = skills[t.id];
    return `${t.label}: ${s === undefined ? 'ölçülmedi' : `${s}/100, ${tierLabel[tierFor(s)]}`}`;
  }).join('; ');

  return (
    <figure data-testid="skill-radar" className="flex flex-col items-center m-0">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Beceri haritası. ${summary}`}>
        {[25, 50, 75, 100].map((ring) => (
          <polygon key={ring} points={polygon(() => ring)} fill="none" stroke="#2A3E5C" strokeWidth={1} />
        ))}
        {/* tier boundaries: 35 (gelişen) and 70 (güçlü) */}
        <polygon points={polygon(() => 35)} fill="none" stroke="#A7A3D9" strokeOpacity={0.25} strokeDasharray="3 3" />
        <polygon points={polygon(() => 70)} fill="none" stroke="#5FB3A8" strokeOpacity={0.25} strokeDasharray="3 3" />
        {TOPICS.map((_, i) => {
          const [x, y] = point(i, 100);
          return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="#2A3E5C" strokeWidth={1} />;
        })}
        <polygon
          points={polygon((i) => skills[TOPICS[i].id] ?? 0)}
          fill="#5FB3A8"
          fillOpacity={0.22}
          stroke="#5FB3A8"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {TOPICS.map((t, i) => {
          const s = skills[t.id];
          if (s === undefined) return null;
          const [x, y] = point(i, s);
          return <circle key={t.id} cx={x} cy={y} r={3.5} fill="#5FB3A8" />;
        })}
        {TOPICS.map((t, i) => {
          const [x, y] = point(i, 128);
          const s = skills[t.id];
          return (
            <text
              key={t.id}
              data-testid={`skill-label-${t.id}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={11}
              fontFamily="JetBrains Mono, monospace"
              fill={s === undefined ? '#9FB0C3' : '#E8EEF5'}
            >
              <tspan x={x} dy="-0.4em">{t.short}</tspan>
              <tspan x={x} dy="1.2em" fill={s === undefined ? '#9FB0C3' : '#F2B266'}>
                {s === undefined ? '–' : s}
              </tspan>
            </text>
          );
        })}
      </svg>
    </figure>
  );
};

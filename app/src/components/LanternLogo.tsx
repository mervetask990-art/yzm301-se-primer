import React from 'react';

interface LanternLogoProps {
  className?: string;
  size?: number;
}

export const LanternLogo: React.FC<LanternLogoProps> = ({ className = '', size = 48 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Top Hanging Ring */}
      <circle
        cx="32"
        cy="9"
        r="5"
        stroke="#F2B266"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Loop connector */}
      <line
        x1="32"
        y1="14"
        x2="32"
        y2="17"
        stroke="#F2B266"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Roof / Lantern Cap */}
      <path
        d="M20 22L32 17L44 22H20Z"
        stroke="#F2B266"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="#F2B266"
        fillOpacity="0.15"
      />

      {/* Main Glass Housing */}
      <path
        d="M21 22L24 45H40L43 22"
        stroke="#F2B266"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Vertical Ribs */}
      <line
        x1="29"
        y1="22"
        x2="30"
        y2="45"
        stroke="#F2B266"
        strokeWidth="1.5"
        strokeOpacity="0.7"
      />
      <line
        x1="35"
        y1="22"
        x2="34"
        y2="45"
        stroke="#F2B266"
        strokeWidth="1.5"
        strokeOpacity="0.7"
      />

      {/* Flame / Core Light inside */}
      <path
        d="M32 30C30 33 30 36 32 38C34 36 34 33 32 30Z"
        fill="#F2B266"
        stroke="#F2B266"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Soft warm radiating rays */}
      <line x1="32" y1="26" x2="32" y2="28" stroke="#F2B266" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.8" />
      <line x1="25" y1="34" x2="27" y2="34" stroke="#F2B266" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.8" />
      <line x1="37" y1="34" x2="39" y2="34" stroke="#F2B266" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.8" />

      {/* Bottom Tray Base */}
      <rect
        x="21"
        y="45"
        width="22"
        height="4"
        rx="2"
        stroke="#F2B266"
        strokeWidth="2"
        fill="#F2B266"
        fillOpacity="0.25"
      />
      {/* Lower Feet or Base Accent */}
      <path
        d="M25 49L23 52H41L39 49"
        stroke="#F2B266"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

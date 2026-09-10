import React from 'react';

interface CompassBackgroundProps {
  className?: string;
}

const CompassBackground: React.FC<CompassBackgroundProps> = ({ className = '' }) => {
  // Generate 72 tick marks (every 5 degrees) around the outer ring
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const angle = (i * 5 * Math.PI) / 180;
    const isMajor = i % 2 === 0;
    const isCardinal = i % 18 === 0;
    const rInner = isCardinal ? 415 : isMajor ? 422 : 427;
    const rOuter = 438;

    const x1 = 500 + rInner * Math.cos(angle);
    const y1 = 500 + rInner * Math.sin(angle);
    const x2 = 500 + rOuter * Math.cos(angle);
    const y2 = 500 + rOuter * Math.sin(angle);

    return (
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#b8864d"
        strokeOpacity={isCardinal ? 0.45 : isMajor ? 0.3 : 0.18}
        strokeWidth={isCardinal ? 1.5 : 1}
      />
    );
  });

  // Diagonal guideline rays across the background
  const guideAngles = [0, 45, 90, 135, 180, 225, 270, 315];

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none absolute inset-0 flex items-center justify-center overflow-hidden z-0 ${className}`}
    >
      {/* Central warm radial ambient glow */}
      <div
        className="absolute w-[800px] h-[800px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(200, 150, 90, 0.16) 0%, rgba(184, 134, 77, 0.08) 32%, rgba(184, 134, 77, 0.02) 55%, transparent 72%)',
          filter: 'blur(32px)',
        }}
      />

      <svg
        viewBox="0 0 1000 1000"
        className="w-[950px] h-[950px] max-w-none opacity-85 text-[#b8864d] transition-opacity duration-700"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="facetLightN" x1="500" y1="20" x2="465" y2="500" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#e5b780" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#b8864d" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="facetDarkN" x1="500" y1="20" x2="535" y2="500" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#9c6d3a" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#5a3d1c" stopOpacity="0.04" />
          </linearGradient>

          <linearGradient id="facetLightE" x1="980" y1="500" x2="500" y2="465" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#e5b780" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#b8864d" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="facetDarkE" x1="980" y1="500" x2="500" y2="535" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#9c6d3a" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#5a3d1c" stopOpacity="0.04" />
          </linearGradient>

          <linearGradient id="facetLightS" x1="500" y1="980" x2="535" y2="500" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#e5b780" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#b8864d" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="facetDarkS" x1="500" y1="980" x2="465" y2="500" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#9c6d3a" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#5a3d1c" stopOpacity="0.04" />
          </linearGradient>

          <linearGradient id="facetLightW" x1="20" y1="500" x2="500" y2="535" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#e5b780" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#b8864d" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="facetDarkW" x1="20" y1="500" x2="500" y2="465" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#9c6d3a" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#5a3d1c" stopOpacity="0.04" />
          </linearGradient>
        </defs>

        {/* Concentric rings */}
        <circle cx="500" cy="500" r="472" stroke="#b8864d" strokeOpacity="0.28" strokeWidth="1" />
        <circle cx="500" cy="500" r="462" stroke="#b8864d" strokeOpacity="0.18" strokeWidth="0.8" />
        <circle cx="500" cy="500" r="438" stroke="#b8864d" strokeOpacity="0.25" strokeWidth="1.2" />
        <circle cx="500" cy="500" r="415" stroke="#b8864d" strokeOpacity="0.18" strokeWidth="0.8" />
        <circle cx="500" cy="500" r="315" stroke="#b8864d" strokeOpacity="0.22" strokeWidth="1" />
        <circle cx="500" cy="500" r="230" stroke="#b8864d" strokeOpacity="0.2" strokeWidth="0.8" strokeDasharray="3 4" />
        <circle cx="500" cy="500" r="160" stroke="#b8864d" strokeOpacity="0.24" strokeWidth="1" />
        <circle cx="500" cy="500" r="95" stroke="#b8864d" strokeOpacity="0.28" strokeWidth="1" />
        <circle cx="500" cy="500" r="45" stroke="#b8864d" strokeOpacity="0.32" strokeWidth="1" />

        {/* Outer tick marks */}
        {ticks}

        {/* Full diameter intersecting lines */}
        {guideAngles.map((deg) => (
          <line
            key={`guide-${deg}`}
            x1={500 + 472 * Math.cos((deg * Math.PI) / 180)}
            y1={500 + 472 * Math.sin((deg * Math.PI) / 180)}
            x2={500 - 472 * Math.cos((deg * Math.PI) / 180)}
            y2={500 - 472 * Math.sin((deg * Math.PI) / 180)}
            stroke="#b8864d"
            strokeOpacity="0.15"
            strokeWidth="0.75"
          />
        ))}

        {/* 8 Minor star points (R = 210) */}
        {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((angle, idx) => {
          const rad = (angle * Math.PI) / 180;
          const radPrev = ((angle - 11.25) * Math.PI) / 180;
          const radNext = ((angle + 11.25) * Math.PI) / 180;
          const tipX = 500 + 225 * Math.cos(rad);
          const tipY = 500 + 225 * Math.sin(rad);
          const base1X = 500 + 95 * Math.cos(radPrev);
          const base1Y = 500 + 95 * Math.sin(radPrev);
          const base2X = 500 + 95 * Math.cos(radNext);
          const base2Y = 500 + 95 * Math.sin(radNext);

          return (
            <g key={`minor-${idx}`}>
              <polygon
                points={`500,500 ${tipX},${tipY} ${base1X},${base1Y}`}
                fill="#b8864d"
                fillOpacity="0.05"
                stroke="#b8864d"
                strokeOpacity="0.22"
                strokeWidth="0.6"
              />
              <polygon
                points={`500,500 ${tipX},${tipY} ${base2X},${base2Y}`}
                fill="#5a3d1c"
                fillOpacity="0.03"
                stroke="#b8864d"
                strokeOpacity="0.16"
                strokeWidth="0.6"
              />
            </g>
          );
        })}

        {/* 4 Medium Star Points (NE, NW, SE, SW, R = 340) */}
        {[45, 135, 225, 315].map((angle, idx) => {
          const rad = (angle * Math.PI) / 180;
          const radPrev = ((angle - 22.5) * Math.PI) / 180;
          const radNext = ((angle + 22.5) * Math.PI) / 180;
          const tipX = 500 + 355 * Math.cos(rad);
          const tipY = 500 + 355 * Math.sin(rad);
          const base1X = 500 + 115 * Math.cos(radPrev);
          const base1Y = 500 + 115 * Math.sin(radPrev);
          const base2X = 500 + 115 * Math.cos(radNext);
          const base2Y = 500 + 115 * Math.sin(radNext);

          return (
            <g key={`medium-${idx}`}>
              {/* Light half */}
              <polygon
                points={`500,500 ${tipX},${tipY} ${base1X},${base1Y}`}
                fill="#b8864d"
                fillOpacity="0.08"
                stroke="#b8864d"
                strokeOpacity="0.32"
                strokeWidth="0.8"
              />
              {/* Dark half */}
              <polygon
                points={`500,500 ${tipX},${tipY} ${base2X},${base2Y}`}
                fill="#5a3d1c"
                fillOpacity="0.05"
                stroke="#b8864d"
                strokeOpacity="0.22"
                strokeWidth="0.8"
              />
            </g>
          );
        })}

        {/* 4 Major Cardinal Star Points (N, S, E, W, R = 475) with 3D faceted shading */}
        {/* NORTH */}
        <polygon
          points="500,500 500,20 460,500"
          fill="url(#facetLightN)"
          stroke="#b8864d"
          strokeOpacity="0.45"
          strokeWidth="1"
        />
        <polygon
          points="500,500 500,20 540,500"
          fill="url(#facetDarkN)"
          stroke="#b8864d"
          strokeOpacity="0.3"
          strokeWidth="1"
        />
        <line x1="500" y1="500" x2="500" y2="20" stroke="#e5b780" strokeOpacity="0.55" strokeWidth="1.2" />

        {/* EAST */}
        <polygon
          points="500,500 980,500 500,460"
          fill="url(#facetLightE)"
          stroke="#b8864d"
          strokeOpacity="0.45"
          strokeWidth="1"
        />
        <polygon
          points="500,500 980,500 500,540"
          fill="url(#facetDarkE)"
          stroke="#b8864d"
          strokeOpacity="0.3"
          strokeWidth="1"
        />
        <line x1="500" y1="500" x2="980" y2="500" stroke="#e5b780" strokeOpacity="0.55" strokeWidth="1.2" />

        {/* SOUTH */}
        <polygon
          points="500,500 500,980 540,500"
          fill="url(#facetLightS)"
          stroke="#b8864d"
          strokeOpacity="0.45"
          strokeWidth="1"
        />
        <polygon
          points="500,500 500,980 460,500"
          fill="url(#facetDarkS)"
          stroke="#b8864d"
          strokeOpacity="0.3"
          strokeWidth="1"
        />
        <line x1="500" y1="500" x2="500" y2="980" stroke="#e5b780" strokeOpacity="0.55" strokeWidth="1.2" />

        {/* WEST */}
        <polygon
          points="500,500 20,500 500,540"
          fill="url(#facetLightW)"
          stroke="#b8864d"
          strokeOpacity="0.45"
          strokeWidth="1"
        />
        <polygon
          points="500,500 20,500 500,460"
          fill="url(#facetDarkW)"
          stroke="#b8864d"
          strokeOpacity="0.3"
          strokeWidth="1"
        />
        <line x1="500" y1="500" x2="20" y2="500" stroke="#e5b780" strokeOpacity="0.55" strokeWidth="1.2" />

        {/* Central hub ring and dot */}
        <circle cx="500" cy="500" r="14" fill="#151311" stroke="#e5b780" strokeOpacity="0.65" strokeWidth="1.5" />
        <circle cx="500" cy="500" r="4" fill="#e5b780" fillOpacity="0.8" />
      </svg>
    </div>
  );
};

export default CompassBackground;

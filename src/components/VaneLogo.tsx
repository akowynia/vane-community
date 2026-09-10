import React from 'react';

interface VaneLogoProps {
  className?: string;
  size?: number;
}

const VaneLogo: React.FC<VaneLogoProps> = ({ className = '', size = 26 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="vaneGoldGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f3d5ab" />
          <stop offset="45%" stopColor="#d4a373" />
          <stop offset="100%" stopColor="#9c6d3a" />
        </linearGradient>
        <linearGradient id="vaneDarkWing" x1="16" y1="12" x2="16" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#b8864d" />
          <stop offset="100%" stopColor="#7a542a" />
        </linearGradient>
      </defs>
      {/* Left thick faceted wing of the V */}
      <path
        d="M6 7L13 26L16.5 26L14.5 13L10.5 7H6Z"
        fill="url(#vaneGoldGrad)"
      />
      {/* Inner facet shadow on left wing */}
      <path
        d="M10.5 7L14.5 13L16.5 26L14 26L8.5 7H10.5Z"
        fill="url(#vaneDarkWing)"
        fillOpacity="0.4"
      />
      {/* Right upward flaring wing of the V */}
      <path
        d="M16 26L26 8H21.5L14.5 22L16 26Z"
        fill="url(#vaneGoldGrad)"
      />
      {/* Subtle highlight dot / compass jewel at top right */}
      <circle cx="26" cy="7" r="1.5" fill="#f3d5ab" fillOpacity="0.85" />
    </svg>
  );
};

export default VaneLogo;

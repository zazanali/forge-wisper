import React, { useId } from "react";

interface ForgeLogoProps {
  size?: number;
  className?: string;
  glow?: boolean;
}

export const ForgeLogo: React.FC<ForgeLogoProps> = ({
  size = 36,
  className = "",
  glow = true,
}) => {
  const rawId = useId();
  // Sanitize React useId (removes colons for valid SVG IDs)
  const id = rawId.replace(/[^a-zA-Z0-9]/g, "");

  const bgGradId = `flBgGrad_${id}`;
  const borderGradId = `flBorderGrad_${id}`;
  const bar1GradId = `flBar1Grad_${id}`;
  const bar2GradId = `flBar2Grad_${id}`;
  const bar3GradId = `flBar3Grad_${id}`;
  const bar4GradId = `flBar4Grad_${id}`;
  const bar5GradId = `flBar5Grad_${id}`;
  const glareGradId = `flGlassGlare_${id}`;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {glow && (
        <div
          className="absolute inset-0 rounded-[8px] bg-[var(--accent)] opacity-20 blur-sm pointer-events-none transition-opacity group-hover:opacity-40"
        />
      )}
      <svg
        viewBox="0 0 512 512"
        width={size}
        height={size}
        className="relative z-10 w-full h-full drop-shadow-md"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={bgGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#181B26" />
            <stop offset="60%" stopColor="#0E1017" />
            <stop offset="100%" stopColor="#07080C" />
          </linearGradient>

          <linearGradient id={borderGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF4D5E" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#3FE3C4" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#2A2E38" stopOpacity="0.4" />
          </linearGradient>

          {/* Bar 1 (Teal Resonance) */}
          <linearGradient id={bar1GradId} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#1EA88D" />
            <stop offset="50%" stopColor="#3FE3C4" />
            <stop offset="100%" stopColor="#7BFFDF" />
          </linearGradient>

          {/* Bar 2 (Sonic Ascension - Teal to Blade) */}
          <linearGradient id={bar2GradId} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#3FE3C4" />
            <stop offset="40%" stopColor="#4E9FFF" />
            <stop offset="75%" stopColor="#FF4D5E" />
            <stop offset="100%" stopColor="#FF7A88" />
          </linearGradient>

          {/* Bar 3 (Primary Forge Peak - Blade Red Apex) */}
          <linearGradient id={bar3GradId} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#B31224" />
            <stop offset="40%" stopColor="#FF4D5E" />
            <stop offset="85%" stopColor="#FF6E7B" />
            <stop offset="100%" stopColor="#FFA8AF" />
          </linearGradient>

          {/* Bar 4 (Harmonic Whisper Arc) */}
          <linearGradient id={bar4GradId} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#D92036" />
            <stop offset="60%" stopColor="#FF4D5E" />
            <stop offset="100%" stopColor="#FFA07A" />
          </linearGradient>

          {/* Bar 5 (Electric Ember Satellite) */}
          <linearGradient id={bar5GradId} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#FF4D5E" />
            <stop offset="100%" stopColor="#3FE3C4" />
          </linearGradient>

          {/* Specular Glare */}
          <linearGradient id={glareGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22" />
            <stop offset="35%" stopColor="#FFFFFF" stopOpacity="0.05" />
            <stop offset="65%" stopColor="#FFFFFF" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Squircle Tile Base */}
        <rect
          x="28"
          y="28"
          width="456"
          height="456"
          rx="112"
          fill={`url(#${bgGradId})`}
          stroke={`url(#${borderGradId})`}
          strokeWidth="8"
        />

        {/* Sonic Waveform Bars */}
        <rect x="124" y="206" width="36" height="100" rx="18" fill={`url(#${bar1GradId})`} />
        <rect x="178" y="146" width="36" height="220" rx="18" fill={`url(#${bar2GradId})`} />
        <rect x="232" y="86" width="48" height="340" rx="24" fill={`url(#${bar3GradId})`} />
        <rect x="298" y="146" width="36" height="220" rx="18" fill={`url(#${bar4GradId})`} />
        <rect x="352" y="206" width="36" height="100" rx="18" fill={`url(#${bar5GradId})`} />

        {/* Energy Wave Nexus */}
        <path
          d="M 124 256 C 178 300 232 300 256 256 C 280 212 334 212 388 256"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* Apex Spark */}
        <circle cx="256" cy="110" r="7" fill="#FFFFFF" />
        <circle cx="200" cy="170" r="4" fill="#FFFFFF" opacity="0.9" />
        <circle cx="314" cy="170" r="4" fill="#FFFFFF" opacity="0.9" />

        {/* Specular Glare */}
        <path
          d="M 32 32 C 120 32 440 90 480 340 L 480 140 C 480 80 432 32 372 32 Z"
          fill={`url(#${glareGradId})`}
          pointerEvents="none"
        />
      </svg>
    </div>
  );
};

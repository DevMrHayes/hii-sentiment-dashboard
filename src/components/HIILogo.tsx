import React from 'react';

export interface HIILogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  variant?: 'dark' | 'light' | 'color';
  subtitle?: boolean;
}

const sizeClasses: Record<NonNullable<HIILogoProps['size']>, string> = {
  sm: 'h-7',
  md: 'h-9',
  lg: 'h-12',
};

export const HIILogo: React.FC<HIILogoProps> = ({
  className = '',
  size = 'md',
  showWordmark = true,
  variant = 'color',
  subtitle = false,
  ...props
}) => {
  const isDark = variant === 'dark';
  const emblemBg = '#003b4d';
  const cutoutColor = '#ffffff';
  const textFill = isDark ? '#ffffff' : '#003b4d';

  const viewBox = showWordmark ? '0 0 270 148' : '0 16 118 116';
  const widthRatio = showWordmark ? 'aspect-[270/148]' : 'aspect-[118/116]';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      fill="none"
      className={`w-auto ${sizeClasses[size]} ${widthRatio} ${className}`.trim()}
      role="img"
      aria-label="Huntington Ingalls Industries Logo"
      {...props}
    >
      {/* Emblem */}
      <g id="hii-emblem">
        <rect
          x="0"
          y="16"
          width="118"
          height="116"
          rx="3"
          fill={emblemBg}
        />
        {/* Left Slot: Notch pointing rightward */}
        <path
          d="M 18 31 H 35 V 63 H 45 V 85 H 35 V 117 H 18 Z"
          fill={cutoutColor}
        />
        {/* Middle Slot: Straight vertical cutout */}
        <rect
          x="50"
          y="31"
          width="18"
          height="86"
          fill={cutoutColor}
        />
        {/* Right Slot: Notch pointing leftward */}
        <path
          d="M 83 31 H 100 V 117 H 83 V 85 H 73 V 63 H 83 Z"
          fill={cutoutColor}
        />
      </g>

      {/* Monogram / Wordmark */}
      {showWordmark && (
        <g id="hii-wordmark" fill={textFill}>
          {/* Letter 'H' */}
          <rect x="155" y="39" width="11" height="70" />
          <rect x="166" y="69" width="34" height="10" />
          <rect x="200" y="39" width="11" height="70" />

          {/* Letter 'I' (first) */}
          <rect x="227" y="39" width="11" height="70" />

          {/* Letter 'I' (second) */}
          <rect x="254" y="39" width="11" height="70" />

          {/* Optional Subtitle */}
          {subtitle && (
            <text
              x="155"
              y="124"
              fill={textFill}
              fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              fontSize="8"
              fontWeight="700"
              letterSpacing="0.08em"
            >
              HUNTINGTON INGALLS INDUSTRIES
            </text>
          )}
        </g>
      )}
    </svg>
  );
};

export default HIILogo;
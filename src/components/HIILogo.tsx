import React from 'react';

export interface HIILogoProps extends React.SVGAttributes<SVGSVGElement> {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  variant?: 'dark' | 'light';
}

const SIZE_MAP = {
  sm: {
    icon: { width: 32, height: 28 },
    full: { width: 110, height: 28 },
  },
  md: {
    icon: { width: 48, height: 42 },
    full: { width: 165, height: 42 },
  },
  lg: {
    icon: { width: 64, height: 56 },
    full: { width: 220, height: 56 },
  },
} as const;

export const HIILogo: React.FC<HIILogoProps> = ({
  className = '',
  size = 'md',
  showWordmark = true,
  variant = 'dark',
  ...svgProps
}) => {
  const dimensions = showWordmark ? SIZE_MAP[size].full : SIZE_MAP[size].icon;
  const viewBox = showWordmark ? '0 0 220 56' : '0 0 64 56';

  const primaryColor = variant === 'dark' ? '#003b4d' : '#ffffff';
  const textColor = variant === 'dark' ? '#24272a' : '#ffffff';
  const lightBlue = '#75abd1';
  const orangeAccent = '#ea7722';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      width={dimensions.width}
      height={dimensions.height}
      className={className}
      role="img"
      aria-label="Huntington Ingalls Industries Logo"
      {...svgProps}
    >
      <g id="hii-emblem">
        {/* Main Aft Sail / Dark Blue Chevron */}
        <path
          d="M2.5 53.5L25.2 2.5H41.8L19.1 53.5H2.5Z"
          fill={primaryColor}
        />
        {/* Forward Upper Sail / Light Blue Chevron */}
        <path
          d="M22.8 53.5L38.4 18.2H54.9L39.3 53.5H22.8Z"
          fill={lightBlue}
        />
        {/* Dynamic Bow Wave / Orange Accent Wedge */}
        <path
          d="M42.8 53.5L50.4 36.4H61.5L53.9 53.5H42.8Z"
          fill={orangeAccent}
        />
      </g>

      {showWordmark && (
        <g id="hii-wordmark" transform="translate(74, 0)">
          {/* Primary Monogram "HII" */}
          <text
            x="0"
            y="35"
            fill={primaryColor}
            fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
            fontWeight="900"
            fontSize="34"
            letterSpacing="1.5"
          >
            HII
          </text>

          {/* Corporate Sub-label */}
          <text
            x="1.5"
            y="49"
            fill={textColor}
            fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
            fontWeight="600"
            fontSize="7"
            letterSpacing="1.8"
            opacity={variant === 'dark' ? 0.85 : 0.9}
          >
            HUNTINGTON INGALLS INDUSTRIES
          </text>
        </g>
      )}
    </svg>
  );
};

export default HIILogo;
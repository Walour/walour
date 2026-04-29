import React from 'react'

interface LogoProps {
  size: 16 | 32 | 64 | 160
  variant?: 'outline' | 'filled'
  className?: string
}

const dropShadow: React.CSSProperties = {
  filter: 'drop-shadow(0 0 8px rgba(0,201,167,0.3))',
}

function LogoFull({ className }: { className?: string }) {
  return (
    <svg
      width="160"
      height="160"
      viewBox="-80 -80 160 160"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={dropShadow}
      aria-label="Walour logo"
    >
      {/* outer hex ring */}
      <polygon
        points="0,-68 59,-34 59,34 0,68 -59,34 -59,-34"
        fill="none"
        stroke="#00C9A7"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />
      {/* inner hex */}
      <polygon
        points="0,-46 40,-23 40,23 0,46 -40,23 -40,-23"
        fill="none"
        stroke="#00C9A7"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.3"
      />
      {/* W mark */}
      <polyline
        points="-40,-23 -18,26 0,6"
        fill="none"
        stroke="#00C9A7"
        strokeWidth="3.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        points="40,-23 18,26 0,6"
        fill="none"
        stroke="#00C9A7"
        strokeWidth="3.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* chainmail texture */}
      <polygon
        points="-28,-36 -16,-29 -16,-16 -28,-9 -40,-16 -40,-29"
        fill="none"
        stroke="#00C9A7"
        strokeWidth="0.8"
        opacity="0.18"
      />
      <polygon
        points="28,-36 40,-29 40,-16 28,-9 16,-16 16,-29"
        fill="none"
        stroke="#00C9A7"
        strokeWidth="0.8"
        opacity="0.18"
      />
      <polygon
        points="0,13 12,20 12,33 0,40 -12,33 -12,20"
        fill="none"
        stroke="#00C9A7"
        strokeWidth="0.8"
        opacity="0.18"
      />
      {/* joint circles */}
      <circle cx="0"   cy="-68" r="4.5" fill="#0D1117" stroke="#00C9A7" strokeWidth="1.8" />
      <circle cx="59"  cy="-34" r="4.5" fill="#0D1117" stroke="#00C9A7" strokeWidth="1.8" />
      <circle cx="59"  cy="34"  r="4.5" fill="#0D1117" stroke="#00C9A7" strokeWidth="1.8" />
      <circle cx="0"   cy="68"  r="4.5" fill="#0D1117" stroke="#00C9A7" strokeWidth="1.8" />
      <circle cx="-59" cy="34"  r="4.5" fill="#0D1117" stroke="#00C9A7" strokeWidth="1.8" />
      <circle cx="-59" cy="-34" r="4.5" fill="#0D1117" stroke="#00C9A7" strokeWidth="1.8" />
    </svg>
  )
}

function Logo64({ className }: { className?: string }) {
  return (
    <svg
      width="64"
      height="64"
      viewBox="-34 -34 68 68"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={dropShadow}
      aria-label="Walour logo"
    >
      <polygon
        points="0,-30 26,-15 26,15 0,30 -26,15 -26,-15"
        fill="none"
        stroke="#00C9A7"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <polyline
        points="-18,-10 -8,12 0,3 8,12 18,-10"
        fill="none"
        stroke="#00C9A7"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="0"   cy="-30" r="2.5" fill="#0D1117" stroke="#00C9A7" strokeWidth="1.2" />
      <circle cx="26"  cy="-15" r="2.5" fill="#0D1117" stroke="#00C9A7" strokeWidth="1.2" />
      <circle cx="26"  cy="15"  r="2.5" fill="#0D1117" stroke="#00C9A7" strokeWidth="1.2" />
      <circle cx="0"   cy="30"  r="2.5" fill="#0D1117" stroke="#00C9A7" strokeWidth="1.2" />
      <circle cx="-26" cy="15"  r="2.5" fill="#0D1117" stroke="#00C9A7" strokeWidth="1.2" />
      <circle cx="-26" cy="-15" r="2.5" fill="#0D1117" stroke="#00C9A7" strokeWidth="1.2" />
    </svg>
  )
}

function Logo32({ className }: { className?: string }) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="-18 -18 36 36"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={dropShadow}
      aria-label="Walour logo"
    >
      <polygon
        points="0,-15 13,-7.5 13,7.5 0,15 -13,7.5 -13,-7.5"
        fill="none"
        stroke="#00C9A7"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <polyline
        points="-9,-5 -4,6 0,2 4,6 9,-5"
        fill="none"
        stroke="#00C9A7"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

function Logo16({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="-10 -10 20 20"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={dropShadow}
      aria-label="Walour logo"
    >
      <polygon
        points="0,-8 7,-4 7,4 0,8 -7,4 -7,-4"
        fill="none"
        stroke="#00C9A7"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <polyline
        points="-5,-3 -2,3.5 0,1 2,3.5 5,-3"
        fill="none"
        stroke="#00C9A7"
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LogoFilled({ className }: { className?: string }) {
  return (
    <svg
      width="40"
      height="40"
      viewBox="-22 -22 44 44"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={dropShadow}
      aria-label="Walour logo"
    >
      <polygon points="0,-18 16,-9 16,9 0,18 -16,9 -16,-9" fill="#00C9A7" />
      <polyline
        points="-10,-6 -4,7 0,2 4,7 10,-6"
        fill="none"
        stroke="#0D1117"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function Logo({ size, variant, className }: LogoProps) {
  if (variant === 'filled') {
    return <LogoFilled className={className} />
  }

  if (size === 160) return <LogoFull className={className} />
  if (size === 64)  return <Logo64 className={className} />
  if (size === 32)  return <Logo32 className={className} />
  return <Logo16 className={className} />
}

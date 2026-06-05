const ORBIT_R = 14

/** Круговая траектория для animateMotion (центр 0,0 — внутри translate(cx,cy)). */
function orbitPath(r: number): string {
  return `M ${r} 0 A ${r} ${r} 0 1 1 ${-r} 0 A ${r} ${r} 0 1 1 ${r} 0`
}

const ELECTRONS = [
  { r: ORBIT_R, dur: '2.2s', begin: '0s', dotR: 3 },
  { r: ORBIT_R, dur: '2.2s', begin: '-0.73s', dotR: 3 },
  { r: ORBIT_R * 0.72, dur: '2.9s', begin: '-1.1s', dotR: 2.5 },
] as const

/**
 * Электроны вокруг ядра — SVG SMIL (всегда крутятся, без rAF и без animate-флага).
 */
export function CyberAtomOrbitSvg({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx}, ${cy})`} aria-hidden>
      <circle r={ORBIT_R} fill="none" stroke="#3dffec" strokeWidth="1" opacity="0.55" />
      <circle
        r={5}
        fill="#5ecbff"
        style={{ filter: 'drop-shadow(0 0 6px #5ecbff)' }}
      />
      {ELECTRONS.map((e, i) => (
        <g key={i}>
          <circle r={e.dotR} fill="#fff" style={{ filter: 'drop-shadow(0 0 4px #3dffec)' }}>
            <animateMotion
              dur={e.dur}
              begin={e.begin}
              repeatCount="indefinite"
              path={orbitPath(e.r)}
            />
          </circle>
        </g>
      ))}
    </g>
  )
}

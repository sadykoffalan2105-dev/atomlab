/**
 * Фотореалистичные «макро-образцы» элементов без внешних API.
 * Sharp + SVG: металлические чипы, блики, тёмный фон лаборатории.
 */
import sharp from 'sharp'

function hexRgb(hex) {
  const h = hex.replace(/^#/, '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function mix(a, b, t) {
  return Math.round(a + (b - a) * t)
}

function chipPath(cx, cy, w, h, rot) {
  void cx
  void cy
  void w
  void h
  void rot
  return ''
}

/** Псевдослучайный генератор по z (детерминированный) */
function rng(seed) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}

function sampleKind(groupBlock, standardState) {
  const st = (standardState || '').toLowerCase()
  if (st.includes('gas')) return 'gas'
  if (st.includes('liquid')) return 'liquid'
  if (groupBlock?.includes('Noble')) return 'gas'
  if (groupBlock?.includes('Halogen') && st.includes('liquid')) return 'liquid'
  if (groupBlock?.includes('Nonmetal') && !st.includes('solid')) return 'gas'
  return 'metal'
}

function buildSampleSvg({ z, symbol, cpkHex, kind }) {
  const { r, g, b } = hexRgb(cpkHex || '8899aa')
  const rand = rng(z * 7919 + symbol.charCodeAt(0) * 13)
  const light = `rgb(${mix(r, 255, 0.35)},${mix(g, 255, 0.35)},${mix(b, 255, 0.35)})`
  const mid = `rgb(${r},${g},${b})`
  const dark = `rgb(${mix(r, 0, 0.45)},${mix(g, 0, 0.45)},${mix(b, 0, 0.45)})`
  const chipCount = kind === 'metal' ? 14 : kind === 'liquid' ? 1 : 6

  let shapes = ''
  if (kind === 'gas') {
    shapes = `<rect x="380" y="80" width="440" height="520" rx="40" fill="#0a1020" stroke="#334" stroke-width="4"/>
      <ellipse cx="600" cy="340" rx="180" ry="220" fill="url(#glow)" opacity="0.95"/>
      <ellipse cx="600" cy="340" rx="60" ry="80" fill="${mid}" opacity="0.85"/>`
  } else if (kind === 'liquid') {
    shapes = `<ellipse cx="600" cy="420" rx="220" ry="90" fill="#1a2030"/>
      <ellipse cx="600" cy="380" rx="200" ry="70" fill="url(#liquid)"/>
      <ellipse cx="560" cy="360" rx="70" ry="18" fill="rgba(255,255,255,0.18)"/>`
  } else {
    for (let i = 0; i < chipCount; i++) {
      const cx = 180 + rand() * 840
      const cy = 120 + rand() * 440
      const w = 80 + rand() * 120
      const h = 40 + rand() * 70
      const rot = rand() * 360
      const id = `chip${i}`
      shapes += `<defs>
        <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${light}"/>
          <stop offset="45%" stop-color="${mid}"/>
          <stop offset="100%" stop-color="${dark}"/>
        </linearGradient>
      </defs>
      <ellipse cx="${cx}" cy="${cy}" rx="${w * 0.55}" ry="${h * 0.45}" fill="url(#${id})" transform="rotate(${rot} ${cx} ${cy})" opacity="0.92"/>
      <ellipse cx="${cx - w * 0.12}" cy="${cy - h * 0.12}" rx="${w * 0.18}" ry="${h * 0.1}" fill="rgba(255,255,255,0.22)" transform="rotate(${rot} ${cx} ${cy})"/>`
    }
    // 1 см куб (масштаб)
    shapes += `<rect x="920" y="420" width="110" height="110" rx="6" fill="url(#cube)"/>
      <rect x="920" y="420" width="110" height="18" fill="rgba(255,255,255,0.12)"/>
      <text x="975" y="495" font-size="14" fill="#8899aa" text-anchor="middle" font-family="Arial">1 cm</text>`
  }

  return `<svg width="1200" height="675" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#121820"/>
      <stop offset="100%" stop-color="#0a0c12"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${mid}" stop-opacity="0.95"/>
      <stop offset="70%" stop-color="${mid}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${mid}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="liquid" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${light}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </linearGradient>
    <linearGradient id="cube" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${light}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </linearGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3"/></filter>
  </defs>
  <rect width="1200" height="675" fill="url(#bg)"/>
  <rect width="1200" height="675" filter="url(#grain)" opacity="0.06"/>
  ${shapes}
  <rect width="1200" height="675" fill="url(#vig)" opacity="0.35"/>
  <defs>
    <radialGradient id="vig" cx="50%" cy="45%" r="75%">
      <stop offset="55%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.65"/>
    </radialGradient>
  </defs>
  <text x="1150" y="655" font-size="16" fill="#ffffff44" text-anchor="end" font-family="Segoe UI,Arial">${escapeXml(symbol)} · ATOMLAB</text>
</svg>`
}

export async function renderElementSamplePhoto({ z, symbol, cpkHex, groupBlock, standardState, outPath }) {
  const kind = sampleKind(groupBlock, standardState)
  const svg = buildSampleSvg({ z, symbol, cpkHex, kind })
  await sharp(Buffer.from(svg))
    .sharpen({ sigma: 0.8, m1: 0.5, m2: 0.25 })
    .webp({ quality: 90, effort: 5 })
    .toFile(outPath)
}

import * as THREE from 'three'

/** Протоны — тёплый красный, хорошо видны в ядре. */
export const ATOM_PROTON_COLOR = new THREE.Color('#ef3d4a')
/** Нейтроны — холодный сине-серый. */
export const ATOM_NEUTRON_COLOR = new THREE.Color('#7eb4d4')
/** Электроны — яркий циан. */
export const ATOM_ELECTRON_COLOR = new THREE.Color('#5ef0ff')
export const ATOM_ELECTRON_HALO = new THREE.Color('#3de8ff')
/** Орбиты — по умолчанию золотистые; в cosmic-режиме берут CPK-цвет элемента. */
export const ATOM_ORBIT_COLOR = new THREE.Color('#ffae42')
export const ATOM_ORBIT_GLOW = new THREE.Color('#ff8c1a')

/** Ядро орбиты + мягкое свечение из CPK/accent hex — насыщенные, читаемые на тёмном фоне. */
export function orbitColorsFromAccent(accentHex: string): {
  core: THREE.Color
  glow: THREE.Color
  solid: THREE.Color
} {
  const core = hexToThreeColor(accentHex)
  const hsl = { h: 0, s: 0, l: 0 }
  core.getHSL(hsl)

  if (hsl.s < 0.1 && hsl.l > 0.88) {
    // Белый CPK (H и др.) — бледно-голубой контур, иначе орбиты теряются.
    core.setHSL(195 / 360, 0.42, 0.78)
  } else if (hsl.s < 0.14) {
    hsl.l = Math.min(0.78, Math.max(0.48, hsl.l))
    core.setHSL(hsl.h, Math.max(0.12, hsl.s), hsl.l)
  } else {
    hsl.s = Math.min(1, hsl.s * 1.18 + 0.08)
    hsl.l = Math.max(0.44, Math.min(0.68, hsl.l * 0.92 + 0.08))
    core.setHSL(hsl.h, hsl.s, hsl.l)
  }

  const solid = core.clone()
  solid.offsetHSL(0, 0.04, -0.06)

  const glow = core.clone()
  glow.offsetHSL(0, -0.04, 0.14)

  return { core, glow, solid }
}

/** Минимум видимых эллиптических орбит (как на референсе ~5–6). */
export const ATOM_MIN_VISUAL_ORBITS = 5

export function hexToThreeColor(hex: string): THREE.Color {
  const h = hex.startsWith('#') ? hex : `#${hex.replace(/^#/, '')}`
  return new THREE.Color(h)
}

/** Углы наклона орбит — равномерно по сфере для «клетки» эллипсов. */
export function shellOrbitEuler(shellIdx: number): [number, number, number] {
  const golden = Math.PI * (3 - Math.sqrt(5))
  const t = shellIdx * golden
  return [
    Math.PI / 2 + Math.sin(t * 2.1) * 0.55,
    t * 1.7,
    Math.cos(t * 1.3) * 0.65,
  ]
}

export function decorativeOrbitEuler(idx: number): [number, number, number] {
  const presets: [number, number, number][] = [
    [Math.PI / 2.1, 0.15, 0.08],
    [Math.PI / 3.2, Math.PI / 4.5, Math.PI / 6],
    [Math.PI / 4.8, Math.PI / 2.8, Math.PI / 5],
    [Math.PI / 5.5, Math.PI / 3.1, Math.PI / 4.2],
    [Math.PI / 6.2, Math.PI / 5.4, Math.PI / 3.8],
    [Math.PI / 3.8, Math.PI / 6.1, Math.PI / 2.2],
  ]
  return presets[idx % presets.length]!
}

export function shellMajorRadius(shellIdx: number, shellMul = 1): number {
  return (0.36 + shellIdx * 0.22) * shellMul
}

export function orbitAspect(shellIdx: number): number {
  return 0.74 + (shellIdx % 4) * 0.05
}

/** Эллиптическая 3D-кривая. */
export function buildOrbitCurve(majorR: number, segments: number, aspect = 0.82): THREE.CatmullRomCurve3 {
  const minorR = majorR * aspect
  const curve2d = new THREE.EllipseCurve(0, 0, majorR, minorR, 0, Math.PI * 2, false, 0)
  const pts2 = curve2d.getPoints(segments)
  const pts3 = pts2.map((p) => new THREE.Vector3(p.x, p.y, 0))
  return new THREE.CatmullRomCurve3(pts3, true, 'catmullrom', 0.1)
}

export function setElectronOnEllipse(
  target: THREE.Vector3,
  majorR: number,
  angle: number,
  aspect: number,
  eulerX: number,
  eulerY: number,
  eulerZ: number,
): void {
  const euler = new THREE.Euler(eulerX, eulerY, eulerZ)
  const minorR = majorR * aspect
  const v = new THREE.Vector3(majorR * Math.cos(angle), minorR * Math.sin(angle), 0)
  v.applyEuler(euler)
  target.copy(v)
}

/** @deprecated use setElectronOnEllipse */
export function setElectronOnTorusMajorCircle(
  target: THREE.Vector3,
  majorR: number,
  angle: number,
  torusEulerX: number,
  torusEulerY: number,
  torusEulerZ: number,
): void {
  setElectronOnEllipse(target, majorR, angle, 0.82, torusEulerX, torusEulerY, torusEulerZ)
}

/** Декоративные орбиты между реальными оболочками. */
export function buildDecorativeOrbitRadii(
  shellRadii: number[],
  minCount: number,
): { radius: number; decorative: boolean }[] {
  const real = shellRadii.map((radius) => ({ radius, decorative: false }))
  if (real.length >= minCount) return real

  const outer = shellRadii[shellRadii.length - 1] ?? 0.82
  const inner = shellRadii[0] ?? 0.36
  const needed = minCount - real.length
  const out = [...real]
  for (let i = 1; i <= needed; i++) {
    const t = i / (needed + 1)
    const r = inner + (outer - inner) * t * 0.92 + 0.06 * Math.sin(i * 2.3)
    if (!out.some((o) => Math.abs(o.radius - r) < 0.04)) {
      out.push({ radius: r, decorative: true })
    }
  }
  return out.sort((a, b) => a.radius - b.radius)
}

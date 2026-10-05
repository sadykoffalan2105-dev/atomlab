/**
 * Органика v2 · синтез — цвета CPK (Jmol, как в просмотрщике молекул) и радиусы шаров «шары-стержни», Å.
 * C — светлее классического, чтобы читался на тёмном 3D-фоне в обеих темах.
 */
const COLORS: Readonly<Record<string, string>> = {
  H: '#f4f6fb', C: '#9aa1ad', N: '#3a63f8', O: '#ff2a2a', F: '#90e050', Cl: '#2fe03a', Br: '#c0392b', I: '#a020c0',
  S: '#ffe03a', P: '#ff8000', Si: '#f0c8a0', B: '#ffb5b5',
  Na: '#ab5cf2', K: '#8f40d4', Li: '#cc80ff', Mg: '#8aff00', Ca: '#3dff00', Ba: '#00c900',
  Cu: '#c88033', Ag: '#c0c0c0', Zn: '#7d80b0', Al: '#bfa6a6', Fe: '#e06633', Hg: '#b8b8d0', Mn: '#9c7ac7',
  Cr: '#8a99c7', Ni: '#50d050', Pt: '#d0d0e0', Pd: '#006985', Sn: '#668080', Pb: '#575961',
}
const RADII: Readonly<Record<string, number>> = {
  H: 0.24, C: 0.36, N: 0.35, O: 0.34, F: 0.32, Cl: 0.44, Br: 0.48, I: 0.54, S: 0.44, P: 0.44,
  Na: 0.55, K: 0.6, Li: 0.48, Mg: 0.5, Ca: 0.56, Cu: 0.44, Ag: 0.48, Zn: 0.44, Al: 0.48, Fe: 0.44, Hg: 0.48,
}

export const atomColor = (el: string): string => COLORS[el] ?? '#ff7ad9'
export const atomRadius = (el: string): number => RADII[el] ?? 0.46

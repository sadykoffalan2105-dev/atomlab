import {
  CLO2_ATOMS,
  CLO2_BONDS,
  CLO2_END,
  CLO2_GEOM,
  createClo2Frame,
  sampleClo2Frame,
  validateClo2Storyboard,
} from '../src/lab/cinema/scenes/clo2/storyboard.ts'

validateClo2Storyboard()
const f = createClo2Frame()
const prev = new Map<string, { x: number; y: number; z: number }>()
const dt = 1 / 60
let worstJump = { v: 0, id: '', t: 0 }
const minPair = new Map<string, { d: number; t: number }>()
const bonded = (a: string, b: string, t: number) =>
  CLO2_BONDS.some((bd) => ((bd.a === a && bd.b === b) || (bd.a === b && bd.b === a)) && f.bonds[bd.id].opacity > 0.02)
const r = (id: string) => (id.startsWith('cl') ? CLO2_GEOM.radius.cl : id.startsWith('na') ? CLO2_GEOM.radius.na : CLO2_GEOM.radius.o)

for (let t = 0; t <= CLO2_END + 1e-9; t += dt) {
  sampleClo2Frame(t, f)
  for (const a of CLO2_ATOMS) {
    const p = f.atoms[a.id]
    if (!Number.isFinite(p.x + p.y + p.z)) throw new Error(`NaN ${a.id} @${t}`)
    const q = prev.get(a.id)
    if (q) {
      const v = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) / dt
      if (v > worstJump.v) worstJump = { v, id: a.id, t }
    }
    prev.set(a.id, { x: p.x, y: p.y, z: p.z })
  }
  for (let i = 0; i < CLO2_ATOMS.length; i++)
    for (let j = i + 1; j < CLO2_ATOMS.length; j++) {
      const a = CLO2_ATOMS[i]!.id
      const b = CLO2_ATOMS[j]!.id
      if (bonded(a, b, t)) continue
      const d = f.atoms[a].distanceTo(f.atoms[b]) - r(a) - r(b)
      const key = `${a}-${b}`
      const cur = minPair.get(key)
      if (!cur || d < cur.d) minPair.set(key, { d, t })
    }
}
console.log('max speed', worstJump)
const sorted = [...minPair.entries()].sort((a, b) => a[1].d - b[1].d).slice(0, 12)
for (const [k, v] of sorted) console.log('gap', k, v.d.toFixed(3), '@', v.t.toFixed(2))

for (const t of [0, 5, 8, 9.3, 10.2, 12, 15, 18.15, 20.35, 22.4, 27, 31.8]) {
  sampleClo2Frame(t, f)
  const d = (a: keyof typeof f.atoms, b: keyof typeof f.atoms) => (f.atoms[a].distanceTo(f.atoms[b]) / 0.285).toFixed(2)
  const angle = (a: keyof typeof f.atoms, c: keyof typeof f.atoms, b: keyof typeof f.atoms) => {
    const u = f.atoms[a].clone().sub(f.atoms[c]).normalize()
    const w = f.atoms[b].clone().sub(f.atoms[c]).normalize()
    return ((Math.acos(u.dot(w)) * 180) / Math.PI).toFixed(1)
  }
  console.log(
    `t=${t}`,
    `ClA-OA1 ${d('clA', 'oA1')}Å`,
    `OClO_A ${angle('oA1', 'clA', 'oA2')}°`,
    `OA1-ClX ${d('oA1', 'clX')}`,
    `ClX-ClY ${d('clX', 'clY')}`,
    `OB1-ClA ${d('oB1', 'clA')}`,
    `ClA-OA1-ClX ${angle('clA', 'oA1', 'clX')}°`,
    `OB1-ClA-OA1 ${angle('oB1', 'clA', 'oA1')} OB1-ClA-OA2 ${angle('oB1', 'clA', 'oA2')}`,
    `ClB-OB1-ClA ${angle('clB', 'oB1', 'clA')}`,
  )
}

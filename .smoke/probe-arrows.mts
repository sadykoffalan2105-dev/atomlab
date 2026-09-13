import { CLO2_ARROWS, createClo2Frame, sampleClo2Frame } from '../src/lab/cinema/scenes/clo2/storyboard.ts'
const f = createClo2Frame()
for (const t of [8.9, 9.8, 17, 19.4]) {
  sampleClo2Frame(t, f)
  f.arrows.forEach((a, i) => {
    if (a.opacity > 0.01) console.log(t, CLO2_ARROWS[i].id, 'draw', a.draw.toFixed(2), 'op', a.opacity.toFixed(2), 'len', a.p0.distanceTo(a.p1).toFixed(3), 'p0', a.p0.toArray().map(v=>v.toFixed(2)).join(','), 'p1', a.p1.toArray().map(v=>v.toFixed(2)).join(','))
  })
  f.electrons.forEach(e => { if (e.opacity > 0.01) console.log('   ', e.id, e.pos.toArray().map(v=>v.toFixed(2)).join(','), 'op', e.opacity.toFixed(2)) })
}

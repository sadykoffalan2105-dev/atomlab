/**
 * Сюжет реакции «на уровне частиц» (src/chemistry/reactionStory.ts) — анимация после синтеза.
 * Проверяет на всех реакциях банка (SCHOOL_REACTION_BANK), на 200 основных реакциях (если в ветке есть
 * src/data/catalog/mainReactions200.ts) и на уравнениях учебников 7–9 классов:
 *  • атомы сохраняются (по элементам) и сопоставление атомов — биекция с тем же элементом;
 *  • Σ степеней окисления каждой частицы = её заряду;
 *  • число отданных e⁻ = числу принятых, переносы (from → to) в сумме дают то же число;
 *  • сохранённые связи соединяют образы атомов; многоатомные группы, перешедшие целиком, — тот же состав;
 *  • тексты трёх языков без пустот («undefined», «NaN», пустые строки);
 *  • эталоны: Zn + 2HCl, 2Na + Cl₂, Fe + CuSO₄, 2H₂ + O₂, BaCl₂ + H₂SO₄, NaOH + HCl, CaCO₃ → CaO + CO₂, 2KMnO₄ → …
 *  • анимация (storyLayout): летящих e⁻ (с учётом групп «×n») = Σ Δ степеней окисления, каждая точка — от донора
 *    к акцептору; подсвеченные доноры/акцепторы = атомы, у которых степень окисления растёт/падает; Σ ≤ 6 — по
 *    одному, иначе не больше 6 волн; полёты — внутри шага переноса, до паузы-акцента; атомы есть в каждом кадре;
 *    в итоге газ/осадок не налезают на другие продукты; огромные реакции — компактный вид (по одной лицевой копии
 *    члена, у каждого члена с ролью светится лицевой атом).
 *  • электроны (200 основных реакций, шаг 1/30 с, обычный вид и слабое устройство): ни одна видимая точка — пары,
 *    общей пары или летящая — не внутри шара (|e − c| ≥ r + 0,5·eR, все шары сюжета и окружения «Итога»); центры
 *    видимых точек пар не ближе 2,2·eR друг к другу.
 * Запуск: npx tsx scripts/test-reaction-story.mts
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { SCHOOL_REACTION_BANK } from '../src/chemistry/schoolReactionBank'
import { buildReactionStory, unitOxSum, type ReactionStory } from '../src/chemistry/reactionStory'
import { parseEquationText, equationImbalance } from '../src/chemistry/equationFormula'
import {
  buildStoryPairs,
  storyBondDot,
  storyBondVis,
  storyFlightPoint,
  storyFlightU,
  storyFlightVis,
  storyFrame,
  storyLoneDot,
  storyLoneVis,
  STORY_E_R,
} from '../src/lab/cinema/scenes/story/storyPairs'
import { buildStoryEnv, envDrift } from '../src/lab/cinema/scenes/story/storyPhase'
import { storyVibWindow } from '../src/lab/cinema/scenes/story/storyMotion'
import { smooth } from '../src/lab/cinema/scenes/story/storyLayout'
import { buildStoryLayout, E_SINGLE_MAX, E_WAVES_MAX, STORY_COMPACT_ATOMS, STORY_COMPACT_ATOMS_LOW, storyAtomPos } from '../src/lab/cinema/scenes/story/storyLayout'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

let fails = 0
let checks = 0
function ok(cond: boolean, msg: string): void {
  checks++
  if (!cond) {
    fails++
    console.error(`  ✗ ${msg}`)
  }
}

function checkStory(label: string, s: ReactionStory): void {
  const L = s.left
  const R = s.right
  // атомы сохраняются
  const cnt = (atoms: readonly { el: string }[]) => {
    const c: Record<string, number> = {}
    for (const a of atoms) c[a.el] = (c[a.el] ?? 0) + 1
    return JSON.stringify(Object.keys(c).sort().map((k) => [k, c[k]]))
  }
  ok(cnt(L.atoms) === cnt(R.atoms), `${label}: атомы сохраняются`)
  // биекция
  const seen = new Set<number>()
  let bij = s.map.length === L.atoms.length && L.atoms.length === R.atoms.length
  s.map.forEach((r, l) => {
    if (r < 0 || seen.has(r) || R.atoms[r]?.el !== L.atoms[l]!.el) bij = false
    seen.add(r)
  })
  ok(bij, `${label}: сопоставление атомов — биекция по элементам`)
  // Σ степеней окисления = заряду частицы
  for (const side of [L, R]) {
    for (const u of side.units) {
      const sum = unitOxSum(side, u.id)
      ok(Math.abs(sum - u.charge) < 1e-6, `${label}: Σ с.о. ${u.formula} = ${sum}, заряд ${u.charge}`)
      for (const g of u.groups) {
        const gr = side.groups[g]!
        if (gr.kind === 'cation' || gr.kind === 'anion') {
          const gs = gr.atoms.reduce((acc, a) => acc + side.atoms[a]!.ox, 0)
          ok(Math.abs(gs - gr.charge) < 1e-6, `${label}: Σ с.о. иона ${gr.label} = ${gs}, заряд ${gr.charge}`)
        }
      }
    }
  }
  // электроны
  ok(Math.abs(s.given - s.accepted) < 1e-6, `${label}: отдано ${s.given} = принято ${s.accepted}`)
  const tSum = s.transfers.reduce((acc, t) => acc + t.n, 0)
  ok(Math.abs(tSum - s.electrons) < 1e-5, `${label}: переносы дают ${tSum} = ${s.electrons}`)
  ok(s.redox === s.steps.includes('electrons'), `${label}: шаг «перенос электронов» только при ОВР`)
  for (const t of s.transfers) {
    const dFrom = R.atoms[s.map[t.from]!]!.ox - L.atoms[t.from]!.ox
    const dTo = R.atoms[s.map[t.to]!]!.ox - L.atoms[t.to]!.ox
    ok(dFrom > 0 && dTo < 0, `${label}: перенос от восстановителя к окислителю`)
  }
  // связи
  const rb = new Set(R.bonds.map((b) => [b.a, b.b].sort((x, y) => x - y).join('-')))
  for (const i of s.bondsKept) {
    const b = L.bonds[i]!
    ok(rb.has([s.map[b.a]!, s.map[b.b]!].sort((x, y) => x - y).join('-')), `${label}: сохранённая связь есть справа`)
  }
  ok(s.bondsKept.length + s.bondsBroken.length === L.bonds.length, `${label}: связи слева разделены на сохранённые и разорванные`)
  ok(s.bondsKept.length + s.bondsFormed.length === R.bonds.length, `${label}: связи справа — сохранённые + новые`)
  for (const [gl, gr] of s.conserved) {
    const a = L.groups[gl]!
    const b = R.groups[gr]!
    ok(a.key === b.key && a.atoms.every((x) => b.atoms.includes(s.map[x]!)), `${label}: группа ${b.label} переходит целиком`)
  }
  checkLayout(label, s)
  // тексты
  for (const loc of ['ru', 'en', 'uz'] as const) {
    for (const id of s.steps) {
      const t = s.text[loc][id]
      for (const [k, v] of Object.entries(t)) {
        ok(typeof v === 'string' && v.trim().length > 0 && !/undefined|NaN|null|\[object/.test(v), `${label}: текст ${loc}/${id}/${k} без пустот: «${v}»`)
      }
    }
  }
}

/** Анимация сюжета: электроны, роли, кадры. */
function checkLayout(label: string, s: ReactionStory): void {
  const L = s.left
  const R = s.right
  for (const lowPower of [false, true]) {
    const lay = buildStoryLayout(s, { lowPower })
    const tag = `${label}${lowPower ? ' (слабое устройство)' : ''}`
    // доноры / акцепторы — независимо, по степеням окисления
    const up: number[] = []
    const down: number[] = []
    L.atoms.forEach((a, i) => {
      const d = R.atoms[s.map[i]!]!.ox - a.ox
      if (d > 1e-9) up.push(i)
      else if (d < -1e-9) down.push(i)
    })
    ok(JSON.stringify([...lay.donors].sort((x, y) => x - y)) === JSON.stringify(up), `${tag}: подсвеченные доноры = атомы, у которых с.о. растёт`)
    ok(JSON.stringify([...lay.acceptors].sort((x, y) => x - y)) === JSON.stringify(down), `${tag}: подсвеченные акцепторы = атомы, у которых с.о. падает`)
    const sumN = lay.electrons.reduce((acc, e) => acc + e.n, 0)
    ok(Math.abs(sumN - (s.redox ? s.electrons : 0)) < 1e-5, `${tag}: летящих e⁻ ${sumN} = Σ Δ ${s.electrons}`)
    const sumW = lay.waves.reduce((acc, w) => acc + w.n, 0)
    ok(Math.abs(sumW - sumN) < 1e-5, `${tag}: подписи волн «×n» в сумме ${sumW} = ${sumN}`)
    // Σ Δ по донорам и по акцепторам тоже = числу e⁻
    const dUp = up.reduce((acc, i) => acc + R.atoms[s.map[i]!]!.ox - L.atoms[i]!.ox, 0)
    const dDown = down.reduce((acc, i) => acc + L.atoms[i]!.ox - R.atoms[s.map[i]!]!.ox, 0)
    if (s.redox) ok(Math.abs(dUp - sumN) < 1e-5 && Math.abs(dDown - sumN) < 1e-5, `${tag}: Σ Δ доноров ${dUp} = Σ Δ акцепторов ${dDown} = ${sumN}`)
    const upS = new Set(up)
    const downS = new Set(down)
    ok(lay.electrons.every((e) => upS.has(e.from) && downS.has(e.to)), `${tag}: каждая точка летит от донора к акцептору`)
    // по каждому атому: отдал/принял ровно свой Δ
    const per = new Map<number, number>()
    for (const e of lay.electrons) {
      per.set(e.from, (per.get(e.from) ?? 0) - e.n)
      per.set(e.to, (per.get(e.to) ?? 0) + e.n)
    }
    ok([...up, ...down].every((i) => Math.abs((per.get(i) ?? 0) + (R.atoms[s.map[i]!]!.ox - L.atoms[i]!.ox)) < 1e-5), `${tag}: каждый атом отдаёт/принимает ровно Δ своей с.о.`)
    if (lay.eSingle) ok(lay.electrons.every((e) => e.n === 1) && lay.electrons.length <= E_SINGLE_MAX, `${tag}: по одному — только при Σ ≤ ${E_SINGLE_MAX}`)
    else {
      const frac = lay.electrons.some((e) => Math.abs(e.n - Math.round(e.n)) > 1e-6)
      ok(lay.waves.length <= E_WAVES_MAX && (sumN > E_SINGLE_MAX - 1e-9 || frac || lay.compact), `${tag}: группами — не больше ${E_WAVES_MAX} волн`)
    }
    // компактный вид огромных реакций: у каждого члена ровно одна лицевая копия; светятся (лицевые) доноры и
    // акцепторы — у каждого члена с ролью есть свой светящийся атом; волна «×n» — поток одного члена к одному
    const leftTerm = (i: number) => L.units[L.atoms[i]!.unit]!.term
    ok(lay.compact === lay.n > (lowPower ? STORY_COMPACT_ATOMS_LOW : STORY_COMPACT_ATOMS), `${tag}: компактный вид — только у огромных реакций`)
    if (lay.compact) {
      for (const [side, layer, atomUnit] of [
        [L, lay.layerL, (i: number) => L.atoms[i]!.unit],
        [R, lay.layerR, (i: number) => R.atoms[s.map[i]!]!.unit],
      ] as const) {
        const frontUnits = new Map<number, Set<number>>()
        for (let i = 0; i < lay.n; i++) {
          if (layer[i]) continue
          const u = side.units[atomUnit(i)]!
          const g = frontUnits.get(u.term) ?? new Set<number>()
          g.add(u.id)
          frontUnits.set(u.term, g)
        }
        const terms = new Set(side.units.map((u) => u.term))
        ok([...terms].every((tm) => frontUnits.get(tm)?.size === 1), `${tag}: компактный вид — по одной лицевой копии у каждого члена`)
      }
      for (const [list, what] of [[up, 'донор'], [down, 'акцептор']] as const) {
        const termsWith = new Set(list.map(leftTerm))
        const glowTerms = new Set(list.filter((i) => !lay.layerL[i]).map(leftTerm))
        ok([...termsWith].every((tm) => glowTerms.has(tm)), `${tag}: компактный вид — у каждого члена с ролью «${what}» светится лицевой атом`)
      }
      ok(lay.waves.every((w) => new Set(w.tokens.map((k) => `${leftTerm(lay.electrons[k]!.from)}>${leftTerm(lay.electrons[k]!.to)}`)).size >= 1), `${tag}: волны компактного вида`)
    }
    const sE = lay.steps.find((x) => x.id === 'electrons')
    if (s.redox && sE) ok(lay.electrons.every((e) => e.t0 >= sE.from && e.t1 <= sE.to - 1.5), `${tag}: полёты внутри шага переноса, пауза-акцент ≥ 1.5 с`)
    // атомы есть в каждом кадре
    const out = new Float32Array(3)
    let finite = true
    for (let t = 0; t <= lay.end; t += 0.37) {
      for (let i = 0; i < lay.n; i++) {
        storyAtomPos(lay, i, t, out)
        if (!Number.isFinite(out[0]!) || !Number.isFinite(out[1]!) || !Number.isFinite(out[2]!)) finite = false
      }
    }
    ok(finite && lay.n === L.atoms.length, `${tag}: все атомы есть в каждом кадре`)
    // в итоге уходящий член (газ ↑, осадок ↓) не налезает на другие продукты
    const termOf = (i: number) => R.units[R.atoms[s.map[i]!]!.unit]!.term
    let clash = ''
    for (let i = 0; i < lay.n && !clash; i++) {
      const fi = s.terms[termOf(i)]!.fate
      if (fi !== 'gas' && fi !== 'precipitate' && fi !== 'deposit') continue
      if (lay.p4[i * 3 + 1] === lay.p3[i * 3 + 1]) continue
      for (let j = 0; j < lay.n; j++) {
        if (termOf(j) === termOf(i)) continue
        const d = Math.hypot(lay.p4[i * 3]! - lay.p4[j * 3]!, lay.p4[i * 3 + 1]! - lay.p4[j * 3 + 1]!)
        if (d < lay.radiusR[i]! + lay.radiusR[j]! + 0.05) {
          clash = `${L.atoms[i]!.el}${i}–${L.atoms[j]!.el}${j}`
          break
        }
      }
    }
    ok(!clash, `${tag}: газ/осадок в итоге не налезает на другие продукты (${clash})`)
  }
}

/** Электроны сюжета (как рисует ReactionStoryScene): точки вне шаров, пары раздельны. */
const eStat = { reactions: 0, frames: 0, dots: 0, inside: 0, close: 0, worstIn: 0, worstSep: Infinity, list: [] as string[] }
function checkElectrons(label: string, s: ReactionStory): void {
  for (const lowPower of [false, true]) {
    const lay = buildStoryLayout(s, { lowPower })
    const pr = buildStoryPairs(s, lay, { lowPower })
    const env = buildStoryEnv(s, lay, { lowPower })
    const vib = storyVibWindow(lay.steps, lay.breakFrom)
    const n = lay.n
    const P = new Float32Array(n * 3)
    const R = new Float32Array(n)
    const Rv = new Float32Array(n)
    const E = new Float32Array(Math.max(1, env.particles.length) * 3)
    const Er = new Float32Array(Math.max(1, env.particles.length))
    const q = [0, 0, 0]
    const tA = pr.on
    const tB = Math.max(pr.off, ...lay.electrons.map((e) => e.t1 + 0.25))
    let bad = 0
    let close = 0
    eStat.reactions++
    for (let k = 0; ; k++) {
      const t = tA + k / 30
      if (t > tB + 1e-9) break
      eStat.frames++
      const fade = smooth(0, 0.65, t) * (1 - smooth(lay.finish.from, lay.finish.to - 0.15, t))
      storyFrame(lay, vib, t, P, R, Rv)
      const dr = envDrift(env, t)
      env.particles.forEach((p, m) => {
        E[m * 3] = p.x + p.vx * dr
        E[m * 3 + 1] = p.y + p.vy * dr
        E[m * 3 + 2] = p.z + p.vz * dr
        Er[m] = p.r * smooth(p.t0, p.t0 + 0.45, t)
      })
      // точки: [x, y, z, eR, неподвижная]
      const dots: number[][] = []
      for (const lp of pr.lone) {
        if (fade * storyLoneVis(pr, lay, lp, t) < 0.01) continue
        for (const sd of [-1, 1]) {
          storyLoneDot(lp, P, R, sd, q)
          dots.push([q[0]!, q[1]!, q[2]!, STORY_E_R, 1])
        }
      }
      for (const bp of pr.bond) {
        if (fade * storyBondVis(pr, lay, bp, t) < 0.01) continue
        for (const sd of [-1, 1]) {
          storyBondDot(lay, bp, P, R, sd, q)
          dots.push([q[0]!, q[1]!, q[2]!, STORY_E_R, 1])
        }
      }
      lay.electrons.forEach((e, m) => {
        if (fade * storyFlightVis(e, t) < 0.01) return
        storyFlightPoint(pr.flights[m]!, e.from, e.to, P, R, storyFlightU(e.t0, e.t1, t), q)
        dots.push([q[0]!, q[1]!, q[2]!, pr.flights[m]!.er, 0])
      })
      eStat.dots += dots.length
      for (const d of dots) {
        const lim = 0.5 * d[3]!
        for (let j = 0; j < n; j++) {
          if (Rv[j]! < 0.005) continue
          const pen = Rv[j]! + lim - Math.hypot(d[0]! - P[j * 3]!, d[1]! - P[j * 3 + 1]!, d[2]! - P[j * 3 + 2]!)
          if (pen > 0) {
            bad++
            eStat.worstIn = Math.max(eStat.worstIn, pen)
            if (eStat.list.length < 30) eStat.list.push(`${label}${lowPower ? ' (слабое)' : ''}: точка в шаре ${lay.el[j]}${j} на ${pen.toFixed(3)} при t=${t.toFixed(2)} (${d[4] ? 'пара' : 'летит'})`)
          }
        }
        for (let m = 0; m < env.particles.length; m++) {
          if (Er[m]! < 0.005) continue
          const pen = Er[m]! + lim - Math.hypot(d[0]! - E[m * 3]!, d[1]! - E[m * 3 + 1]!, d[2]! - E[m * 3 + 2]!)
          if (pen > 0) {
            bad++
            if (eStat.list.length < 30) eStat.list.push(`${label}${lowPower ? ' (слабое)' : ''}: точка в шаре окружения при t=${t.toFixed(2)}`)
          }
        }
      }
      for (let a = 0; a < dots.length; a++) {
        if (!dots[a]![4]) continue
        for (let b = a + 1; b < dots.length; b++) {
          if (!dots[b]![4]) continue
          const d = Math.hypot(dots[a]![0]! - dots[b]![0]!, dots[a]![1]! - dots[b]![1]!, dots[a]![2]! - dots[b]![2]!)
          eStat.worstSep = Math.min(eStat.worstSep, d / STORY_E_R)
          if (d < 2.2 * STORY_E_R) {
            close++
            if (eStat.list.length < 30) eStat.list.push(`${label}${lowPower ? ' (слабое)' : ''}: точки пар в ${(d / STORY_E_R).toFixed(2)}·eR при t=${t.toFixed(2)}`)
          }
        }
      }
    }
    eStat.inside += bad
    eStat.close += close
    ok(bad === 0, `${label}${lowPower ? ' (слабое)' : ''}: электроны внутри шаров — ${bad} точко-кадров`)
    ok(close === 0, `${label}${lowPower ? ' (слабое)' : ''}: точки пар ближе 2,2·eR — ${close}`)
  }
}

// ——— 1. банк реакций ———
let bankOk = 0
const bankSkipped: string[] = []
for (const r of SCHOOL_REACTION_BANK) {
  const eq = parseEquationText(r.equationRu)
  if (!eq || eq.isScheme || equationImbalance(eq).length > 0 || [...eq.reactants, ...eq.products].some((x) => x.electron)) {
    bankSkipped.push(`${r.id} (${r.equationRu}) — не полное уравнение`)
    continue
  }
  const s = buildReactionStory(r.equationRu)
  ok(!!s, `банк ${r.id}: сюжет строится (${r.equationRu})`)
  if (!s) continue
  bankOk++
  checkStory(`банк ${r.id} «${r.equationRu}»`, s)
}

// ——— 2. 200 основных реакций (если модуль уже есть в ветке) ———
let main200 = 0
const mainPath = resolve(ROOT, 'src/data/catalog/mainReactions200.ts')
if (existsSync(mainPath)) {
  const mod = (await import(pathToFileURL(mainPath).href)) as Record<string, unknown>
  const list = (Object.values(mod).find((v) => Array.isArray(v) && v.length >= 100) ?? []) as { id?: string; equation?: string; equationRu?: string }[]
  for (const r of list) {
    const text = r.equation ?? r.equationRu
    if (!text) continue
    const s = buildReactionStory(text)
    ok(!!s, `200: ${r.id ?? text}: сюжет строится (${text})`)
    if (!s) continue
    main200++
    checkStory(`200 ${r.id ?? ''} «${text}»`, s)
    checkElectrons(`200 ${r.id ?? ''} «${text}»`, s)
  }
}

// ——— 3. уравнения учебников 7–9 ———
let bookOk = 0
let bookTotal = 0
const bookFail: string[] = []
for (const g of [7, 8, 9]) {
  const j = JSON.parse(readFileSync(resolve(ROOT, `src/data/textbook/equations-g${g}.json`), 'utf8')) as {
    units: { reactions?: { id: string; page: number; equation: string; isGeneralScheme?: boolean; isIonic?: boolean }[] }[]
  }
  for (const u of j.units) {
    for (const r of u.reactions ?? []) {
      if (r.isGeneralScheme) continue
      const eq = parseEquationText(r.equation)
      if (!eq || eq.isScheme || equationImbalance(eq).length > 0) continue
      const all = [...eq.reactants, ...eq.products]
      if (all.some((x) => x.electron || x.perUnit || x.polymer || x.radical || !Number.isInteger(x.coeff))) continue
      bookTotal++
      const s = buildReactionStory(r.equation)
      if (!s) {
        bookFail.push(`${g} кл. с. ${r.page}: ${r.equation}`)
        continue
      }
      bookOk++
      checkStory(`${g} кл. с. ${r.page} «${r.equation}»`, s)
    }
  }
}
ok(bookOk >= bookTotal * 0.97, `учебники 7–9: сюжет строится для ${bookOk} из ${bookTotal}`)

// ——— 4. эталоны ———
function ref(eq: string): ReactionStory {
  const s = buildReactionStory(eq)
  if (!s) throw new Error(`эталон не строится: ${eq}`)
  checkStory(`эталон «${eq}»`, s)
  return s
}
const oxOf = (s: ReactionStory, side: 'left' | 'right', el: string) => [...new Set((side === 'left' ? s.left : s.right).atoms.filter((a) => a.el === el).map((a) => a.ox))].sort()

{
  const s = ref('Zn + 2HCl → ZnCl₂ + H₂')
  ok(s.redox && s.electrons === 2, 'Zn + 2HCl: 2e⁻')
  ok(s.oxidations.length === 1 && s.oxidations[0]!.el === 'Zn' && s.oxidations[0]!.from === 0 && s.oxidations[0]!.to === 2, 'Zn + 2HCl: Zn⁰ → Zn⁺²')
  ok(s.reductions.length === 1 && s.reductions[0]!.el === 'H' && s.reductions[0]!.count === 2 && s.reductions[0]!.from === 1 && s.reductions[0]!.to === 0, 'Zn + 2HCl: 2H⁺ → H₂⁰')
  ok(s.transfers.length === 2 && s.transfers.every((t) => s.left.atoms[t.from]!.el === 'Zn' && s.left.atoms[t.to]!.el === 'H' && t.n === 1), 'Zn + 2HCl: по e⁻ к каждому H⁺')
  ok(s.terms.find((t) => t.formula === 'H₂')?.fate === 'gas', 'Zn + 2HCl: H₂ — газ ↑')
  ok(s.type === 'substitution', 'Zn + 2HCl: замещение')
  ok(s.text.ru.electrons.body.includes('Восстановитель — Zn'), 'Zn + 2HCl: текст называет восстановитель')
}
{
  const s = ref('2Na + Cl₂ → 2NaCl')
  ok(s.electrons === 2 && s.type === 'combination', '2Na + Cl₂: 2e⁻, соединение')
  ok(s.right.groups.some((g) => g.label === 'Na⁺') && s.right.groups.some((g) => g.label === 'Cl⁻'), '2Na + Cl₂: NaCl из ионов Na⁺ и Cl⁻')
}
{
  const s = ref('Fe + CuSO₄ → FeSO₄ + Cu')
  ok(s.electrons === 2, 'Fe + CuSO₄: 2e⁻')
  ok(JSON.stringify(oxOf(s, 'left', 'Cu')) === '[2]' && JSON.stringify(oxOf(s, 'right', 'Fe')) === '[2]', 'Fe + CuSO₄: Cu⁺² → Cu⁰, Fe⁰ → Fe⁺²')
  ok(s.conserved.length === 1 && s.right.groups[s.conserved[0]![1]]!.label === 'SO₄²⁻', 'Fe + CuSO₄: SO₄²⁻ сохраняется')
  ok(s.terms.find((t) => t.formula === 'Cu')?.fate === 'deposit', 'Fe + CuSO₄: медь оседает')
}
{
  const s = ref('2H₂ + O₂ → 2H₂O')
  ok(s.electrons === 4, '2H₂ + O₂: 4e⁻')
  ok(s.bondsBroken.length === 3 && s.bondsFormed.length === 4, '2H₂ + O₂: рвутся H–H ×2 и O–O, образуются O–H ×4')
}
{
  // школьная кратность у двухатомных CO и NO: C≡O, N=O; у CO₂ — O=C=O
  const s = ref('2CO + O₂ → 2CO₂')
  const ord = (side: typeof s.left, a: string, b: string) =>
    side.bonds.filter((x) => [side.atoms[x.a]!.el, side.atoms[x.b]!.el].sort().join('') === [a, b].sort().join('')).map((x) => x.order)
  ok(ord(s.left, 'C', 'O').every((o) => o === 3) && ord(s.right, 'C', 'O').every((o) => o === 2), '2CO + O₂: C≡O → O=C=O')
  const n = ref('N₂ + O₂ ⇄ 2NO')
  ok(ord(n.right, 'N', 'O').length === 2 && ord(n.right, 'N', 'O').every((o) => o === 2), 'N₂ + O₂: N=O')
}
{
  const ord = (side: ReactionStory['left'], a: string, b: string) =>
    side.bonds.filter((x) => [side.atoms[x.a]!.el, side.atoms[x.b]!.el].sort().join('') === [a, b].sort().join('')).map((x) => x.order)
  const pairOf = (side: ReactionStory['left'], i: number) => [side.atoms[side.bonds[i]!.a]!.el, side.atoms[side.bonds[i]!.b]!.el].sort().join('')
  // H₂CO₃ — H–O–C(=O)–O–H: нет C–H, ровно одна C=O; при разложении рвутся только C–O(H) и O–H
  const c = ref('H₂CO₃ → H₂O + CO₂')
  ok(ord(c.left, 'C', 'H').length === 0, 'H₂CO₃: связи C–H нет')
  ok(ord(c.left, 'C', 'O').filter((o) => o === 2).length === 1, 'H₂CO₃: одна C=O')
  ok(c.bondsBroken.every((i) => pairOf(c.left, i) === 'CO' || pairOf(c.left, i) === 'HO'), 'H₂CO₃ → H₂O + CO₂: рвутся только C–O и O–H')
  // пероксид диспропорционирует: O₂ — из пероксида, 2e⁻; кислород воды остаётся −2
  const p = ref('2Na₂O₂ + 2H₂O → 4NaOH + O₂')
  ok(p.electrons === 2, '2Na₂O₂ + 2H₂O: 2e⁻ (диспропорционирование пероксида)')
  ok(p.oxidations.every((x) => x.el === 'O' && x.from === -1 && x.to === 0) && p.reductions.every((x) => x.el === 'O' && x.from === -1 && x.to === -2), '2Na₂O₂ + 2H₂O: O⁻¹ → O⁰ и O⁻¹ → O⁻²')
  // кислородный анион соли — как в кислоте: SO₄²⁻ две S=O, ClO₃⁻ две Cl=O
  const z = ref('Zn + H₂SO₄ → ZnSO₄ + H₂')
  ok(ord(z.right, 'S', 'O').filter((o) => o === 2).length === 2, 'ZnSO₄: две S=O, как в H₂SO₄')
  const k = ref('2KClO₃ → 2KCl + 3O₂')
  ok(ord(k.left, 'Cl', 'O').filter((o) => o === 2).length === 4, '2KClO₃: по две Cl=O')
  // горение — по типу каталога; восстановление оксида — без «оседает»
  ok(!ref('4NO₂ + 2H₂O + O₂ → 4HNO₃').combustion, '4NO₂ + 2H₂O + O₂: не горение')
  ok(!ref('2Cu + O₂ → 2CuO').combustion && ref('2Mg + O₂ → 2MgO').combustion, 'горение по каталогу: Cu — нет, Mg — да')
  ok(ref('CuO + H₂ → Cu + H₂O').terms.find((t) => t.formula === 'Cu')?.fate !== 'deposit', 'CuO + H₂: Cu без ↓')
  ok(ref('Fe + CuSO₄ → FeSO₄ + Cu').terms.find((t) => t.formula === 'Cu')?.fate === 'deposit', 'Fe + CuSO₄: Cu оседает')
}
{
  const s = ref('BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl')
  ok(!s.redox && s.electrons === 0, 'BaCl₂ + H₂SO₄: ОВР нет')
  ok(s.conserved.some(([, g]) => s.right.groups[g]!.label === 'SO₄²⁻'), 'BaCl₂ + H₂SO₄: SO₄²⁻ сохраняется')
  ok(s.terms.find((t) => t.formula === 'BaSO₄')?.fate === 'precipitate', 'BaCl₂ + H₂SO₄: BaSO₄ — осадок ↓')
  ok(s.type === 'exchange', 'BaCl₂ + H₂SO₄: обмен')
  ok(!s.steps.includes('electrons'), 'BaCl₂ + H₂SO₄: без шага электронов')
}
{
  const s = ref('NaOH + HCl → NaCl + H₂O')
  ok(!s.redox, 'NaOH + HCl: ОВР нет')
  ok(s.type === 'neutralization', 'NaOH + HCl: нейтрализация')
  // H⁺ + OH⁻ → H₂O: связь O–H гидроксид-иона сохраняется, образуется одна новая O–H, рвётся H–Cl
  ok(s.bondsKept.length === 1 && s.bondsFormed.length === 1 && s.bondsBroken.length === 1, 'NaOH + HCl: H⁺ + OH⁻ → H₂O')
  const water = s.right.units.find((u) => u.formula === 'H₂O')!
  const fromOH = s.left.groups.find((g) => g.label === 'OH⁻')!
  ok(fromOH.atoms.every((a) => water.atoms.includes(s.map[a]!)), 'NaOH + HCl: OH⁻ целиком в воде')
  ok(s.terms.find((t) => t.formula === 'H₂O')?.fate === 'water', 'NaOH + HCl: вода')
}
{
  const s = ref('CaCO₃ → CaO + CO₂')
  ok(!s.redox && s.type === 'decomposition', 'CaCO₃: ОВР нет, разложение')
  ok(s.bondsBroken.length === 1 && s.bondsFormed.length === 0, 'CaCO₃: рвётся одна связь C–O, CO₂ уходит готовым')
  ok(s.terms.find((t) => t.formula === 'CO₂')?.fate === 'gas', 'CaCO₃: CO₂ — газ ↑')
}
{
  const s = ref('2KMnO₄ → K₂MnO₄ + MnO₂ + O₂')
  ok(s.electrons === 4, '2KMnO₄: 4e⁻ (2O⁻² → O₂⁰; Mn⁺⁷ → Mn⁺⁶ и Mn⁺⁴)')
  ok(JSON.stringify(oxOf(s, 'right', 'Mn')) === '[4,6]', '2KMnO₄: Mn⁺⁶ и Mn⁺⁴')
}
{
  const s = ref('2KMnO₄ + 16HCl → 2KCl + 2MnCl₂ + 5Cl₂ + 8H₂O')
  ok(s.electrons === 10, 'KMnO₄ + HCl: 10e⁻')
  const lay = buildStoryLayout(s)
  // 44 атома — компактный вид: одна волна «e⁻ ×10» от стопки HCl к стопке KMnO₄ (10Cl⁻ − 10e⁻ → 5Cl₂, 2Mn⁺⁷ + 10e⁻)
  ok(lay.compact && !lay.eSingle && lay.waves.length === 1 && lay.waves[0]!.n === 10, 'KMnO₄ + HCl: компактно, одна волна «e⁻ ×10»')
  const small = buildStoryLayout(ref('MnO₂ + 4HCl → MnCl₂ + Cl₂ + 2H₂O'))
  ok(!small.compact && small.eSingle && small.electrons.length === 2, 'MnO₂ + 4HCl: обычный вид, два e⁻ по одному')
}
{
  // 128 атомов: у каждого из 7 членов одна лицевая копия; поток FeSO₄ → KMnO₄ — одна волна «e⁻ ×10»
  const s = ref('2KMnO₄ + 10FeSO₄ + 8H₂SO₄ → K₂SO₄ + 2MnSO₄ + 5Fe₂(SO₄)₃ + 8H₂O')
  const lay = buildStoryLayout(s)
  const frontL = new Set<number>()
  for (let i = 0; i < lay.n; i++) if (!lay.layerL[i]) frontL.add(s.left.atoms[i]!.unit)
  ok(lay.compact && frontL.size === 3 && lay.waves.length === 1 && lay.waves[0]!.n === 10, 'KMnO₄ + FeSO₄: компактно, 3 лицевые копии слева, волна «e⁻ ×10»')
}
{
  const s = ref('Fe + CuSO₄ → FeSO₄ + Cu')
  const lay = buildStoryLayout(s)
  ok(lay.eSingle && lay.electrons.length === 2 && lay.electrons[1]!.t0 > lay.electrons[0]!.t0 + 0.3, 'Fe + CuSO₄: два e⁻ летят по одному')
  ok(lay.donors.length === 1 && s.left.atoms[lay.donors[0]!]!.el === 'Fe' && lay.acceptors.length === 1 && s.left.atoms[lay.acceptors[0]!]!.el === 'Cu', 'Fe + CuSO₄: светятся Fe (донор) и Cu (акцептор)')
  ok(lay.keptGroups.length === 1 && lay.keptGroups[0]!.label === 'SO₄²⁻', 'Fe + CuSO₄: подсветка сохранённой группы SO₄²⁻')
  ok(!lay.labelB.some((x) => /[⁺⁻]/.test(x) && /^(S|O)/.test(x)), 'Fe + CuSO₄: атомы SO₄ без вымышленных зарядов')
}
{
  // MnO₄⁻ разбирается: Mn и O — символы, а не «Mn⁷⁺» и «O²⁻»; H⁺ и Cl⁻ кислоты — ионы
  const lay = buildStoryLayout(ref('2KMnO₄ + 16HCl → 2KCl + 2MnCl₂ + 5Cl₂ + 8H₂O'))
  ok(!lay.labelB.includes('Mn⁷⁺') && !lay.labelB.includes('O²⁻'), 'KMnO₄ + HCl: нет вымышленных ионов Mn⁷⁺ и O²⁻')
  ok(lay.labelB.includes('Cl⁻') && lay.labelB.includes('H⁺'), 'KMnO₄ + HCl: HCl → H⁺ + Cl⁻')
}
{
  const s = ref('2Na + O₂ → Na₂O₂')
  ok(s.electrons === 2 && JSON.stringify(oxOf(s, 'right', 'O')) === '[-1]', 'Na₂O₂: пероксид O⁻¹, 2e⁻')
}
{
  const s = ref('NH₄NO₃ → N₂O + 2H₂O')
  ok(s.electrons === 4 && JSON.stringify(oxOf(s, 'left', 'N')) === '[-3,5]', 'NH₄NO₃: N⁻³ и N⁺⁵, 4e⁻')
}
{
  const s = ref('3Fe + 2O₂ → Fe₃O₄')
  ok(s.electrons === 8, 'Fe₃O₄: 8e⁻ (Fe⁺² + 2Fe⁺³)')
}

if (bankSkipped.length) console.log(`  · банк: пропущено ${bankSkipped.length} (не полное уравнение): ${bankSkipped.slice(0, 6).join('; ')}`)
if (bookFail.length) console.log(`  · учебники: не построено ${bookFail.length}: ${bookFail.slice(0, 12).join(' | ')}`)
console.log(`банк: ${bankOk}/${SCHOOL_REACTION_BANK.length}; 200 основных: ${main200 || 'нет модуля в ветке'}; учебники 7–9: ${bookOk}/${bookTotal}`)
console.log(
  `электроны (200 основных): реакций×вид ${eStat.reactions}, кадров ${eStat.frames}, точко-кадров ${eStat.dots}; внутри шаров ${eStat.inside} (худшее ${eStat.worstIn.toFixed(3)}), пары ближе 2,2·eR ${eStat.close} (минимум ${Number.isFinite(eStat.worstSep) ? eStat.worstSep.toFixed(2) : '—'}·eR)`,
)
for (const x of eStat.list) console.log(`  · ${x}`)
console.log(`test-reaction-story: ${checks - fails}/${checks} проверок`)
if (fails > 0) {
  console.error(`FAIL: ${fails}`)
  process.exit(1)
}
console.log('OK')

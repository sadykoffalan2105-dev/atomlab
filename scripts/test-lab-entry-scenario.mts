#!/usr/bin/env node
/**
 * Сценарий экрана входа в лабораторию: научная верность и непрерывность цикла.
 * Запуск: npx tsx scripts/test-lab-entry-scenario.mts
 */
import assert from 'node:assert/strict'
import { createAtomPool, createBondPool } from '../src/lab/cinema/core/pools.ts'
import {
  ENTRY_ANGLE_HOH,
  ENTRY_ATOM_COUNT,
  ENTRY_BOND_COUNT,
  ENTRY_D_HH,
  ENTRY_D_OH,
  ENTRY_D_OO,
  ENTRY_FREEZE_SEC,
  ENTRY_LOOP_SEC,
  ENTRY_PHASES,
  ENTRY_R_H,
  ENTRY_R_O,
  entryCaptionKeyAt,
  entryPhaseAt,
  entryProductAt,
  entryHeroFitScale,
  entryTargetAngleDeg,
  sampleEntryFrame,
  writeEntryStatics,
  type EntryFrameOptions,
} from '../src/components/lab/entry/labEntryScenario.ts'
import {
  ENTRY_MAX_ATOMS,
  ENTRY_MAX_BONDS,
  ENTRY_SCENARIOS,
  entryScenarioAt,
} from '../src/components/lab/entry/labEntryScenarioSet.ts'
import {
  ENTRY_BACKDROP_PROBE,
  ENTRY_MIN_ATOM_CONTRAST,
  ENTRY_SKY,
  contrastRatio,
  entryAtomCpk,
  entryBackdropHex,
  relativeLuminance,
} from '../src/components/lab/entry/labEntryPalette.ts'
import { ATOMIC_DATA, bondAngleDeg, bondLengthPm, type ElementSymbol } from '../src/chemistry/data/index.ts'
import { SCENE_PER_ANGSTROM, pmToAngstrom } from '../src/lab/cinema/core/atoms.ts'

let checks = 0
function ok(cond: boolean, msg: string): void {
  assert.ok(cond, msg)
  checks += 1
}
function near(actual: number, expected: number, eps: number, msg: string): void {
  assert.ok(Math.abs(actual - expected) <= eps, `${msg}: ${actual} != ${expected} ± ${eps}`)
  checks += 1
}

/** Угол воды и длины связей — только из научного ядра, без литералов. */
const WATER_ANGLE = bondAngleDeg('water')
const toScene = (pm: number) => pmToAngstrom(pm) * SCENE_PER_ANGSTROM

const atoms = createAtomPool(16)
const bonds = createBondPool(12)
const opt: EntryFrameOptions = { heroScale: 1, liftY: 0, yaw: 0, offsets: null, fade: 1, spread: 1 }

writeEntryStatics(atoms, bonds, opt.heroScale)

function dist(i: number, j: number): number {
  const a = i * 3
  const b = j * 3
  return Math.hypot(
    atoms.position[a]! - atoms.position[b]!,
    atoms.position[a + 1]! - atoms.position[b + 1]!,
    atoms.position[a + 2]! - atoms.position[b + 2]!,
  )
}

function angleAt(o: number, h0: number, h1: number): number {
  const ax = atoms.position[h0 * 3]! - atoms.position[o * 3]!
  const ay = atoms.position[h0 * 3 + 1]! - atoms.position[o * 3 + 1]!
  const az = atoms.position[h0 * 3 + 2]! - atoms.position[o * 3 + 2]!
  const bx = atoms.position[h1 * 3]! - atoms.position[o * 3]!
  const by = atoms.position[h1 * 3 + 1]! - atoms.position[o * 3 + 1]!
  const bz = atoms.position[h1 * 3 + 2]! - atoms.position[o * 3 + 2]!
  const d = Math.hypot(ax, ay, az) * Math.hypot(bx, by, bz)
  const c = Math.max(-1, Math.min(1, (ax * bx + ay * by + az * bz) / d))
  return (Math.acos(c) * 180) / Math.PI
}

// --- научные величины --------------------------------------------------------
{
  near(ENTRY_ANGLE_HOH, WATER_ANGLE, 1e-9, 'угол H–O–H взят из научного ядра')
  near(ENTRY_D_OH, toScene(bondLengthPm('O-H')), 1e-9, 'O–H в мировых единицах')
  near(ENTRY_D_HH, toScene(bondLengthPm('H-H')), 1e-9, 'H–H в мировых единицах')
  near(ENTRY_D_OO, toScene(bondLengthPm('O=O')), 1e-9, 'O=O в мировых единицах')
  ok(ENTRY_R_O > ENTRY_R_H, 'вдв-радиус кислорода больше водородного')
  near(ENTRY_R_O / ENTRY_R_H, ATOMIC_DATA.O.vdwRadiusPm / ATOMIC_DATA.H.vdwRadiusPm, 1e-9, 'пропорция вдв-радиусов O : H сохранена')
}

// --- хронометраж -------------------------------------------------------------
{
  let prev = 0
  for (const p of ENTRY_PHASES) {
    near(p.from, prev, 1e-9, `фаза ${p.phase} начинается там, где кончилась прошлая`)
    ok(p.to > p.from, `фаза ${p.phase} имеет положительную длительность`)
    prev = p.to
  }
  near(prev, ENTRY_LOOP_SEC, 1e-9, 'фазы покрывают весь цикл')
  ok(entryPhaseAt(0).phase === 'disperse', 't=0 — разлёт')
  ok(entryPhaseAt(ENTRY_FREEZE_SEC).phase === 'present', 'кадр заморозки — фаза показа')
  ok(entryPhaseAt(ENTRY_LOOP_SEC - 0.01).phase === 'fade', 'конец цикла — растворение')
  ok(entryCaptionKeyAt(ENTRY_FREEZE_SEC) === 'lab.entry.drag', 'в показе зовём тянуть молекулу')
  ok(entryCaptionKeyAt(0) === 'lab.entry.hold', 'в разлёте зовём удержать палец')
}

// --- геометрия готовой воды --------------------------------------------------
{
  sampleEntryFrame(ENTRY_FREEZE_SEC, entryTargetAngleDeg(ENTRY_FREEZE_SEC), opt, atoms, bonds)
  near(dist(0, 2), ENTRY_D_OH, 1e-6, 'O–H первой молекулы')
  near(dist(0, 3), ENTRY_D_OH, 1e-6, 'вторая связь O–H первой молекулы')
  near(dist(1, 4), ENTRY_D_OH, 1e-6, 'O–H второй молекулы')
  near(dist(1, 5), ENTRY_D_OH, 1e-6, 'вторая связь O–H второй молекулы')
  near(angleAt(0, 2, 3), WATER_ANGLE, 0.05, 'угол H–O–H первой молекулы')
  near(angleAt(1, 4, 5), WATER_ANGLE, 0.05, 'угол H–O–H второй молекулы')
  near(entryProductAt(ENTRY_FREEZE_SEC), 1, 1e-9, 'в показе продукт готов полностью')
  ok(atoms.charge[0]! < -0.5, 'на кислороде частичный отрицательный заряд')
  ok(atoms.charge[2]! > 0.2, 'на водороде частичный положительный заряд')
  ok(bonds.polarity[3]! < 0, 'электронная плотность связи O–H смещена к кислороду')
}

// --- масштаб и разворот ------------------------------------------------------
{
  const scaled: EntryFrameOptions = { heroScale: 2, liftY: 0.4, yaw: 0.7, offsets: null, fade: 1, spread: 1 }
  sampleEntryFrame(ENTRY_FREEZE_SEC, entryTargetAngleDeg(ENTRY_FREEZE_SEC), scaled, atoms, bonds)
  near(dist(0, 2), ENTRY_D_OH * 2, 1e-6, 'масштаб героя множит длину связи')
  near(angleAt(0, 2, 3), WATER_ANGLE, 0.05, 'разворот и масштаб угол не меняют')
}

// --- непрерывность на границах фаз -------------------------------------------
{
  const eps = 1e-3
  // Раскрытие H–O–H ведёт пружина: на границе фаз её значение одно и то же,
  // меняется только ЦЕЛЬ (180° → угол воды из ядра). Поэтому сравниваем при общем угле —
  // проверяется непрерывность самих позиций, а не скачок цели.
  ok(entryTargetAngleDeg(6.19) === 180, 'до вспышки заготовка вытянута')
  near(entryTargetAngleDeg(6.21), WATER_ANGLE, 1e-9, 'после вспышки цель — настоящий угол воды')
  const before = new Float32Array(ENTRY_ATOM_COUNT * 3)
  for (const p of ENTRY_PHASES) {
    if (p.to >= ENTRY_LOOP_SEC) continue
    const angle = entryTargetAngleDeg(p.to - 1e-4)
    sampleEntryFrame(p.to - 1e-4, angle, opt, atoms, bonds)
    before.set(atoms.position.subarray(0, ENTRY_ATOM_COUNT * 3))
    sampleEntryFrame(p.to + 1e-4, angle, opt, atoms, bonds)
    for (let i = 0; i < ENTRY_ATOM_COUNT * 3; i++) {
      const d = Math.abs(before[i]! - atoms.position[i]!)
      ok(d < eps, `граница ${p.phase} → следующая: атом ${(i / 3) | 0} сдвинулся на ${d}`)
    }
  }
}

// --- пул: счётчики, непрозрачность, отсутствие мусора ------------------------
{
  ok(atoms.count === ENTRY_ATOM_COUNT, 'в пуле ровно шесть атомов героя')
  ok(bonds.count === ENTRY_BOND_COUNT, 'в пуле семь связей: три реагентных и четыре O–H')

  sampleEntryFrame(0.02, 180, opt, atoms, bonds)
  ok(atoms.opacity[0]! < 0.35, 'в начале разлёта атомы ещё вплывают')
  sampleEntryFrame(ENTRY_LOOP_SEC - 0.02, entryTargetAngleDeg(ENTRY_LOOP_SEC - 0.02), opt, atoms, bonds)
  ok(atoms.opacity[0]! < 0.12, 'в конце цикла атомы растворились')
  ok(atoms.radius[0]! < 0.5 * ENTRY_R_O, 'уходя, атом ещё и сжимается — screen-door не мозолит глаз')

  const faded: EntryFrameOptions = { ...opt, fade: 0.25 }
  sampleEntryFrame(ENTRY_FREEZE_SEC, ENTRY_ANGLE_HOH, faded, atoms, bonds)
  near(atoms.opacity[0]!, 0.25, 1e-6, 'проявление сцены множит непрозрачность')

  // Детерминизм и отсутствие аллокаций: массивы те же, результат повторяем.
  const posRef = atoms.position
  const bondRef = bonds.a
  const snapshot = Float32Array.from(atoms.position)
  const hasGc = typeof globalThis.gc === 'function'
  if (hasGc) globalThis.gc!()
  const before = process.memoryUsage().heapUsed
  for (let i = 0; i < 20000; i++) sampleEntryFrame(ENTRY_FREEZE_SEC, ENTRY_ANGLE_HOH, faded, atoms, bonds)
  const grown = process.memoryUsage().heapUsed - before
  ok(atoms.position === posRef, 'пул атомов не пересоздаётся')
  ok(bonds.a === bondRef, 'пул связей не пересоздаётся')
  for (let i = 0; i < ENTRY_ATOM_COUNT * 3; i++) {
    ok(snapshot[i] === atoms.position[i], `кадр детерминирован, слот ${i}`)
  }
  // Без --expose-gc сборщик не вызывался, и heapUsed — это шум, а не утечка:
  // проверка кучи имеет смысл только когда её удалось привести в известное
  // состояние. Остальные проверки этого блока (те же массивы, тот же результат)
  // ловят пересоздание пулов и без неё.
  if (hasGc) {
    ok(grown < 2 * 1024 * 1024, `20000 кадров не растят кучу (выросла на ${(grown / 1024) | 0} КиБ)`)
  }
}

// --- сжатие кадра под узкий экран --------------------------------------------
{
  // Сжимаются только центры молекул: длины связей и угол остаются научными.
  const narrow: EntryFrameOptions = { ...opt, spread: 0.55 }
  sampleEntryFrame(ENTRY_FREEZE_SEC, ENTRY_ANGLE_HOH, narrow, atoms, bonds)
  near(dist(0, 2), ENTRY_D_OH, 1e-6, 'сжатие кадра не трогает длину O–H')
  near(angleAt(0, 2, 3), WATER_ANGLE, 0.05, 'сжатие кадра не трогает угол H–O–H')
  const narrowGap = Math.abs(atoms.position[0]! - atoms.position[3]!)
  sampleEntryFrame(ENTRY_FREEZE_SEC, ENTRY_ANGLE_HOH, opt, atoms, bonds)
  const wideGap = Math.abs(atoms.position[0]! - atoms.position[3]!)
  ok(narrowGap < wideGap, 'на узком экране молекулы стоят теснее')

  // Контакт реагентов — химия, и он НЕ сжимается ни при каком экране.
  sampleEntryFrame(5.6 - 1e-4, 180, narrow, atoms, bonds)
  const hitNarrow = dist(0, 1)
  sampleEntryFrame(5.6 - 1e-4, 180, opt, atoms, bonds)
  near(hitNarrow, dist(0, 1), 1e-6, 'O=O в момент контакта одинаков на любом экране')
  near(dist(0, 1), ENTRY_D_OO, 1e-6, 'и равен настоящей длине O=O')
}

// --- смещение схваченной молекулы -------------------------------------------
{
  const offsets = new Float32Array([0, -1.5, 0, 0, 0, 0])
  const grabbed: EntryFrameOptions = { ...opt, offsets }
  sampleEntryFrame(ENTRY_FREEZE_SEC, ENTRY_ANGLE_HOH, grabbed, atoms, bonds)
  const y0 = atoms.position[1]!
  const y1 = atoms.position[4]!
  sampleEntryFrame(ENTRY_FREEZE_SEC, ENTRY_ANGLE_HOH, opt, atoms, bonds)
  near(y0, atoms.position[1]! - 1.5, 1e-6, 'схваченная молекула уезжает целиком')
  near(y1, atoms.position[4]!, 1e-6, 'вторая молекула остаётся на месте')
  near(dist(0, 2), ENTRY_D_OH, 1e-6, 'длина связи при перетаскивании не меняется')
}

// --- смена вещества петли ----------------------------------------------------
{
  ok(ENTRY_SCENARIOS.length === 4, 'в наборе четыре вещества')
  ok(ENTRY_SCENARIOS[0]!.id === 'h2o', 'лаборатория открывается водой')
  ok(entryScenarioAt(4).id === 'h2o', 'набор идёт по кругу')
  ok(entryScenarioAt(-1).id === ENTRY_SCENARIOS[3]!.id, 'отрицательный номер петли не ломает круг')
  ok(ENTRY_MAX_ATOMS <= 16, 'пул атомов (16) вмещает самый большой сценарий')
  ok(ENTRY_MAX_BONDS <= 12, 'пул связей (12) вмещает самый большой сценарий')

  const nacl = ENTRY_SCENARIOS.find((s) => s.id === 'nacl')!
  ok(nacl.ligandR[1] < nacl.ligandR[0], 'натрий сжимается в Na⁺')
  ok(nacl.centerR[1] > nacl.centerR[0], 'хлор разбухает в Cl⁻')

  for (const spec of ENTRY_SCENARIOS) {
    const o: EntryFrameOptions = { ...opt, spec }
    writeEntryStatics(atoms, bonds, 1, spec)
    ok(atoms.count === spec.atomCount, `${spec.id}: счётчик атомов`)
    ok(bonds.count === spec.bondCount, `${spec.id}: счётчик связей`)
    ok(spec.units.length > 1, `${spec.id}: реагенты летят несколькими единицами`)

    // Готовый продукт: длины связей центр–лиганд научные, угол — из ядра.
    sampleEntryFrame(ENTRY_FREEZE_SEC, spec.angleEndDeg, o, atoms, bonds)
    for (let p = 0; p < spec.products; p++) {
      const base = spec.products + p * spec.ligands
      for (let k = 0; k < spec.ligands; k++) {
        near(dist(p, base + k), spec.dCL, 1e-6, `${spec.id}: связь центр–лиганд ${p}/${k}`)
      }
      if (spec.ligands >= 2) {
        near(angleAt(p, base, base + 1), spec.angleEndDeg, 0.06, `${spec.id}: валентный угол молекулы ${p}`)
      }
    }

    // Непрерывность на границах фаз — как у воды.
    const before = new Float32Array(ENTRY_MAX_ATOMS * 3)
    for (const ph of ENTRY_PHASES) {
      if (ph.to >= ENTRY_LOOP_SEC) continue
      const angle = entryTargetAngleDeg(ph.to - 1e-4, spec)
      sampleEntryFrame(ph.to - 1e-4, angle, o, atoms, bonds)
      before.set(atoms.position.subarray(0, spec.atomCount * 3))
      sampleEntryFrame(ph.to + 1e-4, angle, o, atoms, bonds)
      for (let i = 0; i < spec.atomCount * 3; i++) {
        const d = Math.abs(before[i]! - atoms.position[i]!)
        ok(d < 2e-3, `${spec.id}: граница ${ph.phase}, атом ${(i / 3) | 0} сдвинулся на ${d}`)
      }
    }

    // Начало и конец петли: атомы вплывают и растворяются полностью — иначе
    // смена вещества была бы видна подменой кадра.
    sampleEntryFrame(0.02, spec.angleStartDeg, o, atoms, bonds)
    ok(atoms.opacity[0]! < 0.35, `${spec.id}: в начале петли атомы ещё вплывают`)
    sampleEntryFrame(ENTRY_LOOP_SEC - 0.02, spec.angleEndDeg, o, atoms, bonds)
    ok(atoms.opacity[0]! < 0.12, `${spec.id}: к концу петли атомы растворились`)
  }

  // Подгонка масштаба под кадр: вещество обязано помещаться в видимый мир,
  // а масштаб — никогда не превышать задуманный.
  for (const spec of ENTRY_SCENARIOS) {
    for (const [halfW, halfH, spread] of [
      [5.2, 3.0, 1],
      [1.6, 2.8, 0.5],
      [0.9, 1.4, 0.5],
    ] as const) {
      const base = 2.5
      const s = entryHeroFitScale(base, halfW, halfH, spread, spec)
      ok(s <= base + 1e-9, `${spec.id}: подгонка не должна увеличивать масштаб (${s})`)
      ok(s > 0, `${spec.id}: масштаб положительный`)
      // Пол подгонки (0.66 базового) оставлен намеренно: соль на телефоне
      // лучше подрезать на пару пикселей, чем превратить в бисер.
      ok(s >= base * 0.66 - 1e-9, `${spec.id}: масштаб не ниже пола (${s})`)
      const f = spec.fit
      const ws = 0.72 + 0.28 * spread
      const needX = Math.max(f.productCX * ws + f.armX, f.reagentCX * spread + f.armX) * s
      const needY = Math.max(f.productCY * ws + f.armY, f.reagentCY * spread + f.armY) * s
      const floored = s <= base * 0.66 + 1e-9
      if (!floored) {
        ok(needX <= halfW + 1e-6, `${spec.id}: не влезает по ширине (${needX} > ${halfW})`)
        ok(needY <= halfH + 1e-6, `${spec.id}: не влезает по высоте (${needY} > ${halfH})`)
      }
    }
  }

  // Вода возвращается в пулы по умолчанию — дальнейшие проверки её и ждут.
  writeEntryStatics(atoms, bonds, opt.heroScale)
}

// --- палитра: водород виден на небе обеих тем --------------------------------
{
  // Небо сцены — ровно ENTRY_SKY: вертикальный градиент и ядро берутся оттуда.
  for (const theme of ['dark', 'light'] as const) {
    const p = ENTRY_SKY[theme]
    ok(p.core > 0 && p.core <= 1 && p.ring >= 0 && p.ring <= 1, `${theme}: веса ядра и кольца в [0, 1]`)
  }
  // Светлая тема: небо не почти-белое — иначе белый водород читается лишь тенью.
  ok(relativeLuminance(ENTRY_SKY.light.top) < 0.8, 'светлое небо опущено ниже «листа бумаги»')
  // Тёмное небо темнее светлого на любом радиусе кадра.
  for (const r of [0, 0.35, ENTRY_BACKDROP_PROBE.belt, 1.1]) {
    ok(
      relativeLuminance(entryBackdropHex('dark', r)) < relativeLuminance(entryBackdropHex('light', r)),
      `r = ${r}: тёмное небо темнее светлого`,
    )
  }

  // Все элементы экрана входа: пояс (H₂O, CO₂, NH₃, HCl) и центры/лиганды петли.
  const used = new Set<ElementSymbol>(['H', 'O', 'C', 'N', 'Cl'])
  for (const spec of ENTRY_SCENARIOS) {
    for (const [sym, d] of Object.entries(ATOMIC_DATA) as [ElementSymbol, { cpk: number }][]) {
      if (d.cpk === spec.centerCpk || d.cpk === spec.ligandCpk) used.add(sym)
    }
  }
  for (const sym of used) {
    const src = ATOMIC_DATA[sym].cpk
    // Тёмная тема — цвет ядра данных без единой правки.
    ok(entryAtomCpk(src, 'dark') === src, `${sym}: в тёмной теме CPK из ядра как есть`)
    // Светлая тема — контраст с самым светлым участком неба не ниже порога.
    const adapted = entryAtomCpk(src, 'light')
    // Проба — пояс (самый светлый фон); у ядра фон темнее, светлые атомы там читаются лучше.
    const c = contrastRatio(adapted, entryBackdropHex('light', ENTRY_BACKDROP_PROBE.belt))
    ok(c >= ENTRY_MIN_ATOM_CONTRAST - 1e-3, `${sym}: контраст в светлой теме на поясе — ${c.toFixed(2)}`)
    // Цвет, который порог и так берёт, не трогается.
    if (contrastRatio(src, entryBackdropHex('light', ENTRY_BACKDROP_PROBE.belt)) >= ENTRY_MIN_ATOM_CONTRAST) {
      ok(adapted === src, `${sym}: контрастный CPK в светлой теме не меняется`)
    }
  }
  // Водород остаётся самым светлым атомом кадра, а не превращается в другой элемент.
  const hLight = relativeLuminance(entryAtomCpk(ATOMIC_DATA.H.cpk, 'light'))
  for (const sym of used) {
    if (sym === 'H') continue
    ok(hLight >= relativeLuminance(entryAtomCpk(ATOMIC_DATA[sym].cpk, 'light')) - 1e-6, `H светлее ${sym} и в светлой теме`)
  }
  // Оттенок сохраняется: приглушается только светлота (каналы в той же пропорции).
  {
    const src = ATOMIC_DATA.Cl.cpk
    const ad = entryAtomCpk(src, 'light')
    const ch = (h: number) => [(h >> 16) & 255, (h >> 8) & 255, h & 255]
    const [r0, g0, b0] = ch(src)
    const [r1, g1, b1] = ch(ad)
    ok(g0 >= r0 === g1 >= r1 && g0 >= b0 === g1 >= b1, 'у хлора сохранён доминирующий зелёный канал')
  }
}

console.log(`test-lab-entry-scenario: OK, проверок ${checks}`)

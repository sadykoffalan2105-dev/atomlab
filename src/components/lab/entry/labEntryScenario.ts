/**
 * Экран входа в лабораторию — чистая математика цикла «живая реакция-приглашение».
 *
 * Здесь нет ни three, ни React: только числа, поэтому сценарий читается в Node
 * и проверяется скриптом `scripts/test-lab-entry-scenario.mts` (тот же приём,
 * что у `atom/cpkAtomVisual.ts`).
 *
 * Химия буквальная. Ни одна длина и ни один угол здесь не записаны константой:
 * O–H, H–H, O=O и угол H–O–H приходят из научного ядра `src/chemistry/data`
 * и переводятся пм → Å → мировые единицы через `pmToAngstrom` и
 * `SCENE_PER_ANGSTROM`. Радиусы — ван-дер-ваальсовы, взятые общей долей
 * (ball-and-stick): пропорция H к O остаётся настоящей.
 *
 * Сюжет — 11-секундная петля синтеза:
 *   disperse 0–2.4   молекулы влетают из разлёта (outCubic)
 *   gather   2.4–5.6 сходятся к контактным расстояниям (inOutCubic)
 *   ignite   5.6–6.2 вспышка: старые связи рвутся, атомы перестраиваются (spike)
 *   form     6.2–7.6 проявляются связи продукта, раскрытие идёт к настоящему (outQuad)
 *   present  7.6–9.8 две готовые молекулы расходятся и держат кадр
 *   fade     9.8–11  уходят от центра в пояс веществ и растворяются (inQuad)
 *
 * Вещество каждой петли своё (`labEntryScenarioSet.ts`): вода → аммиак →
 * углекислый газ → соль. Переключение бесшовно: к концу петли атомы
 * растворились полностью, и следующая начинает с нуля непрозрачности.
 * Каждый новый цикл стартует с разворотом, чтобы повтор не читался как gif.
 */
import { ATOMIC_DATA, bondAngleDeg, bondLengthPm } from '../../../chemistry/data'
import { Ease, mix, norm } from '../../../lab/cinema/core/easing'
import { pmToAngstrom, SCENE_PER_ANGSTROM } from '../../../lab/cinema/core/atoms'
import { writeHexLinear, type AtomPool, type BondPool } from '../../../lab/cinema/core/pools'
import type { MessageKey } from '../../../i18n/messagesRu'
import {
  ENTRY_DEFAULT_SCENARIO,
  ENTRY_FRAMES,
  ENTRY_MAX_ATOMS,
  ENTRY_MAX_BONDS,
  entryBondDirs,
  type EntryScenarioSpec,
} from './labEntryScenarioSet'

const DEG = Math.PI / 180

/** пм → мировые единицы сцены. */
function scene(pm: number): number {
  return pmToAngstrom(pm) * SCENE_PER_ANGSTROM
}

// --- научные величины --------------------------------------------------------

/** O–H в воде, мировые единицы (bondLengthPm('O-H'), r₀). */
export const ENTRY_D_OH = scene(bondLengthPm('O-H'))
/** H–H в молекулярном водороде (bondLengthPm('H-H'), r_e). */
export const ENTRY_D_HH = scene(bondLengthPm('H-H'))
/** O=O в молекулярном кислороде (bondLengthPm('O=O'), r_e). */
export const ENTRY_D_OO = scene(bondLengthPm('O=O'))
/** Валентный угол H–O–H, градусы (bondAngleDeg('water'), r₀). */
export const ENTRY_ANGLE_HOH = bondAngleDeg('water')
/** Угол «вытянутой» заготовки в момент вспышки: связи ещё на одной прямой. */
export const ENTRY_ANGLE_LINEAR = 180

/**
 * Видимый радиус — доля ван-дер-ваальсова (ball-and-stick): пропорция H к O
 * настоящая, но сферы не слипаются в сплошной ком.
 */
const VDW_SHARE = 0.27

export const ENTRY_R_H = scene(ATOMIC_DATA.H.vdwRadiusPm) * VDW_SHARE
export const ENTRY_R_O = scene(ATOMIC_DATA.O.vdwRadiusPm) * VDW_SHARE

// --- раскладка слотов --------------------------------------------------------

/** Атомы воды: 0,1 — кислород; 2..5 — водород (2,3 к O₀; 4,5 к O₁). */
export const ENTRY_ATOM_COUNT = ENTRY_DEFAULT_SCENARIO.atomCount
/** Связи воды: 0 — O=O, 1,2 — H–H, 3..6 — четыре O–H продукта. */
export const ENTRY_BOND_COUNT = ENTRY_DEFAULT_SCENARIO.bondCount

// --- хронометраж -------------------------------------------------------------

export type EntryPhase = 'disperse' | 'gather' | 'ignite' | 'form' | 'present' | 'fade'

export const ENTRY_LOOP_SEC = 11
/** Растянутый цикл для слабых устройств: та же раскадровка, меньше событий в секунду. */
export const ENTRY_LOOP_SEC_LOW = 13

export const ENTRY_PHASES: ReadonlyArray<{ phase: EntryPhase; from: number; to: number }> = [
  { phase: 'disperse', from: 0, to: 2.4 },
  { phase: 'gather', from: 2.4, to: 5.6 },
  { phase: 'ignite', from: 5.6, to: 6.2 },
  { phase: 'form', from: 6.2, to: 7.6 },
  { phase: 'present', from: 7.6, to: 9.8 },
  { phase: 'fade', from: 9.8, to: ENTRY_LOOP_SEC },
]

/** Начало фазы показа — от него отсчитывается покачивание готовых молекул. */
const PRESENT_FROM = 7.6

/** Кадр, на котором замирает сцена при prefers-reduced-motion: готовая вода. */
export const ENTRY_FREEZE_SEC = 8.6

/**
 * Разворот петли: каждый следующий цикл повёрнут на золотой угол, приведённый
 * к узкому сектору. Так повтор не читается как зацикленная гифка, но сцена и
 * не крутится каруселью — реакция остаётся лицом к зрителю.
 */
export const ENTRY_LOOP_YAW_SPAN = 24 * DEG
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

/** Разворот n-го цикла, радианы. */
export function entryLoopYaw(loop: number): number {
  const k = ((loop * GOLDEN_ANGLE) / (Math.PI * 2)) % 1
  return (k - 0.5) * 2 * ENTRY_LOOP_YAW_SPAN
}

export type EntryPhaseAt = { phase: EntryPhase; local01: number }

const _phaseAt: EntryPhaseAt = { phase: 'disperse', local01: 0 }

/** Фаза и её локальное время 0..1. Возвращает общий изменяемый объект — без аллокаций. */
export function entryPhaseAt(t: number): EntryPhaseAt {
  const time = t < 0 ? 0 : t >= ENTRY_LOOP_SEC ? ENTRY_LOOP_SEC - 1e-6 : t
  for (let i = 0; i < ENTRY_PHASES.length; i++) {
    const p = ENTRY_PHASES[i]!
    if (time < p.to) {
      _phaseAt.phase = p.phase
      // norm(a, b, x) — границы ПЕРВЫМИ (см. cinema/core/easing.ts). Перепутанный
      // порядок давал обратный ход фазы: атомы появлялись сразу готовыми и
      // разлетались НАРУЖУ вместо подлёта.
      _phaseAt.local01 = norm(p.from, p.to, time)
      return _phaseAt
    }
  }
  const last = ENTRY_PHASES[ENTRY_PHASES.length - 1]!
  _phaseAt.phase = last.phase
  _phaseAt.local01 = 1
  return _phaseAt
}

/** Ключ подписи для текущей фазы (формулы идут мимо i18n — нотация одна во всех локалях). */
export function entryCaptionKeyAt(t: number): MessageKey {
  const at = entryPhaseAt(t)
  if (at.phase === 'present' || at.phase === 'fade') return 'lab.entry.drag'
  return 'lab.entry.hold'
}

/** Целевое раскрытие молекулы продукта в момент t (до вспышки заготовка ещё вытянута). */
export function entryTargetAngleDeg(t: number, spec: EntryScenarioSpec = ENTRY_DEFAULT_SCENARIO): number {
  const at = entryPhaseAt(t)
  if (at.phase === 'disperse' || at.phase === 'gather' || at.phase === 'ignite') return spec.angleStartDeg
  return spec.angleEndDeg
}

// --- рабочие буферы (модульные: в кадре ничего не создаётся) -----------------

/** xyz × атомы в локальных единицах героя, до разворота и масштаба. */
const _p = new Float32Array(ENTRY_MAX_ATOMS * 3)
/** Снимок контактной конфигурации: из него атомы переезжают в заготовку продукта. */
const _q = new Float32Array(ENTRY_MAX_ATOMS * 3)
/** Направления связей продукта в локальном базисе рамки. */
const _dirs = new Float32Array(9)

function setAtom(i: number, x: number, y: number, z: number): void {
  const o = i * 3
  _p[o] = x
  _p[o + 1] = y
  _p[o + 2] = z
}

/**
 * Пишет единицу полёта реагента: двухатомную молекулу в слоты a и b на
 * расстоянии d либо одиночный атом в слот a.
 * `cs` сжимает ТОЛЬКО положение центра в кадре; расстояние между атомами
 * остаётся научным — на узком экране реагенты подлетают ближе,
 * но H–H и O=O от этого не укорачиваются.
 */
function putUnitMix(
  spec: EntryScenarioSpec,
  unit: number,
  fromPose: readonly { c: readonly [number, number, number]; axis: readonly [number, number, number] }[],
  toPose: readonly { c: readonly [number, number, number]; axis: readonly [number, number, number] }[],
  k: number,
  cs: number,
): void {
  const u = spec.units[unit]!
  const m0 = fromPose[unit]!
  const m1 = toPose[unit]!
  const cx = mix(m0.c[0], m1.c[0], k) * cs
  const cy = mix(m0.c[1], m1.c[1], k) * cs
  const cz = mix(m0.c[2], m1.c[2], k) * cs
  if (u.b < 0) {
    setAtom(u.a, cx, cy, cz)
    return
  }
  // Ось интерполируется и перенормируется — молекула не «сплющивается» на полпути.
  let ax = mix(m0.axis[0], m1.axis[0], k)
  let ay = mix(m0.axis[1], m1.axis[1], k)
  let az = mix(m0.axis[2], m1.axis[2], k)
  const l = Math.hypot(ax, ay, az) || 1
  ax /= l
  ay /= l
  az /= l
  const h = u.d * 0.5
  setAtom(u.a, cx + ax * h, cy + ay * h, cz + az * h)
  setAtom(u.b, cx - ax * h, cy - ay * h, cz - az * h)
}

/** Пишет молекулу продукта p заданного раскрытия: центр в `c`, лиганды по направлениям рамки. */
function putProduct(
  spec: EntryScenarioSpec,
  p: number,
  cx: number,
  cy: number,
  cz: number,
  angleDeg: number,
): void {
  setAtom(p, cx, cy, cz)
  entryBondDirs(_dirs, ENTRY_FRAMES[p % ENTRY_FRAMES.length]!, spec.ligands, angleDeg)
  const base = spec.products + p * spec.ligands
  for (let k = 0; k < spec.ligands; k++) {
    const o = k * 3
    setAtom(base + k, cx + _dirs[o]! * spec.dCL, cy + _dirs[o + 1]! * spec.dCL, cz + _dirs[o + 2]! * spec.dCL)
  }
}

/**
 * Сжатие кадра под узкий экран: 1 — полный разлёт, меньше — реагенты подлетают
 * ближе и готовые молекулы стоят теснее. Сжимаются ТОЛЬКО центры молекул,
 * межатомные расстояния и углы остаются настоящими.
 */
function centerSpread(spread: number): number {
  return 0.72 + 0.28 * spread
}

/** Поля кадра, которые нельзя занимать молекулами: снизу подписи, по бокам воздух. */
const FIT_PAD_X = 0.16
const FIT_PAD_Y = 0.46
/**
 * Нижняя граница масштаба: доля от базового. Поваренная соль вдвое шире воды
 * (Na–Cl 236 пм против O–H 96 пм), и на 390 px честная подгонка увела бы её
 * в мелочь. Лучше дать краю молекулы выйти за кадр на пару пикселей, чем
 * показать школьнику бисер.
 */
const FIT_FLOOR = 0.66

/**
 * Масштаб героя, при котором вещество целиком помещается в видимый кадр.
 *
 * Считается на КАЖДУЮ петлю: габариты у воды, аммиака, углекислого газа и соли
 * разные, и общий масштаб означал бы обрезанную соль или мелкую воду. Полуширина
 * и полувысота приходят из `viewport` R3F — это ровно мировые единицы в плоскости
 * центра сцены, так что переводить пиксели в мир здесь не нужно.
 */
export function entryHeroFitScale(
  base: number,
  halfW: number,
  halfH: number,
  spread: number,
  spec: EntryScenarioSpec,
): number {
  const f = spec.fit
  const ws = centerSpread(spread)
  const needX = Math.max(f.productCX * ws + f.armX, f.reagentCX * spread + f.armX)
  const needY = Math.max(f.productCY * ws + f.armY, f.reagentCY * spread + f.armY)
  const roomX = Math.max(0.2, halfW - FIT_PAD_X)
  const roomY = Math.max(0.2, halfH - FIT_PAD_Y)
  const fit = Math.min(needX > 1e-4 ? roomX / needX : base, needY > 1e-4 ? roomY / needY : base)
  return Math.min(base, Math.max(base * FIT_FLOOR, fit))
}

/**
 * Раскладка атомов героя в локальных единицах для момента t.
 * `angleDeg` — текущее раскрытие продукта (в компоненте его ведёт пружина).
 */
function layoutHero(t: number, angleDeg: number, spread: number, spec: EntryScenarioSpec): void {
  const at = entryPhaseAt(t)
  const k = at.local01
  const ws = centerSpread(spread)
  const units = spec.units.length
  switch (at.phase) {
    case 'disperse': {
      const e = Ease.outCubic(k)
      for (let i = 0; i < units; i++) putUnitMix(spec, i, spec.far, spec.mid, e, spread)
      return
    }
    case 'gather': {
      const e = Ease.inOutCubic(k)
      // Контактные позиции не сжимаются никогда: там расстояния — химия.
      const cs = mix(spread, 1, e)
      for (let i = 0; i < units; i++) putUnitMix(spec, i, spec.mid, spec.hit, e, cs)
      return
    }
    case 'ignite': {
      // Перестройка связей: атомы из контактной конфигурации переезжают
      // в вытянутые заготовки продукта. Скачок прикрыт вспышкой — так и в жизни.
      const e = Ease.smooth(k)
      for (let i = 0; i < units; i++) putUnitMix(spec, i, spec.hit, spec.hit, 0, 1)
      // Копия поэлементно, а не через subarray: view — это тоже объект, а в кадре
      // не создаётся ни одного (см. шапку cinema/core/pools.ts).
      const n = spec.atomCount * 3
      for (let i = 0; i < n; i++) _q[i] = _p[i]!
      for (let p = 0; p < spec.products; p++) {
        const c = spec.protoC[p]!
        putProduct(spec, p, c[0] * ws, c[1] * ws, c[2] * ws, spec.angleStartDeg)
      }
      for (let i = 0; i < spec.atomCount * 3; i++) _p[i] = mix(_q[i]!, _p[i]!, e)
      return
    }
    case 'form': {
      const e = Ease.outQuad(k)
      for (let p = 0; p < spec.products; p++) {
        const a = spec.protoC[p]!
        const b = spec.spreadC[p]!
        putProduct(spec, p, mix(a[0], b[0], e) * ws, mix(a[1], b[1], e) * ws, mix(a[2], b[2], e) * ws, angleDeg)
      }
      return
    }
    default: {
      // present / fade: молекулы стоят разведёнными, едва покачиваясь.
      // Отсчёт от начала показа — иначе на границе фаз был бы скачок.
      const sway = Math.sin((t - PRESENT_FROM) * 1.15) * 0.012
      // В растворении готовое вещество УХОДИТ ОТ ЦЕНТРА НАЗАД — туда, где висит
      // пояс каталога: кадр читается как «продукт отправился на полку».
      const drift = at.phase === 'fade' ? Ease.inQuad(k) : 0
      for (let p = 0; p < spec.products; p++) {
        const c = spec.spreadC[p]!
        let x = c[0] * ws
        let y = c[1] * ws + (p === 0 ? sway : -sway)
        let z = c[2] * ws
        if (drift > 0) {
          const len = Math.hypot(c[0], c[1], c[2])
          // Одиночный продукт стоит в центре — ему направление ухода назначено.
          const dx = len > 0.05 ? c[0] / len : 0
          const dy = len > 0.05 ? c[1] / len : 0.24
          x += dx * drift * 0.62
          y += dy * drift * 0.62
          z -= drift * 0.5
        }
        putProduct(spec, p, x, y, z, angleDeg)
      }
      return
    }
  }
}

// --- непрозрачности и энергия ------------------------------------------------

/** Присутствие атомов героя 0..1: вплывают в начале, растворяются в конце. */
function heroAppearAt(t: number): number {
  const at = entryPhaseAt(t)
  if (at.phase === 'disperse') return Ease.outQuad(Math.min(1, at.local01 * 2.4))
  if (at.phase === 'fade') return 1 - Ease.inQuad(at.local01)
  return 1
}

/** Собственное свечение атомов: ровный фон и короткий всплеск на вспышке. */
function heroEmissiveAt(t: number): number {
  const at = entryPhaseAt(t)
  if (at.phase === 'ignite') return 0.28 + 2.1 * Ease.spike(at.local01)
  if (at.phase === 'form') return 0.28 + 0.5 * (1 - Ease.outQuad(at.local01))
  return 0.28
}

/** Сила вспышки 0..1 — её читают и сцена (ореол), и атмосфера. */
export function entryFlashAt(t: number): number {
  const at = entryPhaseAt(t)
  if (at.phase === 'ignite') return Ease.spike(at.local01)
  if (at.phase === 'form') return 0.28 * (1 - Ease.outQuad(at.local01))
  return 0
}

/**
 * Присутствие продукта 0..1: по нему гаснут связи реагентов, зажигаются связи
 * продукта и появляются частичные заряды δ. Растёт только во второй половине
 * вспышки — ровно там, где старые связи рвутся, а новые ещё не установились.
 */
export function entryProductAt(t: number): number {
  const at = entryPhaseAt(t)
  if (at.phase === 'disperse' || at.phase === 'gather') return 0
  if (at.phase === 'ignite') return Ease.outQuad(Math.max(0, at.local01 - 0.4) / 0.6)
  return 1
}

/**
 * Волна образования связи (поле `form` пула связей): 0 — связь только
 * возникла, 1 — установилась. Отделена от присутствия: связь ВИДНА сразу после
 * вспышки, но «доходит» всю фазу form — иначе жгут вспыхивал бы готовым.
 */
export function entryBondFormAt(t: number): number {
  const at = entryPhaseAt(t)
  if (at.phase === 'disperse' || at.phase === 'gather') return 0
  if (at.phase === 'ignite') return 0.25 * Ease.outQuad(Math.max(0, at.local01 - 0.4) / 0.6)
  if (at.phase === 'form') return 0.25 + 0.75 * Ease.outQuad(at.local01)
  return 1
}

// --- цвета и радиусы (пишутся один раз на сценарий) --------------------------

/** Базовые радиусы слотов: [реагентная форма, форма в продукте]. */
const _baseR0 = new Float32Array(ENTRY_MAX_ATOMS)
const _baseR1 = new Float32Array(ENTRY_MAX_ATOMS)
/** Базовые радиусы жгутов — их, как и радиусы атомов, множит кривая появления. */
const _baseBondR = new Float32Array(ENTRY_MAX_BONDS)

/**
 * Постоянные поля пула: цвет CPK (в линейном RGB) и вдв-радиус.
 * Вызывается один раз на сценарий — в кадре эти массивы не трогаются.
 */
export function writeEntryStatics(
  atoms: AtomPool,
  bonds: BondPool,
  heroScale: number,
  spec: EntryScenarioSpec = ENTRY_DEFAULT_SCENARIO,
): void {
  atoms.count = spec.atomCount
  for (let i = 0; i < spec.atomCount; i++) {
    const isCenter = i < spec.products
    writeHexLinear(atoms.color, i, isCenter ? spec.centerCpk : spec.ligandCpk)
    const r = isCenter ? spec.centerR : spec.ligandR
    _baseR0[i] = r[0] * heroScale
    _baseR1[i] = r[1] * heroScale
    atoms.radius[i] = _baseR0[i]!
    atoms.opacity[i] = 1
    atoms.emissive[i] = 0.28
    atoms.charge[i] = 0
  }
  bonds.count = spec.bondCount
  for (let i = 0; i < spec.bondCount; i++) {
    _baseBondR[i] = 0.032 * heroScale
    bonds.radius[i] = _baseBondR[i]!
    bonds.opacity[i] = 0
    bonds.form[i] = 1
    bonds.stress[i] = 0
    bonds.thinning[i] = 0
    bonds.split[i] = 0
    bonds.polarity[i] = 0
    bonds.order[i] = 1
    bonds.piNormal[i * 3] = 0
    bonds.piNormal[i * 3 + 1] = 0
    bonds.piNormal[i * 3 + 2] = 0
  }
  // Реагентные связи: между центрами (O=O, N≡N, Cl–Cl) и внутри пар лигандов
  // (H–H, O=O). Обе неполярны — атомы одинаковые.
  let slot = 0
  if (spec.centerBond) {
    bonds.order[slot] = spec.centerBond.order
    writeHexLinear(bonds.colorA, slot, spec.centerCpk)
    writeHexLinear(bonds.colorB, slot, spec.centerCpk)
    slot += 1
  }
  for (let i = 0; i < spec.ligandPairs.length; i++) {
    bonds.order[slot] = spec.ligandBond ? spec.ligandBond.order : 1
    writeHexLinear(bonds.colorA, slot, spec.ligandCpk)
    writeHexLinear(bonds.colorB, slot, spec.ligandCpk)
    slot += 1
  }
  // Связи продукта: полярные, электронная плотность смещена к A (к центру).
  for (; slot < spec.bondCount; slot++) {
    bonds.order[slot] = spec.productOrder
    bonds.polarity[slot] = spec.productPolarity
    writeHexLinear(bonds.colorA, slot, spec.centerCpk)
    writeHexLinear(bonds.colorB, slot, spec.ligandCpk)
  }
}

// --- главный сэмплер ---------------------------------------------------------

export type EntryFrameOptions = {
  /** Общий масштаб героя (радиусы пишутся отдельно, в writeEntryStatics). */
  heroScale: number
  /** Подъём героя над центром кадра — на портретной раскладке нижняя треть отдаётся подписям. */
  liftY: number
  /** Накопленный разворот петли, радианы. */
  yaw: number
  /** Смещение схваченной молекулы, xyz × 2 (мировые единицы) или null. */
  offsets: Float32Array | null
  /** 0..1 — общее проявление сцены (первые кадры после монтирования). */
  fade: number
  /** 1 — полный разлёт; меньше — узкий кадр, реагенты подлетают ближе */
  spread: number
  /** Вещество текущей петли; по умолчанию — вода. */
  spec?: EntryScenarioSpec
}

/**
 * Пишет связь между двумя слотами атомов.
 * Погасшая связь СХЛОПЫВАЕТСЯ в точку (b = a): нулевой непрозрачности мало —
 * полосовой рендерер всё равно тянет жгут, и от развалившейся молекулы O₂
 * через весь кадр оставался пунктирный след.
 */
function writeHeroBond(
  bonds: BondPool,
  slot: number,
  o: number,
  h: number,
  formWave: number,
  opacity: number,
  grow: number,
): void {
  const ao = o * 3
  const bo = h * 3
  const so = slot * 3
  bonds.a[so] = _p[ao]!
  bonds.a[so + 1] = _p[ao + 1]!
  bonds.a[so + 2] = _p[ao + 2]!
  const dead = opacity <= 0.002
  bonds.b[so] = dead ? _p[ao]! : _p[bo]!
  bonds.b[so + 1] = dead ? _p[ao + 1]! : _p[bo + 1]!
  bonds.b[so + 2] = dead ? _p[ao + 2]! : _p[bo + 2]!
  bonds.form[slot] = formWave
  bonds.opacity[slot] = opacity
  bonds.radius[slot] = _baseBondR[slot]! * grow
}

/**
 * Кадр сценария: пишет позиции/непрозрачность/энергию атомов и связей в пулы.
 * Не создаёт ни одного объекта — все промежуточные величины живут в модульных
 * буферах, как требует шапка `cinema/core/pools.ts`.
 */
export function sampleEntryFrame(
  t: number,
  angleDeg: number,
  opt: EntryFrameOptions,
  atoms: AtomPool,
  bonds: BondPool,
): void {
  const spec = opt.spec ?? ENTRY_DEFAULT_SCENARIO
  layoutHero(t, angleDeg, opt.spread, spec)

  const product = entryProductAt(t)
  const appear = heroAppearAt(t)
  // Появление и уход идут РАЗМЕРОМ, а не только прозрачностью: у атомов-импостеров
  // полупрозрачность — это screen-door (мелкий узор точек), и долгое растворение
  // на нём читается как грязь. Поэтому непрозрачность набирается втрое быстрее
  // присутствия, а остаток пути атом доезжает, сжимаясь.
  const opacity = Math.min(1, appear * 2.6) * opt.fade
  const grow = 0.32 + 0.68 * appear
  const emissive = heroEmissiveAt(t)
  const cos = Math.cos(opt.yaw)
  const sin = Math.sin(opt.yaw)
  const s = opt.heroScale
  const off = opt.offsets

  // Разворот вокруг Y + масштаб + подъём, сразу в мировые единицы группы.
  for (let i = 0; i < spec.atomCount; i++) {
    const o = i * 3
    const lx = _p[o]!
    const ly = _p[o + 1]!
    const lz = _p[o + 2]!
    let x = (lx * cos + lz * sin) * s
    let y = ly * s + opt.liftY
    let z = (-lx * sin + lz * cos) * s
    if (off) {
      // Слоты 0..products−1 — центры; дальше лиганды по молекулам подряд.
      const m = i < spec.products ? i : ((i - spec.products) / spec.ligands) | 0
      const b = m * 3
      x += off[b]!
      y += off[b + 1]!
      z += off[b + 2]!
    }
    atoms.position[o] = x
    atoms.position[o + 1] = y
    atoms.position[o + 2] = z
    atoms.opacity[i] = opacity
    // Радиус идёт от реагентной формы к форме в продукте: Na сжимается в Na⁺,
    // Cl разбухает в Cl⁻ — перенос электрона видно без подписи.
    atoms.radius[i] = mix(_baseR0[i]!, _baseR1[i]!, product) * grow
    atoms.emissive[i] = emissive
    // Частичные заряды появляются вместе со связями продукта.
    atoms.charge[i] = (i < spec.products ? spec.chargeCenter : spec.chargeLigand) * product
  }

  // Позиции для связей берём уже пересчитанными — из пула, не из локального буфера.
  const pos = atoms.position
  for (let i = 0; i < spec.atomCount * 3; i++) _p[i] = pos[i]!

  const reagent = (1 - product) * opacity
  let slot = 0
  if (spec.centerBond) {
    writeHeroBond(bonds, slot, 0, 1, 1, reagent, grow)
    slot += 1
  }
  for (let i = 0; i < spec.ligandPairs.length; i++) {
    const pair = spec.ligandPairs[i]!
    writeHeroBond(bonds, slot, spec.products + pair[0], spec.products + pair[1], 1, reagent, grow)
    slot += 1
  }
  const made = product * opacity
  const wave = entryBondFormAt(t)
  for (let p = 0; p < spec.products; p++) {
    const base = spec.products + p * spec.ligands
    for (let k = 0; k < spec.ligands; k++) {
      writeHeroBond(bonds, slot, p, base + k, wave, made, grow)
      slot += 1
    }
  }
}

/** Мировая позиция центра молекулы продукта — по ней ставится хит-меш захвата. */
export function entryMoleculeCenter(atoms: AtomPool, molecule: 0 | 1, out: [number, number, number]): void {
  const i = molecule
  out[0] = atoms.position[i * 3]!
  out[1] = atoms.position[i * 3 + 1]!
  out[2] = atoms.position[i * 3 + 2]!
}

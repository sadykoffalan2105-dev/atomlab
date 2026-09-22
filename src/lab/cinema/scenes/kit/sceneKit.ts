/**
 * ATOMLAB Cinema — ОБЩИЙ КОНСТРУКТОР СЦЕН (ядро без React и без JSX).
 *
 * Зачем: каждая научная сцена («2 Na + Cl₂ → 2 NaCl», «C + O₂ → CO₂», …) состоит
 * из одних и тех же деталей — шаги урока, экранный хронометраж, одноразовые
 * события (cue), пулы инстансов, ореолы, волны, камера, пост-обработка.
 * Раньше это копировалось из сцены в сцену; теперь живёт здесь.
 *
 * Что берёт на себя kit:
 *   • шаги и сегменты хронометража  → defineSceneTiming()
 *   • мир сцены (пулы + состояния)  → buildSceneWorld()
 *   • дорожки-заготовки             → radiusTrack / chargeTrack / fadeTrack / holdTrack
 *   • подписи в 3D                  → sampleLabels() (см. labelDefs ниже)
 *   • контракт лаборатории          → SceneShell.tsx (embryo → birth → complete)
 *   • лестница энергии              → EnergyLadder.tsx
 *
 * ЖЁСТКОЕ ПРАВИЛО ПРОЕКТА: числа химии (радиусы, длины связей, параметры ячейки,
 * энтальпии) сцена НЕ хранит. Они приходят из `src/chemistry/data/*` через
 * cpkAtoms.ts и thermoData/crystalData. Здесь — только время, геометрия кадра
 * и механика анимации.
 */
import { useState } from 'react'
import * as THREE from 'three'
import type { Cue } from '../../core/cues'
import { createAtomPool, createBondPool, createLobePool, type AtomPool, type BondPool, type LobePool } from '../../core/pools'
import { createSafeArea, type SafeArea } from '../../core/safeArea'
import {
  createCameraRigState,
  createGlowState,
  createPostDirector,
  createPuffVolumeState,
  createWaveState,
  type CameraRigState,
  type GlowState,
  type PostDirector,
  type PuffVolumeState,
  type WaveState,
} from '../../core/states'
import { storyWallDuration, type StorySegment } from '../../core/storyTime'
import { validateTrack, windowFade, type ScalarTrack, type Window } from '../../core/tracks'
import { createEdgePool, type EdgePool } from './lattice'

// ─────────────────────────────────────────────────────────────────────────────
// 1. Шаги урока и хронометраж
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Шаг урока. `from`/`to` — время СЮЖЕТА (в нём написана раскадровка),
 * `wall` — сколько РЕАЛЬНЫХ секунд шаг идёт на экране. wall > (to − from) —
 * замедленная съёмка. На границе `to` пошаговый режим встаёт на паузу,
 * поэтому границы шагов обязаны совпадать с границами сегментов.
 */
export type SceneStep<Id extends string = string> = {
  id: Id
  from: number
  to: number
  wall: number
  ease: string
}

/** Хвост после последнего шага: затемнение и передача кадра продукту лаборатории. */
export type SceneFinish = { from: number; to: number; wall: number; ease: string }

export type SceneTiming<StepId extends string, CueId extends string> = {
  steps: readonly SceneStep<StepId>[]
  stepIds: readonly StepId[]
  finish: SceneFinish
  /** конец сюжета = finish.to */
  end: number
  segments: readonly StorySegment[]
  cues: readonly Cue<CueId>[]
  /** экранная длительность всей сцены, секунды (для watchdog и теста 26–34 с) */
  wallDuration: number
  stepIndexAt: (t: number) => number
  stepById: (id: StepId) => SceneStep<StepId>
  cueAt: (id: CueId) => number
  /** бросает, если время нарушено — зовут тест и dev-режим сцены */
  validate: () => void
}

/**
 * Собирает хронометраж сцены из шагов, хвоста и событий — и умеет себя проверить.
 *
 * Требования, которые проверяет validate():
 *   • шаги идут подряд без дыр и перекрытий, from < to, wall > 0;
 *   • хвост начинается ровно на конце последнего шага;
 *   • cue'ы лежат внутри [0, end] и идут по возрастанию;
 *   • обязательные cue лаборатории embryo → birth → complete есть и в этом порядке
 *     (иначе лаборатория зависнет, ожидая продукт).
 */
export function defineSceneTiming<StepId extends string, CueId extends string>(input: {
  steps: readonly SceneStep<StepId>[]
  finish: SceneFinish
  cues: readonly Cue<CueId>[]
}): SceneTiming<StepId, CueId> {
  const { steps, finish, cues } = input
  const segments: readonly StorySegment[] = [
    ...steps.map((s) => ({ to: s.to, wall: s.wall, ease: s.ease })),
    { to: finish.to, wall: finish.wall, ease: finish.ease },
  ]

  return {
    steps,
    stepIds: steps.map((s) => s.id),
    finish,
    end: finish.to,
    segments,
    cues,
    wallDuration: storyWallDuration(segments),
    stepIndexAt(t) {
      for (let i = 0; i < steps.length; i++) if (t <= steps[i]!.to) return i
      return steps.length - 1
    },
    stepById(id) {
      const s = steps.find((x) => x.id === id)
      if (!s) throw new Error(`[sceneKit] нет шага «${id}»`)
      return s
    },
    cueAt(id) {
      const c = cues.find((x) => x.id === id)
      if (!c) throw new Error(`[sceneKit] нет события «${id}»`)
      return c.at
    },
    validate() {
      if (steps.length === 0) throw new Error('[sceneKit] у сцены нет шагов')
      let prev = 0
      for (const s of steps) {
        if (s.from !== prev) throw new Error(`[sceneKit] шаг «${s.id}»: from=${s.from}, ожидалось ${prev}`)
        if (s.to <= s.from) throw new Error(`[sceneKit] шаг «${s.id}»: to (${s.to}) ≤ from (${s.from})`)
        if (s.wall <= 0) throw new Error(`[sceneKit] шаг «${s.id}»: wall должен быть > 0`)
        prev = s.to
      }
      if (finish.from !== prev) throw new Error(`[sceneKit] хвост начинается с ${finish.from}, а шаги кончились на ${prev}`)
      if (finish.to <= finish.from) throw new Error('[sceneKit] хвост сцены пустой')

      let last = -Infinity
      for (const c of cues) {
        if (c.at < 0 || c.at > finish.to) throw new Error(`[sceneKit] событие «${c.id}» (${c.at}) вне [0, ${finish.to}]`)
        if (c.at < last) throw new Error(`[sceneKit] события должны идти по возрастанию: «${c.id}» после ${last}`)
        last = c.at
      }
      const idx = (id: string) => cues.findIndex((c) => c.id === id)
      const e = idx('embryo')
      const b = idx('birth')
      const c = idx('complete')
      if (e < 0 || b < 0 || c < 0) {
        throw new Error('[sceneKit] контракт лаборатории: нужны события embryo, birth и complete')
      }
      if (!(e < b && b < c)) throw new Error('[sceneKit] порядок обязан быть embryo → birth → complete')
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Мир сцены: пулы инстансов и состояния эффектов
// ─────────────────────────────────────────────────────────────────────────────

export type SceneWaveSpec<Id extends string> = { id: Id; color: number; radius?: number }

/**
 * Ореол ('halo' — мягкое свечение заданного радиуса вокруг точки) или
 * вспышка ('flash' — короткий яркий блик, например выделение энергии).
 */
export type SceneGlowSpec<Id extends string> = {
  id: Id
  color: number
  radius?: number
  kind?: 'halo' | 'flash'
}

export type SceneWorld<G extends string = string, W extends string = string> = {
  atoms: AtomPool
  bonds: BondPool
  /**
   * Орбитальные лепестки: π-связи (kit/bondVisual.writeBondVisual), p-орбитали,
   * неподелённые пары. SceneShell рисует их через OrbitalLobes; пустой пул — ноль отрисовки.
   */
  lobes: LobePool
  /**
   * Рёбра элементарных ячеек (kit/lattice.writeCellEdges) — только если сцена попросила
   * buildSceneWorld({ edges }); SceneShell рисует их слоем CinemaCellEdges. Нет — слоя нет.
   */
  edges?: EdgePool
  rig: CameraRigState
  post: { current: PostDirector }
  /** ореолы и вспышки по имени; SceneShell сам рисует их как CinemaHalo/CinemaFlash */
  glows: Record<G, GlowState>
  /** те же состояния, обёрнутые в { current } — CinemaHalo принимает именно ref */
  glowRefs: Record<G, { current: GlowState }>
  /** описания ореолов — по ним SceneShell строит визуальный слой */
  glowSpecs: readonly SceneGlowSpec<G>[]
  waves: Record<W, WaveState>
  /** тёплое объёмное свечение выделяющейся энергии */
  puff: PuffVolumeState
  safe: SafeArea
  /** визуальное время кадра (дыхание атомов, плазма связей) — пишет SceneShell */
  visualTime: { current: number }
}

/**
 * Создаёт мир сцены один раз (useMemo). Никаких аллокаций в кадре после этого:
 * пулы фиксированной ёмкости, состояния эффектов переиспользуются.
 */
export function buildSceneWorld<G extends string, W extends string>(opts: {
  /** сколько атомов максимум в кадре (включая решётку) */
  atoms: number
  /** сколько связей и рёбер максимум */
  bonds: number
  /** сколько записей орбитальных лепестков максимум (π-связь = 2 записи, по одной на атом); по умолчанию 24 */
  lobes?: number
  /** ёмкость слоя рёбер ячейки (отрезков); не задано — слоя нет, старые сцены не меняются */
  edges?: number
  glows: readonly SceneGlowSpec<G>[]
  waves?: readonly SceneWaveSpec<W>[]
  /** цвет тёплого газа/свечения энергии (по умолчанию оранжевый экзо-эффект) */
  puffColor?: number
  puffSpread?: number
}): SceneWorld<G, W> {
  const glows = {} as Record<G, GlowState>
  const glowRefs = {} as Record<G, { current: GlowState }>
  for (const spec of opts.glows) {
    const g = createGlowState()
    glows[spec.id] = g
    glowRefs[spec.id] = { current: g }
  }
  const waves = {} as Record<W, WaveState>
  for (const w of opts.waves ?? []) waves[w.id] = createWaveState(w.color, w.radius ?? 1.2)

  return {
    atoms: createAtomPool(opts.atoms),
    bonds: createBondPool(opts.bonds),
    lobes: createLobePool(opts.lobes ?? 24),
    ...(opts.edges ? { edges: createEdgePool(opts.edges) } : {}),
    rig: createCameraRigState(),
    post: { current: createPostDirector() },
    glows,
    glowRefs,
    glowSpecs: opts.glows,
    waves,
    puff: createPuffVolumeState(opts.puffColor ?? 0xffa858, opts.puffSpread ?? 1.1),
    safe: createSafeArea(),
    visualTime: { current: 0 },
  }
}

/**
 * Записать ореол/вспышку кадра: центр и яркость 0…1.
 * Зовите ЭТО, а не `world.glows.x.amount = …` напрямую: правило
 * react-hooks/immutability запрещает присваивать поля значению, пришедшему
 * из хука, а вызов функции ему не мешает.
 */
export function setGlow(world: SceneWorld, id: string, center: THREE.Vector3, amount: number): void {
  const g = world.glows[id]
  if (!g) return
  g.center.copy(center)
  g.amount = amount
}

/** Записать ударную волну кадра: центр и фаза 0…1 (0 — родилась, 1 — растворилась). */
export function setWave(world: SceneWorld, id: string, center: THREE.Vector3, amount: number): void {
  const w = world.waves[id]
  if (!w) return
  w.center.copy(center)
  w.amount = amount
}

/** Тёплое объёмное свечение выделяющейся энергии: центр, плотность, подъём. */
export function setPuff(
  world: SceneWorld,
  center: THREE.Vector3,
  opacity: number,
  opts?: { spread?: number; rise?: number; turbulence?: number },
): void {
  const p = world.puff
  p.center.copy(center)
  p.opacity = opacity
  if (opts?.spread !== undefined) p.spread = opts.spread
  if (opts?.rise !== undefined) p.rise = opts.rise
  if (opts?.turbulence !== undefined) p.turbulence = opts.turbulence
}

/**
 * ДОЛГОЖИВУЩЕЕ ИЗМЕНЯЕМОЕ СОСТОЯНИЕ СЦЕНЫ — мир (пулы, ореолы, волны), буфер
 * кадра, время последних cue. Создаётся один раз на прогон и живёт до
 * размонтирования; кадр пишет в него шестьдесят раз в секунду.
 *
 * Почему отдельный хук, а не useMemo/useRef прямо в сцене:
 *   • useMemo — значение нельзя менять (react-hooks/immutability), а мы обязаны;
 *   • useRef — нельзя читать .current во время рендера (react-hooks/refs),
 *     а `world` и `labels` нужны как пропсы SceneShell.
 * Здесь же оба правила выполнены: ленивый инициализатор useState даёт
 * стабильное значение, которое React никогда не перечитывает.
 *
 * Использование:
 *   const scene = useSceneRuntime(() => ({ world: buildSceneWorld({…}), frame: createXFrame() }))
 */
export function useSceneRuntime<T extends object>(create: () => T): T {
  const [runtime] = useState(create)
  return runtime
}

/** Камера кадра: сцена пишет сюда, SceneShell применяет к ригу с учётом safe area. */
export type SceneCamera = {
  zoom: number
  offset: THREE.Vector3
  yaw: number
  /** наклон, рад (облёт решётки сверху-сбоку); 0 — прежний кадр. Дорожки — kit/camera.ts */
  pitch: number
  roll: number
  /** 0…1 — тряска на ударе; при prefers-reduced-motion оболочка её приглушает */
  shake: number
  bloom: number
  vignette: number
}

export function createSceneCamera(): SceneCamera {
  return { zoom: 1, offset: new THREE.Vector3(), yaw: 0, pitch: 0, roll: 0, shake: 0, bloom: 0.3, vignette: 0.3 }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Заготовки дорожек
// ─────────────────────────────────────────────────────────────────────────────

/** Постоянная величина на всю сцену. */
export function holdTrack(v: number): ScalarTrack {
  return [{ t: 0, v }]
}

/**
 * Плавная смена величины с `a` на `b` в окне [t0, t1].
 * Ровно этим переключается РАДИУС частицы в момент прихода электрона:
 * Na 186 пм → Na⁺ 102 пм, Cl 99 пм → Cl⁻ 181 пм.
 */
export function rampTrack(t0: number, a: number, t1: number, b: number, easeName = 'inOutSine'): ScalarTrack {
  return [
    { t: t0, v: a },
    { t: t1, v: b, ease: easeName as ScalarTrack[number]['ease'] },
  ]
}

/** Заряд частицы: 0 → q (для окраски кромки атома и подписи степени окисления). */
export function chargeTrack(t0: number, t1: number, q: number): ScalarTrack {
  return rampTrack(t0, 0, t1, q, 'smooth')
}

/** Затемнение хвоста сцены: 0 на finish.from → 1 на finish.to. */
export function fadeTrack(finish: SceneFinish): ScalarTrack {
  return rampTrack(finish.from, 0, finish.to, 1, 'inQuad')
}

/** Появление объекта: 0 → 1 за `dur` секунд от `t0`. */
export function appearTrack(t0: number, dur = 0.55): ScalarTrack {
  return rampTrack(t0, 0, t0 + dur, 1, 'smooth')
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Подписи в 3D (DOM-текст, привязанный к точке мира)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Определение подписи. `keys` — что написано, начиная с момента t (Na → Na⁺),
 * `windows` — когда подпись видна. Позиция считается сценой в sampleLabels().
 */
export type SceneLabelDef = {
  id: string
  /** стиль: species (формула), ox (степень окисления), delta (δ±, ΔH), measure (размер: пм, a), token */
  kind: 'species' | 'ox' | 'delta' | 'measure' | 'token'
  /** смещение по Y от края якоря: > 0 — над, < 0 — под */
  dy: number
  keys: readonly { t: number; text: string }[]
  windows: readonly Window[]
}

export type SceneLabelState = {
  id: string
  kind: string
  pos: THREE.Vector3
  opacity: number
  text: string
}

export function createLabelStates(defs: readonly SceneLabelDef[]): SceneLabelState[] {
  return defs.map((d) => ({ id: d.id, kind: d.kind, pos: new THREE.Vector3(), opacity: 0, text: d.keys[0]!.text }))
}

export function labelTextAt(def: SceneLabelDef, t: number): string {
  let text = def.keys[0]!.text
  for (const k of def.keys) if (t >= k.t) text = k.text
  return text
}

export function labelOpacityAt(def: SceneLabelDef, t: number, fade = 0.25): number {
  let o = 0
  for (const w of def.windows) o = Math.max(o, windowFade(w, t, fade))
  return o
}

/**
 * Обновляет текст и прозрачность всех подписей. ПОЗИЦИЮ ставит сцена через
 * `anchor(def, state)` — только она знает, к какому атому подпись привязана.
 */
export function sampleLabels(
  defs: readonly SceneLabelDef[],
  states: SceneLabelState[],
  t: number,
  anchor: (def: SceneLabelDef, state: SceneLabelState) => void,
  globalFade = 0,
): void {
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i]!
    const st = states[i]!
    st.text = labelTextAt(def, t)
    anchor(def, st)
    st.opacity = labelOpacityAt(def, t) * (1 - globalFade)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4b. Локализация подписей: агрегатные состояния и единицы
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Язык 3D-подписей (решение владельца проекта): в 3D только формулы, заряды,
 * числа и символы единиц — в соглашении учебника текущего языка (ru: «пм»,
 * «кДж/моль», «г.»; en: pm, kJ/mol, g). Никаких фраз в 3D — слова живут в панели урока.
 * Раскадровка остаётся ЧИСТОЙ и не знает про локаль: она
 * пишет в текст подписи токены `{s}`, `{g}`, `{l}`, `{aq}`, `{pm}`, `{kJmol}`,
 * `{kJ}`, `{nm}`, а сцена один раз за кадр зовёт `localizeSceneLabels()`.
 */
export type SceneLocale = 'ru' | 'en' | 'uz'

/**
 * Словарь токенов подписей. Формулы (NaCl, Cl₂) НЕ переводятся — они
 * интернациональны; переводятся только состояния вещества и единицы.
 */
export const SCENE_LABEL_TOKENS: Readonly<Record<SceneLocale, Readonly<Record<string, string>>>> = {
  // cn — координационное число, символ учебника: ru «КЧ», en «CN», uz «KS» (koordinatsion son)
  ru: { s: 'тв.', g: 'г.', l: 'ж.', aq: 'р-р', pm: 'пм', nm: 'нм', kJmol: 'кДж/моль', kJ: 'кДж', cn: 'КЧ' },
  en: { s: 's', g: 'g', l: 'l', aq: 'aq', pm: 'pm', nm: 'nm', kJmol: 'kJ/mol', kJ: 'kJ', cn: 'CN' },
  uz: { s: 'qat.', g: 'gaz', l: 'suyuq.', aq: 'eritma', pm: 'pm', nm: 'nm', kJmol: 'kJ/mol', kJ: 'kJ', cn: 'KS' },
}

/** Нормализует код языка приложения к языку сцены. */
export function toSceneLocale(locale: string | null | undefined): SceneLocale {
  if (locale === 'en') return 'en'
  if (locale === 'uz') return 'uz'
  return 'ru'
}

const TOKEN_RE = /\{(\w+)\}/g
/**
 * Кэш «сырой текст → готовая строка» — отдельная карта на каждую локаль:
 * поиск по самой строке подписи, без склейки ключа (ноль аллокаций в кадре).
 */
const labelCache: Readonly<Record<SceneLocale, Map<string, string>>> = { ru: new Map(), en: new Map(), uz: new Map() }

/** Подставляет токены в одну строку (с кэшем, без аллокаций на повторах). */
export function localizeLabelText(text: string, locale: SceneLocale, decimalComma = false): string {
  const comma = decimalComma && locale !== 'en'
  if (!comma && text.indexOf('{') < 0) return text
  const cache = (comma ? labelCacheComma : labelCache)[locale] ?? labelCache.ru
  const hit = cache.get(text)
  if (hit !== undefined) return hit
  const dict = SCENE_LABEL_TOKENS[locale]
  let out = text.indexOf('{') < 0 ? text : text.replace(TOKEN_RE, (whole, name: string) => dict[name] ?? whole)
  // ru/uz: десятичная запятая, как в панели урока (решение 8: числа в 3D — по локали). Включает сцена:
  // у части старых сцен тесты ещё ждут точку, их переводит владелец сцены.
  if (comma) out = out.replace(DECIMAL_RE, '$1,$2')
  cache.set(text, out)
  return out
}

/** Кэш строк с десятичной запятой (отдельно: одна и та же сырая строка даёт разный результат). */
const labelCacheComma: Readonly<Record<SceneLocale, Map<string, string>>> = { ru: new Map(), en: new Map(), uz: new Map() }

/** Десятичная точка между цифрами: «236.1» → «236,1» (ru/uz). Обозначения вроде «Fm-3m» не задевает. */
const DECIMAL_RE = /(\d)\.(\d)/g

/**
 * Переводит подписи НА МЕСТЕ — вызывать в onFrame сразу после sampleFrame(),
 * иначе React-массив подписей заморозится (SceneShell мутирует его каждый кадр).
 */
export function localizeSceneLabels(states: SceneLabelState[], locale: SceneLocale, decimalComma = false): void {
  for (let i = 0; i < states.length; i++) {
    const st = states[i]!
    st.text = localizeLabelText(st.text, locale, decimalComma)
  }
}

/** Все токены, встречающиеся в подписях, — для теста сцены. */
export function labelTokensUsed(defs: readonly SceneLabelDef[]): string[] {
  const out = new Set<string>()
  for (const d of defs) {
    for (const k of d.keys) {
      for (const m of k.text.matchAll(TOKEN_RE)) out.add(m[1]!)
    }
  }
  return [...out]
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Проверки раскадровки (зовёт тест сцены и dev-режим)
// ─────────────────────────────────────────────────────────────────────────────

/** Проверяет монотонность набора дорожек разом. */
export function validateTracks(tracks: Readonly<Record<string, ReadonlyArray<{ t: number }>>>): void {
  for (const [name, track] of Object.entries(tracks)) validateTrack(name, track)
}

/**
 * Кадр не должен «щёлкать»: между двумя соседними выборками 1/30 с видимый атом
 * не может прыгнуть дальше `maxJump` мировых единиц. Сцена передаёт функцию,
 * которая на момент t отдаёт позиции и прозрачности видимых частиц.
 */
export function assertNoPositionJumps(
  sampleAt: (t: number) => ReadonlyArray<{ id: string; pos: THREE.Vector3; opacity: number }>,
  endT: number,
  maxJump = 0.09,
  dt = 1 / 30,
): void {
  const prev = new Map<string, THREE.Vector3>()
  for (let t = 0; t <= endT + 1e-9; t += dt) {
    const parts = sampleAt(t)
    for (const p of parts) {
      const was = prev.get(p.id)
      if (was && p.opacity > 0.02) {
        const d = was.distanceTo(p.pos)
        if (d > maxJump) {
          throw new Error(`[sceneKit] «${p.id}» прыгнул на ${d.toFixed(3)} ед. за кадр при t=${t.toFixed(2)} (предел ${maxJump})`)
        }
      }
      prev.set(p.id, (was ?? new THREE.Vector3()).copy(p.pos))
    }
  }
}

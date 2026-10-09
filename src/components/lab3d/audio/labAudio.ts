/**
 * Звук 3D-лаборатории: процедурный WebAudio — без звуковых файлов и без сети. Каждый звук собирается из шума
 * и простых генераторов (стекло — короткие затухающие обертоны, дверца — скрип и глухой стук, переливание —
 * «бульканье» полосового шума, пламя — низкий шум с дрожанием и т. д.).
 *
 *  • пространственность: PannerNode в точке события, слушатель — камера (обновляется каждый кадр);
 *  • политика автозапуска: контекст создаётся только после первого действия пользователя (нажатие/клавиша);
 *  • «Звук вкл/выкл» и громкость запоминаются в localStorage (в приватном окне — просто по умолчанию);
 *  • фон: тихий дальний шум комнаты, гул вентилятора вытяжки, пока она включена.
 */

export const LAB_SOUND_NAMES = [
  'glass-place',
  'glass-clink',
  'pour',
  'fizz',
  'bubble',
  'flame-on',
  'flame-loop',
  'pop',
  'door-open',
  'door-close',
  'drawer',
  'click',
  'hood-fan',
  'splash',
  'sizzle',
  'success',
  'error',
] as const
export type LabSoundName = (typeof LAB_SOUND_NAMES)[number]

/** Материал, о который стучит предмет, когда его ставят: меняет тембр «стекло о стол». */
export type LabSoundMaterial = 'glass' | 'plastic' | 'metal' | 'porcelain' | 'wood'

export interface LabPlayOptions {
  readonly at?: readonly [number, number, number]
  readonly gain?: number
  readonly material?: LabSoundMaterial
}

interface Prefs {
  on: boolean
  volume: number
}
const PREFS_KEY = 'atomlab.lab3d.sound'

function loadPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<Prefs>
      return { on: p.on !== false, volume: typeof p.volume === 'number' ? Math.min(1, Math.max(0, p.volume)) : 0.7 }
    }
  } catch {
    /* хранилище недоступно — по умолчанию */
  }
  return { on: true, volume: 0.7 }
}
function savePrefs(p: Prefs) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    /* приватный режим — не запоминаем */
  }
}

type Ctx = AudioContext
let ctx: Ctx | null = null
let master: GainNode | null = null
let noise: AudioBuffer | null = null
let prefs: Prefs = typeof window === 'undefined' ? { on: true, volume: 0.7 } : loadPrefs()
let unlocked = false
let fanOn = false
let fan: { src: AudioBufferSourceNode; gain: GainNode } | null = null
let ambience: { src: AudioBufferSourceNode; gain: GainNode } | null = null
const listeners = new Set<() => void>()
let snapshot = { on: prefs.on, volume: prefs.volume, unlocked, fanOn }

function notify() {
  snapshot = { on: prefs.on, volume: prefs.volume, unlocked, fanOn }
  for (const l of listeners) l()
}

function ensureCtx(): Ctx | null {
  if (ctx) return ctx
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  try {
    ctx = new AC({ latencyHint: 'interactive' })
  } catch {
    return null
  }
  master = ctx.createGain()
  master.gain.value = prefs.on ? prefs.volume : 0
  master.connect(ctx.destination)
  // Белый шум на 2 с — общий источник для всех «шумовых» звуков
  const len = ctx.sampleRate * 2
  noise = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = noise.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return ctx
}

/** Выход звука: пространственный (в точке at) или обычный. */
function out(c: Ctx, at?: readonly [number, number, number]): AudioNode {
  if (!master) return c.destination
  if (!at) return master
  const p = c.createPanner()
  p.panningModel = 'equalpower'
  p.distanceModel = 'inverse'
  p.refDistance = 0.8
  p.maxDistance = 12
  p.rolloffFactor = 0.9
  if (p.positionX) {
    p.positionX.value = at[0]
    p.positionY.value = at[1]
    p.positionZ.value = at[2]
  } else {
    p.setPosition(at[0], at[1], at[2])
  }
  p.connect(master)
  return p
}

function env(c: Ctx, dest: AudioNode, t0: number, peak: number, attack: number, decay: number): GainNode {
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.linearRampToValueAtTime(peak, t0 + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay)
  g.connect(dest)
  return g
}

function tone(c: Ctx, dest: AudioNode, t0: number, freq: number, peak: number, decay: number, type: OscillatorType = 'sine', attack = 0.003, glideTo?: number) {
  const o = c.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + attack + decay)
  o.connect(env(c, dest, t0, peak, attack, decay))
  o.start(t0)
  o.stop(t0 + attack + decay + 0.05)
}

function noiseBurst(
  c: Ctx,
  dest: AudioNode,
  t0: number,
  opts: { type: BiquadFilterType; freq: number; q?: number; peak: number; attack: number; decay: number; freqTo?: number },
) {
  if (!noise) return
  const s = c.createBufferSource()
  s.buffer = noise
  s.loop = true
  const f = c.createBiquadFilter()
  f.type = opts.type
  f.frequency.setValueAtTime(opts.freq, t0)
  if (opts.freqTo) f.frequency.exponentialRampToValueAtTime(opts.freqTo, t0 + opts.attack + opts.decay)
  f.Q.value = opts.q ?? 0.8
  s.connect(f)
  f.connect(env(c, dest, t0, opts.peak, opts.attack, opts.decay))
  s.start(t0, Math.random() * 1.5)
  s.stop(t0 + opts.attack + opts.decay + 0.05)
}

/** Стук предмета о стол: тембр по материалу. */
function placeSound(c: Ctx, dest: AudioNode, t: number, material: LabSoundMaterial, k: number) {
  switch (material) {
    case 'glass':
      noiseBurst(c, dest, t, { type: 'lowpass', freq: 900, peak: 0.25 * k, attack: 0.001, decay: 0.03 })
      ;[2630, 4110, 5870].forEach((f, i) => tone(c, dest, t, f * (0.97 + Math.random() * 0.06), (0.09 / (i + 1)) * k, 0.18 - i * 0.04))
      break
    case 'porcelain':
      noiseBurst(c, dest, t, { type: 'lowpass', freq: 1200, peak: 0.3 * k, attack: 0.001, decay: 0.035 })
      ;[1650, 3320].forEach((f, i) => tone(c, dest, t, f, (0.08 / (i + 1)) * k, 0.12))
      break
    case 'metal':
      noiseBurst(c, dest, t, { type: 'bandpass', freq: 2500, q: 2, peak: 0.2 * k, attack: 0.001, decay: 0.03 })
      ;[930, 2470, 3900].forEach((f, i) => tone(c, dest, t, f, (0.07 / (i + 1)) * k, 0.35))
      break
    case 'wood':
      noiseBurst(c, dest, t, { type: 'bandpass', freq: 650, q: 1.4, peak: 0.35 * k, attack: 0.001, decay: 0.05 })
      break
    case 'plastic':
    default:
      noiseBurst(c, dest, t, { type: 'lowpass', freq: 700, peak: 0.32 * k, attack: 0.001, decay: 0.045 })
      tone(c, dest, t, 210, 0.12 * k, 0.06)
  }
}

function synth(name: LabSoundName, o: LabPlayOptions) {
  const c = ensureCtx()
  if (!c || !unlocked || !prefs.on) return
  const dest = out(c, o.at)
  const k = o.gain ?? 1
  const t = c.currentTime + 0.005
  switch (name) {
    case 'glass-place':
      placeSound(c, dest, t, o.material ?? 'glass', k)
      break
    case 'glass-clink':
      ;[3150, 4820].forEach((f, i) => tone(c, dest, t, f * (0.96 + Math.random() * 0.08), (0.06 / (i + 1)) * k, 0.16))
      break
    case 'pour': {
      // Струя (шум) + «бульканье»: полосовой шум, частота которого скачет
      noiseBurst(c, dest, t, { type: 'bandpass', freq: 1800, q: 0.7, peak: 0.12 * k, attack: 0.08, decay: 1.4 })
      for (let i = 0; i < 9; i++) {
        const tt = t + 0.1 + i * 0.14 + Math.random() * 0.06
        tone(c, dest, tt, 380 + Math.random() * 300, 0.05 * k, 0.07, 'sine', 0.004, 900 + Math.random() * 500)
      }
      break
    }
    case 'fizz':
      for (let i = 0; i < 26; i++) {
        noiseBurst(c, dest, t + Math.random() * 1.6, { type: 'highpass', freq: 3500 + Math.random() * 3000, peak: 0.05 * k, attack: 0.001, decay: 0.02 })
      }
      noiseBurst(c, dest, t, { type: 'highpass', freq: 5000, peak: 0.05 * k, attack: 0.1, decay: 1.6 })
      break
    case 'bubble':
      for (let i = 0; i < 8; i++) {
        tone(c, dest, t + i * 0.11 + Math.random() * 0.05, 260 + Math.random() * 220, 0.07 * k, 0.06, 'sine', 0.003, 700 + Math.random() * 400)
      }
      break
    case 'flame-on':
      noiseBurst(c, dest, t, { type: 'lowpass', freq: 180, freqTo: 1400, peak: 0.3 * k, attack: 0.06, decay: 0.55 })
      break
    case 'flame-loop': {
      // Ровное пламя ~3 с: низкий шум с дрожанием
      noiseBurst(c, dest, t, { type: 'lowpass', freq: 420, q: 0.5, peak: 0.12 * k, attack: 0.3, decay: 2.8 })
      noiseBurst(c, dest, t, { type: 'bandpass', freq: 160, q: 1, peak: 0.1 * k, attack: 0.3, decay: 2.8 })
      break
    }
    case 'pop':
      // Хлопок водорода: короткий удар шума и низкий «бум»
      noiseBurst(c, dest, t, { type: 'lowpass', freq: 2600, freqTo: 300, peak: 0.6 * k, attack: 0.001, decay: 0.12 })
      tone(c, dest, t, 140, 0.4 * k, 0.16, 'sine', 0.002, 60)
      break
    case 'door-open':
      // Тихий скрип петли и щелчок защёлки
      noiseBurst(c, dest, t, { type: 'bandpass', freq: 2200, q: 3, peak: 0.08 * k, attack: 0.001, decay: 0.025 })
      tone(c, dest, t + 0.03, 520, 0.025 * k, 0.28, 'sawtooth', 0.05, 430)
      break
    case 'door-close':
      // Мягкий стук доводчика: глухой удар и щелчок
      noiseBurst(c, dest, t, { type: 'lowpass', freq: 420, peak: 0.45 * k, attack: 0.002, decay: 0.09 })
      tone(c, dest, t, 95, 0.25 * k, 0.12, 'sine', 0.002, 70)
      noiseBurst(c, dest, t + 0.012, { type: 'bandpass', freq: 2600, q: 3, peak: 0.07 * k, attack: 0.001, decay: 0.02 })
      break
    case 'drawer':
      // Ящик на роликах: шуршание и мягкий упор
      noiseBurst(c, dest, t, { type: 'bandpass', freq: 520, q: 1.2, peak: 0.12 * k, attack: 0.05, decay: 0.3 })
      noiseBurst(c, dest, t + 0.32, { type: 'lowpass', freq: 500, peak: 0.25 * k, attack: 0.002, decay: 0.06 })
      break
    case 'click':
      // Щелчок пьезоподжига / тумблера
      noiseBurst(c, dest, t, { type: 'highpass', freq: 2500, peak: 0.25 * k, attack: 0.0005, decay: 0.012 })
      tone(c, dest, t, 1900, 0.06 * k, 0.02, 'square')
      break
    case 'hood-fan':
      setFan(k > 0)
      break
    case 'splash':
      noiseBurst(c, dest, t, { type: 'bandpass', freq: 900, q: 0.8, peak: 0.3 * k, attack: 0.004, decay: 0.25 })
      for (let i = 0; i < 4; i++) tone(c, dest, t + 0.15 + i * 0.09, 900 + Math.random() * 600, 0.035 * k, 0.05, 'sine', 0.002, 1800)
      break
    case 'sizzle':
      for (let i = 0; i < 40; i++) {
        noiseBurst(c, dest, t + Math.random() * 1.2, { type: 'highpass', freq: 2800 + Math.random() * 2500, peak: 0.07 * k, attack: 0.001, decay: 0.015 })
      }
      noiseBurst(c, dest, t, { type: 'bandpass', freq: 3800, q: 0.6, peak: 0.06 * k, attack: 0.05, decay: 1.2 })
      break
    case 'success':
      ;[523.25, 659.25, 783.99].forEach((f, i) => tone(c, dest, t + i * 0.09, f, 0.08 * k, 0.35))
      break
    case 'error':
      tone(c, dest, t, 220, 0.06 * k, 0.12, 'triangle')
      tone(c, dest, t + 0.14, 175, 0.06 * k, 0.16, 'triangle')
      break
  }
}

/** Петля (вентилятор/фон): шум через фильтр, громкость плавно. */
function startLoop(c: Ctx, freq: number, q: number, level: number): { src: AudioBufferSourceNode; gain: GainNode } | null {
  if (!noise || !master) return null
  const src = c.createBufferSource()
  src.buffer = noise
  src.loop = true
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = freq
  f.Q.value = q
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, c.currentTime)
  g.gain.linearRampToValueAtTime(level, c.currentTime + 1.2)
  src.connect(f)
  f.connect(g)
  g.connect(master)
  src.start()
  return { src, gain: g }
}
function stopLoop(c: Ctx, l: { src: AudioBufferSourceNode; gain: GainNode }) {
  l.gain.gain.cancelScheduledValues(c.currentTime)
  l.gain.gain.setValueAtTime(l.gain.gain.value, c.currentTime)
  l.gain.gain.linearRampToValueAtTime(0.0001, c.currentTime + 0.8)
  l.src.stop(c.currentTime + 0.9)
}

function setFan(on: boolean) {
  fanOn = on
  const c = ctx
  if (c && unlocked) {
    if (on && !fan) fan = startLoop(c, 260, 0.6, 0.11)
    if (!on && fan) {
      stopLoop(c, fan)
      fan = null
    }
  }
  notify()
}

function startAmbience() {
  const c = ctx
  if (!c || ambience) return
  ambience = startLoop(c, 140, 0.3, 0.035)
  if (fanOn && !fan) fan = startLoop(c, 260, 0.6, 0.11)
}

export const labAudio = {
  /** Проиграть звук (если звук включён и пользователь уже взаимодействовал со страницей). */
  play(name: LabSoundName | string, o: LabPlayOptions = {}) {
    if (!(LAB_SOUND_NAMES as readonly string[]).includes(name)) return
    try {
      synth(name as LabSoundName, o)
    } catch {
      /* звук не важнее опыта */
    }
  },
  /** Вентилятор вытяжки: гул, пока включён. */
  setFan,
  /** Слушатель = камера: позиция и направление взгляда. */
  setListener(px: number, py: number, pz: number, fx: number, fy: number, fz: number) {
    const c = ctx
    if (!c) return
    const l = c.listener
    if (l.positionX) {
      const t = c.currentTime
      l.positionX.setTargetAtTime(px, t, 0.03)
      l.positionY.setTargetAtTime(py, t, 0.03)
      l.positionZ.setTargetAtTime(pz, t, 0.03)
      l.forwardX.setTargetAtTime(fx, t, 0.03)
      l.forwardY.setTargetAtTime(fy, t, 0.03)
      l.forwardZ.setTargetAtTime(fz, t, 0.03)
      l.upX.value = 0
      l.upY.value = 1
      l.upZ.value = 0
    } else {
      l.setPosition(px, py, pz)
      l.setOrientation(fx, fy, fz, 0, 1, 0)
    }
  },
  /**
   * Разблокировка после первого действия пользователя (политика автозапуска браузера).
   * Возвращает отписку для useEffect.
   */
  /** Разблокировать сразу: вход в VR (нажатие кнопки / select контроллера — жест пользователя, а pointerdown в шлеме нет). */
  unlockNow(): void {
    const c = ensureCtx()
    if (!c) return
    void c.resume().catch(() => {})
    if (!unlocked) {
      unlocked = true
      startAmbience()
      notify()
    }
  },
  attachUnlock(): () => void {
    if (typeof window === 'undefined') return () => {}
    const unlock = () => {
      const c = ensureCtx()
      if (!c) return
      void c.resume().catch(() => {})
      if (!unlocked) {
        unlocked = true
        startAmbience()
        notify()
      }
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
    }
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)
    return () => {
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
    }
  },
  setEnabled(on: boolean) {
    prefs = { ...prefs, on }
    savePrefs(prefs)
    if (ctx && master) master.gain.setTargetAtTime(on ? prefs.volume : 0, ctx.currentTime, 0.05)
    notify()
  },
  setVolume(v: number) {
    prefs = { ...prefs, volume: Math.min(1, Math.max(0, v)) }
    savePrefs(prefs)
    if (ctx && master && prefs.on) master.gain.setTargetAtTime(prefs.volume, ctx.currentTime, 0.05)
    notify()
  },
  /** Для useSyncExternalStore. */
  subscribe(cb: () => void) {
    listeners.add(cb)
    return () => {
      listeners.delete(cb)
    }
  },
  getSnapshot() {
    return snapshot
  },
  /** Уход со страницы: тишина и освобождение звуковой карты. */
  suspend() {
    if (!ctx) return
    if (fan) stopLoop(ctx, fan)
    if (ambience) stopLoop(ctx, ambience)
    fan = null
    ambience = null
    fanOn = false
    const c = ctx
    // Если за это время вернулись на страницу и звук снова разблокирован — не глушим его
    window.setTimeout(() => {
      if (!unlocked) void c.suspend().catch(() => {})
    }, 950)
    unlocked = false
    notify()
  },
  /**
   * Вкладка скрыта/видна: в фоне — тишина (гул вытяжки, пламя, фон комнаты не звучат), при возврате — продолжается.
   * Возвращает отписку для useEffect.
   */
  attachVisibility(): () => void {
    if (typeof document === 'undefined') return () => {}
    const onVis = () => {
      const c = ctx
      if (!c || !unlocked) return
      if (document.hidden) void c.suspend().catch(() => {})
      else void c.resume().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  },
}

/** Сериализация GPU-compile — одна задача за раз, без storm на слабых GPU. */
import { WebGLRenderer } from 'three'

type GpuCompileJob = {
  id: string
  priority: number
  start: (release: () => void) => () => void
}

/**
 * Страховка от зависшей задачи: если compile не отчитался за это время,
 * бюджет отменяет его и пускает очередь дальше. Без неё одна застрявшая
 * idle-прогревалка блокировала приоритетный compile видимого продукта —
 * и первый кадр урока компилировал шейдеры синхронно (кадр под 900 мс).
 */
const JOB_STALL_MS = 4_000
/** Видимому продукту даём больше: его chunked-compile длиннее и прерывать его дороже. */
const JOB_STALL_VISIBLE_MS = 8_000

let activeId: string | null = null
let activeCancel: (() => void) | null = null
let activePriority = 0
let stallTimer: ReturnType<typeof setTimeout> | null = null
const queue: GpuCompileJob[] = []

function clearStallTimer(): void {
  if (stallTimer != null) {
    clearTimeout(stallTimer)
    stallTimer = null
  }
}

function releaseActive(): void {
  clearStallTimer()
  activeId = null
  activeCancel = null
  activePriority = 0
  pumpQueue()
}

/** Защита от рекурсии: синхронный release внутри start не должен уходить в стек. */
let pumping = false

function pumpQueue(): void {
  if (pumping) return
  pumping = true
  try {
    while (activeId == null && queue.length > 0) {
      queue.sort((a, b) => b.priority - a.priority)
      const job = queue.shift()
      if (!job) return
      activeId = job.id
      activeCancel = null
      activePriority = job.priority
      let released = false
      const release = () => {
        if (released) return
        released = true
        if (activeId === job.id) releaseActive()
      }
      let cancel: (() => void) | undefined
      try {
        cancel = job.start(release)
      } catch {
        // Упавший compile не имеет права держать бюджет.
        release()
      }
      // Если задача освободилась синхронно (отменённая/мгновенная), activeId уже
      // сброшен — её cancel в activeCancel писать нельзя, иначе бюджет зависнет
      // на чужом no-op и прогрев больше никогда не стартует. Цикл берёт следующую.
      if (released) continue
      activeCancel = cancel ?? null
      clearStallTimer()
      stallTimer = setTimeout(() => {
        stallTimer = null
        if (activeId !== job.id) return
        const stuck = activeCancel
        activeCancel = null
        try {
          stuck?.()
        } catch {
          /* ignore */
        }
        if (activeId === job.id) releaseActive()
      }, job.priority >= 1 ? JOB_STALL_VISIBLE_MS : JOB_STALL_MS)
      return
    }
  } finally {
    pumping = false
  }
}

/**
 * @param priority 1 = активный синтез, 0 = idle prewarm/queue
 * @returns cancel — отмена задачи
 */
export function enqueueGpuCompile(
  id: string,
  start: (release: () => void) => () => void,
  priority: 0 | 1 = 0,
): () => void {
  let cancelled = false
  const job: GpuCompileJob = {
    id,
    priority,
    start: (release) => {
      if (cancelled) {
        release()
        return () => {}
      }
      const innerCancel = start(release)
      return () => {
        innerCancel?.()
        release()
      }
    },
  }

  const idx = queue.findIndex((j) => j.id === id)
  if (idx >= 0) queue.splice(idx, 1)
  queue.push(job)

  // Вытеснение: видимому продукту нельзя ждать idle-прогрев чужого вещества,
  // иначе его шейдеры компилируются прямо в первом кадре сцены.
  if (priority === 1 && activeId != null && activeId !== id && activePriority === 0) {
    const preempted = activeCancel
    activeCancel = null
    try {
      preempted?.()
    } catch {
      /* ignore */
    }
    if (activeId != null && activePriority === 0) releaseActive()
  }

  pumpQueue()

  return () => {
    cancelled = true
    const qIdx = queue.findIndex((j) => j.id === id)
    if (qIdx >= 0) queue.splice(qIdx, 1)
    if (activeId === id) {
      activeCancel?.()
    }
  }
}

/** Минимум от WebGLRenderer, который нужен политике отладки шейдеров. */
type ShaderDebugCapableRenderer = { debug?: { checkShaderErrors?: boolean } }

/**
 * Прод-политика отладки шейдеров — лечит провал fps на первом шаге урока.
 *
 * После линковки программы three спрашивает getProgramInfoLog / LINK_STATUS,
 * а это синхронное ожидание драйвера: CPU-профиль холодного старта
 * (.smoke/qa/coldstart-profile.mjs, caco3-decomp) дал 589 мс в getProgramInfoLog
 * и кадры по 733 мс — ученик видит это как зависание. В прод-сборке лог
 * компиляции всё равно никто не читает, поэтому гасим проверку один раз
 * на рендерер. A/B (.smoke/qa/coldstart-ab.mjs): худший кадр 733 → 283 мс.
 *
 * В dev не трогаем — там ошибки шейдеров должны падать громко.
 */
export function applyProdShaderDebugPolicy(gl: ShaderDebugCapableRenderer | null | undefined): void {
  if (!import.meta.env.PROD) return
  if (!gl?.debug) return
  if (gl.debug.checkShaderErrors === false) return
  gl.debug.checkShaderErrors = false
}

/**
 * Та же политика, но без доступа к рендереру: Canvas создаёт WebGLRenderer сам,
 * внутри чужого файла сцены, и передать его сюда неоткуда. Ставим один раз
 * при загрузке модуля аксессор на прототип: конструктор three присваивает
 * `this.debug = { checkShaderErrors: true, ... }`, присваивание проходит через
 * наш сеттер, тот гасит флаг и кладёт объект уже собственным свойством
 * экземпляра — дальше прототип не участвует.
 *
 * Замер (.smoke/qa/shader-stall-count.mjs, прод-сборка): на первом шаге урока
 * страница проводила 1.3 с в getProgramInfoLog — это и есть «зависание»
 * холодного старта. В прод-сборке лог компиляции всё равно никто не читает.
 * В dev не трогаем: там ошибки шейдеров должны падать громко.
 */
function installProdShaderDebugPolicy(): void {
  if (!import.meta.env.PROD) return
  try {
    const proto = (WebGLRenderer as unknown as { prototype: object }).prototype
    if (!proto) return
    if (Object.getOwnPropertyDescriptor(proto, 'debug')) return
    Object.defineProperty(proto, 'debug', {
      configurable: true,
      enumerable: false,
      get(): unknown {
        return undefined
      },
      set(this: object, value: unknown): void {
        if (value && typeof value === 'object') {
          ;(value as { checkShaderErrors?: boolean }).checkShaderErrors = false
        }
        Object.defineProperty(this, 'debug', {
          value,
          writable: true,
          configurable: true,
          enumerable: true,
        })
      },
    })
  } catch {
    /* прототип защищён — работаем как раньше */
  }
}

installProdShaderDebugPolicy()

export function isGpuCompileActive(id?: string): boolean {
  if (id != null) return activeId === id
  return activeId != null
}

export function clearGpuCompileQueue(): void {
  queue.length = 0
  clearStallTimer()
  if (activeId != null) {
    const cancel = activeCancel
    activeCancel = null
    activeId = null
    activePriority = 0
    try {
      cancel?.()
    } catch {
      /* ignore */
    }
  }
}

/** Сериализация GPU-compile — одна задача за раз, без storm на слабых GPU. */

type GpuCompileJob = {
  id: string
  priority: number
  start: (release: () => void) => () => void
}

let activeId: string | null = null
let activeCancel: (() => void) | null = null
const queue: GpuCompileJob[] = []

function releaseActive(): void {
  activeId = null
  activeCancel = null
  pumpQueue()
}

function pumpQueue(): void {
  if (activeId != null || queue.length === 0) return
  queue.sort((a, b) => b.priority - a.priority)
  const job = queue.shift()
  if (!job) return
  activeId = job.id
  let released = false
  const release = () => {
    if (released) return
    released = true
    if (activeId === job.id) releaseActive()
  }
  activeCancel = job.start(release)
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

export function isGpuCompileActive(id?: string): boolean {
  if (id != null) return activeId === id
  return activeId != null
}

export function clearGpuCompileQueue(): void {
  queue.length = 0
  if (activeId != null) {
    activeCancel?.()
    activeId = null
    activeCancel = null
  }
}

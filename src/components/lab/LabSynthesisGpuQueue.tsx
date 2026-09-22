import { useEffect, useMemo, useRef, useState } from 'react'
import type { CompoundDef } from '../../types/chemistry'
import { GPU_COMPILE_QUEUE_GAP_MS } from '../../lab/synthesisHangGuard'
import { isProductGpuCompiled } from '../../lab/productGpuCompileCache'
import { LabProductHeroSlot } from './LabProductHeroSlot'

/**
 * Страховка от молчащего слота: если прогрев не отчитался за это время,
 * очередь идёт дальше. Бюджет compile снимает зависшую задачу за 4 с,
 * но onGpuCompiled при этом может не прийти — без сторожа очередь вставала
 * навсегда на одном веществе.
 */
const QUEUE_STALL_MS = 12_000

function buildQueueCompounds(
  compounds: readonly CompoundDef[],
  priorityCompound: CompoundDef | null | undefined,
): CompoundDef[] {
  const out: CompoundDef[] = []
  const seen = new Set<string>()
  if (priorityCompound && !seen.has(priorityCompound.id)) {
    out.push(priorityCompound)
    seen.add(priorityCompound.id)
  }
  for (const c of compounds) {
    if (!seen.has(c.id)) {
      out.push(c)
      seen.add(c.id)
    }
  }
  return out
}

/**
 * Фоновая очередь GPU-compile (idle, один за раз, micro-scale).
 * Не влияет на continuity — отдельный скрытый слот, первый синтез без hitch.
 *
 * Очередь конечна по построению: вещество выбирается сканированием списка,
 * а не счётчиком в состоянии. Пропускаем прогретые (session-кэш) и уже взятые
 * в работу в этом монтировании; пустой результат — рендерим null и стоим.
 * Раньше эффект двигал useState-индекс на каждом пропуске, а на полностью
 * прогретой очереди условия выхода не было: состояние дёргалось бесконечно
 * («Maximum update depth exceeded» в dev, холостой пережёг CPU и remount
 * скрытого 3D-слота на каждом витке в прод-сборке).
 */
export function LabSynthesisGpuQueue({
  compounds,
  priorityCompound = null,
  active,
}: {
  compounds: readonly CompoundDef[]
  priorityCompound?: CompoundDef | null
  active: boolean
}) {
  const queueCompounds = useMemo(
    () => buildQueueCompounds(compounds, priorityCompound),
    [compounds, priorityCompound],
  )
  /** Вещества, для которых прогрев в этом монтировании уже запускался (успешно или нет). */
  const attemptedIdsRef = useRef<Set<string>>(new Set())
  const advanceTimerRef = useRef<number | null>(null)
  const stallTimerRef = useRef<number | null>(null)
  const priorityIdRef = useRef<string | null>(null)
  /** Единственный «тик» очереди: растёт только после завершённого (или сорванного) прогрева. */
  const [queueTick, setQueueTick] = useState(0)

  // Новый приоритет (продукт, на который навели) обязан попасть в работу ещё раз,
  // даже если его уже пробовали. Тик здесь зависит от входа, а не от собственного
  // результата, поэтому цикла не даёт.
  useEffect(() => {
    const pid = priorityCompound?.id ?? null
    if (pid && pid !== priorityIdRef.current) {
      priorityIdRef.current = pid
      attemptedIdsRef.current.delete(pid)
      setQueueTick((t) => t + 1)
    }
  }, [priorityCompound?.id])

  const compound = useMemo(() => {
    if (!active) return null
    // queueTick — только повод пересканировать очередь после очередного прогрева.
    void queueTick
    for (const c of queueCompounds) {
      if (attemptedIdsRef.current.has(c.id)) continue
      if (isProductGpuCompiled(c.id)) continue
      return c
    }
    return null
  }, [active, queueCompounds, queueTick])

  // Пометка «взяли в работу» — ref, не состояние: лишнего рендера нет, цикла нет.
  useEffect(() => {
    if (!compound) return
    attemptedIdsRef.current.add(compound.id)
    if (stallTimerRef.current != null) window.clearTimeout(stallTimerRef.current)
    stallTimerRef.current = window.setTimeout(() => {
      stallTimerRef.current = null
      // Вещество уже помечено как взятое — пересканирование возьмёт следующее.
      setQueueTick((t) => t + 1)
    }, QUEUE_STALL_MS)
    return () => {
      if (stallTimerRef.current != null) {
        window.clearTimeout(stallTimerRef.current)
        stallTimerRef.current = null
      }
    }
  }, [compound])

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current != null) window.clearTimeout(advanceTimerRef.current)
      if (stallTimerRef.current != null) window.clearTimeout(stallTimerRef.current)
    }
  }, [])

  const handleCompiled = (compoundId: string) => {
    attemptedIdsRef.current.add(compoundId)
    if (advanceTimerRef.current != null) window.clearTimeout(advanceTimerRef.current)
    // Пауза между веществами: не забиваем GPU подряд идущими компиляциями.
    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null
      setQueueTick((t) => t + 1)
    }, GPU_COMPILE_QUEUE_GAP_MS)
  }

  if (!compound) return null

  return (
    <LabProductHeroSlot
      // Ключ без счётчика: смена вещества — новый слот, лишних remount нет.
      key={`queue-${compound.id}`}
      compound={compound}
      visible={false}
      prewarm
      entrance="none"
      shaderCompileAsync
      onGpuCompiled={handleCompiled}
    />
  )
}

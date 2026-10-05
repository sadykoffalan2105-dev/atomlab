/**
 * Органика v2 — «Как образуется» для молекулы: выбор маршрута получения из учебника + проигрыватель синтеза.
 * Несколько маршрутов → переключатель («этилен + вода», «этиловый спирт», «общая схема»); общая схема помечена
 * «общая схема, в учебнике — с. N». Данные реакций грузятся отдельным чанком (loadOrganicV2Routes).
 */
import { regName } from './uzNames'
import { useEffect, useMemo, useState } from 'react'
import { loadOrganicV2Routes } from '../../../data/organicV2/reactions'
import type { OV2Reaction } from '../../../data/organicV2/types'
import { organicMoleculeById } from '../../../data/organicLab/organicMoleculeRegistry'
import { inorganicName, subscript } from '../../../chemistry/organicV2/synthesis/teacher'
import { SynthesisPlayer } from '../SynthesisPlayer'
import type { OV2Lang } from '../contracts'
import { SYNTH_UI } from './synthesisUi'
import styles from './SynthesisPlayer.module.css'

export interface SynthesisRoutesProps {
  readonly moleculeId: string
  readonly lang: OV2Lang
  /** готовые маршруты (если оболочка уже загрузила); иначе — загрузка по moleculeId */
  readonly routes?: readonly OV2Reaction[]
  readonly autoplay?: boolean
  readonly className?: string
}

function nameOf(ref: string, nameRu: string | undefined, lang: OV2Lang): string {
  const reg = organicMoleculeById[ref]
  if (reg) return regName(reg, lang).toLowerCase()
  const inorg = inorganicName(ref, lang)
  if (inorg) return inorg
  if (nameRu && lang === 'ru') return nameRu.toLowerCase()
  return subscript(ref.replace(/^(inorg|new|polymer):/, ''))
}

/** Маршрут не из уравнений учебника, а по его общей схеме (id «gen-…»). */
const isScheme = (r: OV2Reaction) => r.id.startsWith('gen-')

/** Подпись маршрута: исходные органические вещества (без повторов), неорганика — если органики нет. */
export function routeLabel(r: OV2Reaction, lang: OV2Lang): string {
  const left = r.species.filter((s) => s.side === 'L')
  const organic = left.filter((s) => !s.ref.startsWith('inorg:'))
  const pick = organic.length ? organic : left
  const names = [...new Set(pick.map((s) => nameOf(s.ref, s.nameRu, lang)))]
  const extra = organic.length && organic.length < left.length
    ? [...new Set(left.filter((s) => s.ref.startsWith('inorg:')).map((s) => subscript(s.ref.slice(6))))]
    : []
  return [...names, ...extra].slice(0, 3).join(' + ')
}

export function SynthesisRoutes({ moleculeId, lang, routes: given, autoplay = true, className }: SynthesisRoutesProps) {
  const ui = SYNTH_UI[lang]
  const [loaded, setLoaded] = useState<{ id: string; list: readonly OV2Reaction[] } | null>(null)
  const [error, setError] = useState(false)
  const [pick, setPick] = useState<{ id: string; k: number }>({ id: moleculeId, k: 0 })

  useEffect(() => {
    if (given) return
    let alive = true
    loadOrganicV2Routes(moleculeId)
      .then((list) => alive && setLoaded({ id: moleculeId, list }))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [moleculeId, given])

  const raw = given ?? (loaded?.id === moleculeId ? loaded.list : null)
  // сначала уравнения учебника, потом общие схемы (порядок внутри группы — как в данных)
  const list = useMemo(() => (raw ? [...raw.filter((r) => !isScheme(r)), ...raw.filter(isScheme)] : null), [raw])
  const active = pick.id === moleculeId ? pick.k : 0
  const labels = useMemo(() => (list ?? []).map((r) => routeLabel(r, lang)), [list, lang])
  const [more, setMore] = useState<string | null>(null)

  if (!list) return <p className={styles.routesEmpty}>{error ? ui.noRoutes : ui.loadingRoutes}</p>
  if (!list.length) return <p className={styles.routesEmpty}>{ui.noRoutes}</p>
  const reaction = list[Math.min(active, list.length - 1)]
  // больше 6 маршрутов — показываем учебник (не меньше 3 кнопок) и «ещё N»; выбранный маршрут виден всегда
  const book = list.filter((r) => !isScheme(r)).length
  const cap = list.length > 6 && more !== moleculeId ? Math.max(3, Math.min(book, 6)) : list.length
  const shown = list.map((_, k) => k).filter((k) => k < cap || k === active)

  return (
    <div className={[styles.routes, className].filter(Boolean).join(' ')}>
      {list.length > 1 ? (
        <div className={styles.routesHead} role="tablist" aria-label={ui.routes}>
          <span className={styles.routesTitle}>{ui.routes}:</span>
          {shown.map((k) => {
            const r = list[k]
            const dup = labels.filter((l) => l === labels[k]).length > 1
            const scheme = isScheme(r)
            return (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={k === active}
                className={k === active ? styles.routeOn : styles.route}
                onClick={() => setPick({ id: moleculeId, k })}
              >
                <span>{ui.routeFrom(labels[k])}</span>
                {scheme ? (
                  <span className={styles.routeNote}>{ui.routeScheme(r.source.page)}</span>
                ) : r.generic || dup ? (
                  <span className={styles.routeNote}>{ui.source(r.source.grade, r.source.section, r.source.page)}</span>
                ) : null}
              </button>
            )
          })}
          {shown.length < list.length ? (
            <button type="button" className={styles.route} onClick={() => setMore(moleculeId)}>
              <span>{ui.routeMore(list.length - shown.length)}</span>
            </button>
          ) : null}
        </div>
      ) : null}
      <SynthesisPlayer reaction={reaction} lang={lang} focusMoleculeId={moleculeId} autoplay={autoplay} />
    </div>
  )
}

export default SynthesisRoutes

/**
 * Органика v2 в реакторе: синтез по атомному соответствию (SynthesisPlayer) поверх сцены реактора.
 * Открывается кнопкой «Проверить и запустить синтез», когда уравнение органической реакции уравнено
 * и для неё нашлась реакция v2 (src/lab/organicV2Bridge.ts). «← К реактору» (и Esc) — назад к шарикам.
 * Проигрыватель — по контракту src/components/organicV2/contracts.ts (сам компонент не меняем).
 */
import { lazy, Suspense, useEffect, useRef } from 'react'
import type { OV2Reaction } from '../../data/organicV2/types'
import styles from './OrganicReactorSynthesis.module.css'

const SynthesisPlayer = lazy(() =>
  import('../../components/organicV2/SynthesisPlayer').then((m) => ({ default: m.SynthesisPlayer })),
)

export type OrganicReactorLang = 'ru' | 'en' | 'uz'

const UI: Readonly<Record<OrganicReactorLang, { back: string; title: string; loading: string; general: string }>> = {
  ru: {
    back: '← К реактору',
    title: 'Синтез: как атомы перестраиваются',
    loading: 'Загружаем синтез…',
    general: 'Общая схема учебника — показана на конкретном примере',
  },
  en: {
    back: '← Back to reactor',
    title: 'Synthesis: how the atoms rearrange',
    loading: 'Loading the synthesis…',
    general: 'General scheme from the textbook — shown on a concrete example',
  },
  uz: {
    back: '← Reaktorga qaytish',
    title: 'Sintez: atomlar qanday qayta joylashadi',
    loading: 'Sintez yuklanmoqda…',
    general: 'Darslikdagi umumiy sxema — aniq misolda ko‘rsatilgan',
  },
}

export interface OrganicReactorSynthesisProps {
  readonly reaction: OV2Reaction
  readonly lang: OrganicReactorLang
  /** главный продукт реактора (id реестра органики) — подсвечивается среди продуктов */
  readonly focusMoleculeId?: string
  readonly onBack: () => void
  readonly onDone?: () => void
}

export default function OrganicReactorSynthesis({ reaction, lang, focusMoleculeId, onBack, onDone }: OrganicReactorSynthesisProps) {
  const ui = UI[lang]
  const backRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])
  return (
    <div className={styles.host} role="dialog" aria-modal="true" aria-label={ui.title} data-organic-reactor-synthesis={reaction.id}>
      <div className={styles.bar}>
        <button ref={backRef} type="button" className={styles.back} onClick={onBack} data-organic-reactor-back="">
          {ui.back}
        </button>
        <span className={styles.title}>{ui.title}</span>
        {reaction.generic ? <span className={styles.note}>{ui.general}</span> : null}
      </div>
      <div className={styles.body}>
        <Suspense fallback={<div className={styles.loading}>{ui.loading}</div>}>
          <SynthesisPlayer
            key={reaction.id}
            reaction={reaction}
            lang={lang}
            focusMoleculeId={focusMoleculeId}
            autoplay
            onDone={onDone}
            className={styles.player}
          />
        </Suspense>
      </div>
    </div>
  )
}

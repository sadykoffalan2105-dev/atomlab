/**
 * Органика v2 — галерея изомеров одной брутто-формулы: у каждой карточки скелетная формула + маленькое 3D,
 * вид изомерии относительно первой молекулы (цепь / положение группы / положение кратной связи / межклассовая /
 * цис-транс / оптическая — по данным: классы, группы, E/Z, R/S) и подсветка атомов, которыми она отличается.
 * 3D монтируется, только когда карточка видна (на телефоне не держим десятки WebGL-контекстов).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { IsomerGalleryProps } from './contracts'
import { Molecule3D } from './Molecule3D'
import { Formula2D } from './Formula2D'
import { isomerKind, type IsomerVerdict } from './viewer/molMath'
import { ISOMER_T, VIEWER_T } from './viewer/i18n'
import { moleculeName } from './viewer/names'
import { CLASS_LABELS, classifyMolecule, skeletonFromOV2, subscriptDigits } from '../../chemistry/organicV2'
import styles from './viewer/IsomerGallery.module.css'

function useVisible<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null)
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVis(true)
      return
    }
    const io = new IntersectionObserver((es) => setVis(es.some((e) => e.isIntersecting)), { rootMargin: '120px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, vis]
}

function Card(props: {
  mol: IsomerGalleryProps['molecules'][number]
  verdict: IsomerVerdict | null
  lang: IsomerGalleryProps['lang']
  onOpen?: (id: string) => void
}) {
  const { mol, verdict, lang } = props
  const [ref, vis] = useVisible<HTMLButtonElement>()
  const t = VIEWER_T[lang]
  const cls = useMemo(() => {
    try {
      return CLASS_LABELS[classifyMolecule(skeletonFromOV2(mol))][lang]
    } catch {
      return CLASS_LABELS.other[lang]
    }
  }, [mol, lang])
  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.card} ${verdict ? styles[verdict.kind] ?? '' : styles.ref}`}
      onClick={() => props.onOpen?.(mol.id)}
      data-ov2-isomer={mol.id}
      data-kind={verdict?.kind ?? 'reference'}
    >
      <div className={styles.head}>
        <strong className={styles.name}>{moleculeName(mol, lang)}</strong>
        <span className={styles.cls}>{cls}</span>
      </div>
      <div className={styles.kind}>{verdict ? ISOMER_T[lang][verdict.kind] : t.reference}</div>
      <div className={styles.pics}>
        <div className={styles.f2}>
          <Formula2D mol={mol} kind="skeletal" lang={lang} highlightAtoms={verdict?.highlight} />
        </div>
        <div className={styles.m3}>{vis && <Molecule3D mol={mol} style="ballStick" lang={lang} compact autoRotate={false} highlightAtoms={verdict?.highlight} />}</div>
      </div>
    </button>
  )
}

export function IsomerGallery(props: IsomerGalleryProps) {
  const { molecules, lang } = props
  const verdicts = useMemo(() => {
    const ref = molecules[0]
    return molecules.map((m, i) => (i === 0 || !ref ? null : isomerKind(ref, m)))
  }, [molecules])
  return (
    <section className={[styles.gallery, props.className].filter(Boolean).join(' ')} data-ov2-isomers={props.formula}>
      <header className={styles.top}>
        <h3>{VIEWER_T[lang].isomersOf(subscriptDigits(props.formula))}</h3>
        <span>{molecules.length}</span>
      </header>
      <div className={styles.grid}>
        {molecules.map((m, i) => (
          <Card key={m.id} mol={m} verdict={verdicts[i]} lang={lang} onOpen={props.onOpen} />
        ))}
      </div>
    </section>
  )
}

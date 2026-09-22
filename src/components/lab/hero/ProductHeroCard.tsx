import { useMemo } from 'react'
import { LATTICE_ENTHALPY_KJ } from '../../../chemistry/data'
import { heroSpecFor, meanGasSpacingNm } from '../../../chemistry/data/heroStructures'
import { useT, type MessageKey } from '../../../i18n/useT'
import { formatHeroNumber, heroFormationLine, HERO_PHASE_KEY } from './heroCardData'
import type { CompoundDef } from '../../../types/chemistry'
import { buildHeroModel } from './heroGeometry'
import styles from './ProductHeroCard.module.css'

/**
 * Карточка продукта (DOM, поверх канвы): название, формула, агрегатное состояние при 25 °C,
 * ΔH°f из thermoData, тип структуры и одно предложение «почему так» на ru/en/uz.
 * Читаема в обеих темах: фон и текст — токены темы (--lt-*), а не зашитый тёмный фон.
 * Вещества без героя по данным — прежняя карточка (формула, имя, описание).
 *
 * Атрибут data-lab-hero-card читает кадр героя (hero/heroFrame): модель не встаёт под карточку.
 */

export function ProductHeroCard({
  compound,
  name,
  description,
}: {
  compound: CompoundDef
  name: string
  description: string
}) {
  const { t, locale } = useT()
  const spec = heroSpecFor(compound.id)
  const model = useMemo(() => buildHeroModel(compound.id), [compound.id])

  if (!spec || !model) {
    return (
      <div className={styles.card} data-lab-hero-card="">
        <span className={styles.formula}>{compound.formulaUnicode}</span>
        <span className={styles.name}>{name}</span>
        <p className={styles.why}>{description}</p>
      </div>
    )
  }

  const dh = heroFormationLine(spec.formationKey, locale)
  const whyKey = `hero.why.${compound.id}` as MessageKey
  const structureKey = `hero.structure.${compound.id}` as MessageKey
  const ratio =
    compound.id === 'mgo'
      ? formatHeroNumber(LATTICE_ENTHALPY_KJ['MgO(s)']! / LATTICE_ENTHALPY_KJ['NaCl(s)']!, 1, locale)
      : ''
  const notes: string[] = []
  if (spec.kind === 'crystal') {
    notes.push(t('hero.note.crystal', { cells: (model.cells ?? spec.cells).join('×') }))
    if (compound.id === 'sio2') notes.push(t('hero.note.sio2'))
    if (compound.id === 'pbo') notes.push(t('hero.note.pbo'))
  } else if (spec.neighbors === 'hbond-water') {
    notes.push(t('hero.note.hbond'))
  } else if (spec.phase === 'gas') {
    notes.push(t('hero.note.gas', { d: formatHeroNumber(meanGasSpacingNm(), 1, locale) }))
  } else {
    notes.push(t('hero.note.single'))
  }

  return (
    <div className={styles.card} data-lab-hero-card="" aria-label={t('hero.cardAria')}>
      <div className={styles.head}>
        <span className={styles.formula}>{compound.formulaUnicode}</span>
        <span className={styles.name}>{name}</span>
      </div>
      <div className={styles.facts}>
        <span className={styles.chip}>
          {t('hero.at25')}: {t(HERO_PHASE_KEY[spec.phase])}
        </span>
        {dh ? (
          <span className={styles.chip}>
            {dh.text}
            {dh.estimated ? <span className={styles.estimate}> ({t('hero.estimated')})</span> : null}
          </span>
        ) : null}
      </div>
      <p className={styles.structure}>{t(structureKey)}</p>
      <p className={styles.why}>{t(whyKey, { ratio })}</p>
      {notes.map((n) => (
        <p key={n} className={styles.note}>
          {n}
        </p>
      ))}
    </div>
  )
}

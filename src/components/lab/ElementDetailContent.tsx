import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { isAncientDiscoveryYear } from '../../data/elementDiscoveryYears'
import { estimateNeutrons, getElementByZ } from '../../data/elements'
import { elementDisplayName } from '../../data/elementDisplayName'
import {
  formatBoilingPoint,
  formatDensity,
  formatElectronegativity,
  formatMeltingPoint,
  parseElectronConfigTokens,
  parseOxidationStates,
} from '../../data/elementConfigDisplay'
import {
  groupBlockLabelEn,
  groupBlockLabelRu,
  standardStateLabelEn,
  standardStateLabelRu,
} from '../../data/elementI18n'
import { getElementLifeCard } from '../../data/elementRealLife'
import { getCuratedElementLife } from '../../data/elementCuratedUses'
import { cpkColorName } from '../../data/cpkColorName'
import { toFullElectronConfiguration } from '../../data/electronConfigExpand'
import { mendeleevBlock } from '../../data/mendeleevBlock'
import { massDisplay } from '../../data/elementDisplay'
import { useT, type MessageKey } from '../../i18n/useT'
import { ElementAtomPreview3d } from './ElementAtomPreview3d'
import { ElementNatureHero } from './ElementNatureHero'
import styles from './ElementDetailContent.module.css'

function blockLabelKey(block: 's' | 'p' | 'd' | 'f'): 'elementDetail.blockS' | 'elementDetail.blockP' | 'elementDetail.blockD' | 'elementDetail.blockF' {
  if (block === 's') return 'elementDetail.blockS'
  if (block === 'p') return 'elementDetail.blockP'
  if (block === 'd') return 'elementDetail.blockD'
  return 'elementDetail.blockF'
}

function isValidCpkHex(hex: string): boolean {
  return /^[0-9A-Fa-f]{6}$/.test(hex)
}

const variantClass = {
  default: styles.root,
  compact: styles.rootCompact,
  lab: styles.rootLab,
} as const

function ElectronConfigRich({ fullConfig }: { fullConfig: string }) {
  const tokens = parseElectronConfigTokens(fullConfig)
  if (tokens.length === 0) {
    return <span className={styles.configRich}>{fullConfig}</span>
  }
  return (
    <span className={styles.configRich}>
      {tokens.map((t, i) => (
        <span key={`${t.label}-${i}`} className={styles.shellToken}>
          <span className={styles.shellOrbit}>
            {t.n}
            {t.subshell}
          </span>
          <sup className={styles.shellSup}>{t.count}</sup>
          {i < tokens.length - 1 ? ' ' : null}
        </span>
      ))}
    </span>
  )
}

function BlockBadge({ block }: { block: 's' | 'p' | 'd' | 'f' }) {
  const cells: ('s' | 'p' | 'd' | 'f')[] = ['s', 'p', 'd', 'f']
  return (
    <div className={styles.blockGrid} aria-hidden>
      {cells.map((c) => (
        <span key={c} className={c === block ? styles.blockCellOn : styles.blockCell}>
          {c}
        </span>
      ))}
    </div>
  )
}

function RichElementDetail({
  el,
  displayName,
  titleId,
  headerEnd,
  locale,
  t,
}: {
  el: NonNullable<ReturnType<typeof getElementByZ>>
  displayName: string
  titleId: string
  headerEnd?: ReactNode
  locale: string
  t: (key: MessageKey, params?: Readonly<Record<string, string | number>>) => string
}) {
  const block = mendeleevBlock(el)
  const cpk = el.cpkHex.replace(/^#/, '')
  const fullConfig = toFullElectronConfiguration(el.electronConfiguration)
  const categoryLabel =
    locale === 'en' ? groupBlockLabelEn(el.groupBlock) : groupBlockLabelRu(el.groupBlock)
  const stateLabel =
    locale === 'en' ? standardStateLabelEn(el.standardState) : standardStateLabelRu(el.standardState)
  const showCpk = isValidCpkHex(cpk)
  const neutronEstimate = estimateNeutrons(el.atomicMass, el.z)
  const oxStates = parseOxidationStates(el.oxidationStates)
  const life = getElementLifeCard(el.z)
  const curated = getCuratedElementLife(el.z)
  const uses = curated
    ? locale === 'en'
      ? curated.usesEn
      : curated.usesRu
    : life
      ? locale === 'en'
        ? life.usesEn
        : life.usesRu
      : []
  const appearance = life ? (locale === 'en' ? life.appearanceEn : life.appearanceRu) : null
  const photoCaption = life
    ? locale === 'uz'
      ? life.captionEn
      : locale === 'en'
        ? life.captionEn
        : life.captionRu
    : null
  const extraction = curated
    ? locale === 'en'
      ? (curated.extractionEn ?? (life ? life.extractionEn : null))
      : (curated.extractionRu ?? (life ? life.extractionRu : null))
    : life
      ? locale === 'en'
        ? life.extractionEn
        : life.extractionRu
      : null
  const speechLocale = locale === 'en' ? 'en' : 'ru'
  const cpkLabel = showCpk ? cpkColorName(cpk, speechLocale) : null

  return (
    <>
      <header className={styles.head}>
        <div className={styles.headMain}>
          <div className={styles.headTitleRow}>
            {showCpk ? (
              <span
                className={styles.headCpkOrb}
                style={{ backgroundColor: `#${cpk}` }}
                aria-hidden
              />
            ) : null}
            <div>
              <h2 id={titleId} className={styles.symbol}>
                {el.symbol}
              </h2>
              <p className={styles.name}>{displayName}</p>
              <p className={styles.zLine}>Z = {el.z}</p>
            </div>
          </div>
        </div>
        {headerEnd}
      </header>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>{t('elementDetail.atomicMass')}</span>
          <span className={styles.statValue}>
            {massDisplay(el.atomicMass)}
            <span className={styles.statUnit}> u</span>
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>{t('elementDetail.protons')}</span>
          <span className={styles.statValue}>{el.z}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>{t('elementDetail.electrons')}</span>
          <span className={styles.statValue}>{el.z}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>{t('elementDetail.neutrons')}</span>
          <span className={styles.statValue}>{neutronEstimate}</span>
        </div>
      </div>

      {life ? (
        <ElementNatureHero
          symbol={el.symbol}
          displayName={displayName}
          life={life}
          caption={photoCaption ?? ''}
          appearance={appearance}
        />
      ) : null}

      <div className={styles.richGrid}>
        <section className={styles.richCol} aria-label={t('elementDetail.structureSection')}>
          <h3 className={styles.sectionTitle}>{t('elementDetail.structureSection')}</h3>

          <div className={styles.structureRow}>
            <div className={styles.structureConfig}>
              <div className={styles.detailBlock}>
                <p className={styles.detailLabel}>{t('elementDetail.electronConfig')}</p>
                <div className={styles.detailValue}>
                  <ElectronConfigRich fullConfig={fullConfig} />
                </div>
              </div>
            </div>
            <div className={styles.structurePreview}>
              <ElementAtomPreview3d
                fullConfig={fullConfig}
                cpkHex={cpk}
                symbol={el.symbol}
                z={el.z}
              />
            </div>
          </div>

          {oxStates.length > 0 ? (
            <div className={styles.detailBlock}>
              <p className={styles.detailLabel}>{t('elementDetail.oxidation')}</p>
              <div className={styles.oxidWrap}>
                {oxStates.map((ox) => (
                  <span key={ox} className={styles.oxChip}>
                    {ox}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className={styles.richCol} aria-label={t('elementDetail.physicalSection')}>
          <h3 className={styles.sectionTitle}>{t('elementDetail.physicalSection')}</h3>

          <div className={styles.propCards}>
            <div className={styles.propCard}>
              <span className={styles.propIcon} aria-hidden>
                ◆
              </span>
              <div>
                <p className={styles.propLabel}>{t('elementDetail.standardState')}</p>
                <p className={styles.propValue}>{stateLabel}</p>
              </div>
            </div>
            <div className={styles.propCard}>
              <span className={styles.propIcon} aria-hidden>
                ▦
              </span>
              <div>
                <p className={styles.propLabel}>{t('elementDetail.category')}</p>
                <p className={styles.propValue}>{categoryLabel}</p>
              </div>
            </div>
            <div className={styles.propCard}>
              <BlockBadge block={block} />
              <div>
                <p className={styles.propLabel}>{t('elementDetail.blockZone')}</p>
                <p className={styles.propValue}>{t(blockLabelKey(block))}</p>
              </div>
            </div>
          </div>

          <dl className={styles.physDl}>
            <div className={styles.physRow}>
              <dt>{t('elementDetail.meltingPoint')}</dt>
              <dd>{formatMeltingPoint(el.meltingPoint, speechLocale, el.boilingPoint)}</dd>
            </div>
            <div className={styles.physRow}>
              <dt>{t('elementDetail.boilingPoint')}</dt>
              <dd>{formatBoilingPoint(el.boilingPoint, speechLocale, el.meltingPoint)}</dd>
            </div>
            <div className={styles.physRow}>
              <dt>{t('elementDetail.density')}</dt>
              <dd>{formatDensity(el.density, { standardState: el.standardState, locale: speechLocale })}</dd>
            </div>
            <div className={styles.physRow}>
              <dt>{t('elementDetail.electronegativity')}</dt>
              <dd>{formatElectronegativity(el.electronegativity)}</dd>
            </div>
            {el.yearDiscovered ? (
              <div className={styles.physRow}>
                <dt>{t('elementDetail.yearDiscovered')}</dt>
                <dd>
                  {isAncientDiscoveryYear(el.yearDiscovered)
                    ? t('elementDetail.yearAncient')
                    : el.yearDiscovered}
                </dd>
              </div>
            ) : null}
          </dl>

          <div className={styles.detailBlock}>
            <p className={styles.detailLabel}>{t('elementDetail.cpkColor')}</p>
            {showCpk ? (
              <span className={styles.cpkRow}>
                <span
                  className={styles.cpkSwatchLarge}
                  style={{ backgroundColor: `#${cpk}` }}
                  aria-label={cpkLabel ?? t('elementDetail.cpkSwatchAria')}
                />
                <span className={styles.cpkName}>{cpkLabel}</span>
              </span>
            ) : (
              <span className={styles.detailValueMuted}>{t('elementDetail.cpkNotSet')}</span>
            )}
          </div>
        </section>
      </div>

      {uses.length > 0 ? (
        <section className={styles.lifeSection}>
          <h3 className={styles.sectionTitle}>{t('elementDetail.usesSection')}</h3>
          <ul className={styles.useList}>
            {uses.map((use) => (
              <li key={use} className={styles.useChip}>
                {use}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {extraction ? (
        <section className={styles.lifeSection}>
          <h3 className={styles.sectionTitle}>{t('elementDetail.extractionSection')}</h3>
          <p className={styles.lifeText}>{extraction}</p>
        </section>
      ) : null}
    </>
  )
}

export function ElementDetailContent({
  z,
  titleId,
  headerEnd,
  variant = 'default',
}: {
  z: number
  titleId: string
  headerEnd?: ReactNode
  /** default — богатая карточка; compact — список; lab — плотно для лаборатории */
  variant?: 'default' | 'compact' | 'lab'
}) {
  const { locale, t } = useT()
  const el = getElementByZ(z)
  const displayName = useMemo(() => (el ? elementDisplayName(el, locale) : ''), [el, locale])
  if (!el) return null

  const rootClass = variantClass[variant] ?? styles.root

  if (variant === 'default') {
    return (
      <div className={rootClass}>
        <RichElementDetail
          el={el}
          displayName={displayName}
          titleId={titleId}
          headerEnd={headerEnd}
          locale={locale}
          t={t}
        />
      </div>
    )
  }

  const block = mendeleevBlock(el)
  const cpk = el.cpkHex.replace(/^#/, '')
  const fullConfig = toFullElectronConfiguration(el.electronConfiguration)
  const categoryLabel =
    locale === 'en' ? groupBlockLabelEn(el.groupBlock) : groupBlockLabelRu(el.groupBlock)
  const stateLabel =
    locale === 'en' ? standardStateLabelEn(el.standardState) : standardStateLabelRu(el.standardState)
  const showCpk = isValidCpkHex(cpk)
  const neutronEstimate = estimateNeutrons(el.atomicMass, el.z)
  const compactLocale = locale === 'en' ? 'en' : 'ru'
  const cpkLabel = showCpk ? cpkColorName(cpk, compactLocale) : null

  return (
    <div className={rootClass}>
      <header className={styles.head}>
        <div>
          <h2 id={titleId} className={styles.symbol}>
            {el.symbol}
          </h2>
          <p className={styles.name}>{displayName}</p>
          <p className={styles.zLine}>Z = {el.z}</p>
        </div>
        {headerEnd}
      </header>

      <dl className={styles.dl}>
        <dt className={styles.dt}>{t('elementDetail.atomicMass')}</dt>
        <dd className={styles.dd}>{massDisplay(el.atomicMass)} u</dd>

        <dt className={styles.dt}>{t('elementDetail.protons')}</dt>
        <dd className={styles.dd}>{el.z}</dd>

        <dt className={styles.dt}>{t('elementDetail.electrons')}</dt>
        <dd className={styles.dd}>{el.z}</dd>

        <dt className={styles.dt}>{t('elementDetail.neutrons')}</dt>
        <dd className={styles.dd}>{neutronEstimate}</dd>

        <dt className={styles.dt}>{t('elementDetail.electronConfig')}</dt>
        <dd className={`${styles.dd} ${styles.configBlock}`}>{fullConfig}</dd>

        <dt className={styles.dt}>{t('elementDetail.oxidation')}</dt>
        <dd className={styles.dd}>{el.oxidationStates}</dd>

        <dt className={styles.dt}>{t('elementDetail.category')}</dt>
        <dd className={styles.dd}>{categoryLabel}</dd>

        <dt className={styles.dt}>{t('elementDetail.blockZone')}</dt>
        <dd className={styles.dd}>{t(blockLabelKey(block))}</dd>

        <dt className={styles.dt}>{t('elementDetail.standardState')}</dt>
        <dd className={styles.dd}>{stateLabel}</dd>

        <dt className={styles.dt}>{t('elementDetail.cpkColor')}</dt>
        <dd className={styles.dd}>
          {showCpk ? (
            <span className={styles.cpkRow}>
              <span
                className={styles.cpkSwatch}
                style={{ backgroundColor: `#${cpk}` }}
                aria-label={cpkLabel ?? t('elementDetail.cpkSwatchAria')}
              />
              <span className={styles.cpkName}>{cpkLabel}</span>
            </span>
          ) : (
            t('elementDetail.cpkNotSet')
          )}
        </dd>
      </dl>
    </div>
  )
}

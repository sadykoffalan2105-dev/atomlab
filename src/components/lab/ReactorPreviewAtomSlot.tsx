import { memo } from 'react'
import { CpkAtomModel } from './atom/CpkAtomModel'

/**
 * Мемо-слот реагента в реакторе — CPK-сфера (см. atom/CpkAtomModel).
 *
 * Раньше здесь была Bohr-модель (ядро + оболочки): она красива, но в реакторе
 * стоит десяток атомов разом, и вместо вещества экран показывал двадцать две
 * орбитальные «юлы». Теперь язык тот же, что в кино-сценах: шар CPK с
 * настоящим радиусом, облако, ореол и подпись. Bohr остался в таблице
 * Менделеева и в модалке элемента, где он действительно учит строению.
 *
 * Мемоизация нужна по-прежнему: при +/- коэффициента слот не должен
 * пересоздавать материалы и текстуру подписи.
 */
export const ReactorPreviewAtomSlot = memo(
  function ReactorPreviewAtomSlot({
    z,
    charge = 0,
    animate,
    previewStatic = false,
    useFullDetail,
    previewLite,
    electronFrameSkip,
    slotIndex = 0,
    showLabel = true,
  }: {
    z: number
    /** Заряд частицы: 0 — атом, ±n — ион (радиус Шеннона + надстрочный бейдж). */
    charge?: number
    animate: boolean
    previewStatic?: boolean
    useFullDetail: boolean
    previewLite: boolean
    /** Пропуск кадров анимации — общий бюджет с прежними электронами Bohr. */
    electronFrameSkip: number
    slotIndex?: number
    showLabel?: boolean
  }) {
    return (
      <CpkAtomModel
        z={z}
        charge={charge}
        animate={animate}
        previewStatic={previewStatic}
        lite={previewLite && !useFullDetail}
        showLabel={showLabel}
        frameSkip={electronFrameSkip}
        slotIndex={slotIndex}
      />
    )
  },
  (a, b) =>
    a.z === b.z &&
    a.charge === b.charge &&
    a.animate === b.animate &&
    a.previewStatic === b.previewStatic &&
    a.useFullDetail === b.useFullDetail &&
    a.previewLite === b.previewLite &&
    a.electronFrameSkip === b.electronFrameSkip &&
    a.slotIndex === b.slotIndex &&
    a.showLabel === b.showLabel,
)

/**
 * Пояс веществ экрана входа — описание, без three и React.
 *
 * Отдельный модуль нужен, чтобы подписи (`LabEntryHints`) знали название и
 * формулу молекулы под указателем, не импортируя саму 3D-сцену пояса.
 */
import type { MessageKey } from '../../../i18n/messagesRu'

export type BeltCompound = {
  /** id вещества каталога */
  readonly id: string
  /** формула: нотация, мимо i18n */
  readonly formula: string
  /** ключ названия («Вода», «Аммиак», …) */
  readonly nameKey: MessageKey
}

export const BELT_COMPOUNDS: readonly BeltCompound[] = [
  { id: 'H2O', formula: 'H₂O', nameKey: 'lab.entry.name.H2O' },
  { id: 'CO2', formula: 'CO₂', nameKey: 'lab.entry.name.CO2' },
  { id: 'NH3', formula: 'NH₃', nameKey: 'lab.entry.name.NH3' },
  { id: 'HCl', formula: 'HCl', nameKey: 'lab.entry.name.HCl' },
]

export const BELT_COMPOUND_BY_ID: Readonly<Record<string, BeltCompound | undefined>> = Object.fromEntries(
  BELT_COMPOUNDS.map((c) => [c.id, c]),
)

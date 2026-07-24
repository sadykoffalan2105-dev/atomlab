import type { ComponentType } from 'react'
import { Clo2ScientificSynthesisFx } from '../../components/lab/scientific/Clo2ScientificSynthesisFx'
import { Ch4CombustionSciFx } from '../../components/lab/scientific/Ch4CombustionSciFx'
import type { ScientificSynthesisFxProps } from './types'

export type { ScientificSynthesisFxProps } from './types'

const REGISTRY: Record<string, ComponentType<ScientificSynthesisFxProps>> = {
  clo2: Clo2ScientificSynthesisFx,
  // Ключ 'ch4_combustion' не совпадает ни с одним productId каталога —
  // готово к запуску, ждёт UI-переключателя маршрута для CO₂/H₂O (не ломает C+O₂ / 2H₂+O₂ по умолчанию).
  ch4_combustion: Ch4CombustionSciFx,
}

/** Научно-точный микромир по id продукта; иначе null → обычный ElementsCollapseFx. */
export function getScientificSynthesisFx(
  productId: string | undefined | null,
): ComponentType<ScientificSynthesisFxProps> | null {
  if (!productId) return null
  return REGISTRY[productId] ?? null
}

export function hasScientificSynthesisFx(productId: string | undefined | null): boolean {
  return Boolean(productId && REGISTRY[productId])
}

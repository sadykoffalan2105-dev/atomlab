import type { ComponentType } from 'react'
import { Clo2ScientificSynthesisFx } from '../../components/lab/scientific/Clo2ScientificSynthesisFx'
import { Ch4CombustionSciFx } from '../../components/lab/scientific/Ch4CombustionSciFx'
import { CaoCinemaScene } from '../cinema/scenes/cao/CaoCinemaScene'
import { MgoCinemaScene } from '../cinema/scenes/mgo/MgoCinemaScene'
import { FesCinemaScene } from '../cinema/scenes/fes/FesCinemaScene'
import { H2oCinemaScene } from '../cinema/scenes/h2o/H2oCinemaScene'
import { HclCinemaScene } from '../cinema/scenes/hcl/HclCinemaScene'
import { Co2CinemaScene } from '../cinema/scenes/co2/Co2CinemaScene'
import { NaclCinemaScene } from '../cinema/scenes/nacl/NaclCinemaScene'
import { Nh3CinemaScene } from '../cinema/scenes/nh3/Nh3CinemaScene'
import { So2CinemaScene } from '../cinema/scenes/so2/So2CinemaScene'
import { Zncl2CinemaScene } from '../cinema/scenes/zncl2/Zncl2CinemaScene'
import type { ScientificSynthesisFxProps } from './types'
import {
  scientificSceneFor,
  type SceneReactant,
  type ScientificSceneProductId,
} from './sceneSignatures'

export type { ScientificSynthesisFxProps } from './types'
export {
  SCIENTIFIC_SCENE_SIGNATURES,
  scientificSceneFor,
  signatureMatches,
  type ReactionSignature,
  type SceneReactant,
  type ScientificSceneProductId,
} from './sceneSignatures'

/**
 * Сцена по id продукта. Ключи обязаны совпадать с SCIENTIFIC_SCENE_SIGNATURES (sceneSignatures.ts):
 * тип Record<ScientificSceneProductId, …> не даст забыть сигнатуру для новой сцены и наоборот.
 * Сцена играет, только если реагенты синтеза совпадают с её сигнатурой (см. scientificSceneFor).
 */
const REGISTRY: Record<ScientificSceneProductId, ComponentType<ScientificSynthesisFxProps>> = {
  clo2: Clo2ScientificSynthesisFx,
  // Учебник 7–8: ионная связь, 2 Na + Cl₂ → 2 NaCl (bank 'na-cl-nacl'). Сцена принимает контракт лаборатории напрямую.
  nacl: NaclCinemaScene,
  // Учебник 7–8: ковалентная полярная связь, C (графит) + O₂ → CO₂ (bank 'c-o2-co2').
  co2: Co2CinemaScene,
  // Учебник 8: обжиг известняка CaCO₃ → CaO + CO₂ (bank 'caco3-decomp'). У 'ca-o2-cao' тот же продукт, но другая реакция — сцена не играет.
  cao: CaoCinemaScene,
  // Учебник 7: ковалентная полярная связь и водородная связь, 2 H₂ + O₂ → 2 H₂O (bank 'h2-o2-h2o').
  h2o: H2oCinemaScene,
  // Учебник 9: обратимая реакция и катализ, N₂ + 3 H₂ ⇌ 2 NH₃ (bank 'n2-h2-nh3').
  nh3: Nh3CinemaScene,
  // Учебник 7–8: «смесь или соединение», Fe + S → FeS (bank 'fe-s-fes', productId 'salt_fe2_s').
  salt_fe2_s: FesCinemaScene,
  // Учебник 8–9: ковалентная полярная связь, S + O₂ → SO₂ (bank 's-o2-so2').
  so2: So2CinemaScene,
  // Учебник 8: цепная радикальная реакция, H₂ + Cl₂ → 2 HCl (bank 'h2-cl2-hcl'). Свет запускает цепь.
  hcl: HclCinemaScene,
  // Учебник 7: горение магния, 2 Mg + O₂ → 2 MgO (bank 'mg-o2-mgo'). Два электрона на атом, EA₂ > 0.
  mgo: MgoCinemaScene,
  // Учебник 8: получение водорода, Zn + 2 HCl → ZnCl₂ + H₂↑ (bank 'zn-hcl', productId 'salt_zn_cl'). Прямой синтез Zn + Cl₂ ('zn-cl2-zncl2') эту сцену больше не включает.
  salt_zn_cl: Zncl2CinemaScene,
  // Ключ 'ch4_combustion' не совпадает ни с одним productId каталога —
  // готово к запуску, ждёт UI-переключателя маршрута для CO₂/H₂O (не ломает C+O₂ / 2H₂+O₂ по умолчанию).
  ch4_combustion: Ch4CombustionSciFx,
}

/**
 * Научно-точный микромир для КОНКРЕТНОЙ реакции: продукт есть в реестре и множество реагентов
 * совпадает с сигнатурой сцены (коэффициенты не важны). Иначе null → обычный ElementsCollapseFx.
 * Без реагентов сцена не выбирается: «NaOH + HCl → NaCl» не имеет права играть «2 Na + Cl₂».
 */
export function getScientificSynthesisFx(
  productId: string | undefined | null,
  reactants: readonly SceneReactant[] | null | undefined,
): ComponentType<ScientificSynthesisFxProps> | null {
  const id = scientificSceneFor(productId, reactants)
  return id ? REGISTRY[id] : null
}

export function hasScientificSynthesisFx(
  productId: string | undefined | null,
  reactants: readonly SceneReactant[] | null | undefined,
): boolean {
  return scientificSceneFor(productId, reactants) !== null
}

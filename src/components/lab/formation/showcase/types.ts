/**
 * Showcase — кинематографический слой «Как образуется» для избранных веществ (H₂O, CO₂, SiO₂ …).
 *
 * Сцена showcase рендерится ВНУТРИ группы атомов FormationMoleculeView (та же система координат, что у шаров модели:
 * положения атомов — atomPosAt(story, i, t), палочки/атомы рисует сам вид), поверх него добавляет облака, светящиеся
 * электроны, подписи (угол, длина, δ±, диполь), энергию, окружение в финале и управляет камерой через cam.
 * Всё — функции времени clock.current.t (перемотка ползунком назад/вперёд должна работать без «застрявших» частиц).
 */
import type { ComponentType, MutableRefObject } from 'react'
import type { FormationPlan } from '../../../../chemistry/formationPlan'
import type { SchoolHeroModel } from '../../hero/schoolHeroModel'
import type { FormationStory } from '../formationStory'
import type { FormationClock } from '../formationTimeline'

/** Управление камерой из сцены (CameraRig в FormationCanvas читает каждый кадр). Углы — радианы. */
export type CamCtl = {
  /** Сцена ведёт камеру (иначе — как у обычного показа). */
  active: boolean
  /** Желаемое направление на модель: yaw — вокруг вертикали, pitch — подъём (−1,2…1,2). */
  yaw: number
  pitch: number
  /** Множитель приближения (1 — как обычный показ, 1,3 — ближе). */
  zoom: number
  /** Пока performance.now() < userUntil — пользователь крутит сам, сцена не вмешивается. */
  userUntil: number
}

export type ShowcaseProps = {
  model: SchoolHeroModel
  plan: FormationPlan
  story: FormationStory
  clock: MutableRefObject<FormationClock>
  cam: MutableRefObject<CamCtl>
  lowPower: boolean
}

export type ShowcaseScene = ComponentType<ShowcaseProps> & {
  /** Сцена рисует электроны сама (жёлтые точки вида скрываются). По умолчанию true. */
  hideElectrons?: boolean
}

export type ShowcaseId = 'h2o' | 'co2' | 'sio2'
export const SHOWCASE_IDS: readonly ShowcaseId[] = ['h2o', 'co2', 'sio2']
export const isShowcaseId = (id: string): id is ShowcaseId => (SHOWCASE_IDS as readonly string[]).includes(id)

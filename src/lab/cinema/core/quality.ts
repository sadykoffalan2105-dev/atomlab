/**
 * ATOMLAB Cinema — уровни качества.
 *
 * Кадр важнее эффекта: на слабом устройстве сцена теряет частицы и пост-обработку,
 * но раскадровка, геометрия молекул и хронометраж остаются те же — урок не меняется.
 */

export type CinemaTier = 'cinematic' | 'lite'

export type CinemaQuality = {
  tier: CinemaTier
  atomSegW: number
  atomSegH: number
  /** френелевская оболочка атома (стеклянный вид) */
  shell: boolean
  /** GLSL-плазма на связях вместо простого аддитивного жгута */
  plasmaBonds: boolean
  /** клубов в одном газовом облаке */
  gasPuffs: number
  /** клубов в тумане сцены */
  fogPuffs: number
  /** GPU-частицы three.quarks */
  vfx: boolean
  /** множитель количества частиц в бёрстах */
  vfxScale: number
  /** пылинки микромира */
  dust: number
  post: boolean
}

export function resolveCinemaQuality(lowPower: boolean): CinemaQuality {
  if (lowPower) {
    return {
      tier: 'lite',
      atomSegW: 14,
      atomSegH: 10,
      shell: false,
      plasmaBonds: false,
      gasPuffs: 12,
      fogPuffs: 9,
      vfx: false,
      vfxScale: 0.35,
      dust: 20,
      post: true,
    }
  }
  return {
    tier: 'cinematic',
    atomSegW: 24,
    atomSegH: 18,
    shell: true,
    plasmaBonds: true,
    // Клубы — инстансы одного квада в одном draw call, поэтому плотность облака
    // почти бесплатна: дороже пиксели, а не количество.
    gasPuffs: 30,
    fogPuffs: 20,
    vfx: true,
    vfxScale: 1,
    dust: 60,
    post: true,
  }
}

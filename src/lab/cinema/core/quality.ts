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
  /** пост-обработка (на lite — минимальная: короткий bloom + тонмаппинг в одном проходе) */
  post: boolean
  /** атомы-импосторы (квад + ray–sphere в шейдере); lite — низкополигональные инстансы */
  impostorAtoms: boolean
  /** объёмный рэймарчинг орбиталей; lite — лепестки-эллипсоиды */
  orbitalRaymarch: boolean
  /** потолок devicePixelRatio канваса на время урока */
  maxDpr: number
}

export function resolveCinemaQuality(lowPower: boolean): CinemaQuality {
  if (lowPower) {
    return {
      tier: 'lite',
      atomSegW: 14,
      atomSegH: 10,
      shell: false,
      plasmaBonds: false,
      // На слабом GPU платим за пиксели: каждый клуб — полупрозрачная заливка
      // крупного квада, поэтому клубов мало (облако остаётся читаемым пятном).
      gasPuffs: 6,
      fogPuffs: 4,
      vfx: false,
      vfxScale: 0.35,
      dust: 12,
      post: true,
      impostorAtoms: false,
      orbitalRaymarch: false,
      maxDpr: 1,
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
    impostorAtoms: true,
    orbitalRaymarch: true,
    maxDpr: 1.5,
  }
}

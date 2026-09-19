/**
 * ATOMLAB Cinema — собственная кинематографическая библиотека для 3D-реакций.
 *
 * Зачем она: сцены реакций раньше писались «руками» — набор if-ов по фазам,
 * из-за чего атомы прыгали на границах, эффекты жили сами по себе, а любая
 * новая реакция копировала предыдущую целиком. Здесь всё разложено по слоям:
 *
 *   core/     — чистая логика без React: время сюжета, keyframe-дорожки
 *               (eased и hermite), пружины, пулы экземпляров, геометрия молекул
 *               (VSEPR), процедурные текстуры, кэши
 *   core/chem — химия для анимации: настоящие частоты колебаний и формы мод,
 *               модель π-орбиталей (ЛКАО/Хюккель), порядок и полярность связей
 *   react/    — визуальные модули: инстансные атомы-импостеры и связи с порядком
 *               связи (1 draw call на тип), орбитальные лепестки, газ и туман,
 *               GPU-частицы, световые волны, HUD, пост-обработка, камера, время
 *   scenes/   — сами реакции: только данные раскадровки + тонкий рендер
 *
 * Реакция описывается ДАННЫМИ (дорожки + события), а не императивным кодом,
 * поэтому непрерывность движения гарантирована по построению, а хронометраж
 * можно читать и править, не залезая в рендер.
 *
 * Построена на three.js / @react-three/fiber, GSAP (тайминг) и three.quarks
 * (batched GPU-частицы, аналог Unity Shuriken).
 */

// ——— core ———
export { Ease, ease, mix, norm, smoothstep, type EaseFn, type EaseName } from './core/easing'
export {
  inWindow,
  jitter,
  type TrackInterp,
  sampleScalar,
  sampleVec3,
  validateTrack,
  windowFade,
  type ScalarKey,
  type ScalarTrack,
  type Vec3Key,
  type Vec3Track,
  type Window,
} from './core/tracks'
export { storyDuration, storyWallDuration, type StorySegment } from './core/storyTime'
export { createStoryClock, type StoryClock } from './core/storyClock'
export { createCueRunner, pulseAt, type Cue, type CueRunner } from './core/cues'
export {
  ang,
  atomRadius,
  BOND_ANGLE_DEG,
  BOND_LENGTH_A,
  COVALENT_RADIUS_A,
  CPK,
  IONIC_RADIUS_A,
  METALLIC_RADIUS_A,
  pmToAngstrom,
  radiusForSpecies,
  SCENE_PER_ANGSTROM,
  sceneRadius,
  type CpkSymbol,
} from './core/atoms'
export {
  createBentFrame,
  measureAngle,
  TETRAHEDRAL_DIRS,
  writeBent,
  writeDiatomic,
  writeLinear,
  writeTetrahedral,
  type BentFrame,
} from './core/vsepr'
export { resolveCinemaQuality, type CinemaQuality, type CinemaTier } from './core/quality'
export { damp, dampAlpha, lambdaFromLerp, springEase, springStep, springStepVec3, type SpringState } from './core/spring'
export {
  createAtomPool,
  createBondPool,
  createLobePool,
  LobeKind,
  writeHexLinear,
  writeVec3,
  type AtomPool,
  type BondPool,
  type LobeKindId,
  type LobePool,
} from './core/pools'
export * from './core/chem'
export { computeAtomContacts, setAtomEnvIntensity, type AtomRenderMode } from './core/atomImpostorShader'
export { disposeLabEnvironment, getLabEnvironment } from './core/envLighting'
export { writeBondBandDirection } from './core/bondBandShader'
export { ORBITAL_PHASE_PALETTE, type OrbitalPhasePalette } from './core/orbitalLobeShader'
export {
  cinemaCircle,
  cinemaQuad,
  cinemaRing,
  cinemaSphere,
  cinemaUnitCylinder,
  disposeCinemaGeometries,
} from './core/geometries'
export {
  crystalCoreMaterial,
  disposeCinemaMaterials,
  fresnelShellMaterial,
  nucleusMaterial,
  particleSpriteMaterial,
} from './core/materials'
export { isSceneTextSafe, sceneText } from './core/glyphs'
export { cinemaTexture, disposeCinemaTextures } from './core/textures'
export { createBondMaterial } from './core/bondShader'
export {
  createBondState,
  createCameraRigState,
  createGlowState,
  createHudState,
  createPostDirector,
  createPuffVolumeState,
  createWaveState,
  type BondState,
  type CameraRigState,
  type GlowState,
  type HudState,
  type PostDirector,
  type PuffVolumeState,
  type WaveState,
} from './core/states'

// ——— react ———
export { useStoryClock } from './react/useStoryClock'
export { CinemaAtom } from './react/CinemaAtom'
export { CinemaBond } from './react/CinemaBond'
export { CinemaPuffVolume } from './react/CinemaPuffVolume'
export { CinemaBurst, CinemaVfxStage, type VfxHandle, type VfxPreset } from './react/CinemaVfx'
export { CinemaFlash, CinemaHalo, CinemaReactionZone, CinemaShockwave } from './react/CinemaFx'
export { CinemaCaption, CinemaCounter, CinemaOxidationTag } from './react/CinemaHud'
export { CinemaPostFx, type CinemaToneMapping } from './react/CinemaPostFx'
export { CinemaCameraRig, CinemaEnvironment } from './react/CinemaStage'
export { CinemaTimeProvider, setCinemaTimeFrozen, useCinemaTime, type CinemaTimeState } from './react/CinemaTime'
export { InstancedAtoms, type InstancedAtomsProps } from './react/InstancedAtoms'
export { InstancedBonds, type InstancedBondsProps } from './react/InstancedBonds'
export { OrbitalLobes } from './react/OrbitalLobes'
export { OrbitalRaymarch, type OrbitalRaymarchProps } from './react/OrbitalRaymarch'
export { CinemaLightRig } from './react/CinemaLightRig'
export { CinemaGlowPoints, type GlowPointsHandle } from './react/CinemaGlowPoints'
export { CinemaDomLabels, type DomLabelSource } from './react/CinemaDomLabels'

/** Полная выгрузка кэшей библиотеки — при закрытии 3D-лаборатории. */
export function disposeCinemaCaches(): void {
  // Импорты внутри функции: выгрузка нужна редко, а модули уже загружены.
  void Promise.all([
    import('./core/geometries').then((m) => m.disposeCinemaGeometries()),
    import('./core/materials').then((m) => m.disposeCinemaMaterials()),
    import('./core/textures').then((m) => m.disposeCinemaTextures()),
    import('./core/envLighting').then((m) => m.disposeLabEnvironment()),
  ])
}

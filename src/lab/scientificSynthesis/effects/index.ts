/**
 * Библиотека эффектов научного микромира (образование вещества).
 * Переиспользуется для ClO₂ и следующих реакций.
 */
export { resolveSciFxQuality, type SciFxQuality, type SciFxQualityOpts } from './quality'
export { sharedSphere, sharedUnitCylinder, sharedRing, sharedCircle } from './sharedGeometries'
export { SciProAtom } from './SciProAtom'
export { SciEnergyBond } from './SciEnergyBond'
export { SciPlasmaBond } from './SciPlasmaBond'
export { SciFormationBurst } from './SciFormationBurst'
export { SciReactionZone, SciShockwave } from './SciReactionZone'
export { SciStoichBadge, SciStageCaption, SciElectronImpulse, SciAmberHalo } from './SciHud'
export { SciCinematicPostFx, type SciPostDirector } from './SciCinematicPostFx'
export { SciMicrocosmEnv } from './SciMicrocosmEnv'
export { SCI_CPK, SCI_CPK_HEX } from './sciCpk'
export { useCh4CinematicDirector, type Ch4DirectorState } from './useCh4CinematicDirector'

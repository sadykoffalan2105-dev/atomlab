/**
 * ATOMLAB — научное ядро данных. Единственный источник истины для всех кинo-сцен,
 * панелей энергии и тестов. Ни three, ни React здесь нет: модули читаются и в Node.
 *
 * Правило проекта: сцена НЕ хранит собственных чисел — радиусы, длины связей,
 * углы, параметры решёток и энтальпии берутся отсюда.
 */

export {
  ATOMIC_DATA,
  ELEMENT_SYMBOLS,
  atomicRadiusPm,
  chargeKey,
  covalentRadiusPm,
  cpkColor,
  cpkCss,
  getElement,
  ionChargesOf,
  ionicRadiusPm,
  isElementSymbol,
  metallicRadiusPm,
  radiusForSpecies,
  type AtomicDatum,
  type ElementSymbol,
  type IonicRadiiPm,
} from './atomicData'

export {
  BOND_ANGLES,
  BOND_DATA,
  DIPOLE_MOMENTS,
  bondAngleDeg,
  bondEnthalpyKJ,
  bondLengthPm,
  dipoleDebye,
  type AngleDatum,
  type AngleKey,
  type BondDatum,
  type BondKey,
  type DipoleDatum,
} from './bondData'

export {
  CRYSTAL_DATA,
  CRYSTAL_IDS,
  cellAngstrom,
  getCrystal,
  isCationSite,
  type CrystalDatum,
  type LatticeType,
} from './crystalData'

export {
  BORN_HABER,
  FORMATION_ENTHALPY,
  HYDRATION_ENTHALPY_KJ,
  LATTICE_ENTHALPY_KJ,
  MOLECULAR_REACTIONS,
  OXIDE_SECOND_EA_KJ,
  STANDARD_POTENTIALS_V,
  bornHaberResidualKJ,
  bornHaberSumKJ,
  cellPotentialV,
  dHfKJ,
  isExothermic,
  standardPotentialV,
  reactionEnthalpyBothKJ,
  reactionEnthalpyFromBondsKJ,
  reactionEnthalpyFromFormationKJ,
  type BondTerm,
  type BornHaberCycle,
  type BornHaberKind,
  type BornHaberStage,
  type FormationDatum,
  type MolecularReaction,
  type SpeciesTerm,
} from './thermoData'

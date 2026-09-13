import {
  getSynthesisDeviceClassification,
  type DeviceClassification,
  type DeviceFormFactor,
  type GpuClass,
  type SynthesisDeviceTier,
} from './synthesisDeviceTier'
import { SYNTHESIS_PERF } from './synthesisPerfPreset'

/** Профиль для Snapdragon / слабых GPU — без лагов и без лишних эффектов. */
export type LowPowerDeviceProfile = {
  tier: SynthesisDeviceTier
  /** Телефон / планшет / Android SoC / Adreno-Mali-PowerVR (Apple Silicon на Mac — нет). */
  isMobileSoc: boolean
  forceLiteReactor: boolean
  maxAnimatedAtoms: number
  minElectronFrameSkip: number
  canvasDpr: number
  disableAtomDrift: boolean
  disableSlowSpin: boolean
  productPaintLatchFrames: number
  coeffEditLayoutDebounceMs: number
  /** Класс GPU из классификации устройства (по умолчанию 'unknown'). */
  gpuClass?: GpuClass
  /** Форм-фактор (по умолчанию 'desktop'). */
  formFactor?: DeviceFormFactor
}

/** Чистая сборка профиля — tier (возможно уточнённый по FPS) + статическая классификация. */
export function buildLowPowerDeviceProfile(
  deviceTier: SynthesisDeviceTier,
  classification: Pick<DeviceClassification, 'isMobileSoc' | 'gpu' | 'formFactor'>,
): LowPowerDeviceProfile {
  const mobileSoc = classification.isMobileSoc
  const low = deviceTier === 'low' || mobileSoc
  return {
    tier: deviceTier,
    isMobileSoc: mobileSoc,
    forceLiteReactor: low,
    maxAnimatedAtoms: low ? 24 : SYNTHESIS_PERF.maxAnimatedAtoms,
    minElectronFrameSkip: low ? 3 : 1,
    canvasDpr: low ? 1 : 1.5,
    disableAtomDrift: low,
    disableSlowSpin: low,
    productPaintLatchFrames: low ? 2 : 4,
    coeffEditLayoutDebounceMs: low ? 48 : 32,
    gpuClass: classification.gpu,
    formFactor: classification.formFactor,
  }
}

let cached: LowPowerDeviceProfile | null = null

export function getLowPowerDeviceProfile(deviceTier: SynthesisDeviceTier): LowPowerDeviceProfile {
  if (cached && cached.tier === deviceTier) return cached
  cached = buildLowPowerDeviceProfile(deviceTier, getSynthesisDeviceClassification())
  return cached
}

export function resetLowPowerDeviceProfileCache(): void {
  cached = null
}

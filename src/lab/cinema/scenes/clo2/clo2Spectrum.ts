/**
 * Цвет раствора ClO₂ из спектра, а не «на глаз».
 *
 * Модель:
 *   • полоса поглощения Ã²A₂ ← X̃²B₁: λmax 359 нм, ε = 1250 М⁻¹см⁻¹ (ClO₂(aq));
 *   • форма полосы — гауссиана по волновому числу, центр 10⁷/359 ≈ 27 855 см⁻¹.
 *     Ширина (FWHM ≈ 5500 см⁻¹) — ОЦЕНКА, не измерение: для точности нужен
 *     оцифрованный спектр водного раствора. Водные полосы широкие и без
 *     колебательной структуры (она видна только в газе);
 *   • Бугер — Ламберт — Бер: A(λ) = ε(λ)·c·l, T(λ) = 10^(−A);
 *   • свет — стандартный источник D65, глаз — CIE 1931 2° (таблица 380–780 нм, шаг 10 нм);
 *   • XYZ → линейный sRGB (матрица IEC 61966-2-1) → нормировка так, чтобы чистая
 *     вода (T = 1) давала ровно белый → гамма sRGB.
 *
 * Жёлтый цвет даёт не сам максимум 359 нм (это УФ), а хвост полосы выше 400 нм:
 * раствор съедает фиолетовый и синий. Больше концентрация — хвост глубже, цвет
 * темнее и насыщеннее. Без THREE и React: файл читают тесты и DOM-виджеты.
 */

export type Clo2BandModel = {
  /** максимум полосы, нм */
  lambdaMaxNm: number
  /** молярный коэффициент поглощения в максимуме, М⁻¹см⁻¹ */
  epsilonMax: number
  /** полная ширина на полувысоте в шкале волновых чисел, см⁻¹ (оценка) */
  fwhmCm1: number
}

/** ClO₂(aq): λmax 359 нм, ε 1250 М⁻¹см⁻¹; ширина — оценка. */
export const CLO2_BAND: Clo2BandModel = {
  lambdaMaxNm: 359,
  epsilonMax: 1250,
  fwhmCm1: 5500,
}

/**
 * CIE 1931 2° (x̄, ȳ, z̄) и относительный спектр D65 (S) — строки по 10 нм, 380…780.
 * Проверка таблицы: белая точка D65 на этой сетке x = 0,3127, y = 0,3291.
 */
const SPECTRAL_START_NM = 380
const SPECTRAL_STEP_NM = 10
// prettier-ignore
const CIE_D65_10NM: readonly number[] = [
  // x̄        ȳ         z̄         S(D65)
  0.001368, 0.000039, 0.006450, 49.9755, // 380
  0.004243, 0.000120, 0.020050, 54.6482, // 390
  0.014310, 0.000396, 0.067850, 82.7549, // 400
  0.043510, 0.001210, 0.207400, 91.4860, // 410
  0.134380, 0.004000, 0.645600, 93.4318, // 420
  0.283900, 0.011600, 1.385600, 86.6823, // 430
  0.348280, 0.023000, 1.747060, 104.865, // 440
  0.336200, 0.038000, 1.772110, 117.008, // 450
  0.290800, 0.060000, 1.669200, 117.812, // 460
  0.195360, 0.090980, 1.287640, 114.861, // 470
  0.095640, 0.139020, 0.812950, 115.923, // 480
  0.032010, 0.208020, 0.465180, 108.811, // 490
  0.004900, 0.323000, 0.272000, 109.354, // 500
  0.009300, 0.503000, 0.158200, 107.802, // 510
  0.063270, 0.710000, 0.078250, 104.790, // 520
  0.165500, 0.862000, 0.042160, 107.689, // 530
  0.290400, 0.954000, 0.020300, 104.405, // 540
  0.433450, 0.994950, 0.008750, 104.046, // 550
  0.594500, 0.995000, 0.003900, 100.000, // 560
  0.762100, 0.952000, 0.002100, 96.3342, // 570
  0.916300, 0.870000, 0.001650, 95.7880, // 580
  1.026300, 0.757000, 0.001100, 88.6856, // 590
  1.062200, 0.631000, 0.000800, 90.0062, // 600
  1.002600, 0.503000, 0.000340, 89.5991, // 610
  0.854450, 0.381000, 0.000190, 87.6987, // 620
  0.642400, 0.265000, 0.000050, 83.2886, // 630
  0.447900, 0.175000, 0.000020, 83.6992, // 640
  0.283500, 0.107000, 0.000000, 80.0268, // 650
  0.164900, 0.061000, 0.000000, 80.2146, // 660
  0.087400, 0.032000, 0.000000, 82.2778, // 670
  0.046770, 0.017000, 0.000000, 78.2842, // 680
  0.022700, 0.008210, 0.000000, 69.7213, // 690
  0.011359, 0.004102, 0.000000, 71.6091, // 700
  0.005790, 0.002091, 0.000000, 74.3490, // 710
  0.002899, 0.001047, 0.000000, 61.6040, // 720
  0.001440, 0.000520, 0.000000, 69.8856, // 730
  0.000690, 0.000249, 0.000000, 75.0870, // 740
  0.000332, 0.000120, 0.000000, 63.5927, // 750
  0.000166, 0.000060, 0.000000, 46.4182, // 760
  0.000083, 0.000030, 0.000000, 66.8054, // 770
  0.000042, 0.000015, 0.000000, 63.3828, // 780
]

const SPECTRAL_ROWS = CIE_D65_10NM.length / 4

/** XYZ (D65) → линейный sRGB, IEC 61966-2-1. */
function xyzToLinearSrgb(x: number, y: number, z: number): [number, number, number] {
  return [
    3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    -0.969266 * x + 1.8760108 * y + 0.041556 * z,
    0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
  ]
}

function linearToSrgb(c: number): number {
  const v = c <= 0 ? 0 : c >= 1 ? 1 : c
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
}

/** Интеграл Σ S·{x̄,ȳ,z̄}·T по таблице; нормировка — белый Y = 1. */
function integrateXyz(transmittance: (nm: number) => number): [number, number, number] {
  let x = 0
  let y = 0
  let z = 0
  let yWhite = 0
  for (let i = 0; i < SPECTRAL_ROWS; i++) {
    const nm = SPECTRAL_START_NM + i * SPECTRAL_STEP_NM
    const o = i * 4
    const s = CIE_D65_10NM[o + 3]!
    const t = transmittance(nm)
    x += s * CIE_D65_10NM[o]! * t
    y += s * CIE_D65_10NM[o + 1]! * t
    z += s * CIE_D65_10NM[o + 2]! * t
    yWhite += s * CIE_D65_10NM[o + 1]!
  }
  return [x / yWhite, y / yWhite, z / yWhite]
}

/** Белый (T = 1) в линейном sRGB на этой таблице — чуть не (1,1,1) из-за шага 10 нм; делим на него. */
const WHITE_LINEAR = xyzToLinearSrgb(...integrateXyz(() => 1))

/** Яркость Y линейного sRGB (Rec. 709). */
function linearLuminance(c: readonly number[]): number {
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!
}

/**
 * Цвет вне гаммы sRGB. Жёлтый фильтр почти не теряет яркости, поэтому G может
 * выйти чуть за 1 (минус у X̄ в строке G), а густой раствор даёт B < 0:
 *   • B < 0 — сдвиг к серому той же яркости, пока канал не станет 0 (теряется
 *     часть насыщенности, оттенок сохраняется);
 *   • канал > 1 — все каналы делятся на максимум («экспозиция» чуть ниже,
 *     цветность сохраняется). Поканальная обрезка сдвигала бы оттенок.
 */
function fitToGamut(c: [number, number, number]): void {
  const y = Math.max(0, linearLuminance(c))
  let k = 1
  for (let i = 0; i < 3; i++) {
    const d = c[i]! - y
    if (c[i]! < 0 && d < 0) k = Math.min(k, -y / d)
  }
  let max = 0
  for (let i = 0; i < 3; i++) {
    c[i] = y + (c[i]! - y) * k
    max = Math.max(max, c[i]!)
  }
  const scale = max > 1 ? 1 / max : 1
  for (let i = 0; i < 3; i++) {
    const v = c[i]! * scale
    c[i] = v <= 0 ? 0 : v >= 1 ? 1 : v
  }
}

/** ε(λ), М⁻¹см⁻¹ — гауссиана по волновому числу. */
export function clo2Absorptivity(nm: number, band: Clo2BandModel = CLO2_BAND): number {
  const nu = 1e7 / nm
  const nu0 = 1e7 / band.lambdaMaxNm
  const d = (nu - nu0) / band.fwhmCm1
  return band.epsilonMax * Math.exp(-4 * Math.LN2 * d * d)
}

/** Поглощение A = ε·c·l (десятичное). */
export function clo2Absorbance(nm: number, concMolar: number, pathCm: number, band: Clo2BandModel = CLO2_BAND): number {
  return clo2Absorptivity(nm, band) * Math.max(0, concMolar) * Math.max(0, pathCm)
}

export type Clo2Rgb = readonly [number, number, number]

export type Clo2SolutionColor = {
  concMolar: number
  pathCm: number
  /** 0xRRGGBB, sRGB (гамма) — как THREE.Color.setHex */
  hex: number
  /** '#rrggbb' для CSS */
  css: string
  /** sRGB с гаммой, 0…1 */
  srgb: Clo2Rgb
  /** линейный sRGB 0…1 (для пулов/шейдеров: цвета там линейные) */
  linearRgb: Clo2Rgb
  /** CIE XYZ, белый Y = 1 */
  xyz: Clo2Rgb
  /** T(λ) = 10^(−εcl), 0…1 */
  transmittanceAt: (nm: number) => number
}

/**
 * Цвет раствора ClO₂ концентрации concMolar (М) в слое pathCm (см) на белом свете D65.
 * Вне гаммы sRGB цвет обесцвечивается при той же яркости (см. fitToGamut).
 * Функция не для кадра: считает 41 точку и создаёт объект.
 */
export function clo2SolutionColor(concMolar: number, pathCm: number, band: Partial<Clo2BandModel> = {}): Clo2SolutionColor {
  const model: Clo2BandModel = { ...CLO2_BAND, ...band }
  const transmittanceAt = (nm: number) => Math.pow(10, -clo2Absorbance(nm, concMolar, pathCm, model))
  const xyz = integrateXyz(transmittanceAt)
  const raw = xyzToLinearSrgb(xyz[0], xyz[1], xyz[2])
  const lin: [number, number, number] = [0, 0, 0]
  for (let i = 0; i < 3; i++) lin[i] = raw[i]! / WHITE_LINEAR[i]!
  fitToGamut(lin)
  const srgb: [number, number, number] = [0, 0, 0]
  let hex = 0
  for (let i = 0; i < 3; i++) {
    srgb[i] = linearToSrgb(lin[i]!)
    hex = (hex << 8) | Math.round(srgb[i]! * 255)
  }
  return {
    concMolar,
    pathCm,
    hex,
    css: `#${hex.toString(16).padStart(6, '0')}`,
    srgb,
    linearRgb: lin,
    xyz,
    transmittanceAt,
  }
}

/** Концентрация и кювета для урока: 5 мМ ClO₂ (~340 мг/л), слой 1 см. */
export const CLO2_LESSON_CONC_M = 0.005
export const CLO2_LESSON_PATH_CM = 1

/** Цвет раствора урока — замена «на глаз» подобранного 0xe8c64a. */
export const CLO2_LESSON_COLOR: Clo2SolutionColor = clo2SolutionColor(CLO2_LESSON_CONC_M, CLO2_LESSON_PATH_CM)

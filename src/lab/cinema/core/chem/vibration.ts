import { SCENE_PER_ANGSTROM } from '../atoms'

/**
 * ATOMLAB Cinema — честные нормальные колебания.
 *
 * Частоты — экспериментальные (газовая фаза), соотношения между модами сохраняются
 * ТОЧНО; меняется только масштаб времени, иначе колебание длилось бы фемтосекунды:
 *   ClO₂: ν₁ (симм. валентное) 945.6, ν₂ (деформационное) 447.7, ν₃ (антисимм. валентное) 1110.1 см⁻¹;
 *   Cl₂:  ωe = 559.72, ωexe = 2.675 см⁻¹ → фундаментальная G(1) − G(0) = ωe − 2ωexe ≈ 554.4 см⁻¹ (NIST).
 *
 * Экранное время: ν₂(ClO₂) ↔ 1.0 Гц, отсюда ν₁ ≈ 2.11 Гц, ν₃ ≈ 2.48 Гц, Cl₂ ≈ 1.24 Гц.
 * Всё ниже 3 Гц — без стробоскопа (ограничение вспышек WCAG 2.3.1 — 3 в секунду).
 * Реальная частота в Гц = ν̃·c, поэтому замедление ≈ 1.34·10¹³ — это число для бейджа
 * «замедлено в ~10¹³ раз».
 *
 * Амплитуды — мировые единицы сцены и ПРЕУВЕЛИЧЕНЫ: нулевая (квантовая) амплитуда
 * валентного колебания ≈ 0.04 Å ≈ 0.011 ед. сцены — это ~7 % радиуса сферы O, глазом
 * не видно. Рекомендуемые значения `CLO2_VIB_AMP` / `CL2_VIB_AMP` — нулевая амплитуда × 6
 * (`VIB_EXAGGERATION`), и об этом нужно сказать на экране.
 *
 * Функции мутируют THREE.Vector3-подобные объекты на месте: сцена сначала пишет
 * равновесные позиции из раскадровки, затем накладывает колебание. Аллокаций нет.
 */

/** Любой объект с изменяемыми x, y, z (THREE.Vector3 подходит). */
export type Vec3Like = { x: number; y: number; z: number }

/** Тройка величин по модам изогнутой молекулы XY₂. */
export type BentModeTriple = { sym: number; bend: number; asym: number }

/** Скорость света, см/с — перевод волновых чисел см⁻¹ в Гц. */
export const SPEED_OF_LIGHT_CM_PER_S = 2.99792458e10

/** Атомные массы, а. е. м. */
export const ATOMIC_MASS = { O: 16.0, Cl: 35.45 } as const

/** Фундаментальные частоты ClO₂, см⁻¹. */
export const CLO2_VIB_CM1 = { sym: 945.6, bend: 447.7, asym: 1110.1 } as const satisfies BentModeTriple

/** Спектроскопические константы Cl₂ (X¹Σg⁺), см⁻¹. */
export const CL2_OMEGA_E_CM1 = 559.72
export const CL2_OMEGA_E_XE_CM1 = 2.675
/** Фундаментальный переход Cl₂ v=0→1 с учётом ангармоничности, см⁻¹ (≈ 554.37). */
export const CL2_FUNDAMENTAL_CM1 = CL2_OMEGA_E_CM1 - 2 * CL2_OMEGA_E_XE_CM1

/** Экранная частота на 1 см⁻¹: ν₂(ClO₂) = 447.7 см⁻¹ ↔ 1 Гц на экране. */
export const VIB_SCREEN_HZ_PER_CM1 = 1 / CLO2_VIB_CM1.bend

/** Во сколько раз экранное колебание медленнее настоящего (≈ 1.34·10¹³). */
export const VIB_SLOWDOWN = SPEED_OF_LIGHT_CM_PER_S / VIB_SCREEN_HZ_PER_CM1

/** Потолок экранной частоты для любых мод урока, Гц (выше — стробоскоп). */
export const VIB_MAX_SCREEN_HZ = 3

/** Во сколько раз амплитуды на экране больше нулевых (подписывать на экране). */
export const VIB_EXAGGERATION = 6

/** Экранная частота моды, Гц. */
export function screenHz(cm1: number): number {
  return cm1 * VIB_SCREEN_HZ_PER_CM1
}

/** Настоящая частота моды, Гц. */
export function realHz(cm1: number): number {
  return cm1 * SPEED_OF_LIGHT_CM_PER_S
}

/** Настоящий период колебания, фс (ν₃ ClO₂ ≈ 30 фс). */
export function vibrationPeriodFs(cm1: number): number {
  return 1e15 / realHz(cm1)
}

const HBAR = 1.054571817e-34
const AMU_KG = 1.6605390666e-27

/**
 * Среднеквадратичная нулевая амплитуда гармонического осциллятора, Å:
 * x_rms = √(ħ / (2μω)), ω = 2πc·ν̃. Двухатомное приближение (μ — приведённая масса связи).
 */
export function zeroPointRmsA(cm1: number, reducedMassAmu: number): number {
  const omega = 2 * Math.PI * realHz(cm1)
  return Math.sqrt(HBAR / (2 * reducedMassAmu * AMU_KG * omega)) * 1e10
}

const MU_CLO = (ATOMIC_MASS.Cl * ATOMIC_MASS.O) / (ATOMIC_MASS.Cl + ATOMIC_MASS.O)
const MU_CLCL = ATOMIC_MASS.Cl / 2

/**
 * Рекомендуемые экранные амплитуды ClO₂ (ед. сцены) = нулевая амплитуда × VIB_EXAGGERATION.
 * Оценка в двухатомном приближении с μ(Cl–O) для всех трёх мод (≈ 0.040 / 0.058 / 0.037 Å):
 * у мягкой деформационной моды нулевая амплитуда больше — это честно.
 * Для bend это смещение каждого O по дуге (перпендикулярно связи).
 */
export const CLO2_VIB_AMP: BentModeTriple = {
  sym: zeroPointRmsA(CLO2_VIB_CM1.sym, MU_CLO) * VIB_EXAGGERATION * SCENE_PER_ANGSTROM,
  bend: zeroPointRmsA(CLO2_VIB_CM1.bend, MU_CLO) * VIB_EXAGGERATION * SCENE_PER_ANGSTROM,
  asym: zeroPointRmsA(CLO2_VIB_CM1.asym, MU_CLO) * VIB_EXAGGERATION * SCENE_PER_ANGSTROM,
}

/** Рекомендуемая экранная амплитуда растяжения Cl₂ (ед. сцены), нулевая × VIB_EXAGGERATION. */
export const CL2_VIB_AMP = zeroPointRmsA(CL2_FUNDAMENTAL_CM1, MU_CLCL) * VIB_EXAGGERATION * SCENE_PER_ANGSTROM

const TAU = Math.PI * 2

/** Мгновенная нормальная координата моды: amp·sin(2π·f_screen·t + phase). */
export function modeCoordinate(t: number, cm1: number, amp: number, phase = 0): number {
  return amp * Math.sin(TAU * screenHz(cm1) * t + phase)
}

/**
 * Огибающая «звона» после события (разрыв/образование связи): 0 до события,
 * затем e^(−t/τ). В t = 0 огибающая 1, а синус моды 0 — положение непрерывно.
 * В воде реальное затухание — пикосекунды; τ здесь экранный, выбирается режиссёром.
 */
export function ringDown(tSinceEvent: number, tau: number): number {
  if (!(tSinceEvent >= 0) || !(tau > 0)) return 0
  return Math.exp(-tSinceEvent / tau)
}

/**
 * Три нормальные моды изогнутой XY₂ (ClO₂: X = Cl в центре, Y = O) поверх равновесной геометрии.
 *
 * Строим новую ВНУТРЕННЮЮ геометрию, затем расставляем атомы так, чтобы центр масс
 * остался на месте (точно), а биссектриса угла не поворачивалась:
 *   • sym  (ν₁, A₁): r₁ = r₂ = r + q — обе связи удлиняются вместе, угол постоянен;
 *   • bend (ν₂, A₁): каждый Y смещается по дуге на q (половина угла +q/r), длины постоянны;
 *   • asym (ν₃, B₂): r₁ = r + q, r₂ = r − q — одна связь удлиняется, другая укорачивается,
 *     центральный атом при этом смещается вдоль линии Y···Y к укорачивающейся связи.
 * Центральный атом движется навстречу лигандам — так и выглядят настоящие моды.
 * Качественная модель: без связи мод и ангармоничности; для asym возможен малый
 * (порядка q·m_Y/M) поворот, которым пренебрегаем.
 *
 * `amp` — амплитуды мод в мировых единицах (0 — мода выключена), `freqCm1` — частоты
 * (обычно CLO2_VIB_CM1), `phase` — общий сдвиг фазы (разный для разных молекул в кадре).
 */
export function applyBentTriatomicModes(
  center: Vec3Like,
  l1: Vec3Like,
  l2: Vec3Like,
  t: number,
  amp: BentModeTriple,
  freqCm1: BentModeTriple,
  phase = 0,
  massCenter: number = ATOMIC_MASS.Cl,
  massLigand: number = ATOMIC_MASS.O,
): void {
  const cx = center.x
  const cy = center.y
  const cz = center.z
  const ax = l1.x - cx
  const ay = l1.y - cy
  const az = l1.z - cz
  const bx = l2.x - cx
  const by = l2.y - cy
  const bz = l2.z - cz
  const r1 = Math.sqrt(ax * ax + ay * ay + az * az)
  const r2 = Math.sqrt(bx * bx + by * by + bz * bz)
  if (r1 < 1e-9 || r2 < 1e-9) return

  // Единичные направления связей.
  const u1x = ax / r1
  const u1y = ay / r1
  const u1z = az / r1
  const u2x = bx / r2
  const u2y = by / r2
  const u2z = bz / r2

  // e — вдоль Y···Y (u1 − u2), s — биссектриса (u1 + u2). |u1 − u2| = 2·sin α, |u1 + u2| = 2·cos α.
  let ex = u1x - u2x
  let ey = u1y - u2y
  let ez = u1z - u2z
  const el = Math.sqrt(ex * ex + ey * ey + ez * ez)
  if (el < 1e-9) return // лиганды на одном направлении — геометрия вырождена
  ex /= el
  ey /= el
  ez /= el
  let sx = u1x + u2x
  let sy = u1y + u2y
  let sz = u1z + u2z
  const sl = Math.sqrt(sx * sx + sy * sy + sz * sz)
  if (sl < 1e-6) {
    // Линейная молекула: биссектриса — любой перпендикуляр к e.
    const px = Math.abs(ex) < 0.9 ? 1 : 0
    const py = px === 1 ? 0 : 1
    // s = e × (px, py, 0)
    sx = -ez * py
    sy = ez * px
    sz = ex * py - ey * px
    const pl = Math.sqrt(sx * sx + sy * sy + sz * sz)
    sx /= pl
    sy /= pl
    sz /= pl
  } else {
    sx /= sl
    sy /= sl
    sz /= sl
  }
  const halfAngle = Math.atan2(el, sl)

  // Нормальные координаты.
  const qs = amp.sym ? modeCoordinate(t, freqCm1.sym, amp.sym, phase) : 0
  const qb = amp.bend ? modeCoordinate(t, freqCm1.bend, amp.bend, phase) : 0
  const qa = amp.asym ? modeCoordinate(t, freqCm1.asym, amp.asym, phase) : 0

  // Новая внутренняя геометрия (с защитой от вырождения при огромных амплитудах).
  const rMean = 0.5 * (r1 + r2)
  let alpha = halfAngle + qb / rMean
  if (alpha < 0.05) alpha = 0.05
  else if (alpha > Math.PI / 2) alpha = Math.PI / 2
  const nr1 = Math.max(r1 + qs + qa, 0.1 * r1)
  const nr2 = Math.max(r2 + qs - qa, 0.1 * r2)
  const ca = Math.cos(alpha)
  const sa = Math.sin(alpha)

  // Векторы связей в новой геометрии: w = r·(cos α·s ± sin α·e).
  const w1x = nr1 * (ca * sx + sa * ex)
  const w1y = nr1 * (ca * sy + sa * ey)
  const w1z = nr1 * (ca * sz + sa * ez)
  const w2x = nr2 * (ca * sx - sa * ex)
  const w2y = nr2 * (ca * sy - sa * ey)
  const w2z = nr2 * (ca * sz - sa * ez)

  // Центр масс сохраняется точно: c' = R − m_Y·(w1 + w2)/M.
  const M = massCenter + 2 * massLigand
  const Rx = (massCenter * cx + massLigand * (l1.x + l2.x)) / M
  const Ry = (massCenter * cy + massLigand * (l1.y + l2.y)) / M
  const Rz = (massCenter * cz + massLigand * (l1.z + l2.z)) / M
  const k = massLigand / M
  const ncx = Rx - k * (w1x + w2x)
  const ncy = Ry - k * (w1y + w2y)
  const ncz = Rz - k * (w1z + w2z)

  center.x = ncx
  center.y = ncy
  center.z = ncz
  l1.x = ncx + w1x
  l1.y = ncy + w1y
  l1.z = ncz + w1z
  l2.x = ncx + w2x
  l2.y = ncy + w2y
  l2.z = ncz + w2z
}

/**
 * Валентное колебание двухатомной молекулы A–B вдоль оси связи: длина r + q,
 * смещения обратно пропорциональны массам — центр масс неподвижен (точно).
 * По умолчанию Cl₂; частота обычно CL2_FUNDAMENTAL_CM1, амплитуда — CL2_VIB_AMP.
 */
export function applyDiatomicStretch(
  a: Vec3Like,
  b: Vec3Like,
  t: number,
  amp: number,
  freqCm1: number,
  massA: number = ATOMIC_MASS.Cl,
  massB: number = ATOMIC_MASS.Cl,
  phase = 0,
): void {
  if (!amp) return
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dz = b.z - a.z
  const r = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (r < 1e-9) return
  const q = modeCoordinate(t, freqCm1, amp, phase)
  const M = massA + massB
  const qa = (q * massB) / (M * r)
  const qb = (q * massA) / (M * r)
  a.x -= dx * qa
  a.y -= dy * qa
  a.z -= dz * qa
  b.x += dx * qb
  b.y += dy * qb
  b.z += dz * qb
}

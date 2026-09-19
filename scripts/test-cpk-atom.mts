#!/usr/bin/env node
/**
 * CPK-сферы реактора: радиусы, цвета, подписи.
 * Запуск: npx tsx scripts/test-cpk-atom.mts
 */
import assert from 'node:assert/strict'
import {
  CPK_MAX_RADIUS,
  CPK_MIN_RADIUS,
  cpkBreathPhase,
  cpkBreathScale,
  cpkChargeLabel,
  cpkCloudRadius,
  cpkColorHex,
  cpkHaloSize,
  cpkLabelIndices,
  cpkLabelOffsetY,
  cpkLabelSize,
  cpkPreviewRadius,
  cpkRadiusPm,
  cpkSpecies,
  cpkSymbolForZ,
  cpkVdwRadiusPm,
} from '../src/components/lab/atom/cpkAtomVisual.ts'
import { PREVIEW_ATOM_MIN_GAP } from '../src/components/lab/reactorPreviewLayout.ts'

let checks = 0
function eq<T>(actual: T, expected: T, msg: string): void {
  assert.deepEqual(actual, expected, msg)
  checks += 1
}
function ok(cond: boolean, msg: string): void {
  assert.ok(cond, msg)
  checks += 1
}

// --- символы -----------------------------------------------------------------
{
  eq(cpkSymbolForZ(1), 'H', 'Z=1 → H')
  eq(cpkSymbolForZ(11), 'Na', 'Z=11 → Na')
  eq(cpkSymbolForZ(17), 'Cl', 'Z=17 → Cl')
  eq(cpkSymbolForZ(30), 'Zn', 'Z=30 → Zn')
  eq(cpkSymbolForZ(0), null, 'Z=0 — элемента нет')
}

// --- ван-дер-ваальсовы радиусы (Bondi 1964 / Alvarez 2013) -------------------
{
  eq(cpkVdwRadiusPm(1), 120, 'H вдв 120 пм')
  eq(cpkVdwRadiusPm(6), 170, 'C вдв 170 пм')
  eq(cpkVdwRadiusPm(7), 155, 'N вдв 155 пм')
  eq(cpkVdwRadiusPm(8), 152, 'O вдв 152 пм')
  eq(cpkVdwRadiusPm(17), 175, 'Cl вдв 175 пм')
  eq(cpkVdwRadiusPm(11), 227, 'Na вдв 227 пм')
  eq(cpkVdwRadiusPm(19), 275, 'K вдв 275 пм')
  // Порядок по периоду и группе: O < N < C, Na < K.
  ok(cpkVdwRadiusPm(8) < cpkVdwRadiusPm(7), 'O меньше N')
  ok(cpkVdwRadiusPm(7) < cpkVdwRadiusPm(6), 'N меньше C')
  ok(cpkVdwRadiusPm(11) < cpkVdwRadiusPm(19), 'Na меньше K')
}

// --- ионы: Шеннон, КЧ 6 ------------------------------------------------------
{
  eq(cpkRadiusPm(11, 0), 227, 'Na⁰ — вдв 227 пм')
  eq(cpkRadiusPm(11, 1), 102, 'Na⁺ — Шеннон 102 пм')
  eq(cpkRadiusPm(17, -1), 181, 'Cl⁻ — Шеннон 181 пм')
  eq(cpkRadiusPm(12, 2), 72, 'Mg²⁺ — Шеннон 72 пм')
  eq(cpkRadiusPm(8, -2), 140, 'O²⁻ — Шеннон 140 пм')

  // Главная проверка профессора: катион МЕНЬШЕ своего атома, анион — БОЛЬШЕ катиона.
  ok(cpkRadiusPm(11, 1) < cpkRadiusPm(11, 0), 'Na⁺ меньше атома Na')
  ok(cpkRadiusPm(17, -1) > cpkRadiusPm(17, 0) * 0.9, 'Cl⁻ не меньше атома Cl по порядку')
  const ratio = cpkRadiusPm(17, -1) / cpkRadiusPm(11, 1)
  ok(ratio > 1.7 && ratio < 1.85, `Cl⁻ / Na⁺ ≈ 1.77, получено ${ratio.toFixed(2)}`)

  // И то же самое на экране, а не только в таблице.
  const rNaPlus = cpkPreviewRadius(11, 1)
  const rClMinus = cpkPreviewRadius(17, -1)
  const visual = rClMinus / rNaPlus
  ok(visual > 1.7 && visual < 1.85, `на экране Cl⁻ / Na⁺ = ${visual.toFixed(2)}`)
  ok(cpkPreviewRadius(11, 1) < cpkPreviewRadius(11, 0), 'на экране Na⁺ меньше Na⁰')
}

// --- мировые радиусы влезают в раскладку превью ------------------------------
{
  const commonZ = [1, 6, 7, 8, 9, 11, 12, 13, 15, 16, 17, 19, 20, 24, 25, 26, 29, 30, 35, 53, 56, 82]
  for (const z of commonZ) {
    const r = cpkPreviewRadius(z)
    ok(r >= CPK_MIN_RADIUS && r <= CPK_MAX_RADIUS, `Z=${z}: радиус ${r} в пределах отсечек`)
    // Два соседних слота не сливаются: 2r < минимальный зазор между центрами.
    ok(2 * r < PREVIEW_ATOM_MIN_GAP, `Z=${z}: диаметр ${(2 * r).toFixed(3)} < зазора ${PREVIEW_ATOM_MIN_GAP}`)
  }
  // Даже самый крупный элемент таблицы не перекрывает соседа.
  ok(2 * cpkPreviewRadius(55) < PREVIEW_ATOM_MIN_GAP, 'Cs (343 пм) обрезан отсечкой')
  // Пропорции сохраняются: K заметно крупнее H.
  const k = cpkPreviewRadius(19) / cpkPreviewRadius(1)
  ok(k > 2.2 && k < 2.4, `K / H на экране = ${k.toFixed(2)} (275/120 = 2.29)`)
}

// --- цвета CPK ---------------------------------------------------------------
{
  // Значения берутся из выверенной ATOMIC_DATA (chemistry/data), а не из Jmol:
  // у Cl там именно жёлто-зелёный, у Ca — тёмно-зелёный, как требует стандарт.
  eq(cpkColorHex(1), '#ffffff', 'H белый')
  eq(cpkColorHex(6), '#2a2a32', 'C тёмно-серый/чёрный')
  eq(cpkColorHex(7), '#3050f8', 'N синий')
  eq(cpkColorHex(8), '#ff0040', 'O красный')
  eq(cpkColorHex(17), '#a6ff00', 'Cl жёлто-зелёный')
  eq(cpkColorHex(16), '#ffff30', 'S жёлтый')
  eq(cpkColorHex(11), '#8a2be2', 'Na фиолетовый')
  eq(cpkColorHex(12), '#8aff00', 'Mg светло-зелёный')
  eq(cpkColorHex(20), '#228b22', 'Ca тёмно-зелёный')
  eq(cpkColorHex(26), '#e06633', 'Fe оранжево-коричневый')
  eq(cpkColorHex(30), '#7d80b0', 'Zn сине-серый')
  ok(/^#[0-9a-f]{6}$/.test(cpkColorHex(57)), 'элемент вне выверенной таблицы даёт #rrggbb в нижнем регистре')
}

// --- бейдж заряда ------------------------------------------------------------
{
  eq(cpkChargeLabel(0), '', 'нейтральный атом — без бейджа')
  eq(cpkChargeLabel(1), '+', 'Na⁺ → +')
  eq(cpkChargeLabel(2), '2+', 'Mg²⁺ → 2+')
  eq(cpkChargeLabel(3), '3+', 'Fe³⁺ → 3+')
  eq(cpkChargeLabel(-1), '−', 'Cl⁻ → минус U+2212, не дефис')
  eq(cpkChargeLabel(-2), '2−', 'O²⁻ → 2−')
}

// --- сводка частицы ----------------------------------------------------------
{
  const na = cpkSpecies(11, 1)
  eq(na.symbol, 'Na', 'символ Na')
  eq(na.chargeLabel, '+', 'бейдж +')
  eq(na.radiusPm, 102, 'радиус Na⁺ 102 пм')
  eq(na.ionic, true, 'Na⁺ — ион')

  const o = cpkSpecies(8)
  eq(o.chargeLabel, '', 'атом O без бейджа')
  eq(o.ionic, false, 'атом O не ион')
  eq(o.colorHex, '#ff0040', 'O красный')
}

// --- производные размеры -----------------------------------------------------
{
  const r = cpkPreviewRadius(17)
  ok(cpkCloudRadius(r) > r, 'электронное облако больше сферы')
  ok(cpkHaloSize(r) > cpkCloudRadius(r), 'ореол шире облака')
  ok(cpkLabelOffsetY(r) > r, 'подпись выше сферы')
  ok(cpkLabelSize(r) >= 0.18 && cpkLabelSize(r) <= 0.3, 'подпись читаемого размера')
  // Даже у самого мелкого атома подпись не схлопывается.
  ok(cpkLabelSize(cpkPreviewRadius(1)) >= 0.18, 'подпись H не меньше минимума')
  /**
   * Главное правило против каши в плотном кластере: подпись НЕ шире своего
   * шара, иначе она проекционно наезжает на соседний атом. Проверяем на всех
   * школьных элементах, включая крайние — H (вдв 120 пм) и K (275 пм).
   */
  for (const z of [1, 6, 7, 8, 11, 12, 16, 17, 19, 20, 26, 29, 30, 35, 53]) {
    const rz = cpkPreviewRadius(z)
    ok(cpkLabelSize(rz) < rz * 2, `подпись Z=${z} не шире своего шара`)
    ok(cpkLabelOffsetY(rz) > rz, `подпись Z=${z} над шаром, а не в его центре`)
  }
  // Ион тоже подписывается и его подпись тоже не вылезает за шар.
  const rIon = cpkPreviewRadius(11, 1)
  ok(cpkLabelSize(rIon) < rIon * 2, 'подпись Na⁺ не шире своего шара')
}

// --- какие атомы подписывать -------------------------------------------------
{
  // «2 Na + Cl₂»: подписываем один Na и один Cl, а не все пять шаров.
  const naCl = cpkLabelIndices([
    { z: 11, group: 0 },
    { z: 11, group: 0 },
    { z: 17, group: 1 },
    { z: 17, group: 1 },
  ])
  eq(naCl.size, 2, '2Na + Cl₂ → ровно две подписи')
  ok(naCl.has(0) && naCl.has(2), 'подписаны первые Na и Cl')
  ok(!naCl.has(1) && !naCl.has(3), 'дубликаты элемента не подписаны')

  // HCl: и водород, и хлор — оба нужны.
  eq(cpkLabelIndices([{ z: 1, group: 0 }, { z: 17, group: 0 }]).size, 2, 'HCl → H и Cl')
  // ZnCl₂: Zn и один Cl.
  const zncl2 = cpkLabelIndices([
    { z: 30, group: 0 },
    { z: 17, group: 0 },
    { z: 17, group: 0 },
  ])
  eq(zncl2.size, 2, 'ZnCl₂ → Zn и один Cl')
  // Один и тот же элемент в РАЗНЫХ слагаемых подписывается в каждом.
  const twoTerms = cpkLabelIndices([
    { z: 17, group: 0 },
    { z: 17, group: 1 },
  ])
  eq(twoTerms.size, 2, 'Cl в двух слагаемых подписан дважды')
  eq(cpkLabelIndices([]).size, 0, 'пустой список — ноль подписей')
}

// --- дыхание -----------------------------------------------------------------
{
  for (const t of [0, 0.37, 1.9, 12.5, 400]) {
    const k = cpkBreathScale(t, cpkBreathPhase(8, 3))
    ok(k > 0.96 && k < 1.04, `дыхание в пределах ±4%: ${k.toFixed(4)}`)
  }
  // Фазы разных слотов расходятся — кластер не пульсирует как один.
  ok(cpkBreathPhase(8, 0) !== cpkBreathPhase(8, 1), 'у соседних слотов разные фазы')
  ok(cpkBreathPhase(8, 0) >= 0 && cpkBreathPhase(8, 0) < Math.PI * 2, 'фаза в [0, 2π)')
  // Анимация детерминирована: один и тот же кадр даёт один и тот же масштаб.
  eq(cpkBreathScale(3.3, 1.1), cpkBreathScale(3.3, 1.1), 'дыхание детерминировано')
}

console.log(`test-cpk-atom: OK, ${checks} проверок`)

#!/usr/bin/env node
/**
 * Сцена реактора (научный маршрут до синтеза): символы элементов внутри шаров.
 *
 * Всё сверяется с научным ядром (src/chemistry/data) и с раскладкой сцены, строки не сравниваются:
 *   1. Контраст букв к шару: для КАЖДОГО элемента ядра выбранные чернила (тёмные/белые) дают
 *      контраст ≥ 3:1 (WCAG, крупный текст) к цвету шара сцены (CPK ядра + тон сцены).
 *   2. Реакции учебников 7–8 классов с lab.ok: раскладка сцены по каждой; у каждого шара подпись —
 *      символ элемента таблицы, заряд подписи = заряду роли (только у одноатомных ионов), контраст
 *      букв ≥ 3:1 к реальному цвету шара; разные (символ, заряд) — разные клетки атласа; клеток
 *      на сцену не больше ёмкости атласа.
 *   3. В Node (нет document) атлас не создаётся и не падает: клетки = −1.
 *
 * Запуск: npx tsx scripts/test-stage-atom-symbols.mts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ATOMIC_DATA } from '../src/chemistry/data/index.ts'
import { getElementBySymbol } from '../src/data/elements.ts'
import { resolveReactorEquation } from '../src/lab/reactorDeepLink.ts'
import { scientificStageLayout, type StageCoProduct } from '../src/components/lab/scientific/scientificReactorStageLayout.ts'
import {
  SYMBOL_ATLAS_COLS,
  atomSymbolText,
  ensureStageSymbolCells,
  relativeLuminance,
  stageAtomColor,
  stageSymbolAtlasTexture,
  symbolInkIsDark,
} from '../src/components/lab/scientific/stageAtomSymbols.ts'

const failures: string[] = []
let checks = 0
function ok(name: string, cond: boolean, details = ''): void {
  checks += 1
  if (!cond) failures.push(`${name}${details ? ` — ${details}` : ''}`)
}

// Чернила шейдера символов (stageAtomMaterials): тёмные ≈ #0e1321, белые = #ffffff.
const DARK_INK = (0x0e << 16) | (0x13 << 8) | 0x21
const contrast = (a: number, b: number) => {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

// ── 1. контраст для всех элементов ядра ─────────────────────────────────────
for (const [sym, datum] of Object.entries(ATOMIC_DATA)) {
  const ball = stageAtomColor(sym, datum.cpk)
  const ink = symbolInkIsDark(ball) ? DARK_INK : 0xffffff
  const c = contrast(ball, ink)
  ok(`контраст ${sym}`, c >= 3, `${c.toFixed(2)}:1 на #${ball.toString(16).padStart(6, '0')}`)
}
// Ba и Cl в CPK оба зелёные — у сцены они различаются и тоном шара.
ok('Ba ≠ Cl по тону шара', stageAtomColor('Ba', ATOMIC_DATA.Ba.cpk) !== stageAtomColor('Cl', ATOMIC_DATA.Cl.cpk))

// ── 2. реакции учебников ────────────────────────────────────────────────────
type TextbookFile = { units: { reactions: { bankId: string | null; lab?: { ok?: boolean } }[] }[] }
const bankIds = new Set<string>()
for (const grade of ['g7', 'g8']) {
  const file = JSON.parse(readFileSync(new URL(`../src/data/textbook/equations-${grade}.json`, import.meta.url), 'utf8')) as TextbookFile
  for (const u of file.units) for (const r of u.reactions) if (r.bankId && r.lab?.ok) bankIds.add(r.bankId)
}
ok('есть реакции учебников с lab.ok', bankIds.size >= 20, String(bankIds.size))

const capacity = SYMBOL_ATLAS_COLS * SYMBOL_ATLAS_COLS
let stages = 0
let atomsSeen = 0
for (const bankId of bankIds) {
  const res = resolveReactorEquation({ reactionId: bankId })
  if (!res.ok) continue
  const layout = scientificStageLayout(res.leftTerms, res.coProducts as readonly StageCoProduct[], res.productCompoundId, res.productCoeff)
  stages += 1
  const roles = new Map(layout.roles.map((r) => [r.id, r]))
  const keyOf = new Map<string, string>()
  for (const a of layout.atoms) {
    atomsSeen += 1
    const role = roles.get(a.role)
    ok(`${bankId}: роль ${a.role} есть`, role != null)
    if (!role) continue
    const text = atomSymbolText(a.symbol, role.charge)
    ok(`${bankId}: ${a.symbol} — элемент таблицы`, getElementBySymbol(a.symbol) != null)
    ok(`${bankId}: подпись шара = символ элемента`, text.main === a.symbol, `${text.main} ≠ ${a.symbol}`)
    // Цвет, которым шар реально рисуется (CPK ядра или таблицы + тон сцены), и его чернила.
    const ball = stageAtomColor(a.symbol, role.color)
    const c = contrast(ball, symbolInkIsDark(ball) ? DARK_INK : 0xffffff)
    ok(`${bankId}: контраст ${a.symbol} на шаре`, c >= 3, `${c.toFixed(2)}:1`)
    const supCharge = text.sup === '' ? 0 : (text.sup.endsWith('+') ? 1 : -1) * (Number.parseInt(text.sup, 10) || 1)
    ok(`${bankId}: заряд подписи ${a.role}`, supCharge === role.charge, `${supCharge} ≠ ${role.charge}`)
    const pair = `${a.symbol}|${role.charge}`
    const prev = keyOf.get(text.key)
    ok(`${bankId}: клетка атласа ${text.key} однозначна`, prev == null || prev === pair, `${prev} и ${pair}`)
    keyOf.set(text.key, pair)
  }
  ok(`${bankId}: клеток на сцену ≤ ${capacity}`, keyOf.size <= capacity, String(keyOf.size))
  // Заряд в шаре пишется только у одноатомного иона (Ba²⁺, Cl⁻, Na⁺); многоатомный ион
  // (SO₄²⁻) заряжен целиком — его заряд в подписи формулы, а не в шарах.
  for (const u of layout.units) {
    for (let i = u.atomStart; i < u.atomStart + u.atomCount; i++) {
      const q = roles.get(layout.atoms[i]!.role)?.charge ?? 0
      if (q === 0) continue
      const bonded = layout.bonds.some((b) => b.a === i || b.b === i)
      ok(`${bankId}: заряженный шар ${layout.atoms[i]!.symbol} — одноатомный ион`, !bonded)
    }
  }
}
ok('раскладок сцены построено', stages >= 20, String(stages))

// ── 3. Node: без DOM атласа нет, клетки −1 ──────────────────────────────────
assert.equal(typeof document, 'undefined')
ok('атлас в Node = null', stageSymbolAtlasTexture() === null)
const cells = new Int32Array(2)
ensureStageSymbolCells([atomSymbolText('Ba', 2), atomSymbolText('Cl', -1)], cells)
ok('клетки в Node = −1', cells[0] === -1 && cells[1] === -1)

if (failures.length > 0) {
  console.error(`✗ ${failures.length} из ${checks} проверок не прошли:`)
  for (const f of failures.slice(0, 60)) console.error(`  • ${f}`)
  process.exit(1)
}
console.log(`✓ символы в шарах сцены реактора: ${checks} проверок (${stages} реакций, ${atomsSeen} шаров)`)

/**
 * Каталог: ровно 200 неорганических веществ — и ничего при этом не сломалось.
 *
 * Проверяет:
 *  1) видимых неорганических веществ ровно 200 (compoundById × isCatalogVisibleId);
 *  2) органика не пострадала — скрыта только та, что в CATALOG_HIDDEN_IDS;
 *  3) продукты всех сцен анимации и все вещества рецептов реактора видимы;
 *  4) обязательное ядро школьного курса (H₂O, HCl, H₂SO₄, NaOH …) видимо;
 *  5) каждое выверенное уравнение учебника с lab.ok по-прежнему открывается
 *     в лаборатории (resolveReactorEquation — та же логика, что в verify-lab-links);
 *  6) весь SCHOOL_REACTION_BANK по-прежнему разрешается в реактор;
 *  7) скрытые вещества остаются в данных (compoundById) — ничего не удалено;
 *  8) сторонние проверки проходят: validate:learn, verify-school-curriculum, validate:vr-reactions.
 *
 * Run: npx tsx scripts/verify-catalog-200.mts [--skip-suites]
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { compoundById } from '../src/data/compounds.ts'
import {
  CATALOG_DEMOTED_IDS,
  CATALOG_HIDDEN_IDS,
  CATALOG_TOP_INORGANIC_IDS,
  isCatalogVisibleId,
} from '../src/data/textbook/catalogWhitelist.ts'
import { SCHOOL_REACTION_BANK } from '../src/chemistry/schoolReactionBank.ts'
import { SCIENTIFIC_REACTOR_RECIPES } from '../src/chemistry/scientificReactorRecipes.ts'
import { ORGANIC_MOLECULES } from '../src/data/organicLab/organicMoleculeRegistry.ts'
import { parseReactorLinkParams, resolveReactorEquation } from '../src/lab/reactorDeepLink.ts'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const TB = path.join(ROOT, 'src', 'data', 'textbook')
const GRADES = [7, 8, 9, 10, 11] as const
const TARGET = 200
const SKIP_SUITES = process.argv.includes('--skip-suites')
/** Запускаем соседние проверки напрямую через node + tsx (без npx и без shell). */
const TSX_CLI = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs')

const problems: string[] = []
const check = (cond: boolean, msg: string) => {
  if (!cond) problems.push(msg)
}

// ── 1. ровно 200 видимых неорганических ─────────────────────────────────────
const allInorganic = Object.values(compoundById)
const visible = allInorganic.filter((c) => isCatalogVisibleId(c.id))
check(
  visible.length === TARGET,
  `видимых неорганических ${visible.length}, ожидалось ${TARGET}`,
)
check(
  CATALOG_TOP_INORGANIC_IDS.size === TARGET,
  `CATALOG_TOP_INORGANIC_IDS = ${CATALOG_TOP_INORGANIC_IDS.size}, ожидалось ${TARGET}`,
)
for (const id of CATALOG_TOP_INORGANIC_IDS) {
  check(Boolean(compoundById[id]), `в списке 200 есть неизвестный id ${id}`)
  check(isCatalogVisibleId(id), `id ${id} из списка 200 не виден`)
}
for (const id of CATALOG_DEMOTED_IDS) {
  check(Boolean(compoundById[id]), `в списке скрытых есть неизвестный id ${id}`)
  check(!CATALOG_TOP_INORGANIC_IDS.has(id), `id ${id} одновременно в 200 и в скрытых`)
}

const byCategory = new Map<string, number>()
for (const c of visible) byCategory.set(c.category, (byCategory.get(c.category) ?? 0) + 1)

// ── 2. органика не пострадала ────────────────────────────────────────────────
const organicVisible = ORGANIC_MOLECULES.filter((m) => isCatalogVisibleId(m.id))
const organicExpected = ORGANIC_MOLECULES.filter((m) => !CATALOG_HIDDEN_IDS.has(m.id))
check(
  organicVisible.length === organicExpected.length,
  `органики видно ${organicVisible.length}, ожидалось ${organicExpected.length}`,
)

// ── 3. сцены и рецепты реактора ──────────────────────────────────────────────
/** Продукты 10 сцен микромира — резолвятся по id каталога. */
const SCENE_PRODUCT_IDS = [
  'nacl', 'h2o', 'hcl', 'co2', 'nh3', 'mgo', 'salt_fe2_s', 'so2', 'cao', 'salt_zn_cl',
]
for (const id of SCENE_PRODUCT_IDS) {
  check(Boolean(compoundById[id]), `продукт сцены ${id} отсутствует в каталоге данных`)
  check(isCatalogVisibleId(id), `продукт сцены ${id} скрыт — сцена останется без входа из каталога`)
}
for (const recipe of Object.values(SCIENTIFIC_REACTOR_RECIPES)) {
  const r = recipe as unknown as {
    productId: string
    left?: { compoundId?: string }[]
    coProducts?: { compoundId?: string }[]
  }
  const ids = [
    ...(r.left ?? []).map((s) => s.compoundId),
    ...(r.coProducts ?? []).map((s) => s.compoundId),
  ]
  for (const id of ids) {
    if (!id || CATALOG_HIDDEN_IDS.has(id)) continue
    check(isCatalogVisibleId(id), `вещество рецепта реактора ${id} скрыто рейтингом`)
  }
}

// ── 4. обязательное ядро курса ───────────────────────────────────────────────
const CORE_IDS = [
  'h2o', 'co2', 'co', 'so2', 'so3', 'nh3', 'hcl', 'h2so4', 'hno3', 'h3po4', 'h2s',
  'naoh', 'koh', 'ca_oh_2', 'nacl', 'cao', 'mgo', 'fe2o3', 'fe3o4', 'cuo', 'zno',
  'al2o3', 'sio2', 'p2o5', 'mno2', 'tb_o2', 'tb_h2', 'tb_n2', 'tb_cl2', 'tb_s8', 'tb_p4',
  'salt_ca_co3', 'salt_nahco3', 'salt_na_co3', 'salt_k_mno4', 'salt_k2cr2o7',
  'salt_cu_so4', 'salt_ba_so4', 'salt_ag_cl', 'salt_ag_no3', 'salt_nh4_cl',
]
for (const id of CORE_IDS) {
  if (!compoundById[id]) {
    problems.push(`ядро курса: id ${id} не найден в compoundById (переименован?)`)
    continue
  }
  check(isCatalogVisibleId(id), `ядро курса: ${id} (${compoundById[id].formulaUnicode}) скрыт`)
}

// ── 5. выверенные уравнения учебника открываются в лаборатории ──────────────
let idN = 0
const newId = () => `v${++idN}`
type EqRx = { id?: string; lab?: { ok?: boolean; href?: string } }
type EqUnit = { unitId?: string; reactions?: EqRx[] }
let labOk = 0
let labChecked = 0
for (const g of GRADES) {
  const parsed = JSON.parse(readFileSync(path.join(TB, `equations-g${g}.json`), 'utf8')) as {
    units?: EqUnit[]
  }
  for (const u of parsed.units ?? []) {
    for (const rx of u.reactions ?? []) {
      if (!rx.lab?.ok || !rx.lab.href) continue
      labChecked++
      const query = rx.lab.href.split('?')[1] ?? ''
      const parsedLink = parseReactorLinkParams(new URLSearchParams(query))
      if (!parsedLink) {
        problems.push(`g${g}/${u.unitId}/${rx.id}: ссылка в лабораторию не разбирается`)
        continue
      }
      const r = resolveReactorEquation(parsedLink.spec, {
        newId,
        balanceSelf: parsedLink.balanceSelf,
      })
      if (!r.ok) {
        problems.push(`g${g}/${u.unitId}/${rx.id}: resolveReactorEquation → ${r.code}`)
        continue
      }
      if (!compoundById[r.productCompoundId]) {
        problems.push(`g${g}/${u.unitId}/${rx.id}: продукт ${r.productCompoundId} пропал из данных`)
        continue
      }
      labOk++
    }
  }
}
check(labChecked > 0, 'не найдено ни одного уравнения с lab.ok — проверьте book:curated')
check(labOk === labChecked, `ссылок в лабораторию рабочих ${labOk} из ${labChecked}`)

// ── 6. банк школьных реакций ─────────────────────────────────────────────────
let bankOk = 0
for (const rx of SCHOOL_REACTION_BANK) {
  const r = resolveReactorEquation({ reactionId: rx.id }, { newId })
  if (r.ok) {
    bankOk++
    if (!compoundById[r.productCompoundId]) {
      problems.push(`банк ${rx.id}: продукт ${r.productCompoundId} пропал из данных`)
    }
  }
}
check(bankOk > 0, 'банк реакций перестал резолвиться целиком')

// ── 7. скрытое остаётся в данных ─────────────────────────────────────────────
for (const id of CATALOG_DEMOTED_IDS) {
  const c = compoundById[id]
  check(Boolean(c?.formulaUnicode), `скрытое вещество ${id} исчезло из данных — так нельзя`)
}

// ── 8. сторонние проверки ────────────────────────────────────────────────────
const SUITES: { label: string; args: string[] }[] = [
  { label: 'validate:learn', args: ['scripts/validate-learn.ts'] },
  { label: 'verify-school-curriculum', args: ['scripts/verify-school-curriculum.mts'] },
  { label: 'validate:vr-reactions', args: ['scripts/validate-vr-reactions.ts'] },
  { label: 'verify-lab-links', args: ['scripts/verify-lab-links.mts'] },
]
if (!SKIP_SUITES) {
  for (const s of SUITES) {
    try {
      execFileSync(process.execPath, [TSX_CLI, ...s.args], { cwd: ROOT, stdio: 'pipe' })
      console.log(`  ✓ ${s.label}`)
    } catch (e) {
      const err = e as { stdout?: Buffer; stderr?: Buffer }
      const tail = `${err.stdout?.toString() ?? ''}${err.stderr?.toString() ?? ''}`.trim().split('\n').slice(-8).join('\n')
      problems.push(`${s.label} упал:\n${tail}`)
    }
  }
}

// ── отчёт ────────────────────────────────────────────────────────────────────
console.log(`\nвидимая неорганика: ${visible.length} / всего в данных ${allInorganic.length}`)
console.log(`  ${[...byCategory.entries()].sort().map(([k, v]) => `${k} ${v}`).join(', ')}`)
console.log(`органика: ${organicVisible.length}`)
console.log(`ссылки «открыть в лаборатории» из учебника: ${labOk}/${labChecked}`)
console.log(`банк реакций резолвится: ${bankOk}/${SCHOOL_REACTION_BANK.length}`)

if (problems.length > 0) {
  console.error(`\n${problems.length} проблем(ы):`)
  for (const p of problems) console.error(`  ✗ ${p}`)
  process.exit(1)
}
assert.equal(visible.length, TARGET)
console.log('\nverify-catalog-200: каталог = ровно 200 неорганических веществ, лаборатория и учебник целы')

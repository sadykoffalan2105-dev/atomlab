#!/usr/bin/env node
/**
 * Карточка вещества → лаборатория со школьной сценой (первые 10 веществ каталога 7 класса).
 *
 * Для каждого вещества:
 *   1. реакция карточки (G7_FIRST10_SCENE_REACTIONS) = реакции его научной спецификации
 *      (school/specs/<id>.ts: bankId, уравнение; у реакции банка — та же запись);
 *   2. ссылка карточки открывается в реакторе, синтез запускается (не «только шарами»);
 *   3. для реакции ссылки scientificSceneFor даёт сцену — в лаборатории играет школьная сцена этого
 *      вещества, и кнопка карточки зовёт «▶ Смотреть, как образуется».
 * Вещества агента B (NO, NO₂, N₂O, N₂O₅): сцены делаются в соседней ветке — отсутствие сцены пока
 * допускается с пометкой TODO-B (ведущий уберёт допуск после слияния).
 *
 * Запуск: npx tsx scripts/test-g7-first10-links.mts
 */
import assert from 'node:assert/strict'
import { getSchoolReaction, primaryReactionForCompound } from '../src/chemistry/schoolReactionBank.ts'
import { resolveReactorEquation } from '../src/lab/reactorDeepLink.ts'
import { G7_FIRST10_SCENE_REACTIONS, schoolSceneLinkForCompound } from '../src/lab/schoolSceneLinks.ts'
import { scientificSceneFor } from '../src/lab/scientificSynthesis/sceneSignatures.ts'
import { SCHOOL_SPEC_IDS, SCHOOL_SPECS } from '../src/lab/cinema/scenes/school/specs/index.ts'

/** TODO-B: сцены NO, NO₂, N₂O, N₂O₅ — в ветке агента B; после слияния список пуст. */
const TODO_B = new Set<string>(['no', 'no2', 'n2o', 'n2o5'])

const norm = (s: string) => s.replace(/⇌/g, '⇄').replace(/\s+/g, ' ').trim()
let passed = 0
const todo: string[] = []

assert.deepEqual(Object.keys(G7_FIRST10_SCENE_REACTIONS).sort(), [...SCHOOL_SPEC_IDS].sort(), 'таблица карточек = 10 веществ спецификаций')

for (const id of SCHOOL_SPEC_IDS) {
  const spec = SCHOOL_SPECS[id]
  const row = G7_FIRST10_SCENE_REACTIONS[id]!
  // 1. Реакция карточки = реакции спецификации.
  assert.equal(row.bankId, spec.reaction.bankId, `${id}: bankId карточки ≠ спецификации`)
  assert.equal(row.equation, spec.reaction.equation, `${id}: уравнение карточки ≠ спецификации`)
  if (row.bankId) {
    const bank = getSchoolReaction(row.bankId)
    assert.ok(bank, `${id}: реакции ${row.bankId} нет в банке`)
    // Банк пишет обратимые реакции своей стрелкой — сравниваем состав, а не стрелку.
    const strip = (s: string) => norm(s).replace(/[→⇄]/g, '=')
    assert.equal(strip(bank.equationRu), strip(spec.reaction.equation), `${id}: запись банка «${bank.equationRu}» ≠ «${spec.reaction.equation}»`)
    // Предпочтительная реакция вещества в каталоге — та же.
    assert.equal(primaryReactionForCompound(id)?.id, row.bankId, `${id}: primaryReactionForCompound ≠ реакции сцены`)
  }
  // 2. Ссылка открывается в реакторе, синтез запускается.
  const link = schoolSceneLinkForCompound(id)
  assert.ok(link, `${id}: у карточки нет ссылки в лабораторию`)
  const r = resolveReactorEquation(row.bankId ? { reactionId: row.bankId, main: row.main } : { equation: row.equation, main: row.main })
  assert.ok(r.ok, `${id}: реактор не собирает реакцию карточки`)
  if (!r.ok || !link) continue
  assert.equal(r.stageOnly, null, `${id}: реакция только «шарами» — синтез не запустится`)
  assert.equal(r.productCompoundId, row.main, `${id}: главный продукт реактора ≠ ${row.main}`)
  assert.ok(link.href.includes('reactor=1'), `${id}: ссылка не в реактор`)
  // 3. Сцена.
  const scene = scientificSceneFor(r.productCompoundId, r.leftTerms)
  if (TODO_B.has(id) && !scene) {
    assert.equal(link.hasScene, false)
    todo.push(id)
    continue
  }
  assert.ok(scene, `${id}: для реакции карточки нет сцены (продукт ${r.productCompoundId})`)
  assert.equal(link.hasScene, true, `${id}: кнопка карточки не зовёт смотреть анимацию`)
  passed++
}

console.log(`✓ g7 first10 links: сцена по ссылке карточки — ${passed} из ${SCHOOL_SPEC_IDS.length}${todo.length ? `; TODO-B (ждут сцен ветки B): ${todo.join(', ')}` : ''}`)

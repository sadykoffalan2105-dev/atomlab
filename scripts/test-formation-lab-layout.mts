/**
 * «Как образуется» в лаборатории: раскладка HUD и режиссёр показов — без браузера.
 *  1) Для всех 200 веществ каталога hudCards(...) на RU/EN/UZ: самый длинный неразрывный член строки пути
 *     (после keepTogether — перенос только между членами) ≤ 60 символов, иначе карточка на узком окне не влезет.
 *     Строки правят другие исполнители — превышения печатаются отчётом (--strict — ошибка).
 *  2) Режиссёр (showDirector): preview → synth (handoff без размонтирования панели), путь vs образование,
 *     конец показа: режиссёр → 'none' ДО onBirthReady.
 * Запуск: npx tsx scripts/test-formation-lab-layout.mts [--strict]
 */
import { register } from 'node:module'

// CSS-модули (FormationHud.module.css) в node — заглушка: имена классов как есть.
register(
  'data:text/javascript,' +
    encodeURIComponent(
      `export async function load(url, ctx, next) {
        if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export default new Proxy({}, { get: (_, k) => String(k) })' }
        return next(url, ctx)
      }`,
    ),
)

const { CATALOG_TOP200_IDS } = await import('../src/data/catalog/catalogTop200')
const { formationPlan } = await import('../src/chemistry/formationPlan')
const { formationStoryFor } = await import('../src/components/lab/formation/formationStory')
const { hudCards } = await import('../src/components/lab/formation/FormationHud')
const { formationLab } = await import('../src/components/lab/formation/lab/formationLabStore')
const { routeLab } = await import('../src/components/lab/formation/routes/routeLabStore')
const { showDirector } = await import('../src/components/lab/formation/lab/showDirector')

const STRICT = process.argv.includes('--strict')
const MAX = 60
let checks = 0
const bad: string[] = []
const ok = (cond: boolean, msg: string) => {
  checks++
  if (!cond) bad.push(msg)
}

// ── 1) HUD: длина неразрывного члена ──
// то же правило, что keepTogether в FormationHud: после знаков и «:» — неразрывный пробел
const keepTogether = (s: string) => s.replace(/([→⇄=+−]) /g, '$1 ').replace(/: (?=\S)/g, ': ')
const longest = (s: string) => keepTogether(s).split(/[ \t]+/).reduce((m, w) => (w.length > m.length ? w : m), '')
const isPath = (c: { key: string; title?: string; titleT?: readonly string[]; lines: readonly string[] }) =>
  c.key === 'route' || c.titleT?.[0] === 'Путь' || c.title === 'Путь' || /^Путь:/.test(c.lines[0] ?? '')
const over: { id: string; L: number; len: number; text: string }[] = []
let worst = { id: '', len: 0, text: '' }
for (const id of CATALOG_TOP200_IDS) {
  const story = formationStoryFor(id)
  const plan = formationPlan(id)
  ok(!!story && !!plan, `${id}: нет истории / плана`)
  if (!story || !plan) continue
  for (const L of [0, 1, 2] as const) {
    for (const c of hudCards(story, plan, L)) {
      const lines = c.linesT && c.linesT.length === c.lines.length ? c.linesT.map((t) => t[L] ?? t[0]) : c.lines
      const texts = isPath(c) ? [lines.map((ln) => ln.replace(/^(Путь|Route|Yoʻl):\s*/, '')).join('  ')] : [...lines, c.titleT?.[L] ?? c.title ?? '']
      for (const t of texts) {
        const w = longest(t)
        if (w.length > worst.len) worst = { id, len: w.length, text: w }
        if (w.length > MAX) over.push({ id, L, len: w.length, text: w })
      }
    }
  }
}
if (STRICT) for (const o of over) ok(false, `${o.id} [${'RU EN UZ'.split(' ')[o.L]}]: член ${o.len} > ${MAX}: «${o.text}»`)

// ── 2) Режиссёр показов ──
const events: string[] = []
const off = showDirector.subscribe(() => events.push(showDirector.get().kind))
let idNull = 0
const offF = formationLab.subscribe(() => {
  if (formationLab.get().id == null) idNull++
})
const sid = 'nacl'
const st = formationStoryFor(sid)!
// preview → synth: панель (formationLab.id) ни разу не закрывается, этапы на месте, часы с нуля
formationLab.open(sid, 'preview')
formationLab.setStages(sid, st.stages.map((s) => ({ key: s.key, t0: s.t0, dur: s.dur })), st.total)
ok(showDirector.get().kind === 'formation-preview', 'preview: режиссёр не formation-preview')
formationLab.clock.current.t = 4
idNull = 0
showDirector.handoffToSynth(sid)
ok(showDirector.get().kind === 'formation-synth' && showDirector.get().id === sid, 'handoff: режиссёр не formation-synth')
ok(idNull === 0, 'handoff: панель закрывалась (мигание)')
ok(formationLab.get().stages != null && formationLab.get().mode === 'synth', 'handoff: этапы потеряны / режим не synth')
ok(formationLab.clock.current.t === 0, 'handoff: часы не с нуля')
// повторный open(synth) сцены после передачи — без сброса
formationLab.clock.current.t = 2
formationLab.open(sid, 'synth')
ok(formationLab.clock.current.t === 2, 'handoff: сцена synth сбросила часы повторно')
// конец показа: режиссёр → none ДО продукта
let kindAtBirth = 'unset'
const onBirthReady = () => {
  kindAtBirth = showDirector.get().kind
}
showDirector.finish('formation-synth', sid)
onBirthReady()
ok(kindAtBirth === 'none', `finish: при onBirthReady режиссёр ${kindAtBirth}, а не none`)
ok(!showDirector.synthBusy(), 'finish: сторож всё ещё ждёт')
// Run другой реакции при открытом preview — preview закрывается
formationLab.open(sid, 'preview')
showDirector.handoffToSynth(null)
ok(showDirector.get().kind === 'none' && formationLab.get().id == null, 'handoff(null): preview не закрыт')
// путь vs образование: путь вытесняет показ образования, одновременно — никогда
formationLab.open(sid, 'preview')
routeLab.start('co2-combustion', { list: [{ key: 'a', t0: 0, t1: 5, dur: 5 }], total: 5, W: () => null } as never)
ok(showDirector.get().kind === 'route-synth', 'route: режиссёр не route-synth')
ok(formationLab.get().id == null, 'route: показ образования не закрыт')
formationLab.open(sid, 'preview')
ok(formationLab.get().id == null && showDirector.get().kind === 'route-synth', 'route: preview открылся поверх пути')
showDirector.finish('route-synth', 'co2-combustion')
ok(showDirector.get().kind === 'none', 'route finish: режиссёр не none')
ok(!events.some((k, i) => i > 0 && k === events[i - 1]), 'режиссёр шлёт одинаковые состояния подряд')
off()
offF()

console.log(
  `test-formation-lab-layout: HUD — 200 веществ × 3 языка, самый длинный член ${worst.len} симв. (${worst.id}: «${worst.text}»), > ${MAX}: ${over.length}`,
)
if (over.length && !STRICT) for (const o of over.slice(0, 12)) console.log(`  ⚠ ${o.id} [${'RU EN UZ'.split(' ')[o.L]}] ${o.len}: ${o.text}`)
if (bad.length) {
  console.error(`test-formation-lab-layout: ${bad.length} ошибок из ${checks}`)
  for (const b of bad.slice(0, 40)) console.error('  ✗ ' + b)
  process.exit(1)
}
console.log(`test-formation-lab-layout: ${checks}/${checks} проверок (режиссёр: handoff, путь vs образование, finish → none до продукта)`)

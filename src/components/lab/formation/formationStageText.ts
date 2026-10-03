import type { FormationEquation } from '../../../chemistry/formationEquation'
import type { FormationPlan } from '../../../chemistry/formationPlan'
import { isMetal } from '../../../chemistry/formationPlan'
import { formationTexts, type FormationLocale } from '../../../chemistry/formationText'
import { formationTeacherBoard, formationTeacherLines, formationTeacherSpecial, routeKindKey, routeKindLabel, type TeacherBoard } from '../../../chemistry/formationTeacher'
import type { FormationStory, StageKey } from './formationStory'

/**
 * Подписи этапов «Как образуется» (RU / EN / UZ): заголовок, крупная строка и пояснение для каждого этапа сценария,
 * уравнение образования (из простых веществ или «в лаборатории получают так») и подписи кнопок.
 * Шаблоны без свободного текста — формулы, заряды, валентности и связи берутся из плана / модели / уравнения.
 */
/** ref — ссылка учителя на учебник («Kimyo 8, § 16, с. 71–73»); панель выводит её на доске (REF_IN_SUB = false — не в sub). */
export type FormationStageText = { key: StageKey; title: string; main: string; sub: string; ref?: string }
export type FormationStageTexts = {
  stages: FormationStageText[]
  /** kind — вид пути («нейтрализация», «реакция обмена» …), special — «особенность» вещества (таблица правил, 3 языка) */
  equation: { lead: string; text: string; lab: string | null; labLead: string; kind: string; special: string; specialLead: string }
  /** «доска» учителя: электронная/структурная формулы, схемы перехода e⁻, тип решётки (null — вещества нет в таблице 200) */
  board: TeacherBoard | null
  ui: { play: string; pause: string; resume: string; replay: string; close: string; prev: string; next: string; speed: string; time: string; stage: string }
  note: string
}

type Tri = readonly [string, string, string]
const L3 = { ru: 0, en: 1, uz: 2 } as const
const pick = (t: Tri, loc: FormationLocale) => t[L3[loc]]

const TITLES: Record<StageKey, Tri> = {
  reagents: ['Исходные вещества', 'Starting substances', 'Boshlangʻich moddalar'],
  route: ['Путь получения', 'How it is obtained', 'Olinish yoʻli'],
  break: ['Связи рвутся', 'Bonds break', 'Bogʻlar uziladi'],
  approach: ['Атомы сближаются', 'Atoms approach', 'Atomlar yaqinlashadi'],
  valence: ['Валентные электроны', 'Valence electrons', 'Valent elektronlar'],
  inner: ['Сборка кислотного остатка', 'Building the polyatomic ion', 'Kislota qoldigʻi yigʻiladi'],
  transfer: ['Переход электронов', 'Electron transfer', 'Elektronlar oʻtishi'],
  pairs: ['Общие электронные пары', 'Shared electron pairs', 'Umumiy elektron juftlar'],
  bonds: ['Связи — одна за другой', 'Bonds form one by one', 'Bogʻlar birma-bir'],
  assemble: ['Сборка', 'Assembly', 'Yigʻilish'],
  lattice: ['Кристаллическая решётка', 'Crystal lattice', 'Kristall panjara'],
  final: ['Готово', 'Result', 'Tayyor'],
}

/** Ссылку учителя на § дописывать в конец пояснения? Нет: панель показывает ref мелкой строкой на доске (FormationBoard). */
const REF_IN_SUB = false
/** Заголовок этапа, которого нет в TITLES (новые этапы движка, например 'route'). */
const TITLE_FALLBACK: Tri = ['Путь получения', 'How it is made', 'Olinish yoʻli']

const eCount = (n: number) => `${n === 1 ? '' : n}e⁻`

/** Как простое вещество выглядит в природе / лаборатории. */
function reagentNote(f: string, loc: FormationLocale): string {
  const el = f.replace(/[₀-₉]/g, '')
  if (/₂$/.test(f)) return pick([`${f} — двухатомные молекулы`, `${f} — diatomic molecules`, `${f} — ikki atomli molekulalar`], loc)
  if (el === 'S') return pick(['S — сера (кристаллы из молекул S₈)', 'S — sulfur (crystals of S₈ molecules)', 'S — oltingugurt (S₈ molekulalari kristallari)'], loc)
  if (el === 'P') return pick(['P — фосфор (красный; белый — молекулы P₄)', 'P — phosphorus (red; white is P₄ molecules)', 'P — fosfor (qizil; oq fosfor — P₄ molekulalari)'], loc)
  if (el === 'C') return pick(['C — углерод (графит, уголь)', 'C — carbon (graphite, coal)', 'C — uglerod (grafit, koʻmir)'], loc)
  if (el === 'Si') return pick(['Si — кремний (атомный кристалл)', 'Si — silicon (covalent crystal)', 'Si — kremniy (atom kristall)'], loc)
  if (isMetal(el)) return pick([`${el} — металл: атомы в металлической решётке`, `${el} — a metal: atoms in a metallic lattice`, `${el} — metall: atomlar metall panjarada`], loc)
  return f
}

export function formationStageTexts(
  plan: FormationPlan,
  story: FormationStory,
  eq: FormationEquation | null,
  loc: FormationLocale,
  obtainingSection: string,
): FormationStageTexts {
  const base = formationTexts(plan, loc, obtainingSection)
  const [s1, s2, s3, s4] = base.steps
  const ionic = plan.mode === 'ionic'
  const els = [...new Set(plan.species.flatMap((s) => Object.keys(s.comp)))]
  const out: FormationStageText[] = []
  for (const st of story.stages) {
    const title = pick((TITLES as Partial<Record<string, Tri>>)[st.key] ?? TITLE_FALLBACK, loc)
    let main = ''
    let sub = ''
    switch (st.key) {
      case 'reagents': {
        if (eq?.direct && eq.directKind === 'elements') {
          main = eq.direct
          sub = `${eq.reagents.map((r) => reagentNote(r, loc)).join('; ')}.`
        } else if (eq?.direct && eq.directKind === 'atoms') {
          main = eq.direct
          sub = pick(
            [
              'Простое вещество: атомы одного элемента соединяются в молекулу (или кристалл). Сначала — отдельные атомы.',
              'A simple substance: atoms of one element join into a molecule (or crystal). First — separate atoms.',
              'Oddiy modda: bir element atomlari molekula (yoki kristall)ga birikadi. Avval — alohida atomlar.',
            ],
            loc,
          )
        } else {
          main = els.map((e) => (/^(H|N|O|F|Cl|Br|I)$/.test(e) ? `${e}₂` : e)).join(' · ')
          sub = pick(
            [
              'Напрямую из простых веществ это вещество не получают. Показаны элементы, из которых оно состоит, — дальше модель строения: как из атомов складывается частица.',
              'This substance is not made directly from simple substances. Shown are the elements it consists of — then the structure model: how its particle is built from atoms.',
              'Bu modda oddiy moddalardan bevosita olinmaydi. U tarkibidagi elementlar koʻrsatilgan — keyin tuzilish modeli: zarracha atomlardan qanday yigʻiladi.',
            ],
            loc,
          )
        }
        break
      }
      case 'break': {
        const mols = (eq?.reagents ?? els.map((e) => (/^(H|N|O|F|Cl|Br|I)$/.test(e) ? `${e}₂` : e))).filter((r) => /₂$/.test(r))
        const bl = mols.map((m) => {
          const e = m.replace('₂', '')
          return e === 'N' ? 'N≡N' : e === 'O' ? 'O=O' : `${e}–${e}`
        })
        main = bl.length ? bl.join(' · ') : pick(['Металлическая связь', 'Metallic bonding', 'Metall bogʻ'], loc)
        sub = pick(
          [
            'Чтобы атомы соединились по-новому, старые связи разрываются: молекулы распадаются на атомы, атомы металла выходят из решётки. На это нужна энергия — нагрев, поджиг, свет.',
            'For atoms to join in a new way, the old bonds break: molecules split into atoms, metal atoms leave the lattice. This takes energy — heating, ignition, light.',
            'Atomlar yangicha birikishi uchun eski bogʻlar uziladi: molekulalar atomlarga ajraladi, metall atomlari panjaradan chiqadi. Buning uchun energiya kerak — qizdirish, yondirish, yorugʻlik.',
          ],
          loc,
        )
        break
      }
      case 'approach':
        main = s1.main
        sub = s1.sub
        break
      case 'valence': {
        const seen = new Set<string>()
        const parts: string[] = []
        for (let i = 0; i < story.valenceE.length; i++) {
          const el = story.atomEl[i]!
          if (seen.has(el)) continue
          seen.add(el)
          parts.push(`${el}: ${story.valenceE[i]} e⁻`)
        }
        main = parts.join(' · ')
        sub = pick(
          [
            'Жёлтые точки — валентные электроны внешнего слоя (схема Льюиса). Именно они образуют химические связи.',
            'Yellow dots are the valence electrons of the outer shell (Lewis diagram). They are the ones that form chemical bonds.',
            'Sariq nuqtalar — tashqi qavatning valent elektronlari (Lyuis sxemasi). Kimyoviy bogʻlarni aynan ular hosil qiladi.',
          ],
          loc,
        )
        break
      }
      case 'inner': {
        const kinds = plan.innerBonds.map((x) => `${x.of}: ${x.kinds.map((b) => `${b.label} ×${b.count}`).join(', ')}`).join(' · ')
        main = kinds || s3.main
        sub = pick(
          [
            'Внутри многоатомного иона атомы неметаллов соединяются общими электронными парами (бирюзовые точки) — палочки появляются одна за другой.',
            'Inside the polyatomic ion the non-metal atoms join through shared electron pairs (cyan dots) — the sticks appear one by one.',
            'Koʻp atomli ion ichida metallmas atomlari umumiy elektron juftlar (moviy nuqtalar) orqali birikadi — tayoqchalar birma-bir paydo boʻladi.',
          ],
          loc,
        )
        break
      }
      case 'transfer': {
        const parts = plan.species
          .filter((s) => s.charge !== 0)
          .map((s) => {
            const q = Math.abs(s.charge)
            const neutral = s.kind === 'ion' ? Object.keys(s.comp)[0]! : s.formula.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]/g, '')
            return s.charge > 0 ? `${neutral} − ${eCount(q)} → ${s.formula}` : `${neutral} + ${eCount(q)} → ${s.formula}`
          })
        main = parts.join(' · ')
        sub = `${pick(
          [
            `Оранжевые точки — электроны, которые переходят от атомов металла к неметаллу: всего ${story.transferred} e⁻ в показанной модели. `,
            `Orange dots are electrons moving from the metal atoms to the non-metal: ${story.transferred} e⁻ in the model shown. `,
            `Toʻq sariq nuqtalar — metall atomlaridan metallmasga oʻtayotgan elektronlar: koʻrsatilgan modelda jami ${story.transferred} e⁻. `,
          ],
          loc,
        )}${s2.main}. ${s2.sub}`
        break
      }
      case 'pairs':
        main = s2.main
        sub = pick(
          [
            `Каждая связь — общая пара электронов: по одному от каждого атома (у донорно-акцепторной — оба от одного). Двойная — две пары, тройная — три. Всего пар: ${story.sharedPairs}.`,
            `Each bond is a shared pair of electrons: one from each atom (in a donor–acceptor bond both come from one atom). A double bond is two pairs, a triple — three. Pairs in total: ${story.sharedPairs}.`,
            `Har bir bogʻ — umumiy elektron juft: har bir atomdan bittadan (donor-akseptor bogʻda ikkalasi bitta atomdan). Qoʻsh bogʻ — ikki juft, uchlamchi — uch. Jami juftlar: ${story.sharedPairs}.`,
          ],
          loc,
        )
        break
      case 'bonds':
        main = s3.main
        sub = `${s3.sub} ${pick(['Палочка — это общая электронная пара.', 'A stick is a shared electron pair.', 'Tayoqcha — umumiy elektron juft.'], loc)}`
        break
      case 'assemble':
        if (ionic) {
          main = s3.main
          sub = s3.sub
        } else {
          main = s4.sub.replace(/\.$/, '')
          sub = pick(
            [
              'Электронные пары отталкиваются друг от друга — атомы занимают места, и молекула принимает свою форму.',
              'Electron pairs repel each other — the atoms take their places and the molecule gets its shape.',
              'Elektron juftlar bir-biridan itariladi — atomlar oʻz joyini egallaydi va molekula oʻz shaklini oladi.',
            ],
            loc,
          )
        }
        break
      case 'lattice':
        main = pick(['Ионная кристаллическая решётка', 'Ionic crystal lattice', 'Ion kristall panjara'], loc)
        sub =
          story.latticeAtoms.length > 0
            ? pick(
                [
                  'Формульная единица повторяется во всех направлениях — так строится кристалл (показан фрагмент). Каждый ион окружён ионами противоположного знака.',
                  'The formula unit repeats in every direction — this is how the crystal is built (a fragment is shown). Each ion is surrounded by ions of opposite charge.',
                  'Formula birligi barcha yoʻnalishlarda takrorlanadi — kristall shunday quriladi (boʻlagi koʻrsatilgan). Har bir ion qarama-qarshi zaryadli ionlar bilan oʻralgan.',
                ],
                loc,
              )
            : pick(
                [
                  'Ионы занимают места в решётке слой за слоем: каждый ион окружён ионами противоположного знака.',
                  'The ions take their places in the lattice layer by layer: each ion is surrounded by ions of opposite charge.',
                  'Ionlar panjarada qatlam-qatlam joylashadi: har bir ion qarama-qarshi zaryadli ionlar bilan oʻralgan.',
                ],
                loc,
              )
        break
      case 'final':
        main = s4.main
        sub = s4.sub
        break
      case 'route': {
        // Путь на уровне частиц (formationStory.routeStage): уравнение пути и фраза учителя.
        const r = story.routeStage
        main = r ? r.equation : (eq?.lab ?? eq?.direct ?? '')
        sub = r ? pick(r.text, loc) : main
        break
      }
    }
    // Учитель: фразы по типу и пути образования каждого из 200 веществ (formationTeacher.ts); иначе — шаблоны выше.
    const t = formationTeacherLines(plan.compoundId, st.key, loc)
    if (t && t.main && t.sub) {
      main = t.main
      sub = REF_IN_SUB ? `${t.sub} (${t.ref})` : t.sub
    }
    out.push(t ? { key: st.key, title, main, sub, ref: t.ref } : { key: st.key, title, main, sub })
  }
  const kindKey = routeKindKey(plan.compoundId)
  const kind = routeKindLabel(plan.compoundId, loc)
  const kindSuffix = kind && kindKey !== 'elements' && kindKey !== 'atoms' ? ` — ${kind}` : ''
  const condition = eq?.heat || eq?.catalyst ? ` (${[eq.heat ? 't°' : '', eq.catalyst ?? ''].filter(Boolean).join(', ')})` : ''
  const equation = eq?.direct
    ? {
        lead: eq.directKind === 'atoms' ? pick(['Из атомов', 'From atoms', 'Atomlardan'], loc) : pick(['Из простых веществ', 'From simple substances', 'Oddiy moddalardan'], loc),
        text: `${eq.direct}${condition}`,
        lab: eq.lab,
        labLead: pick(['В лаборатории / промышленности', 'In the lab / industry', 'Laboratoriyada / sanoatda'], loc),
        kind,
        special: formationTeacherSpecial(plan.compoundId, loc),
        specialLead: pick(['Особенность', 'Key point', 'Oʻziga xoslik'], loc),
      }
    : {
        lead: `${pick(['Из простых веществ напрямую не получают. В лаборатории получают так', 'Not made directly from simple substances. In the lab it is made like this', 'Oddiy moddalardan bevosita olinmaydi. Laboratoriyada shunday olinadi'], loc)}${kindSuffix}`,
        text: `${eq?.lab ?? ''}${condition}`,
        lab: null,
        labLead: '',
        kind,
        special: formationTeacherSpecial(plan.compoundId, loc),
        specialLead: pick(['Особенность', 'Key point', 'Oʻziga xoslik'], loc),
      }
  return {
    stages: out,
    equation,
    board: formationTeacherBoard(plan.compoundId, loc),
    note: base.note,
    ui: {
      play: base.ui.play,
      pause: base.ui.pause,
      resume: base.ui.resume,
      replay: base.ui.replay,
      close: base.ui.close,
      prev: pick(['Предыдущий этап', 'Previous stage', 'Oldingi bosqich'], loc),
      next: pick(['Следующий этап', 'Next stage', 'Keyingi bosqich'], loc),
      speed: pick(['Скорость', 'Speed', 'Tezlik'], loc),
      time: pick(['Время показа', 'Playback time', 'Koʻrsatish vaqti'], loc),
      stage: pick(['Этап', 'Stage', 'Bosqich'], loc),
    },
  }
}


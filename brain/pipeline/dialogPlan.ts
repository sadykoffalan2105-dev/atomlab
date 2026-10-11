/**
 * Мозг v2, DIALOG: план ответа — сколько слов (класс длины), какой каркас (по типу вопроса), сколько истории и
 * знаний положить в подсказку (по профилю laptop/gpu из config.dialog) и блок ДИАЛОГ (чем эта реплика связана
 * с прошлой). Классы длины: явные слова «кратко/подробно» > follow-up (проще/пример → short, подробнее → long) >
 * стиль, запомненный из разговора > тип вопроса × охват; detail='more' поднимает на класс; живой голос — ≤ 70 слов.
 */
import type { BrainConfig } from '../config.ts'
import type { StudentSnapshot } from '../student/model.ts'
import { cueLength, firstSentence } from './dialogResolve.ts'
import type { AnswerPlan, DialogState, LengthClass, Profile, QuestionKind, Scope, StandaloneQuery } from './dialogTypes.ts'
import { BARE_FOLLOW_UP } from './explain.ts'
import type { Lang } from './normalize.ts'

const ORDER: LengthClass[] = ['tiny', 'short', 'normal', 'long']

/** Класс по типу вопроса и охвату (без явных просьб ученика). */
export function defaultLength(kind: QuestionKind, scope: Scope, detail: 'brief' | 'more'): LengthClass {
  let lc: LengthClass
  if (kind === 'chitchat' || scope === 'offtopic') lc = 'tiny'
  else if (kind === 'broad' || scope === 'broad') return detail === 'more' ? 'long' : 'normal'
  else if (kind === 'definition' || kind === 'test_style' || kind === 'confirm') lc = 'short'
  else if (kind === 'calc' || kind === 'homework') lc = 'normal'
  else if (kind === 'why' || kind === 'compare' || kind === 'properties' || kind === 'uses' || kind === 'howto_obtain' || kind === 'who_history') lc = 'normal'
  else lc = 'normal'
  return detail === 'more' ? ORDER[Math.min(3, ORDER.indexOf(lc) + 1)]! : lc
}

const T = (lang: Lang, ru: string, uz: string, en: string) => (lang === 'ru' ? ru : lang === 'uz' ? uz : en)

/** Каркас ответа по типу вопроса (строка блока ФОРМАТ). */
export function structureFor(kind: QuestionKind, lang: Lang, offer = ''): string {
  switch (kind) {
    case 'definition':
      return T(lang, '1) определение одним предложением; 2) из чего следует или зачем нужно; 3) один пример с формулой.', '1) bir jumlada taʼrif; 2) nimadan kelib chiqadi yoki nima uchun kerak; 3) formulali bitta misol.', '1) a one-sentence definition; 2) where it comes from or why it matters; 3) one example with a formula.')
    case 'why':
      return T(lang, '1) прямой ответ-причина; 2) механизм через закон (строение атома, сохранение, электроотрицательность, энергия, равновесие); 3) пример или уравнение; без воды.', '1) toʻgʻridan-toʻgʻri sabab; 2) qonun orqali mexanizm (atom tuzilishi, saqlanish, elektromanfiylik, energiya, muvozanat); 3) misol yoki tenglama; ortiqcha gapsiz.', '1) the direct cause; 2) the mechanism via a law (atomic structure, conservation, electronegativity, energy, equilibrium); 3) an example or equation; no filler.')
    case 'howto_obtain':
      return T(lang, 'только уравнения из блока ВЫЧИСЛЕНО ТОЧНО или справки; лаборатория и промышленность раздельно; одна фраза условий.', 'faqat VERILGAN ANIQ HISOB yoki maʼlumotnomadagi tenglamalar; laboratoriya va sanoat alohida; sharoit — bir jumla.', 'only equations from the CALCULATED EXACTLY block or the reference; laboratory and industry separately; one sentence on conditions.')
    case 'compare':
      return T(lang, 'общее — одной фразой, затем 2–3 отличия парами «X — …, Y — …», вывод.', 'umumiy jihat — bir jumla, keyin 2–3 farq juftlikda «X — …, Y — …», xulosa.', 'what they share in one sentence, then 2–3 differences as pairs “X — …, Y — …”, a conclusion.')
    case 'calc':
    case 'homework':
      return T(lang, 'дано → формула → подстановка → ответ с единицами; числа из ВЫЧИСЛЕНО ТОЧНО не менять.', 'berilgan → formula → qiymatlarni qoʻyish → birlik bilan javob; VERILGAN ANIQ HISOB sonlarini oʻzgartirma.', 'given → formula → substitution → answer with units; do not change numbers from CALCULATED EXACTLY.')
    case 'properties':
      return T(lang, 'физические свойства (агрегатное состояние, цвет, растворимость) → химические (до 3 реакций с уравнениями).', 'fizik xossalar (agregat holat, rang, eruvchanlik) → kimyoviy xossalar (tenglamali 3 tagacha reaksiya).', 'physical properties (state, colour, solubility) → chemical ones (up to 3 reactions with equations).')
    case 'uses':
      return T(lang, '3–4 применения, у каждого — свойство-причина.', '3–4 qoʻllanish, har biriga sabab boʻlgan xossa.', '3–4 uses, each with the property that explains it.')
    case 'who_history':
      return T(lang, 'факт → кто и когда (только если есть в справке) → почему это важно; дат не выдумывать.', 'fakt → kim va qachon (faqat maʼlumotnomada boʻlsa) → nega muhim; sanalarni oʻylab topma.', 'the fact → who and when (only if in the reference) → why it matters; never invent dates.')
    case 'broad':
      return T(lang, 'ответ как учёный: суть, причина, связь со школьной темой, один интересный факт; можно шире школьной программы.', 'olimdek javob: mohiyat, sabab, maktab mavzusi bilan bogʻliqlik, bitta qiziq fakt; maktab dasturidan kengroq boʻlishi mumkin.', 'answer like a scientist: the essence, the cause, the link to the school topic, one interesting fact; you may go beyond the school course.')
    case 'chitchat':
      return T(lang, '1–2 тёплые фразы и мост к химии.', '1–2 iliq jumla va kimyoga koʻprik.', '1–2 warm sentences and a bridge to chemistry.')
    case 'test_style':
      return T(lang, 'сначала буква ответа или «верно/неверно», потом одно обоснование.', 'avval javob harfi yoki «toʻgʻri/notoʻgʻri», keyin bitta asoslash.', 'first the answer letter or “true/false”, then one justification.')
    case 'repeat':
      return T(lang, 'то же самое другими словами, без новых фактов.', 'xuddi shuni boshqa soʻzlar bilan, yangi faktlarsiz.', 'the same in other words, no new facts.')
    case 'confirm':
      return T(lang, `выполни то, что сам предложил${offer ? `: «${offer}»` : ''}.`, `oʻzing taklif qilgan narsani bajar${offer ? `: «${offer}»` : ''}.`, `do what you yourself offered${offer ? `: “${offer}”` : ''}.`)
    default:
      return T(lang, 'прямой ответ, затем почему так и один пример.', 'toʻgʻridan-toʻgʻri javob, keyin nega shunday va bitta misol.', 'a direct answer, then why, and one example.')
  }
}

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'
}

/** Что сейчас делает ученик — для блока ДИАЛОГ. */
function nowDoing(sq: StandaloneQuery, lang: Lang): string {
  const x = sq.entities[0] ?? ''
  const g = sq.grade?.slice(1) ?? ''
  switch (sq.followUp) {
    case 'simpler':
      return T(lang, 'просит объяснить проще', 'soddaroq tushuntirishni soʻrayapti', 'asks for a simpler explanation')
    case 'switch_entity':
      return T(lang, `спрашивает о ${x || sq.topic || 'другом'} в том же разрезе`, `xuddi shu jihatdan ${x || sq.topic || 'boshqasi'} haqida soʻrayapti`, `asks about ${x || sq.topic || 'another case'} in the same way`)
    case 'why':
      return T(lang, 'спрашивает причину', 'sababini soʻrayapti', 'asks for the reason')
    case 'example':
      return T(lang, 'просит пример', 'misol soʻrayapti', 'asks for an example')
    case 'more':
      return T(lang, 'просит подробнее', 'batafsilroq soʻrayapti', 'asks for more detail')
    case 'repeat':
      return T(lang, 'просит повторить другими словами', 'boshqa soʻzlar bilan takrorlashni soʻrayapti', 'asks you to repeat it in other words')
    case 'switch_grade':
      return T(lang, `переспрашивает для ${g} класса — объясни на уровне ${g} класса, как в учебнике Kimyo ${g}`, `${g}-sinf uchun soʻrayapti — ${g}-sinf darajasida, Kimyo ${g} darsligidagidek tushuntir`, `asks for grade ${g} — explain at the grade ${g} level, as in the Kimyo ${g} textbook`)
    case 'confirm':
      return T(lang, 'соглашается на твоё предложение', 'taklifingga rozi boʻlyapti', 'accepts your offer')
    case 'deictic':
      return T(lang, `продолжает тему (речь о ${x || sq.topic})`, `mavzuni davom ettiryapti (gap ${x || sq.topic} haqida)`, `continues the topic (about ${x || sq.topic})`)
    default:
      return T(lang, 'задаёт новый вопрос по той же теме', 'shu mavzuda yangi savol beryapti', 'asks a new question on the same topic')
  }
}

/** Блок ДИАЛОГ (≤ maxChars): только когда реплика продолжает прошлый разговор. */
export function dialogBlock(sq: StandaloneQuery, state: DialogState, maxChars: number): string {
  if (state.turns < 1) return ''
  const sameTopic = !!sq.topic && sq.topic === state.topic
  if (sq.followUp === 'none' && !sameTopic) return ''
  const L = sq.lang
  const head = T(L, 'ДИАЛОГ', 'MULOQOT', 'DIALOG')
  const topic = state.topic ?? sq.topic
  const doing = nowDoing(sq, L)
  const tail = T(L, 'Не повторяй сказанное дословно.', 'Aytilganni soʻzma-soʻz takrorlama.', 'Do not repeat what was said word for word.')
  // бюджет: сначала обязательное (тема, что делает ученик), остаток — на прошлый вопрос и ответ
  const fixed = `${head}: ${topic ? T(L, `тема — ${topic}; `, `mavzu — ${topic}; `, `topic — ${topic}; `) : ''}${T(L, 'сейчас ученик ', 'hozir oʻquvchi ', 'now the student ')}${doing}. ${tail}`
  let room = maxChars - fixed.length
  const parts: string[] = []
  // «а почему?» и «проще» опираются на ответ учителя, «а у натрия?» и «для 8 класса» — на прежний вопрос
  const answerFirst = sq.followUp === 'why' || sq.followUp === 'simpler' || sq.followUp === 'example' || sq.followUp === 'more' || sq.followUp === 'confirm'
  const qPart = () => {
    if (!state.lastStandalone || room < 45) return
    const q = clip(state.lastStandalone, Math.min(80, room - 25))
    const s = T(L, `предыдущий вопрос — «${q}»; `, `oldingi savol — «${q}»; `, `previous question — “${q}”; `)
    parts.push(s)
    room -= s.length
  }
  const aPart = () => {
    const a = firstSentence(state.lastAnswer, 120)
    if (!a || room < 45) return
    const s = T(L, `ты ответил: «${clip(a, room - 18)}»; `, `sen javob berding: «${clip(a, room - 24)}»; `, `you answered: “${clip(a, room - 18)}”; `)
    parts.push(s)
    room -= s.length
  }
  if (answerFirst) {
    aPart()
    qPart()
  } else {
    qPart()
    aPart()
  }
  const out = `${head}: ${topic ? T(L, `тема — ${topic}; `, `mavzu — ${topic}; `, `topic — ${topic}; `) : ''}${parts.join('')}${T(L, 'сейчас ученик ', 'hozir oʻquvchi ', 'now the student ')}${doing}. ${tail}`
  return out.length <= maxChars + 10 ? out : fixed
}

export function planAnswer(
  sq: StandaloneQuery,
  state: DialogState,
  _snap: StudentSnapshot,
  a: { mode: 'chat' | 'live'; detail: 'brief' | 'more'; profile: Profile; config: BrainConfig },
): AnswerPlan {
  const d = a.config.dialog
  const prof = a.profile === 'gpu' ? d.gpu : d.laptop
  const cue = cueLength(sq.original, sq.followUp, state)
  let lc: LengthClass = cue ?? defaultLength(sq.kind, sq.scope, a.detail)
  if (sq.kind === 'chitchat' && !cue) lc = 'tiny'
  const live = a.mode === 'live'
  let words: [number, number] = [...d.lengthWords[lc]] as [number, number]
  // расчёт: числа важнее слов — минимум не требуем
  if (sq.kind === 'calc' || sq.kind === 'homework') words = [0, words[1]]
  if (live) words = [Math.min(words[0], 20), Math.min(words[1], a.config.wordLimits.live)]
  // токены: по-русски и по-узбекски ~2,4 токена на слово (qwen), по-английски ~1,6 — меньше обрезанных хвостов
  const perWord = sq.lang === 'en' ? 1.6 : 2.4
  const byClass = lc === 'long' ? prof.numPredictLong : d.numPredictByClass[lc]
  const numPredict = live ? a.config.numPredict.live : Math.max(byClass, Math.round(words[1] * perWord))
  const offer = sq.followUp === 'confirm' ? sq.text.replace(/^(Да|Ha|Yes):\s*/u, '').replace(/\s+—.*$/u, '') : ''
  const kind: QuestionKind = sq.kind === 'repeat' ? 'repeat' : sq.kind
  let structure = structureFor(kind, sq.lang, offer)
  if (sq.followUp === 'simpler') structure = T(sq.lang, 'объясни проще, чем в прошлый раз: короткие предложения, бытовая аналогия, один пример; без новых терминов.', 'oldingidan soddaroq: qisqa jumlalar, hayotiy oʻxshatish, bitta misol; yangi atamalarsiz.', 'explain more simply than before: short sentences, an everyday analogy, one example; no new terms.')
  else if (sq.followUp === 'example') structure = T(sq.lang, 'один-два конкретных примера с формулами или уравнением и короткое пояснение к каждому.', 'formula yoki tenglamali bir-ikki aniq misol va har biriga qisqa izoh.', 'one or two concrete examples with formulas or an equation and a short note on each.')
  else if (sq.followUp === 'switch_grade' && sq.grade) {
    const g = sq.grade.slice(1)
    structure += T(sq.lang, ` Объясни на уровне ${g} класса, как в учебнике Kimyo ${g}.`, ` ${g}-sinf darajasida, Kimyo ${g} darsligidagidek tushuntir.`, ` Explain at the grade ${g} level, as in the Kimyo ${g} textbook.`)
  }
  // «а почему?» / «why?» без темы и без истории — не гадать о теме, а коротко попросить уточнить
  if (state.turns < 1 && BARE_FOLLOW_UP.test(sq.original)) {
    lc = 'tiny'
    words = [...d.lengthWords.tiny] as [number, number]
    structure = T(sq.lang, 'тема не названа и истории нет: одной-двумя фразами попроси уточнить, о каком веществе, реакции или законе речь, и дай пример вопроса; не объясняй наугад.', 'mavzu aytilmagan va tarix yoʻq: bir-ikki jumlada qaysi modda, reaksiya yoki qonun haqida ekanini aniqlashtirishni soʻra va savolga misol keltir; taxminan tushuntirma.', 'no topic and no history: in one or two sentences ask which substance, reaction or law they mean and give a sample question; do not guess.')
  }
  const verifyKinds: QuestionKind[] = ['why', 'compare', 'calc', 'homework', 'howto_obtain', 'broad']
  return {
    lengthClass: lc,
    words,
    numPredict,
    structure,
    useHistory: live ? Math.min(2, prof.historyMessages) : prof.historyMessages,
    historyChars: prof.historyChars,
    knowledgeChars: live ? a.config.prompt.liveChars : prof.knowledgeChars,
    knowledgeItems: live ? a.config.prompt.liveItems : prof.knowledgeItems,
    dialogBlock: live ? '' : dialogBlock(sq, state, d.dialogBlockChars),
    verify: a.profile === 'gpu' && !live && verifyKinds.includes(sq.kind),
  }
}

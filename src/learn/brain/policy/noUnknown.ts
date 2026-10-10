/**
 * Пост-проверка ответа (контракт «Локальный мозг» v1, R3): в финальном ответе не бывает
 * «в моей базе нет», «не знаю», «не могу ответить», «bazamda … yo‘q», «bilmayman», «I don't know»,
 * «not in my database», «умный ИИ» и имя прежнего облачного сервиса. Такие фразы убираются, а вместо них учитель
 * рассуждает от основ: определение/закон по ключевому термину, ближайшие темы и уточняющий вопрос.
 * Точных чисел не выдумываем — только логика от фундаментальных законов (уровень «reasoned»).
 */
import { foldForPolicy, type PolicyLang } from './lang'

/** Запрещённые фразы R3 (+ прежние формулировки «нет в базе» локального составителя). */
const R3: readonly RegExp[] = [
  /в\s+моей\s+базе\s+(нет|не\s+написано|не\s+найдено)/iu,
  /нет\s+в\s+(моей\s+)?базе/iu,
  /в\s+моей\s+базе[^.!?]{0,60}\sнет(?!\p{L})/iu,
  /(?<!\p{L})не\s+знаю(?!\p{L})/iu,
  /не\s+могу\s+ответить/iu,
  /выдумывать\s+(я\s+)?не\s+буду/iu,
  /bazamda[^.!?]{0,60}yo'?q/iu,
  /bazamda\s+(aniq\s+)?(javob\s+)?yozilmagan/iu,
  /(?<!\p{L})bilmayman(?!\p{L})/iu,
  /o'ylab\s+topmayman/iu,
  /i\s+don'?t\s+know/iu,
  /i\s+do\s+not\s+know/iu,
  /not\s+in\s+my\s+(database|knowledge\s+base)/iu,
  /my\s+knowledge\s+base\s+has\s+no/iu,
  /not\s+written\s+in\s+my\s+knowledge\s+base/iu,
  /in\s+my\s+knowledge\s+base/iu,
  /i\s+will\s+not\s+make\s+one\s+up/iu,
  /умн(ый|ого|ому|ым)\s+ии/iu,
  /aqlli\s+si/iu,
  /smart\s+ai/iu,
  // имя прежнего облачного сервиса (без «com…»)
  /(?<!\p{L})p[u]ter(?!\p{L})/iu,
]

/** Есть ли в тексте фраза R3. */
export function hasUnknownPhrase(text: string): boolean {
  const t = foldForPolicy(text)
  return R3.some((re) => re.test(t))
}

/* ------------------------------------------------------------ рассуждение от основ */

type Fundamental = { re: RegExp; ru: string; en: string; uz: string }

/** Фундаментальные законы: из какого закона выводится ответ на тему вопроса. */
const FUNDAMENTALS: readonly Fundamental[] = [
  {
    re: /(сжат|радиус|размер\s+атом|лантано|актино|contraction|radius|radii|siqil)/u,
    ru: 'размер атома задают заряд ядра и экранирование электронами. Внутренние d- и особенно f-электроны экранируют ядро слабо, поэтому при их заполнении эффективный заряд ядра растёт и электронные оболочки стягиваются — атомы и ионы становятся меньше, чем ожидалось бы',
    en: 'atomic size is set by the nuclear charge and electron shielding. Inner d- and especially f-electrons shield the nucleus poorly, so as they fill, the effective nuclear charge grows and the shells are pulled in — atoms and ions end up smaller than expected',
    uz: 'atom oʻlchamini yadro zaryadi va elektronlar ekranlashi belgilaydi. Ichki d- va ayniqsa f-elektronlar yadroni yomon ekranlaydi, shuning uchun ular toʻlganda effektiv yadro zaryadi ortadi va qobiqlar torayadi — atom va ionlar kutilganidan kichikroq boʻladi',
  },
  {
    re: /(кислот|основан|щелоч|(?<!\p{L})ph(?!\p{L})|acid|(?<!\p{L})bases?(?!\p{L})|alkali|kislot|asos|ishqor)/u,
    ru: 'кислотно-основные свойства выводятся из теорий Аррениуса и Брёнстеда — Лоури: кислота отдаёт протон, основание его принимает; сила определяется полярностью и прочностью связи с водородом и устойчивостью образующегося иона',
    en: 'acid–base behaviour follows from the Arrhenius and Brønsted–Lowry theories: an acid donates a proton, a base accepts it; strength depends on the polarity and strength of the bond to hydrogen and on the stability of the ion formed',
    uz: 'kislota-asos xossalari Arrenius va Brёnsted — Louri nazariyalaridan kelib chiqadi: kislota proton beradi, asos uni qabul qiladi; kuchi vodorod bilan bogʻning qutbliligi va mustahkamligiga hamda hosil boʻlgan ionning barqarorligiga bogʻliq',
  },
  {
    re: /(окисл|восстанов|электролиз|гальван|redox|oxid|reduc|electroly|oksidl|qaytar|elektroliz)/u,
    ru: 'окислительно-восстановительные процессы — это перенос электронов: окислитель принимает электроны, восстановитель отдаёт; число отданных и принятых электронов равно (закон сохранения заряда), а направление задают электродные потенциалы',
    en: 'redox processes are electron transfer: the oxidising agent gains electrons, the reducing agent loses them; electrons lost equal electrons gained (conservation of charge), and the direction is set by electrode potentials',
    uz: 'oksidlanish-qaytarilish jarayonlari — elektronlar koʻchishi: oksidlovchi elektron qabul qiladi, qaytaruvchi beradi; berilgan va olingan elektronlar soni teng (zaryadning saqlanish qonuni), yoʻnalishini esa elektrod potensiallari belgilaydi',
  },
  {
    re: /(скорост|катализ|кинетик|rate|kinetic|catalys|tezlik|kataliz)/u,
    ru: 'скорость реакции следует из теории столкновений и уравнения Аррениуса: она растёт с концентрацией и температурой, а катализатор снижает энергию активации, не смещая равновесие',
    en: 'reaction rate follows from collision theory and the Arrhenius equation: it grows with concentration and temperature, while a catalyst lowers the activation energy without shifting equilibrium',
    uz: 'reaksiya tezligi toʻqnashuvlar nazariyasi va Arrenius tenglamasidan kelib chiqadi: u konsentratsiya va harorat bilan ortadi, katalizator esa muvozanatni siljitmasdan aktivlanish energiyasini kamaytiradi',
  },
  {
    re: /(равновес|ле\s+шателье|equilibri|le\s+chatelier|muvozanat)/u,
    ru: 'химическое равновесие описывает закон действующих масс, а его смещение — принцип Ле Шателье: система противодействует внешнему воздействию (концентрации, давлению, температуре)',
    en: 'chemical equilibrium is described by the law of mass action, and its shift by Le Chatelier’s principle: the system counteracts an external change (concentration, pressure, temperature)',
    uz: 'kimyoviy muvozanatni massalar taʼsiri qonuni tavsiflaydi, uning siljishini esa Le Shatelye prinsipi: tizim tashqi taʼsirga (konsentratsiya, bosim, harorat) qarshilik qiladi',
  },
  {
    re: /(энерги|теплот|энтальп|энтроп|гиббс|термодинам|энергетик|enthalp|entrop|gibbs|thermo|energy|energiya|issiqlik)/u,
    ru: 'энергетику реакции задают законы термодинамики: закон Гесса для теплоты, а самопроизвольность — знак энергии Гиббса ΔG = ΔH − TΔS',
    en: 'the energetics of a reaction follow the laws of thermodynamics: Hess’s law for heat, and spontaneity from the sign of the Gibbs energy ΔG = ΔH − TΔS',
    uz: 'reaksiya energetikasini termodinamika qonunlari belgilaydi: issiqlik uchun Gess qonuni, oʻz-oʻzidan borishi esa Gibbs energiyasi ishorasi ΔG = ΔH − TΔS bilan',
  },
  {
    re: /(связ|электроотриц|гибридиз|полярн|bond|electronegativ|hybridi|polar|bogʻ|bog'|elektromanfiy)/u,
    ru: 'тип и прочность химической связи выводятся из электроотрицательности атомов и перекрывания орбиталей: большая разница электроотрицательностей даёт ионную связь, малая — ковалентную',
    en: 'the type and strength of a chemical bond follow from the electronegativity of the atoms and orbital overlap: a large electronegativity difference gives an ionic bond, a small one a covalent bond',
    uz: 'kimyoviy bogʻning turi va mustahkamligi atomlarning elektromanfiyligi va orbitallar qoplanishidan kelib chiqadi: elektromanfiylik farqi katta boʻlsa — ion bogʻ, kichik boʻlsa — kovalent bogʻ',
  },
  {
    re: /(газ|давлен|объ[её]м|моль|авогадро|gas|pressure|volume|(?<!\p{L})moles?(?!\p{L})|avogadro|bosim|hajm)/u,
    ru: 'количественные соотношения выводятся из закона Авогадро и уравнения состояния идеального газа pV = nRT, а массы — из закона сохранения массы',
    en: 'quantitative relations follow from Avogadro’s law and the ideal gas equation pV = nRT, and masses from the law of conservation of mass',
    uz: 'miqdoriy nisbatlar Avogadro qonuni va ideal gaz tenglamasi pV = nRT dan, massalar esa massaning saqlanish qonunidan kelib chiqadi',
  },
  {
    re: /(раствор|растворим|осад|гидролиз|solub|solution|precipit|hydroly|eritma|gidroliz)/u,
    ru: 'поведение веществ в растворе определяют электролитическая диссоциация, произведение растворимости и гидролиз: ионы связываются, если образуют малорастворимое вещество, газ или слабый электролит',
    en: 'behaviour in solution is governed by electrolytic dissociation, the solubility product and hydrolysis: ions combine when they form a poorly soluble substance, a gas or a weak electrolyte',
    uz: 'eritmadagi xatti-harakatni elektrolitik dissotsilanish, eruvchanlik koʻpaytmasi va gidroliz belgilaydi: ionlar kam eriydigan modda, gaz yoki kuchsiz elektrolit hosil qilsa birikadi',
  },
  {
    re: /(орбитал|квант|спектр|цвет|электронн\p{L}*\s+конфиг|orbital|quantum|spectr|colou?r|kvant|(?<!\p{L})rang)/u,
    ru: 'это выводится из квантовой механики: электроны занимают орбитали по принципу Паули и правилу Хунда, а цвет и спектры — переходы электронов между уровнями энергии',
    en: 'this follows from quantum mechanics: electrons fill orbitals by the Pauli principle and Hund’s rule, while colour and spectra come from electron transitions between energy levels',
    uz: 'bu kvant mexanikasidan kelib chiqadi: elektronlar orbitallarni Pauli prinsipi va Xund qoidasi boʻyicha egallaydi, rang va spektrlar esa energiya sathlari orasidagi elektron oʻtishlari',
  },
  {
    re: /(изомер|органич|углевод|алкан|алкен|isomer|organic|hydrocarbon|izomer|uglevodorod)/u,
    ru: 'свойства органических веществ выводятся из теории строения Бутлерова: они зависят не только от состава, но и от порядка соединения атомов и взаимного влияния групп',
    en: 'the properties of organic compounds follow from Butlerov’s structural theory: they depend not only on composition but on how the atoms are connected and how groups influence each other',
    uz: 'organik moddalar xossalari Butlerovning tuzilish nazariyasidan kelib chiqadi: ular faqat tarkibga emas, atomlarning birikish tartibi va guruhlarning oʻzaro taʼsiriga ham bogʻliq',
  },
  {
    re: /(период|групп|металл|неметалл|элемент|periodic|group|metal|element|davriy|guruh)/u,
    ru: 'свойства элементов выводятся из периодического закона: они зависят от заряда ядра и строения внешнего электронного слоя, поэтому периодически повторяются',
    en: 'the properties of elements follow from the periodic law: they depend on the nuclear charge and the outer electron shell, so they repeat periodically',
    uz: 'elementlar xossalari davriy qonundan kelib chiqadi: ular yadro zaryadi va tashqi elektron qavat tuzilishiga bogʻliq, shuning uchun davriy takrorlanadi',
  },
]

const GENERIC: Record<PolicyLang, string> = {
  ru: 'любой химический вопрос сводится к строению атома, периодическому закону, природе химической связи и законам сохранения массы, заряда и энергии — от них и будем рассуждать',
  en: 'any chemistry question comes down to atomic structure, the periodic law, the nature of the chemical bond and the conservation of mass, charge and energy — we will reason from those',
  uz: 'har qanday kimyoviy savol atom tuzilishi, davriy qonun, kimyoviy bogʻ tabiati va massa, zaryad hamda energiyaning saqlanish qonunlariga borib taqaladi — shulardan kelib chiqib fikrlaymiz',
}

const LEAD: Record<PolicyLang, string> = { ru: 'Разберём от основ', en: 'Let us reason from the fundamentals', uz: 'Asoslardan boshlab tahlil qilamiz' }
const NEAR: Record<PolicyLang, string> = { ru: 'Ближайшие темы', en: 'Nearby topics', uz: 'Yaqin mavzular' }
const ASK: Record<PolicyLang, string> = {
  ru: 'Уточни, что именно интересует — состав, свойства или получение?',
  en: 'Tell me what exactly interests you — composition, properties or preparation?',
  uz: 'Aniq nima qiziqtiradi — tarkibimi, xossalarimi yoki olinishimi?',
}

export interface ReasonedOptions {
  /** Ключевой термин вопроса (extractKeyTerm) — подставляется в рассуждение. */
  keyTerm?: string | null
  /** Готовое определение (первое предложение найденного фрагмента), если есть. */
  definition?: string | null
  /** Сам вопрос — для выбора фундаментального закона. */
  query?: string
}

function capitalize(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s
}

/** «Разберём от основ: …. Ближайшие темы: A, B. Уточни, …?» */
export function reasonFromBasics(lang: PolicyLang, nearTopics: readonly string[], opts: ReasonedOptions = {}): string {
  const probe = foldForPolicy(`${opts.query ?? ''} ${opts.keyTerm ?? ''}`)
  const law = FUNDAMENTALS.find((f) => f.re.test(probe))
  let core: string
  const def = (opts.definition ?? '').replace(/\s+/g, ' ').trim().replace(/[.!?…]+$/u, '')
  if (def) core = def
  else if (law) {
    const term = (opts.keyTerm ?? '').trim()
    const lawText = law[lang]
    core = term
      ? lang === 'en'
        ? `“${term}” — ${lawText}`
        : `«${capitalize(term)}» — ${lawText}`
      : lawText
  } else {
    const term = (opts.keyTerm ?? '').trim()
    core = term ? (lang === 'en' ? `“${term}”: ${GENERIC.en}` : `«${capitalize(term)}»: ${GENERIC[lang]}`) : GENERIC[lang]
  }
  const near = [
    ...new Set(
      nearTopics
        .map((t) => t.replace(/[*_`«»"]/g, '').replace(/\s+/g, ' ').trim())
        .filter((t) => t.length >= 3 && t.length <= 60 && !probe.includes(foldForPolicy(t))),
    ),
  ].slice(0, 2)
  const parts = [`${LEAD[lang]}: ${core}.`]
  if (near.length) parts.push(`${NEAR[lang]}: ${near.join(', ')}.`)
  parts.push(ASK[lang])
  return parts.join(' ')
}

/** Текст начинается с заготовки «Разберём от основ» локального составителя (готового ответа нет). */
export function isReasonedLead(text: string): boolean {
  return /^\s*(Разберём от основ|Let us reason from the fundamentals|Asoslardan boshlab tahlil qilamiz)/u.test(text ?? '')
}

/** Разбить текст на предложения, не трогая подписи источников в квадратных скобках. */
function sentences(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+(?=[\p{Lu}«"“([0-9])/u).filter((s) => s.trim())
}

/**
 * Убрать из ответа фразы R3 и, если они были, заменить их рассуждением от основ.
 * Подписи источников («[Kimyo 8, §12]») и маркдаун сохраняются.
 */
export function ensureNoUnknown(text: string, lang: PolicyLang, nearTopics: readonly string[] = [], opts: ReasonedOptions = {}): string {
  const src = (text ?? '').trim()
  if (!src || !hasUnknownPhrase(src)) return src
  const out: string[] = []
  let removed = false
  for (const para of src.split(/\n{2,}/)) {
    const kept = sentences(para).filter((s) => {
      const bad = hasUnknownPhrase(s)
      if (bad) removed = true
      return !bad
    })
    if (kept.length) out.push(kept.join(' '))
  }
  if (!removed) return src
  const reasoned = reasonFromBasics(lang, nearTopics, opts)
  // Реплики «зато могу рассказать про…» после рассуждения лишние: темы уже названы.
  const rest = out.filter((p) => !/^(зато|lekin|but\s+i\s+can|i\s+can\s+tell|давай\s+вернёмся|keling|let\s+us\s+go\s+back)/iu.test(p.trim()))
  return [reasoned, ...rest].join('\n\n').trim()
}

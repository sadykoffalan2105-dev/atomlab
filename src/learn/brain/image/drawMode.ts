/**
 * Режим «🎨 Картинка» в чате ИИ-учителя — чистая логика без React (проверяется imageClient.selftest.ts):
 *
 *  • drawAvailability(): можно ли выбрать режим (сервер умеет рисовать и готов) и почему нет — для подсказки;
 *  • stageOf(): фазы сервера (checking → queue → waiting_gpu/switching/loading → sampling/decoding → safety/encoding)
 *    → понятные этапы «очередь / освобождаю видеокарту / рисую… N с / проверяю / готово»;
 *  • presetsForGrade() / nearestPreset(): темы своего класса ±1 и ближайшая тема к фразе «нарисуй …» (ученикам —
 *    только готовые темы: свой текст сервер не примет);
 *  • askAboutImageText(): вопрос учителю «про картинку» (текст с темой и формулой — байты картинки не отправляем);
 *  • cleanFormulaInput(): подпись-формула ученика — только символы формул (её рисует сайт, не модель).
 */
import type { ImageInfo, ImageLang, ImagePhase, ImagePreset, ImageRole } from '../remote/imageClient'

export type ChatComposeMode = 'ask' | 'image'

/* ------------------------------------------------------------------ доступность */

export type DrawUnavailable = 'offline' | 'disabled' | 'preparing'

export interface DrawAvailability {
  /** Режим можно выбрать (сервер рисует и готов). */
  selectable: boolean
  /** Эта роль может рисовать сейчас (ученик — если владелец включил темы для учеников). */
  canDraw: boolean
  /** Почему режим недоступен (подсказка на переключателе). */
  reason: DrawUnavailable | null
  /** Ученикам выключено — в режиме только ввод ключа учителя. */
  studentsOff: boolean
}

export function drawAvailability(info: ImageInfo | null, role: ImageRole): DrawAvailability {
  if (!info) return { selectable: false, canDraw: false, reason: 'offline', studentsOff: false }
  if (!info.enabled) return { selectable: false, canDraw: false, reason: 'disabled', studentsOff: false }
  if (!info.ready) return { selectable: false, canDraw: false, reason: 'preparing', studentsOff: false }
  const studentsOff = role === 'student' && !info.students
  return { selectable: true, canDraw: !studentsOff, reason: null, studentsOff }
}

/* ------------------------------------------------------------------ этапы */

export type DrawStage = 'request' | 'queue' | 'gpu' | 'draw' | 'check' | 'done'

/** Шкала этапов для ученика (без «принял запрос» — он мгновенный). */
export const DRAW_STAGES: readonly Exclude<DrawStage, 'request'>[] = ['queue', 'gpu', 'draw', 'check', 'done']

/** Фаза сервера (или место в очереди) → этап для экрана. */
export function stageOf(phase: ImagePhase | 'queue' | 'done'): DrawStage {
  switch (phase) {
    case 'checking':
      return 'request'
    case 'queue':
      return 'queue'
    case 'waiting_gpu':
    case 'switching':
    case 'loading':
      return 'gpu'
    case 'sampling':
    case 'decoding':
      return 'draw'
    case 'safety':
    case 'encoding':
      return 'check'
    default:
      return 'done'
  }
}

/** Индекс этапа на шкале (request — до первого шага). */
export function stageIndex(stage: DrawStage): number {
  return stage === 'request' ? -1 : DRAW_STAGES.indexOf(stage)
}

/* ------------------------------------------------------------------ темы */

export function gradeNum(g: string | undefined | null): number {
  const n = Number(String(g ?? '').replace(/\D/g, ''))
  return Number.isFinite(n) && n >= 7 && n <= 11 ? n : 0
}

/** Темы класса ±window (класс не известен — все). */
export function presetsForGrade(presets: readonly ImagePreset[], gradeId: string | undefined, window = 1): ImagePreset[] {
  const n = gradeNum(gradeId)
  if (!n) return [...presets]
  return presets.filter((p) => p.grades.some((g) => Math.abs(gradeNum(g) - n) <= window))
}

/** Основы слов: нижний регистр, первые 5 букв (кислота/кислоты), у коротких — без окончания (вода/воды). */
export function stems(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).map((w) => (w.length <= 5 ? w.slice(0, Math.max(3, w.length - 1)) : w.slice(0, 5)))
}

/**
 * Русские и узбекские слова темы → английские слова из id тем (сервер присылает заголовки только на языке сайта,
 * а «нарисуй водород» должен найти «Аппарат Киппа» — g7-hydrogen-kipp).
 */
const TERMS: ReadonlyArray<[RegExp, string]> = [
  [/водород|vodorod/u, 'hydrogen'],
  [/кислород|kislorod/u, 'oxygen'],
  // «\b» в JS не видит кириллицу — границы слова через \p{L}
  [/(?:^|[^\p{L}])(?:вод[аыуеой]?|suv|suvning)(?!\p{L})/u, 'water'],
  [/атом/u, 'atom'],
  [/метан|metan/u, 'methane'],
  [/этилен|этен|etilen/u, 'ethene'],
  [/бензол|benzol/u, 'benzene'],
  [/нефт|neft/u, 'oil'],
  [/бел(ок|ка|ки)|oqsil/u, 'protein'],
  [/мыл|sovun/u, 'soap'],
  [/натри|natriy/u, 'sodium'],
  [/ржав|zang/u, 'rusting'],
  [/желез|temir/u, 'iron'],
  [/магни|magniy/u, 'magnesium'],
  [/цинк|rux/u, 'zinc'],
  [/(?:^|[^\p{L}])(?:мед[ьи]|mis)(?!\p{L})|купорос|kuporos/u, 'copper'],
  [/nacl|хлорид натрия|поварен|osh tuzi/u, 'nacl'],
  [/электролиз|elektroliz/u, 'electrolysis'],
  [/аммиак|ammiak/u, 'ammonia'],
  [/серн|sulfat/u, 'sulfuric'],
  [/алюмини|глинозём|глинозем|alyuminiy/u, 'aluminium'],
  [/пламя|пламен|alanga/u, 'flame'],
  [/галоген|хлор|бром|иод|йод|galogen|xlor|brom|yod/u, 'halogens'],
  [/известня|негашён|ohak/u, 'lime'],
  [/брожени|bijg/u, 'fermentation'],
  [/полиэтилен|полимер|polietilen|polimer/u, 'polyethylene'],
  [/целлюлоз|крахмал|sellyuloza|kraxmal/u, 'cellulose'],
  [/хроматограф|xromatograf/u, 'chromatography'],
  [/завод|zavod/u, 'plant'],
  [/свеч|sham/u, 'candle'],
  [/штатив|shtativ/u, 'stand'],
  [/спиртовк|spirt/u, 'spirit'],
  [/посуд|idish/u, 'glassware'],
  [/фильтр|filtr/u, 'filtration'],
  [/выпари|bug.?lat/u, 'evaporation'],
  [/перегон|дистилл|distill|haydash/u, 'distillation'],
  [/индикатор|лакмус|фенолфталеин|indikator/u, 'indicators'],
  [/титрова|titrla/u, 'titration'],
  [/весы|весах|tarozi/u, 'balance'],
  [/сохранени.*масс|massaning/u, 'conservation'],
  [/сахар|shakar/u, 'sugar'],
  [/кристалл|kristall/u, 'crystals'],
  [/таблиц|менделеев|mendeleyev|jadval/u, 'periodic'],
  [/собирани.*газ|gazni/u, 'collection'],
  [/доменн|домна|domna/u, 'blast'],
  [/гальван|даниэл|батаре|galvanik/u, 'daniell'],
  [/кипп|kipp/u, 'kipp'],
  [/белк.*спирал|спирал/u, 'helix'],
  [/мицелл|mitsell/u, 'micelle'],
  [/обратн.*холодил|qaytar/u, 'reflux'],
  [/агрегат|состояни|agregat/u, 'states'],
  [/защит|очки|перчат|himoya/u, 'safety'],
  [/смес|aralashma/u, 'mixture'],
  [/кислот|kislota/u, 'acid'],
  [/щёлоч|щелоч|ishqor/u, 'alkali'],
  [/решётк|решетк|panjara/u, 'lattice'],
  [/модел|model/u, 'model'],
]

function subjectWords(subject: string): string[] {
  const low = subject.toLowerCase()
  const words = stems(low)
  for (const [re, en] of TERMS) if (re.test(low)) words.push(en)
  return [...new Set(words)]
}

function presetHaystack(p: ImagePreset): string {
  return [p.title, p.titles?.ru, p.titles?.uz, p.titles?.en, p.topic, p.id.replace(/-/g, ' ')].filter(Boolean).join(' ').toLowerCase()
}

/** Сколько слов темы нашлось в заголовке / id пресета. */
export function presetScore(p: ImagePreset, subject: string): number {
  const words = subjectWords(subject)
  if (!words.length) return 0
  const hay = presetHaystack(p)
  return words.reduce((n, w) => (hay.includes(w) ? n + 1 : n), 0)
}

/** Ближайшая тема к описанию (ни одного совпадения — null). При равенстве — первая по списку. */
export function nearestPreset(subject: string, presets: readonly ImagePreset[]): ImagePreset | null {
  let best: ImagePreset | null = null
  let bestScore = 0
  for (const p of presets) {
    const sc = presetScore(p, subject)
    if (sc > bestScore) {
      best = p
      bestScore = sc
    }
  }
  return best
}

/** Фильтр списка тем по строке поиска (все основы должны найтись). */
export function filterPresets(presets: readonly ImagePreset[], query: string): ImagePreset[] {
  const q = subjectWords(query)
  if (!q.length) return [...presets]
  return presets.filter((p) => {
    const hay = presetHaystack(p)
    return q.some((w) => hay.includes(w))
  })
}

/* ------------------------------------------------------------------ формула и вопрос учителю */

/** Подпись-формула ученика: только символы формул и уравнений (буквы латиницы, цифры, индексы, стрелки), ≤ 80. */
export function cleanFormulaInput(s: string): string {
  return s.replace(/[^A-Za-z0-9()[\]{}+\-=<>→←⇄⇌↑↓.,·:*/ ⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻₀₁₂₃₄₅₆₇₈₉]/gu, '').slice(0, 80)
}

const ASK: Record<ImageLang, { base: string; formula: string; desc: string; tail: string }> = {
  ru: {
    base: 'Я нарисовал(а) картинку на тему «{subject}».',
    formula: ' На ней подпись: {formula}.',
    desc: ' Описание: {desc}.',
    tail: ' Объясни по химии, что на ней должно быть изображено и что здесь происходит.',
  },
  uz: {
    base: '«{subject}» mavzusida rasm chizdim.',
    formula: ' Rasmdagi yozuv: {formula}.',
    desc: ' Tavsif: {desc}.',
    tail: ' Kimyo nuqtai nazaridan unda nima tasvirlanishi va nima sodir boʻlishini tushuntiring.',
  },
  en: {
    base: 'I made a picture about “{subject}”.',
    formula: ' Its label: {formula}.',
    desc: ' Description: {desc}.',
    tail: ' Explain the chemistry: what should it show and what is happening here?',
  },
}

/**
 * Вопрос учителю про картинку (обычный чат, текст): тема, подпись-формула и (для своего запроса учителя) описание.
 * Байты картинки не шлём — модель зрения видит фото задач, а не рисунки, и тема уже известна точно.
 */
export function askAboutImageText(lang: ImageLang, a: { subject: string; formula?: string; description?: string }): string {
  const L = ASK[lang] ?? ASK.ru
  const subject = a.subject.trim().slice(0, 140) || '—'
  let out = L.base.replace('{subject}', subject)
  const f = (a.formula ?? '').trim().slice(0, 80)
  if (f) out += L.formula.replace('{formula}', f)
  const d = (a.description ?? '').trim().slice(0, 200)
  if (d && d.toLowerCase() !== subject.toLowerCase()) out += L.desc.replace('{desc}', d)
  return out + L.tail
}

/* ------------------------------------------------------------------ галерея сессии */

export interface DrawGalleryItem {
  id: string
  dataUrl: string
  width: number
  height: number
  /** Тема (заголовок пресета или свой запрос). */
  subject: string
  presetId: string | null
  seed: number
  formula: string
  caption: string
  /** Свой запрос учителя (для «Спросить учителя»), у ученика пусто. */
  description: string
  at: number
}

/** Картинки этой вкладки (в памяти, без хранилища: data:-адреса большие). Новые — первыми. */
export const GALLERY_MAX = 12
let gallery: readonly DrawGalleryItem[] = []
const galleryListeners = new Set<() => void>()

export function galleryItems(): readonly DrawGalleryItem[] {
  return gallery
}

export function addToGallery(item: DrawGalleryItem): void {
  gallery = [item, ...gallery.filter((x) => x.id !== item.id)].slice(0, GALLERY_MAX)
  galleryListeners.forEach((l) => l())
}

export function clearGallery(): void {
  gallery = []
  galleryListeners.forEach((l) => l())
}

export function subscribeGallery(l: () => void): () => void {
  galleryListeners.add(l)
  return () => {
    galleryListeners.delete(l)
  }
}

/** «через 40 с» / «через 12 мин» / «через 3 ч» — для лимитов ученика (сервер шлёт retryAfterSec). */
export function waitLabel(sec: number, lang: ImageLang): string {
  const s = Math.max(1, Math.ceil(sec))
  const u = lang === 'en' ? { s: 's', m: 'min', h: 'h' } : lang === 'uz' ? { s: 's', m: 'daq', h: 'soat' } : { s: 'с', m: 'мин', h: 'ч' }
  if (s < 90) return `${s} ${u.s}`
  if (s < 90 * 60) return `${Math.ceil(s / 60)} ${u.m}`
  return `${Math.ceil(s / 3600)} ${u.h}`
}

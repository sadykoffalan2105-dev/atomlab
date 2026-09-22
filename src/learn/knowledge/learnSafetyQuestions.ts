/**
 * Приоритетные вопросы БЕЗОПАСНОСТИ.
 *
 * Такие вопросы нельзя отдавать поиску по корпусу учебника: на «Почему нельзя наливать
 * воду в кислоту?» извлечение фраз однажды выдало посторонний фрагмент про метафосфорную
 * кислоту (HPO₃ + H₂O = H₃PO₄) — с видом уверенного ответа и закрывающим «Сможешь теперь
 * сам объяснить…». Для ученика это опаснее честного «не знаю».
 *
 * Поэтому вопрос безопасности жёстко привязан к карточке объяснения (learnExplainerCards):
 * ответ берётся ТОЛЬКО из неё, а если перевода карточки на язык ученика нет — учитель
 * честно говорит, что точного ответа в базе нет. Никакого поиска по корпусу здесь не будет.
 */
import type { StemLang } from '../brain/dualMode/textStems'
import { foldText } from '../brain/dualMode/textStems'
import type { ExplainerCardText } from './learnExplainerCards'

export interface SafetyQuestion {
  id: string
  /** Карточка learnExplainerCards, где лежит верный ответ. */
  cardId: string
  /** Формулировки вопроса на ru/en/uz (по основам, без падежей). */
  match: RegExp
  /**
   * Слоты, которыми накрываются слоты карточки: у карточки «серная кислота» пример и
   * проверочный вопрос про сульфат-ион, а здесь нужен пример и вопрос про само правило.
   * Заодно гарантируют ответ на en/uz, даже если перевода карточки ещё нет.
   */
  slots: Partial<Record<'ru' | 'en' | 'uz', Partial<ExplainerCardText>>>
}

export const SAFETY_QUESTIONS: readonly SafetyQuestion[] = [
  {
    id: 'acid-into-water',
    cardId: 'g9-sulfuric-acid',
    slots: {
      ru: {
        what: 'Кислоту всегда наливают в воду тонкой струйкой, а не наоборот — воду в кислоту лить нельзя.',
        formula: 'Концентрированная H₂SO₄ → тонкой струйкой в воду, помешивая (никогда наоборот)',
        example: 'Так разбавляют концентрированную серную кислоту H₂SO₄ на уроке: в стакан с водой по стенке, помешивая.',
        misconception: 'Правило одно для всех концентрированных кислот, а не только для серной.',
        hint: 'Вспомни правило: «сначала вода, потом кислота» — и почему.',
        check: 'Повтори правило одной фразой: что во что наливают и почему именно так?',
      },
      en: {
        what: 'You always pour the acid into the water in a thin stream — never water into acid.',
        why: 'Mixing acid and water releases a lot of heat. The acid is heavier than water, so a light drop of water stays on top, boils at once and throws burning splashes out of the glass. When acid is added to water, the heat spreads through the whole volume and nothing splashes.',
        formula: 'Concentrated H₂SO₄ → thin stream into water, stirring (never the other way round)',
        example: 'That is how concentrated sulfuric acid H₂SO₄ is diluted in the lab: down the wall of a beaker of water, with stirring.',
        misconception: 'The rule holds for every concentrated acid, not only for sulfuric acid.',
        hint: 'Remember the rule “water first, acid second” — and think why.',
        check: 'Say the rule in one sentence: what do you pour into what, and why?',
      },
      uz: {
        what: 'Kislota doimo suvga ingichka oqim bilan quyiladi — suvni kislotaga quyish mumkin emas.',
        why: 'Kislota suv bilan aralashganda juda koʻp issiqlik ajraladi. Kislota suvdan ogʻir, shuning uchun yengil suv tomchisi yuzada qoladi, darhol qaynaydi va kuydiruvchi purkalishlarni otib yuboradi. Kislota suvga quyilganda issiqlik butun hajm boʻylab tarqaladi.',
        formula: 'Konsentrlangan H₂SO₄ → aralashtirib turib suvga ingichka oqim bilan',
        example: 'Darsda konsentrlangan sulfat kislota H₂SO₄ shunday suyultiriladi: suvli stakan devori boʻylab, aralashtirib.',
        misconception: 'Qoida faqat sulfat kislota uchun emas, barcha konsentrlangan kislotalar uchun.',
        hint: 'Qoidani esla: «avval suv, keyin kislota» — va nega shundayligini oʻyla.',
        check: 'Qoidani bitta gap bilan ayt: nimani nimaga quyamiz va nega?',
      },
    },
    match:
      /(нельзя|не\s*льют|не\s*наливают|не\s*добавляют|почему\s+воду|сначала\s+вода|кислоту\s+в\s+воду|воду\s+в\s+кислоту)[^.?!]{0,40}(кислот|вод)|(кислот|вод)[^.?!]{0,40}(нельзя\s+(наливать|лить|добавлять)|в\s+кислоту\s+воду)|never\s+pour\s+water\s+into\s+acid|pour\s+water\s+into\s+(the\s+)?acid|(water|acid)[^.?!]{0,30}(into|to)\s+(the\s+)?(acid|water)[^.?!]{0,20}(never|not|why)|add\s+acid\s+to\s+water|kislotaga\s+suv|suvni\s+kislotaga|kislotani\s+suvga/iu,
  },
]

/**
 * Опознать вопрос безопасности. Совпадение по развёрнутому тексту (ё→е, ʼ→'),
 * чтобы «кислотУ» и «кислотЕ» ловились одинаково.
 */
export function matchSafetyQuestion(query: string, _lang: StemLang): SafetyQuestion | null {
  const q = foldText(query)
  if (!q) return null
  return SAFETY_QUESTIONS.find((s) => s.match.test(q)) ?? null
}

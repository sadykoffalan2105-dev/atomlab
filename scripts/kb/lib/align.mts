/**
 * Automatic uz → ru and en → ru term dictionary from parallel app texts.
 *
 * Sources (key-aligned ru/en/uz objects): grade outlines (section titles), learn pack, problems,
 * skills, teacher exam, element life, lesson outlines; plus quiz questions/choices/explanations from
 * sectionQuizI18n.json EXCEPT the evaluation holdout (see holdout.mts).
 * Method: Dice coefficient over segment co-occurrence of analyzed terms; short segments only.
 */
import fs from 'node:fs'
import path from 'node:path'
import { analyzeTerms, analyzeTokens, RU_QUERY_STOPWORDS } from '../../../src/learn/kb/analyzer.ts'
import { isEvalHoldout } from './holdout.mts'

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..')

type Triple = { ru: string; en?: string; uz?: string }

function firstObjectExport(mod: Record<string, unknown>): Record<string, string> {
  for (const v of Object.values(mod)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, string>
  }
  return {}
}

async function keyAligned(ruPath: string, enPath: string, uzPath: string): Promise<Triple[]> {
  const ru = firstObjectExport(await import(ruPath))
  const en = firstObjectExport(await import(enPath))
  const uz = firstObjectExport(await import(uzPath))
  const out: Triple[] = []
  for (const [k, v] of Object.entries(ru)) {
    if (typeof v !== 'string') continue
    out.push({ ru: v, en: typeof en[k] === 'string' ? en[k] : undefined, uz: typeof uz[k] === 'string' ? uz[k] : undefined })
  }
  return out
}

export async function parallelSegments(): Promise<Triple[]> {
  const base = '../../../src/i18n/'
  const sets: [string, string, string][] = [
    ['learn/gradesOutlineRu.ts', 'learn/gradesOutlineEn.ts', 'learn/gradesOutlineUz.ts'],
    ['learnPackRu.ts', 'learnPackEn.ts', 'learnPackUz.ts'],
    ['learn/learnProblemsRu.ts', 'learn/learnProblemsEn.ts', 'learn/learnProblemsUz.ts'],
    ['learn/learnSkillsRu.ts', 'learn/learnSkillsEn.ts', 'learn/learnSkillsUz.ts'],
    ['learn/learnTeacherExamRu.ts', 'learn/learnTeacherExamEn.ts', 'learn/learnTeacherExamUz.ts'],
    ['learn/learnElementLifeRu.ts', 'learn/learnElementLifeEn.ts', 'learn/learnElementLifeUz.ts'],
    ['learn/learnOutlineContentRu.ts', 'learn/learnOutlineContentEn.ts', 'learn/learnOutlineContentUz.ts'],
  ]
  const out: Triple[] = []
  for (const [r, e, u] of sets) {
    try {
      out.push(...(await keyAligned(base + r, base + e, base + u)))
    } catch (err) {
      console.warn(`[align] skip ${r}: ${(err as Error).message}`)
    }
  }
  // quiz items outside the evaluation holdout
  const i18n = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/sectionQuizI18n.json'), 'utf8')) as Record<
    string,
    { questionEn?: string; questionUz?: string; choicesEn?: string[]; choicesUz?: string[]; explanationEn?: string; explanationUz?: string }
  >
  for (const g of [7, 8, 9]) {
    const bank = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/g${g}SectionQuizBank.json`), 'utf8')) as {
      sections: Record<string, { id: string; question: string; choices: string[]; explanation?: string }[]>
    }
    for (const qs of Object.values(bank.sections)) {
      for (const q of qs) {
        if (isEvalHoldout(q.id)) continue
        const t = i18n[q.id]
        if (!t) continue
        out.push({ ru: q.question, en: t.questionEn, uz: t.questionUz })
        q.choices.forEach((c, i) => out.push({ ru: c, en: t.choicesEn?.[i], uz: t.choicesUz?.[i] }))
        if (q.explanation) out.push({ ru: q.explanation, en: t.explanationEn, uz: t.explanationUz })
      }
    }
  }
  return out
}

/**
 * Russian words of question / quiz wording. Parallel quiz templates ("Какая формулировка точнее отделяет X
 * от похожих идей?") would otherwise teach the aligner that "o'xshash" means "похож" + "отделя" + "ключев".
 */
const RU_META = new Set(
  analyzeTerms(
    [...RU_QUERY_STOPWORDS].join(' ') +
      ' похожих идей отделяет точнее единственный сказано смежного постороннего неверное верное ключевой повторите ' +
      'формулировка связанный отметьте характерно относится понятию описание обоснование корректно вывод факт',
  ),
)

/**
 * Returns "uz:term" / "en:term" → [[ruTerm, weight], ...].
 * `isRuTerm` restricts targets to terms that exist in the index (build-index passes a df check).
 */
export async function buildAlignment(isRuTerm: (term: string) => boolean = () => true): Promise<Record<string, [string, number][]>> {
  const segs = await parallelSegments()
  const result: Record<string, [string, number][]> = {}
  for (const lang of ['uz', 'en'] as const) {
    const cRu = new Map<string, number>()
    const cX = new Map<string, number>()
    const co = new Map<string, Map<string, number>>()
    let used = 0
    for (const s of segs) {
      const other = s[lang]
      if (!other || s.ru.length > 260 || other.length > 300) continue
      const ru = new Set(
        analyzeTokens(s.ru)
          .filter((t) => t.kind === 'ru' && t.term.length >= 3 && !RU_META.has(t.term) && isRuTerm(t.term))
          .map((t) => t.term),
      )
      const xs = new Set(analyzeTokens(other).filter((t) => t.kind === 'lat').map((t) => t.term))
      if (!ru.size || !xs.size || ru.size > 25) continue
      used += 1
      for (const r of ru) cRu.set(r, (cRu.get(r) ?? 0) + 1)
      for (const x of xs) {
        cX.set(x, (cX.get(x) ?? 0) + 1)
        let m = co.get(x)
        if (!m) co.set(x, (m = new Map()))
        for (const r of ru) m.set(r, (m.get(r) ?? 0) + 1)
      }
    }
    let kept = 0
    for (const [x, m] of co) {
      const nx = cX.get(x) ?? 0
      if (nx < 2 || x.length < 3) continue
      const cands = [...m.entries()]
        .filter(([, c]) => c >= 2)
        .map(([r, c]) => ({ r, c, dice: (2 * c) / (nx + (cRu.get(r) ?? 0)) }))
        .filter((a) => a.dice >= 0.3)
        .sort((a, b) => b.dice - a.dice)
      if (!cands.length) continue
      const best = cands[0].dice
      const picked = cands.filter((a) => a.dice >= best * 0.75).slice(0, 2)
      result[`${lang}:${x}`] = picked.map((a) => [a.r, Number(Math.min(1, 0.4 + a.dice * 0.6).toFixed(2))])
      kept += 1
    }
    console.log(`[align] ${lang}: ${used} segment pairs, ${kept} terms`)
  }
  return result
}

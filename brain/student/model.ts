/**
 * Модель ученика из событий: уровень 1..5 (старт по классу: g7→2, g9→3, g11→4; +0.2 за верные шаги, −0.2 за ошибку),
 * типичные ошибки (счётчики тегов), темп (медиана интервалов: < 20 с — быстрый, > 90 с — медленный, и длина реплик),
 * настроение (запрос web/камера > маркеры текста > последнее событие mood за 10 мин > neutral).
 */
import { parseFormula } from '../../src/chemistry/equationFormula.ts'
import type { Knowledge } from '../kb/shards.ts'
import { findFormulas, findSubstances } from '../pipeline/entities.ts'
import { ub } from '../pipeline/rx.ts'
import type { StudentEvent } from './events.ts'

export type Mood = 'neutral' | 'confused' | 'tired' | 'bored' | 'happy' | 'stressed'
export type Pace = 'slow' | 'normal' | 'fast'

export type StudentSnapshot = {
  level: number
  levelInt: number
  mood: Mood
  pace: Pace
  recentErrors: string[]
  errorCounts: Record<string, number>
  turns: number
  /** тег, который встретился ≥ 2 раз, включая текущую реплику */
  repeatedError: string | null
}

const START_LEVEL: Record<string, number> = { g7: 2, g8: 2.5, g9: 3, g10: 3.5, g11: 4 }

export function textMood(text: string): Mood | null {
  const t = text.toLowerCase()
  if (ub(/(не понимаю|не понял|не поняла|непонятно|запутал|сложно|что\?{2,}|tushunmadim|tushunarsiz|qiyin|i don'?t (get|understand)|confus|lost me)/).test(t)) return 'confused'
  if (ub(/(устал|устала|нет сил|хочу спать|charchadim|uxlagim|tired|exhausted|sleepy)/).test(t)) return 'tired'
  if (ub(/(скучно|надоело|неинтересно|zerikdim|zerikarli|boring|bored)/).test(t)) return 'bored'
  if (ub(/(боюсь|страшно|контрольн\[а-яёa-z]*|экзамен\[а-яёa-z]* завтра|паник|волнуюсь|не успею|qoʻrqaman|qo'rqaman|imtihon ertaga|stress|panic|exam tomorrow|worried)/).test(t)) return 'stressed'
  if ((text.match(/!/g) ?? []).length >= 3 || (text.length >= 12 && text === text.toUpperCase() && /[A-ZА-Я]{6,}/.test(text))) return 'stressed'
  if (ub(/(ура|класс|круто|понятно!|теперь понял|zo'r|ajoyib|tushundim|awesome|got it now|cool)/).test(t)) return 'happy'
  return null
}

/** Типичные ошибки в реплике ученика (регексы + проверка формул по qaBank). */
export function detectErrorTags(text: string, kb: Knowledge): string[] {
  const t = text.toLowerCase().replace(/ё/g, 'е')
  const tags = new Set<string>()
  if (ub(/масс\[а-яёa-z]*[а-яёa-z]*(=|равн\[а-яёa-z]*|получил\[а-яёa-z]*)[а-яёa-z]*[а-яёa-z]+[.,]?[а-яёa-z]*[а-яёa-z]*моль/).test(t) || ub(/(количеств\[а-яёa-z]* веществ\[а-яёa-z]*|[а-яёa-z]n)[а-яёa-z]*(=|равн\[а-яёa-z]*)[а-яёa-z]*[а-яёa-z]+[.,]?[а-яёa-z]*[а-яёa-z]*(г|грамм\[а-яёa-z]*)[а-яёa-z]/).test(t)) tags.add('mass_mole')
  if (ub(/[а-яёa-z]mass[а-яёa-z]*(=|is)[а-яёa-z]*[а-яёa-z]+(\.[а-яёa-z]+)?[а-яёa-z]*mol[а-яёa-z]/).test(t) || ub(/[а-яёa-z]massa[а-яёa-z]*=[а-яёa-z]*[а-яёa-z]+[.,]?[а-яёa-z]*[а-яёa-z]*mol[а-яёa-z]/).test(t)) tags.add('mass_mole')
  if (ub(/атом\[а-яёa-z]*[а-яёa-z]+(воды|кислоты|соли|сахара|углекислого|h2o|co2|nacl)/).test(t) || ub(/молекул\[а-яёa-z]*[а-яёa-z]+(натрия|калия|железа|меди|цинка|алюминия|магния|кальция|nacl|поваренной соли|хлорида натрия)/).test(t)) tags.add('atom_molecule')
  if (ub(/(atom of water|water atom|molecule of (sodium|iron|copper)|suv atomi|natriy molekulasi|temir molekulasi)/).test(t)) tags.add('atom_molecule')
  if (ub(/валентност\[а-яёa-z]*[^.?!]{0,30}[+−-][а-яёa-z]?[а-яёa-z]/).test(t) || ub(/степен\[а-яёa-z]* окислени\[а-яёa-z]*[^.?!]{0,25}[а-яёa-z](i{1,3}|iv|vi{0,3})[а-яёa-z]/).test(t)) tags.add('valence_oxidation')
  if (ub(/valentlik\[а-яёa-z]*[^.?!]{0,30}[+−-][а-яёa-z]?[а-яёa-z]/).test(t) || ub(/valenc[ey][^.?!]{0,30}[+−-][а-яёa-z]?[а-яёa-z]/).test(t)) tags.add('valence_oxidation')
  if (ub(/молярн\[а-яёa-z]* масс\[а-яёa-z]*[^.?!]{0,25}[а-яёa-z]+[.,]?[а-яёa-z]*[а-яёa-z]*(г|грамм\[а-яёa-z]*)(?![а-яёa-z]*\/)[а-яёa-z]/).test(t) || ub(/объ[её]м\[а-яёa-z]*[^.?!]{0,20}[а-яёa-z]+[.,]?[а-яёa-z]*[а-яёa-z]*(г|кг)[а-яёa-z]/).test(t)) tags.add('units')
  if (ub(/molar mass[^.?!]{0,25}[а-яёa-z]+(\.[а-яёa-z]+)?[а-яёa-z]*g[а-яёa-z](?![а-яёa-z]*\/)/).test(t) || ub(/molyar massa[^.?!]{0,25}[а-яёa-z]+[.,]?[а-яёa-z]*[а-яёa-z]*g[а-яёa-z](?![а-яёa-z]*\/)/).test(t)) tags.add('units')
  // номенклатура: название вещества рядом с «чужой» формулой из тех же элементов
  const named = findSubstances(text, kb)
  if (named.length) {
    const formulas = findFormulas(text, false)
    for (const { item } of named) {
      const own = parseFormula(item.fa)
      if (!own) continue
      const ownKey = Object.keys(own.counts).sort().join('')
      for (const f of formulas) {
        const key = Object.keys(f.counts).sort().join('')
        if (key === ownKey && f.ascii !== item.fa && JSON.stringify(f.counts) !== JSON.stringify(own.counts)) tags.add('nomenclature')
      }
    }
  }
  return [...tags]
}

function median(xs: number[]): number {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

export function snapshot(events: readonly StudentEvent[], gradeId: string, reqMood: string | undefined, text: string, currentTags: readonly string[]): StudentSnapshot {
  let level = START_LEVEL[gradeId] ?? 3
  const errorCounts: Record<string, number> = {}
  const recent: string[] = []
  const turnTimes: number[] = []
  const lens: number[] = []
  let lastMood: { mood: Mood; at: number } | null = null
  for (const e of events) {
    if (e.type === 'turn') {
      turnTimes.push(Date.parse(e.at))
      if (e.len) lens.push(e.len)
      if (e.good) level += 0.2 * e.good
    } else if (e.type === 'error_tag' && e.tag) {
      errorCounts[e.tag] = (errorCounts[e.tag] ?? 0) + 1
      recent.push(e.tag)
      level -= 0.2
    } else if (e.type === 'mood' && e.mood) lastMood = { mood: e.mood as Mood, at: Date.parse(e.at) }
    else if (e.type === 'feedback' && typeof e.value === 'number') level += e.value > 0 ? 0.1 : -0.1
    level = Math.min(5, Math.max(1, level))
  }
  for (const tag of currentTags) {
    errorCounts[tag] = (errorCounts[tag] ?? 0) + 1
    recent.push(tag)
  }
  const gaps: number[] = []
  for (let i = 1; i < turnTimes.length; i++) gaps.push((turnTimes[i]! - turnTimes[i - 1]!) / 1000)
  const recentGaps = gaps.slice(-8).filter((g) => g > 0 && g < 3600)
  const med = median(recentGaps)
  const avgLen = lens.length ? lens.slice(-8).reduce((s, x) => s + x, 0) / Math.min(8, lens.length) : text.length
  let pace: Pace = 'normal'
  if (Number.isFinite(med)) pace = med < 20 ? 'fast' : med > 90 ? 'slow' : 'normal'
  if (pace === 'normal' && avgLen > 300) pace = 'slow'
  const moods: Mood[] = ['neutral', 'confused', 'tired', 'bored', 'happy', 'stressed']
  let mood: Mood = 'neutral'
  if (reqMood && moods.includes(reqMood as Mood) && reqMood !== 'neutral') mood = reqMood as Mood
  else mood = textMood(text) ?? (lastMood && Date.now() - lastMood.at < 10 * 60_000 ? lastMood.mood : 'neutral')
  const lastTags = recent.slice(-6)
  const repeatedError = currentTags.find((t) => (errorCounts[t] ?? 0) >= 2) ?? null
  const top = Object.entries(errorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k)
  return {
    level,
    levelInt: Math.min(5, Math.max(1, Math.round(level))),
    mood,
    pace,
    recentErrors: top.length ? top : [...new Set(lastTags)].slice(0, 3),
    errorCounts,
    turns: turnTimes.length,
    repeatedError,
  }
}

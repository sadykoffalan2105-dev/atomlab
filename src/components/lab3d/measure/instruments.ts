/**
 * Измерительные приборы школьной лаборатории: цена деления, предел, погрешность — как у настоящих.
 * Здесь же — «живая» случайность опыта: у каждой попытки свои показания в пределах погрешности
 * (детерминированно от зерна попытки — повтор с тем же зерном даёт те же числа, тесты стабильны).
 */
import type { LabLang, LabText } from '../labContract'
import { quantize } from './quantities'

export type InstrumentId =
  | 'scales'
  | 'cyl10'
  | 'cyl50'
  | 'cyl100'
  | 'cyl250'
  | 'gas250'
  | 'gas500'
  | 'gasometer'
  | 'pipette2'
  | 'burette25'
  | 'thermometer'

export type UnitId = 'g' | 'ml' | 'c'

export interface InstrumentSpec {
  readonly id: InstrumentId
  readonly name: LabText
  readonly unit: UnitId
  /** Цена деления (у весов — дискретность дисплея). */
  readonly division: number
  /** Шаг отсчёта: у весов = дискретности, у шкал — половина деления («на глаз»). */
  readonly readStep: number
  readonly min: number
  readonly max: number
  /** Допускаемая погрешность прибора (±, в единицах прибора). */
  readonly error: number
  /** Как правильно снимать показание. */
  readonly how: LabText
}

const t = (ru: string, en: string, uz: string): LabText => ({ ru, en, uz })

const MENISCUS = t(
  'Глаз — на уровне жидкости, отсчёт — по нижнему краю мениска.',
  'Eye level with the liquid; read at the bottom of the meniscus.',
  'Ko‘z — suyuqlik sathida, hisob — meniskning pastki cheti bo‘yicha.',
)

export const INSTRUMENTS: Readonly<Record<InstrumentId, InstrumentSpec>> = {
  scales: {
    id: 'scales',
    name: t('Электронные весы (0,01 г)', 'Electronic balance (0.01 g)', 'Elektron tarozi (0,01 g)'),
    unit: 'g',
    division: 0.01,
    readStep: 0.01,
    min: 0,
    max: 500,
    error: 0.01,
    how: t(
      'Сосуд — на чашу, «T» (тара) — обнулить; показание снимать, когда загорится значок стабильности.',
      'Vessel on the pan, “T” (tare) to zero; read when the stability mark lights up.',
      'Idishni pallaga qo‘ying, «T» (tara) — nolga; barqarorlik belgisi yonganda o‘qing.',
    ),
  },
  cyl10: {
    id: 'cyl10',
    name: t('Мерный цилиндр 10 мл (дел. 0,2 мл)', 'Measuring cylinder 10 ml (0.2 ml div.)', 'O‘lchov silindri 10 ml (bo‘linma 0,2 ml)'),
    unit: 'ml',
    division: 0.2,
    readStep: 0.1,
    min: 0,
    max: 10,
    error: 0.1,
    how: MENISCUS,
  },
  cyl50: {
    id: 'cyl50',
    name: t('Мерный цилиндр 50 мл (дел. 1 мл)', 'Measuring cylinder 50 ml (1 ml div.)', 'O‘lchov silindri 50 ml (bo‘linma 1 ml)'),
    unit: 'ml',
    division: 1,
    readStep: 0.5,
    min: 0,
    max: 50,
    error: 0.5,
    how: MENISCUS,
  },
  cyl100: {
    id: 'cyl100',
    name: t('Мерный цилиндр 100 мл (дел. 1 мл)', 'Measuring cylinder 100 ml (1 ml div.)', 'O‘lchov silindri 100 ml (bo‘linma 1 ml)'),
    unit: 'ml',
    division: 1,
    readStep: 0.5,
    min: 0,
    max: 100,
    error: 0.5,
    how: MENISCUS,
  },
  cyl250: {
    id: 'cyl250',
    name: t('Мерный цилиндр 250 мл (дел. 2 мл)', 'Measuring cylinder 250 ml (2 ml div.)', 'O‘lchov silindri 250 ml (bo‘linma 2 ml)'),
    unit: 'ml',
    division: 2,
    readStep: 1,
    min: 0,
    max: 250,
    error: 1,
    how: MENISCUS,
  },
  gas250: {
    id: 'gas250',
    name: t('Цилиндр 250 мл над водой (дел. 2 мл)', '250 ml cylinder over water (2 ml div.)', 'Suv ustidagi 250 ml silindr (bo‘linma 2 ml)'),
    unit: 'ml',
    division: 2,
    readStep: 1,
    min: 0,
    max: 250,
    error: 2,
    how: t(
      'Уровни воды в цилиндре и в ванне выровнять (давление газа = атмосферному), отсчёт — по мениску.',
      'Level the water inside the cylinder with the trough (gas pressure = atmospheric), then read the meniscus.',
      'Silindr va vannadagi suv sathini tenglang (gaz bosimi = atmosfera bosimi), so‘ng menisk bo‘yicha o‘qing.',
    ),
  },
  gas500: {
    id: 'gas500',
    name: t('Цилиндр 500 мл над водой (дел. 5 мл)', '500 ml cylinder over water (5 ml div.)', 'Suv ustidagi 500 ml silindr (bo‘linma 5 ml)'),
    unit: 'ml',
    division: 5,
    readStep: 2.5,
    min: 0,
    max: 500,
    error: 2.5,
    how: t(
      'Уровни воды в цилиндре и в ванне выровнять (давление газа = атмосферному), отсчёт — по мениску.',
      'Level the water inside the cylinder with the trough (gas pressure = atmospheric), then read the meniscus.',
      'Silindr va vannadagi suv sathini tenglang (gaz bosimi = atmosfera bosimi), so‘ng menisk bo‘yicha o‘qing.',
    ),
  },
  gasometer: {
    id: 'gasometer',
    name: t('Газометр 1 л (дел. 10 мл)', 'Gas holder 1 l (10 ml div.)', 'Gazometr 1 l (bo‘linma 10 ml)'),
    unit: 'ml',
    division: 10,
    readStep: 5,
    min: 0,
    max: 1000,
    error: 5,
    how: t(
      'Объём газа — по шкале газометра до и после опыта; разность — сколько газа прошло.',
      'Read the gas holder scale before and after; the difference is the gas that passed.',
      'Gaz hajmi — gazometr shkalasi bo‘yicha tajribadan oldin va keyin; farqi — o‘tgan gaz.',
    ),
  },
  pipette2: {
    id: 'pipette2',
    name: t('Градуированная пипетка 2 мл (дел. 0,02 мл)', 'Graduated pipette 2 ml (0.02 ml div.)', 'Darajali pipetka 2 ml (bo‘linma 0,02 ml)'),
    unit: 'ml',
    division: 0.02,
    readStep: 0.01,
    min: 0,
    max: 2,
    error: 0.01,
    how: t(
      'Набрать грушей выше нуля, спустить до «0», затем по каплям; отсчёт — по мениску.',
      'Fill with the bulb above zero, let down to “0”, then add dropwise; read the meniscus.',
      'Nok bilan noldan yuqori torting, «0» gacha tushiring, so‘ng tomchilab; menisk bo‘yicha o‘qing.',
    ),
  },
  burette25: {
    id: 'burette25',
    name: t('Бюретка 25 мл (дел. 0,1 мл)', 'Burette 25 ml (0.1 ml div.)', 'Byuretka 25 ml (bo‘linma 0,1 ml)'),
    unit: 'ml',
    division: 0.1,
    readStep: 0.05,
    min: 0,
    max: 25,
    error: 0.05,
    how: t(
      'Заполнить выше нуля, спустить до «0»; объём — разность отсчётов до и после, по нижнему краю мениска.',
      'Fill above zero, run down to “0”; the volume is the difference of the readings, at the bottom of the meniscus.',
      'Noldan yuqori to‘ldiring, «0» gacha tushiring; hajm — oldingi va keyingi o‘qishlar farqi, meniskning pastki cheti bo‘yicha.',
    ),
  },
  thermometer: {
    id: 'thermometer',
    name: t('Спиртовой термометр −10…+110 °C (дел. 1 °C)', 'Spirit thermometer −10…+110 °C (1 °C div.)', 'Spirtli termometr −10…+110 °C (bo‘linma 1 °C)'),
    unit: 'c',
    division: 1,
    readStep: 0.5,
    min: -10,
    max: 110,
    error: 0.5,
    how: t(
      'Шарик — в жидкости, не касаясь дна; ждать, пока столбик перестанет двигаться.',
      'Bulb in the liquid, not touching the bottom; wait until the column stops moving.',
      'Sharcha suyuqlikda, tubiga tegmasin; ustuncha to‘xtaguncha kuting.',
    ),
  },
}

export const UNITS: Readonly<Record<UnitId, LabText>> = {
  g: t('г', 'g', 'g'),
  ml: t('мл', 'ml', 'ml'),
  c: t('°C', '°C', '°C'),
}

/** Число по-школьному: в русском и узбекском — запятая, в английском — точка; минус — типографский. */
export function fmtNum(x: number, decimals: number, lang: LabLang): string {
  const s = (Math.round(x * 10 ** decimals) / 10 ** decimals).toFixed(decimals)
  const v = lang === 'en' ? s : s.replace('.', ',')
  return v.replace(/^-/, '−')
}

/** Сколько знаков после запятой показывать для шага step (0,01 → 2; 0,5 → 1; 2 → 0). */
export function decimalsFor(step: number): number {
  if (step >= 1) return 0
  return Math.max(0, Math.ceil(-Math.log10(step) - 1e-9))
}

/** Показание прибора с единицей: «26,03 г», «147 мл», «22 °C». */
export function fmtReading(id: InstrumentId, value: number, lang: LabLang): string {
  const s = INSTRUMENTS[id]
  return `${fmtNum(value, decimalsFor(s.readStep), lang)} ${UNITS[s.unit][lang]}`
}

/* ── Случайность попытки ── */

/** Генератор mulberry32: детерминированный, без зависимостей. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let r = Math.imul(a ^ (a >>> 15), 1 | a)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export interface TaskRng {
  /** Равномерно в [0, 1). */
  next(): number
  /** Равномерно в [a, b]. */
  between(a: number, b: number): number
  /**
   * Навеска, которую ученик набирает шпателем до target: обычно чуть больше (останавливаются, когда перешли
   * отметку), иногда на сотую меньше. spread — разброс вверх (г).
   */
  weigh(target: number, spread?: number): number
  /** Показание прибора для истинного значения: погрешность прибора + округление к шагу отсчёта. */
  read(id: InstrumentId, trueValue: number): number
}

export function createTaskRng(seed: number): TaskRng {
  const next = mulberry32(seed)
  const between = (a: number, b: number) => a + (b - a) * next()
  return {
    next,
    between,
    weigh(target, spread = 0.04) {
      return quantize(target + between(-0.01, spread), 0.01)
    },
    read(id, trueValue) {
      const s = INSTRUMENTS[id]
      // ошибка отсчёта не больше половины допуска: глаз ошибается на полделения, весы — на последнюю цифру
      const v = trueValue + between(-s.error, s.error) * 0.6
      return quantize(Math.min(s.max, Math.max(s.min, v)), s.readStep)
    },
  }
}

/** Новое зерно попытки (в браузере — от времени; в тестах передают своё). */
export function newSeed(): number {
  const n = typeof performance !== 'undefined' ? performance.now() : 0
  return (Date.now() ^ Math.floor(n * 1000)) >>> 0
}

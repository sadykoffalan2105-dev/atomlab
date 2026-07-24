/**
 * Школьное/промышленное получение веществ: этапы, T, p, катализатор, оборудование.
 * Покрывает все записи каталога через curated overrides + шаблоны по классу соединения.
 */
import { buildDefaultLaboratoryRecipeRu } from './laboratoryRecipeText'
import { normalizeSynthConditions } from './synthesisConditionsDefaults'
import { fromElementsPolicy } from './substanceSynthesisRoute'
import type {
  CompoundCategory,
  ObtainingStepRu,
  RawCompoundDef,
  SynthesisConditionsTextRu,
  SynthesisLabConditions,
} from '../types/chemistry'

export type ObtainingBundle = {
  steps: ObtainingStepRu[]
  recipeRu: string
  conditions: SynthesisConditionsTextRu
  lab: SynthesisLabConditions
}

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥'] as const

function formatStepsRecipe(steps: ObtainingStepRu[]): string {
  if (steps.length === 1) {
    const s = steps[0]!
    return s.note ? `${s.equation} — ${s.note}` : s.equation
  }
  return steps
    .map((s, i) => {
      const mark = CIRCLED[i] ?? `${s.step}.`
      return s.note ? `${mark} ${s.equation} (${s.note})` : `${mark} ${s.equation}`
    })
    .join('\n')
}

function step(n: number, equation: string, note?: string): ObtainingStepRu {
  return note ? { step: n, equation, note } : { step: n, equation }
}

function pack(
  steps: ObtainingStepRu[],
  conditions: SynthesisConditionsTextRu,
  lab: SynthesisLabConditions = {},
): ObtainingBundle {
  return {
    steps,
    recipeRu: formatStepsRecipe(steps),
    conditions: normalizeSynthConditions(conditions),
    lab,
  }
}

/** Кураторские маршруты для ключевых оксидов, кислот, оснований и особых солей. */
const CURATED: Readonly<Record<string, ObtainingBundle>> = {
  h2o: pack(
    [step(1, '2H₂ + O₂ = 2H₂O', 'горение водорода / гремучий газ')],
    {
      temperature: 'Температура: воспламенение смеси; реакция сильно экзотермична.',
      pressure: 'Давление: атмосферное (осторожно — взрыв смеси!).',
      catalyst: 'Катализатор: не обязателен; инициирование искрой/пламенем.',
      equipment: 'Оборудование: демонстрация только под контролем; защитный экран, вытяжка.',
    },
    { needsHeat: true },
  ),
  co2: pack(
    [
      step(1, 'C + O₂ = CO₂', 'полное горение углерода / угля'),
      step(2, 'CH₄ + 2O₂ → CO₂ + 2H₂O', 'горение метана (природный газ) — попутно даёт воду'),
    ],
    {
      temperature: 'Температура: горение угля / природного газа — сильный нагрев, экзотермично.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
      equipment: 'Оборудование: тигель / горелка; собирают газ над водой или в цилиндр.',
    },
    { needsHeat: true },
  ),
  co: pack(
    [
      step(1, '2C + O₂ = 2CO', 'неполное горение при недостатке O₂'),
      step(2, 'CO₂ + C ⇄ 2CO', 'при высокой T на раскалённом угле'),
    ],
    {
      temperature: 'Температура: >700–1000 °C (генераторный газ).',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
      equipment: 'Оборудование: печь / реторта; ядовитый газ — только вытяжка!',
    },
    { needsHeat: true },
  ),
  so2: pack(
    [step(1, 'S + O₂ = SO₂', 'горение серы синим пламенем')],
    {
      temperature: 'Температура: воспламенение серы / нагрев.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
      equipment: 'Оборудование: ложечка для сжигания, цилиндр; резкий запах — вытяжка.',
    },
    { needsHeat: true },
  ),
  clo2: pack(
    [
      step(1, '2NaClO₂ + Cl₂ → 2NaCl + 2ClO₂', 'окисление хлорита хлором (учебный / промышленный путь)'),
      step(2, 'не Cl₂ + O₂ → ClO₂', 'прямой синтез из элементов в школе не проводят'),
    ],
    {
      temperature: 'Температура: обычно комнатная / слабый нагрев по методике.',
      pressure: 'Давление: атмосферное; газ разбавляют на месте (взрывоопасен в чистом виде).',
      catalyst: 'Катализатор: не нужен.',
      equipment: 'Оборудование: генератор ClO₂ / схема; вытяжка, защитные очки.',
    },
  ),
  so3: pack(
    [
      step(1, 'S + O₂ → SO₂', 'сера горит до диоксида, не до SO₃'),
      step(2, '2SO₂ + O₂ ⇄ 2SO₃', 'контактный процесс: V₂O₅ или Pt, ≈400–450 °C'),
    ],
    {
      temperature: 'Температура: стадия ② ≈400–450 °C (оптимум контактного процесса).',
      pressure: 'Давление: атмосферное или слегка повышенное (промышленность).',
      catalyst: 'Катализатор: V₂O₅ (контактная масса) или Pt; без катализатора крайне медленно.',
      equipment: 'Оборудование: контактный аппарат / учебная демонстрация схемы; вытяжка.',
    },
    { needsHeat: true, needsCatalyst: true },
  ),
  no: pack(
    [step(1, 'N₂ + O₂ ⇄ 2NO', 'сильно эндотермична: >2000 °C или электрический разряд')],
    {
      temperature: 'Температура: >2000 °C или дуга/молния. При комнатной — не идёт.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не требуется; нужна высокая энергия.',
      equipment: 'Оборудование: электрическая дуга (демонстрация) / схема атмосферы.',
    },
    { needsHeat: true },
  ),
  no2: pack(
    [
      step(1, 'N₂ + O₂ ⇄ 2NO', '>2000 °C / разряд'),
      step(2, '2NO + O₂ → 2NO₂', 'быстро на воздухе, бурый газ'),
    ],
    {
      temperature: 'Температура: стадия ① экстремальная; ② — комнатная на воздухе.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен для ②.',
      equipment: 'Оборудование: вытяжка (токсичный NO₂); цилиндр для сбора.',
    },
    { needsHeat: true },
  ),
  n2o: pack(
    [step(1, 'NH₄NO₃ →(t°) N₂O + 2H₂O', 'осторожное разложение нитрата аммония')],
    {
      temperature: 'Температура: контролируемый нагрев (~170–250 °C по методике).',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
      equipment: 'Оборудование: пробирка с газоотводом; риск разложения — только учебная схема!',
    },
    { needsHeat: true },
  ),
  n2o5: pack(
    [step(1, '2HNO₃ + P₂O₅ → N₂O₅ + 2HPO₃', 'обезвоживание конц. азотной кислоты')],
    {
      temperature: 'Температура: охлаждение / умеренный режим по методике (не из N₂+O₂!).',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен; агент — P₂O₅.',
      equipment: 'Оборудование: вытяжка, сухая посуда; N₂O₅ гигроскопичен.',
    },
  ),
  p2o5: pack(
    [step(1, '4P + 5O₂ → 2P₂O₅', 'горение фосфора')],
    {
      temperature: 'Температура: воспламенение фосфора.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
      equipment: 'Оборудование: колпак / цилиндр; белый дым P₂O₅.',
    },
    { needsHeat: true },
  ),
  sio2: pack(
    [step(1, 'Si + O₂ → SiO₂', 'сильный нагрев; в природе — кварц, песок')],
    {
      temperature: 'Температура: сильный нагрев кремния; решётка [SiO₄]ₙ (не молекула O=Si=O).',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
      equipment: 'Оборудование: печь; в школе чаще изучают природный SiO₂.',
    },
    { needsHeat: true },
  ),
  h2so4: pack(
    [
      step(1, 'S + O₂ → SO₂', 'горение серы / обжиг сульфидов'),
      step(2, '2SO₂ + O₂ ⇄ 2SO₃', 'V₂O₅, ≈400–450 °C'),
      step(3, 'SO₃ + H₂O → H₂SO₄', 'в промышленности SO₃ поглощают в H₂SO₄, не в чистой воде'),
    ],
    {
      temperature: 'Температура: ② ≈400–450 °C; ③ — сильный разогрев при гидратации.',
      pressure: 'Давление: атмосферное / слегка повышенное на контакте.',
      catalyst: 'Катализатор: V₂O₅ только на стадии SO₂→SO₃; для ③ не нужен.',
      equipment: 'Оборудование: контактный аппарат, абсорбер; лаборатория — вытяжка, защитная одежда.',
    },
    { needsHeat: true, needsCatalyst: true },
  ),
  h2so3: pack(
    [step(1, 'SO₂ + H₂O ⇄ H₂SO₃', 'растворение сернистого газа')],
    {
      temperature: 'Температура: комнатная; кислота неустойчива.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не нужен.',
      equipment: 'Оборудование: промывная склянка / раствор SO₂; вытяжка.',
    },
  ),
  hno3: pack(
    [
      step(1, '4NH₃ + 5O₂ → 4NO + 6H₂O', 'Оствальд: Pt–Rh, 800–900 °C'),
      step(2, '2NO + O₂ → 2NO₂', 'окисление на воздухе'),
      step(3, '4NO₂ + O₂ + 2H₂O → 4HNO₃', 'абсорбция в воде'),
    ],
    {
      temperature: 'Температура: ① 800–900 °C на сетке Pt–Rh; далее охлаждение.',
      pressure: 'Давление: повышенное на стадии абсорбции NO₂.',
      catalyst: 'Катализатор: Pt–Rh (сетка). Не H₂+N₂+O₂ = HNO₃.',
      equipment: 'Оборудование: контактный аппарат, абсорбционные колонны; в школе — схема процесса.',
    },
    { needsHeat: true, needsCatalyst: true, needsPressure: true },
  ),
  hno2: pack(
    [
      step(1, 'NaNO₂ + HCl → HNO₂ + NaCl', 'вытеснение в холоде'),
      step(2, 'N₂O₃ + H₂O ⇄ 2HNO₂', 'альтернатива через оксид азота(III)'),
    ],
    {
      temperature: 'Температура: холод / лёд (кислота крайне неустойчива).',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не нужен.',
      equipment: 'Оборудование: пробирка в бане со льдом; сразу используют раствор.',
    },
  ),
  h3po4: pack(
    [
      step(1, '4P + 5O₂ → 2P₂O₅', 'горение фосфора'),
      step(2, 'P₂O₅ + 3H₂O → 2H₃PO₄', 'гидратация оксида'),
      step(3, 'Ca₃(PO₄)₂ + 3H₂SO₄ → 2H₃PO₄ + 3CaSO₄↓', 'экстракционный (промышленный) путь'),
    ],
    {
      temperature: 'Температура: ① горение; ② горячая вода / разогрев; ③ промышленный реактор.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
      equipment: 'Оборудование: колпак для горения P; реактор гидратации / схема экстракции.',
    },
    { needsHeat: true },
  ),
  h3po3: pack(
    [
      step(1, 'P₄O₆ + 6H₂O → 4H₃PO₃', 'гидратация оксида фосфора(III)'),
      step(2, 'PCl₃ + 3H₂O → H₃PO₃ + 3HCl', 'гидролиз трихлорида фосфора'),
    ],
    {
      temperature: 'Температура: умеренная; структура продукта HPO(OH)₂ (тетраэдр).',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не нужен.',
      equipment: 'Оборудование: вытяжка (HCl!); не прямой P+H₂+O₂.',
    },
  ),
  h2co3: pack(
    [step(1, 'CO₂ + H₂O ⇄ H₂CO₃', 'растворение углекислого газа')],
    {
      temperature: 'Температура: комнатная; кислота слабая и неустойчивая.',
      pressure: 'Давление: атмосферное (повышенное p(CO₂) сдвигает вправо).',
      catalyst: 'Катализатор: не нужен.',
      equipment: 'Оборудование: промывная склянка / газирование воды.',
    },
  ),
  h2sio3: pack(
    [step(1, 'Na₂SiO₃ + 2HCl → H₂SiO₃↓ + 2NaCl', 'вытеснение из силиката; SiO₂ + H₂O почти не идёт')],
    {
      temperature: 'Температура: комнатная.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не нужен.',
      equipment: 'Оборудование: стакан, HCl; гель кремниевой кислоты («сосульки»).',
    },
  ),
  hclo4: pack(
    [step(1, 'KClO₄ + H₂SO₄ → KHSO₄ + HClO₄', 'вытеснение конц. серной кислотой')],
    {
      temperature: 'Температура: по методике (осторожно — сильный окислитель, Cl +7).',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не нужен. Не Cl₂+H₂+O₂.',
      equipment: 'Оборудование: вытяжка; разбавленные растворы в школе.',
    },
  ),
  hclo3: pack(
    [step(1, 'Ba(ClO₃)₂ + H₂SO₄ → BaSO₄↓ + 2HClO₃', 'обмен с осаждением BaSO₄')],
    {
      temperature: 'Температура: комнатная / слабый нагрев; HClO₃ — хлорноватая (Cl +5).',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не нужен.',
      equipment: 'Оборудование: стакан, фильтр для BaSO₄; вытяжка.',
    },
  ),
  hclo: pack(
    [
      step(1, 'Cl₂ + H₂O ⇄ HClO + HCl', 'хлорная вода'),
      step(2, 'Cl₂O + H₂O ⇄ 2HClO', 'через оксид хлора(I)'),
    ],
    {
      temperature: 'Температура: комнатная; кислота неустойчива.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не нужен.',
      equipment: 'Оборудование: промывная склянка с Cl₂; вытяжка.',
    },
  ),
  hmno4: pack(
    [
      step(1, 'Mn₂O₇ + H₂O → 2HMnO₄', 'охлаждение'),
      step(2, 'Ba(MnO₄)₂ + H₂SO₄ → BaSO₄↓ + 2HMnO₄', 'обмен'),
    ],
    {
      temperature: 'Температура: охлаждение для ①; комнатная для ②.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не нужен. Не H₂+Mn+O₂.',
      equipment: 'Оборудование: вытяжка; Mn₂O₇ опасен — чаще схема / Ba-соль.',
    },
  ),
  h2cro4: pack(
    [
      step(1, 'CrO₃ + H₂O ⇄ H₂CrO₄', 'растворение оксида хрома(VI)'),
      step(2, 'K₂CrO₄ + H₂SO₄ → H₂CrO₄ + K₂SO₄', 'подкисление хромата'),
    ],
    {
      temperature: 'Температура: комнатная.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не нужен.',
      equipment: 'Оборудование: вытяжка (Cr(VI) токсичен!).',
    },
  ),
  hcl: pack(
    [step(1, 'H₂ + Cl₂ = 2HCl', 'на свету / при нагреве')],
    {
      temperature: 'Температура: инициирование светом или нагревом.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен (фотохимически).',
      equipment: 'Оборудование: демонстрация осторожно; собирают газ.',
    },
    { needsHeat: true },
  ),
  nh3: pack(
    [step(1, 'N₂ + 3H₂ ⇄ 2NH₃', 'процесс Габера: Fe-катализатор, давление, нагрев')],
    {
      temperature: 'Температура: ≈400–500 °C (компромисс кинетики и равновесия).',
      pressure: 'Давление: высокое (десятки–сотни атм в промышленности).',
      catalyst: 'Катализатор: железо с промоторами.',
      equipment: 'Оборудование: колонна синтеза; в школе — схема Габера.',
    },
    { needsHeat: true, needsPressure: true, needsCatalyst: true },
  ),
  naoh: pack(
    [
      step(1, '2Na + 2H₂O → 2NaOH + H₂↑', 'реакция натрия с водой'),
      step(2, '2NaCl + 2H₂O →(электр.) 2NaOH + H₂↑ + Cl₂↑', 'электролиз раствора (промышленность)'),
    ],
    {
      temperature: 'Температура: ① комнатная (бурно!); ② электролизёр.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не нужен; ② — электрический ток.',
      equipment: 'Оборудование: ① чашка Петри под контролем; ② схема электролиза.',
    },
  ),
  koh: pack(
    [step(1, '2K + 2H₂O → 2KOH + H₂↑', 'калий с водой ещё энергичнее натрия')],
    {
      temperature: 'Температура: комнатная (очень бурно).',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не нужен.',
      equipment: 'Оборудование: только демонстрация учителем; защитный экран.',
    },
  ),
  ca_oh_2: pack(
    [
      step(1, 'CaO + H₂O → Ca(OH)₂', 'гашение извести'),
      step(2, 'Ca + 2H₂O → Ca(OH)₂ + H₂↑', 'кальций с водой'),
    ],
    {
      temperature: 'Температура: ① сильно экзотермично; ② комнатная.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не нужен.',
      equipment: 'Оборудование: стакан, вода; осторожно с брызгами гашёной извести.',
    },
  ),
  salt_ca_co3: pack(
    [
      step(1, 'CaO + CO₂ → CaCO₃', 'поглощение CO₂ негашёной известью'),
      step(2, 'Ca(OH)₂ + CO₂ → CaCO₃↓ + H₂O', 'известковая вода'),
    ],
    {
      temperature: 'Температура: комнатная.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не нужен.',
      equipment: 'Оборудование: известковая вода, трубка с CO₂.',
    },
  ),
  salt_nh4_cl: pack(
    [step(1, 'NH₃ + HCl → NH₄Cl', 'белый дым хлорида аммония')],
    {
      temperature: 'Температура: комнатная.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не нужен.',
      equipment: 'Оборудование: две палочки с конц. NH₃ и HCl (классика).',
    },
  ),
  salt_nh4_so4: pack(
    [step(1, '2NH₃ + H₂SO₄ → (NH₄)₂SO₄', 'нейтрализация')],
    {
      temperature: 'Температура: комнатная / слабый нагрев.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не нужен.',
      equipment: 'Оборудование: стакан, осторожно с H₂SO₄.',
    },
  ),
  salt_k2cr2o7: pack(
    [
      step(1, '2K₂CrO₄ + H₂SO₄ → K₂Cr₂O₇ + K₂SO₄ + H₂O', 'жёлтый хромат → оранжевый дихромат в кислой среде'),
      step(2, 'K₂Cr₂O₇ + 2KOH ⇄ 2K₂CrO₄ + H₂O', 'обратно в щелочи'),
    ],
    {
      temperature: 'Температура: комнатная; при упаривании — слабый нагрев.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'не нужен; нужна кислая среда (H₂SO₄)',
      equipment: 'пробирки, H₂SO₄; Cr(VI) токсичен — вытяжка, перчатки',
    },
  ),
  salt_na_no2: pack(
    [
      step(1, 'NaNO₃ + Pb →(t°) NaNO₂ + PbO', 'промышленное восстановление нитрата'),
      step(2, 'ион в соли — NO₂⁻ (нитрит), не NO₃⁻', 'нельзя N₂+2Na+2O₂'),
    ],
    {
      temperature: 'Температура: сильный нагрев нитрата со свинцом.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не нужен.',
      equipment: 'Оборудование: тигель; вытяжка (свинец!).',
    },
    { needsHeat: true },
  ),
  salt_na_no3: pack(
    [
      step(1, 'NaOH + HNO₃ → NaNO₃ + H₂O', 'нейтрализация'),
      step(2, 'или Na₂CO₃ + 2HNO₃ → 2NaNO₃ + H₂O + CO₂↑', 'сода + азотная кислота'),
    ],
    {
      temperature: 'Температура: комнатная.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'не нужен',
      equipment: 'стакан, HNO₃; вытяжка',
    },
  ),
  salt_k_mno4: pack(
    [
      step(1, '2MnO₂ + 4KOH + O₂ → 2K₂MnO₄ + 2H₂O', 'манганат калия в щёлочи'),
      step(2, '3K₂MnO₄ + 2CO₂ → 2KMnO₄ + MnO₂ + 2K₂CO₃', 'диспропорционирование → перманганат'),
    ],
    {
      temperature: 'Температура: сильный нагрев на 1-й стадии.',
      pressure: 'Давление: атмосферное / ток воздуха.',
      catalyst: 'не обязателен',
      equipment: 'промышленный контур / демонстрация схемы; вытяжка',
    },
    { needsHeat: true },
  ),
  salt_k_s: pack(
    [
      step(1, '2K + S → K₂S', 'только схема: прямой контакт K с S в школе не проводят (бурно)'),
      step(2, '2KOH + H₂S → K₂S + 2H₂O', 'безопаснее через щёлочь и H₂S (вытяжка)'),
    ],
    {
      temperature: 'на схеме — нагрев; в растворе — комнатная',
      pressure: 'атмосферное',
      catalyst: 'не нужен',
      equipment: 'только схема / видео; вытяжка при H₂S; защитный экран',
    },
    { needsHeat: true },
  ),
  salt_cr_no3: pack(
    [
      step(1, 'Cr(OH)₃ + 3HNO₃ → Cr(NO₃)₃ + 3H₂O', 'свежий гидроксид + азотная кислота'),
      step(2, 'или Cr + разб./конц. HNO₃ (горячая) → нитрат', 'не Cr+N₂+O₂'),
    ],
    {
      temperature: 'Температура: комнатная / нагрев с кислотой.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не нужен.',
      equipment: 'Оборудование: вытяжка (NOₓ).',
    },
  ),
  salt_cr_po4: pack(
    [
      step(1, 'CrCl₃ + Na₃PO₄ → CrPO₄↓ + 3NaCl', 'обменное осаждение'),
      step(2, 'Cr(OH)₃ + H₃PO₄ → CrPO₄↓ + 3H₂O', 'гидроксид + H₃PO₄'),
    ],
    {
      temperature: 'Температура: комнатная.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'не нужен',
      equipment: 'стаканы, фильтр',
    },
  ),
  salt_cr_mno4: pack(
    [
      step(1, 'Cr₂(SO₄)₃ + 3Ba(MnO₄)₂ → 2Cr(MnO₄)₃ + 3BaSO₄↓', 'обмен (теоретический)'),
      step(2, 'MnO₄⁻ окисляет Cr³⁺ — чистый продукт трудно сохранить', 'не Cr+Mn+O₂'),
    ],
    {
      temperature: 'Температура: комнатная / охлаждение.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не нужен.',
      equipment: 'Оборудование: растворы; фильтр BaSO₄.',
    },
  ),
  salt_cr_no2: pack(
    [
      step(1, 'Cr₂(SO₄)₃ + 3Ba(NO₂)₂ → 2Cr(NO₂)₃ + 3BaSO₄↓', 'обмен в подходящей среде'),
      step(2, 'не Cr+N₂+O₂ — образуется Cr₂O₃', 'нитрит Cr(III) неустойчив'),
    ],
    {
      temperature: 'Температура: комнатная.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не нужен.',
      equipment: 'Оборудование: растворы; фильтр.',
    },
  ),
  salt_na_sio3: pack(
    [
      step(1, 'SiO₂ + 2NaOH →(t°) Na₂SiO₃ + H₂O', 'сплавление кремнезёма со щёлочью'),
      step(2, 'SiO₂ + Na₂CO₃ →(t°) Na₂SiO₃ + CO₂', 'сплавление с содой'),
    ],
    {
      temperature: 'Температура: сильный нагрев / сплавление.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не нужен. Не Na+Si+O₂.',
      equipment: 'Оборудование: тигель, горелка.',
    },
    { needsHeat: true },
  ),
  salt_fe3_s: pack(
    [
      step(1, 'Fe + S →(t°) FeS', 'сухой нагрев → сульфид железа(II)'),
      step(2, '2Fe³⁺ + 3S²⁻ → Fe₂S₃↓ (холод)', 'Fe₂S₃ нестабилен: Fe₂S₃ → 2FeS + S'),
    ],
    {
      temperature: 'Температура: для FeS — нагрев; Fe₂S₃ — низкая T.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не нужен. Не 2Fe+3S → Fe₂S₃ при сухом нагреве.',
      equipment: 'Оборудование: тигель / пробирки; вытяжка при H₂S.',
    },
    { needsHeat: true },
  ),
  salt_na_br: pack(
    [
      step(1, 'NaOH + HBr → NaBr + H₂O', 'спокойная нейтрализация'),
      step(2, 'Na₂CO₃ + 2HBr → 2NaBr + H₂O + CO₂↑', 'сода + бромоводородная кислота'),
    ],
    {
      temperature: 'Температура: комнатная (нейтрализация). Прямой Na+Br₂ — опасно!',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не нужен.',
      equipment: 'Оборудование: стакан; вытяжка при работе с Br₂/HBr.',
    },
  ),
  nacl: pack(
    [step(1, '2Na + Cl₂ = 2NaCl', 'горение натрия в хлоре')],
    {
      temperature: 'Температура: воспламенение / нагрев.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
      equipment: 'Оборудование: ложечка, цилиндр с Cl₂; вытяжка.',
    },
    { needsHeat: true },
  ),
  cao: pack(
    [
      step(1, 'CaCO₃ →(900–1000 °C) CaO + CO₂↑', 'обжиг известняка (промышленность)'),
      step(2, '2Ca + O₂ = 2CaO', 'прямой путь при нагреве >300 °C'),
    ],
    {
      temperature: 'Температура: пром. 900–1000 °C; прямой синтез — нагрев металла.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
      equipment: 'Оборудование: печь обжига / схема; ионная решётка CaO.',
    },
    { needsHeat: true },
  ),
  mgo: pack(
    [step(1, '2Mg + O₂ = 2MgO', 'горение магниевой ленты, >600 °C')],
    {
      temperature: 'Температура: воспламенение, яркая вспышка.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
      equipment: 'Оборудование: щипцы, асбестовая сетка; не смотреть прямо на вспышку.',
    },
    { needsHeat: true },
  ),
  fe3o4: pack(
    [step(1, '3Fe + 2O₂ = Fe₃O₄', 'горение железа / окалина')],
    {
      temperature: 'Температура: сильный нагрев / искры >500 °C.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
      equipment: 'Оборудование: горелка, железные опилки; продукт — шпинель.',
    },
    { needsHeat: true },
  ),
  fe2o3: pack(
    [
      step(1, '2Fe(OH)₃ → Fe₂O₃ + 3H₂O', 'прокаливание гидроксида'),
      step(2, 'обжиг / длительное окисление порошка Fe', '>400–500 °C (не искровое горение → Fe₃O₄)'),
    ],
    {
      temperature: 'Температура: прокаливание / обжиг 400–500 °C+.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
      equipment: 'Оборудование: тигель, печь; гематит.',
    },
    { needsHeat: true },
  ),
  feo: pack(
    [step(1, 'Fe₂O₃ + CO →(>570 °C) 2FeO + CO₂', 'восстановление; горение Fe даёт Fe₃O₄')],
    {
      temperature: 'Температура: >570 °C.',
      pressure: 'Давление: атмосферное / восстановительная атмосфера.',
      catalyst: 'Катализатор: не обязателен.',
      equipment: 'Оборудование: печь, ток CO; схема металлургии.',
    },
    { needsHeat: true },
  ),
  cuo: pack(
    [step(1, '2Cu + O₂ = 2CuO', 'нагрев меди >400–500 °C на воздухе')],
    {
      temperature: 'Температура: >400–500 °C (чёрный CuO).',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
      equipment: 'Оборудование: тигель / проволока в пламени.',
    },
    { needsHeat: true },
  ),
  cu2o: pack(
    [
      step(1, '4CuO →(>1020 °C) 2Cu₂O + O₂', 'разложение оксида(II)'),
      step(2, 'восстановление свежего Cu(OH)₂ альдегидом/глюкозой', 'кирпично-красный осадок'),
    ],
    {
      temperature: 'Температура: ① >1020 °C; ② кипячение реакционной смеси.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
      equipment: 'Оборудование: пробирка (проба Троммера) / печь.',
    },
    { needsHeat: true },
  ),
  al2o3: pack(
    [step(1, '4Al + 3O₂ = 2Al₂O₃', 'сильный нагрев; мешает защитная плёнка')],
    {
      temperature: 'Температура: >600–700 °C или снятие плёнки.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
      equipment: 'Оборудование: печь; корундовая решётка.',
    },
    { needsHeat: true },
  ),
  zno: pack(
    [step(1, '2Zn + O₂ → 2ZnO', 'сжигание цинка >500–600 °C')],
    {
      temperature: 'Температура: сильный нагрев, голубовато-белое пламя.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
      equipment: 'Оборудование: ложечка / тигель.',
    },
    { needsHeat: true },
  ),
  bao: pack(
    [
      step(1, '2BaO₂ →(>800 °C) 2BaO + O₂', 'разложение пероксида'),
      step(2, 'BaCO₃ →(t°) BaO + CO₂↑', 'обжиг карбоната'),
    ],
    {
      temperature: 'Температура: >800 °C (пероксид) / высокий нагрев карбоната.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен. Горение Ba часто даёт BaO₂, не сразу BaO.',
      equipment: 'Оборудование: печь; Ba-соединения токсичны.',
    },
    { needsHeat: true },
  ),
  cro3: pack(
    [step(1, 'K₂Cr₂O₇ + H₂SO₄(конц.) →(≈80–90 °C) … → CrO₃', 'лабораторное получение оксида хрома(VI)')],
    {
      temperature: 'Температура: ≈80–90 °C.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не обязателен.',
      equipment: 'Оборудование: вытяжка; Cr(VI) крайне токсичен.',
    },
    { needsHeat: true },
  ),
}

function defaultEquipment(category: CompoundCategory, lab: SynthesisLabConditions): string {
  const parts = ['пробирки / колбы, штатив']
  if (lab.needsHeat) parts.push('горелка или нагреватель')
  if (lab.needsPressure) parts.push('герметичный сосуд / автоклав (схема)')
  if (lab.needsCatalyst) parts.push('лоток для катализатора')
  if (category === 'acid') parts.push('вытяжка при работе с кислотами')
  return `${parts.join('; ')}.`
}

function isAlkaliMetal(metal: string): boolean {
  return metal === 'Li' || metal === 'Na' || metal === 'K' || metal === 'Cs'
}

/** Оксид: Ag₂O (не AgO), щелочные — M₂O. */
function oxideOf(metal: string): string {
  if (isAlkaliMetal(metal)) return `${metal}₂O`
  if (metal === 'Ag') return 'Ag₂O'
  if (metal === 'Al' || metal === 'Cr') return `${metal}₂O₃`
  if (metal === 'Fe') return 'Fe₂O₃'
  return `${metal}O`
}

/** Гидроксид: для Ag — Ag₂O (AgOH неустойчив). */
function hydroxideOf(metal: string): string {
  if (isAlkaliMetal(metal)) return `${metal}OH`
  if (metal === 'Ag') return 'Ag₂O'
  if (metal === 'Al' || metal === 'Cr' || metal === 'Fe') return `${metal}(OH)₃`
  return `${metal}(OH)₂`
}

function condStd(
  temperature: string,
  pressure = 'атмосферное',
  catalyst = 'не нужен',
  equipment = 'пробирки / стаканы; вытяжка при необходимости',
) {
  return { temperature, pressure, catalyst, equipment }
}

function metalFromSaltId(id: string): string | null {
  const m = id.match(/^salt_([a-z0-9]+?)_/)
  if (!m) return null
  const key = m[1]!
  const map: Record<string, string> = {
    na: 'Na',
    k: 'K',
    li: 'Li',
    cs: 'Cs',
    ag: 'Ag',
    mg: 'Mg',
    ca: 'Ca',
    ba: 'Ba',
    sr: 'Sr',
    zn: 'Zn',
    cu: 'Cu',
    fe2: 'Fe',
    fe3: 'Fe',
    al: 'Al',
    pb: 'Pb',
    sn: 'Sn',
    mn: 'Mn',
    ni: 'Ni',
    cobalt: 'Co',
    cr: 'Cr',
    nh4: 'NH₄',
  }
  return map[key] ?? null
}

function synthesizeFromElementsBundle(p: RawCompoundDef): ObtainingBundle {
  const eq = buildDefaultLaboratoryRecipeRu(p)
  const lab: SynthesisLabConditions = { ...(p.synthesisLab ?? {}) }
  // Металлы + O₂ / галогены обычно требуют нагрева
  if (p.category === 'oxide' || p.category === 'salt') {
    if (!('needsHeat' in lab)) lab.needsHeat = true
  }
  const temperature = p.synthesisConditionsRu?.temperature
    ?? (lab.needsHeat
      ? 'нагрев / воспламенение реагентов (по методике опыта)'
      : 'комнатная или слабый нагрев')
  const pressure = p.synthesisConditionsRu?.pressure
    ?? (lab.needsPressure
      ? 'повышенное (по методике)'
      : 'атмосферное (≈1 атм)')
  const catalyst = p.synthesisConditionsRu?.catalyst
    ?? (lab.needsCatalyst
      ? 'требуется — укажите в панели реактора'
      : 'не обязателен для данного примера')
  const equipment = p.synthesisConditionsRu?.equipment
    ?? defaultEquipment(p.category, lab)
  return pack([step(1, eq, 'из простых веществ (учебный одностадийный путь)')], {
    temperature,
    pressure,
    catalyst,
    equipment,
  }, lab)
}

function saltTemplateBundle(p: RawCompoundDef): ObtainingBundle | null {
  const id = p.id
  const metal = metalFromSaltId(id)
  const f = p.formulaUnicode

  // ——— Соли аммония (конкретная кислота, не «NH₃ + кислота») ———
  if (id.startsWith('salt_nh4_')) {
    if (id.includes('cr2o7')) {
      return pack(
        [
          step(1, '2(NH₄)₂CrO₄ + H₂SO₄ → (NH₄)₂Cr₂O₇ + (NH₄)₂SO₄ + H₂O', 'хромат аммония → дихромат в кислой среде'),
          step(2, 'не уравнение с K₂CrO₄ — ионов NH₄⁺ там нет'),
        ],
        condStd('комнатная', 'атмосферное', 'не нужен', 'пробирки, H₂SO₄; Cr(VI) — вытяжка'),
      )
    }
    if (id.includes('_cro4') || id.endsWith('cro4')) {
      return pack(
        [
          step(1, 'CrO₃ + 2NH₃·H₂O → (NH₄)₂CrO₄ + H₂O', 'хромовый ангидрид + гидрат аммиака'),
          step(2, 'или H₂CrO₄ + 2NH₃·H₂O → (NH₄)₂CrO₄ + 2H₂O', 'не щёлочь металла — иначе хромат металла'),
        ],
        condStd('комнатная', 'атмосферное', 'не нужен', 'стакан; Cr(VI) — вытяжка'),
      )
    }
    if (id.includes('_so4')) {
      return pack(
        [step(1, '2NH₃ + H₂SO₄ → (NH₄)₂SO₄', 'нейтрализация')],
        condStd('комнатная'),
      )
    }
    if (id.includes('_so3')) {
      return pack(
        [step(1, '2NH₃ + H₂SO₃ → (NH₄)₂SO₃', 'аммиак + сернистая кислота')],
        condStd('комнатная / охлаждение', 'атмосферное', 'не нужен', 'раствор NH₃, источник SO₂; вытяжка'),
      )
    }
    if (id.includes('_co3') || id.includes('_hco3')) {
      return pack(
        [
          step(1, '2NH₃·H₂O + CO₂ → (NH₄)₂CO₃ + H₂O', 'водный аммиак + CO₂'),
          step(2, 'не MOH + CO₂ — получится карбонат металла, не аммония'),
        ],
        condStd('комнатная', 'атмосферное (ток CO₂)', 'не нужен', 'раствор NH₃, трубка CO₂ (не известковая вода)'),
      )
    }
    if (id.endsWith('_s')) {
      return pack(
        [step(1, '2NH₃ + H₂S → (NH₄)₂S', 'аммиак + сероводород')],
        condStd('комнатная / охлаждение', 'атмосферное', 'не нужен', 'вытяжка (H₂S — яд); соединение неустойчиво'),
      )
    }
    if (id.includes('_sio3')) {
      return pack(
        [
          step(1, 'в школе прямой синтез (NH₄)₂SiO₃ из NH₃ + H₂SiO₃ нереалистичен', 'H₂SiO₃ практически нерастворима'),
          step(2, 'промышленно/лабораторно — обменные схемы с силикатами; карточку дают как формулу соли', 'не сплавление NH₃ с SiO₂'),
        ],
        condStd('по методике обмена', 'атмосферное', 'не нужен', 'схема / справочник; не школьный «горячий» синтез'),
      )
    }
    if (id.includes('_clo4')) {
      return pack(
        [step(1, 'NH₃ + HClO₄ → NH₄ClO₄', 'аммиак + хлорная кислота')],
        condStd('комнатная / охлаждение', 'атмосферное', 'не нужен', 'вытяжка; перхлораты — сильные окислители'),
      )
    }
    if (id.includes('_clo3')) {
      return pack(
        [step(1, 'NH₃ + HClO₃ → NH₄ClO₃', 'аммиак + хлорноватая кислота (осторожно)')],
        condStd('охлаждение', 'атмосферное', 'не нужен', 'вытяжка; хлораты — окислители'),
      )
    }
    if (id.includes('_no3')) {
      return pack(
        [step(1, 'NH₃ + HNO₃ → NH₄NO₃', 'нейтрализация')],
        condStd('комнатная'),
      )
    }
    if (id.includes('_cl') || id.endsWith('_cl')) {
      return pack(
        [step(1, 'NH₃ + HCl → NH₄Cl', 'белый дым хлорида аммония')],
        condStd('комнатная'),
      )
    }
    // fallback NH4
    return pack(
      [step(1, `NH₃ + соответствующая кислота → ${f}`, 'соль аммония из аммиака и кислоты')],
      condStd('комнатная'),
    )
  }

  // ——— Соли серебра (обмен AgNO₃; без AgOH и без «учебного» Cs/Ag+галоген) ———
  if (metal === 'Ag') {
    if (id.includes('cr2o7')) {
      return pack(
        [
          step(1, '2Ag₂CrO₄ + H₂SO₄ → Ag₂Cr₂O₇ + Ag₂SO₄ + H₂O', 'хромат серебра → дихромат в кислой среде'),
        ],
        condStd('комнатная', 'атмосферное', 'не нужен', 'пробирки, H₂SO₄; Cr(VI) — вытяжка'),
      )
    }
    if (id.includes('_cro4') || id.endsWith('cro4')) {
      return pack(
        [step(1, '2AgNO₃ + K₂CrO₄ → Ag₂CrO₄↓ + 2KNO₃', 'обменное осаждение')],
        condStd('комнатная', 'атмосферное', 'не нужен', 'растворы AgNO₃ и хромата; Cr(VI) — вытяжка'),
      )
    }
    if (id.includes('_co3') || id.includes('_hco3')) {
      return pack(
        [
          step(1, '2AgNO₃ + Na₂CO₃ → Ag₂CO₃↓ + 2NaNO₃', 'осаждение из нитрата серебра'),
          step(2, 'не «MOH + CO₂» и не известковая вода — это путь карбоната кальция'),
        ],
        condStd('комнатная', 'атмосферное', 'не нужен', 'растворы AgNO₃ и Na₂CO₃'),
      )
    }
    if (id.includes('_so4')) {
      return pack(
        [
          step(1, 'Ag₂O + H₂SO₄ → Ag₂SO₄ + H₂O', 'оксид серебра(I) + серная кислота'),
          step(2, 'или 2AgNO₃ + H₂SO₄ → Ag₂SO₄ + 2HNO₃', 'Ag с разб. H₂SO₄ водород не вытесняет'),
        ],
        condStd('комнатная / слабый нагрев', 'атмосферное', 'не нужен', 'стакан, H₂SO₄; вытяжка'),
      )
    }
    if (id.includes('_so3')) {
      return pack(
        [
          step(1, '2AgNO₃ + Na₂SO₃ → Ag₂SO₃↓ + 2NaNO₃', 'обмен (AgOH в растворе не существует)'),
        ],
        condStd('комнатная / охлаждение', 'атмосферное', 'не нужен', 'растворы AgNO₃ и сульфита; вытяжка'),
      )
    }
    if (id.includes('_sio3')) {
      return pack(
        [
          step(1, '2AgNO₃ + Na₂SiO₃ → Ag₂SiO₃↓ + 2NaNO₃', 'обмен в растворе'),
          step(2, 'не сплавление SiO₂ с AgOH/Ag₂CO₃', 'AgOH неустойчив; Ag₂CO₃ при 800–1000 °C → Ag + O₂'),
        ],
        condStd('комнатная', 'атмосферное', 'не нужен', 'растворы нитрата серебра и силиката'),
      )
    }
    if (id.includes('_no3')) {
      return pack(
        [
          step(1, 'Ag + 2HNO₃(разб.) → AgNO₃ + NO₂↑ + H₂O', 'растворение серебра в азотной кислоте'),
          step(2, 'или Ag₂O + 2HNO₃ → 2AgNO₃ + H₂O', 'Ag(OH)₂ не существует; AgOH → Ag₂O'),
        ],
        condStd('комнатная / слабый нагрев', 'атмосферное', 'не нужен', 'вытяжка (NOₓ)'),
      )
    }
    if (id.includes('_no2')) {
      return pack(
        [
          step(1, 'AgNO₃ + KNO₂ → AgNO₂↓ + KNO₃', 'обмен в холодном растворе'),
          step(2, 'не AgNO₃ + Pb →(t°) …', 'нагрев AgNO₃ даёт Ag + NO₂ + O₂, не нитрит; HNO₂+щёлочь даёт нитрит щелочного металла'),
        ],
        condStd('холод / комнатная', 'атмосферное', 'не нужен', 'растворы; охлаждение'),
      )
    }
    if (id.includes('_mno4')) {
      return pack(
        [
          step(1, 'AgNO₃ + KMnO₄ → AgMnO₄↓ + KNO₃', 'обмен / кристаллизация перманганата серебра'),
        ],
        condStd('комнатная / охлаждение', 'атмосферное', 'не нужен', 'растворы; защитные очки (окислитель)'),
      )
    }
    if (id.includes('_clo3')) {
      return pack(
        [
          step(1, '3Cl₂ + 6KOH → 5KCl + KClO₃ + 3H₂O', 'сначала хлорат калия'),
          step(2, 'AgNO₃ + KClO₃ → AgClO₃↓ + KNO₃', 'обмен → хлорат серебра (не AgClO₂!)'),
        ],
        condStd('нагрев щёлочи, затем комнатная', 'атмосферное', 'не обязателен', 'вытяжка; хлораты — окислители'),
        { needsHeat: true },
      )
    }
    if (id.includes('_clo4')) {
      return pack(
        [
          step(1, '2KClO₃ →(t° / электролиз) KClO₄ + KCl', 'сначала окисление хлората → перхлорат'),
          step(2, 'AgNO₃ + KClO₄ → AgClO₄ + KNO₃', 'обмен только после получения перхлората'),
        ],
        condStd('нагрев/электр. хлората, затем комнатная', 'атмосферное', 'не обязателен', 'вытяжка; перхлораты — окислители'),
        { needsHeat: true },
      )
    }
    if (id.endsWith('_s')) {
      return pack(
        [
          step(1, '2Ag + S →(t°) Ag₂S', 'нагрев; также образуется при потускнении серебра'),
          step(2, 'или 2AgNO₃ + H₂S → Ag₂S↓ + 2HNO₃', 'чёрный осадок из раствора'),
        ],
        condStd('нагрев / комнатная в растворе', 'атмосферное', 'не нужен', 'тигель или пробирки; вытяжка при H₂S'),
        { needsHeat: true },
      )
    }
    if (/_(cl|br|i|f)$/.test(id)) {
      const saltNa =
        id.includes('_br') ? 'NaBr' : id.includes('_i') ? 'NaI' : id.includes('_f') ? 'NaF' : 'NaCl'
      const note = id.includes('_f')
        ? 'AgF относительно хорошо растворим — классический «белый осадок» с Ag⁺ для F⁻ нетипичен'
        : 'практически нерастворим; школьный путь — осаждение из AgNO₃'
      return pack(
        [
          step(1, `AgNO₃ + ${saltNa} → ${f}↓ + NaNO₃`, note),
          step(2, 'прямой Ag + галоген в школе обычно не проводят', 'демонстрация обмена предпочтительнее'),
        ],
        condStd('комнатная', 'атмосферное', 'не нужен', 'растворы AgNO₃ и галогенида'),
      )
    }
  }

  // ——— Цезий: прямой Cs + X₂ в школе недопустим ———
  if (metal === 'Cs' && /_(cl|br|i|f)$/.test(id)) {
    const hx = id.includes('_br') ? 'HBr' : id.includes('_i') ? 'HI' : id.includes('_f') ? 'HF' : 'HCl'
    return pack(
      [
        step(1, `CsOH + ${hx} → ${f} + H₂O`, 'нейтрализация — школьно допустимый путь'),
        step(2, `2Cs + X₂ → 2CsX`, 'только схема: цезий с галогенами реагирует крайне бурно / взрывоподобно'),
      ],
      condStd('комнатная (нейтрализация)', 'атмосферное', 'не нужен', 'стакан, растворы; прямой синтез с Cs не проводят'),
    )
  }

  if (id.includes('cr2o7') || id.includes('_cro4') || id.endsWith('cro4')) {
    if (id.includes('cr2o7')) {
      const m = metal && metal !== 'NH₄' ? metal : 'K'
      return pack(
        [
          step(1, `2${m}₂CrO₄ + H₂SO₄ → ${m}₂Cr₂O₇ + ${m}₂SO₄ + H₂O`, 'кислая среда: жёлтый → оранжевый'),
          step(2, 'Обратно в щелочи: дихромат ⇄ хромат'),
        ],
        condStd('комнатная', 'атмосферное', 'не нужен', 'пробирки, H₂SO₄; Cr(VI) — вытяжка'),
      )
    }
    const m = metal && metal !== 'NH₄' ? metal : 'K'
    return pack(
      [
        step(1, `CrO₃ + 2${m}OH → ${m}₂CrO₄ + H₂O`, 'хромовый ангидрид / H₂CrO₄ + щёлочь'),
        step(2, `или H₂CrO₄ + 2${m}OH → ${m}₂CrO₄ + 2H₂O`, 'не прямой синтез из элементов'),
      ],
      condStd('комнатная / слабый нагрев', 'атмосферное', 'не нужен', 'стакан; Cr(VI) токсичен — вытяжка'),
    )
  }

  if (id.includes('_co3') || id.includes('_hco3')) {
    if (metal === 'Ca') {
      return pack(
        [step(1, 'Ca(OH)₂ + CO₂ → CaCO₃↓ + H₂O', 'известковая вода + CO₂')],
        condStd('комнатная', 'атмосферное (или ток CO₂)', 'не нужен', 'известковая вода, трубка CO₂'),
      )
    }
    if (metal && isAlkaliMetal(metal)) {
      const salt = id.includes('_hco3') ? `${metal}HCO₃` : `${metal}₂CO₃`
      return pack(
        [
          step(
            1,
            id.includes('_hco3')
              ? `${metal}OH + CO₂ → ${salt}`
              : `2${metal}OH + CO₂ → ${salt} + H₂O`,
            'щёлочь + диоксид углерода',
          ),
        ],
        condStd('комнатная', 'атмосферное (или ток CO₂)', 'не нужен', 'раствор щёлочи, трубка CO₂'),
      )
    }
    return pack(
      [step(1, `растворимая соль металла + карбонат → ${f}↓`, 'обмен; не абстрактное MOH + CO₂')],
      condStd('комнатная', 'атмосферное', 'не нужен', 'растворы солей'),
    )
  }

  // NH4 handled above — keep a guard so old generic never runs
  if (id.startsWith('salt_nh4_')) {
    return pack(
      [step(1, `NH₃ + кислота → ${f}`, 'соль аммония')],
      condStd('комнатная'),
    )
  }

  if (id.includes('_so4') && metal && metal !== 'NH₄') {
    const ox = oxideOf(metal)
    const oh = hydroxideOf(metal)
    const alkali = isAlkaliMetal(metal)
    const steps = [
      step(
        1,
        alkali
          ? `2${oh} + H₂SO₄ → ${f} + 2H₂O`
          : `${ox} / ${oh} + H₂SO₄ → ${f} + H₂O`,
        'нейтрализация / оксид + серная кислота',
      ),
    ]
    if (!alkali) {
      steps.push(
        step(2, `${metal} + H₂SO₄ (разб.) → ${f} + H₂↑`, 'вытеснение водорода активным металлом'),
      )
    } else {
      steps.push(
        step(
          2,
          `в школе не проводят: ${metal} + H₂SO₄ (разб.)`,
          'щелочной металл реагирует с водой в кислоте крайне бурно',
        ),
      )
    }
    return pack(steps, {
      temperature: 'комнатная или слабый нагрев',
      pressure: 'атмосферное',
      catalyst: 'не нужен',
      equipment: 'стакан, H₂SO₄; вытяжка при нагреве',
    })
  }

  if (id.includes('_so3') && metal && metal !== 'NH₄') {
    const oh = hydroxideOf(metal)
    const sulfite =
      isAlkaliMetal(metal) ? `${metal}₂SO₃` : f
    const hydro = isAlkaliMetal(metal) ? `${metal}HSO₃` : `гидросульфит ${metal}`
    return pack(
      [
        step(1, `2${oh} + SO₂ → ${sulfite} + H₂O`, 'щёлочь + диоксид серы'),
        step(2, `${hydro} + ${oh} → ${sulfite} + H₂O`, 'гидросульфит → сульфит при избытке щёлочи'),
      ],
      {
        temperature: 'комнатная / слабый нагрев',
        pressure: 'атмосферное',
        catalyst: 'не нужен',
        equipment: 'раствор щёлочи, источник SO₂; вытяжка (ток газа — в методике, не «давление»)',
      },
    )
  }

  if (id.includes('_no3') && metal && metal !== 'NH₄') {
    const ox = oxideOf(metal)
    const oh = hydroxideOf(metal)
    const viaOh =
      metal === 'Cr'
        ? 'Cr(OH)₃ + 3HNO₃ → Cr(NO₃)₃ + 3H₂O'
        : `${metal} / ${ox} / ${oh} + HNO₃ → ${f}`
    const step2 =
      metal === 'Li'
        ? step(
            2,
            '6Li + N₂ → 2Li₃N',
            'литий реагирует с азотом, но даёт нитрид, не нитрат; нитрат — через HNO₃',
          )
        : step(2, 'не N₂ + металл + O₂', 'азот не даёт нитрат напрямую; обычно образуется оксид металла')
    return pack(
      [step(1, viaOh, 'азотная кислота + металл / оксид / гидроксид'), step2],
      {
        temperature: 'комнатная; с активными металлами — осторожно',
        pressure: 'атмосферное',
        catalyst: 'не нужен',
        equipment: 'вытяжка (оксиды азота — побочные продукты, не «температура»)',
      },
    )
  }

  if (id.includes('_no2') && metal && metal !== 'NH₄') {
    if (metal === 'Cr') {
      return pack(
        [
          step(1, 'Cr₂(SO₄)₃ + 3Ba(NO₂)₂ → 2Cr(NO₂)₃ + 3BaSO₄↓', 'обмен в подходящей среде'),
          step(2, 'чистый нитрит Cr(III) неустойчив; не Cr+N₂+O₂'),
        ],
        {
          temperature: 'комнатная / охлаждение',
          pressure: 'атмосферное',
          catalyst: 'не нужен',
          equipment: 'растворы солей; фильтр осадка BaSO₄',
        },
      )
    }
    const oh = hydroxideOf(metal)
    return pack(
      [
        step(1, `${metal}NO₃ + Pb →(t°) ${metal}NO₂ + PbO`, 'промышленное восстановление нитрата'),
        step(2, `HNO₂ + ${oh} → ${metal}NO₂ + H₂O`, 'охлаждённая азотистая кислота + щёлочь'),
      ],
      {
        temperature: 'нагрев нитрата со свинцом (пром.) / холод для HNO₂',
        pressure: 'атмосферное',
        catalyst: 'не нужен',
        equipment: 'тигель / стакан; вытяжка',
      },
    )
  }

  if (id.includes('_po4') && metal && metal !== 'NH₄') {
    const via =
      metal === 'Cr'
        ? [
            step(1, 'CrCl₃ + Na₃PO₄ → CrPO₄↓ + 3NaCl', 'обменное осаждение'),
            step(2, 'Cr(OH)₃ + H₃PO₄ → CrPO₄↓ + 3H₂O', 'гидроксид + ортофосфорная кислота'),
          ]
        : [
            step(1, `растворимая соль ${metal} + фосфат → ${f}↓`, 'обмен в растворе'),
            step(2, `${hydroxideOf(metal)} + H₃PO₄ → ${f} + H₂O`, 'нейтрализация / растворение гидроксида'),
          ]
    return pack(via, {
      temperature: 'комнатная',
      pressure: 'атмосферное',
      catalyst: 'не нужен',
      equipment: 'стаканы, фильтр осадка',
    })
  }

  if (id.includes('_sio3') && metal && metal !== 'NH₄') {
    return pack(
      [
        step(1, `SiO₂ + 2${hydroxideOf(metal)} →(t°) ${f} + H₂O`, 'сплавление кремнезёма со щёлочью'),
        step(2, `или SiO₂ + ${metal}₂CO₃ →(t°) ${f} + CO₂`, 'сплавление с карбонатом'),
      ],
      {
        temperature: 'сильный нагрев / сплавление',
        pressure: 'атмосферное',
        catalyst: 'не нужен',
        equipment: 'тигель, горелка; защитные очки',
      },
      { needsHeat: true },
    )
  }

  if (id.includes('_mno4') && metal && metal !== 'NH₄') {
    if (metal === 'Cr') {
      return pack(
        [
          step(1, 'Cr₂(SO₄)₃ + 3Ba(MnO₄)₂ → 2Cr(MnO₄)₃ + 3BaSO₄↓', 'обмен (теоретический путь)'),
          step(2, 'MnO₄⁻ — сильный окислитель; чистый продукт трудно сохранить'),
        ],
        {
          temperature: 'комнатная / охлаждение',
          pressure: 'атмосферное',
          catalyst: 'не нужен',
          equipment: 'стаканы, фильтр BaSO₄; защитные очки',
        },
      )
    }
    return pack(
      [
        step(1, `2MnO₂ + 4${metal}OH + O₂ → 2${metal}₂MnO₄ + 2H₂O`, 'манганат в щёлочи'),
        step(
          2,
          `3${metal}₂MnO₄ + 2CO₂ → 2${metal}MnO₄ + MnO₂ + 2${metal}₂CO₃`,
          'диспропорционирование → перманганат',
        ),
      ],
      {
        temperature: 'сильный нагрев на 1-й стадии',
        pressure: 'атмосферное / ток воздуха',
        catalyst: 'не обязателен',
        equipment: 'тигель / демонстрационный контур; вытяжка; защитные очки',
      },
      { needsHeat: true },
    )
  }

  if (id.includes('_clo3') && metal && metal !== 'NH₄') {
    return pack(
      [
        step(
          1,
          `3Cl₂ + 6${metal}OH → 5${metal}Cl + ${metal}ClO₃ + 3H₂O`,
          'диспропорционирование хлора в горячей щёлочи',
        ),
      ],
      {
        temperature: 'нагрев раствора щёлочи',
        pressure: 'атмосферное',
        catalyst: 'не обязателен',
        equipment: 'вытяжка; хлораты — сильные окислители',
      },
      { needsHeat: true },
    )
  }

  if (id.includes('_clo4') && metal && metal !== 'NH₄') {
    return pack(
      [
        step(
          1,
          `3Cl₂ + 6${metal}OH → 5${metal}Cl + ${metal}ClO₃ + 3H₂O`,
          'сначала получают хлорат',
        ),
        step(
          2,
          `2${metal}ClO₃ →(t° / электролиз) ${metal}ClO₄ + ${metal}Cl`,
          'окисление или термическое диспропорционирование хлората → перхлорат',
        ),
      ],
      {
        temperature: 'нагрев хлората / электролиз раствора хлората',
        pressure: 'атмосферное',
        catalyst: 'не обязателен',
        equipment: 'вытяжка; перхлораты — сильные окислители',
      },
      { needsHeat: true },
    )
  }

  if (id === 'salt_fe3_s') {
    return pack(
      [
        step(1, 'Fe + S →(t°) FeS', 'сухой нагрев даёт сульфид железа(II), не Fe₂S₃'),
        step(2, '2Fe³⁺ + 3S²⁻ → Fe₂S₃↓ (холодный раствор)', 'Fe₂S₃ нестабилен; при нагреве → 2FeS + S'),
      ],
      {
        temperature: 'для FeS — нагрев; для Fe₂S₃ — низкая T в растворе',
        pressure: 'атмосферное',
        catalyst: 'не нужен',
        equipment: 'пробирки / тигель; вытяжка при H₂S',
      },
      { needsHeat: true },
    )
  }

  if (id.endsWith('_s') && metal && isAlkaliMetal(metal)) {
    return pack(
      [
        step(
          1,
          `2${metal} + S → ${metal}₂S`,
          'схема; прямой контакт щелочного металла с серой в школе не проводят (бурно / опасно)',
        ),
        step(2, `${metal}OH + H₂S → … → ${metal}₂S`, 'безопаснее — через раствор щёлочи и H₂S (вытяжка)'),
      ],
      {
        temperature: 'на схеме — нагрев; в растворе — комнатная',
        pressure: 'атмосферное',
        catalyst: 'не нужен',
        equipment: 'только схема / видео; вытяжка при H₂S; защитный экран',
      },
      { needsHeat: true },
    )
  }

  if (/_(cl|br|i|f)$/.test(id) || id.includes('_cl') || id.includes('_br')) {
    const halogen = id.includes('_br') ? 'Br₂' : id.includes('_i') ? 'I₂' : id.includes('_f') ? 'F₂' : 'Cl₂'
    if (metal && metal !== 'NH₄' && metal !== 'Ag') {
      const schoolSafe =
        halogen === 'F₂'
          ? 'прямой синтез с F₂ — промышленный / не школьный (токсичность)'
          : halogen === 'Br₂'
            ? `альтернатива спокойнее: ${metal}OH + HBr → соль + H₂O`
            : `часто ${metal} + ${halogen}`
      const eq = buildDefaultLaboratoryRecipeRu(p)
      return pack(
        [
          step(1, eq, schoolSafe),
          ...(halogen === 'Br₂' || halogen === 'Cl₂'
            ? [step(2, `${hydroxideOf(metal)} / ${metal}₂CO₃ + HHal → ${f}`, 'нейтрализация — безопаснее прямого контакта с галогеном')]
            : []),
        ],
        {
          temperature: 'нагрев / воспламенение (по металлу); нейтрализация — комнатная',
          pressure: 'атмосферное',
          catalyst: 'не обязателен',
          equipment: 'ложечка / стакан; вытяжка (галогены)',
        },
        { needsHeat: halogen !== 'F₂' },
      )
    }
  }

  return null
}

function hydroxideBundle(p: RawCompoundDef): ObtainingBundle {
  const f = p.formulaUnicode
  return pack(
    [
      step(1, `основный оксид + H₂O → ${f}`, 'для щёлочноземельных / щелочных'),
      step(2, `соль + щёлочь → ${f}↓`, 'осаждение нерастворимых гидроксидов'),
    ],
    {
      temperature: 'Температура: комнатная (гашение CaO — сильно экзотермично).',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не нужен.',
      equipment: 'Оборудование: стакан, вода / растворы солей и щелочей.',
    },
  )
}

/**
 * Полный бандл получения для любого вещества каталога (413).
 */
export function resolveObtainingBundle(p: RawCompoundDef): ObtainingBundle {
  const curated = CURATED[p.id]
  if (curated) {
    return {
      ...curated,
      conditions: normalizeSynthConditions({ ...curated.conditions, ...p.synthesisConditionsRu }),
      lab: { ...curated.lab, ...p.synthesisLab },
      steps: p.obtainingStepsRu?.length ? [...p.obtainingStepsRu] : curated.steps,
      recipeRu: p.laboratoryRecipeRu?.includes('①') || p.laboratoryRecipeRu?.includes('\n')
        ? p.laboratoryRecipeRu
        : p.obtainingStepsRu?.length
          ? formatStepsRecipe([...p.obtainingStepsRu])
          : curated.recipeRu,
    }
  }

  if (p.obtainingStepsRu && p.obtainingStepsRu.length > 0) {
    const lab = { ...(p.synthesisLab ?? {}) }
    const base = synthesizeFromElementsBundle(p)
    return pack([...p.obtainingStepsRu], { ...base.conditions, ...p.synthesisConditionsRu }, lab)
  }

  if (fromElementsPolicy(p.id) === 'forbidden') {
    if (p.category === 'base' || p.id.includes('_oh_')) return hydroxideBundle(p)
    const salt = saltTemplateBundle(p)
    if (salt) return salt
    // Fallback: текст из substanceSynthesisRoute уже в laboratoryRecipeRu через resolve — здесь этапы из явного recipe
    if (p.laboratoryRecipeRu) {
      const parts = p.laboratoryRecipeRu
        .replace(/^Маршрут:\s*/i, '')
        .split(/\s*;\s*|,\s*затем\s+| затем /i)
        .map((s) => s.trim())
        .filter(Boolean)
      const steps = parts.map((eq, i) => step(i + 1, eq))
      return pack(steps.length ? steps : [step(1, p.laboratoryRecipeRu)], {
        temperature: p.synthesisConditionsRu?.temperature ?? 'Температура: по школьному маршруту (см. этапы).',
        pressure: p.synthesisConditionsRu?.pressure ?? 'Давление: атмосферное, если не указано иное.',
        catalyst: p.synthesisConditionsRu?.catalyst ?? 'Катализатор: см. этапы получения.',
        equipment: p.synthesisConditionsRu?.equipment ?? defaultEquipment(p.category, p.synthesisLab ?? {}),
      }, p.synthesisLab ?? {})
    }
  }

  const salt = saltTemplateBundle(p)
  if (salt && fromElementsPolicy(p.id) === 'forbidden') return salt
  // Щелочные сульфиды / Ag / Cs: даже если «из элементов allowed» — школьно-безопасный шаблон.
  if (salt && (/^salt_(li|na|k|cs)_s$/.test(p.id) || p.id.startsWith('salt_ag_') || p.id.startsWith('salt_cs_'))) {
    return salt
  }

  return synthesizeFromElementsBundle(p)
}

export function listCuratedObtainingIds(): readonly string[] {
  return Object.keys(CURATED)
}

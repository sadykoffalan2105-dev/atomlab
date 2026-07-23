/**
 * Школьное/промышленное получение веществ: этапы, T, p, катализатор, оборудование.
 * Покрывает все записи каталога через curated overrides + шаблоны по классу соединения.
 */
import { buildDefaultLaboratoryRecipeRu } from './laboratoryRecipeText'
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
  return { steps, recipeRu: formatStepsRecipe(steps), conditions, lab }
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
    [step(1, 'C + O₂ = CO₂', 'полное горение углерода / угля')],
    {
      temperature: 'Температура: горение угля / сильный нагрев.',
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
      catalyst: 'Катализатор: не нужен; нужна кислая среда (H₂SO₄). Не 4Cr+4K+7O₂.',
      equipment: 'Оборудование: пробирки, H₂SO₄; Cr(VI) токсичен — вытяжка, перчатки.',
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
      catalyst: 'Катализатор: не нужен. Не N₂+Na+O₂.',
      equipment: 'Оборудование: стакан, HNO₃; вытяжка.',
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
      catalyst: 'Катализатор: не обязателен. Не K+Mn+O₂.',
      equipment: 'Оборудование: промышленный контур / демонстрация схемы.',
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
      catalyst: 'Катализатор: не нужен. Не Cr+P+O₂.',
      equipment: 'Оборудование: стаканы, фильтр.',
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
  const parts = ['Оборудование: учебный реактор / пробирки, штатив']
  if (lab.needsHeat) parts.push('горелка или нагреватель')
  if (lab.needsPressure) parts.push('герметичный сосуд / автоклав (схема)')
  if (lab.needsCatalyst) parts.push('лотok для катализатора')
  if (category === 'acid') parts.push('вытяжка при работе с кислотами')
  return `${parts.join('; ')}.`
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
      ? 'Температура: нагрев / воспламенение реагентов (по методике опыта).'
      : 'Температура: комнатная или слабый нагрев.')
  const pressure = p.synthesisConditionsRu?.pressure
    ?? (lab.needsPressure
      ? 'Давление: повышенное (по методике).'
      : 'Давление: атмосферное (≈1 атм).')
  const catalyst = p.synthesisConditionsRu?.catalyst
    ?? (lab.needsCatalyst
      ? 'Катализатор: требуется — укажите в панели реактора.'
      : 'Катализатор: не обязателен для данного примера.')
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

  if (id.includes('cr2o7') || id.includes('_cro4') || id.endsWith('cro4')) {
    if (id.includes('cr2o7')) {
      const m = metal && metal !== 'NH₄' ? metal : 'K'
      return pack(
        [
          step(1, `2${m}₂CrO₄ + H₂SO₄ → ${m}₂Cr₂O₇ + ${m}₂SO₄ + H₂O`, 'кислая среда: жёлтый → оранжевый'),
          step(2, 'Обратно в щелочи: дихромат ⇄ хромат'),
        ],
        {
          temperature: 'Температура: комнатная.',
          pressure: 'Давление: атмосферное.',
          catalyst: 'Катализатор: не нужен; кислая среда. Не металл+Cr+O₂.',
          equipment: 'Оборудование: пробирки, H₂SO₄; Cr(VI) — вытяжка.',
        },
      )
    }
    return pack(
      [step(1, `через CrO₃ / H₂CrO₄ + щёлочь металла → ${f}`, 'не прямой синтез из элементов')],
      {
        temperature: 'Температура: комнатная / слабый нагрев.',
        pressure: 'Давление: атмосферное.',
        catalyst: 'Катализатор: не нужен; щелочная среда для хромата.',
        equipment: 'Оборудование: стакан; Cr(VI) токсичен — вытяжка.',
      },
    )
  }

  if (id.includes('_co3') || id.includes('_hco3')) {
    return pack(
      [
        step(1, metal === 'Ca' ? 'Ca(OH)₂ + CO₂ → CaCO₃↓ + H₂O' : `MOH/M(OH)ₙ + CO₂ → ${f}`, 'карбонаты не из M+C+O₂ в один шаг'),
      ],
      {
        temperature: 'Температура: комнатная.',
        pressure: 'Давление: атмосферное (или ток CO₂).',
        catalyst: 'Катализатор: не нужен.',
        equipment: 'Оборудование: известковая вода / раствор щёлочи, трубка CO₂.',
      },
    )
  }

  if (id.startsWith('salt_nh4_')) {
    return pack(
      [step(1, `NH₃ + кислота → ${f}`, 'соли аммония из аммиака и кислоты')],
      {
        temperature: 'Температура: комнатная.',
        pressure: 'Давление: атмосферное.',
        catalyst: 'Катализатор: не нужен.',
        equipment: 'Оборудование: стакан / палочки с NH₃ и кислотой.',
      },
    )
  }

  if (id.includes('_so4') && metal && metal !== 'NH₄') {
    return pack(
      [
        step(1, `${metal}O / ${metal}(OH)ₙ + H₂SO₄ → ${f} + H₂O`, 'нейтрализация / оксид + кислота'),
        step(2, `${metal} + H₂SO₄ (разб.) → соль + H₂`, 'для активных металлов — вытеснение водорода'),
      ],
      {
        temperature: 'Температура: комнатная или слабый нагрев.',
        pressure: 'Давление: атмосферное.',
        catalyst: 'Катализатор: не нужен. Не металл+S+O₂.',
        equipment: 'Оборудование: стакан, H₂SO₄; вытяжка при нагреве.',
      },
    )
  }

  if (id.includes('_so3') && metal && metal !== 'NH₄') {
    return pack(
      [
        step(1, `2${metal}OH + SO₂ → ${metal === 'Na' || metal === 'K' || metal === 'Li' ? `${metal}₂SO₃` : f} + H₂O`, 'щёлочь + диоксид серы'),
        step(2, 'или гидросульфит → сульфит при нагреве / избытке щёлочи'),
      ],
      {
        temperature: 'Температура: комнатная / слабый нагрев.',
        pressure: 'Давление: атмосферное (ток SO₂).',
        catalyst: 'Катализатор: не нужен. Не металл+S+O₂.',
        equipment: 'Оборудование: раствор щёлочи, источник SO₂; вытяжка.',
      },
    )
  }

  if (id.includes('_no3') && metal && metal !== 'NH₄') {
    const viaOh =
      metal === 'Cr'
        ? 'Cr(OH)₃ + 3HNO₃ → Cr(NO₃)₃ + 3H₂O'
        : `${metal} / ${metal}O / ${metal}(OH)ₙ + HNO₃ → ${f}`
    return pack(
      [
        step(1, viaOh, 'азотная кислота + металл / оксид / гидроксид'),
        step(2, 'не N₂ + металл + O₂ — азот инертен, образуется оксид металла'),
      ],
      {
        temperature: 'Температура: комнатная; с активными металлами — осторожно (NOₓ!).',
        pressure: 'Давление: атмосферное.',
        catalyst: 'Катализатор: не нужен.',
        equipment: 'Оборудование: вытяжка (оксиды азота).',
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
          temperature: 'Температура: комнатная / охлаждение.',
          pressure: 'Давление: атмосферное.',
          catalyst: 'Катализатор: не нужен.',
          equipment: 'Оборудование: растворы солей; фильтр осадка BaSO₄.',
        },
      )
    }
    return pack(
      [
        step(1, `${metal}NO₃ + Pb →(t°) ${metal}NO₂ + PbO`, 'промышленное восстановление нитрата'),
        step(2, 'или обмен / охлаждённая азотистая кислота + щёлочь'),
      ],
      {
        temperature: 'Температура: нагрев нитрата со свинцом (пром.) / холод для HNO₂.',
        pressure: 'Давление: атмосферное.',
        catalyst: 'Катализатор: не нужен. Ион — NO₂⁻, не NO₃⁻.',
        equipment: 'Оборудование: тигель / стакан; вытяжка.',
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
            step(2, `${metal}(OH)ₙ + H₃PO₄ → ${f} + H₂O`, 'нейтрализация / растворение гидроксида'),
          ]
    return pack(via, {
      temperature: 'Температура: комнатная.',
      pressure: 'Давление: атмосферное.',
      catalyst: 'Катализатор: не нужен. Не металл+P+O₂.',
      equipment: 'Оборудование: стаканы, фильтр осадка.',
    })
  }

  if (id.includes('_sio3') && metal && metal !== 'NH₄') {
    return pack(
      [
        step(1, `SiO₂ + 2${metal}OH →(t°) ${f} + H₂O`, 'сплавление кремнезёма со щёлочью'),
        step(2, `или SiO₂ + ${metal}₂CO₃ →(t°) ${f} + CO₂`, 'сплавление с карбонатом'),
      ],
      {
        temperature: 'Температура: сильный нагрев / сплавление.',
        pressure: 'Давление: атмосферное.',
        catalyst: 'Катализатор: не нужен. Не металл+Si+O₂.',
        equipment: 'Оборудование: тигель, горелка; защитные очки.',
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
          temperature: 'Температура: комнатная / охлаждение.',
          pressure: 'Давление: атмосферное.',
          catalyst: 'Катализатор: не нужен. Не Cr+Mn+O₂.',
          equipment: 'Оборудование: растворы; фильтр BaSO₄.',
        },
      )
    }
    if (metal === 'K') {
      return pack(
        [
          step(1, '2MnO₂ + 4KOH + O₂ → 2K₂MnO₄ + 2H₂O', 'манганат в щёлочи'),
          step(2, '3K₂MnO₄ + 2CO₂ → 2KMnO₄ + MnO₂ + 2K₂CO₃', 'диспропорционирование → перманганат'),
        ],
        {
          temperature: 'Температура: сильный нагрев на 1-й стадии.',
          pressure: 'Давление: атмосферное / ток воздуха.',
          catalyst: 'Катализатор: не обязателен.',
          equipment: 'Оборудование: промышленный / демонстрационный контур; вытяжка.',
        },
        { needsHeat: true },
      )
    }
    return pack(
      [step(1, `обмен растворимого перманганата / через манганат → ${f}`, 'не металл+Mn+O₂')],
      {
        temperature: 'Температура: по выбранному маршруту.',
        pressure: 'Давление: атмосферное.',
        catalyst: 'Катализатор: не нужен.',
        equipment: 'Оборудование: растворы; защитные очки (окислитель).',
      },
    )
  }

  if ((id.includes('_clo3') || id.includes('_clo4')) && metal && metal !== 'NH₄') {
    return pack(
      [
        step(1, '3Cl₂ + 6KOH → 5KCl + KClO₃ + 3H₂O', 'пример: диспропорционирование хлора в щёлочи (для K)'),
        step(2, `далее обмен / кристаллизация → ${f}`, 'хлораты и перхлораты не из Cl₂+металл+O₂'),
      ],
      {
        temperature: 'Температура: нагрев щёлочи / электролиз (перхлораты).',
        pressure: 'Давление: атмосферное.',
        catalyst: 'Катализатор: не обязателен.',
        equipment: 'Оборудование: вытяжка; хлораты — осторожно (окислители).',
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
        temperature: 'Температура: для FeS — нагрев; для Fe₂S₃ — низкая T в растворе.',
        pressure: 'Давление: атмосферное.',
        catalyst: 'Катализатор: не нужен.',
        equipment: 'Оборудование: пробирки / тигель; вытяжка при H₂S.',
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
      return pack(
        [
          step(1, buildDefaultLaboratoryRecipeRu(p), schoolSafe),
          ...(halogen === 'Br₂' || halogen === 'Cl₂'
            ? [step(2, `${metal}OH / ${metal}₂CO₃ + HHal → ${f}`, 'нейтрализация — безопаснее прямого контакта с галогеном')]
            : []),
        ],
        {
          temperature: 'Температура: нагрев / воспламенение (по металлу); нейтрализация — комнатная.',
          pressure: 'Давление: атмосферное.',
          catalyst: 'Катализатор: не обязателен.',
          equipment: 'Оборудование: ложечка / стакан; вытяжка (галогены).',
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
      conditions: { ...curated.conditions, ...p.synthesisConditionsRu },
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

  return synthesizeFromElementsBundle(p)
}

export function listCuratedObtainingIds(): readonly string[] {
  return Object.keys(CURATED)
}

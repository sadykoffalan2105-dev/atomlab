/**
 * Категорийные шаблоны получения веществ каталога.
 * Дополняют CURATED в substanceObtaining.ts — покрывают все 434 соединения
 * школьно-корректными маршрутами (не «из элементов в один шаг», где это неверно).
 */
import type {
  ObtainingStepRu,
  RawCompoundDef,
  SynthesisConditionsTextRu,
  SynthesisLabConditions,
} from '../types/chemistry'
import { buildDefaultLaboratoryRecipeRu } from './laboratoryRecipeText'

type ObtainingBundle = {
  steps: ObtainingStepRu[]
  recipeRu: string
  conditions: SynthesisConditionsTextRu
  lab: SynthesisLabConditions
}

function step(n: number, equation: string, note?: string): ObtainingStepRu {
  return note ? { step: n, equation, note } : { step: n, equation }
}

function cond(
  temperature: string,
  pressure = 'атмосферное',
  catalyst = 'не нужен',
  equipment = 'пробирки / стаканы; вытяжка при необходимости',
) {
  return { temperature, pressure, catalyst, equipment }
}

function pack(
  steps: ObtainingStepRu[],
  conditions: ReturnType<typeof cond>,
  lab: { needsHeat?: boolean; needsPressure?: boolean; needsCatalyst?: boolean } = {},
): ObtainingBundle {
  const recipeRu =
    steps.length === 1
      ? steps[0]!.note
        ? `${steps[0]!.equation} — ${steps[0]!.note}`
        : steps[0]!.equation
      : steps
          .map((s, i) => {
            const mark = ['①', '②', '③', '④', '⑤'][i] ?? `${s.step}.`
            return s.note ? `${mark} ${s.equation} (${s.note})` : `${mark} ${s.equation}`
          })
          .join('\n')
  return { steps, recipeRu, conditions, lab }
}

/** Оксиды без записи в CURATED — школьные маршруты. */
export function oxideTemplateBundle(p: RawCompoundDef): ObtainingBundle | null {
  if (p.category !== 'oxide') return null
  const f = p.formulaUnicode
  const id = p.id

  const byId: Record<string, ObtainingBundle> = {
    co: pack(
      [
        step(1, '2C + O₂ = 2CO', 'неполное горение углерода / угля'),
        step(2, 'CO₂ + C ⇄ 2CO', 'при >700 °C на раскалённом угле'),
      ],
      cond('>700–1000 °C (генераторный газ)', 'атмосферное', 'не нужен', 'печь / реторта; ядовитый газ — вытяжка!'),
      { needsHeat: true },
    ),
    li2o: pack(
      [
        step(1, '4Li + O₂ → 2Li₂O', 'горение лития'),
        step(2, 'Li₂O + H₂O → 2LiOH', 'реакция с водой — сильно щёлочная среда'),
      ],
      cond('воспламенение / нагрев', 'атмосферное', 'не нужен', 'щипцы; защитный экран'),
      { needsHeat: true },
    ),
    na2o: pack(
      [
        step(1, '4Na + O₂ → 2Na₂O', 'горение натрия'),
        step(2, 'Na₂O + H₂O → 2NaOH', 'образование едкой щёлочи'),
      ],
      cond('воспламенение / нагрев', 'атмосферное', 'не нужен', 'ложечка, цилиндр; бурная реакция!'),
      { needsHeat: true },
    ),
    k2o: pack(
      [
        step(1, '4K + O₂ → 2K₂O', 'горение калия'),
        step(2, 'K₂O + H₂O → 2KOH', 'ещё более бурно, чем натрий'),
      ],
      cond('воспламенение / нагрев', 'атмосферное', 'не нужен', 'только демонстрация учителем'),
      { needsHeat: true },
    ),
    sro: pack(
      [
        step(1, '2Sr + O₂ → 2SrO', 'нагрев стронция на воздухе'),
        step(2, 'SrO + H₂O → Sr(OH)₂', 'гашение оксида'),
      ],
      cond('нагрев металла; гашение — комнатная', 'атмосферное', 'не нужен', 'тигель / стакан'),
      { needsHeat: true },
    ),
    ago: pack(
      [
        step(1, '4AgNO₃ + 2NaOH → Ag₂O↓ + 4NaNO₃ + H₂O', 'осаждение из нитрата (AgOH неустойчив)'),
        step(2, '2Ag₂O →(t°) 4Ag + O₂↑', 'разложение при нагревании'),
      ],
      cond('комнатная / нагрев для разложения', 'атмосферное', 'не нужен', 'растворы AgNO₃ и NaOH'),
    ),
    pbo: pack(
      [
        step(1, '2Pb + O₂ → 2PbO', 'нагрев свинца на воздухе'),
        step(2, 'PbCO₃ →(t°) PbO + CO₂↑', 'обжиг белого свинца (промышленность)'),
      ],
      cond('нагрев >500 °C', 'атмосферное', 'не нужен', 'тигель; Pb токсичен — вытяжка'),
      { needsHeat: true },
    ),
    pbo2: pack(
      [
        step(1, 'PbO + HNO₃(конц.) → PbO₂ + …', 'окисление Pb(II) азотной кислотой'),
        step(2, 'электролиз раствора Pb(NO₃)₂', 'промышленный путь к PbO₂'),
      ],
      cond('нагрев с конц. HNO₃ / электролиз', 'атмосферное', 'не нужен', 'вытяжка; Pb токсичен'),
      { needsHeat: true },
    ),
    mno2: pack(
      [
        step(1, 'MnO₂ — природный пиролюзит', 'добывают из руды; в школе — готовый реагент'),
        step(2, 'Mn²⁺ + MnO₄⁻ + H₂O → MnO₂↓ + …', 'восстановление перманганата марганцом(II)'),
      ],
      cond('комнатная (осаждение) / добыча — промышленность', 'атмосферное', 'не нужен', 'пробирки; MnO₂ — катализатор H₂O₂'),
    ),
    cr2o3: pack(
      [
        step(1, '4Cr + 3O₂ → 2Cr₂O₃', 'сильный нагрев хрома'),
        step(2, '2CrO₃ →(t°) Cr₂O₃ + …', 'восстановление Cr(VI) при нагреве'),
      ],
      cond('сильный нагрев', 'атмосферное', 'не нужен', 'печь; зелёный пигмент'),
      { needsHeat: true },
    ),
    sno2: pack(
      [
        step(1, 'Sn + O₂ → SnO₂', 'нагрев олова на воздухе'),
        step(2, 'SnO + ½O₂ → SnO₂', 'дальнейшее окисление оксида(II)'),
      ],
      cond('нагрев >500 °C', 'атмосферное', 'не нужен', 'тигель'),
      { needsHeat: true },
    ),
    h2o2: pack(
      [
        step(1, 'BaO₂ + H₂SO₄ → BaSO₄↓ + H₂O₂', 'вытеснение слабой перекисной кислоты'),
        step(2, '2H₂O →(электролиз) H₂ + O₂; далее синтез H₂O₂', 'промышленный путь — сложнее'),
      ],
      cond('комнатная (лабораторный путь)', 'атмосферное', 'не нужен', 'фильтр BaSO₄; H₂O₂ — окислитель'),
    ),
    li2o2: pack(
      [
        step(1, '2Li + O₂ → Li₂O₂', 'горение лития в избытке O₂'),
        step(2, 'Li₂O₂ + 2H₂O → 2LiOH + H₂O₂', 'реакция с водой'),
      ],
      cond('воспламенение лития', 'атмосферное', 'не нужен', 'щипцы; защитный экран'),
      { needsHeat: true },
    ),
    na2o2: pack(
      [
        step(1, '2Na + O₂ → Na₂O₂', 'горение натрия в избытке кислорода'),
        step(2, '2Na₂O₂ + 2H₂O → 4NaOH + O₂↑', 'реакция с водой — выделение O₂'),
      ],
      cond('воспламенение натрия', 'атмосферное', 'не нужен', 'ложечка; бурная реакция с водой!'),
      { needsHeat: true },
    ),
  }

  if (byId[id]) return byId[id]!

  // Общий шаблон для простых металлических оксидов (MgO, CaO, CuO, ZnO, Al₂O₃, Fe₃O₄…)
  const eq = buildDefaultLaboratoryRecipeRu(p)
  const hasMetal = Object.keys(p.composition).some((s) =>
    ['Li', 'Na', 'K', 'Mg', 'Ca', 'Ba', 'Sr', 'Zn', 'Cu', 'Fe', 'Al', 'Pb', 'Sn', 'Mn', 'Ni', 'Co', 'Cr', 'Ag'].includes(s),
  )
  if (hasMetal) {
    return pack(
      [
        step(1, eq, 'горение / нагрев металла на воздухе'),
        step(2, `не получают из элементов в один шаг без нагрева`, 'при комнатной T многие металлы покрыты плёнкой оксида'),
      ],
      cond('нагрев / воспламенение (по металлу)', 'атмосферное', 'не обязателен', 'тигель / горелка; вытяжка'),
      { needsHeat: true },
    )
  }

  return null
}

/** Кислоты без CURATED. */
export function acidTemplateBundle(p: RawCompoundDef): ObtainingBundle | null {
  if (p.category !== 'acid') return null
  const f = p.formulaUnicode

  const byId: Record<string, ObtainingBundle> = {
    hbr: pack(
      [
        step(1, 'H₂ + Br₂ → 2HBr', 'на свету / при нагреве'),
        step(2, 'NaBr + H₂SO₄(конц.) → HBr + NaHSO₄', 'вытеснение летучей кислоты'),
      ],
      cond('свет / нагрев (для H₂+Br₂); нагрев для вытеснения', 'атмосферное', 'не нужен', 'вытяжка; HBr — едкий газ'),
      { needsHeat: true },
    ),
    hi: pack(
      [
        step(1, 'H₂ + I₂ ⇄ 2HI', 'равновесная реакция, нужен нагрев'),
        step(2, 'NaI + H₃PO₄(конц.) → HI + NaH₂PO₄', 'вытеснение (лучше, чем H₂SO₄ — окисляет I⁻)'),
      ],
      cond('нагрев', 'атмосферное', 'не нужен', 'вытяжка; HI — восстановитель'),
      { needsHeat: true },
    ),
    hf: pack(
      [
        step(1, 'CaF₂ + H₂SO₄(конц.) → CaSO₄ + 2HF', 'реакция в тигле (не стекло!)'),
        step(2, 'не H₂ + F₂', 'фтор слишком активен; прямой синтез опасен'),
      ],
      cond('нагрев в тигле', 'атмосферное', 'не нужен', 'полиэтиленовая посуда; HF растворяет стекло!'),
      { needsHeat: true },
    ),
    h2s: pack(
      [
        step(1, 'FeS + 2HCl → FeCl₂ + H₂S↑', 'классический лабораторный путь'),
        step(2, 'Na₂S + H₂SO₄ → H₂S + Na₂SO₄', 'альтернатива через сульфид натрия'),
      ],
      cond('комнатная', 'атмосферное', 'не нужен', 'колпак Киппа / пробирка; H₂S — яд, вытяжка!'),
    ),
  }

  if (byId[p.id]) return byId[p.id]!

  // Галогеноводородные кислоты — общий шаблон
  if (p.composition.Cl || p.composition.Br || p.composition.I || p.composition.F) {
  }

  return null
}

/** Гидроксиды и основания без CURATED. */
export function baseTemplateBundle(p: RawCompoundDef): ObtainingBundle | null {
  if (p.category !== 'base') return null
  const f = p.formulaUnicode
  const id = p.id

  const byId: Record<string, ObtainingBundle> = {
    lioh: pack(
      [
        step(1, '2Li + 2H₂O → 2LiOH + H₂↑', 'реакция лития с водой'),
        step(2, 'Li₂O + H₂O → 2LiOH', 'гашение оксида'),
      ],
      cond('комнатная (бурно!)', 'атмосферное', 'не нужен', 'чашка Петри; защитный экран'),
    ),
    csoh: pack(
      [
        step(1, '2Cs + 2H₂O → 2CsOH + H₂↑', 'цезий с водой — взрывоподобно'),
        step(2, 'только схема', 'в школе не проводят прямой опыт с Cs'),
      ],
      cond('схема / видео', 'атмосферное', 'не нужен', 'не проводить в классе!'),
    ),
    ba_oh_2: pack(
      [
        step(1, 'BaO + H₂O → Ba(OH)₂', 'гашение оксида бария'),
        step(2, 'BaCl₂ + 2NaOH → Ba(OH)₂ + 2NaCl', 'обмен в растворе'),
      ],
      cond('комнатная / слабый нагрев', 'атмосферное', 'не нужен', 'Ba²⁺ токсичен'),
    ),
    sr_oh_2: pack(
      [
        step(1, 'SrO + H₂O → Sr(OH)₂', 'гашение оксида стронция'),
        step(2, 'SrCl₂ + 2NaOH → Sr(OH)₂ + 2NaCl', 'обмен'),
      ],
      cond('комнатная', 'атмосферное', 'не нужен', 'стакан'),
    ),
    mg_oh_2: pack(
      [
        step(1, 'MgCl₂ + 2NaOH → Mg(OH)₂↓ + 2NaCl', 'осаждение из раствора'),
        step(2, 'MgO + H₂O ⇄ Mg(OH)₂', 'крайне медленно; Mg с водой почти не реагирует'),
      ],
      cond('комнатная', 'атмосферное', 'не нужен', 'пробирки; белый осадок'),
    ),
    cu_oh_2: pack(
      [
        step(1, 'CuSO₄ + 2NaOH → Cu(OH)₂↓ + Na₂SO₄', 'голубой осадок'),
        step(2, 'Cu(OH)₂ →(t°) CuO + H₂O', 'прокаливание → чёрный CuO'),
      ],
      cond('комнатная / нагрев для разложения', 'атмосферное', 'не нужен', 'пробирки'),
      { needsHeat: true },
    ),
    fe_oh_2: pack(
      [
        step(1, 'FeSO₄ + 2NaOH → Fe(OH)₂↓ + Na₂SO₄', 'свежий зелёный осадок'),
        step(2, '4Fe(OH)₂ + O₂ + 2H₂O → 4Fe(OH)₃', 'быстро темнеет на воздухе'),
      ],
      cond('комнатная; без доступа O₂ для сохранения Fe(OH)₂', 'атмосферное', 'не нужен', 'пробирки; вытяжка'),
    ),
    fe_oh_3: pack(
      [
        step(1, 'FeCl₃ + 3NaOH → Fe(OH)₃↓ + 3NaCl', 'бурый желеобразный осадок'),
        step(2, '2Fe(OH)₃ →(t°) Fe₂O₃ + 3H₂O', 'прокаливание → ржавчина'),
      ],
      cond('комнатная / прокаливание', 'атмосферное', 'не нужен', 'пробирки / тигель'),
      { needsHeat: true },
    ),
    al_oh_3: pack(
      [
        step(1, 'AlCl₃ + 3NaOH → Al(OH)₃↓ + 3NaCl', 'белый студенистый осадок'),
        step(2, 'Al(OH)₃ + NaOH → Na[Al(OH)₄]', 'амфотерность — растворяется в избытке щёлочи'),
      ],
      cond('комнатная', 'атмосферное', 'не нужен', 'пробирки'),
    ),
    zn_oh_2: pack(
      [
        step(1, 'ZnSO₄ + 2NaOH → Zn(OH)₂↓ + Na₂SO₄', 'белый осадок'),
        step(2, 'Zn(OH)₂ + 2NaOH → Na₂[Zn(OH)₄]', 'амфотерность — растворяется в избытке NaOH'),
      ],
      cond('комнатная', 'атмосферное', 'не нужен', 'пробирки'),
    ),
    nh3_h2o: pack(
      [
        step(1, 'NH₃ + H₂O ⇄ NH₄⁺ + OH⁻', 'гидратация аммиака — слабое основание'),
        step(2, 'NH₃ растворяют в воде', '«нашатырный спирт» — 25% раствор'),
      ],
      cond('комнатная', 'атмосферное', 'не нужен', 'промывная склянка; вытяжка'),
    ),
  }

  if (byId[id]) return byId[id]!
  return null
}

/** Улучшенный шаблон «из простых веществ» — всегда с условиями и примечанием. */
export function enrichedFromElementsBundle(p: RawCompoundDef): ObtainingBundle {
  const eq = buildDefaultLaboratoryRecipeRu(p)
  const lab: { needsHeat?: boolean; needsPressure?: boolean; needsCatalyst?: boolean } = {
    ...(p.synthesisLab ?? {}),
  }
  if (p.category === 'oxide' || p.category === 'salt') {
    if (!('needsHeat' in lab)) lab.needsHeat = true
  }

  const categoryNote: Record<string, string> = {
    oxide: 'горение / нагрев металла или неметалла на воздухе',
    salt: 'прямое соединение металла с неметаллом (галоген, сера)',
    acid: 'соединение простых веществ',
    base: 'реакция металла с водой или оксида с водой',
    other: 'прямой синтез из простых веществ',
  }

  return pack(
    [step(1, eq, categoryNote[p.category] ?? 'учебный одностадийный путь')],
    {
      temperature: p.synthesisConditionsRu?.temperature
        ?? (lab.needsHeat ? 'нагрев / воспламенение (по методике)' : 'комнатная или слабый нагрев'),
      pressure: p.synthesisConditionsRu?.pressure ?? 'атмосферное (≈1 атм)',
      catalyst: p.synthesisConditionsRu?.catalyst ?? (lab.needsCatalyst ? 'требуется' : 'не обязателен'),
      equipment: p.synthesisConditionsRu?.equipment ?? 'пробирки / стаканы; вытяжка при необходимости',
    },
    lab,
  )
}

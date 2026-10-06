/**
 * «Учитель» для сценария «окислительно-восстановительное разложение» (4MnO₂ → 2Mn₂O₃ + O₂ …): фразы RU / EN / UZ на этапы
 * reagents → heat → break → transfer → release → lattice → final. Числа электронов и заряды — из formationRedoxDecomposition.ts.
 * Никаких «Mn⁰ отдаёт электроны»: электроны отдаёт кислород исходного (O²⁻ / O⁻² → O⁰), принимает катион / центральный атом.
 */
import { redoxDecomposition, type RedoxDecompDef, type Tri } from './formationRedoxDecomposition'

type Lang = 'ru' | 'en' | 'uz'
const LI = { ru: 0, en: 1, uz: 2 } as const
const pick = (t: readonly [string, string, string], l: Lang): string => t[LI[l]]

/** Кто принимает электроны — фраза этапа «Перенос электронов». */
function acceptor(d: RedoxDecompDef): Tri {
  if (d.id === 'tb_mn2o3')
    return ['Каждый Mn⁴⁺ принимает один электрон и становится Mn³⁺.', 'Each Mn⁴⁺ accepts one electron and becomes Mn³⁺.', 'Har bir Mn⁴⁺ bitta elektron qabul qilib, Mn³⁺ ga aylanadi.']
  if (d.id === 'tb_mn3o4')
    return [
      'Один Mn⁴⁺ принимает два электрона (Mn²⁺), два других — по одному (Mn³⁺): Mn₃O₄ = Mn²⁺ + 2Mn³⁺.',
      'One Mn⁴⁺ accepts two electrons (Mn²⁺), the other two accept one each (Mn³⁺): Mn₃O₄ = Mn²⁺ + 2Mn³⁺.',
      'Bitta Mn⁴⁺ ikki elektron qabul qiladi (Mn²⁺), qolgan ikkitasi — bittadan (Mn³⁺): Mn₃O₄ = Mn²⁺ + 2Mn³⁺.',
    ]
  if (d.reagent === 'cube') return ['Каждый Cu²⁺ принимает один электрон и становится Cu⁺.', 'Each Cu²⁺ accepts one electron and becomes Cu⁺.', 'Har bir Cu²⁺ bitta elektron qabul qilib, Cu⁺ ga aylanadi.']
  if (d.reagent === 'permanganate')
    return [
      'Один Mn⁺⁷ принимает 1 электрон (Mn⁺⁶ в K₂MnO₄), другой — 3 электрона (Mn⁺⁴ в MnO₂).',
      'One Mn⁺⁷ accepts 1 electron (Mn⁺⁶ in K₂MnO₄), the other accepts 3 electrons (Mn⁺⁴ in MnO₂).',
      'Bitta Mn⁺⁷ 1 elektron qabul qiladi (K₂MnO₄ da Mn⁺⁶), ikkinchisi — 3 elektron (MnO₂ da Mn⁺⁴).',
    ]
  return ['Каждый N⁺⁵ принимает два электрона и становится N⁺³: NO₃⁻ → NO₂⁻.', 'Each N⁺⁵ accepts two electrons and becomes N⁺³: NO₃⁻ → NO₂⁻.', 'Har bir N⁺⁵ ikki elektron qabul qilib, N⁺³ ga aylanadi: NO₃⁻ → NO₂⁻.']
}

const ACC_SHORT: Record<RedoxDecompDef['reagent'], string> = { rutile: 'Mn⁴⁺', cube: 'Cu²⁺', permanganate: 'Mn⁺⁷', nitrate: 'N⁺⁵' }

export function redoxTeacherLines(id: string, stageKey: string, lang: Lang, ref: readonly [string, string, string]): { main: string; sub: string; ref: string } | null {
  const d = redoxDecomposition(id)
  if (!d) return null
  const l = lang
  const R = d.reagentFormula
  const me = id === 'mno2' ? 'MnO₂' : d.products[0]!.formula
  const oxide = d.oKind === 'ion'
  const O2m = oxide ? 'O²⁻' : 'O⁻²'
  const r = pick(ref, l)
  const balance: Tri = ['Отдано 4e⁻ = принято 4e⁻.', 'Given 4e⁻ = accepted 4e⁻.', 'Berilgan 4e⁻ = qabul qilingan 4e⁻.']
  switch (stageKey) {
    case 'reagents':
    case 'route':
      return {
        main: d.equation,
        sub: pick(
          [
            `Исходное вещество — ${R}: ${d.reagentIons[0]}. ${me} получают не из простых веществ, а разложением ${R} при нагревании.`,
            `The starting substance is ${R}: ${d.reagentIons[1]}. ${me} is made not from simple substances but by decomposing ${R} on heating.`,
            `Boshlangʻich modda — ${R}: ${d.reagentIons[2]}. ${me} oddiy moddalardan emas, ${R} ni qizdirib parchalash orqali olinadi.`,
          ],
          l,
        ),
        ref: r,
      }
    case 'heat':
      return {
        main: `${d.n}${R} —t°→`,
        sub: pick(
          [
            'При нагревании ионы колеблются сильнее; связи части атомов кислорода с соседями слабеют.',
            'On heating the ions vibrate more strongly; the bonds of some oxygen atoms to their neighbours weaken.',
            'Qizdirilganda ionlar kuchliroq tebranadi; ayrim kislorod atomlarining qoʻshnilari bilan bogʻlari zaiflashadi.',
          ],
          l,
        ),
        ref: r,
      }
    case 'break':
      return {
        main: pick(d.breakNote, l),
        sub: pick(
          [
            `Два ${oxide ? 'иона' : 'атома'} кислорода (${O2m}) теряют связи с соседями и выходят к поверхности.`,
            `Two oxygen ${oxide ? 'ions' : 'atoms'} (${O2m}) lose their bonds to the neighbours and move to the surface.`,
            `Ikki kislorod ${oxide ? 'ioni' : 'atomi'} (${O2m}) qoʻshnilari bilan bogʻini yoʻqotib, sirtga chiqadi.`,
          ],
          l,
        ),
        ref: r,
      }
    case 'transfer':
    case 'pairs':
    case 'inner':
      return {
        main: [pick(d.oxidation, l), ...d.reduction.map((x) => pick(x, l))].join(' · '),
        sub: `${pick(
          [
            `Два ${oxide ? 'иона' : 'атома'} ${O2m} отдают по 2 электрона — получается молекула O₂ (O⁰).`,
            `Two ${O2m} ${oxide ? 'ions' : 'atoms'} give away 2 electrons each — an O₂ molecule (O⁰) forms.`,
            `Ikki ${O2m} ${oxide ? 'ioni' : 'atomi'} 2 tadan elektron beradi — O₂ molekulasi (O⁰) hosil boʻladi.`,
          ],
          l,
        )} ${pick(acceptor(d), l)} ${pick(balance, l)}`,
        ref: r,
      }
    case 'release':
      return {
        main: 'O + O → O=O (d = 1,21 Å) ↑'.replace('1,21', l === 'en' ? '1.21' : '1,21'),
        sub: pick(
          [
            'Два атома кислорода соединяются двойной связью O=O — молекула O₂ улетает: это газ, который выделяется при нагревании.',
            'Two oxygen atoms join with a double bond O=O — the O₂ molecule flies off: this is the gas released on heating.',
            'Ikki kislorod atomi O=O qoʻsh bogʻ bilan birikadi — O₂ molekulasi uchib ketadi: bu qizdirilganda ajraladigan gaz.',
          ],
          l,
        ),
        ref: r,
      }
    case 'lattice':
    case 'assemble':
      return {
        main: d.products.map((p) => p.check).join(' · '),
        sub: pick(
          [
            'Оставшиеся ионы перестраиваются в решётку продукта; сумма зарядов каждой формульной единицы равна нулю.',
            'The remaining ions rearrange into the product lattice; the charges of each formula unit add up to zero.',
            'Qolgan ionlar mahsulot panjarasiga qayta joylashadi; har bir formula birligi zaryadlari yigʻindisi nolga teng.',
          ],
          l,
        ),
        ref: r,
      }
    case 'final':
      return {
        main: d.equation,
        sub: pick(
          [
            `Итог: ${me}. Окислитель и восстановитель — в одном веществе: кислород отдал электроны (O → O₂), ${ACC_SHORT[d.reagent]} их принял.`,
            `Result: ${me}. The oxidant and the reductant are in one substance: oxygen gave away electrons (O → O₂), ${ACC_SHORT[d.reagent]} accepted them.`,
            `Natija: ${me}. Oksidlovchi va qaytaruvchi bitta moddada: kislorod elektron berdi (O → O₂), ${ACC_SHORT[d.reagent]} ularni qabul qildi.`,
          ],
          l,
        ),
        ref: r,
      }
    default:
      return null
  }
}

/** Схемы перехода e⁻ для доски (вместо «Mn⁰ − 3e⁻ → Mn³⁺»): полуреакции и баланс. */
export function redoxSchemes(id: string, lang: Lang): string[] | null {
  const d = redoxDecomposition(id)
  if (!d) return null
  return [pick(d.oxidation, lang), ...d.reduction.map((x) => pick(x, lang)), pick(['Баланс: 4e⁻ = 4e⁻', 'Balance: 4e⁻ = 4e⁻', 'Balans: 4e⁻ = 4e⁻'], lang)]
}

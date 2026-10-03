import type { FormationPlan } from '../../../../chemistry/formationPlan'
import type { FormationScript } from '../../../../chemistry/formationScripts'
import type { SchoolHeroModel, V3 } from '../../hero/schoolHeroModel'

/**
 * Сцены пути получения для остальных видов routeKind (заход 2): разложение, обезвоживание, ОВР, кислотный оксид + вода,
 * основание + кислотный оксид, смесь, основный оксид + кислота, кислота из соли (H⁺ к аниону), сближение молекул.
 * Правила — docs/plans/formation200-rules.md (IC п. 1 «что показать особо»), химия — Kimyo 8 § 14–17 и школьная программа:
 * показывается ТОЛЬКО ключевой момент на уровне частиц (перенос e⁻ с подписями степеней окисления, переход протона,
 * разрыв / образование связи), большие уравнения целиком не разыгрываются.
 * Координаты — в плоскости экрана в долях b (длина связи O–H сцены): x вправо, y вверх, z к зрителю.
 * Время — от начала этапа (0 … ROUTE_DUR = 7 с): появление 0,2–0,7; сближение до ~2,4; ключевой момент 2,4–4,6; итог.
 */

export type Tri = [string, string, string]
export type MoreShow =
  | 'decomposition'
  | 'dehydration'
  | 'redox'
  | 'acidOxideWater'
  | 'ohAcidOxide'
  | 'bridgeBreak'
  | 'mixture'
  | 'oxideAcid'
  | 'acidFromSalt'
  | 'molecules'

/** Строитель сцены (общий с route.ts): атомы/палочки/электроны/подписи в координатах экрана (доли b), время — от начала этапа. */
export type SceneKit = {
  b: number
  /** длина связи X–Y сцены в долях b */
  bl: (x: string, y: string) => number
  A: (el: string, keys: [number, number, number, number?][], tIn?: number, tOut?: number, r?: number) => number
  /** палочка: появляется t0 → t1, исчезает tOut (по умолчанию — до конца сцены); t0 < 0 — была с самого начала */
  S: (a: number, b: number, t0?: number, t1?: number, tOut?: number) => void
  /** электрон по ключам (появляется tIn, исчезает tOut) */
  E: (keys: [number, number, number, number?][], tIn: number, tOut: number) => void
  /** подпись частицы */
  L: (text: string, atoms: number[], from: number, to: number) => void
  /** атомы модели карточки (относительно центра, координаты модели) по ключам центра на экране; H — отдельно (inH) */
  model: SchoolHeroModel
  modelAtoms: (centerKeys: [number, number, number][], hIn?: { from: number; to: number; k: number }) => { ids: number[]; h: number[]; heavy: number[] }
  end: number
}

export type MoreResult = { show: MoreShow; title: Tri; text: Tri }

const deg = Math.PI / 180
const SUPD: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '+': '⁺', '-': '⁻' }
/** Степень окисления верхним индексом: Fe, 2 → Fe⁺²; 0 → Fe⁰. */
const ox = (el: string, n: number) => `${el}${n === 0 ? '⁰' : (n > 0 ? '⁺' : '⁻') + String(Math.abs(n)).split('').map((d) => SUPD[d]).join('')}`
const ion = (f: string, q: number) => `${f}${Math.abs(q) === 1 ? '' : SUPD[String(Math.abs(q))]}${q > 0 ? '⁺' : '⁻'}`

/** Направления тетраэдра (одно — вверх) и треугольника в плоскости экрана. */
const TET: V3[] = [
  [0, 1, 0],
  [0.943, -0.333, 0],
  [-0.471, -0.333, 0.816],
  [-0.471, -0.333, -0.816],
]
const triDir = (k: number, rot = 90): [number, number] => [Math.cos((rot + 120 * k) * deg), Math.sin((rot + 120 * k) * deg)]

const TX = {
  decomposition: {
    title: ['Путь: разложение при нагревании', 'Route: decomposition on heating', 'Yoʻl: qizdirilganda parchalanish'] as Tri,
    text: [
      'При нагревании исходная частица распадается: связь рвётся, электронная пара остаётся у одного из атомов, а газ уходит вверх (↑).',
      'On heating the starting particle breaks apart: a bond breaks, its electron pair stays with one atom, and the gas escapes upwards (↑).',
      'Qizdirilganda boshlangʻich zarracha parchalanadi: bogʻ uziladi, elektron jufti atomlardan birida qoladi, gaz esa yuqoriga chiqadi (↑).',
    ] as Tri,
  },
  dehydration: {
    title: ['Путь: отщепление воды', 'Route: water is split off', 'Yoʻl: suv ajralib chiqishi'] as Tri,
    text: [
      'Протон H⁺ одной группы OH переходит к другой группе OH — получается молекула H₂O, она уходит. Оставшийся кислород связывает частицы (O²⁻ или мостик X–O–X).',
      'A proton H⁺ of one OH group moves to another OH group — an H₂O molecule forms and leaves. The remaining oxygen holds the particles together (O²⁻ or an X–O–X bridge).',
      'Bir OH guruhining H⁺ protoni boshqa OH guruhiga oʻtadi — H₂O molekulasi hosil boʻlib, chiqib ketadi. Qolgan kislorod zarrachalarni bogʻlaydi (O²⁻ yoki X–O–X koʻprik).',
    ] as Tri,
  },
  redox: {
    title: ['Путь: переход электронов (ОВР)', 'Route: electron transfer (redox)', 'Yoʻl: elektronlar oʻtishi (OQR)'] as Tri,
    text: [
      'Восстановитель отдаёт электроны, окислитель их принимает — степени окисления меняются (подписи над частицами). Число отданных e⁻ равно числу принятых.',
      'The reducing agent gives electrons, the oxidising agent takes them — the oxidation states change (labels above the particles). Electrons given = electrons taken.',
      'Qaytaruvchi elektron beradi, oksidlovchi ularni qabul qiladi — oksidlanish darajalari oʻzgaradi (zarrachalar ustidagi yozuvlar). Berilgan e⁻ soni qabul qilinganiga teng.',
    ] as Tri,
  },
  acidOxideWater: {
    title: ['Путь: кислотный оксид + вода', 'Route: acidic oxide + water', 'Yoʻl: kislotali oksid + suv'] as Tri,
    text: [
      'Неподелённая пара кислорода воды становится общей с атомом неметалла оксида, а один H воды переходит на кислород оксида — получается молекула кислоты с группами O–H.',
      'A lone pair of the water oxygen becomes shared with the non-metal atom of the oxide, and one H of the water moves to an oxide oxygen — an acid molecule with O–H groups forms.',
      'Suv kislorodining boʻlinmagan jufti oksiddagi nometall atomi bilan umumiy boʻladi, suvning bitta H i oksid kislorodiga oʻtadi — O–H guruhli kislota molekulasi hosil boʻladi.',
    ] as Tri,
  },
  ohAcidOxide: {
    title: ['Путь: щёлочь + кислотный оксид', 'Route: alkali + acidic oxide', 'Yoʻl: ishqor + kislotali oksid'] as Tri,
    text: [
      'Пара электронов кислорода OH⁻ становится общей с атомом неметалла (C, S, Zn …) — получается кислый ион; второй OH⁻ забирает у него H⁺, уходит H₂O, остаётся кислотный остаток соли.',
      'An electron pair of the OH⁻ oxygen becomes shared with the non-metal atom (C, S, Zn …) — an acid ion forms; a second OH⁻ takes its H⁺, H₂O leaves, the acid residue of the salt remains.',
      'OH⁻ kislorodining elektron jufti nometall atomi (C, S, Zn …) bilan umumiy boʻladi — nordon ion hosil boʻladi; ikkinchi OH⁻ undan H⁺ ni oladi, H₂O chiqadi, tuzning kislota qoldigʻi qoladi.',
    ] as Tri,
  },
  bridgeBreak: {
    title: ['Путь: разрыв мостика X–O–X', 'Route: the X–O–X bridge breaks', 'Yoʻl: X–O–X koʻprigi uziladi'] as Tri,
    text: [
      'В оксиде атомы связаны мостиками X–O–X. Ион O²⁻ (или OH⁻) отдаёт пару электронов атому X, мостик рвётся — получаются два конца X–O⁻: кислотный остаток соли.',
      'In the oxide the atoms are joined by X–O–X bridges. An O²⁻ (or OH⁻) ion gives an electron pair to atom X, the bridge breaks — two X–O⁻ ends form: the acid residue of the salt.',
      'Oksidda atomlar X–O–X koʻpriklari bilan bogʻlangan. O²⁻ (yoki OH⁻) ioni X atomiga elektron juftini beradi, koʻprik uziladi — ikkita X–O⁻ uchi: tuzning kislota qoldigʻi hosil boʻladi.',
    ] as Tri,
  },
  mixture: {
    title: ['Путь: смесь двух солей', 'Route: a mixture of two salts', 'Yoʻl: ikki tuz aralashmasi'] as Tri,
    text: [
      'Сильвинит — природная СМЕСЬ кристаллов KCl и NaCl: у каждой соли своя решётка типа NaCl, новых связей между ними не образуется.',
      'Sylvinite is a natural MIXTURE of KCl and NaCl crystals: each salt keeps its own NaCl-type lattice, no new bonds form between them.',
      'Silvinit — KCl va NaCl kristallarining tabiiy ARALASHMASI: har bir tuzning oʻz NaCl tipidagi panjarasi bor, ular orasida yangi bogʻ hosil boʻlmaydi.',
    ] as Tri,
  },
  oxideAcid: {
    title: ['Путь: основный оксид + кислота', 'Route: basic oxide + acid', 'Yoʻl: asosli oksid + kislota'] as Tri,
    text: [
      'Ион O²⁻ оксида присоединяет два протона кислоты: O²⁻ + 2H⁺ → H₂O. Катион металла и кислотные остатки остаются — из них собирается соль.',
      'The O²⁻ ion of the oxide takes two protons of the acid: O²⁻ + 2H⁺ → H₂O. The metal cation and the acid residues remain — the salt is built from them.',
      'Oksidning O²⁻ ioni kislotaning ikki protonini biriktiradi: O²⁻ + 2H⁺ → H₂O. Metall kationi va kislota qoldiqlari qoladi — tuz ulardan yigʻiladi.',
    ] as Tri,
  },
  acidFromSalt: {
    title: ['Путь: кислота из соли', 'Route: an acid from a salt', 'Yoʻl: tuzdan kislota'] as Tri,
    text: [
      'Сильная кислота даёт ионы H⁺. Они присоединяются к аниону соли (к неподелённым парам его атомов) — получается молекула новой кислоты.',
      'The strong acid gives H⁺ ions. They join the anion of the salt (at the lone pairs of its atoms) — a molecule of the new acid forms.',
      'Kuchli kislota H⁺ ionlarini beradi. Ular tuz anioniga (atomlarining boʻlinmagan juftlariga) birikadi — yangi kislota molekulasi hosil boʻladi.',
    ] as Tri,
  },
  molecules: {
    title: ['Путь: молекулы сближаются', 'Route: the molecules come together', 'Yoʻl: molekulalar yaqinlashadi'] as Tri,
    text: [
      'Молекулы сближаются; атом H полярной связи O–H притягивается к неподелённой паре азота — водородная связь (слабее ковалентной).',
      'The molecules come close; the H of a polar O–H bond is attracted to the nitrogen lone pair — a hydrogen bond (weaker than a covalent one).',
      'Molekulalar yaqinlashadi; qutbli O–H bogʻining H atomi azotning boʻlinmagan juftiga tortiladi — vodorod bogʻ (kovalentdan kuchsiz).',
    ] as Tri,
  },
} satisfies Record<MoreShow, { title: Tri; text: Tri }>

const res = (show: MoreShow, text?: Tri): MoreResult => ({ show, title: TX[show].title, text: text ?? TX[show].text })

// ─── Частицы-кирпичики (экран, доли b) ───

/** Молекула воды: O в (x, y), H под углом 104,5° (раскрыв — вниз или по углу rot). Возвращает [O, H1, H2]. */
function water(k: SceneKit, keys: [number, number, number][], rot = -90, tIn?: number, tOut?: number): [number, number, number] {
  const h = (s: number) => keys.map(([t, x, y]) => [t, x + Math.cos((rot + s * 52) * deg), y + Math.sin((rot + s * 52) * deg)] as [number, number, number])
  const o = k.A('O', keys, tIn, tOut)
  const h1 = k.A('H', h(-1), tIn, tOut)
  const h2 = k.A('H', h(1), tIn, tOut)
  k.S(o, h1, -1, -1, tOut)
  k.S(o, h2, -1, -1, tOut)
  return [o, h1, h2]
}

/** Частица XOn (тетраэдр n = 4, треугольник n = 3, уголок n = 2 — по треугольнику) по ключам центра. */
function xon(k: SceneKit, X: string, n: number, keys: [number, number, number][], tIn?: number, tOut?: number, rot = 90): { x: number; o: number[] } {
  const l = k.bl(X, 'O')
  const x = k.A(X, keys, tIn, tOut)
  const o: number[] = []
  for (let i = 0; i < n; i++) {
    const d: V3 = n === 4 ? TET[i]! : [...triDir(i, rot), 0]
    o.push(k.A('O', keys.map(([t, cx, cy]) => [t, cx + d[0] * l, cy + d[1] * l, d[2] * l]), tIn, tOut))
    k.S(x, o[i]!, -1, -1, tOut)
  }
  return { x, o }
}

/** Электрон от точки к точке: виден с tIn, летит t0 → t1, гаснет после t1. */
function eFly(k: SceneKit, from: [number, number], to: [number, number], tIn: number, t0: number, t1: number, z = 0.25) {
  k.E([[tIn, from[0], from[1], z], [t0, from[0], from[1], z], [t1, to[0], to[1], z]], tIn, t1 + 0.5)
}

// ─── Сцены ───

export function buildMoreScene(k: SceneKit, script: FormationScript, plan: FormationPlan): MoreResult | null {
  const rk = script.routeKind
  const route = script.route
  const f = script.formula
  const E = k.end
  const ionic = plan.mode === 'ionic'

  if (rk === 'decomposition') {
    // Карбонат: MCO₃ → MO + CO₂↑ — связь C–O рвётся, пара остаётся у O (O²⁻), CO₂ уходит.
    const mc = /^([A-Z][a-z]?)CO₃ → /.exec(route)
    if (mc) {
      const M = mc[1]!
      const l = k.bl('C', 'O')
      const C0: [number, number] = [0.6, 0]
      const m = k.A(M, [[0, -2.2, -0.3]])
      const c = k.A('C', [[0, C0[0], C0[1]], [2.6, C0[0], C0[1]], [5.6, C0[0] + 0.8, 2.6]])
      // O к металлу (останется O²⁻) и два O, которые с C уходят (треугольник → линейная CO₂)
      const oM = k.A('O', [[0, C0[0] - l, 0], [2.6, C0[0] - l, 0], [4.4, -0.9, -0.2]])
      const oa = k.A('O', [[0, C0[0] + l * Math.cos(60 * deg), l * Math.sin(60 * deg)], [2.6, C0[0] + l * Math.cos(60 * deg), l * Math.sin(60 * deg)], [3.8, C0[0] + 0.3, l + 0.4], [5.6, C0[0] + 0.8, 2.6 + l]])
      const ob = k.A('O', [[0, C0[0] + l * Math.cos(60 * deg), -l * Math.sin(60 * deg)], [2.6, C0[0] + l * Math.cos(60 * deg), -l * Math.sin(60 * deg)], [3.8, C0[0] + 0.3, 0.4 - l], [5.6, C0[0] + 0.8, 2.6 - l]])
      k.S(c, oM, -1, -1, 3.0)
      k.S(c, oa, -1, -1)
      k.S(c, ob, -1, -1)
      // пара связи C–O остаётся у кислорода
      for (const s of [-1, 1]) k.E([[0.8, C0[0] - l / 2, s * 0.12], [2.8, C0[0] - l / 2, s * 0.12], [3.8, C0[0] - l - 0.55, s * 0.18]], 0.8, 4.4)
      k.L(ion(`${M}`, 2), [m], 0.3, E)
      k.L('CO₃²⁻', [c, oM, oa, ob], 0.3, 2.9)
      k.L('O²⁻', [oM], 3.4, E)
      k.L('CO₂↑', [c, oa, ob], 4.0, E)
      k.L(`${M}O`, [m, oM], 5.0, E)
      return res('decomposition', [
        `При обжиге ${M}CO₃ → ${M}O + CO₂↑: в ионе CO₃²⁻ рвётся связь C–O, её пара электронов остаётся у кислорода (O²⁻ остаётся с ${M}²⁺), а молекула CO₂ уходит газом.`,
        `On roasting ${M}CO₃ → ${M}O + CO₂↑: a C–O bond of the CO₃²⁻ ion breaks, its electron pair stays with oxygen (O²⁻ stays with ${M}²⁺), and the CO₂ molecule escapes as a gas.`,
        `Kuydirilganda ${M}CO₃ → ${M}O + CO₂↑: CO₃²⁻ ionidagi C–O bogʻ uziladi, uning elektron jufti kislorodda qoladi (O²⁻ ${M}²⁺ bilan qoladi), CO₂ molekulasi esa gaz boʻlib chiqadi.`,
      ])
    }
    // Нитрат: 2MNO₃ → 2MNO₂ + O₂↑ — от каждого NO₃⁻ уходит атом O, два O → O₂ (N⁺⁵ → N⁺³, O⁻² → O⁰).
    const mn = /^2([A-Z][a-z]?)NO₃ → /.exec(route)
    if (mn) {
      const ids: { x: number; o: number[] }[] = []
      for (const sx of [-1, 1]) {
        const cx = sx * 1.9
        const p = xon(k, 'N', 3, [[0, cx, -0.6]], undefined, undefined, 90)
        ids.push(p)
      }
      // верхний O каждого иона уходит к середине и вместе — вверх (O₂)
      const l = k.bl('N', 'O')
      ids.forEach((p, i) => {
        const sx = i === 0 ? -1 : 1
        const top = p.o[0]!
        const at = k.A('O', [[0, sx * 1.9, -0.6 + l], [2.4, sx * 1.9, -0.6 + l], [3.8, sx * 0.62, 1.6], [5.8, sx * 0.62, 3.2]])
        // верхний O иона показывает отдельный атом (он уходит): исходный скрыт с начала
        hideAt(k, top, 0)
        k.S(p.x, at, -1, -1, 2.8)
        for (const s of [-1, 1]) k.E([[0.8, sx * 1.9 + s * 0.12, -0.6 + l / 2], [2.6, sx * 1.9 + s * 0.12, -0.6 + l / 2], [3.4, sx * 1.9 + s * 0.15, -0.6 + 0.55]], 0.8, 4.0)
        ;(p as { at?: number }).at = at
      })
      const a0 = (ids[0] as { at?: number }).at!
      const a1 = (ids[1] as { at?: number }).at!
      k.S(a0, a1, 3.7, 4.3)
      k.S(a0, a1, 3.9, 4.5)
      k.L('NO₃⁻', [ids[0]!.x, ...ids[0]!.o.slice(1), a0], 0.3, 2.8)
      k.L('NO₃⁻', [ids[1]!.x, ...ids[1]!.o.slice(1), a1], 0.3, 2.8)
      k.L(`${ox('N', 5)} → ${ox('N', 3)}`, [ids[0]!.x], 3.0, E)
      k.L('NO₂⁻', [ids[1]!.x, ...ids[1]!.o.slice(1)], 3.6, E)
      k.L(`O₂↑ (${ox('O', -2)} → ${ox('O', 0)})`, [a0, a1], 4.3, E)
      return res('decomposition', [
        `${route}: от каждого иона NO₃⁻ отрывается атом кислорода, а пара электронов связи остаётся у азота (N⁺⁵ → N⁺³, ион NO₂⁻). Два атома O соединяются в молекулу O₂ и уходят (O⁻² → O⁰).`,
        `${route}: an oxygen atom leaves each NO₃⁻ ion, and the bond's electron pair stays with nitrogen (N⁺⁵ → N⁺³, the NO₂⁻ ion). Two O atoms join into an O₂ molecule and escape (O⁻² → O⁰).`,
        `${route}: har bir NO₃⁻ ionidan kislorod atomi ajraladi, bogʻ elektron jufti azotda qoladi (N⁺⁵ → N⁺³, NO₂⁻ ioni). Ikki O atomi O₂ molekulasiga birikib chiqib ketadi (O⁻² → O⁰).`,
      ])
    }
    // Кислород уходит из оксида / KMnO₄: два O⁻² отдают 4e⁻ металлу, соединяются в O₂↑.
    const mo = /(\d?)(KMnO₄|CuO|MnO₂) → /.exec(route)
    if (mo) {
      const src = mo[2]!
      const kmno4 = src === 'KMnO₄'
      const M = kmno4 || src === 'MnO₂' ? 'Mn' : 'Cu'
      const nM = kmno4 ? 2 : src === 'CuO' ? 4 : f === 'Mn₃O₄' ? 3 : 4
      const st0 = kmno4 ? 7 : src === 'CuO' ? 2 : 4
      const xs = Array.from({ length: nM }, (_, i) => (i - (nM - 1) / 2) * (kmno4 ? 2.9 : 1.55))
      const metals: number[] = []
      const tops: number[] = []
      const tp: number[] = []
      const nStay = kmno4 ? 0 : (src === 'CuO' ? 1 : 2) * nM - 2
      xs.forEach((x, i) => {
        if (kmno4) {
          const p = xon(k, 'Mn', 4, [[0, x, -0.9]], undefined, undefined)
          metals.push(p.x)
          // у правого MnO₄⁻ уходят два атома O (верхний и передний): исходные скрываются, их путь — отдельные атомы
          if (i === 1) {
            const l = k.bl('Mn', 'O')
            for (const [q, d] of [[0, TET[0]!], [2, TET[2]!]] as const) {
              tops.push(p.o[q]!)
              const s1 = tp.length ? 1 : -1
              tp.push(k.A('O', [[3.5, x + d[0] * l, -0.9 + d[1] * l, d[2] * l], [4.4, x + s1 * 0.62, 1.7], [6.0, x + s1 * 0.62, 3.3]], 3.5))
            }
          }
        } else metals.push(k.A(M, [[0, x, -0.4]]))
      })
      if (!kmno4) {
        // оксидные O, которые остаются (под металлами), и два O, которые уходят парой (над ними)
        for (let j = 0; j < nStay; j++) {
          const row = j < nM - 1 ? 0 : 1
          const n = row ? nStay - (nM - 1) : Math.min(nStay, nM - 1)
          const jj = row ? j - (nM - 1) : j
          k.A('O', [[0, (jj - (n - 1) / 2) * 1.55, -1.55 - row * 1.25]])
        }
        for (const s1 of [-1, 1]) tp.push(k.A('O', [[0, s1 * 0.78, 0.9], [2.8, s1 * 0.78, 0.9], [4.0, s1 * 0.62, 1.7], [6.0, s1 * 0.62, 3.3]]))
      }
      // электроны: 4 e⁻ от двух O⁻² к металлам (у KMnO₄: 3 к своему Mn, 1 к соседнему)
      const targets: number[] = kmno4 ? [1, 1, 1, 0] : nM === 4 ? [0, 1, 2, 3] : [0, 0, 1, 2]
      targets.forEach((mi, j) => {
        const from: [number, number] = kmno4 ? [xs[1]! + (j % 2 ? 0.4 : -0.4), 0.4] : [(j % 2 ? 0.78 : -0.78), 0.9]
        eFly(k, from, [xs[mi]! + 0.2 * (j % 2 ? 1 : -1), kmno4 ? -0.6 : -0.1], 0.9, 1.6 + 0.45 * j, 2.6 + 0.45 * j)
      })
      k.S(tp[0]!, tp[1]!, 4.0, 4.6)
      k.S(tp[0]!, tp[1]!, 4.2, 4.8)
      const fin = (q: number) => ox(M, q)
      if (kmno4) {
        k.L('MnO₄⁻', [metals[0]!], 0.3, 3.0)
        k.L('MnO₄⁻', [metals[1]!], 0.3, 3.0)
        k.L(`${fin(7)} → ${fin(6)} (MnO₄²⁻)`, [metals[0]!], 3.3, E)
        k.L(`${fin(7)} → ${fin(4)} (MnO₂)`, [metals[1]!], 3.3, E)
        // уходящие атомы исходного иона прячем в момент отрыва
        for (const o of tops) hideAt(k, o, 3.5)
      } else {
        k.L(`${M}O${src === 'MnO₂' ? '₂' : ''}`, [metals[0]!], 0.3, 2.6)
        const st1 = src === 'CuO' ? 1 : f === 'Mn₃O₄' ? 0 : 3
        k.L(`${fin(st0)} → ${st1 ? fin(st1) : `${fin(2)}, ${fin(3)}`}`, [metals[0]!], 3.0, E)
      }
      k.L(`O₂↑ (${ox('O', -2)} → ${ox('O', 0)})`, tp, 4.3, E)
      return res('decomposition', [
        `${route}: два атома кислорода (O⁻²) отдают 4 электрона атомам ${M} (${M}⁺${st0} восстанавливается), сами соединяются в молекулу O₂, она уходит газом (O⁻² → O⁰).`,
        `${route}: two oxygen atoms (O⁻²) give 4 electrons to the ${M} atoms (${M}⁺${st0} is reduced), and join into an O₂ molecule that escapes as a gas (O⁻² → O⁰).`,
        `${route}: ikki kislorod atomi (O⁻²) ${M} atomlariga 4 elektron beradi (${M}⁺${st0} qaytariladi), oʻzlari O₂ molekulasiga birikib, gaz boʻlib chiqadi (O⁻² → O⁰).`,
      ])
    }
    // NH₄NO₃ → N₂O + 2H₂O: N⁻³ отдаёт 4e⁻ азоту N⁺⁵, атомы N соединяются; H с двумя O уходят водой.
    if (/NH₄NO₃ → N₂O/.test(route)) {
      const l = k.bl('N', 'H')
      const na = k.A('N', [[0, -2.2, 0], [2.6, -2.2, 0], [4.6, -1.0, 0]])
      const hs = TET.map((d, i) => {
        const h = k.A('H', [[0, -2.2 + d[0] * l, d[1] * l, d[2] * l], [2.8, -2.2 + d[0] * l, d[1] * l, d[2] * l], [4.4, i < 2 ? 0.5 + 0.8 * i : 0.5 + 0.8 * (i - 2), i < 2 ? 1.9 : -2.0], [6.2, i < 2 ? 0.5 + 0.8 * i : 0.5 + 0.8 * (i - 2), i < 2 ? 2.9 : -3.0]])
        k.S(na, h, -1, -1, 3.2)
        return h
      })
      const lo = k.bl('N', 'O')
      const nb = k.A('N', [[0, 1.6, 0], [2.6, 1.6, 0], [4.6, 0.15, 0]])
      const oR = k.A('O', [[0, 1.6 + lo, 0], [4.6, 0.15 + lo, 0]])
      const oU = k.A('O', [[0, 1.6 + lo * Math.cos(120 * deg), lo * Math.sin(120 * deg)], [2.8, 1.6 + lo * Math.cos(120 * deg), lo * Math.sin(120 * deg)], [4.4, 0.9, 1.5], [6.2, 0.9, 2.5]])
      const oD = k.A('O', [[0, 1.6 + lo * Math.cos(240 * deg), -lo * Math.sin(120 * deg)], [2.8, 1.6 + lo * Math.cos(240 * deg), -lo * Math.sin(120 * deg)], [4.4, 0.9, -1.6], [6.2, 0.9, -2.6]])
      k.S(nb, oR, -1, -1)
      k.S(nb, oU, -1, -1, 3.2)
      k.S(nb, oD, -1, -1, 3.2)
      for (let j = 0; j < 4; j++) eFly(k, [-2.2 + 0.25, 0.15 * (j - 1.5)], [1.6 - 0.35, 0.15 * (j - 1.5)], 0.8, 1.2 + 0.35 * j, 2.4 + 0.35 * j)
      k.S(na, nb, 4.2, 4.8)
      k.S(hs[0]!, oU, 4.0, 4.5)
      k.S(hs[1]!, oU, 4.0, 4.5)
      k.S(hs[2]!, oD, 4.0, 4.5)
      k.S(hs[3]!, oD, 4.0, 4.5)
      k.L(`NH₄⁺ (${ox('N', -3)})`, [na], 0.3, 3.2)
      k.L(`NO₃⁻ (${ox('N', 5)})`, [nb], 0.3, 3.2)
      k.L(`N₂O (${ox('N', 1)})`, [na, nb, oR], 4.8, E)
      k.L('H₂O', [oU, hs[0]!, hs[1]!], 4.8, E)
      k.L('H₂O', [oD, hs[2]!, hs[3]!], 4.8, E)
      return res('decomposition', [
        'NH₄NO₃ → N₂O + 2H₂O: азот иона NH₄⁺ (N⁻³) отдаёт 4 электрона азоту иона NO₃⁻ (N⁺⁵) — оба становятся N⁺¹ и связываются: N₂O. Атомы H с двумя атомами O уходят водой.',
        'NH₄NO₃ → N₂O + 2H₂O: the nitrogen of NH₄⁺ (N⁻³) gives 4 electrons to the nitrogen of NO₃⁻ (N⁺⁵) — both become N⁺¹ and bond: N₂O. The H atoms leave with two O atoms as water.',
        'NH₄NO₃ → N₂O + 2H₂O: NH₄⁺ azoti (N⁻³) NO₃⁻ azotiga (N⁺⁵) 4 elektron beradi — ikkalasi N⁺¹ boʻlib bogʻlanadi: N₂O. H atomlari ikki O atomi bilan suv boʻlib chiqadi.',
      ])
    }
    // 2NO₂ ⇄ N₂O₄: неспаренные электроны двух NO₂ становятся общей парой N–N.
    if (/2NO₂ ⇄ N₂O₄/.test(route)) {
      const n: number[] = []
      for (const s of [-1, 1]) {
        const p = xon(k, 'N', 2, [[0, s * 2.4, 0], [1.0, s * 2.4, 0], [3.6, s * k.bl('N', 'N') / 2, 0]], undefined, undefined, s < 0 ? 120 : 300)
        n.push(p.x)
        k.L('NO₂', [p.x, ...p.o], 0.3, 3.4)
        k.E([[0.6, s * 2.4 - s * 0.55, 0.3], [2.0, s * 2.4 - s * 0.55, 0.3], [3.6, 0, 0.3]], 0.6, 4.2)
      }
      k.S(n[0]!, n[1]!, 3.6, 4.3)
      k.L('N₂O₄', n, 4.4, E)
      return res('decomposition', [
        '2NO₂ ⇄ N₂O₄: у азота каждой молекулы NO₂ есть неспаренный электрон. Два таких электрона становятся общей парой — связь N–N, получается N₂O₄ (при нагревании она снова рвётся).',
        '2NO₂ ⇄ N₂O₄: the nitrogen of each NO₂ molecule has an unpaired electron. The two electrons become a shared pair — an N–N bond, giving N₂O₄ (on heating it breaks again).',
        '2NO₂ ⇄ N₂O₄: har bir NO₂ molekulasidagi azotda juftlashmagan elektron bor. Ikki shunday elektron umumiy juftga aylanadi — N–N bogʻ, N₂O₄ hosil boʻladi (qizdirilganda yana uziladi).',
      ])
    }
  }

  if (rk === 'dehydration') {
    // M(OH)₂ → MO + H₂O: H⁺ одной OH⁻ переходит к другой OH⁻ → H₂O уходит, O²⁻ остаётся у M²⁺.
    const mh = /^([A-Z][a-z]?)\(OH\)₂ → /.exec(route)
    if (mh) {
      const M = mh[1]!
      const m = k.A(M, [[0, 0, -0.4]])
      const l = k.bl(M, 'O')
      const oL = k.A('O', [[0, -l, -0.4], [2.6, -l, -0.4], [4.2, -l - 0.2, 0.6], [6.0, -1.6, 2.6]])
      const hL = k.A('H', [[0, -l - 1, -0.4], [2.6, -l - 1, -0.4], [4.2, -l - 0.6, 1.5], [6.0, -2.0, 3.5]])
      const oR = k.A('O', [[0, l, -0.4]])
      const hR = k.A('H', [[0, l + 1, -0.4], [2.2, l + 1, -0.4], [3.4, 0.2, 0.9], [4.2, -l + 0.6, 1.4], [6.0, -1.0, 3.4]])
      k.S(oL, hL, -1, -1)
      k.S(oR, hR, -1, -1, 2.6)
      k.S(oL, hR, 3.6, 4.2)
      for (const s of [-1, 1]) k.E([[0.8, l + 0.5, -0.4 + s * 0.12], [2.4, l + 0.5, -0.4 + s * 0.12], [3.0, l + 0.3, -0.4 + s * 0.2]], 0.8, 4.0)
      k.L('OH⁻', [oL, hL], 0.3, 2.6)
      k.L('OH⁻', [oR, hR], 0.3, 2.6)
      k.L(ion(M, 2), [m], 0.3, E)
      k.L('H₂O↑', [oL, hL, hR], 4.4, E)
      k.L('O²⁻', [oR], 3.4, E)
      k.L(f, [m, oR], 5.0, E)
      return res('dehydration', [
        `${route}: при нагревании протон H⁺ одного иона OH⁻ переходит к другому OH⁻ — получается молекула H₂O, она уходит паром. Ион O²⁻ остаётся с ${M}²⁺ — это оксид ${f}.`,
        `${route}: on heating the proton H⁺ of one OH⁻ ion moves to the other OH⁻ — an H₂O molecule forms and leaves as steam. The O²⁻ ion stays with ${M}²⁺ — this is the oxide ${f}.`,
        `${route}: qizdirilganda bir OH⁻ ionining H⁺ protoni boshqa OH⁻ ga oʻtadi — H₂O molekulasi hosil boʻlib, bugʻ boʻlib chiqadi. O²⁻ ioni ${M}²⁺ bilan qoladi — bu ${f} oksidi.`,
      ])
    }
    // Конденсация: X–OH + HO–X → X–O–X + H₂O (2H₃PO₄ → H₄P₂O₇; 2HClO₄ → Cl₂O₇, воду отнимает P₂O₅).
    const mx = /2H(₃)?(P|Cl)O₄/.exec(route)
    if (mx) {
      const X = mx[2]!
      const l = k.bl(X, 'O')
      const xL = -1.05 * l
      const xR = 1.05 * l
      // левая частица: O справа (OH, уйдёт водой); правая: O слева (OH → мостик)
      const left = k.A(X, [[0, xL - 1.0, 0], [2.0, xL, 0]])
      const right = k.A(X, [[0, xR + 1.0, 0], [2.0, xR, 0]])
      const others = (cx0: number, cx1: number, sx: number, withH: number) => {
        const ids: number[] = []
        const dirs: [number, number, number][] = [
          [0, 1, 0],
          [0, -0.5, 0.86],
          [0, -0.5, -0.86],
        ]
        dirs.forEach((d, i) => {
          const dx = sx * 0.33
          const o = k.A('O', [[0, cx0 + dx * l, d[1] * l, d[2] * l], [2.0, cx1 + dx * l, d[1] * l, d[2] * l]])
          k.S(sx < 0 ? left : right, o, -1, -1)
          ids.push(o)
          if (i > 0 && i <= withH) {
            const h = k.A('H', [[0, cx0 + dx * l + sx * 0.6, d[1] * (l + 0.8), d[2] * (l + 0.8)], [2.0, cx1 + dx * l + sx * 0.6, d[1] * (l + 0.8), d[2] * (l + 0.8)]])
            k.S(o, h, -1, -1)
            ids.push(h)
          }
        })
        return ids
      }
      const nH = X === 'P' ? 2 : 0
      const oL = others(xL - 1.0, xL, -1, nH)
      const oR = others(xR + 1.0, xR, 1, nH)
      // OH левой (уйдёт водой) и OH правой (станет мостиком)
      const ow = k.A('O', [[0, xL - 1.0 + l, 0.15], [2.0, xL + l * 0.92, 0.3], [3.4, xL + l * 0.92, 0.6], [4.4, -0.4, -1.9], [6.2, -0.4, -3.2]])
      const hw = k.A('H', [[0, xL - 1.0 + l + 0.4, 1.05], [2.0, xL + l * 0.92 + 0.3, 1.2], [4.4, -1.0, -1.4], [6.2, -1.0, -2.7]])
      const ob = k.A('O', [[0, xR + 1.0 - l, -0.3], [2.0, xR - l * 0.92, -0.6], [3.6, xR - l * 0.92, -0.6], [4.6, 0, -0.35]])
      const hb = k.A('H', [[0, xR + 1.0 - l - 0.3, -1.25], [2.0, xR - l * 0.92 - 0.2, -1.55], [3.0, 0.2, -0.9], [3.6, xL + l * 0.92 + 0.85, -0.2], [4.4, 0.2, -2.3], [6.2, 0.2, -3.6]])
      k.S(left, ow, -1, -1, 3.6)
      k.S(ow, hw, -1, -1)
      k.S(right, ob, -1, -1)
      k.S(ob, hb, -1, -1, 2.8)
      k.S(ow, hb, 3.4, 3.9)
      k.S(left, ob, 4.4, 5.0)
      k.L(X === 'P' ? 'H₃PO₄' : 'HClO₄', [left, ...oL, ow, hw], 0.3, 3.0)
      k.L(X === 'P' ? 'H₃PO₄' : 'HClO₄', [right, ...oR, ob, hb], 0.3, 3.0)
      k.L(X === 'P' ? 'H₂O↑' : 'H₂O → P₂O₅', [ow, hw, hb], 4.2, E)
      k.L(`${X}–O–${X}`, [left, ob, right], 5.0, E)
      return res('dehydration', [
        `${route}: группа O–H одной молекулы и атом H другой дают молекулу H₂O, она уходит${X === 'Cl' ? ' (её связывает P₂O₅ — водоотнимающее вещество)' : ''}. Оставшийся кислород становится мостиком ${X}–O–${X} — получается ${f}.`,
        `${route}: an O–H group of one molecule and an H atom of the other give an H₂O molecule that leaves${X === 'Cl' ? ' (P₂O₅, a dehydrating agent, binds it)' : ''}. The remaining oxygen becomes an ${X}–O–${X} bridge — ${f} forms.`,
        `${route}: bir molekulaning O–H guruhi va boshqasining H atomi H₂O molekulasini beradi, u chiqib ketadi${X === 'Cl' ? ' (uni suv tortuvchi P₂O₅ bogʻlaydi)' : ''}. Qolgan kislorod ${X}–O–${X} koʻprigiga aylanadi — ${f} hosil boʻladi.`,
      ])
    }
  }

  if (rk === 'redox') return redoxScene(k, script, plan)

  if (rk === 'oxideWater' && !ionic) {
    // Кислотный оксид + вода: CO₂ / SO₂ / SO₃ / P₂O₅ (+ H₂O) → кислота.
    const mx = /^(SO₃|SO₂|CO₂|P₂O₅)/.exec(route)
    if (mx) {
      const X = mx[1]![0] === 'P' ? 'P' : mx[1]![0]!
      const nO = mx[1] === 'SO₃' ? 3 : mx[1] === 'P₂O₅' ? 3 : 2
      const l = k.bl(X, 'O')
      const xc: [number, number] = [-0.9, 0]
      const x = k.A(X, [[0, xc[0], xc[1]]])
      // O оксида: треугольник (SO₃, у P — фрагмент PO₃ из P₂O₅) или «двойка» (CO₂ линейная, SO₂ уголок)
      const dirsO: number[] = nO === 3 ? [60, 180, 300] : X === 'C' ? [90, 270] : [120, 240]
      const dirsF: number[] = nO === 3 ? [75, 180, 285] : [120, 240]
      const os = dirsO.map((a, i) => k.A('O', [[0, xc[0] + l * Math.cos(a * deg), xc[1] + l * Math.sin(a * deg)], [2.6, xc[0] + l * Math.cos(a * deg), xc[1] + l * Math.sin(a * deg)], [4.4, xc[0] + l * Math.cos(dirsF[i]! * deg), xc[1] + l * Math.sin(dirsF[i]! * deg)]]))
      for (const o of os) k.S(x, o, -1, -1)
      // вода приходит справа, O воды → к X; один H переходит на нижний O оксида
      const ow: [number, number, number][] = [[0.4, 3.0, 0.3], [2.6, xc[0] + l * 1.05, 0.2], [4.4, xc[0] + l * 1.05 - 0.1, 0]]
      const [o, h1, h2] = water(k, ow, 30)
      const oAcc = os[os.length - 1]!
      const aF = dirsF[dirsF.length - 1]!
      const accPos: [number, number] = [xc[0] + l * Math.cos(aF * deg), xc[1] + l * Math.sin(aF * deg)]
      // нижний H воды (h1, под углом −22°) переходит к нижнему O оксида
      const hT = k.A('H', [[3.0, xc[0] + l * 1.05 + Math.cos(-22 * deg), 0.2 + Math.sin(-22 * deg)], [3.6, xc[0] + l * 1.05 + 0.4, -1.0], [4.4, accPos[0] + 0.71, accPos[1] - 0.71]], 3.0)
      hideAt(k, h1, 3.0)
      k.S(o, hT, 2.95, 3.0, 3.5)
      k.S(oAcc, hT, 4.0, 4.6)
      k.S(x, o, 2.8, 3.5)
      for (const s of [-1, 1]) k.E([[0.6, 3.0 - 0.6, 0.3 + s * 0.12], [1.6, 3.0 - 0.6, 0.3 + s * 0.12], [2.7, xc[0] + l * 0.55, 0.1 + s * 0.12]], 0.8, 3.3)
      const acid = X === 'S' ? (nO === 3 ? 'H₂SO₄' : 'H₂SO₃') : X === 'C' ? 'H₂CO₃' : f === 'HPO₃' ? 'HPO₃' : 'H₃PO₄'
      k.L(mx[1] === 'P₂O₅' ? 'P₂O₅ (фрагмент PO₃)' : mx[1]!, [x, ...os], 0.3, 2.8)
      k.L('H₂O', [o, h1, h2], 0.3, 2.8)
      k.L(acid === 'H₃PO₄' ? 'H₃PO₄ (третья H₂O — так же)' : acid, [x, ...os, o, h2, hT], 4.6, E)
      return res('acidOxideWater')
    }
  }

  if (rk === 'protonTransfer' && /Ca₃P₂/.test(route)) {
    // P³⁻ + 3H₂O → PH₃ + 3OH⁻: пара P забирает H⁺ у трёх молекул воды.
    const p = k.A('P', [[0, 0, -0.2]])
    const l = k.bl('P', 'H')
    const ids: number[] = [p]
    const dirs = [90, 210, 330]
    dirs.forEach((a, i) => {
      const d: [number, number] = [Math.cos(a * deg), Math.sin(a * deg)]
      const far = l + 1.9
      const t0 = 2.2 + 0.5 * i
      const [ow, hA, hB] = water(k, [[0.4, d[0] * (far + 0.6), -0.2 + d[1] * (far + 0.6)], [t0, d[0] * far, -0.2 + d[1] * far], [6.0, d[0] * (far + 0.8), -0.2 + d[1] * (far + 0.8)]], a + 180 + 0)
      // H, обращённый к P, переходит к P
      hideAt(k, hA, t0 + 0.4)
      const hA0: [number, number] = [d[0] * far + Math.cos((a + 180 - 52) * deg), -0.2 + d[1] * far + Math.sin((a + 180 - 52) * deg)]
      const hp = k.A('H', [[t0 + 0.4, hA0[0], hA0[1]], [t0 + 1.4, d[0] * l, -0.2 + d[1] * l, 0.3]], t0 + 0.4)
      k.S(p, hp, t0 + 1.1, t0 + 1.6)
      k.L('OH⁻', [ow, hB], t0 + 1.4, E)
      if (i === 0) k.L('H₂O', [ow, hA, hB], 0.6, t0)
      for (const s of [-1, 1]) k.E([[0.6, d[0] * 0.55 + s * 0.1, -0.2 + d[1] * 0.55], [t0 + 0.2, d[0] * 0.55 + s * 0.1, -0.2 + d[1] * 0.55], [t0 + 1.2, d[0] * l * 0.5 + s * 0.08, -0.2 + d[1] * l * 0.5]], 0.6, t0 + 1.6)
      ids.push(hp)
    })
    k.L('P³⁻', [p], 0.3, 3.0)
    k.L('PH₃', ids, 4.6, E)
    return res('acidFromSalt', [
      'Ca₃P₂ + 6H₂O → 3Ca(OH)₂ + 2PH₃: неподелённые пары иона P³⁻ забирают протоны H⁺ у трёх молекул воды — получаются молекула PH₃ и три иона OH⁻.',
      'Ca₃P₂ + 6H₂O → 3Ca(OH)₂ + 2PH₃: the lone pairs of the P³⁻ ion take protons H⁺ from three water molecules — a PH₃ molecule and three OH⁻ ions form.',
      'Ca₃P₂ + 6H₂O → 3Ca(OH)₂ + 2PH₃: P³⁻ ionining boʻlinmagan juftlari uchta suv molekulasidan H⁺ protonlarini oladi — PH₃ molekulasi va uchta OH⁻ ioni hosil boʻladi.',
    ])
  }

  if (rk === 'baseAcidOxide') {
    // SiO₂ / Al₂O₃ + O²⁻ или OH⁻: разрыв мостика X–O–X.
    const mb = /(SiO₂|Al₂O₃)/.exec(route)
    if (mb) {
      const X = mb[1] === 'SiO₂' ? 'Si' : 'Al'
      const oh = /OH/.test(route)
      const l = k.bl(X, 'O')
      const xa = k.A(X, [[0, -l, 0], [3.0, -l, 0], [5.0, -l - 0.9, 0]])
      const xb = k.A(X, [[0, l, 0], [3.0, l, 0], [5.0, l + 0.6, -0.4]])
      const br = k.A('O', [[0, 0, 0.75], [3.0, 0, 0.75], [5.0, -1.0, 0.75]])
      k.S(xa, br, -1, -1)
      k.S(xb, br, -1, -1, 3.6)
      // концевые O (у Si — ещё по два «к соседям каркаса», у Al — по одному)
      const term = (x: number, cx: number, sx: number, cx2: number) => {
        const n = X === 'Si' ? 2 : 1
        const ids: number[] = []
        for (let i = 0; i < n; i++) {
          const a = X === 'Si' ? (sx < 0 ? [145, 215][i]! : [35, 95][i]!) : sx < 0 ? 200 : 340
          const o = k.A('O', [[0, cx + l * Math.cos(a * deg), l * Math.sin(a * deg)], [3.0, cx + l * Math.cos(a * deg), l * Math.sin(a * deg)], [5.0, cx2 + l * Math.cos(a * deg), l * Math.sin(a * deg) + (sx > 0 ? -0.4 : 0)]])
          k.S(x, o, -1, -1)
          ids.push(o)
        }
        return ids
      }
      const ta = term(xa, -l, -1, -l - 0.9)
      const tb = term(xb, l, 1, l + 0.6)
      // атакующий O²⁻ / OH⁻ — снизу справа к xb
      const at = k.A('O', [[0.4, 2.6, -2.4], [3.0, l + 0.35, -l * 0.95], [5.0, l + 0.95, -l * 0.95 - 0.4]])
      k.S(xb, at, 3.0, 3.6)
      let hh = -1
      if (oh) {
        hh = k.A('H', [[0.4, 3.4, -2.9], [3.0, l + 1.15, -l * 0.95 - 0.5], [4.4, l + 1.6, -l - 0.9], [6.2, 2.9, -3.0]])
        k.S(at, hh, -1, -1, 4.2)
      }
      for (const s of [-1, 1]) k.E([[0.6, 2.6 - 0.5, -2.4 + 0.5 + s * 0.1], [1.8, 2.6 - 0.5, -2.4 + 0.5 + s * 0.1], [3.2, l + 0.18 + s * 0.1, -l * 0.5]], 0.6, 3.8)
      // пара мостика уходит к O (он становится концом X–O⁻)
      for (const s of [-1, 1]) k.E([[3.0, l / 2, 0.38 + s * 0.1], [3.4, l / 2, 0.38 + s * 0.1], [4.4, -1.0 + 0.45, 0.75 + 0.45 + s * 0.1]], 3.2, 5.0)
      k.L(`${X}–O–${X}`, [xa, br, xb], 0.3, 3.4)
      k.L(oh ? 'OH⁻' : 'O²⁻', oh ? [at, hh] : [at], 0.3, 3.0)
      if (oh) k.L('H⁺ → OH⁻ (H₂O)', [hh], 4.6, E)
      k.L(`${X}–O⁻`, [xa, br, ...ta], 4.8, E)
      k.L(`${X}–O⁻`, [xb, at, ...tb], 4.8, E)
      return res('bridgeBreak')
    }
    // OH⁻ + CO₂ / SO₂ / ZnO (щёлочь): пара O → C/S/Zn (HCO₃⁻ / HSO₃⁻), второй OH⁻ забирает H⁺ (CO₃²⁻ + H₂O).
    const mo = /(CO₂|SO₂|ZnO)/.exec(route)
    if (mo && /OH|H₂O/.test(route)) {
      const X = mo[1]![0] === 'Z' ? 'Zn' : mo[1]![0]!
      const l = k.bl(X, 'O')
      const xc: [number, number] = [-0.6, 0.2]
      const x = k.A(X, [[0, xc[0], xc[1]]])
      const da: number[] = X === 'C' ? [90, 270] : X === 'S' ? [120, 240] : [180]
      const fa: number[] = X === 'Zn' ? [180] : [120, 240]
      const os = da.map((a, i) => k.A('O', [[0, xc[0] + l * Math.cos(a * deg), xc[1] + l * Math.sin(a * deg)], [2.6, xc[0] + l * Math.cos(a * deg), xc[1] + l * Math.sin(a * deg)], [4.0, xc[0] + l * Math.cos(fa[i]! * deg), xc[1] + l * Math.sin(fa[i]! * deg)]]))
      for (const o of os) k.S(x, o, -1, -1)
      const oc: [number, number] = [xc[0] + l, xc[1]]
      const o1 = k.A('O', [[0.4, 2.6, 1.6], [2.6, oc[0], oc[1]]])
      const h1 = k.A('H', [[0.4, 3.4, 2.2], [2.6, oc[0] + 0.7, oc[1] + 0.7], [4.6, oc[0] + 0.7, oc[1] + 0.7], [5.4, 2.1, -1.0], [6.2, 2.3, -2.0]])
      k.S(o1, h1, -1, -1, 4.9)
      k.S(x, o1, 2.6, 3.2)
      for (const s of [-1, 1]) k.E([[0.6, 2.0, 1.2 + s * 0.1], [1.6, 2.0, 1.2 + s * 0.1], [2.8, xc[0] + l * 0.55, xc[1] + s * 0.1]], 0.6, 3.4)
      const full = !/NaHCO₃|Ca\(HCO₃\)₂/.test(f)
      const ids = [x, ...os, o1]
      if (full) {
        // второй OH⁻ забирает H⁺ → H₂O
        const o2 = k.A('O', [[0.4, 2.8, -1.9], [4.2, 2.8, -1.6], [6.2, 3.0, -2.6]])
        const h2 = k.A('H', [[0.4, 3.6, -2.4], [4.2, 3.6, -2.1], [6.2, 3.8, -3.1]])
        k.S(o2, h2, -1, -1)
        k.S(o2, h1, 5.0, 5.5)
        k.L('OH⁻', [o2, h2], 0.3, 4.8)
        k.L('H₂O', [o2, h2, h1], 5.6, E)
        k.L(X === 'C' ? 'HCO₃⁻' : X === 'S' ? 'HSO₃⁻' : 'HZnO₂⁻', [...ids, h1], 3.4, 4.6)
        k.L(X === 'C' ? 'CO₃²⁻' : X === 'S' ? 'SO₃²⁻' : 'ZnO₂²⁻', ids, 5.4, E)
      } else {
        k.L(/Ca\(HCO₃\)₂/.test(f) ? 'HCO₃⁻ (H₂O + CO₂ + CO₃²⁻ → 2HCO₃⁻)' : 'HCO₃⁻', [...ids, h1], 3.6, E)
      }
      k.L(mo[1]!, [x, ...os], 0.3, 2.6)
      k.L(/Ca\(HCO₃\)₂/.test(f) ? 'OH⁻ (от H₂O)' : 'OH⁻', [o1, h1], 0.3, 2.6)
      return res('ohAcidOxide')
    }
  }

  if (rk === 'mixture') {
    // KCl·NaCl: две решётки рядом (кубики 2×2×2), без новых связей.
    const a = 0.95
    const block = (M: string, cx: number, from: number) => {
      const ids: number[] = []
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++)
          for (let q = 0; q < 2; q++) {
            const el = (i + j + q) % 2 ? 'Cl' : M
            ids.push(k.A(el, [[0, cx + from + i * a * 1.1, (j - 0.5) * a * 1.1, (q - 0.5) * a * 1.1], [3.0, cx + i * a * 1.1, (j - 0.5) * a * 1.1, (q - 0.5) * a * 1.1]], undefined, undefined, (el === 'Cl' ? 0.42 : M === 'K' ? 0.4 : 0.3) * a * 1.1))
          }
      return ids
    }
    const kc = block('K', -2.6, -0.8)
    const nc = block('Na', 0.8, 0.8)
    k.L('KCl', kc, 0.3, E)
    k.L('NaCl', nc, 0.3, E)
    k.L('смесь / mixture / aralashma', [...kc, ...nc], 3.6, E)
    return res('mixture')
  }

  if (rk === 'oxideAcid' && ionic) {
    // MO + 2H⁺ → M²⁺ + H₂O; кислотные остатки — зрители.
    const mm = /^([A-Z][a-z]?)O \+ /.exec(route)
    if (mm) {
      const M = mm[1]!
      const l = k.bl(M, 'O')
      const m = k.A(M, [[0, -0.9, -0.3], [3.4, -0.9, -0.3], [6.0, -1.5, -0.6]])
      const o = k.A('O', [[0, -0.9 + l, -0.3], [3.0, -0.9 + l, -0.3], [4.6, 0.6, 1.4], [6.2, 0.9, 2.6]])
      const ha = k.A('H', [[0.4, 2.8, 1.6], [3.0, -0.9 + l + 0.5, 0.5], [4.6, 1.2, 2.0], [6.2, 1.5, 3.2]])
      const hb = k.A('H', [[0.4, 2.8, -1.8], [3.0, -0.9 + l + 0.5, -1.1], [4.6, 1.2, 0.8], [6.2, 1.5, 2.0]])
      k.S(m, o, -1, -1, 3.6)
      k.S(o, ha, 3.0, 3.6)
      k.S(o, hb, 3.2, 3.8)
      const anEl = /SO₄/.test(route) ? 'S' : 'N'
      const an = /SO₄/.test(route) ? xon(k, 'S', 4, [[0.4, 2.6, -0.2], [3.6, 2.6, -0.2], [6.0, 0.9, -1.4]]) : xon(k, 'N', 3, [[0.4, 2.8, -0.4], [3.6, 2.8, -0.4], [6.0, 0.8, -1.6]])
      void anEl
      const an2 = /SO₄/.test(route) ? null : xon(k, 'N', 3, [[0.4, -3.4, 1.6], [3.6, -3.4, 1.6], [6.0, -3.1, 0.6]])
      k.L(`${M}O`, [m, o], 0.3, 3.0)
      k.L('H⁺', [ha], 0.6, 3.0)
      k.L('H⁺', [hb], 0.6, 3.0)
      k.L('H₂O', [o, ha, hb], 4.4, E)
      k.L(ion(M, 2), [m], 4.0, E)
      k.L(/SO₄/.test(route) ? 'SO₄²⁻' : 'NO₃⁻', [an.x, ...an.o], 0.3, E)
      if (an2) k.L('NO₃⁻', [an2.x, ...an2.o], 0.3, E)
      return res('oxideAcid')
    }
  }

  if (rk === 'exchange' && !ionic) return acidFromSaltScene(k, script)

  if (rk === 'hydration' && !ionic) {
    // NH₃ + H₂O ⇄ NH₃·H₂O: молекулы сближаются, H воды — к паре N (водородная связь).
    const l = k.bl('N', 'H')
    const n = k.A('N', [[0, -2.6, -0.2], [3.0, -1.0, -0.2]])
    const hs: number[] = []
    for (const d of TET.slice(1)) {
      // пирамида NH₃: неподелённая пара N смотрит вправо (к воде)
      const h = k.A('H', [[0, -2.6 + d[1] * l, -0.2 + d[0] * l, d[2] * l], [3.0, -1.0 + d[1] * l, -0.2 + d[0] * l, d[2] * l]])
      k.S(n, h, -1, -1)
      hs.push(h)
    }
    // один H воды смотрит прямо на N (водородная связь N···H ≈ 2 длины O–H)
    const [o, h1, h2] = water(k, [[0, 3.0, -0.2], [3.0, 1.9, -0.2]], 180 + 52)
    for (const s of [-1, 1]) k.E([[0.6, -2.6 + 0.6, -0.2 + s * 0.12], [3.0, -1.0 + 0.6, -0.2 + s * 0.12], [6.0, -1.0 + 0.6, -0.2 + s * 0.12]], 0.6, E)
    k.L('NH₃', [n, ...hs], 0.3, 3.4)
    k.L('H₂O', [o, h1, h2], 0.3, 3.4)
    k.L('NH₃·H₂O (N···H–O)', [n, o], 3.8, E)
    return res('molecules')
  }
  return null
}

/** Атом исчезает в момент t (подменяется «копией» на пути). */
function hideAt(k: SceneKit, i: number, t: number) {
  ;(k as SceneKit & { _hide?: [number, number][] })._hide ??= []
  ;(k as SceneKit & { _hide?: [number, number][] })._hide!.push([i, t])
}

/** Кислота из соли: H⁺ присоединяются к аниону (модель карточки: H прилетают к своим местам); CrO₃ / Mn₂O₇ — O²⁻ + 2H⁺ → H₂O уходит. */
function acidFromSaltScene(k: SceneKit, script: FormationScript): MoreResult | null {
  const E = k.end
  const f = script.formula
  const hasH = k.model.atoms.some((a) => a.el === 'H')
  const { ids, h, heavy } = k.modelAtoms([[0, 0, 0]], hasH ? { from: 0.8, to: 3.6, k: 2.4 } : undefined)
  if (!ids.length) return null
  if (hasH) {
    const q = h.length
    const anion = f.replace(/^H₂|^H₄|^H/, '').replace(/^(\d)/, '$1')
    const an = f === 'H₂O₂' ? 'O₂²⁻' : f === 'SiH₄' ? 'Si⁴⁻' : ion(anion, q)
    k.L(an, heavy, 0.3, 3.0)
    for (const x of h) k.L('H⁺', [x], 0.9, 2.8)
    k.L(f, ids, 4.0, E)
    return res('acidFromSalt', [
      `${script.route}: сильная кислота даёт ионы H⁺, они присоединяются к иону ${an} (к неподелённым парам его атомов) — получается молекула ${f}.`,
      `${script.route}: the strong acid gives H⁺ ions, which join the ${an} ion (at the lone pairs of its atoms) — an ${f} molecule forms.`,
      `${script.route}: kuchli kislota H⁺ ionlarini beradi, ular ${an} ioniga (atomlarining boʻlinmagan juftlariga) birikadi — ${f} molekulasi hosil boʻladi.`,
    ])
  }
  // CrO₃ / Mn₂O₇: лишний атом O аниона с 2H⁺ уходит водой.
  const M = /Cr/.test(f) ? 'Cr' : 'Mn'
  const o = k.A('O', [[0, 0, -2.5], [3.0, 0, -2.5], [4.6, 0.9, -3.0], [6.2, 1.3, -3.6]])
  const ha = k.A('H', [[0.4, -2.6, -3.4], [3.0, -0.75, -3.1], [4.6, 0.15, -3.6], [6.2, 0.55, -4.2]])
  const hb = k.A('H', [[0.4, 2.6, -3.4], [3.0, 0.75, -3.1], [4.6, 1.65, -3.6], [6.2, 2.05, -4.2]])
  k.S(o, ha, 3.0, 3.5)
  k.S(o, hb, 3.2, 3.7)
  k.L(M === 'Cr' ? 'Cr₂O₇²⁻' : 'MnO₄⁻', [...heavy, o], 0.3, 3.0)
  k.L('H⁺', [ha], 0.6, 3.0)
  k.L('H⁺', [hb], 0.6, 3.0)
  k.L('H₂O', [o, ha, hb], 4.2, E)
  k.L(f, ids, 4.6, E)
  return res('acidFromSalt', [
    `${script.route}: ионы H⁺ серной кислоты присоединяются к атому кислорода аниона и уводят его водой (O²⁻ + 2H⁺ → H₂O) — остаётся ${f}.`,
    `${script.route}: the H⁺ ions of sulfuric acid attach to an oxygen atom of the anion and take it away as water (O²⁻ + 2H⁺ → H₂O) — ${f} remains.`,
    `${script.route}: sulfat kislotaning H⁺ ionlari anion kislorod atomiga birikib, uni suv sifatida olib ketadi (O²⁻ + 2H⁺ → H₂O) — ${f} qoladi.`,
  ])
}

/** ОВР: ключевой переход e⁻ с подписями степеней окисления. */
function redoxScene(k: SceneKit, script: FormationScript, plan: FormationPlan): MoreResult | null {
  const route = script.route
  const f = script.formula
  const E = k.end
  void plan
  const say = (ru: string, en: string, uz: string): MoreResult => res('redox', [ru, en, uz])

  // 0) NO + NO₂ → N₂O₃: неспаренные электроны азота двух молекул — общая пара N–N (N⁺² → N⁺³, N⁺⁴ → N⁺³).
  if (/^NO \+ NO₂/.test(route)) {
    const ln = k.bl('N', 'N')
    const a = xon(k, 'N', 1, [[0, -2.4, 0], [1.0, -2.4, 0], [3.6, -ln / 2, 0]], undefined, undefined, 180)
    const b2 = xon(k, 'N', 2, [[0, 2.4, 0], [1.0, 2.4, 0], [3.6, ln / 2, 0]], undefined, undefined, 300)
    for (const s of [-1, 1]) k.E([[0.6, s * 2.4 - s * 0.55, 0.3], [2.0, s * 2.4 - s * 0.55, 0.3], [3.6, 0, 0.3]], 0.6, 4.2)
    k.S(a.x, b2.x, 3.6, 4.3)
    k.L(`NO (${ox('N', 2)})`, [a.x, ...a.o], 0.3, 3.4)
    k.L(`NO₂ (${ox('N', 4)})`, [b2.x, ...b2.o], 0.3, 3.4)
    k.L(`N₂O₃ (${ox('N', 3)})`, [a.x, b2.x], 4.4, E)
    return say(
      'NO + NO₂ → N₂O₃: у азота в NO и в NO₂ есть неспаренный электрон; два электрона становятся общей парой — связь N–N. Степени окисления выравниваются: N⁺² → N⁺³, N⁺⁴ → N⁺³.',
      'NO + NO₂ → N₂O₃: the nitrogen in NO and in NO₂ has an unpaired electron; the two electrons become a shared pair — an N–N bond. The oxidation states even out: N⁺² → N⁺³, N⁺⁴ → N⁺³.',
      'NO + NO₂ → N₂O₃: NO va NO₂ dagi azotda juftlashmagan elektron bor; ikki elektron umumiy juftga aylanadi — N–N bogʻ. Oksidlanish darajalari tenglashadi: N⁺² → N⁺³, N⁺⁴ → N⁺³.',
    )
  }

  // 1) Металл + кислота: M + 2H⁺ → M²⁺ + H₂↑.
  const ma = /^([A-Z][a-z]?) \+ (2HCl|H₂SO₄) → /.exec(route)
  if (ma) {
    const M = ma[1]!
    const m = k.A(M, [[0, -1.6, 0]])
    const ha = k.A('H', [[0.4, 2.4, 1.3], [2.2, 0.2, 0.7], [3.8, 0.2, 0.7], [5.0, 0.05, 1.6], [6.4, 0.05, 3.2]])
    const hb = k.A('H', [[0.4, 2.4, -1.3], [2.2, 0.2, -0.7], [3.8, 0.2, -0.7], [5.0, 0.05 + 0.75, 1.6], [6.4, 0.8, 3.2]])
    eFly(k, [-1.2, 0.2], [0.1, 0.55], 0.6, 2.4, 3.4)
    eFly(k, [-1.2, -0.2], [0.1, -0.55], 0.6, 3.0, 4.0)
    k.S(ha, hb, 4.6, 5.2)
    k.L(`${M}⁰`, [m], 0.3, 3.6)
    k.L(`${ox(M, 0)} → ${ion(M, 2)}`, [m], 4.0, E)
    k.L('H⁺', [ha], 0.6, 3.8)
    k.L('H⁺', [hb], 0.6, 3.8)
    k.L(`H₂↑ (${ox('H', 1)} → ${ox('H', 0)})`, [ha, hb], 5.2, E)
    return say(
      `${route}: атом ${M} отдаёт два электрона двум ионам H⁺ кислоты (${M}⁰ → ${M}⁺², восстановитель); атомы H соединяются в молекулу H₂, она уходит газом (H⁺¹ → H⁰, окислитель).`,
      `${route}: the ${M} atom gives two electrons to two H⁺ ions of the acid (${M}⁰ → ${M}⁺², reducing agent); the H atoms join into an H₂ molecule that escapes as a gas (H⁺¹ → H⁰, oxidising agent).`,
      `${route}: ${M} atomi kislotaning ikki H⁺ ioniga ikki elektron beradi (${M}⁰ → ${M}⁺², qaytaruvchi); H atomlari H₂ molekulasiga birikib, gaz boʻlib chiqadi (H⁺¹ → H⁰, oksidlovchi).`,
    )
  }
  // 2) Металл + вода: M + H₂O → OH⁻ + H₂↑.
  const mw = /^(\d?)([A-Z][a-z]?) \+ (\d?)H₂O → /.exec(route)
  if (mw && !/O₂/.test(route)) {
    const M = mw[2]!
    const v = /^(Li|Na|K)$/.test(M) ? 1 : 2
    const metals = v === 1 ? [k.A(M, [[0, -2.0, 1.1]]), k.A(M, [[0, -2.0, -1.1]])] : [k.A(M, [[0, -2.0, 0]])]
    const ws = [1.1, -1.1].map((y, i) => {
      const w = water(k, [[0.4, 2.4, y], [2.2, 1.2, y], [6.2, 1.9, y * 1.6]], 180 + (i ? 30 : -30))
      return w
    })
    // H воды, обращённый к металлу, освобождается и уходит H₂↑
    // H, обращённый к металлу (угол 202° у верхней воды, 158° у нижней), освобождается и уходит H₂↑
    const hs = ws.map((w, i) => {
      hideAt(k, i ? w[1] : w[2], 3.0 + 0.4 * i)
      const y = i ? -1.1 : 1.1
      const ang = i ? 158 : 202
      const p0: [number, number] = [1.2 + Math.cos(ang * deg), y + Math.sin(ang * deg)]
      return k.A('H', [[3.0 + 0.4 * i, p0[0], p0[1]], [4.4, -0.35 + 0.75 * i, 1.0 * (i ? 0.95 : 1.05)], [5.4, -0.35 + 0.75 * i, 2.0], [6.4, -0.35 + 0.75 * i, 3.4]], 3.0 + 0.4 * i)
    })
    ws.forEach((w, i) => k.L('OH⁻', [w[0], i ? w[2] : w[1]], 4.0, E))
    ws.forEach((w, i) => i === 0 && k.L('H₂O', [w[0], w[1], w[2]], 0.6, 2.8))
    for (let j = 0; j < 2; j++) {
      const m = metals[v === 1 ? j : 0]!
      void m
      eFly(k, [-1.6, v === 1 ? (j ? -1.1 : 1.1) : (j ? -0.2 : 0.2)], [0.35, j ? -1.0 : 1.0], 0.6, 2.2 + 0.5 * j, 3.2 + 0.5 * j)
    }
    k.S(hs[0]!, hs[1]!, 4.6, 5.2)
    for (const m of metals) k.L(`${ox(M, 0)} → ${ion(M, v)}`, [m], 3.6, E)
    for (const m of metals) k.L(`${M}⁰`, [m], 0.3, 3.4)
    k.L(`H₂↑ (${ox('H', 1)} → ${ox('H', 0)})`, hs, 5.2, E)
    return say(
      `${route}: ${v === 1 ? 'каждый атом' : 'атом'} ${M} отдаёт ${v === 1 ? 'электрон' : 'два электрона'} атомам H молекул воды (${M}⁰ → ${M}⁺${v}); от воды остаются ионы OH⁻, а два атома H соединяются в H₂↑ (H⁺¹ → H⁰).`,
      `${route}: ${v === 1 ? 'each' : 'the'} ${M} atom gives ${v === 1 ? 'an electron' : 'two electrons'} to the H atoms of water molecules (${M}⁰ → ${M}⁺${v}); OH⁻ ions remain from the water and two H atoms join into H₂↑ (H⁺¹ → H⁰).`,
      `${route}: ${M} atomi suv molekulalarining H atomlariga ${v === 1 ? 'bitta elektron' : 'ikki elektron'} beradi (${M}⁰ → ${M}⁺${v}); suvdan OH⁻ ionlari qoladi, ikki H atomi esa H₂↑ ga birikadi (H⁺¹ → H⁰).`,
    )
  }
  // 3) Окисление кислородом: 2NO + O₂, 2SO₂ + O₂, 4NO₂ + O₂ (+ 2H₂O), 2BaO + O₂, 4Fe + 3O₂ + 6H₂O.
  const mo = /(2NO|2SO₂|4NO₂|2BaO|4Fe) \+ .*O₂/.exec(route)
  if (mo) {
    const src = mo[1]!.replace(/^\d/, '')
    const X = src === 'NO' || src === 'NO₂' ? 'N' : src === 'SO₂' ? 'S' : src === 'BaO' ? 'O' : 'Fe'
    const st: Record<string, [number, number]> = { NO: [2, 4], 'SO₂': [4, 6], 'NO₂': [4, 5], BaO: [-2, -1], Fe: [0, 3] }
    const [s0, s1] = st[src]!
    // O₂ в центре — рвётся, атомы O уходят к двум частицам слева и справа
    const o1 = k.A('O', [[0.4, -0.6, 2.4], [2.0, -0.6, 0.6], [3.2, -0.6, 0.6], [4.6, -1.15, 0.25]])
    const o2 = k.A('O', [[0.4, 0.6, 2.4], [2.0, 0.6, 0.6], [3.2, 0.6, 0.6], [4.6, 1.15, 0.25]])
    k.S(o1, o2, -1, -1, 3.4)
    const parts = [-1, 1].map((sx) => {
      const cx = sx * 2.4
      if (src === 'Fe') return { x: k.A('Fe', [[0, cx, -0.4]]), all: [] as number[] }
      if (src === 'BaO') {
        const ba = k.A('Ba', [[0, cx + sx * 1.3, -1.4]])
        const o = k.A('O', [[0, cx, -0.3]])
        k.L(ion('Ba', 2), [ba], 0.3, E)
        return { x: o, all: [o] }
      }
      const nO = src === 'NO' ? 1 : 2
      const l = k.bl(X, 'O')
      const x = k.A(X, [[0, cx, -0.3]])
      const os: number[] = []
      for (let i = 0; i < nO; i++) {
        const a = nO === 1 ? -90 : sx < 0 ? [200, 300][i]! : [-20, 240][i]!
        const o = k.A('O', [[0, cx + l * Math.cos(a * deg), -0.3 + l * Math.sin(a * deg)]])
        k.S(x, o, -1, -1)
        os.push(o)
      }
      return { x, all: [x, ...os] }
    })
    // каждый O из O₂ связывается с X своей частицы (у Fe — ион Fe³⁺ остаётся рядом)
    parts.forEach((p, i) => {
      const o = i ? o2 : o1
      const sx = i ? 1 : -1
      if (src !== 'Fe') k.S(p.x, o, 4.2, 4.8)
      const nE = src === 'Fe' ? 3 : src === 'NO₂' ? 1 : src === 'BaO' ? 1 : 2
      for (let j = 0; j < nE; j++) eFly(k, [sx * 2.4 - sx * 0.3, -0.1 + 0.15 * j], [sx * 1.15 + sx * 0.05, 0.45 + 0.12 * j], 0.6, 2.2 + 0.45 * j + 0.2 * i, 3.1 + 0.45 * j + 0.2 * i)
      k.L(`${ox(X === 'O' ? 'O' : X, s0)} → ${ox(X === 'O' ? 'O' : X, s1)}`, [p.x], 3.6, E)
      if (src !== 'BaO' && src !== 'Fe') k.L(src, p.all, 0.3, 3.4)
    })
    k.L('O₂', [o1, o2], 0.3, 3.2)
    k.L(src === 'BaO' ? `${ox('O', 0)} → ${ox('O', -1)} (O₂²⁻)` : `${ox('O', 0)} → ${ox('O', -2)}`, [o1, o2], 3.8, E)
    if (src === 'Fe') k.L('+ H₂O → Fe(OH)₃', [o1, o2], 5.4, E)
    const what = src === 'BaO' ? 'ион O²⁻ и атом O связываются в пероксид-ион O₂²⁻ (O–O)' : `атомы O присоединяются к ${X}`
    return say(
      `${route}: молекула O₂ — окислитель: связь O=O рвётся, ${src} ${src === 'Fe' ? 'отдаёт' : 'отдают'} электроны кислороду (${X === 'O' ? 'O' : X}${s0 === 0 ? '⁰' : ''} → степень ${s1 > 0 ? '+' : ''}${s1}); ${what}.`,
      `${route}: the O₂ molecule is the oxidising agent: the O=O bond breaks and ${src} gives electrons to oxygen (${X === 'O' ? 'O' : X} goes to ${s1 > 0 ? '+' : ''}${s1}); ${src === 'BaO' ? 'the O²⁻ ion and an O atom bond into the peroxide ion O₂²⁻ (O–O)' : `the O atoms join ${X}`}.`,
      `${route}: O₂ molekulasi — oksidlovchi: O=O bogʻ uziladi, ${src} kislorodga elektron beradi (${X === 'O' ? 'O' : X} darajasi ${s1 > 0 ? '+' : ''}${s1} boʻladi); ${src === 'BaO' ? 'O²⁻ ioni va O atomi O₂²⁻ peroksid ioniga (O–O) bogʻlanadi' : `O atomlari ${X} ga birikadi`}.`,
    )
  }
  // 4) Хлор: Cl₂ + OH⁻ / H₂O — диспропорционирование; KClO₃ — один Cl отдаёт 5e⁻ пяти атомам Cl.
  if (/Cl₂/.test(route) && /OH|H₂O/.test(route) && !/MnO₄/.test(route)) {
    const chlorate = /ClO₃/.test(f)
    if (chlorate) {
      const c = k.A('Cl', [[0, 0, 0]])
      const ring = Array.from({ length: 5 }, (_, i) => {
        const a = 90 + 72 * i
        return k.A('Cl', [[0.4, 2.6 * Math.cos(a * deg), 2.6 * Math.sin(a * deg)], [5.0, 3.0 * Math.cos(a * deg), 3.0 * Math.sin(a * deg)]])
      })
      ring.forEach((r, i) => {
        const a = 90 + 72 * i
        eFly(k, [0.45 * Math.cos(a * deg), 0.45 * Math.sin(a * deg)], [2.1 * Math.cos(a * deg), 2.1 * Math.sin(a * deg)], 0.6, 1.0 + 0.45 * i, 1.9 + 0.45 * i)
        k.L(`${ox('Cl', 0)} → Cl⁻`, [r], 2.2 + 0.45 * i, E)
      })
      const l = k.bl('Cl', 'O')
      const os = [0, 1, 2].map((i) => {
        const d = TET[i + 1]!
        const o = k.A('O', [[3.6, d[0] * 2.2, d[1] * 2.2, d[2] * 2.2], [5.0, d[0] * l, d[1] * l, d[2] * l]], 3.6)
        k.S(c, o, 4.8, 5.4)
        return o
      })
      k.L('Cl⁰', [c], 0.3, 3.4)
      k.L(`${ox('Cl', 0)} → ${ox('Cl', 5)} (ClO₃⁻)`, [c, ...os], 5.0, E)
      return say(
        '3Cl₂ + 6KOH → KClO₃ + 5KCl + 3H₂O — диспропорционирование: один атом хлора отдаёт 5 электронов (Cl⁰ → Cl⁺⁵, связывает три O из OH⁻ — ион ClO₃⁻), пять других атомов хлора принимают по одному (Cl⁰ → Cl⁻¹).',
        '3Cl₂ + 6KOH → KClO₃ + 5KCl + 3H₂O — disproportionation: one chlorine atom gives 5 electrons (Cl⁰ → Cl⁺⁵, bonds three O from OH⁻ — the ClO₃⁻ ion), five other chlorine atoms take one each (Cl⁰ → Cl⁻¹).',
        '3Cl₂ + 6KOH → KClO₃ + 5KCl + 3H₂O — disproporsiyalanish: bitta xlor atomi 5 elektron beradi (Cl⁰ → Cl⁺⁵, OH⁻ dan uchta O ni bogʻlaydi — ClO₃⁻ ioni), boshqa beshta xlor atomi bittadan oladi (Cl⁰ → Cl⁻¹).',
      )
    }
    const water2 = /^Cl₂ \+ H₂O/.test(route)
    const l = k.bl('Cl', 'Cl')
    const ca = k.A('Cl', [[0, -l / 2, 0], [2.6, -l / 2, 0], [4.4, -2.6, -0.6]])
    const cb = k.A('Cl', [[0, l / 2, 0]])
    k.S(ca, cb, -1, -1, 3.0)
    // пара связи Cl–Cl уходит к левому Cl (Cl⁻)
    for (const s of [-1, 1]) k.E([[0.6, 0, 0.3 + s * 0.08], [2.4, 0, 0.3 + s * 0.08], [3.4, -l / 2 - 0.45, 0.3 + s * 0.08]], 0.6, 4.2)
    const lo = k.bl('Cl', 'O')
    const o = k.A('O', [[0.4, 3.2, 0.4], [2.4, l / 2 + lo + 0.3, 0.2], [3.6, l / 2 + lo, 0]])
    const h = k.A('H', [[0.4, 3.9, 1.1], [2.4, l / 2 + lo + 1.0, 0.9], [3.6, l / 2 + lo + 0.7, 0.7]])
    k.S(o, h, -1, -1, water2 ? undefined : 4.6)
    k.S(cb, o, 3.2, 3.8)
    let h2 = -1
    if (water2) {
      // второй H воды переходит к Cl⁻ → HCl
      h2 = k.A('H', [[0.4, 3.9, -0.3], [2.4, l / 2 + lo + 1.0, -0.5], [3.4, 0.5, -1.2], [4.6, -2.6 + 0.0, -0.6 - 1.0]])
      k.S(o, h2, -1, -1, 2.9)
      k.S(ca, h2, 4.4, 4.9)
      k.L('H₂O', [o, h, h2], 0.3, 2.8)
    } else {
      // H⁺ уходит ко второму OH⁻ (вода)
      const o2 = k.A('O', [[0.4, 3.4, -2.2], [4.6, 3.2, -1.6], [6.2, 3.4, -2.6]])
      const hh = k.A('H', [[0.4, 4.1, -2.7], [4.6, 3.9, -2.1], [6.2, 4.1, -3.1]])
      k.S(o2, hh, -1, -1)
      k.A('H', [[4.7, l / 2 + lo + 0.7, 0.7], [5.6, 3.0, -0.75]], 4.7)
      hideAt(k, h, 4.7)
      k.L('OH⁻', [o, h], 0.3, 3.0)
      k.L('OH⁻ + H⁺ → H₂O', [o2, hh], 4.8, E)
    }
    k.L('Cl₂', [ca, cb], 0.3, 2.8)
    k.L(`${ox('Cl', 0)} → ${ox('Cl', -1)}`, [ca], 3.6, E)
    k.L(`${ox('Cl', 0)} → ${ox('Cl', 1)} (${water2 ? 'HClO' : 'ClO⁻'})`, [cb, o], 4.0, E)
    void h2
    return say(
      `${route} — диспропорционирование: пара электронов связи Cl–Cl уходит к одному атому (Cl⁰ → Cl⁻¹), второй атом хлора связывается с кислородом ${water2 ? 'воды' : 'иона OH⁻'} (Cl⁰ → Cl⁺¹, ${water2 ? 'HClO' : 'ClO⁻'}). Хлор здесь и окислитель, и восстановитель.`,
      `${route} — disproportionation: the electron pair of the Cl–Cl bond goes to one atom (Cl⁰ → Cl⁻¹), the other chlorine atom bonds to the oxygen of ${water2 ? 'water' : 'the OH⁻ ion'} (Cl⁰ → Cl⁺¹, ${water2 ? 'HClO' : 'ClO⁻'}). Chlorine is both the oxidising and the reducing agent.`,
      `${route} — disproporsiyalanish: Cl–Cl bogʻining elektron jufti bitta atomga oʻtadi (Cl⁰ → Cl⁻¹), ikkinchi xlor atomi ${water2 ? 'suv' : 'OH⁻ ioni'} kislorodi bilan bogʻlanadi (Cl⁰ → Cl⁺¹, ${water2 ? 'HClO' : 'ClO⁻'}). Xlor bu yerda ham oksidlovchi, ham qaytaruvchi.`,
    )
  }
  // 5) Сопропорционирование: 2FeCl₃ + Fe → 3FeCl₂; Na₂O₂ / K₂O₂ + 2M → 2M₂O; FeS + S → FeS₂; CaO + 3C → CaC₂ + CO.
  if (/2FeCl₃ \+ Fe/.test(route)) {
    const fe = k.A('Fe', [[0, 0, 0]])
    const f3 = [-1, 1].map((sx) => k.A('Fe', [[0.4, sx * 3.0, 0.4], [2.0, sx * 2.0, 0]]))
    f3.forEach((x, i) => {
      const sx = i ? 1 : -1
      eFly(k, [sx * 0.4, 0.1], [sx * 1.6, 0.1], 0.6, 2.4 + 0.6 * i, 3.4 + 0.6 * i)
      k.L(ion('Fe', 3), [x], 0.3, 3.4 + 0.6 * i)
      k.L(`${ion('Fe', 3)} → ${ion('Fe', 2)}`, [x], 3.6 + 0.6 * i, E)
    })
    k.L('Fe⁰', [fe], 0.3, 3.0)
    k.L(`${ox('Fe', 0)} → ${ion('Fe', 2)}`, [fe], 4.4, E)
    return say(
      '2FeCl₃ + Fe → 3FeCl₂: атом железа отдаёт два электрона — по одному каждому иону Fe³⁺ (Fe⁰ → Fe⁺², Fe⁺³ → Fe⁺²). Все три иона железа становятся Fe²⁺.',
      '2FeCl₃ + Fe → 3FeCl₂: the iron atom gives two electrons — one to each Fe³⁺ ion (Fe⁰ → Fe⁺², Fe⁺³ → Fe⁺²). All three iron ions become Fe²⁺.',
      '2FeCl₃ + Fe → 3FeCl₂: temir atomi ikki elektron beradi — har bir Fe³⁺ ioniga bittadan (Fe⁰ → Fe⁺², Fe⁺³ → Fe⁺²). Uchala temir ioni Fe²⁺ boʻladi.',
    )
  }
  const mp = /^(Na|K)₂O₂ \+ 2(Na|K)/.exec(route)
  if (mp) {
    const M = mp[1]!
    const l = k.bl('O', 'O')
    const oa = k.A('O', [[0, -l / 2, 0], [3.2, -l / 2, 0], [4.8, -1.2, 0]])
    const ob = k.A('O', [[0, l / 2, 0], [3.2, l / 2, 0], [4.8, 1.2, 0]])
    k.S(oa, ob, -1, -1, 3.6)
    const ms = [-1, 1].map((sx) => k.A(M, [[0.4, sx * 3.2, 1.0], [2.0, sx * 2.6, 0.6], [4.8, sx * 2.5, 0.4]]))
    ms.forEach((m, i) => {
      const sx = i ? 1 : -1
      eFly(k, [sx * 2.2, 0.6], [sx * (l / 2 + 0.3), 0.3], 0.6, 2.2 + 0.5 * i, 3.2 + 0.5 * i)
      k.L(`${ox(M, 0)} → ${ion(M, 1)}`, [m], 3.4 + 0.5 * i, E)
      k.L(`${M}⁰`, [m], 0.3, 3.2 + 0.5 * i)
    })
    k.L('O₂²⁻', [oa, ob], 0.3, 3.4)
    k.L(`${ox('O', -1)} → ${ox('O', -2)}`, [oa], 4.2, E)
    k.L(`${ox('O', -1)} → ${ox('O', -2)}`, [ob], 4.2, E)
    return say(
      `${route}: два атома ${M} отдают по электрону пероксид-иону O₂²⁻ (${M}⁰ → ${M}⁺¹). Связь O–O рвётся, получаются два иона O²⁻ (O⁻¹ → O⁻²).`,
      `${route}: two ${M} atoms give one electron each to the peroxide ion O₂²⁻ (${M}⁰ → ${M}⁺¹). The O–O bond breaks, two O²⁻ ions form (O⁻¹ → O⁻²).`,
      `${route}: ikki ${M} atomi O₂²⁻ peroksid ioniga bittadan elektron beradi (${M}⁰ → ${M}⁺¹). O–O bogʻ uziladi, ikkita O²⁻ ioni hosil boʻladi (O⁻¹ → O⁻²).`,
    )
  }
  if (/^FeS \+ S/.test(route)) {
    const fe = k.A('Fe', [[0, -2.2, 0]])
    const l = k.bl('S', 'S')
    const s1 = k.A('S', [[0, -0.6, 0], [3.0, -0.6, 0], [4.2, -l / 2, 0]])
    const s2 = k.A('S', [[0.4, 2.8, 0.5], [2.4, -0.6 + l + 0.3, 0.2], [4.2, l / 2, 0]])
    eFly(k, [-0.3, 0.1], [-0.6 + l + 0.0, 0.5], 0.6, 2.6, 3.6)
    k.S(s1, s2, 3.8, 4.4)
    k.L(ion('Fe', 2), [fe], 0.3, E)
    k.L('S²⁻', [s1], 0.3, 3.4)
    k.L('S⁰', [s2], 0.3, 3.4)
    k.L(`S₂²⁻ (${ox('S', -1)})`, [s1, s2], 4.4, E)
    return say(
      'FeS + S → FeS₂: ион S²⁻ и атом серы образуют общую пару — получается ион S₂²⁻ (дисульфид): степень окисления серы выравнивается, S⁻² → S⁻¹ и S⁰ → S⁻¹.',
      'FeS + S → FeS₂: the S²⁻ ion and a sulfur atom form a shared pair — the S₂²⁻ (disulfide) ion: the oxidation states even out, S⁻² → S⁻¹ and S⁰ → S⁻¹.',
      'FeS + S → FeS₂: S²⁻ ioni va oltingugurt atomi umumiy juft hosil qiladi — S₂²⁻ (disulfid) ioni: oksidlanish darajalari tenglashadi, S⁻² → S⁻¹ va S⁰ → S⁻¹.',
    )
  }
  if (/CaO \+ 3C/.test(route)) {
    const ca = k.A('Ca', [[0, -2.6, -0.6]])
    const o = k.A('O', [[0, -1.2, -0.6], [3.0, -1.2, -0.6], [4.6, -0.6, 1.6], [6.2, -0.6, 3.0]])
    const c0 = k.A('C', [[0.4, -0.8, 2.4], [2.6, -1.2, 0.6], [4.6, -0.6 + 1.1, 1.6], [6.2, 0.5, 3.0]])
    k.S(o, c0, 3.0, 3.6)
    k.S(o, c0, 3.2, 3.8)
    k.S(o, c0, 3.4, 4.0)
    const lc = k.bl('C', 'C')
    const ca1 = k.A('C', [[0.4, 1.4, -2.2], [3.0, 1.2, -1.2], [4.6, 1.6 - lc / 2, -1.4]])
    const ca2 = k.A('C', [[0.4, 3.0, -1.2], [3.0, 2.6, -1.2], [4.6, 1.6 + lc / 2, -1.4]])
    eFly(k, [-1.0, 0.7], [1.2, -0.9], 0.6, 2.4, 3.4)
    eFly(k, [-1.0, 0.5], [2.6, -0.9], 0.6, 2.8, 3.8)
    for (let s = 0; s < 3; s++) k.S(ca1, ca2, 4.4 + 0.2 * s, 5.0 + 0.2 * s)
    k.L(ion('Ca', 2), [ca], 0.3, E)
    k.L('O²⁻', [o], 0.3, 2.8)
    k.L(`CO↑ (${ox('C', 0)} → ${ox('C', 2)})`, [o, c0], 4.4, E)
    k.L(`C₂²⁻ (${ox('C', 0)} → ${ox('C', -1)})`, [ca1, ca2], 5.0, E)
    return say(
      'CaO + 3C → CaC₂ + CO: один атом углерода забирает кислород (C⁰ → C⁺², CO↑) и отдаёт электроны двум другим атомам C — они связываются тройной связью: ион C₂²⁻ (C⁰ → C⁻¹) с Ca²⁺.',
      'CaO + 3C → CaC₂ + CO: one carbon atom takes the oxygen (C⁰ → C⁺², CO↑) and gives electrons to two other C atoms — they bond with a triple bond: the C₂²⁻ ion (C⁰ → C⁻¹) with Ca²⁺.',
      'CaO + 3C → CaC₂ + CO: bitta uglerod atomi kislorodni oladi (C⁰ → C⁺², CO↑) va boshqa ikki C atomiga elektron beradi — ular uchbogʻ bilan bogʻlanadi: C₂²⁻ ioni (C⁰ → C⁻¹) Ca²⁺ bilan.',
    )
  }
  // 6) Металл + азотная кислота: M → Mⁿ⁺, N⁺⁵ → N⁺⁴ (NO₂) / N⁺² (NO).
  const mn = /^(\d?)(Ag|Zn) \+ \d*HNO₃ → .*(NO₂|NO) /.exec(route + ' ')
  if (mn) {
    const M = mn[2]!
    const v = M === 'Ag' ? 1 : 2
    const no2 = mn[3] === 'NO₂'
    const m = k.A(M, [[0, -2.2, 0]])
    const p = xon(k, 'N', 3, [[0.4, 2.8, 0], [2.0, 1.4, 0], [4.2, 1.4, 0], [6.0, 1.8, 2.6]], undefined, undefined, 0)
    hideAt(k, p.o[0]!, 4.2)
    const oOut = k.A('O', [[4.2, 1.4 + k.bl('N', 'O'), 0], [6.0, 3.2, -2.4]], 4.2)
    const nE = no2 ? 1 : 3
    for (let j = 0; j < nE; j++) eFly(k, [-1.8, 0.2 - 0.2 * j], [1.1, 0.25 - 0.2 * j], 0.6, 2.2 + 0.4 * j, 3.1 + 0.4 * j)
    k.L(`${M}⁰`, [m], 0.3, 3.0)
    k.L(`${ox(M, 0)} → ${ion(M, v)}`, [m], 3.4, E)
    k.L('NO₃⁻', [p.x, ...p.o], 0.3, 3.0)
    k.L(`${no2 ? 'NO₂↑' : 'NO↑'} (${ox('N', 5)} → ${ox('N', no2 ? 4 : 2)})`, [p.x, p.o[1]!, p.o[2]!], 4.4, E)
    k.L('O + 2H⁺ → H₂O', [oOut], 4.6, E)
    return say(
      `${route}: атом ${M} отдаёт электроны азоту нитрат-иона (${M}⁰ → ${M}⁺${v}; N⁺⁵ → N⁺${no2 ? 4 : 2}) — ${no2 ? 'на каждый атом N — 1 e⁻' : 'на каждый атом N — 3 e⁻ (три атома Zn на два N)'}. Атом O иона уходит с H⁺ водой, газ ${no2 ? 'NO₂' : 'NO'} выделяется. Водород азотная кислота с металлами не даёт.`,
      `${route}: the ${M} atom gives electrons to the nitrogen of the nitrate ion (${M}⁰ → ${M}⁺${v}; N⁺⁵ → N⁺${no2 ? 4 : 2}) — ${no2 ? '1 e⁻ per N atom' : '3 e⁻ per N atom (three Zn atoms for two N)'}. An O atom of the ion leaves with H⁺ as water and ${no2 ? 'NO₂' : 'NO'} gas is given off. Nitric acid gives no hydrogen with metals.`,
      `${route}: ${M} atomi nitrat ioni azotiga elektron beradi (${M}⁰ → ${M}⁺${v}; N⁺⁵ → N⁺${no2 ? 4 : 2}) — ${no2 ? 'har bir N atomiga 1 e⁻' : 'har bir N atomiga 3 e⁻ (ikki N ga uchta Zn atomi)'}. Ionning O atomi H⁺ bilan suv boʻlib chiqadi, ${no2 ? 'NO₂' : 'NO'} gazi ajraladi. Nitrat kislota metallar bilan vodorod bermaydi.`,
    )
  }
  // 7) Перманганат / дихромат / манганат / ClO₂: только ключевой переход e⁻.
  const mk = /(KMnO₄ \+ 10FeSO₄|K₂Cr₂O₇ \+ 6KI|K₂MnO₄ \+ Cl₂|ClO₂ \+ 2NaOH \+ H₂O₂)/.exec(route)
  if (mk) {
    const key = mk[1]!
    if (/FeSO₄/.test(key)) {
      const p = xon(k, 'Mn', 4, [[0, 0, -0.2]])
      const fes = Array.from({ length: 5 }, (_, i) => {
        const a = 90 + 72 * i
        return k.A('Fe', [[0.4, 3.0 * Math.cos(a * deg), -0.2 + 3.0 * Math.sin(a * deg)], [2.0, 2.6 * Math.cos(a * deg), -0.2 + 2.6 * Math.sin(a * deg)]])
      })
      fes.forEach((x, i) => {
        const a = 90 + 72 * i
        eFly(k, [2.2 * Math.cos(a * deg), -0.2 + 2.2 * Math.sin(a * deg)], [0.45 * Math.cos((a + 36) * deg), -0.2 + 0.45 * Math.sin((a + 36) * deg)], 0.6, 2.0 + 0.4 * i, 2.9 + 0.4 * i)
        k.L(i === 0 ? `${ion('Fe', 2)} → ${ion('Fe', 3)}` : ion('Fe', 2), [x], i === 0 ? 0.3 : 0.3, i === 0 ? E : 2.9 + 0.4 * i)
        if (i > 0) k.L(ion('Fe', 3), [x], 3.0 + 0.4 * i, E)
      })
      k.L('MnO₄⁻', [p.x, ...p.o], 0.3, 4.4)
      k.L(`${ox('Mn', 7)} → ${ion('Mn', 2)}`, [p.x], 4.6, E)
      return say(
        `${f === 'MnSO₄' ? 'Получение MnSO₄' : 'Получение Fe₂(SO₄)₃'} (KMnO₄ + FeSO₄ в серной кислоте): пять ионов Fe²⁺ отдают по одному электрону (Fe⁺² → Fe⁺³), марганец перманганат-иона принимает пять электронов (Mn⁺⁷ → Mn⁺²). Кислород MnO₄⁻ с H⁺ уходит водой.`,
        `${f === 'MnSO₄' ? 'Making MnSO₄' : 'Making Fe₂(SO₄)₃'} (KMnO₄ + FeSO₄ in sulfuric acid): five Fe²⁺ ions give one electron each (Fe⁺² → Fe⁺³), the manganese of the permanganate ion takes five electrons (Mn⁺⁷ → Mn⁺²). The oxygen of MnO₄⁻ leaves with H⁺ as water.`,
        `${f === 'MnSO₄' ? 'MnSO₄ olinishi' : 'Fe₂(SO₄)₃ olinishi'} (sulfat kislotada KMnO₄ + FeSO₄): beshta Fe²⁺ ioni bittadan elektron beradi (Fe⁺² → Fe⁺³), permanganat ionidagi marganes beshta elektron oladi (Mn⁺⁷ → Mn⁺²). MnO₄⁻ kislorodi H⁺ bilan suv boʻlib chiqadi.`,
      )
    }
    if (/K₂Cr₂O₇/.test(key)) {
      const l = k.bl('Cr', 'O')
      const crs = [-1, 1].map((sx) => k.A('Cr', [[0, sx * 0.95 * l, 0]]))
      const br = k.A('O', [[0, 0, 0.55]])
      for (const c of crs) k.S(c, br, -1, -1)
      crs.forEach((c, i) => {
        const sx = i ? 1 : -1
        for (const a of [sx < 0 ? 180 : 0, -90, 90]) {
          const o = k.A('O', [[0, sx * 0.95 * l + l * Math.cos(a * deg) * (a === 90 ? 0.6 : 1), l * Math.sin(a * deg) * (a === 90 ? 0.5 : 1), a === 90 ? -0.7 * l : 0]])
          k.S(c, o, -1, -1)
        }
      })
      const is = Array.from({ length: 6 }, (_, i) => {
        const a = 60 * i + 30
        // соседние I⁻ (пары 0–1, 2–3, 4–5) сходятся в молекулы I₂
        const a2 = a + (i % 2 ? -14 : 14)
        return k.A('I', [[0.4, 3.1 * Math.cos(a * deg), 3.1 * Math.sin(a * deg)], [4.0, 3.1 * Math.cos(a * deg), 3.1 * Math.sin(a * deg)], [5.4, 3.3 * Math.cos(a2 * deg), 3.3 * Math.sin(a2 * deg)]])
      })
      is.forEach((_, i) => {
        const a = 60 * i + 30
        eFly(k, [2.6 * Math.cos(a * deg), 2.6 * Math.sin(a * deg)], [(Math.cos(a * deg) < 0 ? -1 : 1) * 0.95 * l, 0.25 * (i % 3 - 1)], 0.6, 1.8 + 0.35 * i, 2.7 + 0.35 * i)
      })
      for (let i = 0; i < 6; i += 2) {
        k.S(is[i]!, is[i + 1]!, 5.4, 6.0)
        k.L(`I₂ (${ox('I', -1)} → ${ox('I', 0)})`, [is[i]!, is[i + 1]!], 5.6, E)
      }
      for (const x of is.slice(0, 1)) k.L('I⁻', [x], 0.3, 4.4)
      k.L('Cr₂O₇²⁻', [...crs, br], 0.3, 4.2)
      k.L(`${ox('Cr', 6)} → ${ion('Cr', 3)}`, crs, 4.6, E)
      return say(
        'K₂Cr₂O₇ + 6KI + 7H₂SO₄: шесть ионов I⁻ отдают по электрону (I⁻¹ → I⁰, получаются три молекулы I₂), каждый атом хрома дихромат-иона принимает три электрона (Cr⁺⁶ → Cr⁺³) — образуется Cr₂(SO₄)₃.',
        'K₂Cr₂O₇ + 6KI + 7H₂SO₄: six I⁻ ions give one electron each (I⁻¹ → I⁰, three I₂ molecules form), each chromium atom of the dichromate ion takes three electrons (Cr⁺⁶ → Cr⁺³) — Cr₂(SO₄)₃ forms.',
        'K₂Cr₂O₇ + 6KI + 7H₂SO₄: oltita I⁻ ioni bittadan elektron beradi (I⁻¹ → I⁰, uchta I₂ molekulasi hosil boʻladi), dixromat ionidagi har bir xrom atomi uchta elektron oladi (Cr⁺⁶ → Cr⁺³) — Cr₂(SO₄)₃ hosil boʻladi.',
      )
    }
    if (/K₂MnO₄/.test(key)) {
      const ps = [-1, 1].map((sx) => xon(k, 'Mn', 4, [[0, sx * 2.6, -0.4]]))
      const l = k.bl('Cl', 'Cl')
      const ca = k.A('Cl', [[0.4, -l / 2, 2.6], [2.0, -l / 2, 1.2], [3.6, -l / 2, 1.2], [5.2, -1.6, 2.2]])
      const cb = k.A('Cl', [[0.4, l / 2, 2.6], [2.0, l / 2, 1.2], [3.6, l / 2, 1.2], [5.2, 1.6, 2.2]])
      k.S(ca, cb, -1, -1, 3.8)
      ps.forEach((p, i) => {
        const sx = i ? 1 : -1
        eFly(k, [sx * 2.2, 0.0], [sx * (l / 2 + 0.2), 0.9], 0.6, 2.2 + 0.5 * i, 3.2 + 0.5 * i)
        k.L('MnO₄²⁻', [p.x, ...p.o], 0.3, 3.2)
        k.L(`${ox('Mn', 6)} → ${ox('Mn', 7)} (MnO₄⁻)`, [p.x], 3.4 + 0.5 * i, E)
      })
      k.L('Cl₂', [ca, cb], 0.3, 3.6)
      k.L(`${ox('Cl', 0)} → Cl⁻`, [ca], 4.2, E)
      k.L(`${ox('Cl', 0)} → Cl⁻`, [cb], 4.2, E)
      return say(
        '2K₂MnO₄ + Cl₂ → 2KMnO₄ + 2KCl: каждый манганат-ион MnO₄²⁻ отдаёт один электрон (Mn⁺⁶ → Mn⁺⁷, ион MnO₄⁻), молекула Cl₂ принимает два электрона — связь Cl–Cl рвётся, получаются два иона Cl⁻.',
        '2K₂MnO₄ + Cl₂ → 2KMnO₄ + 2KCl: each manganate ion MnO₄²⁻ gives one electron (Mn⁺⁶ → Mn⁺⁷, the MnO₄⁻ ion), the Cl₂ molecule takes two electrons — the Cl–Cl bond breaks, two Cl⁻ ions form.',
        '2K₂MnO₄ + Cl₂ → 2KMnO₄ + 2KCl: har bir MnO₄²⁻ manganat ioni bitta elektron beradi (Mn⁺⁶ → Mn⁺⁷, MnO₄⁻ ioni), Cl₂ molekulasi ikki elektron oladi — Cl–Cl bogʻ uziladi, ikkita Cl⁻ ioni hosil boʻladi.',
      )
    }
    // ClO₂ + H₂O₂: пероксид отдаёт 2e⁻ двум ClO₂ (Cl⁺⁴ → Cl⁺³), его O → O₂↑ (O⁻¹ → O⁰).
    const ps = [-1, 1].map((sx) => xon(k, 'Cl', 2, [[0, sx * 2.6, -0.6]], undefined, undefined, sx < 0 ? 210 : -30))
    const l = k.bl('O', 'O')
    const oa = k.A('O', [[0.4, -l / 2, 1.0], [3.4, -l / 2, 1.0], [5.6, -l / 2, 3.0]])
    const ob = k.A('O', [[0.4, l / 2, 1.0], [3.4, l / 2, 1.0], [5.6, l / 2, 3.0]])
    const ha = k.A('H', [[0.4, -l / 2 - 0.6, 1.8], [2.0, -l / 2 - 0.6, 1.8], [3.4, -2.2, 2.8]], undefined, 4.0)
    const hb = k.A('H', [[0.4, l / 2 + 0.6, 1.8], [2.0, l / 2 + 0.6, 1.8], [3.4, 2.2, 2.8]], undefined, 4.0)
    k.S(oa, ob, -1, -1)
    k.S(oa, ob, 3.8, 4.4)
    k.S(oa, ha, -1, -1, 2.2)
    k.S(ob, hb, -1, -1, 2.2)
    ps.forEach((p, i) => {
      const sx = i ? 1 : -1
      eFly(k, [sx * l / 2, 0.7], [sx * 2.3, -0.3], 0.6, 2.4 + 0.5 * i, 3.4 + 0.5 * i)
      k.L('ClO₂', [p.x, ...p.o], 0.3, 3.4)
      k.L(`${ox('Cl', 4)} → ${ox('Cl', 3)} (ClO₂⁻)`, [p.x], 3.6 + 0.5 * i, E)
    })
    k.L('H₂O₂', [oa, ob, ha, hb], 0.3, 2.2)
    k.L('H⁺ → OH⁻ (H₂O)', [ha, hb], 2.6, 4.0)
    k.L(`O₂↑ (${ox('O', -1)} → ${ox('O', 0)})`, [oa, ob], 4.6, E)
    return say(
      '2ClO₂ + 2NaOH + H₂O₂ → 2NaClO₂ + O₂ + 2H₂O: пероксид водорода отдаёт два электрона — по одному каждой молекуле ClO₂ (Cl⁺⁴ → Cl⁺³, ион ClO₂⁻); его атомы кислорода соединяются в O₂↑ (O⁻¹ → O⁰), протоны H⁺ уходят к OH⁻ (вода).',
      '2ClO₂ + 2NaOH + H₂O₂ → 2NaClO₂ + O₂ + 2H₂O: hydrogen peroxide gives two electrons — one to each ClO₂ molecule (Cl⁺⁴ → Cl⁺³, the ClO₂⁻ ion); its oxygen atoms join into O₂↑ (O⁻¹ → O⁰), the H⁺ protons go to OH⁻ (water).',
      '2ClO₂ + 2NaOH + H₂O₂ → 2NaClO₂ + O₂ + 2H₂O: vodorod peroksid ikki elektron beradi — har bir ClO₂ molekulasiga bittadan (Cl⁺⁴ → Cl⁺³, ClO₂⁻ ioni); uning kislorod atomlari O₂↑ ga birikadi (O⁻¹ → O⁰), H⁺ protonlari OH⁻ ga oʻtadi (suv).',
    )
  }
  return null
}

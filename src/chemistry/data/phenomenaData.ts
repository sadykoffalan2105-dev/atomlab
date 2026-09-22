/**
 * ATOMLAB — макроскопические явления, которые сцены называют числом: толщины естественных
 * оксидных плёнок и температуры пламени. Это НЕ табличные константы вещества — у каждого
 * числа диапазон, условия и источник; сцена подписывает диапазон, а не «точное» значение.
 */

export type RangeDatum = {
  readonly id: string
  /** Что измерено — подпись для урока (слова идут в панель, не в 3D). */
  readonly what: string
  readonly min: number
  readonly max: number
  /** Верхняя граница в особых условиях (старение во влажном воздухе и т. п.), если есть. */
  readonly extendedMax?: number
  readonly unit: 'нм' | '°C'
  readonly conditions: string
  readonly source: string
  /** Диапазон — обзорная оценка, а не одно прямое измерение. */
  readonly estimated?: boolean
  readonly note?: string
}

/** Естественные оксидные плёнки на металле/полупроводнике при 25 °C на воздухе. */
export const NATIVE_OXIDE_FILMS: Readonly<Record<'al' | 'si', RangeDatum>> = {
  // Jeurgens, Sloof, Tichelaar & Mittemeijer, Phys. Rev. B 62 (2000) 4707 — аморфная плёнка устойчива до ~4 нм;
  // Evertsson et al., Appl. Surf. Sci. 349 (2015) 826 — толщина нативного оксида на Al и сплавах
  al: {
    id: 'al',
    what: 'аморфный Al₂O₃ на алюминии',
    min: 2,
    max: 4,
    extendedMax: 5,
    unit: 'нм',
    conditions: 'воздух, 25 °C; до ~5 нм при старении во влажном воздухе; ~10 нм — только при нагреве',
    source:
      'Jeurgens, Sloof, Tichelaar & Mittemeijer, Phys. Rev. B 62 (2000) 4707; Evertsson et al., Appl. Surf. Sci. 349 (2015) 826',
    note: 'плёнка АМОРФНАЯ — это не корунд: корунд кристаллизуется из расплава (горение, термит) или выше ~1000 °C',
  },
  // Morita, Ohmi, Hasegawa, Kawakami & Ohwada, J. Appl. Phys. 68 (1990) 1272 — рост нативного оксида на Si
  si: {
    id: 'si',
    what: 'нативный аморфный SiO₂ на кремнии',
    min: 1,
    max: 2,
    unit: 'нм',
    conditions: 'воздух, 25 °C, от часов до недель после очистки поверхности',
    source: 'Morita, Ohmi, Hasegawa, Kawakami & Ohwada, J. Appl. Phys. 68 (1990) 1272',
    note: 'толстый оксид (сотни нм) растят нагревом в O₂ или H₂O (модель Дила — Гроува) — он тоже аморфный',
  },
}

/** Реальные температуры пламени (ниже термодинамического потолка volatilizationK из crystalData). */
export const FLAME_TEMPERATURES: Readonly<Record<'mg_ribbon_air', RangeDatum>> = {
  mg_ribbon_air: {
    id: 'mg_ribbon_air',
    what: 'горящая магниевая лента на воздухе',
    min: 2200,
    max: 3100,
    unit: '°C',
    conditions: 'воздух, 1 атм; зависит от толщины ленты, обдува и метода измерения (пирометрия, спектры)',
    source:
      'Glassman & Yetter, «Combustion», 4th ed. (2008) — потолок ≈ 3430 K; Dreizin, Prog. Energy Combust. Sci. 26 (2000) 57 — обзор горения металлов',
    estimated: true,
    note: 'ниже потолка улетучивания MgO (≈ 3430 K) из-за азота воздуха и потерь излучением; белый свет — тепловое излучение частиц MgO',
  },
}

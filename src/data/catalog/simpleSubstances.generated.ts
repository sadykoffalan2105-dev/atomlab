// Сгенерировано scripts/textbook-inventory/gen-simple-substances.mts — не редактировать вручную.
// Простые вещества (одноатомная запись в уравнении: Zn, Fe, C, S, P …) из реакций учебников «Химия» 7–11.

export type BookSimpleSubstanceRow = {
  symbol: string
  z: number
  /** Классы, в реакциях которых стоит вещество. */
  grades: readonly (7 | 8 | 9 | 10 | 11)[]
  /** Первая страница учебника по классам. */
  firstPage: Readonly<Partial<Record<7 | 8 | 9 | 10 | 11, number>>>
}

export const BOOK_SIMPLE_SUBSTANCE_ROWS: readonly BookSimpleSubstanceRow[] = [
  {"symbol":"Li","z":3,"grades":[7,8,9,11],"firstPage":{"7":83,"8":82,"9":102,"11":99}},
  {"symbol":"Be","z":4,"grades":[7],"firstPage":{"7":138}},
  {"symbol":"C","z":6,"grades":[7,8,9,10,11],"firstPage":{"7":69,"8":16,"9":48,"10":27,"11":101}},
  {"symbol":"Na","z":11,"grades":[7,8,9,10,11],"firstPage":{"7":70,"8":16,"9":72,"10":14,"11":140}},
  {"symbol":"Mg","z":12,"grades":[7,8,9,11],"firstPage":{"7":69,"8":80,"9":61,"11":113}},
  {"symbol":"Al","z":13,"grades":[7,8,9,11],"firstPage":{"7":69,"8":83,"9":71,"11":106}},
  {"symbol":"Si","z":14,"grades":[9],"firstPage":{"9":61}},
  {"symbol":"P","z":15,"grades":[7,8,9],"firstPage":{"7":70,"8":16,"9":112}},
  {"symbol":"S","z":16,"grades":[7,8,9,11],"firstPage":{"7":70,"8":16,"9":48,"11":32}},
  {"symbol":"K","z":19,"grades":[7,8,9,10,11],"firstPage":{"7":94,"8":21,"9":102,"10":129,"11":79}},
  {"symbol":"Ca","z":20,"grades":[7,8,9],"firstPage":{"7":71,"8":13,"9":48}},
  {"symbol":"Cr","z":24,"grades":[7,9],"firstPage":{"7":107,"9":71}},
  {"symbol":"Mn","z":25,"grades":[9,11],"firstPage":{"9":153,"11":142}},
  {"symbol":"Fe","z":26,"grades":[7,8,9,11],"firstPage":{"7":70,"8":16,"9":49,"11":32}},
  {"symbol":"Ni","z":28,"grades":[7],"firstPage":{"7":138}},
  {"symbol":"Cu","z":29,"grades":[7,8,9,10,11],"firstPage":{"7":71,"8":16,"9":49,"10":37,"11":112}},
  {"symbol":"Zn","z":30,"grades":[7,8,9,10],"firstPage":{"7":67,"8":14,"9":71,"10":54}},
  {"symbol":"Rb","z":37,"grades":[7],"firstPage":{"7":118}},
  {"symbol":"Ag","z":47,"grades":[7,8,9,10,11],"firstPage":{"7":73,"8":168,"9":137,"10":134,"11":144}},
  {"symbol":"Cd","z":48,"grades":[11],"firstPage":{"11":150}},
  {"symbol":"Sn","z":50,"grades":[9],"firstPage":{"9":50}},
  {"symbol":"Xe","z":54,"grades":[8],"firstPage":{"8":121}},
  {"symbol":"Ba","z":56,"grades":[7],"firstPage":{"7":108}},
  {"symbol":"W","z":74,"grades":[7,9],"firstPage":{"7":117,"9":71}},
  {"symbol":"Pt","z":78,"grades":[8],"firstPage":{"8":167}},
  {"symbol":"Au","z":79,"grades":[8,9],"firstPage":{"8":167,"9":138}},
  {"symbol":"Hg","z":80,"grades":[8,9],"firstPage":{"8":82,"9":71}},
  {"symbol":"Pb","z":82,"grades":[8,9],"firstPage":{"8":166,"9":56}},
]

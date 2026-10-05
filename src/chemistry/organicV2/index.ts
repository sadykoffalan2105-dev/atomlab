/**
 * Органика v2 — движок Конструктора (чистый TS, без React).
 *
 * Ученик рисует только скелет (тяжёлые атомы и связи 1/2/3), всё остальное считает движок:
 *  - graph.ts      — модель SkeletonGraph, автодобавление H по валентности, проверка валентности, формула Хилла;
 *  - smiles.ts     — разбор и запись SMILES (Кекуле, циклы, ветви, заряды, цис/транс);
 *  - canonical.ts  — каноническая форма графа и «это та же молекула?»;
 *  - naming.ts     — школьный намер ИЮПАК (RU по Kimyo 10, EN, UZ) + тривиальные синонимы (trivial.ts);
 *  - classify.ts   — класс вещества, полуструктурная формула, степень углерода;
 *  - isomers.ts    — перечисление структурных изомеров (алканы, алкены + циклоалканы, спирты + эфиры);
 *  - embed3d.ts    — быстрое 3D собранного (VSEPR + мини-силовое поле);
 *  - registry.ts   — сопоставление собранного с молекулой реестра по канонической строке.
 */
export type { BondOrder, SkeletonAtom, SkeletonBond, SkeletonGraph, Mol, ValenceIssue } from './graph'
export { toMol, fromMol, checkValence, implicitH, allowedValences, atomLabel, hillFormula, subscriptDigits, withExplicitHydrogens, bondKey } from './graph'
export { parseSmiles, writeSmiles, toSmiles, SmilesError } from './smiles'
export type { CanonicalResult } from './canonical'
export { canonicalizeMol, canonicalCode, sameMolecule, sameConstitution } from './canonical'
export type { Lang, MoleculeName } from './naming'
export { nameMol, nameSkeleton, systematicNamesRu } from './naming'
export { trivialNamesFor } from './trivial'

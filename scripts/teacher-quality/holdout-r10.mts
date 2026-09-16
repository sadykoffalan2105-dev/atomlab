/**
 * HOLDOUT r10 (fresh generalization check for the local AI teacher, round 10 — after the textbook inventory was added
 * to the knowledge base as the "book index").
 *
 * 50 NEW realistic student questions, none of them in goldQuestions.mts, holdout-r3..r9.mts or selfcheck-r6/r7/r9.mts
 * (grepped). Grades 7–11:
 *   • textbook-index questions: formula of a substance (5), name of a formula (3), products of a reaction (5),
 *     reactions / substances of a § (3), where in the textbook (5);
 *   • 5 questions about substances added to the catalog today (tb_* textbook substances: K₂MnO₄, CaC₂, COCl₂,
 *     CuSO₄·5H₂O, CaH₂) — h10-05, h10-07, h10-17, h10-20, h10-22;
 *   • definitions (6), properties (5), how (4), why (5), compare (2), example (2), calc (1);
 *   • 2 English + 1 Uzbek (h10-48..50).
 * Expected facts were grepped in src/data/kb/corpus (chunk / book-index ids in `source`). mustMention is deliberately
 * loose (autoScore only); the real verdicts are in .smoke/answer-quality/judge-r10.md.
 *
 * Same code paths as runAnswers.mts (chat = composeLocalTeacherReply, voice = TrainingModeEngine.answer with
 * smartAi=false, ctx lesson); output .smoke/answer-quality/answers-<tag>.json in the same format (hits: the first 6
 * retrieved fragments + up to 3 book-index fragments):
 *
 *   npx tsx scripts/teacher-quality/holdout-r10.mts [--tag r10] [--modes chat,voice]
 *   npx tsx scripts/teacher-quality/autoScore.mts --tag r10 --questions holdout-r10.mts#HOLDOUT_R10 --gold-tag <gold tag>
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GoldQuestion } from './goldQuestions.mts'
import { preloadKnowledge, getKnowledgeStatus } from '../../src/learn/kb/index.ts'
import { composeLocalTeacherReply } from '../../src/learn/learnTeacherRouter.ts'
import { retrieveForTeacher, type TeacherKnowledgeHit } from '../../src/learn/teacherKnowledge.ts'
import { isSubstantiveQuestion, resolveTurn } from '../../src/learn/brain/dualMode/followUps.ts'
import { TrainingModeEngine } from '../../src/learn/brain/dualMode/trainingModeEngine.ts'
import type { LearnLocalAssistantContext } from '../../src/learn/learnLocalAssistant.ts'

export const HOLDOUT_R10: GoldQuestion[] = [
  /* ------------------------------------------------------------ formula of a substance */
  {
    id: 'h10-01', grade: 7, locale: 'ru', type: 'formula', lesson: 'c6-s06',
    source: 'book-g8-sub-ca_oh_2 (гашеная известь Ca(OH)₂, Kimyo 8 §2 стр. 12–13); Kimyo 7 §6.6',
    question: 'Какая формула у гашёной извести?',
    mustMention: ['re:Ca\\(OH\\)2'],
  },
  {
    id: 'h10-02', grade: 9, locale: 'ru', type: 'formula', lesson: 'c7-s04',
    source: 'Kimyo 9 §11 «Угольная кислота и свойства карбонатов» (book-g9-sub-h2co3)',
    question: 'Напиши формулу угольной кислоты',
    mustMention: ['re:H2CO3'],
  },
  {
    id: 'h10-03', grade: 10, locale: 'ru', type: 'formula', lesson: 'c3-s01',
    source: 'Kimyo 10 §3.1 (метанол CH₃OH / CH₄O)',
    question: 'Какая формула у метанола?',
    mustMention: ['re:CH3OH|CH4O|CH3[–-]OH'],
  },
  {
    id: 'h10-04', grade: 11, locale: 'ru', type: 'formula', lesson: 'c3-s03',
    source: 'Kimyo 11 / Kimyo 9 §35 (гидроксид железа(III) Fe(OH)₃)',
    question: 'Какая формула у гидроксида железа(III)?',
    mustMention: ['re:Fe\\(OH\\)3'],
  },
  {
    id: 'h10-05', grade: 9, locale: 'ru', type: 'formula', lesson: 'c2-s06',
    source: 'TODAY tb_k2mno4; Kimyo 9 §33 «Марганец» стр. 154 (book-g9-sub-k2mno4)',
    question: 'Какая формула манганата калия?',
    mustMention: ['re:K2MnO4'],
    mustNotMention: ['re:KMnO4\\b(?!.*K2MnO4)'],
  },
  /* ------------------------------------------------------------------- name of a formula */
  {
    id: 'h10-06', grade: 8, locale: 'ru', type: 'formula', lesson: 'c4-s10',
    source: 'Kimyo 8 §31 «Кислородные соединения серы» (оксид серы(VI) SO₃)',
    question: 'Как называется вещество SO3?',
    mustMention: ['оксид серы|серный ангидрид', 're:\\(VI\\)|серный ангидрид|шестивалентн'],
    mustNotMention: ['re:оксид серы\\s*\\(IV\\)'],
  },
  {
    id: 'h10-07', grade: 9, locale: 'ru', type: 'formula', lesson: 'c7-s04',
    source: 'TODAY tb_cac2; Kimyo 9 §8 стр. 43, Kimyo 7 §2.10, Kimyo 10 §2.14',
    question: 'Что за вещество CaC2?',
    mustMention: ['карбид кальция'],
  },
  {
    id: 'h10-08', grade: 10, locale: 'ru', type: 'formula', lesson: 'c2-s04',
    source: 'Kimyo 10 §2.4 (CH₄ + Cl₂ → CH₃Cl + HCl, хлорметан)',
    question: 'Как называется CH3Cl?',
    mustMention: ['хлорметан|метилхлорид|хлористый метил'],
  },
  /* ------------------------------------------------------------------ products of a reaction */
  {
    id: 'h10-09', grade: 8, locale: 'ru', type: 'reaction', lesson: 'c4-s07',
    source: 'Kimyo 8 §27 стр. 115 (g8-p27-t03: AgNO3 + HCl = AgCl↓ + HNO3)',
    question: 'Что получится, если к раствору нитрата серебра прилить соляную кислоту?',
    mustMention: ['хлорид серебра|AgCl', 'азотн|HNO3'],
  },
  {
    id: 'h10-10', grade: 7, locale: 'ru', type: 'reaction', lesson: 'c6-s04',
    source: 'Kimyo 7 §6.4 стр. 138 (2Na + 2H₂O = 2NaOH + H₂↑)',
    question: 'Что образуется при взаимодействии натрия с водой?',
    mustMention: ['гидроксид натрия|NaOH|щелоч', 'водород|H2'],
  },
  {
    id: 'h10-11', grade: 7, locale: 'ru', type: 'reaction', lesson: 'c4-s10',
    source: 'Kimyo 7 §4.10 (CaCO₃ → CaO + CO₂↑); Kimyo 8 §34',
    question: 'Что получится при разложении карбоната кальция?',
    mustMention: ['оксид кальция|CaO|негашен', 'углекислый газ|CO2|оксид углерода'],
  },
  {
    id: 'h10-12', grade: 10, locale: 'ru', type: 'reaction', lesson: 'c2-s08',
    source: 'Kimyo 10 §2.8 стр. 59 (CH₂=CH₂ + H₂ → CH₃-CH₃)',
    question: 'Что получится при реакции этилена с водородом?',
    mustMention: ['этан|C2H6|re:CH3[–-]CH3'],
  },
  {
    id: 'h10-13', grade: 9, locale: 'ru', type: 'reaction', lesson: 'c2-s07',
    source: 'Kimyo 7 §2.13/§2.14 (2Fe + 3Cl₂ → 2FeCl₃); Kimyo 9 §34 «Железо»',
    question: 'Что образуется при горении железа в хлоре?',
    mustMention: ['хлорид железа|FeCl3'],
    mustNotMention: ['re:FeCl2(?!.*FeCl3)', 'Fe3O4|окалин'],
  },
  /* -------------------------------------------------------------- reactions / substances of a § */
  {
    id: 'h10-14', grade: 8, locale: 'ru', type: 'reaction', lesson: 'c4-s09',
    source: 'book-g8-sec-39 (§ 39 «Азотная кислота», стр. 164–173, 26 реакций)',
    question: 'Какие реакции есть в § 39?',
    mustMention: ['re:HNO3', 're:§\\s?39|азотн'],
  },
  {
    id: 'h10-15', grade: 10, locale: 'ru', type: 'reaction', lesson: 'c2-s14',
    source: 'book-g10-sec-2_14 (тема 2.14 «Получение, свойства, применение алкинов»)',
    question: 'Какие реакции разбираются в теме 2.14?',
    mustMention: ['re:C2H2|HC≡CH|CH≡CH|CaC2'],
  },
  {
    id: 'h10-16', grade: 11, locale: 'ru', type: 'location', lesson: 'c3-s03',
    source: 'book-g11-sec-11 (§ 11 «Гидролиз солей и среда раствора»)',
    question: 'Какие вещества упоминаются в § 11?',
    mustMention: ['re:§\\s?11|гидролиз', 'хлорид|карбонат|сульфат|ацетат|нитрат'],
  },
  /* --------------------------------------------------------------------- where in the textbook */
  {
    id: 'h10-17', grade: 9, locale: 'ru', type: 'location', lesson: 'c7-s04',
    source: 'TODAY tb_cocl2; book-g9-sub-cocl2 (Kimyo 9 §10 «Важнейшие соединения углерода»), Kimyo 11 §26',
    question: 'Где в учебнике говорится о фосгене?',
    mustMention: ['re:§\\s?10|§\\s?26'],
  },
  {
    id: 'h10-18', grade: 7, locale: 'ru', type: 'location', lesson: 'c4-s08',
    source: 'Kimyo 7 §4.8 «Озон и его применение» стр. 102',
    question: 'В каком параграфе рассказывается про озон?',
    mustMention: ['re:§\\s?4\\.8'],
  },
  {
    id: 'h10-19', grade: 11, locale: 'ru', type: 'location', lesson: 'c2-s02',
    source: 'Kimyo 11 §6 «Закон Авогадро. Смеси газов» стр. 34; Kimyo 8 §25 стр. 102',
    question: 'На какой странице объясняется закон Авогадро?',
    mustMention: ['re:стр\\.\\s?(3[4-8]|10[2-8])'],
  },
  {
    id: 'h10-20', grade: 8, locale: 'ru', type: 'location', lesson: 'c4-s10',
    source: 'TODAY tb_cuso4_5h2o; book-g8-sub-cuso4_5h2o (Kimyo 8 §32), Kimyo 7 §6.4 стр. 139, Kimyo 9 §28',
    question: 'Где в учебнике упоминается медный купорос?',
    mustMention: ['re:§\\s?(32|6\\.4|28)'],
  },
  {
    id: 'h10-21', grade: 10, locale: 'ru', type: 'location', lesson: 'c3-s03',
    source: 'Kimyo 10 §3.3 «Многоатомные спирты» стр. 115, §3.4 «Этиленгликоль. Свойства глицерина» стр. 119',
    question: 'В какой теме учебника изучают глицерин?',
    mustMention: ['re:§\\s?3\\.[34]'],
  },
  /* --------------------------------------------------------------- today: definition of a new substance */
  {
    id: 'h10-22', grade: 9, locale: 'ru', type: 'definition', lesson: 'c1-s02',
    source: 'TODAY tb_cah2 (CaH₂); Kimyo 9 §23 «Кальций и магний», §19; Kimyo 8 §1',
    question: 'Что такое гидрид кальция?',
    mustMention: ['CaH2|re:CaH₂', 'водород|кальци'],
  },
  /* ------------------------------------------------------------------------------- definitions */
  {
    id: 'h10-23', grade: 7, locale: 'ru', type: 'definition', lesson: 'c1-s07',
    source: 'Kimyo 7 §1.7 (g7-c1-s07-t02: «Сублимация – это явление прямого перехода из твердого состояния в газообразное»)',
    question: 'Что такое сублимация?',
    mustMention: ['тверд', 'газообразн'],
  },
  {
    id: 'h10-24', grade: 8, locale: 'ru', type: 'definition', lesson: 'c3-s06',
    source: 'Kimyo 8 §19 (g8-p19-d01: «атом элемента или ион, отдавший электрон, называется восстановителем»)',
    question: 'Что такое восстановитель?',
    mustMention: ['отда', 'электрон'],
    mustNotMention: ['re:восстановител\\S*\\s*[—–-]?\\s*(это\\s+)?(атом|ион|вещество)[^.]*(присоедин|принима)'],
  },
  {
    id: 'h10-25', grade: 11, locale: 'ru', type: 'definition', lesson: 'c4-s08',
    source: 'Kimyo 11 §19 (g11-c4-s08-t01: «Нормальная концентрация — количество эквивалентов данного вещества в 1 литре раствора»)',
    question: 'Что такое нормальная концентрация?',
    mustMention: ['эквивалент', 'литр|1 л|объем|объём'],
  },
  {
    id: 'h10-26', grade: 10, locale: 'ru', type: 'definition', lesson: 'c1-s04',
    source: 'Kimyo 10 §1.4 (g10-c1-s04-t02), §2.2 (g10-c2-s02-t02: «разным строением углеродной цепи … структурной изомерией»)',
    question: 'Что такое структурная изомерия?',
    mustMention: ['строени|скелет|цеп|порядок'],
  },
  {
    id: 'h10-27', grade: 11, locale: 'ru', type: 'definition', lesson: 'c4-s02',
    source: 'Kimyo 11 §13 (g11-c4-s02-t01: «Способность веществ растворяться в растворителях называется растворимостью»)',
    question: 'Что такое растворимость?',
    mustMention: ['способност', 'растворят'],
  },
  {
    id: 'h10-28', grade: 10, locale: 'ru', type: 'definition', lesson: 'c3-s09',
    source: 'Kimyo 10 §3.9 (g10-c3-s09-d01: оксосоединения с карбонильной группой, альдегиды)',
    question: 'Что такое альдегиды?',
    mustMention: ['карбонил|альдегидн|re:C(H)?=O|CHO|оксосоединени'],
  },
  /* -------------------------------------------------------------------------------- properties */
  {
    id: 'h10-29', grade: 7, locale: 'ru', type: 'property', lesson: 'c4-s03',
    source: 'Kimyo 7 §4.3 (g7-c4-s03-t02: «кислород представляет собой бесцветный газ без запаха и вкуса»)',
    question: 'Какими физическими свойствами обладает кислород?',
    mustMention: ['бесцветн|без цвета', 'запах'],
  },
  {
    id: 'h10-30', grade: 9, locale: 'ru', type: 'property', lesson: 'c2-s01',
    source: 'Kimyo 9 §26 (g9-p26-t01: «Алюминий – твердый металл серебристо белого цвета. Плотность 2698 …»)',
    question: 'Какие физические свойства у алюминия?',
    mustMention: ['серебрист', 'плотност|легк|пластичн|проводим|проводник|плав'],
  },
  {
    id: 'h10-31', grade: 10, locale: 'ru', type: 'property', lesson: 'c2-s04',
    source: 'Kimyo 10 §2.4 «Химические свойства и применение алканов» (горение, галогенирование CH₄ + Cl₂)',
    question: 'Какие химические свойства характерны для метана?',
    mustMention: ['горени|горит|замещени|хлорирован|галогенирован|разлож'],
  },
  {
    id: 'h10-32', grade: 8, locale: 'ru', type: 'property', lesson: 'c4-s03',
    source: 'card-compound-tb_cl2 («жёлто-зелёный ядовитый газ с резким запахом»); Kimyo 8 §23 «Хлор»',
    question: 'Какого цвета хлор?',
    mustMention: ['желто-зелен|жёлто-зелён|зелен'],
  },
  {
    id: 'h10-33', grade: 8, locale: 'ru', type: 'property', lesson: 'c3-s04',
    source: 'Kimyo 8 §17 (g8-p17-t03/t04: атомная решётка — алмаз, кремний; прочность, твёрдость, тугоплавкость)',
    question: 'Какими свойствами обладают вещества с атомной кристаллической решёткой?',
    mustMention: ['тверд|прочн|тугоплав|высок\\S* температур|нераствор'],
  },
  /* ------------------------------------------------------------------------------------- how */
  {
    id: 'h10-34', grade: 9, locale: 'ru', type: 'how', lesson: 'c1-s02',
    source: 'Kimyo 9 §24 (g9-p24-t04: «Она устраняется при добавлении соды или фосфата натрия»)',
    question: 'Как устранить постоянную жёсткость воды?',
    mustMention: ['сод|Na2CO3|фосфат|ионит|катионит'],
    mustNotMention: ['re:^[^.]*кипячени[^.]*устран'],
  },
  {
    id: 'h10-35', grade: 8, locale: 'ru', type: 'how', lesson: 'c4-s09',
    source: 'Kimyo 8 §39 (g8-p39-t01: «для получения азотной кислоты в лабораторных условиях: NaNO3 + H2SO4 = NaHSO4 + HNO3»)',
    question: 'Как получают азотную кислоту в лаборатории?',
    mustMention: ['нитрат натрия|NaNO3|селитр', 'серн|H2SO4'],
  },
  {
    id: 'h10-36', grade: 10, locale: 'ru', type: 'how', lesson: 'c3-s12',
    source: 'Kimyo 10 §3.12 «Карбоновые кислоты. Получение и свойства» (окисление ацетальдегида / брожение)',
    question: 'Как получают уксусную кислоту?',
    mustMention: ['окислен|брожени|ацетальдегид|уксусного альдегида|CH3CHO|бутан'],
  },
  {
    id: 'h10-37', grade: 11, locale: 'ru', type: 'how', lesson: 'c3-s03',
    source: 'Kimyo 11 §11 «Гидролиз солей и среда раствора» (индикаторы, гидролиз)',
    question: 'Как определить среду раствора соли?',
    mustMention: ['индикатор|лакмус|фенолфталеин|метилоранж|гидролиз'],
  },
  /* ------------------------------------------------------------------------------------- why */
  {
    id: 'h10-38', grade: 8, locale: 'ru', type: 'why', lesson: 'c4-s02',
    source: 'Kimyo 8 §21 (g8-p21-t02: «Фтор — элемент с самым высоким значением электроотрицательности»), §22',
    question: 'Почему фтор — самый активный из галогенов?',
    mustMention: ['электроотрицательн|радиус|присоедин'],
  },
  {
    id: 'h10-39', grade: 10, locale: 'ru', type: 'why', lesson: 'c2-s01',
    source: 'Kimyo 10 §1.5 (g10-c1-s05-t03: «Насыщенный (содержит только одинарную связь)»), org-deep-alkanes',
    question: 'Почему алканы называют насыщенными углеводородами?',
    mustMention: ['одинарн|предельн|насыщ\\S* водород|максимальн'],
  },
  {
    id: 'h10-40', grade: 11, locale: 'ru', type: 'why', lesson: 'c3-s03',
    source: 'Kimyo 11 §11 (гидролиз соли слабой кислоты и сильного основания → OH⁻); misc-neutralization-always-7',
    question: 'Почему раствор карбоната натрия имеет щелочную среду?',
    mustMention: ['гидролиз', 'OH|гидроксид|слаб'],
  },
  {
    id: 'h10-41', grade: 9, locale: 'ru', type: 'why', lesson: 'c7-s04',
    source: 'Kimyo 9 §10 (g9-p10-t04: «Углекислый газ не поддерживает горения»); inorg-carbonates-co2 («тяжелее воздуха»)',
    question: 'Почему углекислым газом тушат огонь?',
    mustMention: ['не поддерживает горени|не горит', 'тяжелее'],
  },
  {
    id: 'h10-42', grade: 9, locale: 'ru', type: 'why', lesson: 'c5-s02',
    source: 'lab-safety / g9-sulfuric («кислоту в воду, не наоборот») — причина (сильное разогревание, разбрызгивание) в базе не записана',
    question: 'Почему при разбавлении серной кислоты льют кислоту в воду, а не наоборот?',
    mustMention: ['тепл|нагрева|разогрев|разбрызг|вскипа|точной причины'],
  },
  /* ---------------------------------------------------------------------------------- compare */
  {
    id: 'h10-43', grade: 11, locale: 'ru', type: 'compare', lesson: 'c4-s07',
    source: 'Kimyo 11 §15 (процентная концентрация — масса вещества в 100 г раствора), §18 (молярная — моль в 1 л)',
    question: 'Чем молярная концентрация отличается от процентной?',
    mustMention: ['моль', 'масс|процент|100 г', 'объем|объём|литр|1 л'],
  },
  {
    id: 'h10-44', grade: 8, locale: 'ru', type: 'compare', lesson: 'c1-s05',
    source: 'Kimyo 9 §4 (g9-p04-t02: при диссоциации кислых солей образуется ион водорода); Kimyo 8 §2 (соли)',
    question: 'Чем кислые соли отличаются от средних?',
    mustMention: ['водород', 'полност|все атомы|частичн|не полностью|замещен'],
  },
  /* ---------------------------------------------------------------------------------- example */
  {
    id: 'h10-45', grade: 9, locale: 'ru', type: 'example', lesson: 'c6-s03',
    source: 'Kimyo 9 §6 / Kimyo 7 §6.6 (NaOH + HCl → NaCl + H₂O)',
    question: 'Приведи пример реакции нейтрализации',
    mustMention: ['re:(NaOH|KOH|LiOH|Ca\\(OH\\)2|Ba\\(OH\\)2|Cu\\(OH\\)2|Al\\(OH\\)3)[^.]{0,40}(HCl|H2SO4|HNO3|H3PO4)|(HCl|H2SO4|HNO3|H3PO4)[^.]{0,40}(NaOH|KOH|LiOH|Ca\\(OH\\)2|Ba\\(OH\\)2)'],
  },
  {
    id: 'h10-46', grade: 10, locale: 'ru', type: 'example', lesson: 'c1-s06',
    source: 'Kimyo 10 §1.6 «Типы реакций …» / §2.8 (CH₂=CH₂ + H₂ → CH₃-CH₃, CH₂=CH₂ + Br₂ → CH₂Br-CH₂Br)',
    question: 'Приведи пример реакции присоединения',
    mustMention: ['re:(H2|Br2|HBr|HCl|H2O|Cl2)\\s*(→|=)|(→|=)\\s*\\S*(CH3|Br|Cl)'],
  },
  /* -------------------------------------------------------------------------------------- calc */
  {
    id: 'h10-47', grade: 8, locale: 'ru', type: 'calc', lesson: 'c5-s04',
    source: 'Kimyo 8 §25 (Vm = 22,4 л/моль) → n = 5,6 / 22,4 = 0,25 моль',
    question: 'Сколько моль содержится в 5,6 л углекислого газа при нормальных условиях?',
    mustMention: ['0,25|0.25'],
  },
  /* ----------------------------------------------------------------------------------- en / uz */
  {
    id: 'h10-48', grade: 8, locale: 'en', type: 'formula', lesson: 'c4-s10',
    source: 'Kimyo 8 §32 «Серная кислота» (H₂SO₄); card-compound-h2so4',
    question: 'What is the formula of sulfuric acid?',
    mustMention: ['re:H2SO4'],
  },
  {
    id: 'h10-49', grade: 9, locale: 'en', type: 'definition', lesson: 'c6-s04',
    source: 'Kimyo 9 §7 «Гидролиз солей»; faq-007 («Гидролиз солей — взаимодействие ионов соли с водой»)',
    question: 'What is hydrolysis?',
    mustMention: ['water|вод', 'salt|ion|decompos|react|interact'],
  },
  {
    id: 'h10-50', grade: 7, locale: 'uz', type: 'definition', lesson: 'c4-s08',
    source: 'Kimyo 7 §4.8 «Озон и его применение» (O₃, аллотропная модификация кислорода)',
    question: 'Ozon nima?',
    mustMention: ['O3|kislorod|кислород', 'allotrop|shakl|modifikat|gaz|molekula'],
  },
]

/* ============================================================== runner (tag r10) */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT_DIR = path.join(ROOT, '.smoke', 'answer-quality')
type Mode = 'chat' | 'voice'

function sectionTitle(grade: number, lesson: string | undefined): string {
  if (!lesson) return ''
  const file = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/kb/corpus/kb-sections.json'), 'utf8')) as Record<
    string,
    Array<{ id: string; title: string }> | { appSections?: Array<{ id: string; title: string }> }
  >
  const g = file[`g${grade}`]
  const rows = Array.isArray(g) ? g : (g?.appSections ?? [])
  return rows.find((r) => r.id === lesson)?.title ?? ''
}

function contextFor(q: GoldQuestion) {
  const [chapterId = '', sectionId = ''] = q.lesson ? q.lesson.split('-') : []
  return { gradeId: `g${q.grade}`, chapterId, sectionId, sectionTitle: sectionTitle(q.grade, q.lesson) }
}

const saveHits = (hits: readonly TeacherKnowledgeHit[]) =>
  [...hits.filter((h) => h.type !== 'index').slice(0, 6), ...hits.filter((h) => h.type === 'index').slice(0, 3)].map((h) => ({
    title: h.title,
    citation: h.citation,
    type: h.type,
    score: h.score === undefined ? undefined : Math.round(h.score * 100) / 100,
    text: h.text.slice(0, 900),
  }))

const stripCitations = (s: string) => s.replace(/\n\n(\[[^\]]+\]\s*)+$/u, '').trim()

async function runChat(q: GoldQuestion, parent: { question: string; answer: string } | null) {
  const c = contextFor(q)
  const ctx: LearnLocalAssistantContext = {
    locale: q.locale,
    gradeId: c.gradeId,
    chapterId: c.chapterId,
    sectionId: c.sectionId,
    sectionTitle: c.sectionTitle,
    slideTitle: c.sectionTitle,
    slideBody: '',
    mode: 'teacher',
    kpNumber: 1,
  }
  const messages = parent
    ? [
        { role: 'user', content: parent.question },
        { role: 'assistant', content: parent.answer },
        { role: 'user', content: q.question },
      ]
    : [{ role: 'user', content: q.question }]
  const t0 = performance.now()
  const res = await composeLocalTeacherReply(messages, ctx)
  const ms = Math.round(performance.now() - t0)
  const previous = messages.slice(0, -1).filter((m) => m.role === 'user' && isSubstantiveQuestion(m.content)).map((m) => m.content)
  const resolved = resolveTurn(q.question, previous, q.locale, ctx.sectionTitle)
  const k = await retrieveForTeacher(resolved.query, {
    locale: ctx.locale,
    gradeId: ctx.gradeId,
    chapterId: ctx.chapterId,
    sectionId: ctx.sectionId,
    sectionTitle: ctx.sectionTitle,
    limit: 8,
    maxChars: 6_000,
    timeoutMs: 2_500,
  })
  return {
    id: q.id, mode: 'chat' as Mode, question: q.question, parentQuestion: parent?.question, query: resolved.query,
    answer: res.text, text: stripCitations(res.text), citations: res.citations, confident: res.confident, ms, context: c,
    hits: saveHits(k.hits),
  }
}

async function runVoice(q: GoldQuestion, parent: { question: string; answer: string } | null) {
  const c = contextFor(q)
  const engine = new TrainingModeEngine({
    lang: q.locale,
    gradeId: c.gradeId,
    chapterId: c.chapterId,
    sectionId: c.sectionId || undefined,
    sectionTitle: c.sectionTitle || undefined,
  })
  ;(engine as unknown as { seed: number }).seed = 0
  const t0 = performance.now()
  const res = await engine.answer({
    text: q.question,
    history: parent ? [{ role: 'user', content: parent.question }, { role: 'assistant', content: parent.answer }] : [],
    previousQuestions: parent ? [parent.question] : [],
    smartAi: false,
  })
  const ms = Math.round(performance.now() - t0)
  const style = res.resolved.style
  const k = await retrieveForTeacher(res.resolved.query, {
    locale: q.locale,
    gradeId: c.gradeId,
    chapterId: c.chapterId,
    sectionId: c.sectionId || undefined,
    sectionTitle: c.sectionTitle || undefined,
    limit: style.detail === 'more' ? 8 : 6,
    maxChars: 3_600,
    timeoutMs: 1_500,
  })
  return {
    id: q.id, mode: 'voice' as Mode, question: q.question, parentQuestion: parent?.question, query: res.resolved.query,
    answer: res.display, text: res.text, citations: res.citations, confident: res.confident, ms, context: c,
    hits: saveHits(k.hits),
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const arg = (n: string, d: string) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] ?? d : d)
  const tag = arg('tag', 'r10')
  const modes = arg('modes', 'chat,voice').split(',').filter((m): m is Mode => m === 'chat' || m === 'voice')
  const only = arg('only', '').split(',').filter(Boolean)
  await preloadKnowledge()
  const status = getKnowledgeStatus()
  const byIdQ = new Map(HOLDOUT_R10.map((q) => [q.id, q]))
  const questions = only.length ? HOLDOUT_R10.filter((q) => only.includes(q.id)) : HOLDOUT_R10
  const items: Awaited<ReturnType<typeof runChat>>[] = []
  for (const mode of modes) {
    const answered = new Map<string, { text: string }>()
    for (const q of questions) {
      const pq = q.followUpOf ? byIdQ.get(q.followUpOf) : undefined
      const parent = pq ? { question: pq.question, answer: answered.get(pq.id)?.text ?? '' } : null
      const rec = mode === 'chat' ? await runChat(q, parent) : await runVoice(q, parent)
      answered.set(q.id, rec)
      items.push(rec)
      console.log(`  ${mode.padEnd(5)} ${q.id} ${String(rec.ms).padStart(4)} ms ${rec.text.replace(/\s+/g, ' ').slice(0, 110)}`)
    }
  }
  const out = { tag, generatedAt: new Date().toISOString(), ctxMode: 'lesson', modes, kb: { shards: status.shards, docs: status.docs }, items }
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const file = path.join(OUT_DIR, `answers-${tag}.json`)
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n')
  console.log(`[holdout] ${items.length} answers → ${path.relative(ROOT, file)}`)
}

if (process.argv[1] && path.basename(process.argv[1]) === 'holdout-r10.mts') await main()

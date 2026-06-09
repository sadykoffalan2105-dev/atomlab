import { learnHubI18nRu } from './learnHubI18nRu'
import { learnLessonExtraRu } from './learnLessonExtraRu'

/** Тексты курса «Обучение» (~20 тем) — подмешиваются в messagesRu. */
export const learnPackRu = {
  'learn.lead':
    'Двадцать базовых тем неорганики: уроки с текстом, 3D-моделью-ориентиром и подсказками, что попробовать в каталоге или лаборатории. Прогресс — в браузере.',
  'learn.hubSlidesAria': 'Дополнительные материалы темы',
  'learn.hubSlideSelectHint':
    'Выберите слайд в списке ниже — над списком показывается 3D-модель вещества, соответствующая этому блоку.',
  'learn.hubSlide3dAria': 'Трёхмерная модель для выбранного слайда',

  'learn.tasksMode': 'Режим задач',
  'learn.tasksModeAria': 'Открыть обзор типов учебных задач по неорганической химии',
  'learn.tasksTitle': 'Типы задач',
  'learn.tasksLead':
    'Режим задач с пошаговой помощью ИИ-учителя. Импортируйте класс, выберите ученика — результаты сохранятся в успеваемости с графиком роста.',
  'learn.tasksBack': 'К списку тем',
  'learn.tasksGroupQuant': 'Расчётные задачи',
  'learn.tasksGroupQual': 'Качественные задачи',
  'learn.tasksWhatLabel': 'Что делать',
  'learn.tasksExampleLabel': 'Пример',

  'learn.tasks.solutions.title': 'Растворы: смешивание и разбавление',
  'learn.tasks.solutions.what':
    'Считать массовую долю растворённого вещества ω = m(в-ва) / m(р-ра). Типичные ситуации: добавили воду, выпарили воду, досыпали соль, смешали два раствора.',
  'learn.tasks.solutions.example':
    'К 200 г 10%-ного раствора соли добавили 50 г воды. Найдите новую массовую долю соли.',

  'learn.tasks.stoichiometry.title': 'По уравнению реакции (стехиометрия)',
  'learn.tasks.stoichiometry.what':
    'Находить массу, объём газа (например V = n·22,4 л/моль в н.у.) или количество вещества n = m/M по известным данным по реагентам и уравнению.',
  'learn.tasks.stoichiometry.example':
    'Какой объём углекислого газа (н.у.) выделится при растворении 10 г карбоната кальция в избытке соляной кислоты?',

  'learn.tasks.limiting_reagent.title': 'Избыток и недостаток',
  'learn.tasks.limiting_reagent.what':
    'Даны массы (или количества) двух исходных реагентов. По n определить, что в недостатке, и считать продукт строго по ограничивающему веществу.',
  'learn.tasks.limiting_reagent.example':
    'Смешали 5,6 г железа и 6,4 г серы. Найдите массу полученного сульфида железа(II).',

  'learn.tasks.yield_impurities.title': 'Примеси и практический выход',
  'learn.tasks.yield_impurities.what':
    'Учитывать массовую долю примесей в сырье и/или выход продукта η относительно теоретического.',
  'learn.tasks.yield_impurities.example':
    'Из 100 кг известняка, содержащего 10% примесей, получили негашёную известь. Какова её масса (при заданном в условии сценарии прокальцивания)?',

  'learn.tasks.metal_plate.title': 'Пластинка в растворе соли',
  'learn.tasks.metal_plate.what':
    'Металлическую пластинку опускают в раствор соли менее активного металла: замещение, меняется масса пластинки; найти массу выделившегося металла или изменение массы.',
  'learn.tasks.metal_plate.example':
    'Железную пластинку массой 20 г опустили в раствор сульфата меди(II). Через время масса пластинки стала 22 г. Сколько меди выделилось?',

  'learn.tasks.electron_balance.title': 'Электронный баланс (ОВР)',
  'learn.tasks.electron_balance.what':
    'Расставить степени окисления, записать переходы электронов, уравнять реакцию, указать окислитель и восстановитель.',
  'learn.tasks.electron_balance.example':
    'Уравняйте реакцию: P + HNO₃ + H₂O → H₃PO₄ + NO.',

  'learn.tasks.ionic_equations.title': 'Ионные уравнения (РИО)',
  'learn.tasks.ionic_equations.what':
    'Записать реакцию в ионах: сильные электролиты — ионы, слабые вещества, осадки и газы — в молекулярном виде; сократить одинаковые ионы.',
  'learn.tasks.ionic_equations.example':
    'Напишите молекулярное, полное и сокращённое ионное уравнение реакции между сульфатом натрия и хлоридом бария.',

  'learn.tasks.transformation_chains.title': 'Цепочки превращений',
  'learn.tasks.transformation_chains.what':
    'По схеме A → B → C → … записать уравнения реакций; часто даны словесные признаки (осадок, газ, цвет).',
  'learn.tasks.transformation_chains.example':
    'Из пероксида водорода получили газ X. При его реакции с железом получили окалину Y. Запишите уравнения.',

  'learn.tasks.qualitative_id.title': 'Распознавание веществ',
  'learn.tasks.qualitative_id.what':
    'Определить вещество по качественным реакциям: подобрать реагенты по ионам (осадок, газ, растворение и т.д.).',
  'learn.tasks.qualitative_id.example':
    'В какой пробирке Ba²⁺, если при добавлении раствора с сульфат-ионом выпадает белый осадок? (Составьте логику опыта.)',

  'learn.tasks.practice': 'Решать',
  'learn.tasks.practiceAria': 'Открыть интерактивные задачи этой категории',

  'learn.task.teacherHint': 'Помощь учителя',
  'learn.task.teacherHintAgain': 'Следующий шаг',
  'learn.task.teacherHintMore': 'Ещё подсказка',
  'learn.task.teacherHintLead': 'Учитель подскажет по шагам — не сразу ответ, а направление к решению.',
  'learn.task.teacherHintStep': 'Шаг {step}',
  'learn.task.teacherHintFoot': 'Попробуйте применить подсказку. Нужно ещё — нажмите «Ещё подсказка».',
  'learn.task.teacherHintLast': 'Это последний шаг перед ответом. Попробуйте решить сами.',

  'learn.task.aiCoach.title': 'ИИ-учитель: следующий шаг',
  'learn.task.aiCoach.lead':
    'Учитель не даст готовый ответ — подскажет план, задаст вопрос и поможет думать самому. Так тренируется критическое мышление.',
  'learn.task.aiCoach.scratchLabel': 'Черновик (Дано, Найти, ход решения)',
  'learn.task.aiCoach.scratchPh': 'Запишите данные и свои рассуждения — учитель проверит логику, не подсказывая ответ…',
  'learn.task.aiCoach.next': 'Какой следующий шаг?',
  'learn.task.aiCoach.nextAgain': 'Ещё один шаг',
  'learn.task.aiCoach.check': 'Проверить мои рассуждения',
  'learn.task.aiCoach.bubbleLabel': 'Подсказка учителя',
  'learn.task.aiCoach.foot': 'Попробуйте сами сделать этот шаг, затем снова спросите учителя.',
  'learn.task.aiCoach.error': 'Не удалось получить подсказку. Попробуйте ещё раз.',
  'learn.task.aiCoach.promptNext': 'Подскажи один следующий шаг к решению — без ответа и без готового расчёта.',
  'learn.task.aiCoach.promptCheck': 'Проверь мои рассуждения в черновике — что верно, что уточнить? Не давай ответ.',
  'learn.task.aiCoach.promptCheckEmpty': 'Как начать решать эту задачу? Только первый шаг, без ответа.',
  'learn.tasks.aiCoachBanner':
    'Новое: ИИ-учитель ведёт по шагам — подсказывает план и проверяет рассуждения, не выдавая готовый ответ.',
  'learn.task.activeStudent': 'Решает: {name}',
  'learn.tasksClass.title': 'Класс (режим задач)',
  'learn.tasksClass.lead': 'Вставьте список учеников — выберите активного. Результаты задач попадут в график успеваемости.',
  'learn.tasksClass.active': 'активен',
  'learn.tasksClass.empty': 'Импортируйте имена учеников, чтобы сохранять результаты задач.',

  'learn.task.syntaxHint': 'Дробная часть — через точку или запятую.',
  'learn.task.answerPlaceholder': 'Ваш ответ',
  'learn.task.check': 'Проверить',
  'learn.task.newTask': 'Новая задача',
  'learn.task.correct': 'Верно.',
  'learn.task.wrong': 'Неверно.',
  'learn.task.expected': 'Эталон: {value}',
  'learn.task.heroFallback': '3D-модель недоступна (WebGL выключен или не поддерживается).',
  'learn.task.mcqHint': 'Выберите один вариант.',

  'learn.task.sol.question':
    'К {mSol} г раствора соли с массовой долей {wPct}% добавили {mWater} г воды. Найдите массовую долю соли в полученном растворе (%).',
  'learn.task.sol.answerLabel': 'Ответ (массовая доля, %)',

  'learn.task.stoich.question':
    '{m} г вещества, принятого за чистый CaCO₃ (M = 100 г/моль), полностью реагируют с избытком HCl с выделением CO₂. Объём CO₂ при н.у. (22,4 л/моль), л:',
  'learn.task.stoich.answerLabel': 'Ответ (объём, л)',

  'learn.task.limit.question':
    'Смешали {mFe} г железа и {mS} г серы; реакция Fe + S → FeS идёт до конца. Молярные массы: Fe 56, S 32, FeS 88 г/моль. Масса FeS, г:',
  'learn.task.limit.answerLabel': 'Ответ (масса FeS, г)',

  'learn.task.yield.question':
    'Имеется {mRock} г известняка с {impPct}% примесей (примесь не содержит CaCO₃). После полного разложения карбоната кальция CaCO₃ → CaO + CO₂ найдите массу негашёной извести CaO. M(CaCO₃)=100, M(CaO)=56 г/моль.',
  'learn.task.yield.answerLabel': 'Ответ (масса CaO, г)',

  'learn.task.plate.question':
    'Железную пластинку погрузили в раствор соли меди(II). За счёт замещения масса пластинки выросла на {delta} г (на 1 моль реакции Fe + Cu²⁺ → Fe²⁺ + Cu прирост ≈ 64−56 = 8 г). Масса выделившейся меди Cu (M = 64 г/моль), г:',
  'learn.task.plate.answerLabel': 'Ответ (масса Cu, г)',

  'learn.task.mcq.redox.q0':
    'В реакции P + HNO₃ + H₂O → H₃PO₄ + NO (после уравнивания) окислителем является',
  'learn.task.mcq.redox.q0o0': 'фосфор P',
  'learn.task.mcq.redox.q0o1': 'азотная кислота HNO₃',
  'learn.task.mcq.redox.q0o2': 'вода H₂O',
  'learn.task.mcq.redox.q0o3': 'оксид азота NO',

  'learn.task.mcq.redox.q1': 'В молекуле NO степень окисления азота равна',
  'learn.task.mcq.redox.q1o0': '0',
  'learn.task.mcq.redox.q1o1': '+1',
  'learn.task.mcq.redox.q1o2': '+2',
  'learn.task.mcq.redox.q1o3': '+4',

  'learn.task.mcq.ion.q0':
    'Сокращённое уравнение Ba²⁺ + SO₄²⁻ → BaSO₄↓ описывает смешивание растворов',
  'learn.task.mcq.ion.q0o0': 'NaCl и KNO₃',
  'learn.task.mcq.ion.q0o1': 'BaCl₂ и Na₂SO₄',
  'learn.task.mcq.ion.q0o2': 'NaOH и HCl',
  'learn.task.mcq.ion.q0o3': 'K₂CO₃ и CaCl₂',

  'learn.task.mcq.ion.q1':
    'Для реакции NaOH + HCl → NaCl + H₂O в сокращённом ионном виде основное уравнение H⁺ + OH⁻ → H₂O; ионы-«наблюдатели»',
  'learn.task.mcq.ion.q1o0': 'Na⁺ и Cl⁻',
  'learn.task.mcq.ion.q1o1': 'только H⁺',
  'learn.task.mcq.ion.q1o2': 'только OH⁻',
  'learn.task.mcq.ion.q1o3': 'Na⁺ и OH⁻',

  'learn.task.mcq.chain.q0': 'При электролизе воды на катоде (восстановление) преимущественно выделяется',
  'learn.task.mcq.chain.q0o0': 'O₂',
  'learn.task.mcq.chain.q0o1': 'H₂',
  'learn.task.mcq.chain.q0o2': 'CO₂',
  'learn.task.mcq.chain.q0o3': 'Cl₂',

  'learn.task.mcq.qual.q0':
    'Чтобы качественно обнаружить ион Ba²⁺ в растворе, удобнее всего добавить раствор, содержащий',
  'learn.task.mcq.qual.q0o0': 'ион Na⁺',
  'learn.task.mcq.qual.q0o1': 'ион Cl⁻',
  'learn.task.mcq.qual.q0o2': 'ион SO₄²⁻',
  'learn.task.mcq.qual.q0o3': 'ион K⁺',

  'learn.task.hint.generic.s1': 'Прочитайте условие и выпишите «Дано» — что известно, что найти.',
  'learn.task.hint.generic.s2': 'Запишите формулу или уравнение, которое связывает величины.',
  'learn.task.hint.generic.s3': 'Подставьте числа и проверьте единицы измерения.',
  'learn.task.hint.mcq.s1': 'Вспомните определение и правило по этой теме.',
  'learn.task.hint.mcq.s2': 'Исключите варианты, которые точно не подходят по условию.',
  'learn.task.hint.sol.s1': 'Найдите массу растворённого вещества в первом растворе.',
  'learn.task.hint.sol.s2': 'В растворе {mSol} г массовая доля {wPct}% — найдите массу соли.',
  'learn.task.hint.sol.s3': 'Смешайте с {mWater} г воды — общая масса раствора увеличится.',
  'learn.task.hint.sol.s4': 'Новая массовая доля = масса соли ÷ общая масса × 100%.',
  'learn.task.hint.stoich.s1': 'Масса CO₂ {m} г. Молярная масса CO₂ = 44 г/моль — найдите n.',
  'learn.task.hint.stoich.s2': 'По уравнению реакции сопоставьте моли веществ.',
  'learn.task.hint.stoich.s3': 'Объём газа при н.у.: V = n × 22,4 л/моль.',
  'learn.task.hint.limit.s1': 'Дано: {mFe} г Fe и {mS} г S. Запишите уравнение Fe + S → FeS.',
  'learn.task.hint.limit.s2': 'Найдите количество вещества Fe и S (n = m / M).',
  'learn.task.hint.limit.s3': 'Сравните n(Fe) и n(S) — кто в избытке, кто ограничивает продукт?',
  'learn.task.hint.limit.s4': 'Масса FeS = n(меньшего) × M(FeS), M = 88 г/моль.',
  'learn.task.hint.yield.s1': 'Масса руды {mRock} г, примесь {impPct}% — найдите массу чистого CaCO₃.',
  'learn.task.hint.yield.s2': 'Чистая масса = m × (1 − примесь/100).',
  'learn.task.hint.yield.s3': 'Из CaCO₃ получается CaO: масса CaO = m(CaCO₃) × 56/100.',
  'learn.task.hint.plate.s1': 'Железо отдаёт электроны: Fe⁰ − 2e⁻ → Fe²⁺. Δm = {delta} г.',
  'learn.task.hint.plate.s2': 'На каждые 2 моль e⁻ (≈2×9,65×10⁴ Кл) — 1 моль Cu.',
  'learn.task.hint.plate.s3': 'Масса Cu = (Δm / 56) × 64 г (упрощённо для этой задачи).',
  'learn.task.hint.oge.s1': 'Масса CaCO₃ {m} г, Mr = 100 — найдите n = m/100.',
  'learn.task.hint.oge.s2': 'По уравнению CaCO₃ + 2HCl → … + CO₂: n(CO₂) = n(CaCO₃).',
  'learn.task.hint.oge.s3': 'V(CO₂) = n × 22,4 л при нормальных условиях.',
  'learn.task.hint.redox.s1': 'Определите степени окисления всех атомов в уравнении.',
  'learn.task.hint.redox.s2': 'Окислитель принимает электроны, восстановитель отдаёт.',
  'learn.task.hint.redox.s3': 'Сравните: кто теряет электроны, кто набирает?',
  'learn.task.hint.ion.s1': 'Распишите вещества на ионы — что растворимо, что осадок?',
  'learn.task.hint.ion.s2': 'Исключите «наблюдателей» — ионы, не участвующие в реакции.',
  'learn.task.hint.ion.s3': 'Сокращённое ионное уравнение — только участники.',
  'learn.task.hint.chain.s1': 'Вспомните: при электролизе воды на катоде восстанавливается…',
  'learn.task.hint.chain.s2': 'Катод — отрицательный электрод, катионы идут к нему.',
  'learn.task.hint.qual.s1': 'Ион Ba²⁺ даёт осадок с ионом сульфата SO₄²⁻.',
  'learn.task.hint.qual.s2': 'Белый осадок BaSO₄ — характерная реакция на барий.',
  'learn.task.hint.qual.s3': 'Выберите реагент, содержащий SO₄²⁻.',

  'learn.T.periodicity.title': 'Периодичность',
  'learn.T.periodicity.summary': 'Закон Менделеева, сравнение элементов в периоде и группе.',
  'learn.T.periodicity.experiment':
    'Откройте таблицу Менделеева в приложении и сравните два соседних элемента по конфигурации и степеням окисления.',

  'learn.T.bond_types.title': 'Типы химической связи',
  'learn.T.bond_types.summary': 'Ковалентная и ионная связь на примерах простых формул.',
  'learn.T.bond_types.experiment':
    'В каталоге найдите молекулу с ковалентной связью и соль с ионной решёткой; сравните 3D.',

  'learn.T.oxides_acidic.title': 'Кислотные оксиды',
  'learn.T.oxides_acidic.summary': 'Связь с кислотами, примеры CO₂, SO₂, SO₃ в курсе.',
  'learn.T.oxides_acidic.experiment':
    'Запишите реакцию оксида с водой или с основанием для одного вещества из темы «оксиды» в каталоге.',

  'learn.T.oxides_basic.title': 'Основные оксиды',
  'learn.T.oxides_basic.summary': 'Оксиды металлов(I–II) и гидроксиды как продукты взаимодействия с водой.',
  'learn.T.oxides_basic.experiment':
    'Сравните в каталоге CaO и Na₂O: состав, категория, учебное уравнение в карточке.',

  'learn.T.oxides_amphoteric.title': 'Амфотерные оксиды',
  'learn.T.oxides_amphoteric.summary': 'Al₂O₃, ZnO — реакции с кислотами и щёлочами (по программе).',
  'learn.T.oxides_amphoteric.experiment':
    'Откройте карточку Al₂O₃ и выпишите две типичные реакции: с кислотой и с раствором щёлочи.',

  'learn.T.acids_strong.title': 'Сильные кислоты',
  'learn.T.acids_strong.summary': 'Полная диссоциация, примеры HCl, H₂SO₄, HNO₃.',
  'learn.T.acids_strong.experiment':
    'В лаборатории подберите уравнение с сильной кислотой и металлом (по правилам безопасности учителя).',

  'learn.T.acids_weak.title': 'Слабые кислоты и равновесие',
  'learn.T.acids_weak.summary': 'Неполная диссоциация, пример угольной кислоты и CO₂ в воде.',
  'learn.T.acids_weak.experiment':
    'Объясните словами, чем раствор H₂CO₃ отличается от модели одной молекулы в 3D.',

  'learn.T.bases_alkali.title': 'Щёлочи и гидроксиды',
  'learn.T.bases_alkali.summary': 'NaOH, KOH — сильные основания, общие реакции.',
  'learn.T.bases_alkali.experiment':
    'Составьте уравнение нейтрализации NaOH + HCl в ионном виде на бумаге.',

  'learn.T.salts_ionic.title': 'Ионные соли',
  'learn.T.salts_ionic.summary': 'Кристалл, ионы, диссоциация; NaCl как эталон.',
  'learn.T.salts_ionic.experiment':
    'Найдите в каталоге другую бинарную соль и выпишите уравнение диссоциации.',

  'learn.T.salts_solubility.title': 'Растворимость и обмен',
  'learn.T.salts_solubility.summary': 'Таблица растворимости, ионный обмен, газ и осадок.',
  'learn.T.salts_solubility.experiment':
    'Подберите в уме реакцию, где образуется газ CO₂ из соли и кислоты; проверьте по каталогу формулы.',

  'learn.T.gases_nitrogen.title': 'Оксиды азота',
  'learn.T.gases_nitrogen.summary': 'NO, NO₂, степени окисления азота, экологический контекст.',
  'learn.T.gases_nitrogen.experiment':
    'Сравните в карточках NO и NO₂: цвет газа (по описанию), тип оксида, типичные реакции.',

  'learn.T.gases_sulfur.title': 'Оксиды серы',
  'learn.T.gases_sulfur.summary': 'SO₂, SO₃ — кислотные оксиды, связь с кислотами серы.',
  'learn.T.gases_sulfur.experiment':
    'Постройте цепочку SO₂ → сернистая кислота → соль (одно звено запишите уравнением).',

  'learn.T.halogens_intro.title': 'Галогены (введение)',
  'learn.T.halogens_intro.summary': 'HCl, типичные окислители, связь с рядом напряжений.',
  'learn.T.halogens_intro.experiment':
    'В каталоге откройте HCl и MnO₂; обсудите с учителем, где возможна опасная смесь реагентов.',

  'learn.T.metals_activity.title': 'Металлы и оксиды металлов',
  'learn.T.metals_activity.summary': 'Ряд активности (идея), CuO как оксид металла(II).',
  'learn.T.metals_activity.experiment':
    'Запишите одну реакцию восстановления оксида меди(II) восстановителем из школьного курса.',

  'learn.T.redox_intro.title': 'ОВР: основы',
  'learn.T.redox_intro.summary': 'Окислитель, восстановитель, степени окисления, баланс.',
  'learn.T.redox_intro.experiment':
    'Откройте лабораторию и сбалансируйте простое уравнение с переносом электронов.',

  'learn.T.electrolysis_intro.title': 'Электролиз (идеи)',
  'learn.T.electrolysis_intro.summary': 'Ионы в расплаве и растворе, катод и анод на качественном уровне.',
  'learn.T.electrolysis_intro.experiment':
    'Для NaCl выпишите, какие ионы теоретически могут разряжаться в растворе и в расплаве (схема).',

  'learn.T.water_chemistry.title': 'Вода и растворы',
  'learn.T.water_chemistry.summary': 'Диполь H₂O, растворитель, pH в связи с кислотностью.',
  'learn.T.water_chemistry.experiment':
    'Сопоставьте 3D воды с идеей гидратации ионов при растворении соли.',

  'learn.T.qual_analysis.title': 'Качественный анализ (ориентир)',
  'learn.T.qual_analysis.summary': 'Цвет раствора, окислители — пример дихромата калия.',
  'learn.T.qual_analysis.experiment':
    'Прочитайте карточку K₂Cr₂O₇: где окислитель, какие меры предосторожности на уроке.',

  'learn.T.industrial_touch.title': 'Химия и техника',
  'learn.T.industrial_touch.summary': 'Контактный процесс, серная кислота, SO₃ как звено цепи.',
  'learn.T.industrial_touch.experiment':
    'По учебнику нарисуйте блок-схему «SO₂ → SO₃ → H₂SO₄» без цифр заводов.',

  'learn.T.safety_lab.title': 'Безопасность и лаборатория ATOMLAB',
  'learn.T.safety_lab.summary': 'Виртуальная среда не заменяет правила реального кабинета.',
  'learn.T.safety_lab.experiment':
    'Пройдите один сценарий в лаборатории приложения и сверьте с инструкцией учителя для реальных опытов.',

  'learn.L.l_periodicity.title': 'Периодичность и прогноз свойств',
  'learn.L.l_periodicity.s0':
    'С ростом заряда ядра в периоде усиливается притяжение к валентным электронам: металлический характер слабеет слева направо.',
  'learn.L.l_periodicity.s1':
    'В группе сверху вниз растёт радиус атома и металлические свойства; сравните Na и K по описанию в таблице.',
  'learn.L.l_periodicity.h_b': 'Молекула воды — простейший пример полярных ковалентных связей и водородного моста в агрегатах.',
  'learn.L.l_periodicity.s3':
    'Сопоставьте положение элемента в ПС с типом его оксида (кислотный / основный) на примерах из каталога.',

  'learn.L.l_bond_types.title': 'Связь: ковалентная и ионная',
  'learn.L.l_bond_types.s0':
    'Ковалентная связь — общие электронные пары; ионная — перенос электронов между атомами с различной электроотрицательностью.',
  'learn.L.l_bond_types.s1':
    'Степень ионности связи растёт с разницей электроотрицательностей; в 3D «шар—палка» показывают порядок соседства атомов.',
  'learn.L.l_bond_types.h_b': 'Угловая молекула воды иллюстрирует полярные связи O—H.',
  'learn.L.l_bond_types.s3':
    'Найдите в каталоге одну соль и объясните, почему в кристалле связь Na—Cl считается ионной.',

  'learn.L.l_oxides_acidic.title': 'Кислотные оксиды',
  'learn.L.l_oxides_acidic.s0':
    'Кислотный оксид взаимодействует с водой (часто с равновесием) и с основами, образуя соль и воду.',
  'learn.L.l_oxides_acidic.s1': 'CO₂ — типичный кислотный оксид углерода(IV); важен для кислотности природных вод.',
  'learn.L.l_oxides_acidic.h_b': 'Линейная молекула CO₂: модель для обсуждения гибридизации и кислотного характера.',
  'learn.L.l_oxides_acidic.s3':
    'Запишите реакцию CO₂ с избытком гидроксида натрия до нормальной соли (коэффициенты подберите).',

  'learn.L.l_oxides_basic.title': 'Основные оксиды',
  'learn.L.l_oxides_basic.s0':
    'Оксиды активных металлов(I–II) проявляют основный характер: с водой — гидроксид, с кислотой — соль и вода.',
  'learn.L.l_oxides_basic.s1': 'CaO используют в строительной химии и как осушитель в учебных постановках.',
  'learn.L.l_oxides_basic.h_b': 'Упрощённая модель бинарного оксида кальция в каталоге.',
  'learn.L.l_oxides_basic.s3': 'Сравните продукт реакции CaO с водой и Na₂O с водой по типу гидроксида.',

  'learn.L.l_oxides_amphoteric.title': 'Амфотерный оксид',
  'learn.L.l_oxides_amphoteric.s0':
    'Амфотерный оксид реагирует и с кислотой, и со щёлочью — важны условия (раствор, концентрация).',
  'learn.L.l_oxides_amphoteric.s1': 'Al₂O₃ — классический пример в школьном курсе неорганики.',
  'learn.L.l_oxides_amphoteric.h_b': 'Посмотрите связи Al—O в учебной геометрии каталога.',
  'learn.L.l_oxides_amphoteric.s3':
    'Выпишите две молекулярные реакции: Al₂O₃ + кислота и Al₂O₃ + щёлочь (продукты по программе).',

  'learn.L.l_acids_strong.title': 'Сильные кислоты',
  'learn.L.l_acids_strong.s0':
    'В разбавленном водном растворе сильная кислота почти полностью диссоциирует; в 3D показана молекула без растворителя.',
  'learn.L.l_acids_strong.s1': 'H₂SO₄ — и кислота, и окислитель в концентрированном виде; соблюдайте правила безопасности.',
  'learn.L.l_acids_strong.h_b': 'Фрагмент структуры серной кислоты в каталоге.',
  'learn.L.l_acids_strong.s3': 'Составьте ионное уравнение реакции H₂SO₄ с NaOH в разбавленном растворе.',

  'learn.L.l_acids_weak.title': 'Слабые кислоты',
  'learn.L.l_acids_weak.s0':
    'Угольная кислота в равновесии с CO₂ и водой — пример слабой кислоты и связи с оксидом.',
  'learn.L.l_acids_weak.s1': 'В растворе важны ионы и молекулы; одна молекула H₂CO₃ в газовой фазе не описывает весь раствор.',
  'learn.L.l_acids_weak.h_b': 'Учебная модель молекулы угольной кислоты.',
  'learn.L.l_acids_weak.s3': 'Объясните, почему «CO₂ в воде» кислит среду, хотя молекула CO₂ сама по себе кислота Брёнстеда не является.',

  'learn.L.l_bases_alkali.title': 'Гидроксид натрия и щёлочная среда',
  'learn.L.l_bases_alkali.s0':
    'NaOH полностью диссоциирует в воде; в твёрдом виде гигроскопичен — в реальном кабинете только по инструкции.',
  'learn.L.l_bases_alkali.s1': 'Щёлочи реагируют с кислотами, кислотными оксидами и многими солями по таблице растворимости.',
  'learn.L.l_bases_alkali.h_b': 'Модель NaOH: связь Na—O—H.',
  'learn.L.l_bases_alkali.s3': 'Запишите реакцию NaOH с CuSO₄ в ионном виде с продуктом-осадком.',

  'learn.L.l_salts_ionic.title': 'NaCl как модель соли',
  'learn.L.l_salts_ionic.s0':
    'В кристалле NaCl ионы чередуются; в 3D видно расстояние между центрами ионов в учебной модели.',
  'learn.L.l_salts_ionic.s1': 'При плавлении и растворении ионы становятся подвижнее; электролиз — отдельная тема.',
  'learn.L.l_salts_ionic.h_b': 'Посмотрите расположение Na⁺ и Cl⁻ в модели каталога.',
  'learn.L.l_salts_ionic.s3': 'Выпишите уравнение электролиза расплава NaCl в общем виде (квалитативно).',

  'learn.L.l_salts_solubility.title': 'Соли и растворимость',
  'learn.L.l_salts_solubility.s0':
    'NaHCO₃ — кислая соль угольной кислоты; в курсе встречается в реакциях с кислотами и при обсуждении жёсткости воды.',
  'learn.L.l_salts_solubility.s1': 'Ионный обмен возможен, если есть газ, вода или осадок — проверяйте таблицу растворимости.',
  'learn.L.l_salts_solubility.h_b': 'Модель ионов в каталоге для пищевой соды.',
  'learn.L.l_salts_solubility.s3': 'Запишите реакцию NaHCO₃ с HCl в молекулярном и ионном виде.',

  'learn.L.l_gases_nitrogen.title': 'Оксиды азота',
  'learn.L.l_gases_nitrogen.s0':
    'NO легко окисляется на воздухе; NO₂ даёт кислую среду в воде и участвует в циклах NOₓ.',
  'learn.L.l_gases_nitrogen.s1': 'Степени окисления азота от +1 до +5 — опорная таблица для уравнений.',
  'learn.L.l_gases_nitrogen.h_b': 'Угловая молекула NO₂ в 3D.',
  'learn.L.l_gases_nitrogen.s3': 'Составьте уравнение взаимодействия NO₂ с водой по учебнику.',

  'learn.L.l_gases_sulfur.title': 'Диоксид серы',
  'learn.L.l_gases_sulfur.s0': 'SO₂ растворяется в воде, образуя среду кислую; в технике — выбросы и сернистая кислота.',
  'learn.L.l_gases_sulfur.s1': 'Окисление SO₂ до SO₃ — ключевой шаг получения серной кислоты.',
  'learn.L.l_gases_sulfur.h_b': 'Связи S—O в молекуле SO₂.',
  'learn.L.l_gases_sulfur.s3': 'Сравните SO₂ и CO₂ как кислотные оксиды по типичным реакциям.',

  'learn.L.l_halogens_intro.title': 'Соляная кислота и галогены',
  'learn.L.l_halogens_intro.s0':
    'HCl в воде — сильный электролит; в газовой фазе — молекула с полярной связью.',
  'learn.L.l_halogens_intro.s1': 'Галогены как окислители изучают по цепочкам реакций; безопасность — прежде всего.',
  'learn.L.l_halogens_intro.h_b': 'Модель HCl.',
  'learn.L.l_halogens_intro.s3': 'Запишите реакцию HCl с NH₃ (в газовой фазе и в растворе — две формулировки).',

  'learn.L.l_metals_activity.title': 'Оксид меди(II)',
  'learn.L.l_metals_activity.s0':
    'CuO — основный оксид; в реакциях с кислотами даёт соли меди(II), с восстановителями — медь.',
  'learn.L.l_metals_activity.s1': 'Сопоставьте положение Cu в ряду напряжений с поведением Zn в разбавленной кислоте.',
  'learn.L.l_metals_activity.h_b': 'Модель CuO в каталоге.',
  'learn.L.l_metals_activity.s3': 'Уравняйте реакцию CuO + H₂SO₄ → соль + вода.',

  'learn.L.l_redox_intro.title': 'ОВР и баланс',
  'learn.L.l_redox_intro.s0':
    'Определите степени окисления до и после реакции; электронный баланс — стандартный приём.',
  'learn.L.l_redox_intro.s1': 'MnO₂ часто выступает как окислитель в лабораторных схемах (строго по методичке).',
  'learn.L.l_redox_intro.h_b': 'Структурная модель MnO₂ в каталоге.',
  'learn.L.l_redox_intro.s3': 'Откройте лабораторию и подберите простое уравнение с изменением степеней окисления.',

  'learn.L.l_electrolysis_intro.title': 'Электролиз и ионы',
  'learn.L.l_electrolysis_intro.s0':
    'В расплаве NaCl разряжаются Na⁺ и Cl⁻; в водном растворе конкурируют H⁺ и OH⁻ из воды.',
  'learn.L.l_electrolysis_intro.s1': 'Катод восстанавливает, анод окисляет — запомните качественно направление процессов.',
  'learn.L.l_electrolysis_intro.h_b': 'Модель NaCl для обсуждения ионов.',
  'learn.L.l_electrolysis_intro.s3': 'Нарисуйте схему электролиза водного NaCl с инертными электродами (квалитативно).',

  'learn.L.l_water_chemistry.title': 'Вода как растворитель',
  'learn.L.l_water_chemistry.s0':
    'Полярные молекулы лучше растворяются в воде; ионы гидратируются.',
  'learn.L.l_water_chemistry.s1': 'pH связан с концентрацией H⁺; кислоты и основания меняют pH раствора.',
  'learn.L.l_water_chemistry.h_b': 'Модель H₂O.',
  'learn.L.l_water_chemistry.s3': 'Объясните, почему NaCl в воде даёт нейтральный pH (≈7 при 25 °C).',

  'learn.L.l_qual_analysis.title': 'Дихромат калия',
  'learn.L.l_qual_analysis.s0':
    'K₂Cr₂O₇ — сильный окислитель в кислой среде; важны этикетки и правила работы в кабинете.',
  'learn.L.l_qual_analysis.s1': 'Цвет ионов хрома(VI) используют в демонстрациях окисления.',
  'learn.L.l_qual_analysis.h_b': 'Модель соли в каталоге.',
  'learn.L.l_qual_analysis.s3': 'Запишите полуреакцию восстановления Cr₂O₇²⁻ в кислой среде (квалитативно).',

  'learn.L.l_industrial_touch.title': 'Серный ангидрид',
  'learn.L.l_industrial_touch.s0':
    'SO₃ — кислотный оксид серы(VI); в контактном процессе получают затем серную кислоту.',
  'learn.L.l_industrial_touch.s1': 'Гигроскопичность и реакция с водой — бурое выделение тепла (только по описанию).',
  'learn.L.l_industrial_touch.h_b': 'Модель SO₃ в каталоге.',
  'learn.L.l_industrial_touch.s3': 'Составьте уравнение SO₃ + H₂O и обсудите роль катализатора в двухстадийном окислении SO₂.',

  'learn.L.l_safety_lab.title': 'Лаборатория приложения',
  'learn.L.l_safety_lab.s0':
    'ATOMLAB — учебная визуализация: реактор проверяет баланс и показывает 3D-продукт, но не заменяет СИЗ и вентиляцию.',
  'learn.L.l_safety_lab.s1': 'Реальные опыты только под руководством преподавателя и по методичке.',
  'learn.L.l_safety_lab.s2': 'Сначала освойте таблицу Менделеева и каталог веществ, затем экспериментируйте в виртуальном реакторе.',

  ...learnHubI18nRu,
  ...learnLessonExtraRu,

  'learn.tryLabLessonBody':
    'Перейдите в «Лаборатория», откройте реактор (реагенты — таблица ⊞ справа), выберите продукт из каталога и уравняйте реакцию. Это учебная модель.',
} as const

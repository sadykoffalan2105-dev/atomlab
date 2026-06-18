import { learnHubI18nEn } from './learnHubI18nEn'
import { learnLessonExtraEn } from './learnLessonExtraEn'
import { learnPathwayEn } from './learnPathwayEn'
import { learnPackRu } from './learnPackRu'

/** English mirror of learnPackRu — keys must match exactly. */
export const learnPackEn = {
  'learn.lead':
    'Twenty core inorganic topics: lessons with text, a 3D “totem” model, and hints for the catalog or lab. Progress stays in your browser.',
  'learn.hubSlidesAria': 'Extra material for this topic',
  'learn.hubSlideSelectHint': 'Pick a slide in the list below; the 3D model above matches that slide’s substance.',
  'learn.hubSlide3dAria': '3D model for the selected slide',

  'learn.tasksMode': 'Problem mode',
  'learn.tasksModeAria': 'Open an overview of inorganic chemistry problem types',
  'learn.tasksTitle': 'Problem types',
  'learn.tasksLead':
    'Task mode with step-by-step AI teacher help. Import your class, pick a student — results feed into performance charts.',
  'learn.tasksBack': 'Back to topics',
  'learn.tasksGroupQuant': 'Quantitative problems',
  'learn.tasksGroupQual': 'Qualitative problems',
  'learn.tasksWhatLabel': 'What to do',
  'learn.tasksExampleLabel': 'Example',

  'learn.tasks.solutions.title': 'Solutions: mixing and dilution',
  'learn.tasks.solutions.what':
    'Compute mass fraction of solute ω = m(solute) / m(solution). Typical cases: add water, evaporate water, add more salt, mix two solutions.',
  'learn.tasks.solutions.example':
    '50 g of water is added to 200 g of a 10% salt solution. Find the new mass fraction of salt.',

  'learn.tasks.stoichiometry.title': 'From the reaction equation (stoichiometry)',
  'learn.tasks.stoichiometry.what':
    'Find mass, gas volume (e.g. V = n·22.4 L/mol at STP), or amount n = m/M from given data and a balanced equation.',
  'learn.tasks.stoichiometry.example':
    'What volume of CO₂ (STP) is released when 10 g of calcium carbonate dissolves in excess hydrochloric acid?',

  'learn.tasks.limiting_reagent.title': 'Limiting and excess reagent',
  'learn.tasks.limiting_reagent.what':
    'Given masses (or amounts) of two reactants, use n to find the limiting reagent and base the product calculation on it.',
  'learn.tasks.limiting_reagent.example':
    '5.6 g of iron is mixed with 6.4 g of sulfur. Find the mass of iron(II) sulfide formed.',

  'learn.tasks.yield_impurities.title': 'Impurities and practical yield',
  'learn.tasks.yield_impurities.what':
    'Account for mass fraction of impurities in the feedstock and/or product yield η relative to the theoretical amount.',
  'learn.tasks.yield_impurities.example':
    'Quicklime is obtained from 100 kg of limestone containing 10% impurities. What is its mass for the scenario stated in the problem?',

  'learn.tasks.metal_plate.title': 'Metal strip in a salt solution',
  'learn.tasks.metal_plate.what':
    'A metal plate is placed in a solution of a less active metal’s salt: displacement, plate mass changes; find deposited metal mass or the mass change.',
  'learn.tasks.metal_plate.example':
    'A 20 g iron plate is dipped in aqueous copper(II) sulfate. Later the plate mass is 22 g. How much copper was deposited?',

  'learn.tasks.electron_balance.title': 'Electron balance (redox)',
  'learn.tasks.electron_balance.what':
    'Assign oxidation states, write electron transfers, balance the reaction, name oxidant and reductant.',
  'learn.tasks.electron_balance.example':
    'Balance: P + HNO₃ + H₂O → H₃PO₄ + NO.',

  'learn.tasks.ionic_equations.title': 'Ionic equations',
  'learn.tasks.ionic_equations.what':
    'Write the reaction in ions: strong electrolytes as ions; weak species, precipitates, and gases as molecules/complete formulas; cancel spectator ions.',
  'learn.tasks.ionic_equations.example':
    'Write molecular, full ionic, and net ionic equations for sodium sulfate with barium chloride.',

  'learn.tasks.transformation_chains.title': 'Transformation sequences',
  'learn.tasks.transformation_chains.what':
    'For a scheme A → B → C → … write each step’s reaction; clues are often verbal (precipitate, gas, colour).',
  'learn.tasks.transformation_chains.example':
    'Gas X is obtained from hydrogen peroxide. X reacts with iron to give scale Y. Write the equations.',

  'learn.tasks.qualitative_id.title': 'Substance identification',
  'learn.tasks.qualitative_id.what':
    'Infer substances from qualitative tests: pick reagents by ion cues (precipitate, gas, dissolution, etc.).',
  'learn.tasks.qualitative_id.example':
    'Which test tube contains Ba²⁺ if adding sulfate ion gives a white precipitate? (Outline the reasoning.)',

  'learn.tasks.practice': 'Solve',
  'learn.tasks.practiceAria': 'Open interactive tasks for this category',

  'learn.task.teacherHint': 'Teacher help',
  'learn.task.teacherHintAgain': 'Next step',
  'learn.task.teacherHintMore': 'More hint',
  'learn.task.teacherHintLead': 'The teacher guides you step by step — not the answer, but the direction.',
  'learn.task.teacherHintStep': 'Step {step}',
  'learn.task.teacherHintFoot': 'Try applying the hint. Need more? Tap «More hint».',
  'learn.task.teacherHintLast': 'Last step before the answer. Try solving on your own.',

  'learn.task.aiCoach.title': 'AI teacher: next step',
  'learn.task.aiCoach.lead':
    'The teacher will not give the answer — only a plan, questions, and reasoning checks to build critical thinking.',
  'learn.task.aiCoach.scratchLabel': 'Scratchpad (Given, Find, your steps)',
  'learn.task.aiCoach.scratchPh': 'Write data and your reasoning — the teacher checks logic without revealing the answer…',
  'learn.task.aiCoach.next': 'What is the next step?',
  'learn.task.aiCoach.nextAgain': 'One more step',
  'learn.task.aiCoach.check': 'Check my reasoning',
  'learn.task.aiCoach.bubbleLabel': 'Teacher hint',
  'learn.task.aiCoach.foot': 'Try this step on your own, then ask the teacher again.',
  'learn.task.aiCoach.error': 'Could not get a hint. Please try again.',
  'learn.task.aiCoach.promptNext': 'Suggest one next step toward the solution — no answer and no full calculation.',
  'learn.task.aiCoach.promptCheck': 'Check my scratchpad reasoning — what is right, what to clarify? Do not give the answer.',
  'learn.task.aiCoach.promptCheckEmpty': 'How should I start this problem? Only the first step, no answer.',
  'learn.tasks.aiCoachBanner':
    'New: AI teacher guides step by step — plans your work and checks reasoning without giving the final answer.',
  'learn.task.activeStudent': 'Solving: {name}',
  'learn.tasksClass.title': 'Class (task mode)',
  'learn.tasksClass.lead': 'Paste student names — pick the active one. Task results go to the progress chart.',
  'learn.tasksClass.active': 'active',
  'learn.tasksClass.empty': 'Import student names to save task results.',

  'learn.task.syntaxHint': 'Use a dot or comma as the decimal separator.',
  'learn.task.answerPlaceholder': 'Your answer',
  'learn.task.check': 'Check',
  'learn.task.newTask': 'New problem',
  'learn.task.correct': 'Correct.',
  'learn.task.wrong': 'Not quite.',
  'learn.task.expected': 'Expected: {value}',
  'learn.task.heroFallback': '3D preview unavailable (WebGL disabled or unsupported).',
  'learn.task.mcqHint': 'Pick one option.',

  'learn.task.sol.question':
    'To {mSol} g of a {wPct}% salt solution, {mWater} g of water is added. Find the new mass fraction of salt (%).',
  'learn.task.sol.answerLabel': 'Answer (mass fraction, %)',

  'learn.task.stoich.question':
    '{m} g of solid assumed to be pure CaCO₃ (M = 100 g/mol) reacts completely with excess HCl, releasing CO₂. Volume of CO₂ at STP (22.4 L/mol), L:',
  'learn.task.stoich.answerLabel': 'Answer (volume, L)',

  'learn.task.limit.question':
    '{mFe} g of iron is mixed with {mS} g of sulfur; Fe + S → FeS goes to completion. Molar masses: Fe 56, S 32, FeS 88 g/mol. Mass of FeS, g:',
  'learn.task.limit.answerLabel': 'Answer (mass of FeS, g)',

  'learn.task.yield.question':
    'You have {mRock} g of limestone with {impPct}% inert impurities (no CaCO₃ in the impurity). After complete decomposition CaCO₃ → CaO + CO₂, find the mass of quicklime CaO. M(CaCO₃)=100, M(CaO)=56 g/mol.',
  'learn.task.yield.answerLabel': 'Answer (mass of CaO, g)',

  'learn.task.plate.question':
    'An iron plate is dipped in a copper(II) salt solution. Displacement Fe + Cu²⁺ → Fe²⁺ + Cu increases the plate mass by {delta} g (≈8 g per mole of reaction for M(Cu)−M(Fe) with 64 and 56 g/mol). Mass of copper deposited (M(Cu)=64 g/mol), g:',
  'learn.task.plate.answerLabel': 'Answer (mass of Cu, g)',

  'learn.task.mcq.redox.q0':
    'In P + HNO₃ + H₂O → H₃PO₄ + NO (balanced), the oxidizing agent is',
  'learn.task.mcq.redox.q0o0': 'phosphorus P',
  'learn.task.mcq.redox.q0o1': 'nitric acid HNO₃',
  'learn.task.mcq.redox.q0o2': 'water H₂O',
  'learn.task.mcq.redox.q0o3': 'nitrogen monoxide NO',

  'learn.task.mcq.redox.q1': 'In NO, the oxidation state of nitrogen is',
  'learn.task.mcq.redox.q1o0': '0',
  'learn.task.mcq.redox.q1o1': '+1',
  'learn.task.mcq.redox.q1o2': '+2',
  'learn.task.mcq.redox.q1o3': '+4',

  'learn.task.mcq.ion.q0':
    'The net ionic equation Ba²⁺ + SO₄²⁻ → BaSO₄↓ describes mixing solutions of',
  'learn.task.mcq.ion.q0o0': 'NaCl and KNO₃',
  'learn.task.mcq.ion.q0o1': 'BaCl₂ and Na₂SO₄',
  'learn.task.mcq.ion.q0o2': 'NaOH and HCl',
  'learn.task.mcq.ion.q0o3': 'K₂CO₃ and CaCl₂',

  'learn.task.mcq.ion.q1':
    'For NaOH + HCl → NaCl + H₂O, the net ionic core is H⁺ + OH⁻ → H₂O; the spectator ions are',
  'learn.task.mcq.ion.q1o0': 'Na⁺ and Cl⁻',
  'learn.task.mcq.ion.q1o1': 'H⁺ only',
  'learn.task.mcq.ion.q1o2': 'OH⁻ only',
  'learn.task.mcq.ion.q1o3': 'Na⁺ and OH⁻',

  'learn.task.mcq.chain.q0': 'In water electrolysis, the gas evolved mainly at the cathode is',
  'learn.task.mcq.chain.q0o0': 'O₂',
  'learn.task.mcq.chain.q0o1': 'H₂',
  'learn.task.mcq.chain.q0o2': 'CO₂',
  'learn.task.mcq.chain.q0o3': 'Cl₂',

  'learn.task.mcq.qual.q0': 'To detect Ba²⁺ in solution, it is most practical to add a solution containing',
  'learn.task.mcq.qual.q0o0': 'Na⁺',
  'learn.task.mcq.qual.q0o1': 'Cl⁻',
  'learn.task.mcq.qual.q0o2': 'SO₄²⁻',
  'learn.task.mcq.qual.q0o3': 'K⁺',

  'learn.task.hint.generic.s1': 'Read the problem and write Given / Find.',
  'learn.task.hint.generic.s2': 'Write the formula or equation linking the quantities.',
  'learn.task.hint.generic.s3': 'Substitute numbers and check units.',
  'learn.task.hint.mcq.s1': 'Recall the definition and rule for this topic.',
  'learn.task.hint.mcq.s2': 'Eliminate options that clearly do not fit.',
  'learn.task.hint.sol.s1': 'Find the mass of solute in the first solution.',
  'learn.task.hint.sol.s2': 'In {mSol} g solution with {wPct}% mass fraction — find salt mass.',
  'learn.task.hint.sol.s3': 'Mix with {mWater} g water — total mass increases.',
  'learn.task.hint.sol.s4': 'New mass fraction = salt mass ÷ total mass × 100%.',
  'learn.task.hint.stoich.s1': 'CO₂ mass {m} g. Molar mass 44 g/mol — find n.',
  'learn.task.hint.stoich.s2': 'Use the balanced equation to relate amounts.',
  'learn.task.hint.stoich.s3': 'Gas volume at STP: V = n × 22.4 L/mol.',
  'learn.task.hint.limit.s1': 'Given: {mFe} g Fe and {mS} g S. Equation: Fe + S → FeS.',
  'learn.task.hint.limit.s2': 'Find n(Fe) and n(S) using n = m / M.',
  'learn.task.hint.limit.s3': 'Compare — which reagent limits the product?',
  'learn.task.hint.limit.s4': 'Mass FeS = n(smaller) × 88 g/mol.',
  'learn.task.hint.yield.s1': 'Ore {mRock} g, impurity {impPct}% — find pure CaCO₃ mass.',
  'learn.task.hint.yield.s2': 'Pure mass = m × (1 − impurity/100).',
  'learn.task.hint.yield.s3': 'CaO mass = m(CaCO₃) × 56/100.',
  'learn.task.hint.plate.s1': 'Iron loses electrons: Fe⁰ → Fe²⁺. Δm = {delta} g.',
  'learn.task.hint.plate.s2': 'For every 2 mol e⁻, 1 mol Cu is deposited.',
  'learn.task.hint.plate.s3': 'Cu mass ≈ (Δm / 56) × 64 g for this problem.',
  'learn.task.hint.oge.s1': 'CaCO₃ mass {m} g, Mr = 100 — n = m/100.',
  'learn.task.hint.oge.s2': 'From CaCO₃ + 2HCl → … + CO₂: n(CO₂) = n(CaCO₃).',
  'learn.task.hint.oge.s3': 'V(CO₂) = n × 22.4 L at STP.',
  'learn.task.hint.redox.s1': 'Assign oxidation states to all atoms.',
  'learn.task.hint.redox.s2': 'Oxidizer gains e⁻, reducer loses e⁻.',
  'learn.task.hint.redox.s3': 'Who loses electrons, who gains?',
  'learn.task.hint.ion.s1': 'Split compounds into ions — soluble or precipitate?',
  'learn.task.hint.ion.s2': 'Remove spectator ions.',
  'learn.task.hint.ion.s3': 'Net ionic equation — active species only.',
  'learn.task.hint.chain.s1': 'In water electrolysis, at the cathode…',
  'learn.task.hint.chain.s2': 'Cathode is negative — cations go there.',
  'learn.task.hint.qual.s1': 'Ba²⁺ forms a precipitate with SO₄²⁻.',
  'learn.task.hint.qual.s2': 'White BaSO₄ precipitate is characteristic.',
  'learn.task.hint.qual.s3': 'Pick a reagent containing SO₄²⁻.',

  'learn.T.periodicity.title': 'Periodicity',
  'learn.T.periodicity.summary': 'Mendeleev’s law, comparing elements across a period and down a group.',
  'learn.T.periodicity.experiment':
    'Open the periodic table in the app and compare two neighbours by configuration and oxidation states.',

  'learn.T.bond_types.title': 'Types of chemical bond',
  'learn.T.bond_types.summary': 'Covalent and ionic bonding with simple formulas.',
  'learn.T.bond_types.experiment':
    'In the catalog find a covalent molecule and an ionic salt; compare their 3D models.',

  'learn.T.oxides_acidic.title': 'Acidic oxides',
  'learn.T.oxides_acidic.summary': 'Link to acids; examples CO₂, SO₂, SO₃ in the curriculum.',
  'learn.T.oxides_acidic.experiment':
    'Write a reaction of an oxide with water or a base for one “oxide” entry from the catalog.',

  'learn.T.oxides_basic.title': 'Basic oxides',
  'learn.T.oxides_basic.summary': 'Metal(I–II) oxides and hydroxides from reaction with water.',
  'learn.T.oxides_basic.experiment':
    'Compare CaO and Na₂O in the catalog: composition, category, and the teaching equation on the card.',

  'learn.T.oxides_amphoteric.title': 'Amphoteric oxides',
  'learn.T.oxides_amphoteric.summary': 'Al₂O₃, ZnO — reactions with acids and alkalis (per syllabus).',
  'learn.T.oxides_amphoteric.experiment':
    'Open the Al₂O₃ card and write two typical reactions: with acid and with alkali solution.',

  'learn.T.acids_strong.title': 'Strong acids',
  'learn.T.acids_strong.summary': 'Full dissociation; examples HCl, H₂SO₄, HNO₃.',
  'learn.T.acids_strong.experiment':
    'In the lab, set up an equation with a strong acid and a metal (only as allowed by your teacher).',

  'learn.T.acids_weak.title': 'Weak acids and equilibrium',
  'learn.T.acids_weak.summary': 'Incomplete dissociation; carbonic acid and CO₂ in water.',
  'learn.T.acids_weak.experiment':
    'Explain in words how an H₂CO₃ solution differs from a single gas-phase molecule in 3D.',

  'learn.T.bases_alkali.title': 'Alkalis and hydroxides',
  'learn.T.bases_alkali.summary': 'NaOH, KOH — strong bases, common reaction patterns.',
  'learn.T.bases_alkali.experiment':
    'Write the ionic equation for NaOH + HCl neutralization on paper.',

  'learn.T.salts_ionic.title': 'Ionic salts',
  'learn.T.salts_ionic.summary': 'Crystal, ions, dissociation; NaCl as the reference case.',
  'learn.T.salts_ionic.experiment':
    'Find another binary salt in the catalog and write its dissociation equation.',

  'learn.T.salts_solubility.title': 'Solubility and exchange',
  'learn.T.salts_solubility.summary': 'Solubility table, ion exchange, gas and precipitate.',
  'learn.T.salts_solubility.experiment':
    'Think of a reaction that releases CO₂ gas from a salt and an acid; check formulas in the catalog.',

  'learn.T.gases_nitrogen.title': 'Nitrogen oxides',
  'learn.T.gases_nitrogen.summary': 'NO, NO₂, nitrogen oxidation states, environmental context.',
  'learn.T.gases_nitrogen.experiment':
    'Compare NO and NO₂ cards: gas colour (from text), oxide type, typical reactions.',

  'learn.T.gases_sulfur.title': 'Sulfur oxides',
  'learn.T.gases_sulfur.summary': 'SO₂, SO₃ — acidic oxides, link to sulfur acids.',
  'learn.T.gases_sulfur.experiment':
    'Build a chain SO₂ → sulfurous acid → one salt step as an equation.',

  'learn.T.halogens_intro.title': 'Halogens (intro)',
  'learn.T.halogens_intro.summary': 'HCl, common oxidisers, link to activity series.',
  'learn.T.halogens_intro.experiment':
    'Open HCl and MnO₂ in the catalog; discuss with your teacher where a mixture could be unsafe.',

  'learn.T.metals_activity.title': 'Metals and metal oxides',
  'learn.T.metals_activity.summary': 'Activity series (idea), CuO as a copper(II) oxide.',
  'learn.T.metals_activity.experiment':
    'Write one reduction of copper(II) oxide by a reductant from the school course.',

  'learn.T.redox_intro.title': 'Redox basics',
  'learn.T.redox_intro.summary': 'Oxidant, reductant, oxidation numbers, balancing.',
  'learn.T.redox_intro.experiment':
    'Open the lab and balance a simple electron-transfer equation.',

  'learn.T.electrolysis_intro.title': 'Electrolysis (ideas)',
  'learn.T.electrolysis_intro.summary': 'Ions in melt vs solution, cathode and anode at a qualitative level.',
  'learn.T.electrolysis_intro.experiment':
    'For NaCl, list which ions could discharge in solution vs in melt (sketch).',

  'learn.T.water_chemistry.title': 'Water and solutions',
  'learn.T.water_chemistry.summary': 'H₂O dipole, solvent, pH linked to acidity.',
  'learn.T.water_chemistry.experiment':
    'Relate the water 3D model to ion hydration when a salt dissolves.',

  'learn.T.qual_analysis.title': 'Qualitative analysis (orientation)',
  'learn.T.qual_analysis.summary': 'Solution colour, oxidisers — potassium dichromate example.',
  'learn.T.qual_analysis.experiment':
    'Read the K₂Cr₂O₇ card: where is the oxidiser, what precautions apply in class?',


  'learn.T.industrial_touch.title': 'Chemistry and industry',
  'learn.T.industrial_touch.summary': 'Contact process, sulfuric acid, SO₃ as a chain link.',
  'learn.T.industrial_touch.experiment':
    'Draw a block diagram SO₂ → SO₃ → H₂SO₄ from your textbook (no plant numbers).',

  'learn.T.safety_lab.title': 'Safety and ATOMLAB lab',
  'learn.T.safety_lab.summary': 'The virtual environment does not replace real classroom rules.',
  'learn.T.safety_lab.experiment':
    'Run one scenario in the app lab and compare with your teacher’s instructions for real experiments.',

  'learn.L.l_periodicity.title': 'Periodicity and trends',
  'learn.L.l_periodicity.s0':
    'Across a period, higher nuclear charge pulls valence electrons more: metallic character weakens left to right.',
  'learn.L.l_periodicity.s1':
    'Down a group, atomic radius grows; compare Na and K from the periodic table text.',
  'learn.L.l_periodicity.h_b':
    'Water is a simple example of polar covalent bonds and hydrogen bonding in condensed phases.',
  'learn.L.l_periodicity.s3':
    'Relate an element’s position to its oxide type (acidic / basic) using catalog examples.',

  'learn.L.l_bond_types.title': 'Bonding: covalent and ionic',
  'learn.L.l_bond_types.s0':
    'Covalent bonding shares electron pairs; ionic bonding transfers electrons between atoms with different electronegativity.',
  'learn.L.l_bond_types.s1':
    'Ionic character grows with ΔEN; ball-and-stick 3D shows which atoms are neighbours.',
  'learn.L.l_bond_types.h_b': 'Bent water illustrates polar O—H bonds.',
  'learn.L.l_bond_types.s3':
    'Pick a salt in the catalog and explain why Na—Cl in the crystal is treated as ionic.',

  'learn.L.l_oxides_acidic.title': 'Acidic oxides',
  'learn.L.l_oxides_acidic.s0':
    'An acidic oxide reacts with water (often equilibrium) and with bases to give salt and water.',
  'learn.L.l_oxides_acidic.s1': 'CO₂ is the classic acidic oxide of carbon(IV); key for natural water acidity.',
  'learn.L.l_oxides_acidic.h_b': 'Linear CO₂: a model for hybridisation and acidic character.',
  'learn.L.l_oxides_acidic.s3':
    'Write CO₂ with excess NaOH to a normal salt (balance coefficients).',

  'learn.L.l_oxides_basic.title': 'Basic oxides',
  'learn.L.l_oxides_basic.s0':
    'Active metal(I–II) oxides are basic: with water → hydroxide, with acid → salt and water.',
  'learn.L.l_oxides_basic.s1': 'CaO appears in building chemistry and as a drying agent in teaching setups.',
  'learn.L.l_oxides_basic.h_b': 'Simplified binary calcium oxide model from the catalog.',
  'learn.L.l_oxides_basic.s3': 'Compare products of CaO + H₂O and Na₂O + H₂O by hydroxide type.',

  'learn.L.l_oxides_amphoteric.title': 'Amphoteric oxide',
  'learn.L.l_oxides_amphoteric.s0':
    'An amphoteric oxide reacts with both acid and alkali — conditions (solution, concentration) matter.',
  'learn.L.l_oxides_amphoteric.s1': 'Al₂O₃ is the textbook school example.',
  'learn.L.l_oxides_amphoteric.h_b': 'Inspect Al—O connectivity in the catalog geometry.',
  'learn.L.l_oxides_amphoteric.s3':
    'Write two molecular equations: Al₂O₃ + acid and Al₂O₃ + alkali (products per syllabus).',

  'learn.L.l_acids_strong.title': 'Strong acids',
  'learn.L.l_acids_strong.s0':
    'In dilute aqueous solution a strong acid is almost fully dissociated; 3D shows the molecule without solvent.',
  'learn.L.l_acids_strong.s1': 'H₂SO₄ is both acid and oxidiser when concentrated — follow safety rules.',
  'learn.L.l_acids_strong.h_b': 'Sulfuric acid structure fragment from the catalog.',
  'learn.L.l_acids_strong.s3': 'Write the net ionic equation for H₂SO₄ + NaOH in dilute solution.',

  'learn.L.l_acids_weak.title': 'Weak acids',
  'learn.L.l_acids_weak.s0':
    'Carbonic acid in equilibrium with CO₂ and water — weak acid linked to an oxide.',
  'learn.L.l_acids_weak.s1': 'In solution ions and molecules both matter; one H₂CO₃ gas molecule is not the whole solution.',
  'learn.L.l_acids_weak.h_b': 'Teaching model of carbonic acid.',
  'learn.L.l_acids_weak.s3':
    'Explain why “CO₂ in water” acidifies the medium even though CO₂ itself is not a Brønsted acid.',

  'learn.L.l_bases_alkali.title': 'Sodium hydroxide and alkalinity',
  'learn.L.l_bases_alkali.s0':
    'NaOH dissociates fully in water; solid is hygroscopic — real lab only per instructions.',
  'learn.L.l_bases_alkali.s1': 'Alkalis react with acids, acidic oxides, and many salts per solubility rules.',
  'learn.L.l_bases_alkali.h_b': 'NaOH model: Na—O—H.',
  'learn.L.l_bases_alkali.s3': 'Write NaOH + CuSO₄ with a precipitate in net ionic form.',

  'learn.L.l_salts_ionic.title': 'NaCl as a salt model',
  'learn.L.l_salts_ionic.s0':
    'In the NaCl crystal ions alternate; 3D shows ion centre distances in the teaching model.',
  'learn.L.l_salts_ionic.s1': 'Melting and dissolution mobilise ions; electrolysis is a separate topic.',
  'learn.L.l_salts_ionic.h_b': 'Inspect Na⁺ and Cl⁻ placement in the catalog model.',
  'learn.L.l_salts_ionic.s3': 'Write molten NaCl electrolysis in general qualitative form.',

  'learn.L.l_salts_solubility.title': 'Salts and solubility',
  'learn.L.l_salts_solubility.s0':
    'NaHCO₃ is an acidic salt of carbonic acid; appears with acids and in water hardness discussion.',
  'learn.L.l_salts_solubility.s1': 'Ion exchange needs gas, water, or precipitate — check the solubility table.',
  'learn.L.l_salts_solubility.h_b': 'Catalog model for baking soda ions.',
  'learn.L.l_salts_solubility.s3': 'Write NaHCO₃ + HCl in molecular and net ionic form.',

  'learn.L.l_gases_nitrogen.title': 'Nitrogen oxides',
  'learn.L.l_gases_nitrogen.s0':
    'NO oxidises easily in air; NO₂ gives acidic aqueous behaviour and NOₓ cycles.',
  'learn.L.l_gases_nitrogen.s1': 'Nitrogen oxidation states from +1 to +5 anchor many equations.',
  'learn.L.l_gases_nitrogen.h_b': 'Bent NO₂ in 3D.',
  'learn.L.l_gases_nitrogen.s3': 'Write NO₂ + H₂O per your textbook.',

  'learn.L.l_gases_sulfur.title': 'Sulfur dioxide',
  'learn.L.l_gases_sulfur.s0': 'SO₂ dissolves in water with acidic behaviour; industry and sulfurous acid.',
  'learn.L.l_gases_sulfur.s1': 'Oxidation SO₂ → SO₃ is central to sulfuric acid manufacture.',
  'learn.L.l_gases_sulfur.h_b': 'S—O bonds in SO₂.',
  'learn.L.l_gases_sulfur.s3': 'Compare SO₂ and CO₂ as acidic oxides by typical reactions.',

  'learn.L.l_halogens_intro.title': 'Hydrochloric acid and halogens',
  'learn.L.l_halogens_intro.s0':
    'HCl in water is a strong electrolyte; in the gas phase it is one polar molecule.',
  'learn.L.l_halogens_intro.s1': 'Halogens as oxidisers follow reaction chains; safety first.',
  'learn.L.l_halogens_intro.h_b': 'HCl model.',
  'learn.L.l_halogens_intro.s3': 'Write HCl + NH₃ in gas phase and in solution (two formulations).',

  'learn.L.l_metals_activity.title': 'Copper(II) oxide',
  'learn.L.l_metals_activity.s0':
    'CuO is a basic oxide; with acids it gives Cu(II) salts, with reductants — copper metal.',
  'learn.L.l_metals_activity.s1': 'Compare Cu in the activity series with Zn in dilute acid.',
  'learn.L.l_metals_activity.h_b': 'CuO model in the catalog.',
  'learn.L.l_metals_activity.s3': 'Balance CuO + H₂SO₄ → salt + water.',

  'learn.L.l_redox_intro.title': 'Redox and balancing',
  'learn.L.l_redox_intro.s0':
    'Assign oxidation numbers before and after; electron balance is the standard tool.',
  'learn.L.l_redox_intro.s1': 'MnO₂ is often an oxidiser in lab schemes (only per method sheet).',
  'learn.L.l_redox_intro.h_b': 'MnO₂ structural model in the catalog.',
  'learn.L.l_redox_intro.s3': 'Open the lab and pick a simple equation with changing oxidation numbers.',

  'learn.L.l_electrolysis_intro.title': 'Electrolysis and ions',
  'learn.L.l_electrolysis_intro.s0':
    'In molten NaCl, Na⁺ and Cl⁻ discharge; in aqueous solution H⁺ and OH⁻ from water compete.',
  'learn.L.l_electrolysis_intro.s1': 'Cathode reduces, anode oxidises — learn the qualitative direction.',
  'learn.L.l_electrolysis_intro.h_b': 'NaCl model to discuss ions.',
  'learn.L.l_electrolysis_intro.s3': 'Sketch aqueous NaCl electrolysis with inert electrodes (qualitative).',

  'learn.L.l_water_chemistry.title': 'Water as solvent',
  'learn.L.l_water_chemistry.s0':
    'Polar molecules dissolve better in water; ions become hydrated.',
  'learn.L.l_water_chemistry.s1': 'pH links to H⁺ concentration; acids and bases shift pH.',
  'learn.L.l_water_chemistry.h_b': 'H₂O model.',
  'learn.L.l_water_chemistry.s3': 'Explain why aqueous NaCl is about neutral (pH ≈ 7 at 25 °C).',

  'learn.L.l_qual_analysis.title': 'Potassium dichromate',
  'learn.L.l_qual_analysis.s0':
    'K₂Cr₂O₇ is a strong oxidiser in acid; labels and classroom rules matter.',
  'learn.L.l_qual_analysis.s1': 'Chromium(VI) colour is used in oxidation demos.',
  'learn.L.l_qual_analysis.h_b': 'Salt model in the catalog.',
  'learn.L.l_qual_analysis.s3': 'Write the reduction half-reaction of Cr₂O₇²⁻ in acid (qualitative).',

  'learn.L.l_industrial_touch.title': 'Sulfur trioxide',
  'learn.L.l_industrial_touch.s0':
    'SO₃ is the acidic oxide of sulfur(VI); contact process leads to sulfuric acid.',
  'learn.L.l_industrial_touch.s1': 'Hygroscopicity and reaction with water release a lot of heat (text only).',
  'learn.L.l_industrial_touch.h_b': 'SO₃ model in the catalog.',
  'learn.L.l_industrial_touch.s3':
    'Write SO₃ + H₂O and discuss the catalyst’s role in the two-step oxidation of SO₂.',

  'learn.L.l_safety_lab.title': 'The in-app laboratory',
  'learn.L.l_safety_lab.s0':
    'ATOMLAB is a teaching visual: the reactor checks balance and shows a 3D product, not PPE or ventilation.',
  'learn.L.l_safety_lab.s1': 'Real experiments only with a teacher and a method sheet.',
  'learn.L.l_safety_lab.s2':
    'Learn the periodic table and substance catalog first, then try the virtual reactor.',

  ...learnHubI18nEn,
  ...learnLessonExtraEn,
  ...learnPathwayEn,

  'learn.tryLabLessonBody':
    'Go to “Laboratory”, open the reactor (reagents — periodic table ⊞ on the right), pick a catalog product, and balance the reaction. This is a teaching model.',
} satisfies Record<keyof typeof learnPackRu, string>

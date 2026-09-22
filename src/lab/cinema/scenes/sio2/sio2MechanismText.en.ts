import type { Sio2MechanismText } from './sio2MechanismText'

/** English lesson text for Si + O₂ → SiO₂. Every number matches the Russian text and the data core. */
export const SIO2_TEXT_EN: Sio2MechanismText = {
  intro: {
    title: 'Atomic crystal: SiO₂',
    speak: 'Let us see why silicon dioxide is a stone while carbon dioxide is a gas.',
  },
  steps: {
    reactants: {
      title: 'Starting materials',
      body:
        'In the centre is one unit cell of crystalline silicon: a diamond-type lattice (Fd-3m), edge a = 543.1 pm. ' +
        'Each Si atom is bonded to four neighbours by single Si–Si σ-bonds 235.2 pm long, pointing to the corners of a tetrahedron, like carbon in diamond. ' +
        'On the right and on the left are two oxygen molecules O₂: a double O=O bond, 120.75 pm (rₑ), and two unpaired electrons (a triplet). At 25 °C silicon is a solid and oxygen is a gas.',
      equation: 'Si (s) + O₂ (g)',
      note:
        'One cell of a whole crystal is shown; Si–Si bonds are drawn as tubes because silicon is an atomic (covalent) crystal, not a metal. ' +
        'The balls are Cordero covalent radii (Si 111 pm, O 66 pm) at 0.72 scale: at full radius neighbouring atoms would hide the bonds. ' +
        'Two O₂ molecules are taken for the one Si atom that will build a tetrahedron: every O atom of the framework is shared by two Si, so the formula SiO₂ needs exactly one O₂ molecule. The cell is turned so that its bonds point to where the O atoms will sit.',
      speak: 'In the centre is a silicon crystal, oxygen molecules are on the sides. Silicon is built like diamond: every atom has four neighbours.',
    },
    surface: {
      title: 'Oxygen at the surface',
      body:
        'Oxygen approaches the silicon surface and the O=O bond breaks homolytically: each O atom takes two unpaired electrons. ' +
        'In air silicon is always covered with its own amorphous SiO₂ film 1–2 nm thick, and oxygen has to make its way to the silicon through it — so at 25 °C oxidation almost stops, and thick oxide is grown only by heating in oxygen or steam. ' +
        'Formally splitting O₂ into atoms costs 2 × 249.2 = 498.4 kJ per mole of O₂.',
      equation: 'O₂ (g) → 2 O',
      note:
        'The oxide film is not drawn: 1–2 nm is thicker than the whole cell shown (0.54 nm), it would hide the atoms. ' +
        'The rest of the silicon crystal is removed from the frame; one Si atom and its four neighbours remain — oxygen lands at their bonds. ' +
        'Atomic oxygen is O(³P) with two unpaired electrons, so every O atom carries six valence dots: two pairs and two singles. Splitting O₂ into atoms is a Hess-law step: on a real surface oxygen spreads over the silicon bonds without flying off into the gas.',
      speak: 'The oxygen molecule splits into atoms at the surface. Silicon is covered by a thin oxide film, so at room temperature it hardly oxidises.',
    },
    insertion: {
      title: 'Four Si–O bonds',
      body:
        'An O atom inserts into an Si–Si bond: the shared pair of that bond and the two unpaired electrons of oxygen form two Si–O σ-bonds, giving an Si–O–Si bridge. ' +
        'This happens four times, once per bond of the Si atom: the central silicon ends up bonded to four O atoms, mean Si–O bond length 160.9 pm (in quartz 160.5 and 161.4 pm). ' +
        'The bond is polar: the electronegativity of O is 3.44 against 1.9 for Si (difference 1.54), the shared pairs are shifted towards oxygen — O carries a partial charge δ−, Si δ+. The Si–O bond is 2.1 times stronger than Si–Si: 464.8 against 225.0 kJ/mol.',
      equation: 'Si–Si + O → Si–O–Si  (×4)',
      note:
        'The neighbouring Si atoms move apart: the Si–O–Si bridge is longer than the Si–Si bond, so the oxide takes more room than the silicon it grew from. ' +
        'Four insertions are shown one after another around one atom — at a real Si/SiO₂ interface they run along the whole oxidation front. ' +
        'The labels δ+ and δ− are partial charges: SiO₂ is a polar covalent framework, it contains no Si⁴⁺ or O²⁻ ions, so the ball radii are covalent, not ionic. The dots on a bridging O are two lone pairs; two more oxygen electrons went into the Si–O bonds.',
      speak: 'An oxygen atom slips in between two silicon atoms. Four times — and silicon has four bonds to oxygen.',
    },
    tetrahedra: {
      title: 'The SiO₄ tetrahedron',
      body:
        'The four O atoms around Si sit at the corners of a tetrahedron: the O–Si–O angle is 109.5°. Every O is a shared corner of two SiO₄ tetrahedra, the Si–O–Si angle is 143.7°; one Si atom owns 4 × ½ = 2 O atoms — hence the formula SiO₂, although there is no separate SiO₂ molecule. ' +
        'Why not an O=Si=O molecule like CO₂? For carbon two double bonds beat four single ones: 2 × 799 = 1598 against 4 × 358 = 1432 kJ/mol — and CO₂ stays a gas of separate molecules. ' +
        'For silicon four Si–O σ-bonds give 4 × 464.8 = 1859.2 kJ/mol, while the Si=O π-bond is weak: the large Si atom overlaps poorly with its 3p orbital and the 2p orbital of oxygen. So silicon builds an endless framework, and SiO₂ is a hard stone.',
      equation: 'n Si + 2n O → (SiO₂)ₙ',
      note:
        'The CO₂ nearby is a comparison molecule, visible only on this step. Bond energies are mean table values (C–O in alcohols and ethers, C=O in CO₂ itself), so the comparison is an estimate. ' +
        'The energy of a double Si=O bond is known only for separate gas molecules — there is no such bond in the framework, and we do not label it with a number. The dotted lines are tetrahedron edges (O···O), not bonds.',
      speak: 'Oxygen sits at the corners of a tetrahedron, and every corner is shared by two tetrahedra. Four single bonds of silicon to oxygen beat double ones — that is why we get a stone, not a gas.',
    },
    quartz: {
      title: 'The α-quartz framework',
      body:
        'When the tetrahedra are linked by their corners in an ordered way, we get α-quartz, the stable form of SiO₂ at 25 °C: space group P3₂21, cell a = 491.6 pm, c = 540.5 pm, Z = 3, density 2.646 g/cm³. ' +
        'Each Si is surrounded by four O, each O by two Si: coordination numbers 4:2. The tetrahedra are twisted into helical chains around 3₂ screw axes. ' +
        'But note: direct oxidation of silicon grows AMORPHOUS SiO₂ — the same tetrahedra linked without long-range order (the Deal–Grove model describes this oxide growth), while quartz crystals grow from a melt or from hot water solutions deep underground (hydrothermally).',
      equation: 'Si (s) + O₂ (g) → SiO₂ (s)',
      note:
        'The frame shows a fragment of 2×2×2 unit cells — 86 atoms; the light lines are cell edges, the dotted line is one helical chain. The α-quartz framework is shown as the stable form of SiO₂; on silicon itself the oxide is amorphous. ' +
        'The mirror twin of quartz has 3₁ screw axes — it is the other enantiomorph. Atoms at the edge of the fragment look cut off: in the crystal they have neighbours beyond the frame.',
      speak: 'An ordered framework of tetrahedra is quartz. But on silicon the oxide grows amorphous, and quartz crystals grow from melts and hot solutions.',
    },
    energy: {
      title: 'Energy balance',
      body:
        'Add up the Hess-law steps per mole of SiO₂: +450.0 (atomisation of Si) + 498.4 (2 O atoms) − 1859.2 (4 Si–O bonds) = −910.8 kJ/mol; the table enthalpy of formation of α-quartz is −910.7 kJ/mol. ' +
        'All the costs come to 948.4 kJ/mol, and the four Si–O bonds give back almost twice as much. ' +
        'The framework can be destroyed only by breaking Si–O bonds throughout the crystal, so quartz is hard and refractory, and acids other than hydrofluoric acid do not attack it: SiO₂ + 4 HF → SiF₄↑ + 2 H₂O.',
      equation: 'Si (s) + O₂ (g) → SiO₂ (s),  ΔH = −910.7 kJ',
      note:
        'Atomisation of silicon (+450.0) is a formal Hess-law step: there are no free Si atoms during oxidation. The sum of the steps differs from the table ΔH°f by 0.1 kJ/mol — the mean Si–O bond energy (464.8) is rounded to tenths. ' +
        'Formal electron balance: Si⁰ − 4e⁻ → Si⁺⁴, O₂⁰ + 4e⁻ → 2 O⁻² — these are oxidation states, not ionic charges; the real partial charges are δ+ and δ−. The balls are drawn at 0.72 of the covalent radius; the tetrahedron dots are a guide, not a glow.',
      speak: 'Result: minus nine hundred and ten kilojoules per mole. The energy comes from four strong bonds of silicon to oxygen.',
    },
  },
  legend: {
    electron: 'Blue dots around O are Lewis valence electrons: six on an O atom, four (two lone pairs) on a bridging O.',
    orbitalPhase: 'Tubes are σ-bonds; translucent lobes above and below the O=O and C=O axes are π-bonds; dotted lines are SiO₄ tetrahedron edges and a helical chain.',
  },
  safety:
    'Do not repeat on your own: silicon burns in oxygen only when strongly heated, and fine silicon and quartz dust harms the lungs (silicosis). Hydrofluoric acid HF, which dissolves glass and quartz, is highly toxic and penetrates the skin — only a specialist may work with it.',
  energy: {
    title: 'Hess cycle',
    unit: 'kJ/mol',
    caption: 'Costs (up) and gains (down) per 1 mol of SiO₂; the sum of the steps is the enthalpy of formation.',
    stages: {
      atomization: 'Si (s) → Si (g)',
      dissociation: 'O₂ → 2 O',
      bonds: 'Si + 2 O → SiO₂ (4 Si–O)',
      total: 'Total: ΔH°f',
    },
    summary: 'Hess cycle for SiO₂: sum of steps {dH} kJ/mol',
    sources: 'Reference values: NIST-JANAF, CRC Handbook; the Si–O bond energy is derived from the atomisation of α-quartz.',
  },
}

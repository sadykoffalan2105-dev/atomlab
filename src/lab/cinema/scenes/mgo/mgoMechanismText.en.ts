import type { MgoMechanismText } from './mgoMechanismText'

export const MGO_TEXT_EN: MgoMechanismText = {
  intro: {
    title: 'Ionic bond: two electrons',
    speak: 'Let us watch magnesium burn: every magnesium atom hands two electrons to oxygen.',
  },
  steps: {
    reactants: {
      title: 'Starting substances',
      body:
        'On the left is a piece of magnesium metal: 2×2×1 unit cells of hexagonal close packing (HCP, P6₃/mmc), a = 320.9 pm, c = 521.1 pm. Every atom has twelve nearest neighbours: six in its own layer at 320.9 pm and six in the adjacent layers at 319.7 pm. ' +
        'On the right is an oxygen molecule O₂: its atoms are held by a double bond (σ + π) 120.75 pm long; breaking it takes 498.4 kJ/mol. ' +
        'The radius of a magnesium atom in the metal is 160 pm, the covalent radius of oxygen is 66 pm. At 25 °C oxygen is a gas and magnesium is a silvery metal (m.p. 650 °C) under a thin oxide film.',
      equation: '2 Mg (s) + O₂ (g)',
      note:
        'Oxygen reacts as the O₂ MOLECULE — there are no single oxygen atoms in air. The O₂ molecule is a triplet: it has two unpaired electrons. The Lewis line O=O (σ + π) does not explain this — in it all electrons are paired; the triplet is explained only by molecular orbital theory: two electrons sit in different π* orbitals, and the bond order is still 2. The π lobes beside the axis are a simplified drawing. ' +
        'The oxide film, from a few nanometres thick, is thicker than the whole piece shown, so the frame shows the metal beneath the film and the film itself is not drawn. The faint threads in the metal are a sketch of metallic bonding (electrons shared by the whole crystal), not separate bonds; the frame shows 8 atoms, while a school ribbon of 0.1–1 g holds on the order of 10²¹–10²². ' +
        'The reaction involves 2 Mg atoms and one O₂ molecule; the other 6 atoms of the piece leave the frame — a change of shot, not matter disappearing.',
      speak: 'On the left is magnesium metal, on the right an oxygen molecule with a double bond.',
    },
    ignition: {
      title: 'Ignition',
      body:
        'The reaction does not start by itself: magnesium is covered by an oxide film and the O=O bond is strong. A burner flame gives the first push — then magnesium burns on its own with a dazzling white light. ' +
        'We count the energy with the Born–Haber cycle. Its first steps: a magnesium atom is taken from the metal into the gas — 147.1 kJ per mole (sublimation), and the O=O double bond is broken homolytically: half a mole of O₂ needs 249.2 kJ — the enthalpy of formation of atomic oxygen ΔH°f(O, g). ' +
        'Both steps are endothermic — the energy ladder goes up.',
      equation: 'Mg (s) → Mg (g);  ½ O₂ (g) → O (g)',
      note:
        'Steps 2–6 are not the timeline of burning but a thermochemical cycle: an imaginary path for counting energy. By Hess’s law ΔH does not depend on the path, so any convenient path gives the same heat. ' +
        'In reality magnesium already boils at 1090 °C — far below the volatilization temperature of MgO — and by the Glassman criterion it burns in the vapour phase: Mg vapour reacts with oxygen in the gas (Mg + O₂ → MgO + O, Mg + O → MgO), and MgO condenses into white smoke. Free O²⁻ ions never form in this process. ' +
        'The flame is not drawn in 3D; its white light is thermal radiation of hot MgO particles. The temperature ceiling is set by the product itself: at about 3430 K (≈ 3157 °C) liquid MgO vaporizes and falls apart into atoms, MgO (l) → Mg (g) + O (g), and this stage absorbs all the extra heat. ' +
        'A ribbon burning in air measures 2200–3100 °C: the spread depends on the method and on the place in the flame, and the top of the range is only ≈ 57 K below the ceiling — oxide volatilization limits the temperature in air too. Do not confuse: 3105 K (≈ 2830 °C, NIST-JANAF) is the melting point of MgO, not its boiling point. ' +
        'After the break every O atom carries two unpaired electrons (the O(³P) state).',
      speak: 'Ignition — and magnesium bursts into a white flame. Atoms leave the metal, the bond in the oxygen molecule breaks in two.',
    },
    transfer: {
      title: 'The first electron',
      body:
        'Magnesium has two electrons in its outer shell (3s²) and gives them away one at a time. The first leaves for 737.7 kJ/mol (IE₁) — this makes the ion Mg⁺. ' +
        'Oxygen takes this electron and becomes the ion O⁻, and energy is released: Δ_eg H = −141.0 kJ/mol. In IUPAC usage the same quantity is called the electron affinity and written with a plus sign: +141.0 kJ/mol — one process, only the sign convention differs. ' +
        'While the electron is in flight, charge is conserved: the charges of the ions and of the flying electrons add up to zero.',
      equation: 'Mg (g) − 1e⁻ → Mg⁺ (g);  O (g) + 1e⁻ → O⁻ (g)  (×2)',
      note: 'The dots around the atoms count valence electrons in the Lewis manner (two on Mg, six on O, seven on O⁻), not their positions. The electron “flying” along an arc and the slowed time are conventions: the transition is quantum. The intermediate particles Mg⁺ and O⁻ have no tabulated ionic radii, so the ball sizes do not change at this step — only the charge and the label change.',
      speak: 'Each magnesium atom gives away its first electron, and oxygen accepts it with a gain of energy.',
    },
    second: {
      title: 'The second electron',
      body:
        'The second electron leaves an already positive ion Mg⁺, so it costs almost twice as much: 1450.7 kJ/mol (IE₂). Magnesium loses its whole outer shell and shrinks from 160 to 72 pm — the cation Mg²⁺. ' +
        'But oxygen accepts the second electron AT A COST: +744 kJ/mol — the O⁻ ion is already negative and repels the next electron. In return it completes its octet and grows from 66 to 140 pm: the O²⁻ anion is 1.94 times larger than Mg²⁺.',
      equation: 'Mg⁺ (g) − 1e⁻ → Mg²⁺ (g);  O⁻ (g) + 1e⁻ → O²⁻ (g)  (×2)',
      note: 'A free O²⁻ ion is unstable in the gas and loses the extra electron at once, so EA₂ is not measured directly: it is calculated from Born–Haber cycles, and the literature gives values from +744 to +844 kJ/mol. The project core keeps +744 together with the MgO lattice energy −3789 kJ/mol — one number cannot be changed without the other. Radii of different kinds are compared: the metallic radius of Mg and the covalent radius of O against Shannon ionic radii; the trend is right, but the scales differ.',
      speak: 'Magnesium gives away its second electron and shrinks sharply. Oxygen accepts it at an energy cost, but gets a complete octet.',
    },
    attraction: {
      title: 'Electrostatic attraction',
      body:
        'Opposite ions attract each other by Coulomb’s law and in the cycle come closer until the attraction is balanced by the repulsion of the filled electron shells. A single gas-phase MgO molecule really exists; its equilibrium distance is 174.9 pm. ' +
        'But it is not a ±2 pair: a lone O²⁻ ion cannot hold its second electron, and in the molecule the charges even out to about ±1. Charges of ±2 are stable only in the crystal, where every ion is surrounded by counter-ions (step 6).',
      equation: 'Mg²⁺ (g) + O²⁻ (g) → MgO (g) — formally;  real MgO (g): rₑ = 174.9 pm',
      note:
        'The labels Mg²⁺ and O²⁻ at this step are the formal charges of the cycle. The real MgO (g) molecule is closer to Mg⁺O⁻: its dipole moment is ≈ 6.2 D, while point charges ±2 at 174.9 pm would give 16.8 D (±1 — 8.4 D); the distance 174.9 pm is shown for this real molecule. ' +
        'The sum of the Shannon ionic (effective) radii for CN 6 — 72 + 140 = 212 pm — is larger than 174.9 pm: the spheres of the gas-phase pair overlap by 37 pm. This is not a mistake: in the gas the ions strongly polarize each other, and Shannon gives no radii for a lone pair. At this step the balls are drawn at the full Shannon radius (at steps 1–4 — at 0.72 of the radius), so the overlap is visible. ' +
        'In the crystal the same pair sits at 210.6 pm (step 6). The dotted arcs sketch field lines; two pairs instead of an enormous number are a simplification.',
      speak: 'Opposite ions attract. In a real gas-phase magnesium oxide molecule the nuclei come within one hundred seventy-five picometres, but its charges are closer to one than to two.',
    },
    lattice: {
      title: 'Lattice and refractoriness',
      body:
        'Every ion attracts all its neighbours, and the ions pack into the same lattice type as rock salt: Fm3̄m, two FCC sublattices, cell edge a = 421.1 pm, Z = 4, density 3.58 g/cm³. Each Mg²⁺ has six O²⁻ neighbours and vice versa — CN 6:6. In the crystal equilibrium is reached farther out than in the gas: 210.6 pm instead of 174.9 pm. ' +
        'Assembling the lattice releases 3789 kJ/mol — 4.8 times more than for NaCl (787). Why not exactly four times? The attraction energy is proportional to q₁q₂/r (not 1/r², like the force): the charge product gives a factor of 4, the shorter distance another 282.0/210.6, about 5.4 in total for point charges. Shell repulsion lowers both energies almost equally — for MgO only a couple of per cent more — so the real 4.8 has another cause: the effective charge in MgO is less than 2 (the O²⁻ ion exists only in the field of the lattice), and U(MgO) itself is derived through the unmeasured EA₂ — with +844 instead of +744 the ratio would be ≈ 4.9. ' +
        'Hence the refractoriness: MgO melts at about 2830 °C, NaCl at 801 °C.',
      equation: 'Mg²⁺ (g) + O²⁻ (g) → MgO (s),  U = −3789 kJ/mol',
      note:
        'The frame shows a fragment of 2×2×2 unit cells — 125 ions, 5 along each edge; the light lines are cell edges, not bonds. Apart from the four story ions, the lattice ions are products of other identical events: the remaining 121 ions enter the frame ready-made. The fragment has 63 Mg²⁺ ions and 62 O²⁻ ions, so the cut-out carries a net charge (+2), while a real crystal is neutral — a simplification. ' +
        'The lattice balls are drawn at 0.5 of the radius so that the edges show through the fragment: in a real crystal neighbouring ions touch (72 + 140 = 212 ≈ 210.6 pm). Reference books give the melting point of MgO from 2825 to 2852 °C; one core value is used here — 2830 °C; MgO boils with decomposition at about 3600 °C. The lattice step −3789 is consistent with EA₂ = +744; the CRC Handbook gives −3791 — a difference of 0.05 %.',
      speak: 'The same lattice as salt, but with doubled charges: the lattice is almost five times stronger, and the oxide melts only at about two thousand eight hundred thirty degrees.',
    },
    energy: {
      title: 'Energy balance',
      body:
        'Add up all steps of the Born–Haber cycle: +147.1 (sublimation) + 249.2 (dissociation) + 737.7 (IE₁) + 1450.7 (IE₂) − 141.0 (EA₁) + 744.0 (EA₂) − 3789.0 (lattice) = −601.3 kJ per mole of MgO. The tabulated enthalpy of formation is −601.6: a difference of 0.3 kJ/mol, within the spread of reference data. ' +
        'Without the lattice energy the first six steps would sum to +3187.7 kJ/mol — the process would absorb a huge amount of heat. ' +
        'It is the lattice that makes the reaction exothermic: the equation 2 Mg + O₂ releases 1203.2 kJ.',
      equation: '2 Mg (s) + O₂ (g) → 2 MgO (s),  ΔH = −1203.2 kJ',
      note: 'Electron balance: 2 Mg⁰ − 4e⁻ → 2 Mg²⁺, O₂⁰ + 4e⁻ → 2 O²⁻ — as many electrons are given as are taken. The step ½ O₂ → O equals ΔH°f(O, g) = 249.2 kJ/mol at 298 K — half the O=O bond energy (498.4). The lattice step of the cycle at 298 K is strictly the lattice enthalpy; the lattice energy U differs from it by a few kJ/mol. Likewise IE and EA are values at 0 K: at 298 K each such step formally gains ±5/2 RT per electron, and in the closed cycle these corrections cancel out. The ΔH°f above the crystal is the tabulated one (−601.6), the ladder is the sum of the steps (−601.3).',
      speak: 'Result: minus six hundred one kilojoules per mole of oxide. The energy comes from the crystal lattice.',
    },
  },
  legend: {
    electron: 'The blue dot with a trail and the label e⁻ is a transferring electron; there are four in all, two from each magnesium atom.',
    orbitalPhase: 'The blue dots around an atom are Lewis valence electrons: two on Mg (3s²), six on O, seven on O⁻, eight on O²⁻. They count electrons; they are not an orbital shape.',
  },
  safety:
    'Never look straight at burning magnesium: the flame is blinding and emits ultraviolet light that is harmful to the eyes. Only the teacher shows the experiment, through dark glass. Burning magnesium must be put out neither with water — it takes oxygen from it, hydrogen is released and explodes — nor with a carbon dioxide or foam extinguisher: magnesium burns even in carbon dioxide (2 Mg + CO₂ → 2 MgO + C). Use dry sand or a class D powder.',
  energy: {
    title: 'Born–Haber cycle',
    unit: 'kJ/mol',
    caption: 'Costs (up) and gains (down) per 1 mol of MgO; the sum of the steps is the enthalpy of formation.',
    stages: {
      sublimation: 'Mg (s) → Mg (g)',
      dissociation: '½ O₂ → O',
      ionization1: 'Mg → Mg⁺ + e⁻',
      ionization2: 'Mg⁺ → Mg²⁺ + e⁻',
      affinity1: 'O + e⁻ → O⁻',
      affinity2: 'O⁻ + e⁻ → O²⁻',
      lattice: 'Mg²⁺ + O²⁻ → MgO (s)',
      total: 'Total: ΔH°f',
    },
    summary: 'Born–Haber cycle for MgO: sum of steps {dH} kJ/mol',
    sources: 'Reference values: NIST-JANAF, CRC Handbook (lattice energy and EA₂ from the Born–Haber cycle).',
  },
}

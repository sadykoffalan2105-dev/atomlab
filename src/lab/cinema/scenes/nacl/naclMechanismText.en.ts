import type { NaclMechanismText } from './naclMechanismText'

export const NACL_TEXT_EN: NaclMechanismText = {
  intro: {
    title: 'Ionic bond',
    speak: 'Let us watch sodium and chlorine become table salt: an electron moves from one atom to another.',
  },
  steps: {
    reactants: {
      title: 'Starting substances',
      body:
        'On the left is one unit cell of sodium metal: a body-centred cubic lattice (BCC, Im-3m), cell edge a = 429.1 pm, every atom with eight nearest neighbours 371.6 pm away. ' +
        'On the right is a chlorine molecule Cl₂: two atoms held by one shared electron pair (a σ bond), bond length 198.8 pm. ' +
        'The radius of a sodium atom in the metal is 186 pm, the covalent radius of chlorine 102 pm (half the Cl–Cl bond length is 99.4 pm — the difference is within the reference spread). At 25 °C chlorine is a gas and sodium a solid metal.',
      equation: '2 Na (s) + Cl₂ (g)',
      note: 'Chlorine reacts as the MOLECULE Cl₂ — there are no lone chlorine atoms in the cylinder. The pale threads in the sodium cell are a sketch of metallic bonding (electrons shared by the whole crystal), not separate bonds between pairs of atoms.',
      speak: 'A cell of sodium metal on the left, a chlorine molecule on the right. Chlorine is always diatomic.',
    },
    sublimation: {
      title: 'Sublimation and dissociation',
      body:
        'Before anything can react the particles must be set free. A sodium atom leaves the metal, which costs 107.3 kJ per mole (sublimation). ' +
        'The Cl–Cl bond breaks homolytically: the shared pair splits evenly, one electron to each atom. Half a mole of Cl₂ takes 121.3 kJ — the tabulated enthalpy of formation of atomic chlorine, ΔH°f(Cl, g), at 298 K. ' +
        'Both stages are endothermic, so the energy ladder goes up.',
      equation: 'Na (s) → Na (g);  ½ Cl₂ (g) → Cl (g)',
      note: 'Only one cell of the metal is drawn: two atoms go on to react and the rest leave the frame — a real piece of sodium holds about 10²³ atoms. At the end of the step the valence dots appear — the starting state before the electron moves: one on Na, seven on Cl.',
      speak: 'A sodium atom leaves the metal and the chlorine bond splits in half. Both stages need energy.',
    },
    transfer: {
      title: 'Giving and taking the electron',
      body:
        'The single outer electron of sodium (3s¹) moves to a chlorine atom; removing it costs 495.8 kJ/mol (the ionisation energy). ' +
        'Sodium loses its whole outer shell and shrinks from 186 to 102 pm — it is now the cation Na⁺. Chlorine gains its eighth electron, completes the octet and grows from 102 to 181 pm: the anion Cl⁻ is about 1.8 times larger than Na⁺. ' +
        'Adding the electron releases energy: Δ_eg H = −348.6 kJ/mol. In IUPAC usage the same quantity is called the electron affinity and written with a plus sign, +348.6 kJ/mol — one process, only the sign convention differs.',
      equation: 'Na⁰ − 1e⁻ → Na⁺  (×2);  Cl⁰ + 1e⁻ → Cl⁻  (×2)',
      note: 'The dots around the atoms count valence electrons in the Lewis manner (one on Na, seven on Cl, eight on Cl⁻); they are not electron positions. The arc the electron flies along and the slowed-down time are conventions: the transfer is a quantum jump. Na shrinks the moment the electron leaves (Na → Na⁺ + e⁻ is the ionisation itself), Cl grows the moment it arrives. Radii of different kinds are compared here: the metallic radius of Na and the covalent radius of Cl against Shannon ionic radii; the trend is right, but the numbers come from different scales.',
      speak: 'Sodium gives away one electron and gets smaller. Chlorine takes it and gets bigger.',
    },
    attraction: {
      title: 'Electrostatic attraction',
      body:
        'Opposite charges attract by Coulomb’s law: the force falls with the square of the distance between them. ' +
        'Na⁺ and Cl⁻ come together until attraction is balanced by the repulsion of their filled electron shells. For a single gaseous NaCl molecule this equilibrium distance is 236.1 pm. ' +
        'That is the ionic bond: not a shared pair, but the attraction of whole charges.',
      equation: 'Na⁺ (g) + Cl⁻ (g) → Na⁺Cl⁻ (g),  rₑ = 236.1 pm',
      note:
        'The sum of Shannon ionic (effective) radii for coordination number 6, 102 + 181 = 283 pm, is larger than 236.1 pm: the spheres of the gas pair overlap by 47 pm. This is not a mistake — in the gas the ions polarise each other, and Shannon gives no radii for an isolated pair. In this step the spheres are drawn at the full Shannon radius (in steps 1–3 at 0.72 of it), so the overlap is visible: the smaller Na⁺ is half sunk into Cl⁻. ' +
        'In the crystal the same pair sits 282.0 pm apart (step 5). The dotted arcs sketch field lines; two pairs instead of a huge number is a simplification.',
      speak: 'Plus and minus attract. In a gaseous salt molecule the ions come within two hundred thirty-six picometres.',
    },
    lattice: {
      title: 'The crystal lattice',
      body:
        'One pair is not the end: every ion attracts all its neighbours. The ions stack into the rock-salt lattice — space group Fm-3m, two face-centred cubic sublattices, cell edge a = 564.0 pm, Z = 4, reference density 2.165 g/cm³. ' +
        'Each Na⁺ has six Cl⁻ at the corners of an octahedron and each Cl⁻ six Na⁺: the coordination number is 6:6. The repulsion of the filled shells of six neighbours adds up, so the equilibrium in the crystal lies farther out than in the gas: 282.0 pm instead of 236.1 pm. ' +
        'Building the lattice from gaseous ions releases 787.0 kJ/mol.',
      equation: 'Na⁺ (g) + Cl⁻ (g) → NaCl (s),  U = −787.0 kJ/mol',
      note: 'The frame shows a fragment of 2×2×2 unit cells — 125 ions, 5 along each edge; the light lines are cell edges, not bonds. The lattice spheres are drawn at 0.5 of their radius so that the edges show through the fragment: in a real crystal neighbouring ions touch (102 + 181 = 283 ≈ 282.0 pm). A salt grain one millimetre across holds about 10¹⁹ ions.',
      speak: 'The ions build a cubic lattice. Every ion has six neighbours of the opposite sign.',
    },
    energy: {
      title: 'The energy balance',
      body:
        'Add up the Born–Haber cycle: +107.3 (sublimation) + 121.3 (dissociation) + 495.8 (ionisation) − 348.6 (electron gain) − 787.0 (lattice) = −411.2 kJ per mole of NaCl — exactly the tabulated enthalpy of formation. ' +
        'Without the lattice energy the first four steps would add to +375.8 kJ/mol, and the process would absorb heat instead. ' +
        'It is the lattice energy that makes the reaction exothermic: the equation 2 Na + Cl₂ releases 822.4 kJ.',
      equation: '2 Na (s) + Cl₂ (g) → 2 NaCl (s),  ΔH = −822.4 kJ',
      note:
        'Electron balance of the equation: 2 Na⁰ − 2e⁻ → 2 Na⁺, Cl₂⁰ + 2e⁻ → 2 Cl⁻ — as many electrons are given as are taken. The step ½ Cl₂ → Cl is taken equal to ΔH°f(Cl, g) = 121.3 kJ/mol at 298 K (NIST-JANAF) — with it the cycle closes exactly. School tables take half the Cl–Cl bond energy (243 kJ/mol) — 121.5, and then the sum comes out as −411.0. The lattice step −787.0 closes the cycle here; some handbooks give −786. Strictly this is the lattice enthalpy at 298 K: the lattice energy U differs from it by about 2RT ≈ 5 kJ/mol. ' +
        'Sodium burns in chlorine with a bright yellow flame — the glow of excited sodium atoms (the D line, 589 nm) above the metal, not the colour of the salt; the flame is not drawn in 3D.',
      speak: 'The result is minus four hundred eleven kilojoules per mole of salt. The lattice supplies the energy.',
    },
  },
  legend: {
    electron: 'The blue dot with a trail and the label e⁻ is the electron being transferred.',
    orbitalPhase: 'Blue dots around an atom are its valence electrons in the Lewis manner: one on Na (3s¹), seven on Cl, eight on Cl⁻. They count electrons; they are not the shape of an orbital.',
  },
  safety: 'Chlorine is poisonous and sodium catches fire on contact with water. Only a teacher may show sodium burning in chlorine, in a fume hood — never repeat it yourself.',
  energy: {
    title: 'Born–Haber cycle',
    unit: 'kJ/mol',
    caption: 'Costs (up) and gains (down) per 1 mol of NaCl; the sum of the steps is the enthalpy of formation.',
    stages: {
      sublimation: 'Na (s) → Na (g)',
      dissociation: '½ Cl₂ → Cl',
      ionization: 'Na → Na⁺ + e⁻',
      affinity: 'Cl + e⁻ → Cl⁻',
      lattice: 'Na⁺ + Cl⁻ → NaCl (s)',
      total: 'Total: ΔH°f',
    },
    summary: 'Born–Haber cycle for NaCl: the steps add up to {dH} kJ/mol',
    sources: 'Reference values: NIST-JANAF, CRC Handbook (lattice energy from the Born–Haber cycle).',
  },
}

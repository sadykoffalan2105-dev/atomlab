import type { NaclMechanismText } from './naclMechanismText'

export const NACL_TEXT_EN: NaclMechanismText = {
  intro: {
    title: 'Ionic bond',
    speak: 'Let us watch sodium and chlorine turn into table salt: an electron moves from one atom to another.',
  },
  steps: {
    reactants: {
      title: 'Starting substances',
      body: 'Sodium is a soft silvery metal: in its crystal the Na atoms are closely packed. Chlorine is a yellow-green poisonous gas made of diatomic Cl₂ molecules, in which two atoms share a pair of electrons. When sodium and chlorine meet they react vigorously — table salt NaCl forms.',
      equation: '2Na + Cl₂',
      note: 'The symbol inside each ball is the chemical symbol of the element. One cell of the metal and one chlorine molecule are shown; a real piece of sodium has billions of times more atoms.',
      speak: 'On the left is sodium metal, on the right a chlorine molecule. Chlorine always comes as two atoms.',
    },
    sublimation: {
      title: 'Structure of sodium and chlorine atoms',
      body: 'Separate atoms take part in the reaction: sodium atoms leave the metal and the chlorine molecule splits into two atoms. The sodium nucleus has a charge of +11, and its electrons sit on three energy levels: 2, 8, 1 — only one electron on the outer level. The chlorine nucleus has a charge of +17, electrons 2, 8, 7 — it is one electron short of a complete outer level of eight.',
      equation: 'Na (+11): 2, 8, 1      Cl (+17): 2, 8, 7',
      note: 'The cloud of light specks around a ball is the electron cloud of the outer level: sparse for sodium (one electron), dense for chlorine (seven electrons) with a “window” where the missing one goes. The large blue dots are outer-level electrons you can count.',
      speak: 'Sodium has one electron on its outer level, chlorine has seven. Chlorine is one electron short of eight.',
    },
    transfer: {
      title: 'Electron transfer',
      body: 'It is easier for sodium to give away one outer electron than to take seven; it is easier for chlorine to take one than to give away seven. So an electron moves from the sodium atom to the chlorine atom. Sodium loses its outer level — the complete level of eight electrons is now outside (2, 8): the atom has become a positive ion Na⁺. Chlorine has filled its outer level to eight electrons (2, 8, 8): the atom has become a negative ion Cl⁻.',
      equation: 'Na⁰ − 1e⁻ → Na⁺      Cl⁰ + 1e⁻ → Cl⁻',
      note: 'The Na⁺ ion is smaller than the Na atom — it has one electron level fewer. The Cl⁻ ion is larger than the Cl atom — the extra electron spreads the cloud. The electron flying along an arc is a visual scheme: in reality the transfer happens when the atoms collide. The two chlorine atoms of the Cl₂ molecule each take one electron from two sodium atoms.',
      speak: 'Sodium gives away an electron and becomes a positive ion. Chlorine takes the electron and becomes a negative ion. Now both have eight electrons outside.',
    },
    attraction: {
      title: 'Ionic bond',
      body: 'Ions are charged particles. The positive ion Na⁺ and the negative ion Cl⁻ attract each other. The bond that forms between ions is called an ionic bond. It forms between atoms of a typical metal and a typical non-metal, for example in NaCl, KBr, Na₂S.',
      equation: 'Na⁺ + Cl⁻ → Na⁺Cl⁻',
      note: 'The running dots between the ions are a symbolic picture of electric attraction. The ions share no electron pair: the electron has moved over to chlorine entirely.',
      speak: 'Plus and minus attract. The bond between ions is called ionic.',
    },
    lattice: {
      title: 'Ionic crystal lattice',
      body: 'Each ion attracts not just one but all neighbours of opposite charge. That is why the ions line up in a crystal lattice where Na⁺ and Cl⁻ ions alternate at the lattice points. Every Na⁺ ion is surrounded by six Cl⁻ ions, and every Cl⁻ by six Na⁺ ions. There are no separate NaCl molecules in the crystal: the formula shows that there are as many sodium ions as chloride ions.',
      equation: 'Na⁺ + Cl⁻ → NaCl (crystal)',
      note: 'A tiny piece of the crystal is shown — 5 ions along each edge. The light polyhedra pick out the six neighbours of one Na⁺ ion and one Cl⁻ ion; the thin lines are cube edges, not bonds.',
      speak: 'The ions pack into a cubic lattice. Each ion is surrounded by six ions of opposite charge.',
    },
    energy: {
      title: 'Summary: sodium chloride',
      body: 'Each sodium atom gave away one electron and each chlorine atom took one electron. Na⁺ and Cl⁻ ions formed, held in the crystal by ionic bonds. This is sodium chloride — table salt. Substances with an ionic lattice are hard and have high melting points; their solutions and melts conduct electricity.',
      equation: '2Na + Cl₂ → 2NaCl',
      note: 'Electron balance: 2Na⁰ − 2e⁻ → 2Na⁺, Cl₂⁰ + 2e⁻ → 2Cl⁻ — as many electrons are given as are taken. The lattice turns slowly so the alternating ions can be seen from every side.',
      speak: 'Sodium gave its electrons away, chlorine took them. Table salt with ionic bonds has formed.',
    },
  },
  legend: {
    electron: 'The blue dot with a trail and the label e⁻ is the electron being transferred.',
    orbitalPhase: 'The cloud of light specks is the electron cloud of the outer level: sparse for Na (one electron), dense for Cl (seven), complete for the ions (eight). The large blue dots are outer-level electrons.',
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

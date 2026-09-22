import type { H2oMechanismText } from './h2oMechanismText'

export const H2O_TEXT_EN: H2oMechanismText = {
  intro: {
    title: 'Chain reaction and a polar molecule',
    speak: 'Let us watch water being born from hydrogen and oxygen — through a chain of radicals.',
  },
  steps: {
    reactants: {
      title: 'Oxyhydrogen',
      body:
        'The frame shows a mixture of two volumes of hydrogen with one volume of oxygen (oxyhydrogen): four H₂ molecules and two O₂ molecules. At 25 °C both substances are gases made of diatomic molecules; there are no lone atoms in the cylinder. ' +
        'H₂ has one σ bond, rₑ = 74.14 pm, bond dissociation energy 435.8 kJ/mol; O₂ has a double bond (σ + π), rₑ = 120.75 pm, dissociation energy 498.4 kJ/mol. ' +
        'The O₂ molecule is a triplet: it has two unpaired electrons, which is why liquid oxygen is attracted by a magnet.',
      equation: '2 H₂ (g) + O₂ (g);  in frame 4 H₂ + 2 O₂',
      note: 'The balls are Cordero covalent radii (H 31 pm, O 66 pm) drawn at 0.72 of their size. The two blue dots on O₂ are the two unpaired electrons of the triplet; in reality they are delocalised over the two π* orbitals of the whole molecule — the dots count electrons, they do not locate them. Four H₂ and two O₂ instead of 10²³ is a simplification.',
      speak: 'Hydrogen and oxygen are diatomic gases. Two volumes of hydrogen to one of oxygen make oxyhydrogen.',
    },
    spark: {
      title: 'The spark: initiation',
      body:
        'At room temperature the mixture can stand for years: without ignition nothing happens. ' +
        'A spark breaks the bond in one H₂ molecule homolytically — the shared pair splits evenly, giving two H· radicals, each with one unpaired electron. ' +
        'This costs +436.0 kJ/mol — the initiation of the chain. The second H· radical leaves the frame and starts a chain of its own.',
      equation: 'H₂ → 2 H·,  ΔH = +436.0 kJ/mol',
      note: 'The step is computed from the enthalpy of formation of atomic hydrogen: 2 · 218.0 = 436.0 kJ/mol (NIST-JANAF); the tabulated H–H bond energy is 435.8, a 0.2 kJ/mol spread between compilations. The flash is a conventional sign of energy input and sits outside the molecules; in a real spark the first radicals are born by several routes, including from O₂.',
      speak: 'The spark splits a hydrogen molecule in two — two radicals appear.',
    },
    branching: {
      title: 'Chain branching',
      body:
        'An H· radical strikes an O₂ molecule and carries off one oxygen atom: H· + O₂ → ·OH + O. The step is endothermic, +68.5 kJ/mol, — which is why oxyhydrogen is stable without ignition. ' +
        'The freed O atom is O(³P) with TWO unpaired electrons; it immediately pulls a hydrogen atom off H₂: O + H₂ → ·OH + H·, +6.1 kJ/mol. ' +
        'One radical has become three: the chain has branched.',
      equation: 'H· + O₂ → ·OH + O(³P);  O(³P) + H₂ → ·OH + H·',
      note: 'The dots are unpaired electrons: one on H·, one on ·OH (on the oxygen), two on the O atom. Writing the oxygen atom as “O·” with one dot is wrong: the O(³P) atom has two unpaired electrons. Their number is conserved in every step: 1 + 2 = 1 + 2 and 2 + 0 = 1 + 1. The O–H length in the ·OH radical is drawn as in water, 95.8 pm; in the radical itself the bond is slightly longer.',
      speak: 'One radical becomes three — the chain branches.',
    },
    propagation: {
      title: 'Chain propagation',
      body:
        'The ·OH radicals pull hydrogen off H₂ molecules: ·OH + H₂ → H₂O + H·. This step is exothermic, −61.1 kJ/mol: this is where water is born and heat is released. ' +
        'Each such step gives back an H· radical, and the chain goes on. ' +
        'The net result of one link: H· + O₂ + 3 H₂ → 2 H₂O + 3 H·, ΔH = −47.6 kJ/mol — three times as many radicals, the links multiply like an avalanche, and the mixture explodes.',
      equation: '·OH + H₂ → H₂O + H·  (×2)',
      note: 'The three H· radicals do not vanish: in a real mixture each starts a new link, and the chain ends when two radicals meet on the vessel wall or with a third particle (2 H· → H₂). All particles are neutral — only the number of unpaired electrons changes. The second O₂ in the frame waits for its own H·.',
      speak: 'The OH radical takes a hydrogen — water forms and a radical returns.',
    },
    molecule: {
      title: 'The water molecule',
      body:
        'The water molecule is bent: two O–H bonds of 95.8 pm and an H–O–H angle of 104.5° (vibrationally averaged r₀; the equilibrium rₑ values are 95.72 pm and 104.52°). ' +
        'The electronegativity of oxygen is 3.44, of hydrogen 2.20: the shared pairs are pulled towards oxygen, so O carries a partial charge δ− and H carries δ+. ' +
        'Because the molecule is bent, the vectors of the two polar bonds do not cancel: the dipole moment is μ = 1.855 D.',
      equation: 'H₂O: d(O–H) = 95.8 pm, ∠H–O–H = 104.5°, μ = 1.855 D',
      note: 'Oxygen has two lone pairs — the translucent blue lobes of the school sp³ picture (“rabbit ears” at the tetrahedral angle of 109.5°). Photoelectron spectra show the pairs are not equivalent (orbitals 1b₁ and 3a₁), so the lobes are a model, not a measurement: only the H–O–H angle is measured. The polarity of the bonds is emphasised in this step — the bonds are polar from the moment they form.',
      speak: 'The water molecule is bent. Oxygen pulls the electrons towards itself, so the molecule is polar.',
    },
    ice: {
      title: 'Ice Ih',
      body:
        'On cooling, water molecules assemble into ice Ih: space group P6₃/mmc, a = 451.8 pm, c = 735.6 pm, Z = 4. ' +
        'Every molecule is hydrogen-bonded to four neighbours (CN 4), O···O distance 276.2 pm; each O···O line holds exactly one H atom and each O keeps two of its own (the Bernal–Fowler ice rules). ' +
        'The network of tetrahedra is open and full of empty space, so the density of ice — 0.92 g/cm³ at 250 K — is lower than that of liquid water, and ice floats.',
      equation: 'H₂O (l) → H₂O (s, ice Ih)',
      note: 'The fragment is 2×2×1 unit cells, 16 molecules; pale lines are cell edges, dashes are H···O hydrogen bonds. The core basis holds only the oxygen sublattice: H atoms in ice are disordered, and one of the arrangements allowed by the ice rules is shown. H sits on the O···O line at 95.8 pm — in ice the O–H bond is slightly longer and the H–O–H angle is close to tetrahedral. The density is the X-ray value from the cell at 250 K.',
      speak: 'In ice every molecule holds four neighbours by hydrogen bonds. The network is open, so ice is lighter than water.',
    },
    energy: {
      title: 'Energy balance',
      body:
        'Add up the Hess steps through free atoms: +436.0 (H₂ → 2 H) + 249.2 (½ O₂ → O) − 429.9 (H + O → ·OH) − 497.1 (H + ·OH → H₂O) = −241.8 kJ per mole of water vapour — exactly the tabulated enthalpy of formation. ' +
        'The whole equation 2 H₂ + O₂ → 2 H₂O (g) releases 483.6 kJ. ' +
        'Condensing the vapour releases another 44.0 kJ/mol, and for liquid water ΔH°f = −285.8 kJ/mol.',
      equation: '2 H₂ (g) + O₂ (g) → 2 H₂O (g),  ΔH = −483.6 kJ',
      note: 'This is a calculation path, not the stages of the reaction: the real path is the chain of steps 2–4, but by Hess’s law the result does not depend on the path. The step 436.0 = 2 · 218.0 is two enthalpies of formation of atomic hydrogen; 429.9 and 497.1 are the successive O–H bond dissociation energies: the bond in the ·OH radical breaks more easily than the first. The school estimate from average bond energies (2 · 435.8 + 498 − 4 · 463) gives −482.4 kJ — 1.2 kJ smaller in magnitude because of averaging. Hydrogen burns with an almost colourless hot flame; the flame is not drawn in 3D.',
      speak: 'Result: minus two hundred forty-two kilojoules per mole of vapour. The energy comes from the new O–H bonds.',
    },
  },
  legend: {
    electron: 'Blue dots next to particles are unpaired electrons of radicals: one on H·, one on ·OH, two on O(³P), two on the O₂ molecule.',
    orbitalPhase: 'Translucent blue lobes on oxygen are its two lone pairs (school sp³ picture).',
    water: 'Dashes between molecules are H···O hydrogen bonds, not covalent bonds.',
  },
  safety: 'Oxyhydrogen explodes from a spark. Only a teacher shows the experiment — with a tiny volume of gas, behind a safety screen; never mix hydrogen with oxygen yourself.',
  energy: {
    title: 'Energy by Hess’s law',
    unit: 'kJ/mol',
    caption: 'Calculation path through free atoms (not reaction stages) per 1 mol H₂O (vapour); the sum of steps is the enthalpy of formation.',
    stages: {
      dissocHH: 'H₂ → 2 H',
      dissocOO: '½ O₂ → O',
      bond1: 'H + O → ·OH',
      bond2: 'H + ·OH → H₂O',
      total: 'Total: ΔH°f',
    },
    summary: 'Path through atoms for H₂O: sum of steps {dH} kJ/mol',
    sources: 'Reference values: NIST-JANAF and CRC Handbook (ΔH°f, bond energies), NIST CCCBDB (molecular geometry); ice Ih — X-ray structure data.',
  },
}

import type { Al2o3MechanismText } from './al2o3MechanismText'

export const AL2O3_TEXT_EN: Al2o3MechanismText = {
  intro: {
    title: 'Burning aluminium',
    speak: 'Why does an aluminium spoon not burn while aluminium powder flares up? Let us watch the metal and oxygen become corundum.',
  },
  steps: {
    reactants: {
      title: 'Aluminium under its film',
      body:
        'At the bottom is a fragment of aluminium metal: a face-centred cubic lattice (FCC, Fm-3m), cell edge a = 405 pm, every atom with 12 neighbours 286.3 pm away; the metallic radius of Al is 143 pm. ' +
        'On top the metal carries a natural oxide film 2–4 nm thick — that is 5–10 cell edges. The film is AMORPHOUS: its Al³⁺ and O²⁻ ions have no long-range order, so it is not corundum. ' +
        'O₂ molecules (a double bond, 120.75 pm) settle on the film surface but get no further — that is why an aluminium spoon does not burn in air.',
      equation: '4 Al (s) + 3 O₂ (g)',
      note:
        'The film is drawn on the same scale as the metal cell, at the lower bound of its thickness; it grows to 5 nm when aged in humid air. ' +
        'The disordered packing of ions sketches an amorphous oxide: in it Al usually has four or five O neighbours (AlO₄ tetrahedra and AlO₅ pyramids, Lee et al.), so the Al³⁺ radius in the film is Shannon’s value for CN 4 — 39 pm, and O²⁻ is 138 pm. ' +
        'The “landing” of O₂ is a simplification: oxygen adsorbs on the surface, but at 25 °C the ions hardly get through the oxide, and the film stops growing by itself (the Cabrera–Mott theory). ' +
        'The pale threads in the metal sketch metallic bonding; the metal, the film and O₂ are drawn at 0.72 of their radius.',
      speak: 'Aluminium is always covered by a thin oxide film. Oxygen settles on it but gets no further.',
    },
    release: {
      title: 'The film cracks',
      body:
        'For aluminium to catch fire, the film has to be broken. On heating, the metal underneath melts (660.3 °C) and expands, while the oxide stays solid — it melts only at 2072 °C — and the film cracks. ' +
        'Powder and turnings burn brightly: the surface is huge and each particle holds little metal; the thermite reaction Fe₂O₃ + 2 Al → 2 Fe + Al₂O₃ releases 851.5 kJ. ' +
        'The steps of Hess’s law now need free atoms: evaporating 2 mol of Al costs 2 · 330.0 = 660.0 kJ, and splitting 1½ mol of O₂ into 3 mol of O atoms costs 3 · 249.2 = 747.6 kJ.',
      equation: 'Al (s) → Al (g);  O₂ (g) → 2 O (g)',
      note:
        'How the film really fails is more complex: on heating the amorphous oxide rearranges into crystalline forms and loses its continuity — the crack here is a sketch. ' +
        'In a flame an aluminium droplet boils and its vapour burns, so Al (g) atoms are not just a bookkeeping step. ' +
        'An oxygen atom O(³P) carries six valence electrons, two of them unpaired — hence two single dots on every O. The rest of the metal and the film leave the frame: a real spoon holds about 10²³ atoms.',
      speak: 'On heating the film cracks. Aluminium atoms leave the metal, and oxygen molecules split into atoms.',
    },
    transfer: {
      title: 'Six electrons from two Al atoms',
      body:
        'Every aluminium atom gives away its three outer electrons (3s²3p¹) and becomes an Al³⁺ ion: 577.5 + 1816.7 + 2744.8 = 5139.0 kJ/mol, and for 2 Al — 10 278.0 kJ. ' +
        'The third electron is the most expensive: it is pulled from an ion that is already doubly charged. The radius drops from 143 to 53.5 pm. ' +
        'Every oxygen atom takes two electrons: the first with a gain, −141.0 kJ/mol, the second at a cost, +744 kJ/mol, because the charge of O⁻ repels it. The O²⁻ ion grows from 66 to 138 pm. 12 electrons are given, 12 are taken.',
      equation: 'Al⁰ − 3e⁻ → Al³⁺  (×4);  O₂⁰ + 4e⁻ → 2 O²⁻  (×3)',
      note:
        'The dots around the atoms count valence electrons in the Lewis manner (three on Al, six on O, eight on O²⁻); they are not electron positions. The arcs the electrons fly along and the slowed-down time are conventions. ' +
        'The charge changes the moment each electron leaves or arrives, the radius only when Al³⁺ and O²⁻ appear: Shannon gives no radii for Al⁺, Al²⁺ and O⁻, since these particles do not occur in crystals. Ionic radii are Shannon’s values for the actual CN in corundum: Al³⁺ — CN 6, O²⁻ — CN 4. ' +
        'The signs here are electron-gain enthalpies (Δ_eg H); in IUPAC usage the first electron affinity of oxygen is written with a plus sign: +141.0 kJ/mol. ' +
        'The O²⁻ ion is unstable in the gas: +744 cannot be measured, it is extracted from Born–Haber cycles, and in the literature it goes up to +844.',
      speak: 'Each aluminium gives away three electrons, each oxygen takes two. Oxygen takes the second electron at an energy cost.',
    },
    lattice: {
      title: 'Corundum',
      body:
        'The ions pack into the corundum lattice α-Al₂O₃: space group R-3c, hexagonal cell a = 475.7 pm, c = 1298.8 pm, Z = 6, density 3.99 g/cm³. ' +
        'The O²⁻ ions form a hexagonal close packing, and Al³⁺ fills 2/3 of the octahedral holes between them. ' +
        'Each Al³⁺ has six O²⁻ neighbours and each O²⁻ four Al³⁺: CN 6:4, exactly as the formula requires (2 · 6 = 3 · 4). Building the lattice from gaseous ions releases about 15 170 kJ/mol.',
      equation: '2 Al³⁺ (g) + 3 O²⁻ (g) → Al₂O₃ (s),  U ≈ −15 170 kJ/mol',
      note:
        'The fragment is 2×2×1 unit cells, 148 ions: the corundum cell is almost three times longer along c, and 2×2×2 would turn into a tall column. The light lines are cell edges, not bonds. ' +
        'The lattice spheres are drawn at 0.5 of their radius so the far layers show; in a real crystal the ions touch. ' +
        'Corundum crystallises from the melt — in burning and in thermite — or when the oxide is calcined above ~1000 °C; what covers a spoon is not corundum but the amorphous film.',
      speak: 'The ions build corundum, one of the hardest minerals.',
    },
    octahedron: {
      title: 'The AlO₆ octahedron',
      body:
        'One Al³⁺ ion is highlighted with its six O²⁻ neighbours at the corners of a distorted octahedron. ' +
        'The Al–O bonds come in two lengths — three of 185.4 pm and three of 197.1 pm: pairs of octahedra share a face, and the Al³⁺ ions repel each other across it. ' +
        'Each O²⁻ sits in a distorted tetrahedron of four Al³⁺. The sum of Shannon radii, 53.5 + 138 = 191.5 pm, lies right between the two lengths.',
      equation: 'Al³⁺: CN 6 (AlO₆);  O²⁻: CN 4 (OAl₄)',
      note:
        'The dotted lines are edges of coordination polyhedra (lilac — the octahedron around Al³⁺, pink — the tetrahedron around O²⁻), not bonds. The Al–O lengths are computed from the ion coordinates in the cell (Kirfel and Eichhorn), not typed in by hand. ' +
        'Ruby and sapphire are the same corundum with Cr³⁺ and Fe/Ti impurities. Aluminium oxide is amphoteric: amorphous and γ-Al₂O₃ dissolve in both acids and alkalis, while corundum is almost inert.',
      speak: 'Every aluminium ion has six oxygen neighbours, every oxygen has four aluminium neighbours.',
    },
    energy: {
      title: 'The energy balance',
      body:
        'Add up the steps per 1 mol of Al₂O₃: +660.0 (evaporating 2 Al) + 10 278.0 (ionising 2 Al to Al³⁺) + 747.6 (1½ O₂ → 3 O) − 423.0 (3 · EA₁) + 2232.0 (3 · EA₂) − 15 170.3 (lattice) = −1675.7 kJ/mol — the tabulated enthalpy of formation of corundum. ' +
        'Without the lattice the sum is +13 494.6 kJ/mol: the costs are huge, but a lattice of ions with charges +3 and −2 pays back more — its energy is about four times that of MgO (−3789). ' +
        'The equation 4 Al + 3 O₂ → 2 Al₂O₃ releases 3351.4 kJ.',
      equation: '4 Al (s) + 3 O₂ (g) → 2 Al₂O₃ (s),  ΔH = −3351.4 kJ',
      note:
        'The lattice energy −15 170.3 is not measured but derived from the cycle: U = ΔH°f − Σ(other steps). It is consistent with EA₂ = +744, just like U(MgO) = −3789; with another EA₂ (up to +844) and other methods the literature gets 15 100 to 15 900 kJ/mol, so one cannot be changed without the other. ' +
        'A fourth electron would have to be torn from the filled 2s²2p⁶ shell — no lattice could pay that price, so aluminium stops at +3. Strictly this is the lattice enthalpy at 298 K. ' +
        'Aluminium burns with a dazzling white flame, but the fire is not drawn in 3D.',
      speak: 'The result is minus one thousand six hundred seventy-six kilojoules per mole of corundum. The lattice supplies the energy.',
    },
  },
  legend: {
    electron: 'The blue dot with a trail and the label e⁻ is an electron being transferred.',
    orbitalPhase: 'Blue dots around an atom are its valence electrons in the Lewis manner: three on Al (3s²3p¹), six on O, eight on O²⁻. They count electrons; they are not the shape of an orbital.',
  },
  safety:
    'Aluminium powder burns and can explode as a dust cloud; thermite produces liquid iron and a dazzling light that is dangerous for the eyes. Only a teacher may show such experiments — outdoors or in a fume hood, with safety goggles; never repeat them yourself.',
  energy: {
    title: 'Born–Haber cycle',
    unit: 'kJ/mol',
    caption: 'Costs (up) and gains (down) per 1 mol of Al₂O₃; the steps carry particle multipliers — 2 Al and 3 O; the sum of the steps is the enthalpy of formation.',
    stages: {
      sublimation: '2 Al (s) → 2 Al (g)',
      ionization: '2 Al → 2 Al³⁺ + 6e⁻',
      dissociation: '1½ O₂ → 3 O',
      affinity1: '3 O + 3e⁻ → 3 O⁻',
      affinity2: '3 O⁻ + 3e⁻ → 3 O²⁻',
      lattice: '2 Al³⁺ + 3 O²⁻ → Al₂O₃ (s)',
      total: 'Total: ΔH°f',
    },
    summary: 'Born–Haber cycle for Al₂O₃: the steps add up to {dH} kJ/mol',
    sources: 'Reference values: CRC Handbook, NIST-JANAF; the lattice energy is derived from the cycle with EA₂(O) = +744.',
  },
}

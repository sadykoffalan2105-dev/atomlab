import type { Clo2MechanismText } from './clo2MechanismText'

/** Английский пакет урока — перевод CLO2_TEXT_RU, те же оговорки и ссылки. Импорт только type: иначе цикл модулей. */
export const CLO2_TEXT_EN: Clo2MechanismText = {
  intro: {
    title: 'Reaction mechanism',
    speak: "Let's see how sodium chlorite really reacts with chlorine. Watch the pairs of electrons.",
  },
  steps: {
    reagents: {
      title: 'Particles in solution',
      body:
        'In water, sodium chlorite breaks up into Na⁺ and ClO₂⁻ ions. The chlorite ion is bent: the O–Cl–O angle is ≈ 111°, the Cl–O bonds are 1.57 Å long, and chlorine has an oxidation state of +3. ' +
        'A Cl₂ molecule enters the solution — its two atoms are held together by a shared pair of electrons (oxidation state 0). ' +
        'The Na⁺ ions take no part in the reaction — they are spectator ions.',
      equation: '2 NaClO₂ → 2 Na⁺ + 2 ClO₂⁻ ;  Cl₂ (gas → solution)',
      speak: 'In water, sodium chlorite exists as sodium ions and chlorite ions. A chlorine molecule enters the solution. Sodium takes no part in the reaction.',
    },
    approach: {
      title: 'Approach',
      body:
        'The chlorite ion approaches the Cl₂ molecule oxygen-first. A lone pair on that oxygen points at the nearer chlorine atom. ' +
        'The electrons of the Cl–Cl bond shift toward the far atom: the near chlorine becomes partially positive (δ+), the far one partially negative (δ−).',
      equation: 'O(ClO₂⁻) ··· Clᵟ⁺–Clᵟ⁻',
      note: 'The partial charges δ are shown schematically.',
      speak: 'The chlorite ion approaches chlorine with an oxygen atom. The chlorine molecule becomes polarized: the near atom slightly positive, the far atom slightly negative.',
    },
    clTransfer: {
      title: 'Cl⁺ transfer — the slow step',
      body:
        'The oxygen lone pair becomes a new O–Cl bond. At the same time, the electron pair of the Cl–Cl bond moves entirely onto the far atom, which leaves as a chloride ion, Cl⁻. ' +
        'Overall, a Cl⁺ has been attached to the chlorite. The chlorine of the chlorite does not give up any electrons in this step — electrons move in pairs within bonds.',
      equation: 'ClO₂⁻ + Cl₂ → ClOClO + Cl⁻',
      note: 'This is the rate-determining step. The pathway in which “an electron jumps onto Cl₂” has been tested and refuted (Nicoson, Margerum, 2002).',
      speak: 'The oxygen lone pair forms a new bond. The electrons of the chlorine-chlorine bond move to the far atom, and it leaves as a chloride ion. This is the slowest step.',
    },
    intermediate: {
      title: 'The Cl₂O₂ intermediate',
      body:
        'The result is a short-lived particle, Cl₂O₂. Kinetics only shows its composition; the proposed structure is the chain Cl–O–Cl=O, and calculations show such a particle is possible. ' +
        'Its terminal chlorine has an oxidation state of +1, while the central one is still +3.',
      equation: 'Cl–O–Cl=O',
      note: 'The particle lives for a fraction of a second and has not been observed directly in solution; its structure is still debated and is shown schematically.',
      speak: 'We now have an unstable intermediate with two chlorine atoms and two oxygen atoms. The end chlorine is plus one, the central one is plus three.',
    },
    attack: {
      title: 'The second chlorite ion',
      body:
        'A second ClO₂⁻ ion approaches the intermediate. A lone pair on its oxygen forms a bond to the central chlorine atom, ' +
        'and for an instant the complex [ClOCl(O)OClO]⁻ appears.',
      equation: 'ClOClO + ClO₂⁻ → [ClOCl(O)OClO]⁻',
      note: 'This complex was proposed from the kinetics of the related HOCl–chlorite reaction (Jia, Margerum, Francisco, 2000); calculations show it can exist. It is a likely pathway, not an observed one.',
      speak: 'A second chlorite ion arrives. Its oxygen bonds to the central chlorine atom.',
    },
    split: {
      title: 'Breaking into products',
      body:
        'The complex breaks at two bonds at once. The Cl–O bond of the terminal chlorine breaks so that both of its electrons go to the chlorine — a second Cl⁻ leaves (+1 → −1). ' +
        'The bridging O–Cl bond breaks evenly: one electron goes to each half. The result is two ClO₂ molecules, each with one unpaired electron.',
      equation: '[ClOCl(O)OClO]⁻ → 2 ClO₂ + Cl⁻',
      note: 'A full arrow shows the movement of an electron pair; a half-arrow shows the movement of a single electron. Side path: some Cl₂O₂ reacts with water to give the chlorate ion ClO₃⁻; with excess chlorite, ClO₂ dominates.',
      speak: 'The complex falls apart. The end chlorine leaves as a chloride ion and takes the electron pair with it. The bridge breaks evenly, giving two molecules of chlorine dioxide.',
    },
    products: {
      title: 'Products',
      body:
        'The ClO₂ molecule is more open than chlorite: the angle is ≈ 117°, and the Cl–O bonds are shorter — 1.47 Å. Chlorine here is +4. ' +
        'The unpaired electron does not sit on one atom — it is spread over the whole O–Cl–O chain, which is why ClO₂ is a persistent radical: its molecules do not pair up into dimers. ' +
        'Na⁺ and Cl⁻ ions remain in the solution — this is dissolved table salt, not a precipitate. ClO₂ turns the solution yellow, and some of it escapes as a yellow-green gas.',
      equation: '2 ClO₂ + 2 Na⁺ + 2 Cl⁻',
      speak: 'We get two molecules of chlorine dioxide: the angle is one hundred seventeen degrees, and chlorine is plus four. Sodium ions and chloride ions stay in the solution.',
    },
    balance: {
      title: 'Electron balance',
      body:
        'Let us compare only the start and the end. The chlorine of each chlorite ion goes from +3 to +4, losing 2 electrons in total — this is oxidation. ' +
        'The chlorine atoms from Cl₂ go from 0 to −1, gaining 2 electrons in total — this is reduction. ' +
        'This is only the net balance: during the reaction itself, electrons moved within bonds — in pairs, and one at a time when the bridge bond broke evenly (steps 3–6).',
      equation: '2 ClO₂⁻ − 2e⁻ → 2 ClO₂ ;  Cl₂ + 2e⁻ → 2 Cl⁻ ;  2 NaClO₂ + Cl₂ → 2 ClO₂ + 2 NaCl',
      speak: 'In the end, chlorite lost two electrons and was oxidized, and chlorine gained two electrons and was reduced.',
    },
  },
  legend: {
    electron: 'electron',
    pairArrow: 'movement of an electron pair',
    singleArrow: 'movement of a single electron',
    water: 'water molecules not shown',
    orbitalPhase: 'orbital lobes: colour is the sign (phase) of the wavefunction, not charge; outline = empty orbital',
    vibration: 'atomic vibrations: real frequency ratios, slowed ≈10¹³ times, amplitude exaggerated',
  },
  safety: 'ClO₂ is toxic, and the concentrated gas can explode — that is why it is made on site and not stored for long.',
  energy: {
    title: 'Energy profile',
    axisG: 'G, kJ/mol',
    axisCoord: 'reaction coordinate',
    unit: 'kJ/mol',
    measured: 'from measurements',
    derived: 'calculated from k',
    schematic: 'schematic',
    mainLabel: 'ClO₂ path {pct}%',
    branchLabel: 'ClO₃⁻ path {pct}%',
    caveat:
      'The ΔG‡ barrier heights are apparent values: they are calculated from rate constants with the Eyring equation (25 °C, 1 M), and each is measured from its own reactants, so peaks of different steps cannot be compared on one scale. ' +
      'Which step is slow comes from the kinetics, not from peak height. The depths of the ClOClO and complex wells have not been measured — those parts are drawn schematically. ' +
      'ΔG° = −2F·ΔE° ≈ {dG} kJ/mol ({dGAlt} with E° = 0.936 V); Cl₂ is taken as a gas in its standard state.',
    chlorateModels:
      'Both studies agree that excess chlorite shifts the yield toward ClO₂. Nicoson and Margerum (2002): ClOClO either reacts with ClO₂⁻ (giving ClO₂) or hydrolyses (giving ClO₃⁻). ' +
      'Angyal, Fábián and Szabó (2023) replace the hydrolysis with reactions of Cl₂O₂ with ClO₂⁻ and HOCl, and find that most chlorate comes from Cl₂O + HClO₂. ' +
      'For the two Cl₂O₂ + ClO₂⁻ steps the barriers are {ts2} and {tsCl} kJ/mol: the share of Cl₂O₂ taking each path ≈ {main} : {side} (by moles of product ClO₂ : ClO₃⁻ ≈ 84 : 16, since the ClO₂ path gives two molecules). ' +
      'Chlorate is thermodynamically lower (≈ −96 kJ/mol vs {dG}), but ClO₂ forms faster — kinetic control.',
    halfLife: 'In a real solution (10 mM chlorite), half of the Cl₂ is used up in about {ms} ms — the reaction on screen is slowed down.',
    sources:
      'Nicoson, Margerum, Inorg. Chem. 2002 · Jia, Margerum, Francisco, Inorg. Chem. 2000 · Angyal, Fábián, Szabó, Inorg. Chem. 2023 · ΔfG° NBS · E°: Cl₂/Cl⁻ 1.358 V, ClO₂/ClO₂⁻ 0.954 V',
    more: 'Models and sources',
    summary:
      'Energy profile of 2ClO₂⁻ + Cl₂ → 2ClO₂ + 2Cl⁻: overall ΔG° ≈ {dG} kJ/mol; apparent barrier of the slow step ≈ {ts1} kJ/mol; barrier of the second step ≈ {ts2} kJ/mol from the intermediate; ' +
      'after the complex the path branches: Cl₂O₂ → ClO₂ {main}%, → chlorate {side}%; the chlorate branch is lower in energy but slower. Intermediate levels are schematic.',
  },
  ledger: {
    valence: 'valence e⁻',
    valenceHint: 'Atoms and charge are conserved, so the number of valence electrons is the same at every stage.',
    orbital: '2b₁',
    orbitalHint: 'Electrons in the 2b₁ (π*) orbital of the O–Cl–O unit: 2 in the chlorite ion, 1 in the ClO₂ radical.',
    aria: 'Valence electrons: {n} ({breakdown}). In the 2b₁ orbital: {occ}.',
  },
}

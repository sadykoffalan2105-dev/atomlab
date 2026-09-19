import type { Nh3MechanismText } from './nh3MechanismText'

/** English text of the ammonia-synthesis lesson (N₂ + 3 H₂ ⇌ 2 NH₃). */
export const NH3_TEXT_EN: Nh3MechanismText = {
  intro: {
    title: 'Ammonia synthesis',
    speak: 'Let us see how the most inert gas of the air becomes ammonia — the raw material for every nitrogen fertiliser.',
  },
  steps: {
    reactants: {
      title: 'The reactants',
      body:
        'Air is 78 % nitrogen, yet nitrogen hardly reacts at all. The reason is the triple bond N≡N: one σ bond and two π bonds, 109.8 pm long, 945 kJ/mol to break. It is the strongest bond in this lesson. ' +
        'Hydrogen is diatomic too, but its H–H bond is three times weaker: 436 kJ/mol at a length of 74.1 pm. ' +
        'To make ammonia both bonds must be broken and six new N–H bonds built.',
      equation: 'N₂ (g) + 3 H₂ (g)',
      note: 'The blue arcs around the N–N axis stand for the TWO π bonds on top of the σ bond; they are not the shape of the orbitals.',
      speak: 'Nitrogen is inert because of its triple bond: breaking it costs nine hundred and forty-five kilojoules per mole.',
    },
    adsorption: {
      title: 'Adsorption on the catalyst',
      body:
        'The iron catalyst with its K₂O and Al₂O₃ promoters does not appear in the equation, yet without it the reaction practically does not run. The molecules land on the iron surface (body-centred cubic, Im-3m, cell edge 286.65 pm, eight neighbours at 248.2 pm). ' +
        'Metal electrons move into the antibonding orbitals of nitrogen: the N≡N bond weakens — on screen its order falls from three to zero — and breaks right on the surface. Hydrogen splits into atoms even more easily. ' +
        'Look at the two curves: without a catalyst a barrier of about 945 kJ/mol has to be crossed, on iron the apparent activation energy is only 60–100 kJ/mol.',
      equation: 'N₂ (ads) → 2 N (ads);  H₂ (ads) → 2 H (ads)',
      note:
        'A catalyst lowers ONLY the barrier: both curves start and end at the same levels, because ΔH does not depend on the catalyst. ' +
        'The 60–100 kJ/mol range is the spread of published apparent activation energies on promoted iron; the frame shows a fragment of 18 atoms, a catalyst grain holds about 10²⁰.',
      speak: 'Iron weakens the triple bond and cuts the barrier roughly tenfold. The heat of reaction stays exactly the same.',
    },
    bonds: {
      title: 'N–H bonds appear one at a time',
      body:
        'On the surface nitrogen and hydrogen atoms meet and bond ONE AT A TIME: first NH, then NH₂, then NH₃. That is exactly why the synthesis needs a catalyst instead of gas-phase collisions. ' +
        'Every N–H bond is a shared electron pair, but nitrogen is more electronegative than hydrogen (3.04 against 2.20), so the pair is pulled towards nitrogen: δ− on N, δ+ on H. ' +
        'The N–H bond is 101.2 pm long and its mean energy is 391 kJ/mol.',
      equation: 'N + H → NH;  NH + H → NH₂;  NH₂ + H → NH₃',
      note: 'On screen the atoms glide smoothly over the surface; in reality they hop between neighbouring adsorption sites.',
      speak: 'The bonds appear one by one: N–H, then N–H two, then N–H three. The shared pair leans towards nitrogen.',
    },
    desorption: {
      title: 'Desorption: the ammonia molecule',
      body:
        'The finished molecule leaves the iron — and the iron is exactly as it was. The catalyst is not consumed: it takes part in the reaction and comes out unchanged. ' +
        'In free NH₃ the nitrogen is sp³: three bonds and ONE lone pair. Because of that pair the molecule is not flat but a trigonal pyramid, and the H–N–H angle is squeezed to 106.7° instead of the tetrahedral 109.5°. ' +
        'Such a pyramid is polar: the dipole moment is 1.47 D. Hence ammonia dissolves so well in water — and hence its smell.',
      equation: 'NH₃ (ads) → NH₃ (g)',
      note: 'The two glowing dots above the nitrogen stand for the lone pair: electrons do not sit at a point, this is a region of raised electron density.',
      speak: 'Ammonia leaves, the iron stays the same. The lone pair makes the molecule a pyramid with an angle of a hundred and six point seven.',
    },
    equilibrium: {
      title: 'Equilibrium and Le Chatelier',
      body:
        'The reaction is reversible: ammonia is being made and decomposed at the same time, which is why the equation carries ⇌. The left side has 4 mol of gas (1 N₂ + 3 H₂), the right side only 2 mol, so Δn = −2. ' +
        'By Le Chatelier’s principle higher pressure shifts the equilibrium to the side with fewer gas molecules — to the right; industry therefore works at 20–30 MPa (200–300 atm). ' +
        'The reaction is exothermic, so heating shifts it to the LEFT. But at low temperature the rate is far too small, hence the compromise: 400–500 °C, about 15 % yield per pass, with the unreacted mixture recycled.',
      equation: 'N₂ (g) + 3 H₂ (g) ⇌ 2 NH₃ (g)',
      note: 'The two ⇌ arrows differ in brightness only to make the directions readable; at equilibrium the forward and reverse rates are strictly equal.',
      speak: 'Pressure pushes the equilibrium right, heating pushes it left. That is why the plant runs at high pressure and moderate heat.',
    },
    energy: {
      title: 'The energy balance',
      body:
        'Count it from bond energies, per equation: breaking one N≡N costs +945 kJ, breaking three H–H bonds another +1308 kJ, while forming six N–H bonds releases −2346 kJ. The sum is −93 kJ. ' +
        'An independent count from heats of formation gives −91.8 kJ (that is 2 · (−45.9)); the 1 kJ gap appears because 391 kJ/mol is a MEAN N–H bond energy. ' +
        'The reaction is exothermic, and that makes ammonia the number one feedstock for nitrogen fertilisers: roughly half of the nitrogen in the proteins of humankind has passed through this process.',
      equation: 'N₂ (g) + 3 H₂ (g) ⇌ 2 NH₃ (g),  ΔH = −92 kJ',
      note: 'The ladder is drawn per EQUATION, that is per 2 mol of NH₃; per mole of ammonia it is −45.9 kJ.',
      speak: 'The result is minus ninety-two kilojoules: building six bonds releases more than breaking the old ones costs.',
    },
  },
  legend: {
    electron: 'Blue dots are electrons: π clouds, shared pairs and the lone pair of nitrogen.',
    orbitalPhase: 'The arcs around the N–N axis are a schematic sign of two π bonds, not the shape of the orbitals.',
    vibration: 'The orange curve is the path without a catalyst, the green one on iron. The end levels match: ΔH is unchanged.',
  },
  safety:
    'Ammonia is toxic and strongly irritates the airways, and hydrogen–air mixtures are explosive. The industrial synthesis runs at 20–30 MPa and 400–500 °C — it is never done in a school laboratory.',
  energy: {
    title: 'Energy from bonds',
    unit: 'kJ',
    caption: 'Cost of breaking bonds (up) and gain from forming new ones (down), per equation — that is, per 2 mol of NH₃.',
    stages: {
      hh: '3 H–H → 6 H',
      nn: 'N≡N → 2 N',
      nh: '2 N + 6 H → 2 NH₃',
      total: 'Total: ΔH of the reaction',
    },
    summary: 'Bond energies in the ammonia synthesis: the steps add up to {dH} kJ',
    sources: 'Bond energies and lengths — CRC Handbook, NIST; ΔH°f — NIST-JANAF; process conditions — Ullmann’s Encyclopedia, “Ammonia”.',
  },
}

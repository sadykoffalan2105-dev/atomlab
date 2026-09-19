import type { So2MechanismText } from './so2MechanismText'

/** English texts for the lesson «S + O₂ → SO₂» (see so2MechanismText.ts for the rules). */
export const SO2_TEXT_EN: So2MechanismText = {
  intro: {
    title: 'The polar covalent bond',
    speak: 'Let us watch sulfur burn: two oxygen atoms share electron pairs with sulfur and sulfur dioxide appears.',
  },
  steps: {
    reactants: {
      title: 'Sulfur and oxygen',
      body:
        'At room temperature sulfur is a yellow solid, and its particle is not a single atom but a crown-shaped RING of eight atoms, S₈: the S–S bond is 205.5 pm and the S–S–S angle is 108°. ' +
        'Oxygen is the diatomic gas O₂ with a double bond 120.8 pm long; there are no free oxygen atoms in the air. ' +
        'Once lit, sulfur burns with a quiet BLUE flame — that is the reaction we are going to take apart step by step.',
      equation: 'S (s, rhombic) + O₂ (g) → SO₂ (g)',
      note: 'One S₈ crown and one O₂ molecule are shown; a grain of sulfur holds some 10²⁰ such crowns.',
      speak: 'Sulfur is a ring of eight atoms, and oxygen is always diatomic.',
    },
    ring: {
      title: 'The ring opens',
      body:
        'Before sulfur can react, an atom has to be freed from the ring. First one S–S bond breaks and the crown turns into a chain, then a second one breaks and the end atom leaves. ' +
        'Making one mole of gaseous sulfur atoms out of rhombic sulfur costs 277.2 kJ: this step is ENDOTHERMIC, energy has to be spent. ' +
        'That is why sulfur must be lit: on its own it does not react with oxygen at room temperature.',
      equation: '⅛ S₈ (s) → S (g),  ΔH = +277.2 kJ/mol',
      note: 'Free sulfur atoms are rare in the flame and live for an instant: the scene shows HOW an atom is freed, not how many there are.',
      speak: 'Two S–S bonds break and one sulfur atom leaves the crown.',
    },
    firstBond: {
      title: 'The first S=O bond',
      body:
        'The oxygen molecule has to be broken as well: O₂ → 2 O costs 498.4 kJ per mole. The break is HOMOLYTIC — the shared pair is split evenly and two identical atoms appear, not ions. ' +
        'Then the sulfur atom and an oxygen atom come close and each contributes one electron to a shared pair. ' +
        'That is the covalent S=O bond, 143.1 pm long: the electrons belong to both atoms at once, but are pulled towards the more electronegative oxygen.',
      equation: 'O₂ (g) → 2 O (g), ΔH = +498.4 kJ/mol;   S (g) + O (g) → S=O',
      note: 'Electrons are drawn as glowing dots and the valence shell as a ring: this marks «the outer electrons are here», it is not the shape of an orbital.',
      speak: 'Oxygen splits in half and sulfur shares an electron pair with it.',
    },
    bend: {
      title: 'The second bond and the 119.5° angle',
      body:
        'A second oxygen atom gives the second S=O bond. Sulfur now carries THREE electron groups: two bonds and one LONE PAIR. ' +
        'By VSEPR three groups spread out in a plane at about 120°, so the molecule comes out BENT; the lone pair is «fatter» than a bond and squeezes the angle down to 119.5°. ' +
        'Carbon in CO₂ has only two groups and no lone pairs — which is why CO₂ is linear, 180°. ' +
        'Both bonds in SO₂ are the same length, 143.1 pm: the π electrons are delocalised over all three centres, so each bond order is not 2 but roughly 1.5. The molecule is polar, μ = 1.63 D.',
      equation: 'O=S=O,  ∠O–S–O = 119.5°,  d(S=O) = 143.1 pm,  μ = 1.63 D',
      note: 'The move from the «wide» shape to the bent one is staged so that the push of the lone pair can be seen: in reality SO₂ is always bent.',
      speak: 'The lone pair on sulfur squeezes the angle — the molecule is bent, while CO₂ is linear.',
    },
    properties: {
      title: 'Properties of sulfur dioxide',
      body:
        'SO₂ is a colourless gas with a sharp smell, heavier than air and very soluble in water. The solution is acidic and school notation calls it sulfurous acid, H₂SO₃. ' +
        'It is sulfur dioxide from factory and power-plant chimneys that causes ACID RAIN, which eats marble and kills forests. ' +
        'Over a V₂O₅ catalyst at 400–500 °C SO₂ is oxidised further to SO₃ — the key step of industrial sulfuric acid production. ' +
        'Notice that the third oxygen takes exactly the place of the lone pair, and SO₃ becomes flat and symmetric.',
      equation: 'SO₂ + H₂O ⇌ H₂SO₃;   2 SO₂ + O₂ ⇌ 2 SO₃ (V₂O₅, 400–500 °C)',
      note:
        'Free H₂SO₃ has never been isolated: in solution it is hydrated SO₂ together with HSO₃⁻ ions. ' +
        'The coefficients refer to moles — one molecule is on screen; the V₂O₅ catalyst is drawn as a marker, not as a lattice.',
      speak: 'Sulfur dioxide causes acid rain, and over a catalyst it turns into sulfur trioxide.',
    },
    energy: {
      title: 'The energy balance',
      body:
        'Let us add the steps up. Freeing a sulfur atom from the ring costs +277.2 kJ, breaking the oxygen molecule costs +498.4 kJ: 775.6 kJ spent in total. ' +
        'In return the two new S=O bonds release 1072.4 kJ. ' +
        'The balance is −296.8 kJ per mole of SO₂ — the reaction is EXOTHERMIC. That is exactly why sulfur, once lit, keeps burning without further heating.',
      equation: 'S (s, rhombic) + O₂ (g) → SO₂ (g),  ΔH°f = −296.8 kJ/mol',
      note:
        'The 1072.4 kJ gain is obtained from Hess’s law, not from a bond-energy table: it gives 536.2 kJ per bond, more than the tabulated mean S=O value (522 kJ/mol), ' +
        'because in SO₂ itself the π density is delocalised and the bonds are stronger than average.',
      speak: 'We spent seven hundred seventy-five and got back one thousand seventy-two — the reaction is exothermic.',
    },
  },
  legend: {
    electron: 'A glowing dot is an electron; the two dots under sulfur are its lone pair.',
    orbitalPhase: 'The cloud above and below the molecular plane is the delocalised π system; the drawing is schematic.',
  },
  safety: 'SO₂ is toxic: it irritates the eyes and airways and is dangerous in large doses. Burn sulfur only in a fume hood and in small amounts.',
  energy: {
    title: 'Reaction energy',
    unit: 'kJ/mol',
    caption: 'Up is energy spent, down is energy gained. The S=O bonds give back more than freeing the atoms cost.',
    stages: {
      atomization: 'Atomisation of sulfur: ⅛ S₈ (s) → S (g)',
      dissociation: 'Dissociation of oxygen: O₂ → 2 O (g)',
      bonds: 'Two S=O bonds',
      total: 'ΔH°f(SO₂, g)',
    },
    summary: 'Reaction balance {dH} kJ/mol',
    sources: 'ΔH°f — NIST-JANAF and the CRC Handbook; bond lengths and angles — NIST CCCBDB.',
  },
}

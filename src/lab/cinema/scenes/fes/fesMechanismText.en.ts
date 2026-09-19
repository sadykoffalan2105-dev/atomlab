import type { FesMechanismText } from './fesMechanismText'

export const FES_TEXT_EN: FesMechanismText = {
  intro: {
    title: 'Mixture or compound',
    speak: 'Let us mix sulfur powder with iron filings, then heat the mixture and see what tells a mixture from a compound.',
  },
  steps: {
    mixture: {
      title: 'A mixture of iron and sulfur',
      body:
        'On the left are iron filings: Fe atoms sit in a body-centred cubic lattice (BCC, Im-3m, a = 286.65 pm), each with eight nearest neighbours 248.2 pm away. ' +
        'On the right is sulfur: at 25 °C it is not separate atoms but S₈ crown molecules, S–S bond 205.5 pm, S–S–S angle 108°. ' +
        'So far this is only a MIXTURE: any proportion will do, and each substance keeps its own properties. A magnet pulls the iron out and leaves the sulfur behind — the iron in the mixture is still iron.',
      equation: 'Fe (s) + S₈ (s) — a mixture, separated by a magnet',
      note: 'The iron is drawn as a nine-atom fragment and the sulfur as a single S₈ crown; a real sample holds about 10²³ of them. The magnet is a plain bar: only the pull itself matters here.',
      speak: 'This is still just a mixture: the magnet lifts the iron out and the sulfur stays where it is.',
    },
    heating: {
      title: 'Heating starts the reaction',
      body:
        'The mixture is heated. The heat is needed only to START the reaction: the atoms must break away from their lattices and from the S₈ crown. ' +
        'Once it has begun, the mixture glows and keeps burning on its own — the burner can be taken away. Only an EXOTHERMIC reaction behaves like that: it releases more energy than was spent on starting it. ' +
        'That is the first sign that a chemical change has happened, not just stirring.',
      equation: 'Fe (s) → Fe (g), +416.3 kJ/mol;  ⅛ S₈ (s) → S (g), +277.2 kJ/mol',
      note: 'The scene follows ONE iron atom and ONE sulfur atom — the rest of the mixture reacts in exactly the same way and leaves the frame so as not to hide the main event.',
      speak: 'We heat it, and the mixture catches. After that it burns by itself: the reaction is exothermic.',
    },
    transfer: {
      title: 'The electrons move across',
      body:
        'Iron gives away two outer electrons (4s²) and sulfur takes them, completing its outer shell to eight electrons. ' +
        'The iron atom loses a whole electron shell and shrinks from 126 to 78 pm — it is now the cation Fe²⁺. The sulfur atom swells from 105 to 184 pm: the anion S²⁻ ends up 2.36 times larger than Fe²⁺. ' +
        'The electron balance closes: two given, two taken. The total charge is 0 on the left and (+2) + (−2) = 0 on the right.',
      equation: 'Fe⁰ − 2e⁻ → Fe²⁺;  S⁰ + 2e⁻ → S²⁻',
      note: 'The arc the electron flies along and the glowing ring around the iron are conventions: the transfer is a quantum jump, and the ring only marks where the outer electrons are.',
      speak: 'Iron gives away two electrons and gets smaller. Sulfur takes them and gets bigger.',
    },
    lattice: {
      title: 'The NiAs-type lattice',
      body:
        'Opposite charges attract by Coulomb’s law: the ions close in to 244.5 pm and then build a crystal. ' +
        'Iron(II) sulfide is troilite, structure type NiAs: every Fe²⁺ sits in an octahedron of six S²⁻, every S²⁻ in a trigonal prism of six Fe²⁺, coordination 6/6. ' +
        'The ions strictly alternate, so like charges never touch. The bonding is not purely ionic: the electronegativities of Fe and S are 1.83 and 2.58, a difference of only 0.75 — an ionic-covalent bond.',
      equation: 'Fe²⁺ + S²⁻ → FeS (s), d(Fe–S) = 244.5 pm, CN 6/6',
      note:
        'What is drawn is the IDEAL NiAs subcell (a = 344.3 pm, c = 587.7 pm); real troilite is its slightly distorted √3a × 2c superstructure: P-62c, a = 596.3 pm, c = 1175.4 pm, Z = 12, ρ = 4.61 g/cm³. ' +
        'Because of that distortion the drawn Fe–S distance is 1 % longer than the measured one. A slab of 31 ions is shown.',
      speak: 'The ions attract and settle into a nickel-arsenide-type lattice: six neighbours each.',
    },
    product: {
      title: 'A new substance',
      body:
        'The product is iron(II) sulfide FeS — a black solid that looks like neither iron nor sulfur. ' +
        'The magnet is now powerless: iron is ferromagnetic, while troilite is antiferromagnetic — the magnetic moments of its ions cancel out, there is no net magnetisation, and a school magnet cannot lift the crystal. ' +
        'The second proof is the reaction with hydrochloric acid: the sulfide gives hydrogen sulfide H₂S, which smells of rotten eggs, whereas the original mixture would only give hydrogen from the iron. The composition of a compound is strictly fixed: one iron atom to one sulfur atom.',
      equation: 'FeS + 2 HCl → FeCl₂ + H₂S↑',
      note: 'The test tube with acid is not drawn in 3D — only the equation of the test is shown. The hydrogen sulfide experiment is done by the teacher in a fume hood.',
      speak: 'The magnet lifts nothing any more: this is no longer iron but a new substance, iron sulfide.',
    },
    energy: {
      title: 'Energy and the conclusion',
      body:
        'Let us add up the balance by Hess’s law. Freeing the atoms cost 416.3 + 277.2 = 693.5 kJ/mol, and building the crystal released 793.5 kJ/mol. ' +
        'The result: ΔH°f(FeS) = −100.0 kJ/mol — the gain beats the cost, which is why the mixture keeps burning once lit. ' +
        'The conclusion of the experiment: a MIXTURE can be separated physically (with a magnet), its proportions are free and its components keep their properties; a COMPOUND cannot be separated that way, its composition is fixed and its properties are its own.',
      equation: 'Fe (s) + S (s) → FeS (s), ΔH°f = −100.0 kJ/mol',
      note: 'The crystal-building step (−793.5 kJ/mol) is not a tabulated value: it is obtained by Hess’s law as the remainder of the cycle. The other two steps are reference enthalpies of formation of the gaseous atoms.',
      speak: 'A hundred kilojoules per mole are released. A mixture can be taken apart; a compound cannot.',
    },
  },
  legend: {
    electron: 'The blue dot with a trail is a moving electron — there are two of them here.',
    orbitalPhase: 'The glowing ring around the iron is a schematic mark for the outer 4s² electrons, not the shape of an orbital.',
    magnet: 'The red-and-blue bar is a magnet. In step 1 it lifts the iron; in step 5 it cannot move the sulfide at all.',
  },
  safety: 'Only a teacher lights an iron-and-sulfur mixture, and only in a fume hood: sulfur in air gives choking SO₂, and the sulfide with acid gives poisonous hydrogen sulfide H₂S. Never repeat this experiment on your own.',
  energy: {
    title: 'Energy by Hess’s law',
    unit: 'kJ/mol',
    caption: 'Cost (up) and gain (down) per mole of FeS; the sum of the steps is the enthalpy of formation.',
    stages: {
      atomFe: 'Fe (s) → Fe (g)',
      atomS: '⅛ S₈ (s) → S (g)',
      crystal: 'Fe (g) + S (g) → FeS (s)',
      total: 'Result: ΔH°f',
    },
    summary: 'Energy ladder of FeS: the steps add up to {dH} kJ/mol',
    sources: 'Reference values: CODATA, CRC Handbook. The crystal-building energy is obtained by Hess’s law, not taken from a table.',
  },
}

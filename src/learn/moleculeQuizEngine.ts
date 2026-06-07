import {
  MOLECULE_GAME_COMPOUNDS,
  pickMoleculeQuizDistractors,
  shuffleArray,
} from '../data/moleculeStructureGame'
import type { CompoundDef } from '../types/chemistry'
import type { StudentTestLength } from './studentTestScoring'

export type MoleculeTestQuestion = {
  correct: CompoundDef
  options: CompoundDef[]
}

export function buildMoleculeTestQuestion(correct: CompoundDef): MoleculeTestQuestion {
  const distractors = pickMoleculeQuizDistractors(correct.id, 3)
  return {
    correct,
    options: shuffleArray([correct, ...distractors]),
  }
}

export function buildMoleculeTest(length: StudentTestLength): MoleculeTestQuestion[] {
  const picked = shuffleArray(MOLECULE_GAME_COMPOUNDS).slice(0, length)
  return picked.map(buildMoleculeTestQuestion)
}

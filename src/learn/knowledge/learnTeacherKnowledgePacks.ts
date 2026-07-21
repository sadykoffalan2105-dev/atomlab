import megaPack from '../../data/teacherKnowledge/megaPack.json'
import type { ChemistryKnowledgeChunk } from '../learnChemistryKnowledgeBase'

/**
 * Мега-пакет знаний ИИ-учителя (~10× к базовому индексу).
 * Собирается: `npm run build:teacher-knowledge`
 */
type MegaPackFile = {
  version: number
  count: number
  chunks: ChemistryKnowledgeChunk[]
}

const pack = megaPack as MegaPackFile

export const TEACHER_KNOWLEDGE_PACKS: ChemistryKnowledgeChunk[] = Array.isArray(pack.chunks)
  ? pack.chunks
  : []

export const TEACHER_KNOWLEDGE_PACK_COUNT = TEACHER_KNOWLEDGE_PACKS.length

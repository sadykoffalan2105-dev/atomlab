import megaPack from '../../data/teacherKnowledge/megaPack.json'
import megaPackExtra from '../../data/teacherKnowledge/megaPackExtra.json'
import type { ChemistryKnowledgeChunk } from '../learnChemistryKnowledgeBase'

/**
 * Мега-пакет знаний ИИ-учителя (~100× к ручным packs).
 * Собирается: `npm run build:teacher-knowledge`
 * Основной + доп. файл (чтобы не держать один гигантский JSON в одном импорте).
 */
type MegaPackFile = {
  version: number
  count: number
  chunks: ChemistryKnowledgeChunk[]
}

const primary = megaPack as MegaPackFile
const extra = megaPackExtra as MegaPackFile

const primaryChunks = Array.isArray(primary.chunks) ? primary.chunks : []
const extraChunks = Array.isArray(extra.chunks) ? extra.chunks : []

export const TEACHER_KNOWLEDGE_PACKS: ChemistryKnowledgeChunk[] = [...primaryChunks, ...extraChunks]

export const TEACHER_KNOWLEDGE_PACK_COUNT = TEACHER_KNOWLEDGE_PACKS.length

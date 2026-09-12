import megaPack from '../../data/teacherKnowledge/megaPack.json'
import megaPackExtra from '../../data/teacherKnowledge/megaPackExtra.json'
import megaPackExtra2 from '../../data/teacherKnowledge/megaPackExtra2.json'
import megaPackExtra3 from '../../data/teacherKnowledge/megaPackExtra3.json'
import megaPackExtra4 from '../../data/teacherKnowledge/megaPackExtra4.json'
import megaPackExtra5 from '../../data/teacherKnowledge/megaPackExtra5.json'
import megaPackExtra6 from '../../data/teacherKnowledge/megaPackExtra6.json'
import type { ChemistryKnowledgeChunk } from '../learnChemistryKnowledgeBase'

/**
 * Мега-пакет знаний ИИ-учителя (~5× к прошлой сборке).
 * Собирается: `npm run build:teacher-knowledge`
 * Файлы режутся автоматически (megaPack + megaPackExtra…).
 */
type MegaPackFile = {
  version: number
  count: number
  chunks: ChemistryKnowledgeChunk[]
}

function chunksOf(file: MegaPackFile | null | undefined): ChemistryKnowledgeChunk[] {
  return Array.isArray(file?.chunks) ? file.chunks : []
}

export const TEACHER_KNOWLEDGE_PACKS: ChemistryKnowledgeChunk[] = [
  ...chunksOf(megaPack as MegaPackFile),
  ...chunksOf(megaPackExtra as MegaPackFile),
  ...chunksOf(megaPackExtra2 as MegaPackFile),
  ...chunksOf(megaPackExtra3 as MegaPackFile),
  ...chunksOf(megaPackExtra4 as MegaPackFile),
  ...chunksOf(megaPackExtra5 as MegaPackFile),
  ...chunksOf(megaPackExtra6 as MegaPackFile),
]

export const TEACHER_KNOWLEDGE_PACK_COUNT = TEACHER_KNOWLEDGE_PACKS.length

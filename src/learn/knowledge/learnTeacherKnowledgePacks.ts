import type { ChemistryKnowledgeChunk } from '../learnChemistryKnowledgeBase'

/**
 * Бывший «мега-пакет» знаний ИИ-учителя (src/data/teacherKnowledge/megaPack*.json, ~155 МБ).
 *
 * Больше НЕ входит в сборку приложения: все ответы учителя берут знания из новой базы
 * src/learn/kb (индекс учебников Kimyo 7–11 + справочные карточки, ≈12 МБ, грузится по классам)
 * через адаптер src/learn/teacherKnowledge.ts. Синхронный retrieveChemistryKnowledge остался
 * запасным путём на небольших рукописных пакетах (learn*Knowledge.ts) и учебнике.
 *
 * JSON-файлы мега-пакета остались на диске для teacher_service (Python) и
 * scripts/build-teacher-knowledge-mega.mjs — не импортируйте их во фронтенд снова.
 */
export const TEACHER_KNOWLEDGE_PACKS: ChemistryKnowledgeChunk[] = []

export const TEACHER_KNOWLEDGE_PACK_COUNT = TEACHER_KNOWLEDGE_PACKS.length

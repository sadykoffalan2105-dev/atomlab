/**
 * Настройки «мозга» ИИ-учителя ATOMLAB.
 *
 * Данные — BRAIN_DATA_DIR (по умолчанию %USERPROFILE%\Desktop\atomlab-brain-data):
 *   journal/   — главная база и диалоги, ТОЛЬКО дописывание в конец (brain/kb/storage.ts → appendLine);
 *   students/  — события учеников, только дописывание;
 *   derived/   — всё, что пересобирается (индексы, векторы) — единственная перезаписываемая папка;
 *   config.json — модели и пороги (создаётся с умолчаниями, если его нет; правится владельцем вручную).
 */
import fs from 'node:fs'
import path from 'node:path'

export const SERVICE = 'atomlab-brain'
export const VERSION = '1.0.0'
export const CONTRACT = 1

export const PORT = Number(process.env.BRAIN_PORT || 8787)

export function defaultDataDir(): string {
  const home = process.env.USERPROFILE || process.env.HOME || '.'
  return path.join(home, 'Desktop', 'atomlab-brain-data')
}

export const DATA_DIR = path.resolve(process.env.BRAIN_DATA_DIR || defaultDataDir())

export type BrainConfig = {
  ollamaUrl: string
  /** Модели для ответов — по порядку предпочтения (первая найденная в /api/tags). */
  chatModels: string[]
  /** Быстрые модели: live-режим и классификация спорных вопросов. */
  fastModels: string[]
  embedModel: string
  /** Как часто спрашивать Ollama /api/tags (мс). */
  pollMs: number
  thresholds: { high: number; medium: number; schoolMin: number }
  hybrid: { wBm: number; wVec: number; mmrLambda: number; topK: number; maxChars: number; vecPool: number }
  timeouts: { firstTokenMs: number; liveFirstTokenMs: number; totalMs: number; classifyMs: number; embedMs: number; translateMs: number }
  numPredict: { brief: number; more: number; live: number }
  wordLimits: { brief: number; more: number; live: number }
  temperature: { chat: number; calc: number }
  numCtx: number
}

export const DEFAULT_CONFIG: BrainConfig = {
  ollamaUrl: 'http://127.0.0.1:11434',
  chatModels: ['qwen2.5:7b-instruct', 'qwen2.5:7b', 'qwen2.5:14b-instruct', 'qwen2.5:3b-instruct'],
  fastModels: ['qwen2.5:3b-instruct', 'qwen2.5:3b', 'qwen2.5:1.5b-instruct'],
  embedModel: 'bge-m3',
  pollMs: 60_000,
  thresholds: { high: 0.55, medium: 0.35, schoolMin: 6 },
  hybrid: { wBm: 0.55, wVec: 0.45, mmrLambda: 0.7, topK: 6, maxChars: 5000, vecPool: 200 },
  timeouts: { firstTokenMs: 4000, liveFirstTokenMs: 2500, totalMs: 60_000, classifyMs: 1500, embedMs: 1500, translateMs: 15_000 },
  numPredict: { brief: 350, more: 800, live: 220 },
  wordLimits: { brief: 150, more: 300, live: 70 },
  temperature: { chat: 0.3, calc: 0.1 },
  numCtx: 8192,
}

export const DIRS = {
  root: DATA_DIR,
  journal: path.join(DATA_DIR, 'journal'),
  students: path.join(DATA_DIR, 'students'),
  derived: path.join(DATA_DIR, 'derived'),
}

export const FILES = {
  kbJournal: path.join(DIRS.journal, 'kb-journal.jsonl'),
  dialogs: path.join(DIRS.journal, 'dialogs.jsonl'),
  config: path.join(DATA_DIR, 'config.json'),
  bm25: path.join(DIRS.derived, 'bm25-journal.json'),
}

export function ensureDataDirs(): void {
  for (const d of [DIRS.root, DIRS.journal, DIRS.students, DIRS.derived, path.join(DIRS.derived, 'embeddings')]) {
    fs.mkdirSync(d, { recursive: true })
  }
}

function merge<T extends Record<string, unknown>>(base: T, over: unknown): T {
  if (!over || typeof over !== 'object') return base
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    const b = (base as Record<string, unknown>)[k]
    if (b && typeof b === 'object' && !Array.isArray(b) && v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = merge(b as Record<string, unknown>, v)
    } else if (v !== undefined && (b === undefined || typeof v === typeof b)) out[k] = v
  }
  return out as T
}

/** config.json: создаётся с умолчаниями, если его нет; env OLLAMA_URL / BRAIN_OLLAMA_POLL_MS важнее файла. */
export function loadConfig(): BrainConfig {
  ensureDataDirs()
  let cfg = DEFAULT_CONFIG
  if (fs.existsSync(FILES.config)) {
    try {
      cfg = merge(DEFAULT_CONFIG, JSON.parse(fs.readFileSync(FILES.config, 'utf8')))
    } catch (err) {
      console.warn('[brain] config.json не читается, беру умолчания:', (err as Error).message)
    }
  } else {
    fs.writeFileSync(FILES.config, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n', { flag: 'wx' })
  }
  if (process.env.OLLAMA_URL) cfg = { ...cfg, ollamaUrl: process.env.OLLAMA_URL }
  if (process.env.BRAIN_OLLAMA_POLL_MS) cfg = { ...cfg, pollMs: Number(process.env.BRAIN_OLLAMA_POLL_MS) || cfg.pollMs }
  return cfg
}

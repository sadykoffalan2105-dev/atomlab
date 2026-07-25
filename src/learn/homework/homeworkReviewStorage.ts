import type { HomeworkReviewHistoryItem, HomeworkReviewReport } from './types'

const HISTORY_KEY = 'atomlab-homework-reviews-v1'
const MAX_ITEMS = 40

function readRaw(): HomeworkReviewHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    return JSON.parse(raw) as HomeworkReviewHistoryItem[]
  } catch {
    return []
  }
}

function writeRaw(items: HomeworkReviewHistoryItem[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
}

export function readHomeworkReviewHistory(): HomeworkReviewHistoryItem[] {
  return readRaw()
}

export function saveHomeworkReviewToHistory(report: HomeworkReviewReport): void {
  const item: HomeworkReviewHistoryItem = {
    id: report.id,
    createdAt: report.createdAt,
    authorship: report.authorship.authorship,
    aiProbability: report.authorship.aiProbability,
    chemistryVerdict: report.chemistry.verdict,
    score: report.chemistry.score,
    topicHint: report.input.topicHint,
    preview: report.input.text.slice(0, 160),
  }
  const next = [item, ...readRaw().filter((x) => x.id !== item.id)]
  writeRaw(next)
}

export function clearHomeworkReviewHistory(): void {
  writeRaw([])
}

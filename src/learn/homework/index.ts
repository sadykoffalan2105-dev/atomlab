export type { HomeworkAuthorship, HomeworkChemistryVerdict, HomeworkReviewReport, HomeworkScanInput, HomeworkScanSource } from './types'
export { analyzeAuthorshipLocal } from './authenticityDetector'
export { analyzeChemistryLocal } from './chemistryHomeworkAnalysis'
export { reviewHomework, reviewHomeworkLocal } from './homeworkReviewBrain'
export { buildHomeworkReviewPrompt } from './homeworkReviewPrompt'
export {
  captureHomeworkFromCamera,
  loadHomeworkImageFile,
  preprocessHomeworkImage,
} from './scanPipeline'
export {
  clearHomeworkReviewHistory,
  readHomeworkReviewHistory,
  saveHomeworkReviewToHistory,
} from './homeworkReviewStorage'

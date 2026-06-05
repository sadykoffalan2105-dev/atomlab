import { learnSectionById } from '../data/learnCurriculumUz'
import { getLearnFgosMeta } from '../data/learnFgosMatrix'
import { messagesRu } from '../i18n/messagesRu'
import type { LearnSection } from '../types/learn'

function msg(key: string): string {
  const v = messagesRu[key as keyof typeof messagesRu]
  return typeof v === 'string' ? v : key
}

/** Markdown-конспект § для печати / экспорта учителем. */
export function exportSectionLessonMarkdown(
  gradeId: string,
  chapterId: string,
  section: LearnSection,
): string {
  const fgos = getLearnFgosMeta(section.gradeId, chapterId, section.id)
  const lines: string[] = [
    `# ${msg(section.titleKey)}`,
    '',
    `**Класс:** ${gradeId} · **Глава:** ${chapterId} · **§${section.kpNumber}**`,
    `**ФГОС / программа:** ${fgos.programBlock}`,
    `**Часы (рекомендация):** ${fgos.hours}`,
    `**Умения:** ${fgos.skills.join('; ')}`,
    '',
    '## Слайды урока',
    '',
  ]

  for (const slide of section.slides) {
    if (slide.type === 'theory' || slide.type === 'example') {
      lines.push(`### ${msg(slide.titleKey)}`, '', msg(slide.bodyKey), '')
      if (slide.bulletsKey) {
        const bullets = msg(slide.bulletsKey).split('|')
        for (const b of bullets) lines.push(`- ${b}`)
        lines.push('')
      }
    } else if (slide.type === 'checkpoint') {
      lines.push(`### Контрольный вопрос`, '', msg(slide.questionKey), '')
      slide.choiceKeys.forEach((ck, i) => {
        lines.push(`${i === slide.correctIndex ? '✓' : '○'} ${msg(ck)}`)
      })
      lines.push('')
    } else if (slide.type === 'practice') {
      lines.push(`### Практикум: задачи (${slide.taskCategoryId})`, '')
    } else if (slide.type === 'labInvite') {
      lines.push(`### Лаборатория ATOMLAB`, '', msg(slide.bodyKey), '')
    } else if (slide.type === 'interactive3d') {
      lines.push(`### 3D-модель`, '', msg(slide.captionKey), '')
    }
  }

  lines.push('---', '*Сгенерировано ATOMLAB · atomlab*')
  return lines.join('\n')
}

export function downloadTextFile(filename: string, content: string, mime = 'text/markdown;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function sectionExists(gradeId: string, chapterId: string, sectionId: string): boolean {
  return !!learnSectionById(gradeId, chapterId, sectionId)
}

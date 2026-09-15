import { memo } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import styles from './LearnAssistantMarkdown.module.css'

const COMPONENTS: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className={styles.tableWrap}>
      <table>{children}</table>
    </div>
  ),
}

const PLUGINS = [remarkGfm]

/**
 * Markdown ответа ИИ-учителя (без innerHTML). Мемоизирован: при печати ответа
 * и обновлениях ленты перерисовывается только изменившееся сообщение.
 */
export const LearnAssistantMarkdown = memo(function LearnAssistantMarkdown({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  return (
    <div className={className ? `${styles.md} ${className}` : styles.md}>
      <ReactMarkdown remarkPlugins={PLUGINS} components={COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  )
})

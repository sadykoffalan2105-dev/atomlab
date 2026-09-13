import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import styles from './LearnAssistantMarkdown.module.css'

export function LearnAssistantMarkdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className ? `${styles.md} ${className}` : styles.md}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
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
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

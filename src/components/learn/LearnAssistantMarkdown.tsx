import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import styles from '../../pages/LearnPage.module.css'

export function LearnAssistantMarkdown({ text }: { text: string }) {
  return (
    <div className={styles.learnAssistantMd}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
    </div>
  )
}

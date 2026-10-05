/**
 * Точка входа витрины просмотрщика органики v2 (отдельная HTML-страница сборки витрины, не часть сайта):
 * тема из ?theme=light|dark ставится на <html data-app-theme>, как в приложении.
 */
import { createRoot } from 'react-dom/client'
import '../../../index.css'
import '../../../learn/learnTheme.css'
import '../../../theme/appTheme.css'
import { MoleculeViewerSandbox } from './MoleculeViewerSandbox'

const theme = new URLSearchParams(location.search).get('theme') === 'light' ? 'light' : 'dark'
document.documentElement.setAttribute('data-app-theme', theme)
document.body.style.background = 'var(--lt-bg)'
document.body.style.margin = '0'

createRoot(document.getElementById('root')!).render(<MoleculeViewerSandbox />)

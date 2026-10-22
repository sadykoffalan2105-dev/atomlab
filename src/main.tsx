import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './learn/learnTheme.css'
import './theme/appTheme.css'
import App from './App.tsx'
import { initAppTheme } from './theme/appTheme'
import { LocaleProvider } from './i18n/LocaleProvider'

/* Тема — до первого кадра, иначе мигнёт чужой фон. Прогрев лаборатории — в AppShell, после показа страницы. */
initAppTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </StrictMode>,
)

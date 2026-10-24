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

/* Свой кэш сайта (public/sw.js): GitHub Pages даёт хранить файлы лишь 10 минут — на медленном интернете
 * каждый заход ждал мегабайты заново. Только в собранном сайте по http(s); в разработке и в приложении — нет. */
if (import.meta.env.PROD && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {})
    navigator.serviceWorker.ready
      .then((reg) => {
        const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.includes('/assets/'))
        reg.active?.postMessage({ type: 'cache-assets', urls })
      })
      .catch(() => {})
  })
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LocaleProvider } from './i18n/LocaleProvider'
import { prefetchAtomlabWasm } from './wasm/atomlabWasmShared'
import { warmupLabSynthesisInfra } from './lab/labSynthesisWarmup'
import { compoundById } from './data/compounds'

prefetchAtomlabWasm()
warmupLabSynthesisInfra(Object.values(compoundById))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </StrictMode>,
)

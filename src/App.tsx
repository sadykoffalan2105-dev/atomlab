import { HashRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from './AppShell'
import { LaboratoryPage } from './pages/LaboratoryPage'
import { PeriodicTablePage } from './pages/PeriodicTablePage'
import { CatalogPage } from './pages/CatalogPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<LaboratoryPage />} />
          <Route path="periodic" element={<PeriodicTablePage />} />
          <Route path="catalog" element={<CatalogPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

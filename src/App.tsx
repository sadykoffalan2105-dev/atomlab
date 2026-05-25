import { HashRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from './AppShell'
import { LaboratoryPage } from './pages/LaboratoryPage'
import { PeriodicTablePage } from './pages/PeriodicTablePage'
import { CatalogPage } from './pages/CatalogPage'
import { LearnPage } from './pages/LearnPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<LaboratoryPage />} />
          <Route path="periodic" element={<PeriodicTablePage />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="learn" element={<LearnPage />} />
          <Route path="learn/tasks" element={<LearnPage />} />
          <Route path="learn/tasks/:lessonId" element={<LearnPage />} />
          <Route path="learn/g/:gradeId" element={<LearnPage />} />
          <Route path="learn/g/:gradeId/c/:chapterId" element={<LearnPage />} />
          <Route path="learn/g/:gradeId/c/:chapterId/s/:sectionId" element={<LearnPage />} />
          <Route path="learn/:topicId" element={<LearnPage />} />
          <Route path="learn/:topicId/:lessonId" element={<LearnPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

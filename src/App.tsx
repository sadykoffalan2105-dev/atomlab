import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from './AppShell'
import { LaboratoryPage } from './pages/LaboratoryPage'

const PeriodicTablePage = lazy(() =>
  import('./pages/PeriodicTablePage').then((m) => ({ default: m.PeriodicTablePage })),
)
const CatalogPage = lazy(() => import('./pages/CatalogPage').then((m) => ({ default: m.CatalogPage })))
const LearnPage = lazy(() => import('./pages/LearnPage').then((m) => ({ default: m.LearnPage })))
const LearnTeacherHub = lazy(() =>
  import('./pages/LearnTeacherHub').then((m) => ({ default: m.LearnTeacherHub })),
)
const LearnRefCapturePage = lazy(() =>
  import('./pages/LearnRefCapturePage').then((m) => ({ default: m.LearnRefCapturePage })),
)

function PageFallback() {
  return (
    <div
      style={{
        flex: 1,
        minHeight: '50vh',
        background: '#03040a',
      }}
      aria-hidden
    />
  )
}

export default function App() {
  return (
    <HashRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<LaboratoryPage />} />
            <Route path="periodic" element={<PeriodicTablePage />} />
            <Route path="catalog" element={<CatalogPage />} />
            <Route path="learn" element={<LearnPage />} />
            <Route path="learn/teacher" element={<LearnTeacherHub />} />
            <Route path="learn/ref/:sceneId" element={<LearnRefCapturePage />} />
            <Route path="learn/tasks" element={<LearnPage />} />
            <Route path="learn/tasks/:lessonId" element={<LearnPage />} />
            <Route path="learn/g/:gradeId/book" element={<LearnPage />} />
            <Route path="learn/g/:gradeId" element={<LearnPage />} />
            <Route path="learn/g/:gradeId/c/:chapterId" element={<LearnPage />} />
            <Route path="learn/g/:gradeId/c/:chapterId/s/:sectionId" element={<LearnPage />} />
            <Route path="learn/:topicId" element={<LearnPage />} />
            <Route path="learn/:topicId/:lessonId" element={<LearnPage />} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  )
}

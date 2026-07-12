import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { AppBootSplash } from './components/AppBootSplash'
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
const LearnResearchLab = lazy(() =>
  import('./pages/LearnResearchLab').then((m) => ({ default: m.LearnResearchLab })),
)
const LearnPathwaysHub = lazy(() =>
  import('./pages/LearnPathwaysHub').then((m) => ({ default: m.LearnPathwaysHub })),
)
const LearnPathwayPage = lazy(() =>
  import('./pages/LearnPathwayPage').then((m) => ({ default: m.LearnPathwayPage })),
)
const VrLabPage = lazy(() => import('./pages/VrLabPage').then((m) => ({ default: m.VrLabPage })))
const OrganicLabPage = lazy(() =>
  import('./pages/OrganicLabPage').then((m) => ({ default: m.OrganicLabPage })),
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
    <AppBootSplash>
      <HashRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<AppShell />}>
              <Route index element={<LaboratoryPage />} />
              <Route path="organic" element={<OrganicLabPage />} />
              <Route path="vr-lab" element={<VrLabPage />} />
              <Route path="periodic" element={<PeriodicTablePage />} />
              <Route path="catalog" element={<CatalogPage />} />
              <Route path="learn" element={<LearnPage />} />
              <Route path="learn/pathways" element={<LearnPathwaysHub />} />
              <Route path="learn/pathway/:pathwayId" element={<LearnPathwayPage />} />
              <Route path="learn/pathway/:pathwayId/:stepId" element={<LearnPathwayPage />} />
              <Route path="learn/teacher" element={<LearnTeacherHub />} />
              <Route path="learn/research" element={<LearnResearchLab />} />
              <Route path="learn/research/:mode" element={<LearnResearchLab />} />
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
    </AppBootSplash>
  )
}

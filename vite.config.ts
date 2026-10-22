import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { learnChatMiddleware } from './server/learnChatMiddleware'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)

  const teacherPort = env.TEACHER_SERVICE_PORT || '8765'

  return {
    // GitHub Pages: VITE_BASE=/atomlab/ ; Electron: default ./
    base: env.VITE_BASE || './',
    server: {
      proxy: {
        '/teacher-api': {
          target: `http://127.0.0.1:${teacherPort}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/teacher-api/, ''),
        },
      },
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              // React — отдельно и с приоритетом: иначе группы движков (rapier, three) забирают его себе вместе
              // со своими зависимостями, и любая страница качала ≈ 1,8 МБ движков (gzip) только ради React.
              {
                name: 'react-vendor',
                test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/,
                priority: 30,
              },
              // three и @react-three/* (кроме rapier) — выше физики: иначе группа rapier забирала three себе,
              // и любая 3D-сцена тянула ещё ≈ 1 МБ физического движка, нужного только VR-лаборатории.
              { name: 'three-vendor', test: /node_modules[\\/](three|@react-three[\\/](?!rapier))/, priority: 20 },
              {
                name: 'rapier-vendor',
                test: /node_modules[\\/](@react-three[\\/]rapier|@dimforge)/,
                priority: 10,
              },
              // Сцены (learn-3d, lab-scene) отдельными группами не выделяем: группа забирает к себе и общие мелкие
              // модули, и тогда старт любой страницы тянул 3D-сцену с three и rapier (≈ 3 МБ). Страницы с 3D и так
              // грузятся по требованию (lazy) — сборщик сам кладёт сцены в их чанки.
              {
                name: 'compounds-data',
                test: /data[\\/]compounds/,
              },
              // Знания ИИ-учителя: шарды новой базы src/data/kb/index грузятся
              // динамическим import() и по умолчанию сами становятся отдельными
              // чанками (0,2–1,5 МБ). Старый мега-пак (~155 МБ) в сборку не входит.
            ],
          },
        },
      },
    },
    plugins: [
      react(),
      {
        name: 'learn-chat-api',
        configureServer(server) {
          server.middlewares.use(learnChatMiddleware())
          void import('./server/edgeTtsPython').then(({ warmupEdgeTtsDaemon }) =>
            warmupEdgeTtsDaemon().then((r) => {
              if (r) console.log('[teacher-voice] Neural TTS warmed up (ATOMLAB Teacher)')
              else {
                void import('./src/learn/learnMsEdgeTts').then(({ synthesizeMsEdgeTeacherSpeech }) =>
                  synthesizeMsEdgeTeacherSpeech('Готов к уроку.', 'ru').then((fallback) => {
                    if (fallback) console.log('[teacher-voice] msedge-tts fallback ready')
                    else console.warn('[teacher-voice] TTS warmup failed — check network')
                  }),
                )
              }
            }),
          )
        },
      },
    ],
  }
})

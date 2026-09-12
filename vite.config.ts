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
              {
                name: 'rapier-vendor',
                test: /node_modules[\\/](@react-three\/rapier|@dimforge)/,
              },
              { name: 'three-vendor', test: /node_modules[\\/](three|@react-three)/ },
              { name: 'learn-3d', test: /LearnPremiumScene|LearnTopicScene/ },
              {
                name: 'lab-scene',
                test: /components[\\/]lab[\\/](LabScene|ReactorTermsPreview|LabProductHeroSlot|SynthesisOnLabScene)/,
              },
              {
                name: 'compounds-data',
                test: /data[\\/]compounds/,
              },
              // Каждый мега-пак учителя — свой чанк: если склеить все 7 в один
              // (как получалось по умолчанию, раз их статически импортирует
              // один и тот же модуль), итоговый файл переваливает за 150 МБ и
              // gh-pages отклоняет пуш (лимит GitHub — 100 МБ/файл). По
              // отдельности каждый шард — 16–28 МБ, с запасом укладывается.
              { name: 'teacher-knowledge-0', test: /teacherKnowledge[\\/]megaPack\.json$/ },
              { name: 'teacher-knowledge-1', test: /teacherKnowledge[\\/]megaPackExtra\.json$/ },
              { name: 'teacher-knowledge-2', test: /teacherKnowledge[\\/]megaPackExtra2\.json$/ },
              { name: 'teacher-knowledge-3', test: /teacherKnowledge[\\/]megaPackExtra3\.json$/ },
              { name: 'teacher-knowledge-4', test: /teacherKnowledge[\\/]megaPackExtra4\.json$/ },
              { name: 'teacher-knowledge-5', test: /teacherKnowledge[\\/]megaPackExtra5\.json$/ },
              { name: 'teacher-knowledge-6', test: /teacherKnowledge[\\/]megaPackExtra6\.json$/ },
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

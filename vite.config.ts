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
              { name: 'three-vendor', test: /node_modules[\\/](three|@react-three)/ },
              { name: 'learn-3d', test: /LearnPremiumScene|LearnTopicScene/ },
              {
                name: 'learn-cyber',
                test: /CyberDashboardGrid|CyberTaskSceneSvg|CyberExploreCanvas/,
              },
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
              if (r) console.log('[teacher-voice] Neural TTS daemon warmed up (ATOMLAB Teacher)')
              else console.warn('[teacher-voice] TTS warmup failed — run: npm run setup:teacher-voice')
            }),
          )
        },
      },
    ],
  }
})

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { learnChatMiddleware } from './server/learnChatMiddleware'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)

  return {
    // GitHub Pages: VITE_BASE=/atomlab/ ; Electron: default ./
    base: env.VITE_BASE || './',
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
        },
      },
    ],
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { learnChatMiddleware } from './server/learnChatMiddleware'

// https://vite.dev/config/
export default defineConfig({
  // Relative paths so `loadFile(dist/index.html)` works in Electron (file://)
  base: './',
  plugins: [
    react(),
    {
      name: 'learn-chat-api',
      configureServer(server) {
        server.middlewares.use(learnChatMiddleware())
      },
    },
  ],
})

/** Сборка dev-страницы листа кадров (scripts/sheet/models-sheet.html) — отдельно от приложения. */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: here,
  base: './',
  plugins: [react()],
  build: { rolldownOptions: { input: fileURLToPath(new URL('./models-sheet.html', import.meta.url)) } },
})

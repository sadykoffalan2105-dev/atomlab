/**
 * Проверка зависимостей сервера мозга (deploy/brain-pc/deps.ps1): загружается ли brain/server.ts со всеми импортами.
 * Ничего не запускает (у server.ts запуск только при прямом вызове) и ничего не пишет на диск.
 * Печатает «deps-ok» или причину (например, ERR_MODULE_NOT_FOUND — нужен полный npm ci).
 */
try {
  await import('../../brain/server.ts')
  console.log('deps-ok')
} catch (err) {
  const e = err as { code?: string; message?: string }
  console.log(`deps-fail ${e.code ?? ''} ${e.message ?? String(err)}`)
  process.exitCode = 1
}

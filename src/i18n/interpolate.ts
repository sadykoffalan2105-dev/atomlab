/** Подстановка `{key}` в строку (простой i18n без зависимостей). */
export function interpolate(template: string, params?: Readonly<Record<string, string | number>>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = params[k]
    return v !== undefined && v !== null ? String(v) : `{${k}}`
  })
}

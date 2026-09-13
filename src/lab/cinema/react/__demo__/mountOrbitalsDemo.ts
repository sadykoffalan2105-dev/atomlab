import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { OrbitalsDemo } from './OrbitalsDemo'

/**
 * Монтирует OrbitalsDemo поверх текущей страницы (только для разработки).
 * Вызов из консоли DevTools на dev-сервере:
 *   (await import('/src/lab/cinema/react/__demo__/mountOrbitalsDemo.ts')).mountOrbitalsDemo()
 * Возвращает функцию, которая закрывает демо.
 */
export function mountOrbitalsDemo(parent: HTMLElement = document.body): () => void {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#02030a'
  parent.appendChild(host)
  const root = createRoot(host)
  root.render(createElement(OrbitalsDemo))
  return () => {
    root.unmount()
    host.remove()
  }
}

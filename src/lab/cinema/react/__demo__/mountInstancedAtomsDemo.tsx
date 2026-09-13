import { createRoot } from 'react-dom/client'
import type { AtomRenderMode } from '../../core/atomImpostorShader'
import { InstancedAtomsDemo } from './InstancedAtomsDemo'

/**
 * DEV-ONLY: смонтировать стенд InstancedAtoms в элемент. Возвращает размонтирование.
 * time — заморозить анимацию кольца на этом времени (детерминированные скриншоты).
 */
export function mountInstancedAtomsDemo(el: HTMLElement, mode: AtomRenderMode = 'impostor', time?: number): () => void {
  const host = document.createElement('div')
  el.appendChild(host)
  const root = createRoot(host)
  root.render(<InstancedAtomsDemo mode={mode} time={time} />)
  return () => {
    root.unmount()
    host.remove()
  }
}

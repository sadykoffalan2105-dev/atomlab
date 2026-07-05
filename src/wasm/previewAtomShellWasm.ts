import { getAtomlabWasmInstanceSync } from './atomlabWasmShared'

type ShellWasmExports = {
  atomlab_shell_render_count: (
    previewCount: number,
    shellCount: number,
    expectedCount: number,
    editing: number,
  ) => number
}

/** TS fallback — зеркало C++ atomlab_shell_render_count. */
export function shellRenderCountTs(
  previewCount: number,
  shellCount: number,
  expectedCount: number,
  editing: boolean,
): number {
  if (expectedCount <= 0) {
    if (previewCount > 0) return previewCount
    return shellCount
  }
  if (!editing) {
    if (previewCount >= expectedCount) return previewCount
    if (previewCount > 0) return previewCount
    return shellCount
  }
  if (previewCount >= expectedCount) return previewCount
  if (previewCount === 0 && shellCount > 0) {
    return shellCount >= expectedCount ? expectedCount : shellCount
  }
  if (expectedCount > previewCount && shellCount > previewCount) {
    if (shellCount >= expectedCount) return expectedCount
    return shellCount
  }
  if (previewCount > 0) return previewCount
  if (shellCount > 0) return shellCount >= expectedCount ? expectedCount : shellCount
  return previewCount
}

/** Быстрый подсчёт render slots: WASM sync или TS. */
export function resolveShellRenderCount(
  previewCount: number,
  shellCount: number,
  expectedCount: number,
  editing: boolean,
): number {
  const inst = getAtomlabWasmInstanceSync()
  if (inst) {
    const exp = inst.exports as unknown as ShellWasmExports
    if (typeof exp.atomlab_shell_render_count === 'function') {
      const n = exp.atomlab_shell_render_count(
        previewCount,
        shellCount,
        expectedCount,
        editing ? 1 : 0,
      )
      if (n >= 0) return n
    }
  }
  return shellRenderCountTs(previewCount, shellCount, expectedCount, editing)
}

/** Единая загрузка atomlab_core.wasm — без двойного fetch при прогреве. */

let wasmInstance: WebAssembly.Instance | null = null
let wasmLoad: Promise<WebAssembly.Instance | null> | null = null

function wasmUrl(): string {
  const base = `${import.meta.env.BASE_URL || '/'}wasm/atomlab_core.wasm`.replace(/\.\//g, '/').replace(/\/+/g, '/')
  return base.startsWith('http') ? base : `${window.location.origin}${base.startsWith('/') ? '' : '/'}${base}`
}

export function prefetchAtomlabWasm(): void {
  void getAtomlabWasmInstance()
}

export function getAtomlabWasmInstanceSync(): WebAssembly.Instance | null {
  return wasmInstance
}

export async function getAtomlabWasmInstance(): Promise<WebAssembly.Instance | null> {
  if (wasmInstance) return wasmInstance
  if (!wasmLoad) {
    wasmLoad = (async () => {
      try {
        const res = await fetch(wasmUrl())
        if (!res.ok) return null
        const buf = await res.arrayBuffer()
        const { instance } = await WebAssembly.instantiate(buf, {
          env: {
            abort: () => {
              throw new Error('wasm abort')
            },
          },
        })
        wasmInstance = instance
        return instance
      } catch {
        return null
      }
    })()
  }
  return wasmLoad
}

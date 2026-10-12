/**
 * Клиент ComfyUI (http://127.0.0.1:8188, только с этого ПК): только fetch, служебные вызовы — с таймаутом 3 с.
 * Картинку в WebP перекодирует сам ComfyUI (/view?preview=webp;85) — Node картинки не кодирует.
 */
import type { Graph } from './workflows.ts'

export type ComfyImageRef = { filename: string; subfolder: string; type: string }
export type ComfySafety = { index?: number; nsfw: number; normal: number; model?: string; ms?: number }
export type ComfyHistory = {
  status?: { status_str?: string; completed?: boolean; messages?: unknown[] }
  outputs?: Record<string, { images?: ComfyImageRef[]; atomlab_safety?: ComfySafety[] }>
}
export type ComfyDevice = { name?: string; vram_total: number; vram_free: number }

const SERVICE_MS = 3000

export class ComfyClient {
  readonly baseUrl: string
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
  }

  private async getJson<T>(p: string, timeoutMs = SERVICE_MS): Promise<T> {
    const r = await fetch(this.baseUrl + p, { signal: AbortSignal.timeout(timeoutMs) })
    if (!r.ok) throw new Error(`comfy ${p}: HTTP ${r.status}`)
    return (await r.json()) as T
  }

  private async postJson<T>(p: string, body: unknown, timeoutMs = SERVICE_MS): Promise<{ status: number; body: T | null }> {
    const r = await fetch(this.baseUrl + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) })
    const text = await r.text()
    let j: T | null
    try {
      j = text ? (JSON.parse(text) as T) : null
    } catch {
      j = null
    }
    return { status: r.status, body: j }
  }

  /** GET /system_stats → первая видеокарта (байты). */
  async systemStats(): Promise<{ devices: ComfyDevice[] }> {
    const j = await this.getJson<{ devices?: Partial<ComfyDevice>[] }>('/system_stats')
    return { devices: (j.devices ?? []).map((d) => ({ name: d.name, vram_total: Number(d.vram_total) || 0, vram_free: Number(d.vram_free) || 0 })) }
  }

  /** GET /object_info/<класс>: пустой объект — такого узла нет. */
  async objectInfo(cls: string): Promise<Record<string, { input?: { required?: Record<string, unknown>; optional?: Record<string, unknown> } }>> {
    return this.getJson(`/object_info/${encodeURIComponent(cls)}`)
  }

  /** POST /prompt — поставить граф в очередь ComfyUI. node_errors непустой — граф не принят. */
  async queuePrompt(graph: Graph, clientId: string): Promise<{ prompt_id: string; number: number; node_errors: Record<string, unknown> }> {
    const r = await this.postJson<{ prompt_id?: string; number?: number; node_errors?: Record<string, unknown>; error?: { message?: string } }>('/prompt', { prompt: graph, client_id: clientId }, 10_000)
    if (r.status !== 200 || !r.body?.prompt_id) {
      const msg = r.body?.error?.message ?? (r.body?.node_errors ? JSON.stringify(r.body.node_errors).slice(0, 200) : `HTTP ${r.status}`)
      throw new Error(`prompt: ${msg}`)
    }
    return { prompt_id: r.body.prompt_id, number: Number(r.body.number) || 0, node_errors: r.body.node_errors ?? {} }
  }

  /** GET /history/{id} → запись задания (null — ещё нет). */
  async history(promptId: string): Promise<ComfyHistory | null> {
    const j = await this.getJson<Record<string, ComfyHistory>>(`/history/${encodeURIComponent(promptId)}`)
    return j[promptId] ?? null
  }

  /** GET /queue → позиция задания: индекс по prompt_id среди ждущих (0 — выполняется или уже нет). */
  async queueState(): Promise<{ running: string[]; pending: string[] }> {
    const j = await this.getJson<{ queue_running?: unknown[][]; queue_pending?: unknown[][] }>('/queue')
    const ids = (a?: unknown[][]) => (a ?? []).map((x) => String(Array.isArray(x) ? x[1] : ''))
    return { running: ids(j.queue_running), pending: ids(j.queue_pending) }
  }

  /** GET /view?…&preview=webp;<q> — готовая картинка в WebP (перекодирует ComfyUI). */
  async view(ref: ComfyImageRef, quality: number): Promise<Buffer> {
    const q = new URLSearchParams({ filename: ref.filename, subfolder: ref.subfolder ?? '', type: ref.type || 'output', preview: `webp;${Math.max(1, Math.min(100, Math.round(quality)))}` })
    const r = await fetch(`${this.baseUrl}/view?${q}`, { signal: AbortSignal.timeout(15_000) })
    if (!r.ok) throw new Error(`view: HTTP ${r.status}`)
    return Buffer.from(await r.arrayBuffer())
  }

  /** POST /free — выгрузить модели картинок и освободить видеопамять (перед возвратом Gemma). */
  async free(): Promise<void> {
    await this.postJson('/free', { unload_models: true, free_memory: true })
  }

  /** POST /interrupt — остановить задание (тайм-аут). */
  async interrupt(promptId: string): Promise<void> {
    await this.postJson('/interrupt', { prompt_id: promptId })
  }
}

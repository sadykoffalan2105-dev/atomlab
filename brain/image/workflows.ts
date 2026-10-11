/**
 * Графы ComfyUI в API-формате (POST /prompt {prompt: graph}). Имена файлов моделей — те, что кладёт установщик
 * (deploy/brain-pc/comfy/manifest.json) в ComfyUI/models/**. Имена входов узлов сверяются вживую:
 * scripts/brain/image.live.mts --verify-graph (GET /object_info/<класс>) — расхождение = провал приёмки.
 * Последний узел каждого графа — наш ATOMLABSafetyCheck (классификатор Falconsai NSFW ViT): без его ответа
 * картинка не отдаётся никому.
 */
import type { ImageEngine, ImageVariant } from '../config.ts'

export type GraphNode = { class_type: string; inputs: Record<string, unknown> }
export type Graph = Record<string, GraphNode>

/** Файлы моделей по движку и варианту (папки ComfyUI/models/<dir>). */
export const MODEL_FILES: Record<string, { unet: string; clip: string; vae: string }> = {
  'z-image-turbo:int8': { unet: 'z_image_turbo_int8_convrot.safetensors', clip: 'qwen_3_4b_fp8_mixed.safetensors', vae: 'ae.safetensors' },
  'z-image-turbo:bf16': { unet: 'z_image_turbo_bf16.safetensors', clip: 'qwen_3_4b.safetensors', vae: 'ae.safetensors' },
  'z-image-turbo:nvfp4': { unet: 'z_image_turbo_nvfp4.safetensors', clip: 'qwen_3_4b_fp4_mixed.safetensors', vae: 'ae.safetensors' },
  'flux2-klein-4b:fp8': { unet: 'flux-2-klein-4b-fp8.safetensors', clip: 'qwen_3_4b.safetensors', vae: 'flux2-vae.safetensors' },
}

/** Шаги по умолчанию (config.image.steps = 0). */
export const DEFAULT_STEPS: Record<ImageEngine, number> = { 'z-image-turbo': 8, 'flux2-klein-4b': 4 }

export const SAFETY_CLASS = 'ATOMLABSafetyCheck'

/**
 * Узлы, которые мы вообще шлём, и их обязательные входы (по графам ниже). Поддельный ComfyUI в selftest валидирует
 * по этому списку, --verify-graph сверяет его с /object_info живого сервера.
 */
export const NODE_INPUTS: Record<string, string[]> = {
  UNETLoader: ['unet_name', 'weight_dtype'],
  CLIPLoader: ['clip_name', 'type'],
  VAELoader: ['vae_name'],
  ModelSamplingAuraFlow: ['model', 'shift'],
  CLIPTextEncode: ['text', 'clip'],
  ConditioningZeroOut: ['conditioning'],
  EmptySD3LatentImage: ['width', 'height', 'batch_size'],
  KSampler: ['model', 'seed', 'steps', 'cfg', 'sampler_name', 'scheduler', 'positive', 'negative', 'latent_image', 'denoise'],
  VAEDecode: ['samples', 'vae'],
  SaveImage: ['images', 'filename_prefix'],
  CFGGuider: ['model', 'positive', 'negative', 'cfg'],
  KSamplerSelect: ['sampler_name'],
  Flux2Scheduler: ['steps', 'width', 'height'],
  RandomNoise: ['noise_seed'],
  EmptyFlux2LatentImage: ['width', 'height', 'batch_size'],
  SamplerCustomAdvanced: ['noise', 'guider', 'sampler', 'sigmas', 'latent_image'],
  [SAFETY_CLASS]: ['images'],
}

export type BuildGraphInput = { engine: ImageEngine; variant: ImageVariant; prompt: string; width: number; height: number; seed: number; steps: number; jobId: string }

export function modelKey(engine: ImageEngine, variant: ImageVariant): string {
  return `${engine}:${variant}`
}

/** Вариант, допустимый для движка (klein — только fp8; z-image — int8 | bf16 | nvfp4, иначе int8). */
export function normalizeVariant(engine: ImageEngine, variant: ImageVariant): ImageVariant {
  if (engine === 'flux2-klein-4b') return 'fp8'
  return variant === 'bf16' || variant === 'nvfp4' ? variant : 'int8'
}

export function buildGraph(o: BuildGraphInput): { graph: Graph; saveNodeId: string; safetyNodeId: string } {
  const variant = normalizeVariant(o.engine, o.variant)
  const files = MODEL_FILES[modelKey(o.engine, variant)]!
  const steps = o.steps > 0 ? Math.min(Math.round(o.steps), 50) : DEFAULT_STEPS[o.engine]
  const prefix = `atomlab/${o.jobId}`
  if (o.engine === 'flux2-klein-4b') {
    return {
      graph: {
        '1': { class_type: 'UNETLoader', inputs: { unet_name: files.unet, weight_dtype: 'default' } },
        '2': { class_type: 'CLIPLoader', inputs: { clip_name: files.clip, type: 'flux2', device: 'default' } },
        '3': { class_type: 'VAELoader', inputs: { vae_name: files.vae } },
        '4': { class_type: 'CLIPTextEncode', inputs: { text: o.prompt, clip: ['2', 0] } },
        '5': { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['4', 0] } },
        '6': { class_type: 'CFGGuider', inputs: { cfg: 1, model: ['1', 0], positive: ['4', 0], negative: ['5', 0] } },
        '7': { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
        '8': { class_type: 'Flux2Scheduler', inputs: { steps, width: o.width, height: o.height } },
        '9': { class_type: 'RandomNoise', inputs: { noise_seed: o.seed } },
        '10': { class_type: 'EmptyFlux2LatentImage', inputs: { width: o.width, height: o.height, batch_size: 1 } },
        '11': { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['9', 0], guider: ['6', 0], sampler: ['7', 0], sigmas: ['8', 0], latent_image: ['10', 0] } },
        '12': { class_type: 'VAEDecode', inputs: { samples: ['11', 0], vae: ['3', 0] } },
        '13': { class_type: 'SaveImage', inputs: { filename_prefix: prefix, images: ['12', 0] } },
        '14': { class_type: SAFETY_CLASS, inputs: { images: ['12', 0] } },
      },
      saveNodeId: '13',
      safetyNodeId: '14',
    }
  }
  return {
    graph: {
      '1': { class_type: 'UNETLoader', inputs: { unet_name: files.unet, weight_dtype: 'default' } },
      '2': { class_type: 'CLIPLoader', inputs: { clip_name: files.clip, type: 'lumina2', device: 'default' } },
      '3': { class_type: 'VAELoader', inputs: { vae_name: files.vae } },
      '4': { class_type: 'ModelSamplingAuraFlow', inputs: { shift: 3, model: ['1', 0] } },
      '5': { class_type: 'CLIPTextEncode', inputs: { text: o.prompt, clip: ['2', 0] } },
      '6': { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['5', 0] } },
      '7': { class_type: 'EmptySD3LatentImage', inputs: { width: o.width, height: o.height, batch_size: 1 } },
      '8': {
        class_type: 'KSampler',
        inputs: { seed: o.seed, steps, cfg: 1, sampler_name: 'res_multistep', scheduler: 'simple', denoise: 1, model: ['4', 0], positive: ['5', 0], negative: ['6', 0], latent_image: ['7', 0] },
      },
      '9': { class_type: 'VAEDecode', inputs: { samples: ['8', 0], vae: ['3', 0] } },
      '10': { class_type: 'SaveImage', inputs: { filename_prefix: prefix, images: ['9', 0] } },
      '11': { class_type: SAFETY_CLASS, inputs: { images: ['9', 0] } },
    },
    saveNodeId: '10',
    safetyNodeId: '11',
  }
}

/** Классы узлов графа (для --verify-graph). */
export function graphClasses(engine: ImageEngine): string[] {
  const g = buildGraph({ engine, variant: engine === 'flux2-klein-4b' ? 'fp8' : 'int8', prompt: 'x', width: 1024, height: 1024, seed: 1, steps: 0, jobId: 'verify' }).graph
  return [...new Set(Object.values(g).map((n) => n.class_type))]
}

export type GraphCheck = { class: string; ok: boolean; missing: string[]; unknown: string[]; absent?: boolean }
type ObjectInfoFn = (cls: string) => Promise<Record<string, { input?: { required?: Record<string, unknown>; optional?: Record<string, unknown> } }>>

/**
 * Сверить граф движка с живым ComfyUI (GET /object_info/<класс>): у каждого узла должны быть все required-входы
 * сервера, и не должно быть входов, которых узел не знает. objectInfo — метод клиента (ComfyClient.objectInfo).
 */
export async function verifyGraph(engine: ImageEngine, variant: ImageVariant, objectInfo: ObjectInfoFn): Promise<{ ok: boolean; checks: GraphCheck[] }> {
  const g = buildGraph({ engine, variant, prompt: 'verify', width: 1024, height: 1024, seed: 1, steps: 0, jobId: 'verify' }).graph
  const checks: GraphCheck[] = []
  const seen = new Set<string>()
  for (const n of Object.values(g)) {
    if (seen.has(n.class_type)) continue
    seen.add(n.class_type)
    let info: Awaited<ReturnType<ObjectInfoFn>>
    try {
      info = await objectInfo(n.class_type)
    } catch {
      info = {}
    }
    const def = info[n.class_type]
    if (!def) {
      checks.push({ class: n.class_type, ok: false, missing: [], unknown: [], absent: true })
      continue
    }
    const required = Object.keys(def.input?.required ?? {})
    const known = new Set([...required, ...Object.keys(def.input?.optional ?? {})])
    const missing = required.filter((k) => !(k in n.inputs))
    const unknown = Object.keys(n.inputs).filter((k) => !known.has(k))
    checks.push({ class: n.class_type, ok: !missing.length && !unknown.length, missing, unknown })
  }
  return { ok: checks.every((c) => c.ok), checks }
}

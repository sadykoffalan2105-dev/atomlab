/**
 * AudioWorklet «atomlab-pcm-capture»: микрофон → PCM16 16 кГц моно кадрами по 20 мс + RMS.
 *
 * Отдельный файл (не в бандле урока): грузится через audioWorklet.addModule. Ресемплинг из
 * частоты контекста (обычно 48 кГц, если браузер не дал 16 кГц) — линейный с усреднением окна,
 * как StreamResampler в src/learn/brain/voice/wavEncode.ts. В главный поток уходит
 * { type: 'frame', pcm: ArrayBuffer(Int16 × 320), rms } (буфер передаётся без копирования).
 * Аудио никуда не сохраняется — только кадры в память страницы.
 */
const OUT_RATE = 16000
const FRAME = 320

class AtomlabPcmCapture extends AudioWorkletProcessor {
  constructor() {
    super()
    // sampleRate — глобальная частота контекста в AudioWorkletGlobalScope.
    this.ratio = sampleRate / OUT_RATE
    this.half = this.ratio > 1 ? this.ratio / 2 : 0
    this.pos = 0
    this.tail = new Float32Array(0)
    this.frame = new Float32Array(FRAME)
    this.fill = 0
    this.port.postMessage({ type: 'ready', sampleRate })
  }

  push(v) {
    this.frame[this.fill++] = v
    if (this.fill < FRAME) return
    let sum = 0
    const pcm = new Int16Array(FRAME)
    for (let i = 0; i < FRAME; i++) {
      const s = Math.max(-1, Math.min(1, this.frame[i]))
      sum += s * s
      pcm[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff)
    }
    this.fill = 0
    this.port.postMessage({ type: 'frame', pcm: pcm.buffer, rms: Math.sqrt(sum / FRAME) }, [pcm.buffer])
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (!ch || ch.length === 0) return true
    if (this.ratio === 1) {
      for (let i = 0; i < ch.length; i++) this.push(ch[i])
      return true
    }
    const buf = new Float32Array(this.tail.length + ch.length)
    buf.set(this.tail, 0)
    buf.set(ch, this.tail.length)
    while (this.pos + this.half + 1 < buf.length) {
      if (this.ratio > 1) {
        const a = Math.max(0, Math.floor(this.pos - this.half))
        const b = Math.min(buf.length - 1, Math.ceil(this.pos + this.half))
        let sum = 0
        for (let i = a; i <= b; i++) sum += buf[i]
        this.push(sum / (b - a + 1))
      } else {
        const i = Math.floor(this.pos)
        const f = this.pos - i
        this.push(buf[i] * (1 - f) + buf[i + 1] * f)
      }
      this.pos += this.ratio
    }
    const keepFrom = Math.max(0, Math.floor(this.pos - this.half) - 1)
    this.tail = buf.slice(keepFrom)
    this.pos -= keepFrom
    return true
  }
}

registerProcessor('atomlab-pcm-capture', AtomlabPcmCapture)

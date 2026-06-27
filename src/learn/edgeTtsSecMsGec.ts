/** Параметры Sec-MS-GEC для Microsoft Edge Read-Aloud (как в edge-tts). */
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const CHROMIUM_FULL_VERSION = '143.0.3650.96'
const WIN_EPOCH = 11644473600

export const EDGE_TTS_SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`

let clockSkewSeconds = 0

function sha256HexUpper(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  return crypto.subtle.digest('SHA-256', data).then((buf) => {
    const bytes = new Uint8Array(buf)
    let hex = ''
    for (const b of bytes) hex += b.toString(16).padStart(2, '0')
    return hex.toUpperCase()
  })
}

/** Токен для WSS URL — без него Edge TTS отклоняет соединение (2024+). */
export async function generateEdgeTtsSecMsGec(): Promise<string> {
  let ticks = Math.floor(Date.now() / 1000) + clockSkewSeconds
  ticks += WIN_EPOCH
  ticks -= ticks % 300
  ticks *= 1e7
  return sha256HexUpper(`${ticks}${TRUSTED_CLIENT_TOKEN}`)
}

export function edgeTtsUtcTimestamp(): string {
  return new Date()
    .toUTCString()
    .replace('GMT', 'GMT+0000 (Coordinated Universal Time)')
}

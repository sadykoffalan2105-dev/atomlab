/**
 * Чистая логика ламп голоса (VoiceLamps.tsx) — отдельно от компонента (fast refresh) и для тестов без DOM.
 */
import type { VoiceDiag } from '../../../learn/brain/speech/voiceStatus'

export type LampState = 'on' | 'off' | 'warn' | 'lost'

/** Сколько слышна речь без текста до жёлтой лампы. */
export const STALL_MS = 8_000

/** Чистая логика ламп (тестируется без DOM). unansweredSince — с какого момента речь без текста. */
export function lampStates(
  d: Pick<VoiceDiag, 'mic' | 'path' | 'lastHeardAt' | 'lastTextAt' | 'lastServerOkAt' | 'sttBusy'>,
  now: number,
  unansweredSince: number | null,
  muted: boolean,
): { mic: LampState; stt: LampState } {
  const mic: LampState =
    d.mic === 'lost' || d.mic === 'denied' || d.mic === 'error'
      ? 'lost'
      : !muted && d.mic === 'live' && now - d.lastHeardAt <= 1_000
        ? 'on'
        : 'off'
  let stt: LampState = 'off'
  if (!muted && d.path !== 'none' && d.sttBusy) {
    const stalled = unansweredSince !== null && now - unansweredSince >= STALL_MS && now - d.lastHeardAt < 2_500
    stt = stalled ? 'warn' : 'on'
  }
  return { mic, stt }
}

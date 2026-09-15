import { useEffect, useRef, useState } from 'react'
import type { MatchAnimations } from '../../hooks/useMatchAnimations'

const storageKey = 'braverse.sound-enabled'

/** Optional presentation only. Audio never dispatches or delays game commands. */
export function MatchSoundControl({ events }: { events: MatchAnimations['activeEvents'] }) {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(storageKey) === 'true' } catch { return false }
  })
  const [ready, setReady] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [busy, setBusy] = useState(false)
  const context = useRef<AudioContext | null>(null)
  const lastBatch = useRef('')

  const tone = (frequency: number) => {
    const audio = context.current
    if (!audio || audio.state !== 'running') return
    const oscillator = audio.createOscillator()
    const gain = audio.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0, audio.currentTime)
    gain.gain.linearRampToValueAtTime(.045, audio.currentTime + .012)
    gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .14)
    oscillator.connect(gain).connect(audio.destination)
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
    oscillator.start()
    oscillator.stop(audio.currentTime + .15)
  }

  useEffect(() => {
    const batch = events.map(event => event.id).join('|')
    if (!batch || batch === lastBatch.current) return
    lastBatch.current = batch
    if (!enabled || !ready) return
    try {
      tone(events.some(event => event.kind === 'finish') ? 660 : events.some(event => event.kind === 'impact') ? 220 : 440)
    } catch (error) { console.warn('提示音播放失敗；對局繼續。', error) }
  }, [events, enabled, ready])

  useEffect(() => () => {
    const audio = context.current
    context.current = null
    if (audio && audio.state !== 'closed') void audio.close().catch(() => {})
  }, [])

  const toggle = async () => {
    const next = !enabled || !ready
    setBusy(true)
    try {
      if (next) {
        context.current ??= new AudioContext()
        await context.current.resume()
        tone(520)
        setReady(true)
      } else if (context.current?.state === 'running') {
        await context.current.suspend()
      }
      setUnavailable(false)
      setEnabled(next)
      try { localStorage.setItem(storageKey, String(next)) } catch { /* Session preference remains usable. */ }
    } catch { setUnavailable(true) }
    finally { setBusy(false) }
  }

  return <><button type="button" disabled={busy} aria-pressed={enabled && ready} onClick={() => void toggle()}>{enabled ? ready ? '音效：開' : '音效：點此啟用' : '音效：關'}</button>{unavailable && <span role="status">此瀏覽器目前無法播放音效</span>}</>
}

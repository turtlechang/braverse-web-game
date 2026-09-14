import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameState, PlayerId } from '../game'
import { describePresentation, maskPresentation, type PresentationEvent } from '../game/presentation'

export type AnimationSpeed = 'standard' | 'fast' | 'reduced'
const preferenceKey = 'braverse.animation-speed'
const readPreference = (): AnimationSpeed => {
  try {
    const value = localStorage.getItem(preferenceKey)
    return value === 'fast' || value === 'reduced' ? value : 'standard'
  } catch { return 'standard' }
}

export function useMatchAnimations(viewerId: PlayerId = 'player-one') {
  const [speed, setSpeedState] = useState<AnimationSpeed>(readPreference)
  const [systemReduced, setSystemReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  const [activeEvents, setActiveEvents] = useState<PresentationEvent[]>([])
  const [duration, setDuration] = useState(0)
  const queue = useRef<PresentationEvent[]>([])
  const timer = useRef<number | null>(null)
  const activeRef = useRef(false)
  const seen = useRef(new Set<string>())
  const fallbackSequence = useRef(0)
  const lastTransition = useRef<GameState | null>(null)
  const preference = useRef({ speed, systemReduced })
  useEffect(() => { preference.current = { speed, systemReduced } }, [speed, systemReduced])
  const pumpRef = useRef<() => void>(() => undefined)

  const resetAnimations = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
    queue.current = []
    activeRef.current = false
    setActiveEvents([])
    setDuration(0)
  }, [])

  const pump = useCallback(() => {
    if (activeRef.current || !queue.current.length) return
    const first = queue.current.shift()!
    const batch = [first]
    // Concurrent card movement is staggered, not N full blocking animations.
    while (queue.current[0]?.kind === first.kind && (first.kind === 'move' || first.kind === 'opening-reveal') && batch.length < 12) batch.push(queue.current.shift()!)
    const { speed: currentSpeed, systemReduced: reduced } = preference.current
    const reducedMotion = currentSpeed === 'reduced' || reduced
    const backlog = queue.current.reduce((sum, event) => sum + event.duration, 0)
    const factor = currentSpeed === 'fast' || backlog > 2000 ? 0.5 : 1
    const ms = reducedMotion ? 0 : Math.round((Math.max(...batch.map(event => event.duration)) + (batch.length - 1) * (first.kind === 'move' ? 60 : 0)) * factor)
    activeRef.current = true
    setActiveEvents(batch)
    setDuration(ms)
    timer.current = window.setTimeout(() => {
      activeRef.current = false
      timer.current = null
      setActiveEvents([])
      pumpRef.current()
    }, ms)
  }, [])
  useEffect(() => { pumpRef.current = pump }, [pump])

  const enqueue = useCallback((events: PresentationEvent[]) => {
    for (const event of maskPresentation(events, viewerId)) {
      if (seen.current.has(event.id)) continue
      seen.current.add(event.id)
      queue.current.push(event)
    }
    pump()
  }, [pump, viewerId])

  const observeTransition = useCallback((previous: GameState, next: GameState) => {
    if (previous === next || lastTransition.current === next) return
    lastTransition.current = next
    const previousId = previous.commandLog?.at(-1)?.id ?? 0
    const nextId = next.commandLog?.at(-1)?.id ?? 0
    if (nextId < previousId || (previous.status === 'finished' && next.status !== 'finished')) {
      resetAnimations()
      seen.current.clear()
      return
    }
    const receipts = next.commandLog?.filter(entry => entry.id > previousId) ?? []
    const events = receipts.flatMap(entry => entry.presentation ?? [])
    enqueue(events.length || receipts.some(entry => entry.presentation) ? events : describePresentation(previous, next, '', `local-${++fallbackSequence.current}`))
  }, [enqueue, resetAnimations])

  const setSpeed = useCallback((value: AnimationSpeed) => {
    preference.current = { ...preference.current, speed: value }
    setSpeedState(value)
    try { localStorage.setItem(preferenceKey, value) } catch { /* Storage is optional. */ }
    resetAnimations()
  }, [resetAnimations])

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const update = () => { setSystemReduced(query?.matches ?? false); resetAnimations() }
    const visibility = () => resetAnimations()
    query?.addEventListener('change', update)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      query?.removeEventListener('change', update)
      document.removeEventListener('visibilitychange', visibility)
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [resetAnimations])

  return {
    activeEvents, duration, speed, setSpeed,
    reducedMotion: speed === 'reduced' || systemReduced,
    isPlaying: activeEvents.length > 0 && duration > 0,
    isBusy: () => activeRef.current && preference.current.speed !== 'reduced' && !preference.current.systemReduced,
    skip: resetAnimations, resetAnimations, observeTransition, enqueue,
    attackShakeId: null,
    damageFlashId: null,
    faintAnimIds: new Set<string>(),
    drawAnimIds: new Set(activeEvents.filter(event => event.kind === 'move' && event.target?.zone === 'hand').map(event => event.card?.instanceId ?? '')),
  } as const
}
export type MatchAnimations = ReturnType<typeof useMatchAnimations>

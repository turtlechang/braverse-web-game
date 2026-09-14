import { useEffect, useId, useLayoutEffect, useRef, type CSSProperties } from 'react'
import type { PresentationAnchor } from '../../game/presentation'
import type { MatchAnimations } from '../../hooks/useMatchAnimations'
import { CardFace } from '../cards/CardVisuals'
import './MatchAnimationLayer.css'

const zoneSelectors = { deck: '.deck-zone', hand: '.hand-fan', battle: '.combat-zone', support: '.support-zone', break: '.break-zone', discard: '.discard-zone', stage: '.stage-zone', hp: '.hp-card-stack', extra: '.extra-zone', equipment: '.combat-zone' }
type Point = { x: number; y: number }

export function MatchAnimationLayer({ animation, entering = false }: { animation: MatchAnimations; entering?: boolean }) {
  const { activeEvents, duration, reducedMotion, speed, skip } = animation
  const introId = useId()
  const { enqueue } = animation
  useEffect(() => { if (entering) enqueue([{id:`intro-${introId}`,kind:'start',label:'對戰準備',duration:800}]) }, [enqueue, introId, entering])
  const layer = useRef<HTMLDivElement>(null)
  const positions = useRef(new Map<string, Point>())
  useLayoutEffect(() => {
    const element = layer.current
    const shell = element?.closest('.game-shell')
    if (!element || !shell) return
    const rect = element.getBoundingClientRect()
    const point = (node: Element): Point => {
      const bounds = node.getBoundingClientRect()
      return { x: bounds.x + bounds.width / 2 - rect.x, y: bounds.y + bounds.height / 2 - rect.y }
    }
    const find = (anchor?: PresentationAnchor, previous = false): Point => {
      if (!anchor) return { x: rect.width / 2, y: rect.height / 2 }
      const row = shell.querySelector(`[data-animation-player="${anchor.playerId}"]`)
      const card = [...(row?.querySelectorAll('[data-card-instance-id]') ?? [])].find(node => node.getAttribute('data-card-instance-id') === (anchor.hostId ?? anchor.instanceId))
      const saved = anchor.instanceId ? positions.current.get(anchor.instanceId) : undefined
      if (previous && saved) return saved
      const handSlot = anchor.zone === 'hand' && anchor.handSlot !== undefined ? row?.querySelector(`[data-hand-slot="${anchor.handSlot}"]`) : null
      if (handSlot) return point(handSlot)
      if (card && (anchor.hostId || card.closest(zoneSelectors[anchor.zone]))) return point(card)
      const zone = row?.querySelector(zoneSelectors[anchor.zone])
      return zone ? point(zone) : { x: rect.width / 2, y: rect.height / 2 }
    }
    const running: Animation[] = []
    const restore: (() => void)[] = []
    try { activeEvents.forEach((event, index) => {
      const node = element.querySelector<HTMLElement>(`[data-animation-index="${index}"]`)
      if (!node) return
      const from = find(event.source, true)
      const to = find(event.target ?? event.source)
      const link = element.querySelector<SVGPathElement>(`[data-animation-link="${index}"]`)
      if (link) {
        link.setAttribute('d', `M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${Math.min(from.y, to.y) - 30} ${to.x} ${to.y}`)
      }
      node.style.setProperty('--from-x', `${from.x}px`)
      node.style.setProperty('--from-y', `${from.y}px`)
      node.style.setProperty('--to-x', `${to.x}px`)
      node.style.setProperty('--to-y', `${to.y}px`)
      if (!node.animate || reducedMotion || !duration) return
      const cardNode = (id?: string) => [...shell.querySelectorAll<HTMLElement>('[data-card-instance-id]')].find(card => card.getAttribute('data-card-instance-id') === id)
      let restoreDestination: (() => void) | undefined
      if (event.kind === 'move' || event.kind === 'faint') {
        const destination = event.target?.zone === 'hand' && event.target.handSlot !== undefined
          ? shell.querySelector<HTMLElement>(`[data-animation-player="${event.target.playerId}"] [data-hand-slot="${event.target.handSlot}"]`)
          : cardNode(event.target?.instanceId)
        if (destination) {
          const visibility = destination.style.visibility
          destination.style.visibility = 'hidden'
          restoreDestination = () => { destination.style.visibility = visibility }
          restore.push(restoreDestination)
        }
      }
      if (event.kind === 'impact') {
        const attacker = cardNode(event.source?.instanceId)
        if (attacker?.animate) running.push(attacker.animate([{translate:'0 0'},{translate:`0 ${to.y < from.y ? -14 : 14}px`},{translate:'0 0'}],{duration,easing:'ease-out'}))
      }
      const movement = event.kind === 'move' || event.kind === 'faint'
      const trajectory = event.kind === 'attack' || event.kind === 'impact' || event.kind === 'rest'
      const transform = (p: Point, scale = 1) => `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(${scale})`
      const frames = movement || trajectory ? [
        { transform: transform(from, 0.85), opacity: 0, offset: 0 },
        { transform: transform({ x: from.x + (to.x - from.x) * 0.2, y: from.y + (to.y - from.y) * 0.2 - 20 }, 1), opacity: 1, offset: 0.25 },
        { transform: transform(to, event.kind === 'faint' ? 0.25 : 0.85), opacity: 0, offset: 1 },
      ] : [
        { transform: transform(to, 0.9), opacity: 0 },
        { transform: transform(to, 1), opacity: 1, offset: 0.3 },
        { transform: transform(to, 1.04), opacity: 0 },
      ]
      const staggered = activeEvents[0]?.kind === 'move'
      const nominalDuration = Math.max(...activeEvents.map(item => item.duration)) + (staggered ? (activeEvents.length - 1) * 60 : 0)
      const factor = duration / nominalDuration
      const delay = staggered ? index * 60 * factor : 0
      const playback = node.animate(frames, { duration: Math.max(1, event.duration * factor), delay, fill: 'both', easing: 'cubic-bezier(.2,.7,.3,1)' })
      if (restoreDestination) playback.addEventListener('finish', restoreDestination, {once:true})
      running.push(playback)
    }) } catch {
      // A browser animation failure must never leave player actions locked.
      running.forEach(item => item.cancel())
      restore.forEach(callback => callback())
      skip()
    }
    shell.querySelectorAll('[data-card-instance-id]').forEach(node => {
      const id = node.getAttribute('data-card-instance-id')
      if (id) positions.current.set(id, point(node))
    })
    for (const event of activeEvents) {
      if (event.card && event.target && (event.kind === 'move' || event.kind === 'faint')) positions.current.set(event.card.instanceId, find(event.target))
    }
    const resize = () => skip()
    window.addEventListener('resize', resize)
    return () => { running.forEach(item => item.cancel()); restore.forEach(callback => callback()); window.removeEventListener('resize', resize) }
  }, [activeEvents, duration, reducedMotion, speed, skip])

  const headline = activeEvents.find(event => ['start', 'finish', 'turn', 'phase', 'refresh', 'activate'].includes(event.kind) && !event.source)
  const spotlights = activeEvents.filter(event => event.kind === 'flip' || event.kind === 'trap' || event.kind === 'reveal' || event.kind === 'opening-reveal')
  return <>
    <div className="match-animation-controls">
      <label>動畫 <select aria-label="動畫速度" value={speed} onChange={event => animation.setSpeed(event.target.value as MatchAnimations['speed'])}>
        <option value="standard">標準</option><option value="fast">快速</option><option value="reduced">減少動畫</option>
      </select></label>
      {animation.isPlaying && <button type="button" onClick={skip}>略過目前演出</button>}
    </div>
    <div ref={layer} className={`match-animation-layer${reducedMotion ? ' is-reduced' : ''}`} aria-hidden="true" data-playing={animation.isPlaying}>
      {!reducedMotion && <svg className="match-animation-links" width="100%" height="100%">
        {activeEvents.map((event,index) => event.source && event.target && ['attack','impact','rest','activate'].includes(event.kind) ? <path key={event.id} data-animation-link={index} className={`kind-${event.kind}`} /> : null)}
      </svg>}
      {activeEvents.map((event, index) => {
        if (event === headline || spotlights.includes(event)) return null
        return <div key={event.id} data-animation-index={index} data-event-kind={event.kind} className={`match-animation-object kind-${event.kind}`}>
          {event.card && (event.kind === 'move' || event.kind === 'faint') ? <CardFace card={event.card} concealed={event.card.id === 'hidden'} /> : <span>{event.kind === 'attack' || event.kind === 'impact' ? '➤' : event.kind === 'rest' ? '✦' : event.label}</span>}
        </div>
      })}
      {headline && <div key={headline.id} data-event-kind={headline.kind} className={`match-animation-banner kind-${headline.kind}`} style={{ '--motion-duration': `${duration}ms` } as CSSProperties}>{headline.label}</div>}
      {spotlights.length > 0 && <div className="match-animation-spotlights">{spotlights.map(spotlight => spotlight.card && <div key={spotlight.id} data-event-kind={spotlight.kind} className="match-animation-spotlight" style={{ '--motion-duration': `${duration}ms` } as CSSProperties}>
        <strong>{spotlight.label}</strong><CardFace card={spotlight.card} concealed={spotlight.card.id === 'hidden'} /><span>{spotlight.card.id === 'hidden' ? '' : spotlight.card.name}</span>
      </div>)}</div>}
    </div>
    <span className="match-animation-announcement" role="status">{activeEvents.map(event => event.label).filter((label, index, all) => all.indexOf(label) === index).join('，')}</span>
  </>
}

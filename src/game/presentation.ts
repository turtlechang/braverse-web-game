import type { GameCard, GameState, PlayerId } from './types'
import { getEffectiveAttack } from './effects/combat'
import { getCookieEffectiveHp } from './helpers'
import { createHiddenCard } from './card-visibility'

/** Presentation receipts describe accepted transitions, never drive the rules. */
export type PresentationZone = 'deck' | 'hand' | 'battle' | 'support' | 'break' | 'discard' | 'stage' | 'hp' | 'extra' | 'equipment'
export interface PresentationAnchor {
  playerId: PlayerId
  zone: PresentationZone
  instanceId?: string
  hostId?: string
  handSlot?: number
}
export interface PresentationEvent {
  id: string
  kind: 'move' | 'rest' | 'ready' | 'attack' | 'reveal' | 'flip' | 'activate' | 'trap' | 'hp' | 'faint' | 'turn' | 'phase' | 'start' | 'finish' | 'refresh' | 'stat' | 'opening-reveal' | 'impact'
  source?: PresentationAnchor
  target?: PresentationAnchor
  card?: GameCard
  /** An empty audience means that even the owner must see a card back. */
  audience?: PlayerId[]
  label: string
  amount?: number
  duration: number
}

interface LocatedCard { card: GameCard; anchor: PresentationAnchor; audience: PlayerId[]; rested?: boolean }
const players: PlayerId[] = ['player-one', 'player-two']

/** Present the already accepted opening hand, including anonymous opponent slots. */
export function describeOpeningDeal(state: GameState, prefix: string): PresentationEvent[] {
  const events: PresentationEvent[] = []
  const count = Math.max(...players.map(id => state.players[id].hand.length))
  for (let index = 0; index < count; index++) for (const playerId of players) {
    const card = state.players[playerId].hand[index]
    if (card) events.push({ id: `${prefix}:${playerId}:${index}`, kind: 'move', source: {playerId,zone:'deck'}, target: {playerId,zone:'hand',instanceId:card.instanceId,handSlot:index}, card, audience:[playerId], label:'發起始手牌', duration:280 })
  }
  return events
}
const zoneLabels: Record<PresentationZone, string> = { deck: '牌庫', hand: '手牌', battle: '戰鬥區', support: '支援區', break: '休息區', discard: '棄牌區', stage: '場景區', hp: 'HP', extra: 'EXTRA', equipment: '裝備' }

function locate(state: GameState): Map<string, LocatedCard> {
  const result = new Map<string, LocatedCard>()
  for (const playerId of players) {
    const player = state.players[playerId]
    const add = (card: GameCard, zone: PresentationZone, audience = players, hostId?: string, rested?: boolean) => {
      result.set(card.instanceId, { card, anchor: { playerId, zone, instanceId: card.instanceId, ...(hostId ? { hostId } : {}) }, audience, rested })
    }
    player.deck.forEach(card => add(card, 'deck', []))
    player.hand.forEach(card => add(card, 'hand', [playerId]))
    player.extraDeck?.forEach(card => add({ id: card.id, instanceId: card.instanceId, name: card.name, type: 'item', imageUrl: card.imageUrl }, 'extra', [playerId]))
    player.supportArea.forEach(entry => add(entry.card, 'support', players, undefined, entry.rested))
    player.breakArea.forEach(card => add(card, 'break'))
    player.discardPile.forEach(card => add(card, 'discard'))
    if (player.stage) add(player.stage.card, 'stage', players, undefined, player.stage.rested)
    player.battleArea.forEach(cookie => {
      add(cookie.card, 'battle', state.status === 'setup' ? [playerId] : players, undefined, cookie.rested)
      cookie.hpCards.forEach(card => add(card, 'hp', cookie.faceUpHpCardInstanceIds?.includes(card.instanceId) ? players : [], cookie.card.instanceId))
      cookie.equippedCards?.forEach(card => add(card, 'equipment', players, cookie.card.instanceId))
    })
  }
  return result
}

/** Uses typed state and command kind, never localized log prose. */
export function describePresentation(previous: GameState, next: GameState, commandKind = '', prefix = 'transition'): PresentationEvent[] {
  const events: PresentationEvent[] = []
  const push = (event: Omit<PresentationEvent, 'id'>) => events.push({ ...event, id: `${prefix}:${events.length}` })
  const before = locate(previous)
  const after = locate(next)
  const battle = next.pendingBattle ?? previous.pendingBattle
  if (!previous.pendingBattle && next.pendingBattle) {
    push({ kind: 'attack', source: before.get(next.pendingBattle.attackerInstanceId)?.anchor, target: before.get(next.pendingBattle.targetInstanceId)?.anchor, label: '攻擊宣告', duration: 350 })
  }
  const damageTarget = previous.pendingBattle?.damageTargetInstanceId ?? previous.pendingBattle?.targetInstanceId
  if (previous.pendingBattle?.stage === 'damage' && !previous.pendingBattle.effectDamageSequence && damageTarget &&
      !previous.pendingBattle.damagedInstanceIds?.includes(damageTarget) && next.pendingBattle?.damagedInstanceIds?.includes(damageTarget)) {
    push({kind:'impact',source:before.get(previous.pendingBattle.attackerInstanceId)?.anchor,target:before.get(damageTarget)?.anchor,label:'攻擊命中',duration:350})
  }
  for (const [id, entry] of after) {
    const old = before.get(id)
    if (!old) continue
    if (entry.rested !== undefined && old.rested !== undefined && entry.rested !== old.rested) {
      push({ kind: entry.rested ? 'rest' : 'ready', source: entry.anchor, target: battle ? after.get(battle.attackerInstanceId)?.anchor : undefined, label: entry.rested ? (entry.anchor.zone === 'support' ? '支援已橫置' : '已橫置') : '設為活躍', duration: 220 })
    }
  }
  if (['activate-skill', 'begin-activate-skill', 'play-trap', 'play-item', 'begin-play-item', 'activate-stage', 'begin-activate-stage'].includes(commandKind)) {
    const source = next.pendingAbilityEffect?.sourceInstanceId ?? previous.pendingAbilityEffect?.sourceInstanceId
    const entry = source ? before.get(source) ?? after.get(source) : undefined
    // Only announce an activation when something actually changed.
    if (previous !== next) push({ kind: commandKind === 'play-trap' ? 'trap' : 'activate', source: entry?.anchor, card: entry?.card, audience: entry?.audience, label: commandKind === 'play-trap' ? '陷阱發動' : '效果處理', duration: 350 })
  }
  const revealed = next.pendingBattle?.revealedHpCard
  if (revealed && revealed.instanceId !== previous.pendingBattle?.revealedHpCard?.instanceId) {
    const targetId = next.pendingBattle?.damageTargetInstanceId ?? next.pendingBattle?.targetInstanceId
    push({ kind: next.pendingBattle?.stage === 'flip' ? 'flip' : 'reveal', card: revealed, audience: players, source: before.get(revealed.instanceId)?.anchor, target: targetId ? after.get(targetId)?.anchor ?? before.get(targetId)?.anchor : undefined, label: next.pendingBattle?.stage === 'flip' ? 'FLIP' : 'HP 揭示', duration: next.pendingBattle?.stage === 'flip' ? 600 : 350 })
  }
  for (const [id, entry] of after) {
    const old = before.get(id)
    if (!old) {
      if (entry.anchor.zone === 'hand' && next.status === 'setup') push({ kind: 'move', source: {playerId:entry.anchor.playerId,zone:'deck'}, target:entry.anchor,card:entry.card,audience:entry.audience,label:'發起始手牌',duration:280 })
      continue
    }
    if ((entry.anchor.zone === old.anchor.zone && entry.anchor.hostId === old.anchor.hostId)) continue
    // Deck shuffling changes order, not location. No animation ever exposes it.
    const publicDestination = entry.audience.length === 2
    push({ kind: 'move', source: old.anchor, target: entry.anchor, card: entry.card, audience: publicDestination ? players : entry.audience, label: `${zoneLabels[old.anchor.zone]} → ${zoneLabels[entry.anchor.zone]}`, duration: 280 })
  }
  for (const playerId of players) {
    for (const cookie of next.players[playerId].battleArea) {
      const old = previous.players[playerId].battleArea.find(entry => entry.card.instanceId === cookie.card.instanceId)
      if (!old) continue
      const attackChange = getEffectiveAttack(next, cookie.card.instanceId) - getEffectiveAttack(previous, cookie.card.instanceId)
      if (attackChange) push({kind:'stat',target:after.get(cookie.card.instanceId)?.anchor,label:`ATK ${attackChange > 0 ? '+' : ''}${attackChange}`,amount:attackChange,duration:220})
      const amount = getCookieEffectiveHp(cookie) - getCookieEffectiveHp(old)
      if (amount) push({ kind: 'hp', target: after.get(cookie.card.instanceId)?.anchor, label: `HP ${amount > 0 ? '+' : ''}${amount}`, amount, duration: 220 })
    }
  }
  if (!previous.pendingRefresh && next.pendingRefresh) push({ kind: 'refresh', label: 'Refresh', duration: 450 })
  if (previous.status === 'setup' && next.status === 'playing') {
    for (const playerId of players) for (const cookie of next.players[playerId].battleArea) push({kind:'opening-reveal',card:cookie.card,audience:players,target:after.get(cookie.card.instanceId)?.anchor,label:'起始餅乾揭示',duration:350})
    push({ kind: 'start', label: '對戰開始', duration: 700 })
  }
  else if (previous.turnNumber !== next.turnNumber) push({ kind: 'turn', label: `${next.players[next.activePlayerId].name}的回合`, duration: 450 })
  // Ordinary phase changes are already visible in PhaseRail; do not interrupt them.
  if (!previous.result && next.result) push({ kind: 'finish', label: `${next.players[next.result.winnerId].name}獲勝`, duration: 1000 })
  return events
}

/** Strip private identity as well as artwork before serialization or DOM use. */
export function maskPresentation(events: readonly PresentationEvent[], viewerId: PlayerId): PresentationEvent[] {
  return events.map(event => {
    const visible = !event.audience || event.audience.includes(viewerId)
    const anchor = (value: PresentationAnchor | undefined) => {
      if (!value) return undefined
      const privateZone = !visible || value.zone === 'deck' || value.zone === 'hp' || ((value.zone === 'hand' || value.zone === 'extra') && value.playerId !== viewerId)
      return privateZone ? { playerId: value.playerId, zone: value.zone, ...(value.zone === 'hand' && value.handSlot !== undefined ? {handSlot:value.handSlot} : {}), ...(value.hostId && visible ? { hostId: value.hostId } : {}) } : value
    }
    return { ...event, source: anchor(event.source), target: anchor(event.target), ...(event.card && !visible ? { card: createHiddenCard('presentation', 0) } : {}), audience: visible ? [viewerId] : [] }
  })
}

/** Capture intermediate effects only inside a command; simulation helpers stay unchanged. */
export function recordPresentationStep(previous: GameState, next: GameState): GameState {
  if (!previous.presentationSteps || previous === next) return next
  // Nested effect calls already recorded their finer-grained transitions.
  if ((next.presentationSteps?.length ?? 0) > previous.presentationSteps.length) return next
  return { ...next, presentationSteps: [...previous.presentationSteps, ...describePresentation(previous, next)] }
}

export function mergePresentationSteps(previous: GameState, next: GameState, kind: string, prefix: string, sourceCard?: GameCard): PresentationEvent[] {
  const steps = next.presentationSteps ?? []
  const net = describePresentation(previous, next, kind)
  const duplicate = (event: PresentationEvent) => steps.some(step =>
    (step.kind === event.kind || (event.kind === 'move' && step.kind === 'faint')) && (step.card?.instanceId ?? step.target?.instanceId ?? step.label) === (event.card?.instanceId ?? event.target?.instanceId ?? event.label))
  if (sourceCard) {
    const source = locate(previous).get(sourceCard.instanceId) ?? locate(next).get(sourceCard.instanceId)
    for (const event of net) if (event.kind === 'activate' || event.kind === 'trap') {
      event.card = sourceCard
      event.audience = players
      event.source = source?.anchor
      event.target = steps.find(step => step.target && step.target.instanceId !== sourceCard.instanceId)?.target
    }
    for (const event of net) if (event.kind === 'rest' && event.source?.zone === 'support') event.target = source?.anchor ?? event.target
  }
  const leading = net.filter(event => ['rest', 'ready', 'attack', 'activate', 'trap'].includes(event.kind) && !duplicate(event))
  const trailing = net.filter(event => !leading.includes(event) && !duplicate(event))
  return [...leading, ...steps, ...trailing].map((event, index) => ({...event, id:`${prefix}:${index}`}))
}

/** Only actual knockout sites may issue this receipt. Zone changes cannot infer it. */
export function recordFaintPresentation(state: GameState, playerId: PlayerId, card: GameCard): GameState {
  if (!state.presentationSteps) return state
  return {...state,presentationSteps:[...state.presentationSteps,{id:'faint',kind:'faint',source:{playerId,zone:'battle',instanceId:card.instanceId},target:{playerId,zone:'break',instanceId:card.instanceId},card,audience:players,label:'餅乾昏厥',duration:350}]}
}

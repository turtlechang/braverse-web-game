import { describe, expect, it } from 'vitest'
import { createBs12CreamPuffDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill, getCookieSkillUnavailableReason } from './skills'
import { executeCardEffect } from './effects/execute'
import { takeAiStep } from './ai'

type State = ReturnType<typeof createBs12CreamPuffDemoState>
const sourceId = 'bs12-064-source'
const open = (state: State) => applyGameCommand(state, { kind: 'begin-activate-skill', playerId: 'player-one',
  sourceInstanceId: sourceId, trigger: 'on-play', paymentIds: [], targetIds: [] })
const confirm = (state: State) => applyGameCommand(state, { kind: 'resolve-reveal-top-deck', playerId: 'player-one' })
const draw = (state: State, drawCount: number) => applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount })
const attack = (state: State) => applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: sourceId,
  targetInstanceId: 'bs12-064-opponent', supportPaymentIds: state.players['player-one'].supportArea.map(s => s.card.instanceId) })

describe('BS12-064 same bottom-card intersection and independent optional draw', () => {
  it.each(['positive', 'green-arena', 'red-arena', 'yellow-arena'] as const)('reveals actual bottom, then adds that same LV2 Arena Cookie and draws: %s', scenario => {
    const before = createBs12CreamPuffDemoState(scenario)
    const snapshot = structuredClone(before)
    const bottom = before.players['player-one'].deck.at(-1)!
    expect(bottom.type).toBe('cookie')
    if (bottom.type !== 'cookie') throw new Error('Invalid positive bottom')
    expect(bottom.level).toBe(2)
    expect(bottom.keywords).toContain('arena')
    const opened = open(before)
    expect(opened.pendingRevealTopDeck).toMatchObject({ deckPosition: 'bottom', revealedCard: bottom, matched: true, addMatchedToHand: true })
    expect(opened.players).toEqual(before.players)
    const awaiting = confirm(opened)
    expect(awaiting.players['player-one'].hand).toEqual([bottom])
    expect(awaiting.players['player-one'].deck).toEqual(before.players['player-one'].deck.slice(0, -1))
    expect(awaiting.pendingDrawUpTo).toMatchObject({ max: 2, sourceInstanceId: sourceId })
    const after = draw(awaiting, 2)
    expect(after.players['player-one'].hand).toEqual([bottom, ...before.players['player-one'].deck.slice(0, 2)])
    expect(after.players['player-one'].deck).toEqual(before.players['player-one'].deck.slice(2, -1))
    expect(after.players['player-one'].battleArea[0].hpCards).toHaveLength(5)
    expect(after.players['player-one'].supportArea.every(s => !s.rested)).toBe(true)
    expect(after.players['player-one'].discardPile).toEqual(before.players['player-one'].discardPile)
    expect(after.skillUsesThisTurn).toEqual(before.skillUsesThisTurn)
    expect(before).toEqual(snapshot)
  })
  it.each(['non-arena', 'level-one', 'level-three', 'arena-item', 'top-only'] as const)('leaves unmatched bottom and entire deck unchanged; no draw: %s', scenario => {
    const before = createBs12CreamPuffDemoState(scenario)
    const opened = open(before)
    expect(opened.pendingRevealTopDeck?.matched).toBe(false)
    const after = confirm(opened)
    expect(after.players).toEqual(before.players)
    expect(after.pendingRevealTopDeck).toBeNull()
    expect(after.pendingDrawUpTo ?? null).toBeNull()
    expect(after.commandLog?.at(-1)?.steps?.some(step => step.text.includes('底牌維持原位，後段效果未執行'))).toBe(true)
  })
  it.each([0, 1, 2])('adds the matched bottom even when drawing %s', count => {
    const before = createBs12CreamPuffDemoState()
    const after = draw(confirm(open(before)), count)
    expect(after.players['player-one'].hand).toHaveLength(1 + count)
    expect(after.players['player-one'].hand[0]).toEqual(before.players['player-one'].deck.at(-1))
  })
  it('skips On Play without revealing or moving a card', () => {
    const before = createBs12CreamPuffDemoState()
    const after = applyGameCommand(before, { kind: 'skip-on-play', playerId: 'player-one', sourceInstanceId: sourceId })
    expect(after.players).toEqual(before.players)
    expect(after.pendingOnPlay).toBeNull()
  })
  it('refuses an empty-deck exact reveal before spending or moving anything', () => {
    const before = { ...createBs12CreamPuffDemoState(), players: { ...createBs12CreamPuffDemoState().players,
      'player-one': { ...createBs12CreamPuffDemoState().players['player-one'], deck: [] } } }
    expect(canActivateCookieSkill(before, 'player-one', sourceId, 'on-play')).toBe(false)
    expect(getCookieSkillUnavailableReason(before, 'player-one', sourceId, 'on-play')).toMatch(/沒有卡牌.*牌庫底/)
    expect(() => open(before)).toThrow()
    expect(() => executeCardEffect(before, { sourcePlayerId: 'player-one', sourceInstanceId: sourceId },
      before.players['player-one'].battleArea[0].card.skill!.effects[0], [])).toThrow()
  })
  it('allows On Play after real effect entry during the opponent turn', () => {
    const before = { ...createBs12CreamPuffDemoState('deploy'), activePlayerId: 'player-two' as const }
    const entered = executeCardEffect(before, { sourcePlayerId: 'player-one', sourceInstanceId: 'enabler' }, { kind: 'hand-to-battle', amount: 1 }, [sourceId])
    expect(canActivateCookieSkill(entered, 'player-one', sourceId, 'on-play')).toBe(true)
    expect(confirm(open(entered)).pendingDrawUpTo?.max).toBe(2)
  })
  it('rejects the wrong resolving player and stale changed bottom before adding anything', () => {
    const opened = open(createBs12CreamPuffDemoState())
    expect(() => applyGameCommand(opened, { kind: 'resolve-reveal-top-deck', playerId: 'player-two' })).toThrow()
    const changed = { ...opened, players: { ...opened.players, 'player-one': { ...opened.players['player-one'], deck: opened.players['player-one'].deck.slice().reverse() } } }
    expect(() => confirm(changed)).toThrow()
  })
  it.each([0, 1, 2])('last matching card returns to hand, then Refresh supplies %s optional draws', count => {
    const before = createBs12CreamPuffDemoState('short-deck')
    const awaiting = draw(confirm(open(before)), count)
    expect(awaiting.players['player-one'].hand).toEqual(before.players['player-one'].deck)
    expect(awaiting.pendingRefresh).toMatchObject({ playerId: 'player-one', remainingDraws: count })
    const after = applyGameCommand(awaiting, { kind: 'refresh-deck', playerId: 'player-one', cookieInstanceId: 'bs12-064-refresh-cookie', shuffleSeed: 1 })
    expect(after.pendingRefresh).toBeNull()
    expect(after.players['player-one'].hand).toHaveLength(1 + count)
    expect(after.players['player-one'].breakArea.map(c => c.instanceId)).toEqual(['bs12-064-refresh-cookie'])
  })
  it('AI consumes the public reveal decision then optional draw', () => {
    let state = open(createBs12CreamPuffDemoState())
    for (let i = 0; (state.pendingRevealTopDeck || state.pendingDrawUpTo || state.pendingAbilityEffect) && i < 12; i++) state = takeAiStep(state, 'player-one', { level: 2 }).state
    expect(state.pendingRevealTopDeck).toBeNull()
    expect(state.pendingDrawUpTo).toBeNull()
    expect(state.players['player-one'].hand).toHaveLength(3)
  })
  it('round-trips accepted commands and records source and actual revealed card', () => {
    const opened = open(createBs12CreamPuffDemoState())
    const after = confirm(JSON.parse(JSON.stringify(opened)))
    expect(after).toEqual(confirm(opened))
    expect(after.commandLog?.at(-1)?.card?.id).toBe('BS12-064')
    expect(after.commandLog?.at(-1)?.steps?.[0].cards?.[0].instanceId).toBe('bs12-064-bottom')
    expect(parseTestStateConfig('?test-state=bs12-064:positive', 'localhost')).toEqual({ kind: 'bs12-064', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-064:positive', 'example.com')).toBeNull()
  })
})
describe('BS12-064 ordinary BBN attack and fixture capacity', () => {
  it('deploys actual five HP and pays BBN for ordinary three', () => {
    const before = createBs12CreamPuffDemoState('deploy')
    const entered = applyGameCommand(before, { kind: 'deploy-cookie', playerId: 'player-one', instanceId: sourceId })
    expect(entered.players['player-one'].battleArea[0].hpCards).toEqual(before.players['player-one'].deck.slice(0, 5))
    let state = applyGameCommand(entered, { kind: 'skip-on-play', playerId: 'player-one', sourceInstanceId: sourceId })
    state = applyGameCommand(attack(state), { kind: 'skip-trap', playerId: 'player-two' })
    for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 12; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
    expect(state.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([3, 4])
    expect(state.players['player-one'].supportArea.every(s => s.rested)).toBe(true)
    expect(state.pendingBattle).toBeNull()
  })
  it.each(['wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn'] as const)('rejects illegal attack: %s', scenario => {
    expect(() => attack(createBs12CreamPuffDemoState(scenario))).toThrow()
  })
  it.each(['positive', 'green-arena', 'red-arena', 'yellow-arena', 'non-arena', 'level-one', 'level-three', 'arena-item', 'top-only', 'short-deck', 'deploy', 'attack', 'wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn'] as const)('has legal field and copy capacity: %s', scenario => {
    for (const player of Object.values(createBs12CreamPuffDemoState(scenario).players)) {
      expect(player.battleArea.length).toBeLessThanOrEqual(2)
      expect(player.breakArea.reduce((sum, c) => sum + c.level, 0)).toBeLessThan(10)
      const cards = [...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile, ...player.supportArea.map(s => s.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards])]
      const counts = cards.reduce<Record<string, number>>((result, c) => ({ ...result, [c.id]: (result[c.id] ?? 0) + 1 }), {})
      expect(Math.max(0, ...Object.values(counts))).toBeLessThanOrEqual(4)
    }
  })
})

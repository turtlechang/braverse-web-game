import { expect, it, vi } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { createBs12GuitarStringDemoState, createBs12RainbowHeadphonesDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canPlayItem } from './card-abilities'
import { isEffectConditionMet } from './effects'
import { describeCommandSteps } from './command-log'
import { createPlayerView } from './player-view'
import { assessPublicCondition } from './ai/strategy/public-condition'
import type { GameCard, GameState } from './types'

const actor = 'player-one' as const
const enemy = 'player-two' as const
const card = (number: string, instanceId: string): GameCard => {
  const result = convertOfficialCardToGameCard(candidate.cards.find(source => source.cardNumber === number) as OfficialCardRecord, instanceId)
  if (result.status !== 'converted') throw new Error(`Missing ${number}`)
  return { ...result.gameCard, instanceId }
}
const setup = (blockerCount = 5): GameState => {
  const base = createBs12GuitarStringDemoState('two-blockers')
  const red = base.players[actor].discardPile[1]
  if (red.type !== 'cookie') throw new Error('Expected genuine red Blocker Cookie')
  const purpleCount = Math.max(0, blockerCount - 2)
  const blockers = Array.from({ length: blockerCount }, (_, index) => index < purpleCount
    ? card('BS12-081', `trash-blocker-${index}`) : { ...red, instanceId: `trash-blocker-${index}` })
  return { ...base, players: { ...base.players,
    [actor]: { ...base.players[actor],
      hand: [card('BS12-085', 'rainbow'), { ...red, instanceId: 'hand-blocker' }, card('BS12-075', 'hand-non-blocker')],
      discardPile: [...blockers, card('BS12-075', 'trash-non-blocker'), card('BS12-012', 'trash-item'), card('BS12-030', 'trash-stage'), card('BS12-086', 'trash-trap')],
      supportArea: [{ card: card('BS12-079', 'payment'), rested: false }],
      breakArea: [{ ...red, instanceId: 'break-blocker' }],
    },
  } }
}
const command = { kind: 'begin-play-item' as const, playerId: actor, instanceId: 'rainbow', paymentIds: ['payment'], targetIds: [] }
const effect = () => {
  const result = card('BS12-085', 'rainbow').item!.effects[0]
  if (result.kind !== 'trash-to-deck-all') throw new Error('Expected 085 all-trash shuffle')
  return result
}
const context = { sourcePlayerId: actor, sourceInstanceId: 'rainbow' }

it.each([0, 4, 5, 6])('085 counts only current own trash Blocker Cookies at %i', count => {
  const before = setup(count)
  expect(isEffectConditionMet(before, context, effect())).toBe(count >= 5)
  expect(assessPublicCondition(createPlayerView(before, actor), effect().condition!).state).toBe(count >= 5 ? 'met' : 'unmet')
})

it('085 does not count Blockers in hand, support, battle, Break or opponent trash', () => {
  const before = setup(4)
  const ally = before.players[actor].battleArea[0]
  before.players[actor].battleArea = [{ ...ally, card: card('BS12-081', 'battle-blocker') as typeof ally.card }]
  before.players[actor].supportArea = [{ card: card('BS12-081', 'payment'), rested: false }]
  expect(isEffectConditionMet(before, context, effect())).toBe(false)
  expect(assessPublicCondition(createPlayerView(before, actor), effect().condition!).state).toBe('unmet')
})

it('085 excludes non-Blocker Cookies and even a non-Cookie carrying Blocker metadata', () => {
  const before = setup(4)
  before.players[actor].discardPile.push({ ...card('BS12-012', 'synthetic-metadata-control'), skill: before.players[actor].discardPile[0].skill })
  expect(isEffectConditionMet(before, context, effect())).toBe(false)
  expect(assessPublicCondition(createPlayerView(before, actor), effect().condition!).state).toBe('unmet')
})

it('085 includes genuine red non-Arena Blockers whose costs cannot be paid', () => {
  const before = setup()
  expect(before.players[actor].discardPile[3]).toMatchObject({ id: 'BS1-009', energyColor: 'red' })
  expect(before.players[actor].discardPile[3].keywords ?? []).not.toContain('arena')
  expect(isEffectConditionMet(before, context, effect())).toBe(true)
})

it.each([4, 5, 6])('085 pays P then returns all trash including its source only when the threshold is met: %i', count => {
  const before = setup(count)
  const snapshot = structuredClone(before)
  const shuffle = vi.fn((cards: GameCard[]) => [...cards].reverse())
  expect(canPlayItem(before, actor, 'rainbow')).toBe(true)
  const result = applyGameCommand(before, command, { shuffle })
  const expectedReturned = [...before.players[actor].discardPile, before.players[actor].hand[0]]
  expect(result.players[actor].hand.map(card => card.instanceId)).toEqual(['hand-blocker', 'hand-non-blocker'])
  expect(result.players[actor].supportArea[0].rested).toBe(true)
  expect(result.itemsActivatedThisTurn?.[actor]).toBe(1)
  expect(result.pendingAbilityEffect).toBeFalsy()
  expect(result.pendingRefresh).toBeFalsy()
  expect(result.players[actor].battleArea).toEqual(before.players[actor].battleArea)
  expect(result.players[actor].breakArea).toEqual(before.players[actor].breakArea)
  expect(result.players[enemy]).toEqual(before.players[enemy])
  const steps = describeCommandSteps(before, result, command)?.map(step => step.text) ?? []
  if (count >= 5) {
    expect(shuffle).toHaveBeenCalledExactlyOnceWith([...before.players[actor].deck, ...expectedReturned])
    expect(result.players[actor].deck).toEqual([...before.players[actor].deck, ...expectedReturned].reverse())
    expect(result.players[actor].discardPile).toEqual([])
    expect(steps.some(text => /全部.*洗回牌庫.*洗牌/.test(text))).toBe(true)
    expect(steps.some(text => /條件不成立/.test(text))).toBe(false)
  } else {
    expect(shuffle).not.toHaveBeenCalled()
    expect(result.players[actor].deck).toEqual(before.players[actor].deck)
    expect(result.players[actor].discardPile).toEqual(expectedReturned)
    expect(steps.some(text => /道具效果結果：條件不成立/.test(text))).toBe(true)
  }
  expect(before).toEqual(snapshot)
})

it('085 supports a paid pending effect and seeded public command replay', () => {
  const before = setup()
  const paid = applyGameCommand(before, { ...command, targetIds: undefined })
  expect(paid.pendingAbilityEffect?.sourceCardName).toBe('Rainbow Headphones')
  expect(paid.players[actor].discardPile.at(-1)?.instanceId).toBe('rainbow')
  expect(paid.players[actor].deck).toEqual(before.players[actor].deck)
  const resolve = { kind: 'resolve-ability-effect' as const, playerId: actor, targetIds: [] }
  const result = applyGameCommand(paid, resolve, { shuffleSeed: 8501 })
  expect(result.players[actor].discardPile).toEqual([])
  expect(result.players[actor].deck).toHaveLength(before.players[actor].deck.length + before.players[actor].discardPile.length + 1)
  expect(applyGameCommand(paid, JSON.parse(JSON.stringify(resolve)), { shuffleSeed: 8501 })).toEqual(result)
})

it('085 returns all trash without Refresh even with one original deck card', () => {
  const before = setup()
  before.players[actor].deck = before.players[actor].deck.slice(0, 1)
  const result = applyGameCommand(before, command, { shuffle: cards => cards })
  expect(result.players[actor].deck).toHaveLength(11)
  expect(result.pendingRefresh).toBeFalsy()
  expect(result.players[actor].breakArea).toEqual(before.players[actor].breakArea)
})

it.each(['wrong-energy', 'rested-energy', 'no-energy', 'opponent-turn', 'outside-main'] as const)('085 rejects illegal activation atomically: %s', scenario => {
  const before = setup()
  if (scenario === 'wrong-energy') before.players[actor].supportArea[0].card = card('BS12-004', 'payment')
  if (scenario === 'rested-energy') before.players[actor].supportArea[0].rested = true
  if (scenario === 'no-energy') before.players[actor].supportArea = []
  if (scenario === 'opponent-turn') before.activePlayerId = enemy
  if (scenario === 'outside-main') before.phase = 'active'
  const snapshot = structuredClone(before)
  expect(canPlayItem(before, actor, 'rainbow')).toBe(false)
  expect(() => applyGameCommand(before, command)).toThrow()
  expect(before).toEqual(snapshot)
})

it.each([[], ['payment', 'payment'], ['hand-blocker'], ['unknown']].map(paymentIds => ({ paymentIds })))('085 rejects illegal support ids: $paymentIds', ({ paymentIds }) => {
  const before = setup()
  const snapshot = structuredClone(before)
  expect(() => applyGameCommand(before, { ...command, paymentIds })).toThrow()
  expect(before).toEqual(snapshot)
})

it.each(['hand-blocker', 'hand-non-blocker'])('085 checks the actual trash after DJ additional discard: %s', costId => {
  const before = setup(4)
  const opponent = before.players[enemy].battleArea[0]
  before.players[enemy].battleArea = [{ ...opponent, card: card('BS12-082', 'dj') as typeof opponent.card }]
  const snapshot = structuredClone(before)
  const pending = applyGameCommand(before, command, { shuffleSeed: 8502 })
  expect(pending.pendingOpponentHandDiscard?.itemActivation).toBeTruthy()
  expect(pending.players).toEqual(before.players)
  const result = applyGameCommand(pending, { kind: 'resolve-opponent-hand-discard', playerId: actor, cardIds: [costId] })
  expect(result.pendingOpponentHandDiscard).toBeFalsy()
  expect(result.players[actor].supportArea[0].rested).toBe(true)
  if (costId === 'hand-blocker') {
    expect(result.players[actor].discardPile).toEqual([])
    expect(result.players[actor].deck).toHaveLength(before.players[actor].deck.length + before.players[actor].discardPile.length + 2)
    expect(result.players[actor].deck.some(card => card.instanceId === costId)).toBe(true)
    expect(result.players[actor].deck.some(card => card.instanceId === 'rainbow')).toBe(true)
  } else {
    expect(result.players[actor].deck).toEqual(before.players[actor].deck)
    expect(result.players[actor].discardPile.slice(-2).map(card => card.instanceId)).toEqual([costId, 'rainbow'])
  }
  expect(result.players[enemy]).toEqual(before.players[enemy])
  expect(before).toEqual(snapshot)
})

it('085 cancels a DJ declaration before any original or additional payment', () => {
  const before = setup(4)
  const opponent = before.players[enemy].battleArea[0]
  before.players[enemy].battleArea = [{ ...opponent, card: card('BS12-082', 'dj') as typeof opponent.card }]
  const pending = applyGameCommand(before, command)
  const result = applyGameCommand(pending, { kind: 'cancel-item-activation', playerId: actor })
  expect(result.players).toEqual(before.players)
  expect(result.pendingOpponentHandDiscard).toBeFalsy()
})

it('085 dedicated Browser route stays confined to localhost', () => {
  expect(parseTestStateConfig('?test-state=bs12-085:positive', 'localhost')).toEqual({ kind: 'bs12-085', scenario: 'positive' })
  expect(parseTestStateConfig('?test-state=bs12-085:positive', 'example.com')).toBeNull()
})

it.each(['positive', 'four', 'six', 'zero', 'wrong-zones', 'wrong-energy', 'rested-energy', 'no-energy', 'opponent-turn', 'outside-main', 'short-deck', 'spare-energy', 'dj-four', 'dj-five', 'dj-no-hand'] as const)('085 fixture has unique physical identities and legal visible official copies: %s', scenario => {
  const state = createBs12RainbowHeadphonesDemoState(scenario)
  const identities: string[] = []
  for (const player of Object.values(state.players)) {
    expect(player.battleArea.length).toBeLessThanOrEqual(2)
    const cards = [...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea, ...player.supportArea.map(support => support.card), ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards])]
    identities.push(...cards.map(card => card.instanceId))
    const counts = new Map<string, number>()
    for (const card of cards.filter(card => card.id.startsWith('BS12-') || card.id.startsWith('BS1-'))) counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
    expect([...counts.values()].every(count => count <= 4)).toBe(true)
  }
  expect(new Set(identities).size).toBe(identities.length)
})

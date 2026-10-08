import { expect, it } from 'vitest'
import { getCardPoolEntry } from './card-pool'
import { canPlayExtraDeckCookie } from './actions'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'

it.each(['BS12-092', 'BS12-092@1'] as const)('%s generic preview keeps EXTRA in its deck until the mandatory battle cost is paid', number => {
  expect(parseTestStateConfig(`?test-state=card:${number}`, 'localhost')).toEqual({ kind: 'bs12-092', cardNumber: number, scenario: 'extra' })
  expect(parseTestStateConfig(`?test-state=card:${number}`, 'example.com')).toBeNull()
  expect(getCardPoolEntry(number)).toMatchObject({ cardNumber: number })
  const state = createCardCheckDemoState(number)
  const player = state.players['player-one']
  expect(player.extraDeck).toHaveLength(1)
  const source = player.extraDeck![0]!
  expect(source.id).toBe('BS12-092')
  expect(source.type).toBe('extra')
  expect(source.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\/data\/en_storage\//)
  expect(player.hand.some(card => card.id === 'BS12-092')).toBe(false)
  expect(player.battleArea.some(entry => entry.card.id === 'BS12-092')).toBe(false)
  expect(player.battleArea.map(entry => [entry.card.id, entry.card.hp, entry.hpCards.length])).toEqual([['BS12-075', 3, 3]])
  expect(canPlayExtraDeckCookie(state, 'player-one', source.instanceId)).toBe(true)
  const pending = applyGameCommand(state, { kind: 'play-extra-deck-cookie', playerId: 'player-one', instanceId: source.instanceId })
  expect(pending.players).toEqual(state.players)
  const after = applyGameCommand(pending, { kind: 'resolve-optional-cost-attack', playerId: 'player-one', action: 'pay', targetIds: ['bs12-092-cost'], paymentIds: [], discardCardIds: [] })
  expect(after.players['player-one'].extraDeck).toHaveLength(0)
  expect(after.players['player-one'].battleArea.map(entry => [entry.card.id, entry.hpCards.length])).toEqual([['BS12-092', 5]])
  expect(after.players['player-one'].discardPile.map(card => card.instanceId)).toEqual(['bs12-092-cost', 'bs12-092-cost-hp-0', 'bs12-092-cost-hp-1', 'bs12-092-cost-hp-2'])
  expect(after.players['player-one'].breakArea).toEqual(player.breakArea)
  expect(getCardPoolEntry(number)).toMatchObject({ cardNumber: number })
})

it.each(['BS12-092', 'BS12-092@1'] as const)('%s generic negative preview blocks entry with only two Arena Blockers in Break', number => {
  expect(parseTestStateConfig(`?test-state=card-negative:${number}`, 'localhost')).toEqual({ kind: 'bs12-092', cardNumber: number, scenario: 'break-two' })
  expect(parseTestStateConfig(`?test-state=card-negative:${number}`, 'example.com')).toBeNull()
  const state = createCardNegativeDemoState(number)
  const player = state.players['player-one']
  expect(player.extraDeck).toHaveLength(1)
  expect(player.breakArea).toHaveLength(2)
  expect(player.battleArea.some(entry => entry.card.id === 'BS12-092')).toBe(false)
  expect(canPlayExtraDeckCookie(state, 'player-one', player.extraDeck![0]!.instanceId)).toBe(false)
  expect(() => applyGameCommand(state, { kind: 'play-extra-deck-cookie', playerId: 'player-one', instanceId: player.extraDeck![0]!.instanceId })).toThrow()
  expect(getCardPoolEntry(number)).toMatchObject({ cardNumber: number })
})

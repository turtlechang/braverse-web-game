import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { createBs12DjDemoState, createBs12GuitarStringDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canPlayItem } from './card-abilities'
import { getEffectSelectionCandidates } from './effects'
import type { CookieCard, GameCard, GameState } from './types'

const card = (number: string, instanceId: string): GameCard => {
  const result = convertOfficialCardToGameCard(candidate.cards.find(record => record.cardNumber === number) as OfficialCardRecord, instanceId)
  if (result.status !== 'converted') throw new Error(`Missing ${number}`)
  return { ...result.gameCard, instanceId }
}
const setup = (): GameState => {
  const base = createBs12DjDemoState('own-source')
  const blocker = card('BS12-081', 'trash-blocker') as CookieCard
  return { ...base, players: { ...base.players, 'player-one': {
    ...base.players['player-one'], hand: [card('BS12-083', 'item'), { ...blocker, energyColor: 'red', keywords: [], instanceId: 'hand-blocker' }],
    discardPile: [blocker, card('BS12-075', 'non-blocker'), card('BS12-012', 'non-cookie')],
    supportArea: [{ card: { ...blocker, instanceId: 'payment' }, rested: false }],
  }, 'player-two': { ...base.players['player-two'], discardPile: [{ ...blocker, instanceId: 'opponent-blocker' }] } } }
}
const begin = { kind: 'begin-play-item' as const, playerId: 'player-one' as const, instanceId: 'item', paymentIds: ['payment'] }
const play = (state: GameState, ids: string[]) => applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: ids })

it('083 shows only own trash printed Blockers even when their Blocker cost is currently unpayable', () => {
  const before = setup()
  const snapshot = structuredClone(before)
  expect(canPlayItem(before, 'player-one', 'item')).toBe(true)
  const paid = applyGameCommand(before, begin)
  expect(paid.players['player-one'].supportArea[0].rested).toBe(true)
  expect(paid.players['player-one'].hand.map(card => card.instanceId)).toEqual(['hand-blocker'])
  const effect = paid.pendingAbilityEffect!.effects[0]
  expect(getEffectSelectionCandidates(paid, { sourcePlayerId: 'player-one', sourceInstanceId: 'item' }, effect).map(card => card.instanceId)).toEqual(['trash-blocker'])
  const result = play(paid, ['trash-blocker'])
  const revived = result.players['player-one'].battleArea[1]
  expect(revived.card.instanceId).toBe('trash-blocker')
  expect(revived.hpCards).toHaveLength(2)
  expect(revived.rested).toBe(false)
  expect(revived.enteredFrom).toBe('trash')
  expect(result.players['player-one'].deck).toHaveLength(10)
  expect(result.players['player-one'].discardPile.map(card => card.instanceId)).toEqual(['non-blocker', 'non-cookie', 'item'])
  expect(result.players['player-two']).toEqual(before.players['player-two'])
  expect(before).toEqual(snapshot)
})

it('083 permits a non-Arena Blocker of another color and any level', () => {
  const before = setup()
  const blocker = before.players['player-one'].discardPile[0] as CookieCard
  before.players['player-one'].discardPile[0] = { ...blocker, energyColor: 'red', level: 5, hp: 4, keywords: [] }
  const result = play(applyGameCommand(before, begin), ['trash-blocker'])
  expect(result.players['player-one'].battleArea[1].hpCards).toHaveLength(4)
  expect(result.players['player-one'].deck).toHaveLength(8)
})

it.each([[], ['non-blocker'], ['non-cookie'], ['opponent-blocker'], ['hand-blocker'], ['payment'], ['unknown'], ['trash-blocker', 'non-blocker']].map(ids => ({ ids })))('083 validates optional zero and each illegal selector: $ids', ({ ids }) => {
  const before = setup()
  const paid = applyGameCommand(before, begin)
  if (ids.length) expect(() => play(paid, ids)).toThrow()
  else {
    const result = play(paid, ids)
    expect(result.players['player-one'].battleArea).toEqual(before.players['player-one'].battleArea)
    expect(result.players['player-one'].deck).toHaveLength(12)
    expect(result.players['player-one'].discardPile.at(-1)?.instanceId).toBe('item')
    expect(result.players['player-one'].supportArea[0].rested).toBe(true)
  }
})

it.each(['red', 'rested', 'missing'] as const)('083 blocks illegal P payment: %s', scenario => {
  const before = setup()
  if (scenario === 'red') before.players['player-one'].supportArea[0].card = { ...before.players['player-one'].supportArea[0].card, energyColor: 'red' }
  if (scenario === 'rested') before.players['player-one'].supportArea[0].rested = true
  if (scenario === 'missing') before.players['player-one'].supportArea = []
  const snapshot = structuredClone(before)
  expect(canPlayItem(before, 'player-one', 'item')).toBe(false)
  expect(() => applyGameCommand(before, begin)).toThrow()
  expect(before).toEqual(snapshot)
})

it('083 cannot create a third battle Cookie but still permits the printed optional zero', () => {
  const before = setup()
  before.players['player-one'].battleArea.push({ ...before.players['player-one'].battleArea[0], card: card('BS12-075', 'second') as CookieCard, battleEntryId: 'second-entry' })
  expect(canPlayItem(before, 'player-one', 'item')).toBe(true)
  const paid = applyGameCommand(before, begin)
  expect(() => play(paid, ['trash-blocker'])).toThrow()
  expect(play(paid, []).players['player-one'].battleArea).toHaveLength(2)
})

it('083 rejects two distinct eligible Blockers rather than only rejecting a non-Blocker', () => {
  const before = setup()
  before.players['player-one'].discardPile.push({ ...before.players['player-one'].discardPile[0], instanceId: 'another-blocker' })
  const paid = applyGameCommand(before, begin)
  expect(() => play(paid, ['trash-blocker', 'another-blocker'])).toThrow()
})

it('083 rejects duplicate selection of the same trash Cookie', () => {
  const paid = applyGameCommand(setup(), begin)
  expect(() => play(paid, ['trash-blocker', 'trash-blocker'])).toThrow()
})

const fixtureBegin = { ...begin, instanceId: 'bs12-083-item', paymentIds: ['bs12-083-payment'] }
it('083 public DJ continuation revives the card paid as extra cost and replays identically', () => {
  const initial = createBs12GuitarStringDemoState('dj-new-target')
  const commands = [fixtureBegin,
    { kind: 'resolve-opponent-hand-discard' as const, playerId: 'player-one' as const, cardIds: ['bs12-083-hand-blocker'] },
    { kind: 'resolve-ability-effect' as const, playerId: 'player-one' as const, targetIds: ['bs12-083-hand-blocker'] }]
  const declared = applyGameCommand(initial, commands[0])
  expect(declared.players).toEqual(initial.players)
  const paid = applyGameCommand(declared, commands[1])
  expect(getEffectSelectionCandidates(paid, { sourcePlayerId: 'player-one', sourceInstanceId: 'bs12-083-item' }, paid.pendingAbilityEffect!.effects[0]).map(card => card.instanceId)).toEqual(['bs12-083-hand-blocker'])
  const revived = applyGameCommand(paid, commands[2])
  expect(revived.players['player-one'].battleArea[1].hpCards).toHaveLength(2)
  expect(JSON.parse(JSON.stringify(commands)).reduce((state: GameState, command: typeof commands[number]) => applyGameCommand(state, command), initial)).toEqual(revived)
  expect(revived.players['player-two']).toEqual(initial.players['player-two'])
})

it.each(['short-deck', 'refresh-defeat', 'no-refresh-cookie'] as const)('083 retains printed HP setup across real Refresh: %s', scenario => {
  const before = createBs12GuitarStringDemoState(scenario)
  const waiting = play(applyGameCommand(before, fixtureBegin), ['bs12-083-blocker'])
  expect(waiting.players['player-one'].battleArea[1].hpCards).toHaveLength(1)
  if (scenario === 'no-refresh-cookie') {
    expect(waiting.status).toBe('finished')
    expect(waiting.result?.reason).toBe('refresh-unavailable')
    return
  }
  expect(waiting.pendingRefresh?.remainingHpSetup).toEqual([{ targetInstanceId: 'bs12-083-blocker', amount: 1 }])
  const after = applyGameCommand(waiting, { kind: 'refresh-deck', playerId: 'player-one', cookieInstanceId: 'bs12-083-non-blocker', shuffleSeed: 83 })
  expect(after.status).toBe(scenario === 'refresh-defeat' ? 'finished' : 'playing')
  if (scenario === 'short-deck') {
    expect(after.players['player-one'].battleArea[1].hpCards).toHaveLength(2)
    expect(after.players['player-one'].deck).toHaveLength(1)
    expect(after.pendingAbilityEffect).toBeFalsy()
  } else expect(after.result?.winnerId).toBe('player-two')
  expect(after.players['player-two']).toEqual(before.players['player-two'])
})

it('083 fixture routes remain local and reject unknown scenarios', () => {
  expect(parseTestStateConfig('?test-state=bs12-083:dj-new-target', 'localhost')).toEqual({ kind: 'bs12-083', scenario: 'dj-new-target' })
  expect(parseTestStateConfig('?test-state=bs12-083:dj-new-target', 'example.com')).toBeNull()
  expect(parseTestStateConfig('?test-state=bs12-083:unknown', 'localhost')).toBeNull()
})

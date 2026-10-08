import { expect, it } from 'vitest'
import candidateDocument from '../../data/candidates/official-festival-arena-bs12.en.json'
import bs6Document from '../../data/cards/official-age-of-heroes-and-kingdoms-bs6.en.json'
import blueDocument from '../../data/cards/official-starter-deck-blue.en.json'
import { convertOfficialCardToExtraDeckCard, convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { createBs12AttackDemoState, createBs12BlackLemonadeDemoState, createBs12FlipDemoState, createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import type { GameState } from './types'

const records = [...candidateDocument.cards, ...bs6Document.cards, ...blueDocument.cards] as OfficialCardRecord[]
const assertPrintedCards = (state: GameState) => {
  const cards = Object.values(state.players).flatMap(player => [...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea,
    ...player.supportArea.map(entry => entry.card), ...player.battleArea.flatMap(entry => [entry.card, ...entry.hpCards]), ...(player.stage ? [player.stage.card] : [])])
  if (state.pendingBattle?.revealedHpCard) cards.push(state.pendingBattle.revealedHpCard)
  for (const card of cards) {
    const record = records.find(record => record.imageUrl === card.imageUrl && record.baseCardNumber === card.id)
    expect(record, `No physical record for ${card.instanceId} / ${card.id}`).toBeDefined()
    const converted = convertOfficialCardToGameCard(record!, card.instanceId)
    expect(converted.status).toBe('converted')
    if (converted.status === 'converted') expect(card).toEqual({ ...converted.gameCard, instanceId: card.instanceId })
  }
  for (const player of Object.values(state.players)) {
    for (const extra of player.extraDeck ?? []) {
      const record = records.find(record => record.imageUrl === extra.imageUrl && record.baseCardNumber === extra.id)
      expect(record, `No physical EXTRA record for ${extra.instanceId}`).toBeDefined()
      const converted = convertOfficialCardToExtraDeckCard(record!)
      expect(converted.status).toBe('converted')
      if (converted.status === 'converted') expect(extra).toEqual({ ...converted.extraDeckCard, instanceId: extra.instanceId })
    }
    const owned = [...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea, ...player.supportArea.map(entry => entry.card),
      ...player.battleArea.flatMap(entry => [entry.card, ...entry.hpCards]), ...(player.stage ? [player.stage.card] : []), ...(player.extraDeck ?? [])]
    if (state.pendingBattle?.revealedHpCard && state.pendingBattle.defenderPlayerId === player.id) owned.push(state.pendingBattle.revealedHpCard)
    expect(new Set(owned.map(card => card.instanceId)).size).toBe(owned.length)
    for (const id of new Set(owned.map(card => card.id))) expect(owned.filter(card => card.id === id).length, `${player.id} ${id} copies`).toBeLessThanOrEqual(4)
  }
}

it.each(['BS12-001', 'BS12-002', 'BS12-003', 'BS12-004'] as const)('%s attack fixture contains only unchanged physical cards in every zone', number => {
  for (const payable of [true, false]) assertPrintedCards(createBs12AttackDemoState(number, payable))
  assertPrintedCards(createCardCheckDemoState(number))
  assertPrintedCards(createCardNegativeDemoState(number))
})
it.each(['BS12-002', 'BS12-004'] as const)('%s FLIP counterexamples use physical Cards instead of editing keywords or colors', number => {
  for (const scenario of ['positive', 'no-hand', 'no-arena', 'wrong-color', 'two-targets'] as const) assertPrintedCards(createBs12FlipDemoState(scenario, number))
})
it.each(['BS12-092', 'BS12-092@1'] as const)('%s generic EXTRA entry and blocked states contain only unchanged physical cards', number => {
  for (const scenario of ['extra', 'break-two'] as const) assertPrintedCards(createBs12BlackLemonadeDemoState(number, scenario))
})
it.each(['BS12-001', 'BS12-002', 'BS12-003', 'BS12-004'] as const)('%s generic routes select the card-specific effect and blocked scenario', number => {
  const flip = number === 'BS12-002' || number === 'BS12-004'
  expect(parseTestStateConfig(`?test-state=card:${number}`, 'localhost')).toMatchObject({ kind: flip ? 'bs12-flip' : 'bs12-attack', cardNumber: number })
  expect(parseTestStateConfig(`?test-state=card-negative:${number}`, 'localhost')).toMatchObject({ kind: flip ? 'bs12-flip' : 'bs12-attack', cardNumber: number })
})

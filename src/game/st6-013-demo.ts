import { getCardPoolEntry } from './card-pool'
import { createCard } from './starter-deck'
import { createSt6012PreviewState } from './st6-012-demo'
import type { DeckAdditionScenario } from './bs12-deck-addition-demo'

/** Original formal card; HP boundaries come from printed cards and real attacks. */
export const createSt6013PreviewState = (scenario: DeckAdditionScenario, targetNumber = 'ST6-002') => {
  const state = createSt6012PreviewState(scenario === 'no-target' ? 'positive' : scenario, targetNumber)
  const own = state.players['player-one']
  const raw = getCardPoolEntry('ST6-013')
  if (!raw) throw new Error('Missing original ST6-013 formal record')
  if (scenario === 'one-card') own.discardPile.shift()
  else own.deck.shift()
  own.discardPile.push(...own.hand)
  own.hand = [createCard(raw, 'player-one', 1)]
  if (scenario === 'no-target') {
    const moved = own.battleArea.shift()
    if (!moved) throw new Error('Missing original Picky Pyro-tiger')
    own.discardPile.push(moved.card, ...moved.hpCards)
  }
  return state
}

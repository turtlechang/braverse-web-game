import { getCardPoolEntry } from './card-pool'
import { createCard } from './starter-deck'
import { createSt6012PreviewState } from './st6-012-demo'
import { applyGameCommand } from './commands'
import type { DeckAdditionScenario } from './bs12-deck-addition-demo'

/** Original formal card; exact printed card, preserved sixty-card inventories. */
export const createSt6014PreviewState = (scenario: DeckAdditionScenario) => {
  let state = createSt6012PreviewState(scenario === 'rested-source' ? 'positive' : scenario)
  const own = state.players['player-one']
  own.deck.shift()
  own.discardPile.push(...own.hand)
  const raw = getCardPoolEntry('ST6-014')
  if (!raw) throw new Error('Missing original ST6-014 formal record')
  own.hand = [createCard(raw, 'player-one', 1)]
  if (scenario === 'rested-source' || scenario === 'attack') {
    const replacement = own.deck.findIndex(card => card.energyColor === 'red')
    if (replacement < 0) throw new Error('Missing actual red support swap')
    const original = own.supportArea[3].card
    own.supportArea[3].card = own.deck[replacement]
    own.deck[replacement] = original
  }
  if (scenario === 'rested-source') {
    state = applyGameCommand(state, {kind:'declare-attack',playerId:'player-one',
      attackerInstanceId:own.battleArea[0].card.instanceId,
      targetInstanceId:state.players['player-two'].battleArea[1].card.instanceId,
      supportPaymentIds:own.supportArea.slice(0,2).map(s=>s.card.instanceId)})
    state = applyGameCommand(state,{kind:'skip-trap',playerId:'player-two'})
    state = applyGameCommand(state,{kind:'resolve-battle',playerId:'player-one'})
  }
  if (scenario === 'target-faints' || scenario === 'reveal') {
    const opponent = state.players['player-two']
    const raw = getCardPoolEntry('ST6-005')
    if (!raw || raw.hp !== 1) throw new Error('Missing original one-HP Agar Agar')
    const target = opponent.battleArea[1]
    const cookie = createCard(raw, 'player-two', 1)
    if (cookie.type !== 'cookie') throw new Error('Expected original Agar Cookie')
    target.card = cookie
    target.battleEntryId = target.card.instanceId + ':entry'
    opponent.discardPile.push(...target.hpCards.splice(1))
    if (scenario === 'reveal') {
      const flip = getCardPoolEntry('ST6-006')
      if (!flip?.flipText) throw new Error('Missing original Cherry FLIP')
      target.hpCards[0] = createCard(flip, 'player-two', 1)
    }
  }
  return state
}

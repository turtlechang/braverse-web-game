import { getCardPoolEntry } from './card-pool'
import { createCard } from './starter-deck'
import { createSt6012PreviewState } from './st6-012-demo'
import { applyGameCommand } from './commands'
import type { DeckAdditionScenario } from './bs12-deck-addition-demo'

/** Original formal card; all zones preserve sixty actual cards. */
export const createSt6015PreviewState = (scenario: DeckAdditionScenario, targetNumber = 'ST6-002') => {
  if(scenario === 'green-arena')targetNumber='ST3-004'
  const baseScenario=scenario === 'green-arena'?'positive':scenario === 'no-battle'?'low':scenario
  let state = createSt6012PreviewState(baseScenario === 'rested-source' ? 'positive' : baseScenario,targetNumber)
  const own = state.players['player-one']
  own.deck.shift()
  own.discardPile.push(...own.hand)
  const raw = getCardPoolEntry('ST6-015')
  if (!raw) throw new Error('Missing original ST6-015 formal record')
  own.hand = [createCard(raw,'player-one',1)]
  if(scenario === 'rested-source' || scenario === 'attack'){
    const index=own.deck.findIndex(card=>card.energyColor==='red')
    if(index<0)throw new Error('Missing original red support swap')
    const previous=own.supportArea[3].card
    own.supportArea[3].card=own.deck[index];own.deck[index]=previous
  }
  if(scenario === 'rested-source'){
    state=applyGameCommand(state,{kind:'declare-attack',playerId:'player-one',
      attackerInstanceId:own.battleArea[0].card.instanceId,
      targetInstanceId:state.players['player-two'].battleArea[1].card.instanceId,
      supportPaymentIds:own.supportArea.slice(0,2).map(s=>s.card.instanceId)})
    state=applyGameCommand(state,{kind:'skip-trap',playerId:'player-two'})
    state=applyGameCommand(state,{kind:'resolve-battle',playerId:'player-one'})
  }
  if(scenario === 'no-battle'){
    const removed=own.battleArea.shift()
    if(!removed)throw new Error('Missing original Picky')
    own.discardPile.push(removed.card,...removed.hpCards)
  }
  return state
}

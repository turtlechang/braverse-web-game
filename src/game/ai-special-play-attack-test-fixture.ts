import { createSt7006PreviewState } from './st7-006-demo'
import { getCardPoolEntry } from './card-pool'
import { createCard } from './starter-deck'
import { applyGameCommand } from './commands'
import { getLegalTurnCommands } from './legal-actions'
import type { CookieCard, GameState, PlayerId } from './types'

export interface SpecialPlayAttackScenario {
  target: 'ST1-011' | 'ST1-005' | 'ST6-006'
  supports: number
  fodder: boolean
  buddyActive?: boolean
  shield?: boolean
}

const printed = (id: string, owner: PlayerId, copy = 1) => {
  const raw = getCardPoolEntry(id)
  if (!raw) throw new Error(`Missing original ${id}`)
  return createCard(raw, owner, copy)
}
const cookie = (id: string, owner: PlayerId, copy = 1): CookieCard => {
  const card = printed(id, owner, copy)
  if (card.type !== 'cookie') throw new Error(`Expected original Cookie ${id}`)
  return card
}

/** Prepared public policy position: original 60-card zones and printed HP.
 * REST history is prepared, not a replay of a complete historical game.
 */
export const createSpecialPlayAttackFixture = (scenario: SpecialPlayAttackScenario) => {
  const state = createSt7006PreviewState('attack', true)
  const own = state.players['player-one'], foe = state.players['player-two']
  const licorice = cookie('BS11-092', 'player-one')
  const mold = cookie('BS11-111', 'player-one')
  const fodder = printed('ST1-020', 'player-one')
  const target = cookie(scenario.target, 'player-two', 2)
  const source = own.battleArea[0]
  source.card = licorice; source.battleEntryId = `${licorice.instanceId}:entry`
  source.hpCards.push(...own.deck.splice(0, licorice.hp - source.hpCards.length))
  source.rested = true; own.battleArea[1].rested = !scenario.buddyActive
  own.deck.push(...own.supportArea.map(support => support.card)); own.supportArea = []
  own.deck.splice(0, scenario.fodder ? 2 : 1)
  own.hand = scenario.fodder ? [mold, fodder] : [mold]
  for (let copy = 1; copy <= scenario.supports; copy++) {
    own.deck.shift()
    own.supportArea.push({ card: printed('BS11-110', 'player-one', copy), rested: false })
  }
  const defender = foe.battleArea[0]
  defender.card = target; defender.battleEntryId = `${target.instanceId}:entry`
  if (target.hp < defender.hpCards.length) foe.deck.push(...defender.hpCards.splice(target.hp))
  else defender.hpCards.push(...foe.deck.splice(0, target.hp - defender.hpCards.length))
  const choices = new Map<number, string[]>([[0, []]])
  const needed = 10 - target.level
  for (const card of foe.deck) {
    if (card.type !== 'cookie') continue
    for (const [sum, ids] of [...choices]) {
      if (sum + card.level <= needed && !choices.has(sum + card.level)) {
        choices.set(sum + card.level, [...ids, card.instanceId])
      }
    }
    if (choices.has(needed)) break
  }
  const ids = choices.get(needed)
  if (!ids) throw new Error('Insufficient original Break resources')
  const selected = new Set(ids)
  for (const card of foe.deck.filter(card => selected.has(card.instanceId))) {
    if (card.type !== 'cookie') throw new Error('Break requires Cookie')
    foe.breakArea.push(card)
  }
  foe.deck = foe.deck.filter(card => !selected.has(card.instanceId))
  if (scenario.shield) {
    foe.deck.splice(0, 3); foe.hand = [printed('ST2-020', 'player-two')]
    foe.supportArea = ['ST2-018', 'ST2-019'].map(id => ({ card: printed(id, 'player-two'), rested: false }))
  }
  return state
}

export const lowerLicorice = (state: GameState) => applyGameCommand(state, {
  kind: 'activate-skill', trigger: 'activate', playerId: 'player-one',
  sourceInstanceId: state.players['player-one'].battleArea[0].card.instanceId,
  paymentIds: [], effectTargets: [[state.players['player-one'].battleArea[0].card.instanceId]],
})

export const deployMold = (state: GameState) => {
  const mold = state.players['player-one'].hand.find(card => card.id === 'BS11-111')
  const command = getLegalTurnCommands(state, 'player-one').find(command =>
    command.kind === 'deploy-cookie' && command.instanceId === mold?.instanceId &&
    command.specialPlayCookieInstanceIds?.includes(state.players['player-one'].battleArea[0].card.instanceId),
  )
  if (!command) throw new Error('Missing actual Special Play command')
  return applyGameCommand(state, command)
}

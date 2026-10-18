import { applyGameCommand } from './commands'
import { getCardPoolEntry } from './card-pool'
import { createCard } from './starter-deck'
import { fixture } from './st7-017-demo'
import { zones } from './st7-014-demo'
import type { GameCard } from './types'

export type AiPublicNoopTrapScenario =
  | 'missing'
  | 'black-non-arena'
  | 'yellow-arena'
  | 'black-arena'
  | 'rested-black-arena'
  | 'hand-black-arena'
  | 'missing-then-valid-trap'

/** Uses the original 60-card setup and a real ordinary attack that opens a trap response. */
export const createAiPublicNoopTrapPreview = (
  scenario: AiPublicNoopTrapScenario,
  prepareOnly = false,
) => {
  const state = fixture('ai-break4', true)
  const owner = 'player-two'
  const self = state.players[owner]
  const foe = state.players['player-one']

  const original = (id: string): GameCard => {
    const raw = getCardPoolEntry(id)
    if (!raw) throw new Error(`Original card ${id} is missing from the card pool`)

    const used = new Set(zones(state, owner).map(card => card.instanceId))
    for (let copy = 1; copy <= 4; copy += 1) {
      const card = createCard(raw, owner, copy)
      if (!used.has(card.instanceId)) return card
    }
    throw new Error(`Card ${id} exceeds the physical four-copy limit`)
  }

  self.hand = [original('BS12-105')]
  self.supportArea[3]!.card = original('BS12-105')

  if (scenario === 'missing-then-valid-trap') {
    self.deck.shift()
    self.hand.push(original('ST8-018'))
    self.supportArea[2]!.card = original('ST8-018')
  }

  const witnessId = scenario === 'black-non-arena'
    ? 'BS11-095'
    : scenario === 'yellow-arena'
      ? 'BS12-034'
      : scenario === 'black-arena' || scenario === 'rested-black-arena'
        ? 'BS12-112'
        : undefined

  if (witnessId) {
    const card = original(witnessId)
    if (card.type !== 'cookie') throw new Error('Expected an original Cookie card')

    const battle = self.battleArea[0]!
    battle.card = card
    battle.battleEntryId = `${card.instanceId}:entry`
    while (battle.hpCards.length > card.hp) self.deck.push(battle.hpCards.pop()!)
    while (battle.hpCards.length < card.hp) {
      const hp = self.deck.shift()
      if (!hp) throw new Error('Could not complete the printed HP stack')
      battle.hpCards.push(hp)
    }
    battle.rested = scenario === 'rested-black-arena'
  }

  if (scenario === 'hand-black-arena') {
    self.deck.shift()
    self.hand.push(original('BS12-112'))
  }

  for (const playerId of ['player-one', 'player-two'] as const) {
    const cards = zones(state, playerId)
    if (cards.length !== 60 || new Set(cards.map(card => card.instanceId)).size !== 60) {
      throw new Error('Expected 60 original cards with unique instance IDs per player')
    }
    for (const card of cards) {
      if (cards.filter(candidate => candidate.id === card.id).length > 4) {
        throw new Error(`Card ${card.id} exceeds the physical four-copy limit`)
      }
    }
    for (const cookie of state.players[playerId].battleArea) {
      if (cookie.hpCards.length !== cookie.card.hp) {
        throw new Error(`Cookie ${cookie.card.id} does not have its printed HP stack`)
      }
    }
  }

  if (prepareOnly) return state

  return applyGameCommand(state, {
    kind: 'declare-attack',
    playerId: 'player-one',
    attackerInstanceId: foe.battleArea[1]!.card.instanceId,
    targetInstanceId: self.battleArea[1]!.card.instanceId,
    supportPaymentIds: foe.supportArea.slice(0, 3).map(support => support.card.instanceId),
  })
}

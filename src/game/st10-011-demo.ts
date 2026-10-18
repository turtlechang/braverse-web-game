import type { OfficialCardRecord } from '../cards/types'
import st10CandidateDocument from '../../data/candidates/st6-st10/official-st10.en.json'
import { createCard } from './starter-deck'
import { getCardPoolEntry } from './card-pool'
import { createSt10006PreviewState, st10006Zones } from './st10-006-demo'
import type { CookieCard, GameState } from './types'

export type St10011Scenario = 'attack' | 'insufficient-energy'

const candidateCards = st10CandidateDocument.cards as OfficialCardRecord[]

const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value === undefined || value === null) throw new Error(`Missing original ${label}`)
  return value
}

export const rawSt10011 = (): OfficialCardRecord =>
  required(
    getCardPoolEntry('ST10-011') ?? candidateCards.find(card => card.cardNumber === 'ST10-011'),
    'ST10-011 printing',
  )

/** Original sixty-card fixture for Cream Unicorn Cookie's printed NNN attack. */
export const createSt10011PreviewState = (
  scenario: St10011Scenario = 'attack',
): GameState => {
  const state = createSt10006PreviewState('owner-turn')
  const player = state.players['player-one']
  player.name = 'ST10-011 實體驗收'
  const index = player.battleArea.findIndex(cookie => cookie.card.id === 'ST10-006')
  const current = player.battleArea[index]
  if (!current) throw new Error('Missing original ST10-006 battle Cookie to replace')

  const candidate = createCard(rawSt10011(), 'player-one', 1)
  if (candidate.type !== 'cookie' || candidate.hp !== 4 || candidate.level !== 2) {
    throw new Error('Cream Unicorn Cookie must use its printed LV.2 Cookie type and four HP cards')
  }
  const additionalHp = player.deck.splice(0, candidate.hp - current.hpCards.length)
  if (additionalHp.length !== candidate.hp - current.hpCards.length) {
    throw new Error('Insufficient original HP cards for Cream Unicorn Cookie')
  }
  player.battleArea[index] = {
    ...current,
    card: candidate as CookieCard,
    hpCards: [...current.hpCards, ...additionalHp],
    battleEntryId: `${candidate.instanceId}:entry`,
  }

  const supportCount = scenario === 'attack' ? 3 : 2
  const printedColor = required(rawSt10011().color, 'printed color').toLowerCase()
  const hasPrintedEnergyColor = (energyColor: unknown): energyColor is string =>
    typeof energyColor === 'string' && energyColor !== 'wild'
  const offColorIndex = player.deck.findIndex(card =>
    hasPrintedEnergyColor(card.energyColor) && card.energyColor !== printedColor,
  )
  if (offColorIndex < 0) throw new Error('The NNN payment route requires an original off-color support')
  const [offColorSupport] = player.deck.splice(offColorIndex, 1)
  if (!offColorSupport) throw new Error('Missing original off-color support')
  player.supportArea.push({ card: offColorSupport, rested: false })
  while (player.supportArea.length < supportCount) {
    const supportIndex = player.deck.findIndex(card => hasPrintedEnergyColor(card.energyColor))
    if (supportIndex < 0) throw new Error('Insufficient original colored cards for NNN support payment')
    const [support] = player.deck.splice(supportIndex, 1)
    if (!support) throw new Error('Missing original colored support')
    player.supportArea.push({ card: support, rested: false })
  }

  for (const playerId of ['player-one', 'player-two'] as const) {
    const cards = st10006Zones(state, playerId)
    const instanceIds = cards.map(card => card.instanceId)
    const duplicateIds = instanceIds.filter((instanceId, cardIndex) => instanceIds.indexOf(instanceId) !== cardIndex)
    if (cards.length !== 60 || new Set(instanceIds).size !== 60) {
      throw new Error(`Original sixty-card identities required for ${playerId}: ${cards.length} cards; duplicate ids ${duplicateIds.join(', ') || 'none'}`)
    }
    const copyCounts = new Map<string, number>()
    for (const card of cards) {
      if (!card.imageUrl?.startsWith('https://cookierunbraverse.com/')) {
        throw new Error(`Original card image missing for ${card.id}`)
      }
      copyCounts.set(card.id, (copyCounts.get(card.id) ?? 0) + 1)
    }
    if ([...copyCounts.values()].some(count => count > 4)) {
      throw new Error(`Original four-copy limit exceeded for ${playerId}`)
    }
  }
  return state
}

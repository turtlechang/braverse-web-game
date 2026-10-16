import type { OfficialCardRecord } from '../cards/types'
import st10CandidateDocument from '../../data/candidates/st6-st10/official-st10.en.json'
import { createCard } from './starter-deck'
import { getCardPoolEntry } from './card-pool'
import { createSt10006PreviewState, st10006Zones } from './st10-006-demo'
import type { CookieCard, GameState } from './types'

export type St10010Scenario = 'attack' | 'insufficient-energy'

const candidateCards = st10CandidateDocument.cards as OfficialCardRecord[]

const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value === undefined || value === null) throw new Error(`Missing original ${label}`)
  return value
}

export const rawSt10010 = (): OfficialCardRecord =>
  required(
    getCardPoolEntry('ST10-010') ?? candidateCards.find(card => card.cardNumber === 'ST10-010'),
    'ST10-010 printing',
  )

/** Original sixty-card fixture for Prophet Cookie's printed neutral attack. */
export const createSt10010PreviewState = (
  scenario: St10010Scenario = 'attack',
): GameState => {
  const state = createSt10006PreviewState('owner-turn')
  const player = state.players['player-one']
  player.name = 'ST10-010 實體驗收'
  const index = player.battleArea.findIndex(cookie => cookie.card.id === 'ST10-006')
  const current = player.battleArea[index]
  if (!current) throw new Error('Missing original ST10-006 battle Cookie to replace')

  if (!player.deck.pop()) throw new Error('Missing original card to isolate Prophet Cookie')
  const candidate = createCard(rawSt10010(), 'player-one', 1)
  if (candidate.type !== 'cookie' || candidate.hp !== current.hpCards.length) {
    throw new Error('Prophet Cookie must use its printed Cookie type and two HP cards')
  }
  player.battleArea[index] = {
    ...current,
    card: candidate as CookieCard,
    battleEntryId: `${candidate.instanceId}:entry`,
  }
  player.deck.push(current.card)

  if (scenario === 'insufficient-energy') {
    const support = player.supportArea.pop()
    if (!support) throw new Error('The negative route requires one physical support to remove')
    player.deck.push(support.card)
  }

  for (const playerId of ['player-one', 'player-two'] as const) {
    const cards = st10006Zones(state, playerId)
    if (cards.length !== 60 || new Set(cards.map(card => card.instanceId)).size !== 60) {
      throw new Error(`Original sixty-card identities required for ${playerId}`)
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

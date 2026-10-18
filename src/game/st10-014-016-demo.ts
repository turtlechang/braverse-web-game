import candidate from '../../data/candidates/st6-st10/official-st10.en.json'
import type { OfficialCardRecord } from '../cards/types'
import { createCard } from './starter-deck'
import { createDeckAdditionDemoState } from './bs12-deck-addition-demo'
import { getCardPoolEntry } from './card-pool'
import type { CookieInBattle, GameCard, GameState, PlayerId } from './types'

export type St10ItemCardNumber = 'ST10-014' | 'ST10-015' | 'ST10-016'
export type St10ItemScenario =
  | 'positive'
  | 'no-material'
  | 'battle-witness'
  | 'trash-witness'
  | 'no-witness'
  | 'fifteen-trash'
  | 'fourteen-trash'
  | 'thirteen-trash'

const records = candidate.cards as OfficialCardRecord[]

const raw = (cardNumber: St10ItemCardNumber): OfficialCardRecord => {
  const record = getCardPoolEntry(cardNumber) ?? records.find(card => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing original ${cardNumber} candidate record`)
  return record
}

const zoneCards = (state: GameState, playerId: PlayerId): GameCard[] => {
  const player = state.players[playerId]
  return [
    ...player.deck,
    ...player.hand,
    ...player.discardPile,
    ...player.breakArea,
    ...player.supportArea.map(entry => entry.card),
    ...(player.stage ? [player.stage.card] : []),
    ...player.battleArea.flatMap(entry => [
      entry.card,
      ...entry.hpCards,
      ...(entry.equippedCards ?? []),
    ]),
  ]
}

const assertPhysicalDecks = (state: GameState): void => {
  const instanceIds = new Set<string>()
  for (const playerId of ['player-one', 'player-two'] as const) {
    const cards = zoneCards(state, playerId)
    if (cards.length !== 60 || new Set(cards.map(card => card.instanceId)).size !== 60) {
      throw new Error(`ST10 Item fixture requires 60 unique original cards for ${playerId}`)
    }
    const copyCounts = new Map<string, number>()
    for (const card of cards) {
      if (!card.imageUrl?.startsWith('https://cookierunbraverse.com/')) {
        throw new Error(`Original printed art is missing for ${card.id}`)
      }
      if (instanceIds.has(card.instanceId)) throw new Error(`Duplicate physical card ${card.instanceId}`)
      instanceIds.add(card.instanceId)
      copyCounts.set(card.id, (copyCounts.get(card.id) ?? 0) + 1)
    }
    if ([...copyCounts.values()].some(count => count > 4)) {
      throw new Error(`ST10 Item fixture exceeds four copies for ${playerId}`)
    }
  }
  if (instanceIds.size !== 120) throw new Error('ST10 Item fixture requires 120 unique physical cards')
}

const ensureMoonlightInDeck = (state: GameState): number => {
  const own = state.players['player-one']
  const existingIndex = own.deck.findIndex(
    card => card.id === 'ST10-002' && card.type === 'cookie' && card.name === 'Moonlight Cookie',
  )
  if (existingIndex >= 0) return existingIndex

  const moonlightRecord = getCardPoolEntry('ST10-002')
  if (!moonlightRecord || moonlightRecord.type !== 'cookie' || moonlightRecord.name !== 'Moonlight Cookie') {
    throw new Error('The official card pool is missing the printed ST10-002 Moonlight Cookie')
  }
  const replacementIndex = own.deck.findIndex(card => card.type === 'cookie')
  if (replacementIndex < 0) throw new Error('Moonlight witness needs an original Cookie slot in the deck')
  if (!own.deck[replacementIndex]) throw new Error('Moonlight witness replacement slot is missing')

  const occupiedIds = new Set(zoneCards(state, 'player-one').map(card => card.instanceId))
  let moonlight = createCard(moonlightRecord, 'player-one', 1)
  for (let copyNumber = 2; occupiedIds.has(moonlight.instanceId) && copyNumber <= 120; copyNumber += 1) {
    moonlight = createCard(moonlightRecord, 'player-one', copyNumber)
  }
  if (occupiedIds.has(moonlight.instanceId)) throw new Error('Could not create a unique physical Moonlight card identity')

  // Substitute this printed Cookie into the 60-card fixture; the replaced card
  // is outside this scenario, so it must not remain in another zone.
  own.deck[replacementIndex] = moonlight
  return replacementIndex
}

const putMoonlightInBattle = (state: GameState): void => {
  const own = state.players['player-one']
  const moonlightIndex = ensureMoonlightInDeck(state)
  if (moonlightIndex < 0) throw new Error('Moonlight battle witness must be an original Cookie from the deck')
  const [moonlight] = own.deck.splice(moonlightIndex, 1)
  const existing = own.battleArea[0]
  if (!moonlight || moonlight.type !== 'cookie' || !existing) {
    throw new Error('ST10-015 battle-witness fixture is missing original Cookies')
  }
  const neededHp = moonlight.hp - existing.hpCards.length
  if (neededHp < 0) throw new Error('Moonlight has less printed HP than the replaced Cookie')
  const additionalHp = own.deck.splice(0, neededHp)
  if (additionalHp.length !== neededHp) throw new Error('Moonlight needs additional physical HP cards')
  own.deck.push(existing.card)
  const replacement: CookieInBattle = {
    ...existing,
    card: moonlight,
    hpCards: [...existing.hpCards, ...additionalHp],
    battleEntryId: 'st10-015-moonlight-battle-witness',
  }
  own.battleArea[0] = replacement
}

const moveMoonlightToTrash = (state: GameState): void => {
  const own = state.players['player-one']
  const moonlightIndex = ensureMoonlightInDeck(state)
  if (moonlightIndex < 0) throw new Error('Moonlight trash witness must be an original Cookie from the deck')
  const [moonlight] = own.deck.splice(moonlightIndex, 1)
  if (!moonlight) throw new Error('ST10-015 trash-witness fixture could not move Moonlight')
  own.discardPile.push(moonlight)
}

const moveTopDeckToTrash = (state: GameState, count: number): void => {
  const own = state.players['player-one']
  if (own.deck.length < count) throw new Error(`Need ${count} original cards to establish the printed trash threshold`)
  own.discardPile.push(...own.deck.splice(0, count))
}

const replaceCandidateItem = (state: GameState, cardNumber: St10ItemCardNumber): void => {
  const own = state.players['player-one']
  const slot = own.hand.findIndex(card => card.id === 'ST10-013')
  if (slot < 0) throw new Error('ST10 Item fixture needs the original ST10-013 Item slot')
  const previous = own.hand[slot]
  if (!previous) throw new Error('ST10 Item fixture source slot is missing')
  const candidateCard = createCard(raw(cardNumber), 'player-one', 1)
  own.hand[slot] = { ...candidateCard, instanceId: previous.instanceId }
}

const assertScenarioCard = (cardNumber: St10ItemCardNumber, scenario: St10ItemScenario): void => {
  const allowed: Record<St10ItemCardNumber, readonly St10ItemScenario[]> = {
    'ST10-014': ['positive', 'no-material'],
    'ST10-015': ['battle-witness', 'trash-witness', 'no-witness'],
    'ST10-016': ['fifteen-trash', 'fourteen-trash', 'thirteen-trash'],
  }
  if (!allowed[cardNumber].includes(scenario)) {
    throw new Error(`Unsupported ST10 Item scenario ${cardNumber}:${scenario}`)
  }
}

/** Uses the original 60-card physical fixtures and replaces only the Item under review. */
export const createSt1014To016ItemPreviewState = (
  cardNumber: St10ItemCardNumber,
  scenario: St10ItemScenario,
): GameState => {
  assertScenarioCard(cardNumber, scenario)
  const baseScenario = cardNumber === 'ST10-014' && scenario === 'no-material'
    ? 'negative'
    : 'positive'
  const state = createDeckAdditionDemoState('ST10-013', baseScenario)
  replaceCandidateItem(state, cardNumber)

  if (cardNumber === 'ST10-015') {
    if (scenario === 'battle-witness') putMoonlightInBattle(state)
    if (scenario === 'trash-witness') moveMoonlightToTrash(state)
  }
  if (cardNumber === 'ST10-016') {
    const initialTrashCount = scenario === 'fifteen-trash'
      ? 15
      : scenario === 'fourteen-trash'
        ? 14
        : 13
    moveTopDeckToTrash(state, initialTrashCount)
  }

  assertPhysicalDecks(state)
  return state
}

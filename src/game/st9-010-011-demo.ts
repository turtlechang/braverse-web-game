import candidateDocument from '../../data/cards/official-st9-010-011.en.json'
import type { OfficialCardRecord } from '../cards/types'
import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { applyGameCommand } from './commands'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import { createGame } from './setup'
import type { CookieInBattle, GameCard, GameState, PlayerId } from './types'

export type St9010To011CardNumber = 'ST9-010' | 'ST9-011'
export type St9010To011Scenario = 'positive' | 'no-payment'

const candidateCards = candidateDocument.cards as OfficialCardRecord[]

export const rawSt9010To011 = (cardNumber: St9010To011CardNumber): OfficialCardRecord => {
  const record = getCardPoolEntry(cardNumber) ??
    candidateCards.find(card => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Original ${cardNumber} printing is required`)
  return record
}

export const st9010To011Zones = (state: GameState, playerId: PlayerId): GameCard[] => {
  const player = state.players[playerId]
  const revealed = state.pendingBattle?.defenderPlayerId === playerId
    ? state.pendingBattle.revealedHpCard
    : null
  return [
    ...player.deck,
    ...player.hand,
    ...player.breakArea,
    ...player.discardPile,
    ...player.supportArea.map(support => support.card),
    ...(player.stage ? [player.stage.card] : []),
    ...player.battleArea.flatMap(cookie => [
      cookie.card,
      ...cookie.hpCards,
      ...(cookie.equippedCards ?? []),
    ]),
    ...(revealed ? [revealed] : []),
  ]
}

/** Physical-printing fixture: a real ST9 FLIP is the defender's next HP card. */
export const createSt9010To011PreviewState = (
  cardNumber: St9010To011CardNumber,
  scenario: St9010To011Scenario = 'positive',
): GameState => {
  const counts = new Map<string, number>()
  const card = (number: string, owner: PlayerId): GameCard => {
    const raw = number === 'ST9-010' || number === 'ST9-011'
      ? rawSt9010To011(number)
      : getCardPoolEntry(number)
    if (!raw) throw new Error(`Missing original printing ${number}`)
    const key = `${owner}:${raw.baseCardNumber || raw.cardNumber}`
    const copy = (counts.get(key) ?? 0) + 1
    if (copy > 4) throw new Error(`Original four-copy limit: ${key}`)
    counts.set(key, copy)
    return createCard(raw, owner, copy)
  }
  const filler = (count: number, owner: PlayerId): GameCard[] => {
    if (count === 0) return []
    const result: GameCard[] = []
    for (const raw of getAllCardPoolEntries()) {
      const key = `${owner}:${raw.baseCardNumber || raw.cardNumber}`
      if (raw.variant || raw.type === 'extra' || hasFlipAbility(raw) ||
          (counts.get(key) ?? 0) >= 4) continue
      result.push(card(raw.cardNumber, owner))
      if (result.length === count) return result
    }
    if (result.length !== count) throw new Error('Insufficient original-printing fillers')
    return result
  }
  const battle = (
    number: string,
    owner: PlayerId,
    hpCards?: GameCard[],
  ): CookieInBattle => {
    const source = card(number, owner)
    if (source.type !== 'cookie') throw new Error(`Expected Cookie ${number}`)
    const attached = hpCards ?? filler(source.hp, owner)
    if (attached.length !== source.hp) {
      throw new Error(`Printed HP mismatch for ${number}: ${attached.length}/${source.hp}`)
    }
    return {
      card: source,
      hpCards: attached,
      rested: false,
      battleEntryId: `${source.instanceId}:entry`,
    }
  }

  const state = createGame(
    { id: 'player-one', name: 'ST9-010～011 實體驗收', deck: createOfficialRedStarterDeck('player-one') },
    { id: 'player-two', name: '實體對手', deck: createOfficialRedStarterDeck('player-two') },
    'player-one',
    cards => cards,
  )
  state.status = 'playing'
  state.phase = 'main'
  state.turnNumber = 3
  for (const player of Object.values(state.players)) {
    player.deck = []
    player.hand = []
    player.supportArea = []
    player.breakArea = []
    player.discardPile = []
    player.battleArea = []
    player.stage = null
    player.startingCookieSelected = true
  }

  const owner = state.players['player-one']
  const opponent = state.players['player-two']
  const attacker = battle('ST9-002', 'player-one')
  const targetCard = card('ST6-003', 'player-two')
  if (targetCard.type !== 'cookie') throw new Error('ST6-003 must be a Cookie')
  const physicalFlip = card(cardNumber, 'player-two')
  const targetHp = [
    ...filler(targetCard.hp - 1, 'player-two'),
    physicalFlip,
  ]
  owner.battleArea = [attacker]
  owner.supportArea = [{ card: card('BS3-090', 'player-one'), rested: false }]
  opponent.battleArea = [{
    card: targetCard,
    hpCards: targetHp,
    rested: false,
    battleEntryId: `${targetCard.instanceId}:entry`,
  }]
  if (scenario === 'positive') opponent.hand = [card('BS3-091', 'player-two')]

  for (const playerId of ['player-one', 'player-two'] as const) {
    const remaining = 60 - st9010To011Zones(state, playerId).length
    state.players[playerId].deck.push(...filler(remaining, playerId))
    const cards = st9010To011Zones(state, playerId)
    if (cards.length !== 60 || new Set(cards.map(item => item.instanceId)).size !== 60) {
      throw new Error(`Original sixty-card identities required for ${playerId}`)
    }
    const copyCounts = new Map<string, number>()
    for (const item of cards) copyCounts.set(item.id, (copyCounts.get(item.id) ?? 0) + 1)
    if ([...copyCounts.values()].some(count => count > 4)) {
      throw new Error(`Original four-copy limit exceeded for ${playerId}`)
    }
  }
  return state
}

export const settleSt9010To011Attack = (
  initial: GameState,
  flipChoice: 'activate' | 'skip',
): GameState => {
  let state = initial.pendingBattle?.stage === 'trap'
    ? applyGameCommand(initial, { kind: 'skip-trap', playerId: 'player-two' })
    : initial
  for (let guard = 0; state.pendingBattle && guard < 8; guard += 1) {
    if (state.pendingBattle.stage === 'flip') {
      const paidCard = state.players['player-two'].hand[0]
      if (flipChoice === 'activate' && !paidCard) {
        throw new Error('A physical hand card is required for the printed FLIP cost')
      }
      state = applyGameCommand(state, {
        kind: 'resolve-flip',
        playerId: 'player-two',
        activate: flipChoice === 'activate',
        ...(flipChoice === 'activate'
          ? { discardHandIds: [paidCard!.instanceId] }
          : {}),
      })
    } else {
      state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
    }
  }
  if (state.pendingBattle) throw new Error('Printed one-damage attack did not finish')
  return state
}

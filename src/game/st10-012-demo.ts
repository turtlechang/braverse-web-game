import type { OfficialCardRecord } from '../cards/types'
import st10CandidateDocument from '../../data/candidates/st6-st10/official-st10.en.json'
import { createCard } from './starter-deck'
import { getCardPoolEntry } from './card-pool'
import { applyGameCommand } from './commands'
import { createSt10006PreviewState, st10006Zones } from './st10-006-demo'
import type { CookieCard, GameCard, GameState, PlayerId } from './types'

export type St10012FlipScenario = 'positive' | 'negative'

const candidateCards = st10CandidateDocument.cards as OfficialCardRecord[]

const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value === undefined || value === null) throw new Error(`Missing original ${label}`)
  return value
}

export const rawSt10012 = (): OfficialCardRecord =>
  required(
    getCardPoolEntry('ST10-012') ?? candidateCards.find(card => card.cardNumber === 'ST10-012'),
    'ST10-012 printing',
  )

const physicalCards = (state: GameState, playerId: PlayerId): GameCard[] => {
  const cards = st10006Zones(state, playerId)
  if (
    state.pendingBattle?.defenderPlayerId === playerId &&
    state.pendingBattle.revealedHpCard
  ) {
    cards.push(state.pendingBattle.revealedHpCard)
  }
  return cards
}

const assertPhysicalDecks = (state: GameState): void => {
  const allIds = new Set<string>()
  for (const playerId of ['player-one', 'player-two'] as const) {
    const cards = physicalCards(state, playerId)
    const ids = cards.map(card => card.instanceId)
    if (cards.length !== 60 || new Set(ids).size !== 60) {
      throw new Error(`ST10-012 requires 60 unique original cards for ${playerId}`)
    }
    const copyCounts = new Map<string, number>()
    for (const card of cards) {
      if (!card.imageUrl?.startsWith('https://cookierunbraverse.com/')) {
        throw new Error(`Original card image missing for ${card.id}`)
      }
      if (allIds.has(card.instanceId)) throw new Error(`Duplicate physical instance ${card.instanceId}`)
      allIds.add(card.instanceId)
      copyCounts.set(card.id, (copyCounts.get(card.id) ?? 0) + 1)
    }
    if ([...copyCounts.values()].some(count => count > 4)) {
      throw new Error(`ST10-012 physical fixture exceeds four copies for ${playerId}`)
    }
  }
  if (allIds.size !== 120) throw new Error('ST10-012 requires 120 unique physical cards')
}

/** Original-card fixture for a real attack that reveals and resolves ST10-012. */
export const createSt10012FlipPreviewState = (
  scenario: St10012FlipScenario,
): GameState => {
  const state = createSt10006PreviewState('opponent-turn')
  const defender = state.players['player-one']
  const defenderCookie = defender.battleArea.find(entry => entry.card.id === 'ST10-006')
  if (!defenderCookie) throw new Error('Missing the original ST10-006 defender Cookie')

  const flipRecord = rawSt10012()
  const flipCard = createCard(flipRecord, 'player-one', 1)
  if (
    flipCard.type !== 'cookie' || flipCard.officialType !== 'flip' ||
    flipCard.level !== 3 || flipCard.hp !== 4 ||
    flipCard.flip?.cost.discardHand !== 1 || flipCard.flip.attachedHpBonus !== 1
  ) {
    throw new Error('ST10-012 must keep its printed LV.3 / 4 HP / discard-one / attached +1 HP FLIP')
  }
  const retainedHp = defenderCookie.hpCards[0]
  if (!retainedHp) throw new Error('The ST10-006 defender needs one physical HP card below the FLIP')
  const displacedHp = defenderCookie.hpCards.slice(1)
  defender.deck.push(...displacedHp)
  const replacedDeckCard = defender.deck.pop()
  if (!replacedDeckCard) throw new Error('ST10-012 fixture cannot replace a real deck card')
  defenderCookie.hpCards = [retainedHp, flipCard]
  if (scenario === 'positive') {
    const payment = defender.deck.shift()
    if (!payment) throw new Error('ST10-012 positive route needs one original discardable hand card')
    defender.hand = [payment]
  } else {
    defender.hand = []
  }

  const attackerPlayer = state.players['player-two']
  const oldAttacker = attackerPlayer.battleArea[0]
  if (!oldAttacker) throw new Error('Missing the original opposing Cookie to replace')
  const attackCardRecord = required(getCardPoolEntry('BS6-017'), 'BS6-017 attacker printing')
  const fromDeckIndex = attackerPlayer.deck.findIndex(card => card.id === 'BS6-017')
  let attacker: GameCard
  if (fromDeckIndex >= 0) {
    attacker = attackerPlayer.deck.splice(fromDeckIndex, 1)[0]!
  } else {
    attacker = createCard(attackCardRecord, 'player-two', 1)
    const replacedDeckCard = attackerPlayer.deck.pop()
    if (!replacedDeckCard) throw new Error('ST10-012 fixture cannot replace an opposing deck card')
  }
  if (
    attacker.type !== 'cookie' || attacker.attackCost !== 1 || attacker.attack !== 1 ||
    (attacker.attackEffects?.length ?? 0) > 0
  ) {
    throw new Error('ST10-012 fixture needs the original BS6-017 one-energy, one-damage Cookie attack')
  }
  const attackerHp = attackerPlayer.deck.splice(0, attacker.hp)
  if (attackerHp.length !== attacker.hp) throw new Error('Insufficient original opposing HP cards')
  attackerPlayer.deck.push(oldAttacker.card, ...oldAttacker.hpCards, ...(oldAttacker.equippedCards ?? []))
  attackerPlayer.battleArea = [{
    ...oldAttacker,
    card: attacker as CookieCard,
    hpCards: attackerHp,
    rested: false,
    battleEntryId: `${attacker.instanceId}:entry`,
  }]

  const oldSupport = attackerPlayer.supportArea.find(entry => !entry.rested)
  if (!oldSupport) throw new Error('ST10-012 fixture needs an original active support to replace')
  const redSupportIndex = attackerPlayer.deck.findIndex(card => card.energyColor === 'red')
  let redSupport: GameCard
  if (redSupportIndex >= 0) {
    redSupport = attackerPlayer.deck.splice(redSupportIndex, 1)[0]!
  } else {
    const redSupportRecord = required(getCardPoolEntry('BS6-002'), 'BS6-002 red support printing')
    redSupport = createCard(redSupportRecord, 'player-two', 1)
    const replacedDeckCard = attackerPlayer.deck.pop()
    if (!replacedDeckCard) throw new Error('ST10-012 fixture cannot replace an opposing red support card')
  }
  attackerPlayer.deck.push(oldSupport.card)
  attackerPlayer.supportArea = [{ card: redSupport, rested: false }]
  state.activePlayerId = 'player-two'
  state.phase = 'main'
  assertPhysicalDecks(state)

  let opened = applyGameCommand(state, {
    kind: 'declare-attack',
    playerId: 'player-two',
    attackerInstanceId: attacker.instanceId,
    targetInstanceId: defenderCookie.card.instanceId,
    supportPaymentIds: [redSupport.instanceId],
  })
  opened = applyGameCommand(opened, { kind: 'skip-trap', playerId: 'player-one' })
  opened = applyGameCommand(opened, { kind: 'resolve-next-damage', playerId: 'player-one' })
  if (
    opened.pendingBattle?.stage !== 'flip' ||
    opened.pendingBattle.revealedHpCard?.id !== 'ST10-012'
  ) {
    throw new Error('The real BS6-017 attack did not reveal the ST10-012 HP card')
  }
  assertPhysicalDecks(opened)
  return opened
}

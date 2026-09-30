import { describe, expect, it } from 'vitest'
import bs10 from '../../data/cards/official-paradise-of-passion-and-sloth-catacombs-of-silence-bs10.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { resolveFlip } from './battle'
import { getCardPoolEntry } from './card-pool'
import { createCardCheckDemoState } from './demo'
import { createBattleState } from './test-helpers/battle-helpers'
import type { CookieInBattle, GameCard, GameState } from './types'

const candidateRecords = bs10.cards as unknown as OfficialCardRecord[]

const candidate = (id: string, suffix: string): GameCard => {
  const record = candidateRecords.find((card) => card.cardNumber === id)
  if (!record) throw new Error(`Missing candidate ${id}`)
  const result = convertOfficialCardToGameCard(record, `bs10-008-${suffix}`)
  if (result.status !== 'converted') throw new Error(`${id}: ${result.reason}`)
  return { ...result.gameCard, instanceId: `${id}:${suffix}` }
}

const official = (id: string, suffix: string): GameCard => {
  const record = getCardPoolEntry(id)
  if (!record) throw new Error(`Missing formal ${id}`)
  const result = convertOfficialCardToGameCard(record, `bs10-008-${suffix}`)
  if (result.status !== 'converted') throw new Error(`${id}: ${result.reason}`)
  return { ...result.gameCard, instanceId: `${id}:${suffix}` }
}

const cookie = (id: string, suffix: string) => {
  const card = id.startsWith('BS10-') ? candidate(id, suffix) : official(id, suffix)
  if (card.type !== 'cookie') throw new Error(`Expected Cookie ${id}`)
  return card
}

const physicalIds = (state: GameState) => [
  ...Object.values(state.players).flatMap((player) => [
    ...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile,
    ...player.supportArea.map(({ card }) => card),
    ...player.battleArea.flatMap((entry) => [entry.card, ...entry.hpCards, ...(entry.equippedCards ?? [])]),
    ...(player.stage ? [player.stage.card] : []), ...(player.extraDeck ?? []),
  ]),
  ...(state.pendingBattle?.revealedHpCard ? [state.pendingBattle.revealedHpCard] : []),
].map((card) => card.instanceId).sort()

const battleEntry = (card: GameCard, hpCards: GameCard[], id: string): CookieInBattle => ({
  card: card as CookieInBattle['card'], hpCards, rested: false, battleEntryId: id,
})

const setup = (options: { hpCards?: GameCard[]; attack: 'one' | 'two' | 'three'; hand: GameCard[]; deck: GameCard[]; refreshCookie?: GameCard }) => {
  const base = createBattleState()
  const flip = candidate('BS10-008', `flip-${options.attack}-${options.hand.length}-${options.deck.length}`)
  const attacker = cookie(options.attack === 'one' ? 'BS6-017' : options.attack === 'two' ? 'BS6-015' : 'BS6-002', `attacker-${options.attack}`)
  const defender = cookie('BS10-008', `defender-${options.attack}-${options.hand.length}-${options.deck.length}`)
  const survivor = cookie('BS6-079', `survivor-${options.attack}-${options.hand.length}-${options.deck.length}`)
  const hpCards = options.hpCards ?? [flip]
  const supports = Array.from({ length: options.attack === 'one' ? 1 : options.attack === 'two' ? 2 : 3 }, (_, index) => ({
    card: official(options.attack === 'one' || options.attack === 'three' ? 'BS6-002' : 'BS6-015', `support-${options.attack}-${index}`), rested: false,
  }))
  let state: GameState = {
    ...base,
    activePlayerId: 'player-two',
    phase: 'main',
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        battleArea: [
          battleEntry(defender, hpCards, `${defender.instanceId}:battle`),
          battleEntry(survivor, [official('BS6-047', `survivor-hp-${options.attack}`)], `${survivor.instanceId}:battle`),
        ],
        hand: options.hand,
        deck: options.deck,
        discardPile: [options.refreshCookie ?? official('BS6-002', `refresh-${options.attack}`)],
        supportArea: [],
      },
      'player-two': {
        ...base.players['player-two'],
        battleArea: [battleEntry(attacker, [official('BS6-047', `attacker-hp-${options.attack}`)], `${attacker.instanceId}:battle`)],
        supportArea: supports,
      },
    },
  }
  state = applyGameCommand(state, {
    kind: 'declare-attack', playerId: 'player-two', attackerInstanceId: attacker.instanceId,
    targetInstanceId: defender.instanceId, supportPaymentIds: supports.map(({ card }) => card.instanceId),
  })
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-one' })
  state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-one' })
  expect(state.pendingBattle?.stage).toBe('flip')
  expect(state.pendingBattle?.revealedHpCard).toEqual(flip)
  return { state, attacker, defender, survivor, flip, supports }
}

const hp = (id: string) => official('BS6-047', id)

describe('BS10-008 HP bearer FLIP through a real attack', () => {
  it('uses candidate BS10-008 and gains exactly one HP after discarding one card', () => {
    const hand = [official('BS6-002', '008-hand-cost')]
    const deck = [hp('008-top-deck'), hp('008-deck-bottom')]
    const { state, defender, flip } = setup({ attack: 'one', hand, deck, hpCards: [hp('008-bottom-hp'), candidate('BS10-008', 'flip-one-1-2')] })
    expect(flip.flip).toMatchObject({ cost: { energy: {}, discardHand: 1 }, attachedHpBonus: 1 })
    const resolved = applyGameCommand(state, { kind: 'resolve-flip', playerId: 'player-one', activate: true, discardHandIds: [hand[0]!.instanceId] })
    expect(resolved.cookiesGainedHpThisTurn?.['player-one']).toBe(true)
    expect(resolved.players['player-one'].battleArea[0].hpCards.map((card) => card.instanceId)).toEqual(['BS6-047:008-bottom-hp', 'BS6-047:008-top-deck'])
    expect(resolved.players['player-one'].hand).toEqual([])
    expect(resolved.players['player-one'].discardPile.map((card) => card.instanceId)).toEqual(expect.arrayContaining([flip.instanceId, hand[0]!.instanceId]))
    expect(resolved.players['player-one'].battleArea[1].hpCards).toHaveLength(1)
    expect(resolved.pendingBattle).toBeNull()
    expect(resolved.players['player-one'].battleArea.find((entry) => entry.card.instanceId === defender.instanceId)?.card).toEqual(defender)
    expect(physicalIds(resolved)).toEqual(physicalIds(setup({
      attack: 'one', hand, deck,
      hpCards: [hp('008-bottom-hp'), candidate('BS10-008', 'flip-one-1-2')],
    }).state))
  })

  it.each([true, false])('last HP can rescue or decline without changing survivor: %s', (activate) => {
    const hand = [official('BS6-002', `008-last-hand-${activate}`)]
    const deck = [hp(`008-last-top-${activate}`), hp(`008-last-bottom-${activate}`)]
    const { state, defender, survivor, flip } = setup({ attack: 'one', hand, deck })
    const before = structuredClone(state)
    const resolved = applyGameCommand(state, {
      kind: 'resolve-flip', playerId: 'player-one', activate,
      discardHandIds: activate ? [hand[0]!.instanceId] : [],
    })
    const rescued = resolved.players['player-one'].battleArea.find((entry) => entry.card.instanceId === defender.instanceId)
    if (activate) {
      expect(rescued?.hpCards.map((card) => card.instanceId)).toEqual([`BS6-047:008-last-top-${activate}`])
      expect(resolved.players['player-one'].discardPile.map((card) => card.instanceId)).toEqual(expect.arrayContaining([flip.instanceId, hand[0]!.instanceId]))
    } else {
      expect(rescued).toBeUndefined()
      expect(resolved.players['player-one'].discardPile.map((card) => card.instanceId)).toContain(flip.instanceId)
    }
    expect(resolved.players['player-one'].battleArea.find((entry) => entry.card.instanceId === survivor.instanceId)?.hpCards).toEqual(before.players['player-one'].battleArea[1]?.hpCards)
    expect(resolved.pendingBattle).toBeNull()
  })

  it('rejects activation without a hand card and leaves the real battle immutable', () => {
    const { state } = setup({ attack: 'one', hand: [], deck: [hp('008-nohand-top'), hp('008-nohand-bottom')] })
    const snapshot = structuredClone(state)
    expect(() => applyGameCommand(state, {
      kind: 'resolve-flip', playerId: 'player-one', activate: true, discardHandIds: [],
    })).toThrow()
    expect(state).toEqual(snapshot)
  })

  it('declines a nonlethal gain-HP FLIP and keeps the bearer alive', () => {
    const hand: GameCard[] = []
    const deck = [hp('008-decline-top'), hp('008-decline-bottom')]
    const bottom = hp('008-decline-bottom-hp')
    const flip = candidate('BS10-008', 'flip-one-0-2')
    const { state, defender, survivor } = setup({
      attack: 'one', hand, deck, hpCards: [bottom, flip],
    })
    const declined = applyGameCommand(state, {
      kind: 'resolve-flip', playerId: 'player-one', activate: false, discardHandIds: [],
    })
    expect(declined.players['player-one'].battleArea.find((entry) => entry.card.instanceId === defender.instanceId)?.hpCards)
      .toEqual([bottom])
    expect(declined.players['player-one'].battleArea.find((entry) => entry.card.instanceId === survivor.instanceId)?.hpCards).toHaveLength(1)
    expect(declined.cookiesGainedHpThisTurn?.['player-one']).not.toBe(true)
    expect(declined.pendingBattle).toBeNull()
    expect(declined.players['player-one'].discardPile.map((card) => card.instanceId)).toContain(flip.instanceId)
  })

  it('continues the second damage after rescuing last HP, then faints once', () => {
    const hand = [official('BS6-002', '008-two-hand')]
    const deck = [hp('008-two-top'), hp('008-two-bottom')]
    const { state, defender, survivor, flip } = setup({ attack: 'two', hand, deck })
    const rescued = applyGameCommand(state, { kind: 'resolve-flip', playerId: 'player-one', activate: true, discardHandIds: [hand[0]!.instanceId] })
    expect(rescued.pendingBattle?.remainingDamage).toBe(1)
    expect(rescued.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
    const finished = applyGameCommand(rescued, { kind: 'resolve-next-damage', playerId: 'player-one' })
    expect(finished.players['player-one'].battleArea.find((entry) => entry.card.instanceId === defender.instanceId)).toBeUndefined()
    expect(finished.players['player-one'].battleArea.find((entry) => entry.card.instanceId === survivor.instanceId)?.hpCards).toHaveLength(1)
    expect(finished.players['player-one'].discardPile.filter((card) => card.instanceId === flip.instanceId)).toHaveLength(1)
    expect(finished.pendingBattle).toBeNull()
  })

  it.each(['missing', 'unknown', 'wrong-zone', 'duplicate', 'excess'] as const)('rejects %s discard payment immutably', (caseName) => {
    const hand = [official('BS6-002', `008-invalid-hand-${caseName}`), official('BS6-002', `008-invalid-other-${caseName}`)]
    const { state, flip } = setup({ attack: 'one', hand, deck: [hp(`008-invalid-deck-${caseName}`)] })
    const ids = { missing: [], unknown: ['unknown-card'], 'wrong-zone': [flip.instanceId], duplicate: [hand[0]!.instanceId, hand[0]!.instanceId], excess: hand.map((card) => card.instanceId) }[caseName]
    const snapshot = structuredClone(state)
    expect(() => applyGameCommand(state, { kind: 'resolve-flip', playerId: 'player-one', activate: true, discardHandIds: ids })).toThrow()
    expect(state).toEqual(snapshot)
  })

  it.each(['one', 'two'] as const)('refreshes a one-card deck and resumes remaining damage: %s', (attack) => {
    const hand = [official('BS6-002', `008-refresh-hand-${attack}`)]
    const refreshCookie = official('BS6-002', `008-refresh-cookie-${attack}`)
    const deck = [hp(`008-refresh-top-${attack}`)]
    const { state, defender, survivor } = setup({ attack, hand, deck, refreshCookie })
    const beforeIds = physicalIds(state)
    const pending = applyGameCommand(state, { kind: 'resolve-flip', playerId: 'player-one', activate: true, discardHandIds: [hand[0]!.instanceId] })
    expect(pending.pendingRefresh?.playerId).toBe('player-one')
    const blockedSnapshot = structuredClone(pending)
    expect(() => applyGameCommand(pending, { kind: 'resolve-next-damage', playerId: 'player-one' })).toThrow()
    expect(pending).toEqual(blockedSnapshot)
    const refreshed = applyGameCommand(pending, { kind: 'refresh-deck', playerId: 'player-one', cookieInstanceId: refreshCookie.instanceId, shuffleSeed: 7 })
    const finished = applyGameCommand(refreshed, { kind: 'resolve-next-damage', playerId: 'player-one' })
    expect(finished.players['player-one'].battleArea.find((entry) => entry.card.instanceId === survivor.instanceId)?.hpCards).toHaveLength(1)
    expect(physicalIds(finished)).toEqual(beforeIds)
    expect(finished.pendingRefresh).toBeNull()
    expect(finished.pendingBattle).toBeNull()
    if (attack === 'one') {
      expect(finished.players['player-one'].battleArea.find((entry) => entry.card.instanceId === defender.instanceId)?.hpCards)
        .toEqual([expect.objectContaining({ instanceId: `BS6-047:008-refresh-top-${attack}` })])
    } else {
      expect(finished.players['player-one'].battleArea.find((entry) => entry.card.instanceId === defender.instanceId)).toBeUndefined()
    }
  })

  it('continues an attached +2 HP gain after a one-card deck refresh', () => {
    const base = createBattleState()
    const bearer = cookie('BS6-047', '008-amount-bearer')
    const survivor = cookie('BS6-079', '008-amount-survivor')
    const attacker = cookie('BS6-017', '008-amount-attacker')
    const flip = official('BS1-040', '008-amount-flip')
    const topDeck = official('BS6-019', '008-amount-top')
    const handItem = official('BS6-019', '008-amount-hand')
    const refreshCookie = cookie('BS6-017', '008-amount-refresh')
    const breakThree = [cookie('BS6-079', '008-amount-break-a'), cookie('BS6-079', '008-amount-break-b')]
    const support = official('BS6-002', '008-amount-support')
    const state: GameState = {
      ...base,
      activePlayerId: 'player-two',
      phase: 'main',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            battleEntry(bearer, [flip], `${bearer.instanceId}:battle`),
            battleEntry(survivor, [hp('008-amount-survivor-hp')], `${survivor.instanceId}:battle`),
          ],
          hand: [handItem],
          deck: [topDeck],
          breakArea: breakThree,
          discardPile: [refreshCookie, official('BS6-019', '008-amount-trash-a'), official('BS6-019', '008-amount-trash-b')],
          supportArea: [],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [battleEntry(attacker, [hp('008-amount-attacker-hp')], `${attacker.instanceId}:battle`)],
          supportArea: [{ card: support, rested: false }],
        },
      },
    }
    const declared = applyGameCommand(state, {
      kind: 'declare-attack', playerId: 'player-two', attackerInstanceId: attacker.instanceId,
      targetInstanceId: bearer.instanceId, supportPaymentIds: [support.instanceId],
    })
    const revealed = applyGameCommand(
      applyGameCommand(declared, { kind: 'skip-trap', playerId: 'player-one' }),
      { kind: 'resolve-next-damage', playerId: 'player-one' },
    )
    const paid = applyGameCommand(revealed, {
      kind: 'resolve-flip', playerId: 'player-one', activate: true, discardHandIds: [handItem.instanceId],
    })
    expect(paid.pendingRefresh).toMatchObject({
      playerId: 'player-one', remainingHpGain: { targetInstanceId: bearer.instanceId, amount: 1 },
    })
    expect(paid.players['player-one'].battleArea.find((entry) => entry.card.instanceId === bearer.instanceId)?.hpCards)
      .toHaveLength(1)
    const refreshed = applyGameCommand(paid, {
      kind: 'refresh-deck', playerId: 'player-one', cookieInstanceId: refreshCookie.instanceId, shuffleSeed: 3,
    })
    expect(refreshed.players['player-one'].battleArea.find((entry) => entry.card.instanceId === bearer.instanceId)?.hpCards)
      .toHaveLength(2)
    expect(refreshed.players['player-one'].breakArea.reduce((total, card) => total + (card.level ?? 0), 0)).toBe(7)
    const finished = applyGameCommand(refreshed, { kind: 'resolve-next-damage', playerId: 'player-one' })
    expect(finished.pendingRefresh).toBeNull()
    expect(finished.pendingBattle).toBeNull()
    expect(physicalIds(finished)).toEqual(physicalIds(state))
  })

  it('removes an original BS9-025 bearer before Refresh when HP goes to an alternate Cookie', () => {
    const initial = createCardCheckDemoState('BS9-025')
    const host = initial.players['player-one'].battleArea.find((entry) => entry.card.id === 'BS8-030')!
    const alternate = initial.players['player-one'].battleArea.find((entry) => entry.card.id === 'BS8-014')!
    const payment = initial.players['player-one'].hand[0]!
    const refreshCookie = initial.players['player-one'].breakArea[0]!
    const state: GameState = {
      ...initial,
      players: {
        ...initial.players,
        'player-one': {
          ...initial.players['player-one'],
          battleArea: initial.players['player-one'].battleArea.map((entry) =>
            entry.card.instanceId === host.card.instanceId ? { ...entry, hpCards: [] } : entry,
          ),
          deck: [initial.players['player-one'].deck[0]!],
          discardPile: [refreshCookie],
          breakArea: initial.players['player-one'].breakArea.slice(1),
          hand: [payment],
        },
      },
      activePlayerId: 'player-one',
    }
    const paid = resolveFlip(state, 'player-one', {
      activate: true,
      discardHandIds: [payment.instanceId],
      targetIds: [alternate.card.instanceId],
    })
    expect(paid.players['player-one'].battleArea.find((entry) => entry.card.instanceId === host.card.instanceId)).toBeUndefined()
    expect(paid.players['player-one'].breakArea).toContainEqual(host.card)
    expect(paid.players['player-one'].battleArea.find((entry) => entry.card.instanceId === alternate.card.instanceId)?.hpCards).toHaveLength(5)
    expect(paid.pendingRefresh?.playerId).toBe('player-one')
    const refreshed = applyGameCommand(paid, {
      kind: 'refresh-deck', playerId: 'player-one', cookieInstanceId: refreshCookie.instanceId, shuffleSeed: 4,
    })
    expect(refreshed.players['player-one'].battleArea.find((entry) => entry.card.instanceId === alternate.card.instanceId)?.hpCards).toHaveLength(5)
    const finished = applyGameCommand(refreshed, { kind: 'resolve-next-damage', playerId: 'player-one' })
    expect(finished.pendingRefresh).toBeNull()
    expect(finished.pendingBattle).toBeNull()
  })
})

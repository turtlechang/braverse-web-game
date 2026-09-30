import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { deployCookie } from './actions'
import { refreshDeck } from './refresh'
import { resolveAttackEffect } from './battle'
import { canActivateCookieSkill } from './skills'
import { createBattleState, cookie, item } from './test-helpers/battle-helpers'
import type {
  CookieCard,
  CookieInBattle,
  GameCard,
  GameState,
} from './types'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const candidate = (cardNumber: string, suffix: string): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  const result = convertOfficialCardToGameCard(
    record,
    `bs11-twenty-second-${suffix}`,
  )
  if (result.status !== 'converted') {
    throw new Error(`${cardNumber}: ${result.reason}`)
  }
  return { ...result.gameCard, instanceId: `${cardNumber}:${suffix}` }
}

const cookieEntry = (card: GameCard, hpCards: GameCard[]): CookieInBattle => {
  if (card.type !== 'cookie') throw new Error(`Expected Cookie: ${card.name}`)
  return {
    card: card as CookieCard,
    hpCards,
    rested: false,
    battleEntryId: `${card.instanceId}:battle`,
  }
}

const identityShuffle = (cards: GameCard[]): GameCard[] => cards

describe('BS11-089 Silent Salt Cookie runtime', () => {
  it('mills three cards, draws up to two, discards one, and gains HP after Refresh', () => {
    const base = createBattleState()
    const source = candidate('BS11-089', 'on-play')
    if (source.type !== 'cookie') throw new Error('BS11-089 must convert to a Cookie')

    const hpCards = [
      item('bs11-089:hp-1'),
      item('bs11-089:hp-2'),
      item('bs11-089:hp-3'),
      item('bs11-089:hp-4'),
    ]
    const millCards = [
      item('bs11-089:mill-1'),
      item('bs11-089:mill-2'),
      item('bs11-089:mill-3'),
    ]
    const drawCards = [item('bs11-089:draw-1'), item('bs11-089:draw-2')]
    const tail = item('bs11-089:tail')
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          hand: [source],
          battleArea: [],
          supportArea: [],
          deck: [...hpCards, ...millCards, ...drawCards, tail],
          discardPile: [],
        },
      },
      refreshedDuringGame: { 'player-two': true },
    }

    let current = deployCookie(state, source.instanceId)
    expect(current.pendingOnPlay).toMatchObject({
      playerId: 'player-two',
      sourceInstanceId: source.instanceId,
    })
    expect(current.players['player-two'].battleArea[0]?.hpCards).toHaveLength(4)

    current = applyGameCommand(current, {
      kind: 'begin-activate-skill',
      playerId: 'player-two',
      sourceInstanceId: source.instanceId,
      trigger: 'on-play',
      paymentIds: [],
    })
    expect(current.players['player-two'].deck).toEqual([drawCards[0], drawCards[1], tail])
    expect(current.players['player-two'].discardPile).toEqual(millCards)
    expect(current.pendingAbilityEffect).toMatchObject({ effectIndex: 0 })

    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: [],
    })
    expect(current.pendingDrawUpTo).toMatchObject({
      playerId: 'player-two',
      max: 2,
    })

    current = applyGameCommand(current, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-two',
      drawCount: 2,
    })
    expect(current.pendingOpponentHandDiscard).toMatchObject({
      playerId: 'player-two',
      count: 1,
      chainedFromDrawUpTo: true,
    })

    current = applyGameCommand(current, {
      kind: 'resolve-opponent-hand-discard',
      playerId: 'player-two',
      cardIds: [drawCards[0].instanceId],
    })
    expect(current.pendingAbilityEffect).toMatchObject({ effectIndex: 1 })

    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: [source.instanceId],
    })
    expect(current.players['player-two'].battleArea[0]?.hpCards).toHaveLength(5)
    expect(current.players['player-two'].hand).toEqual([drawCards[1]])
    expect(current.players['player-two'].discardPile).toEqual([
      ...millCards,
      drawCards[0],
    ])
    expect(current.pendingAbilityEffect).toBeUndefined()
  })

  it('continues the automatic mill cost through Refresh and preserves the pending skill queue', () => {
    const base = createBattleState()
    const source = candidate('BS11-089', 'refresh-cost')
    const refreshCookie = candidate('BS11-085', 'refresh-cookie')
    if (source.type !== 'cookie' || refreshCookie.type !== 'cookie') {
      throw new Error('BS11-089 Refresh fixture must use Cookies')
    }

    const hpCards = [
      item('bs11-089:refresh-hp-1'),
      item('bs11-089:refresh-hp-2'),
      item('bs11-089:refresh-hp-3'),
      item('bs11-089:refresh-hp-4'),
    ]
    const millCard = item('bs11-089:refresh-mill')
    const refillCards = [
      item('bs11-089:refill-1'),
      item('bs11-089:refill-2'),
      item('bs11-089:refill-3'),
      item('bs11-089:refill-4'),
    ]
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          hand: [source],
          battleArea: [],
          supportArea: [],
          deck: [...hpCards, millCard],
          discardPile: [refreshCookie, ...refillCards],
        },
      },
    }

    let current = deployCookie(state, source.instanceId)
    expect(canActivateCookieSkill(
      current,
      'player-two',
      source.instanceId,
      'on-play',
    )).toBe(true)
    current = applyGameCommand(current, {
      kind: 'begin-activate-skill',
      playerId: 'player-two',
      sourceInstanceId: source.instanceId,
      trigger: 'on-play',
      paymentIds: [],
    })
    expect(current.pendingRefresh).toMatchObject({
      playerId: 'player-two',
      remainingDeckToTrash: { effect: { amount: 2 }, movedCards: [millCard] },
    })
    expect(current.pendingAbilityEffect).toMatchObject({
      sourceInstanceId: source.instanceId,
      effectIndex: 0,
    })

    current = refreshDeck(
      current,
      'player-two',
      refreshCookie.instanceId,
      identityShuffle,
    )
    expect(current.pendingRefresh).toBeNull()
    expect(current.deckTrashResolution).toMatchObject({
      sourceInstanceId: source.instanceId,
      cards: [millCard, refillCards[0], refillCards[1]],
    })
    expect(current.players['player-two'].deck).toEqual([
      refillCards[2],
      refillCards[3],
      millCard,
    ])
    expect(current.players['player-two'].breakArea).toContainEqual(refreshCookie)
    expect(current.pendingAbilityEffect).toMatchObject({
      sourceInstanceId: source.instanceId,
      effectIndex: 0,
    })
  })

  it('resolves the Refresh-gated attack Then once per opponent Cookie, and skips it before Refresh', () => {
    const base = createBattleState()
    const source = candidate('BS11-089', 'attack')
    const secondTarget = cookie('bs11-089:second-target', 2, 2)
    if (source.type !== 'cookie' || !source.attackEffects) {
      throw new Error('BS11-089 attack mapping missing')
    }

    const targetOne = cookieEntry(
      base.players['player-one'].battleArea[0]!.card,
      [item('bs11-089:target-one-hp-1'), item('bs11-089:target-one-hp-2'), item('bs11-089:target-one-hp-3')],
    )
    const targetTwo = cookieEntry(secondTarget, [
      item('bs11-089:target-two-hp-1'),
      item('bs11-089:target-two-hp-2'),
    ])
    const makeState = (refreshed: boolean): GameState => ({
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [targetOne, targetTwo],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [cookieEntry(source, [item('bs11-089:attacker-hp')])],
        },
      },
      refreshedDuringGame: refreshed ? { 'player-two': true } : undefined,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: source.instanceId,
        targetInstanceId: targetOne.card.instanceId,
        declaredDamage: 3,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: source.attackEffects!,
        attackEffectIndex: 0,
      },
    })

    let current = resolveAttackEffect(
      makeState(true),
      'player-two',
      [targetOne.card.instanceId, targetTwo.card.instanceId],
    )
    expect(current.pendingBattle?.effectDamageSequence).toBeDefined()
    while (current.pendingBattle?.effectDamageSequence) {
      current = applyGameCommand(current, {
        kind: 'resolve-next-damage',
        playerId: 'player-one',
      })
    }
    expect(current.players['player-one'].battleArea.map((entry) => entry.hpCards.length))
      .toEqual([2, 1])

    const before = makeState(false)
    const skipped = resolveAttackEffect(before, 'player-two', [])
    expect(skipped.players['player-one'].battleArea.map((entry) => entry.hpCards.length))
      .toEqual([3, 2])
  })
})

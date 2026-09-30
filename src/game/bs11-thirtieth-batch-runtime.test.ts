import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { executeCardEffect } from './effects/execute'
import { resolveInspectDeck } from './effects/pending'
import { createBattleState, cookie, item } from './test-helpers/battle-helpers'
import type { CookieCard, CookieInBattle, GameCard, GameState } from './types'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const findRecord = (cardNumber: string): OfficialCardRecord => {
  const card = records.find((candidate) => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  return card
}

const converted = (cardNumber: string, instanceId: string): GameCard => {
  const result = convertOfficialCardToGameCard(findRecord(cardNumber), instanceId)
  if (result.status !== 'converted') {
    throw new Error(`${cardNumber} did not convert: ${result.reason}`)
  }
  return { ...result.gameCard, instanceId }
}

const convertedCookie = (cardNumber: string, instanceId: string): CookieCard => {
  const card = converted(cardNumber, instanceId)
  if (card.type !== 'cookie') throw new Error(`${cardNumber} is not a Cookie`)
  return card
}

const entry = (card: CookieCard, hpCards: GameCard[]): CookieInBattle => ({
  card,
  hpCards,
  rested: false,
  battleEntryId: `${card.instanceId}:battle`,
})

const withPlayers = (
  state: GameState,
  playerOne: Partial<GameState['players']['player-one']>,
): GameState => ({
  ...state,
  activePlayerId: 'player-one',
  phase: 'main',
  players: {
    ...state.players,
    'player-one': {
      ...state.players['player-one'],
      ...playerOne,
    },
  },
})

describe('BS11-103 Skelecake Bomber runtime', () => {
  it('recovers only a Special Play Cookie when the On Play hand condition is met', () => {
    const source = convertedCookie('BS11-103', 'bs11-103-source')
    const specialPlay = convertedCookie('BS11-111', 'bs11-103-special-play')
    const state = withPlayers(createBattleState(), {
      hand: [source, item('bs11-103-hand-a'), item('bs11-103-hand-b'), item('bs11-103-hand-c'), item('bs11-103-hand-d')],
      deck: [item('bs11-103-hp-a'), item('bs11-103-hp-b'), item('bs11-103-deck-tail')],
      discardPile: [specialPlay, cookie('bs11-103-ordinary')],
    })

    const deployed = applyGameCommand(state, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: source.instanceId,
    })
    expect(deployed.pendingOnPlay).toMatchObject({
      playerId: 'player-one',
      sourceInstanceId: source.instanceId,
    })

    const resolved = applyGameCommand(deployed, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.instanceId,
      trigger: 'on-play',
      paymentIds: [],
      targetIds: [specialPlay.instanceId],
    })
    expect(resolved.players['player-one'].hand).toContainEqual(specialPlay)
    expect(resolved.players['player-one'].discardPile).not.toContainEqual(specialPlay)
  })

  it('does not recover when the post-deployment hand has six cards', () => {
    const source = convertedCookie('BS11-103', 'bs11-103-source-invalid')
    const specialPlay = convertedCookie('BS11-111', 'bs11-103-special-invalid')
    const state = withPlayers(createBattleState(), {
      hand: [
        source,
        ...Array.from({ length: 6 }, (_, index) => item(`bs11-103-invalid-hand-${index}`)),
      ],
      deck: [item('bs11-103-invalid-hp-a'), item('bs11-103-invalid-hp-b')],
      discardPile: [specialPlay],
    })

    const deployed = applyGameCommand(state, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: source.instanceId,
    })
    const effect = source.skill?.effects[0]
    if (!effect) throw new Error('BS11-103 should have an On Play effect')
    expect(() => executeCardEffect(
      deployed,
      { sourcePlayerId: 'player-one', sourceInstanceId: source.instanceId },
      effect,
      [],
    )).toThrow('尚未滿足卡牌效果的發動條件')
    expect(deployed.players['player-one'].hand).not.toContainEqual(specialPlay)
    expect(deployed.players['player-one'].discardPile).toContainEqual(specialPlay)
  })
})

describe('BS11-104 Cake Witch faint runtime', () => {
  it('opens a black-card inspect after faint and rejects a non-black pick', () => {
    const cakeWitch = convertedCookie('BS11-104', 'bs11-104-cake-witch')
    const blackCard = item('bs11-104-black-card', 'black')
    const redCard = item('bs11-104-red-card', 'red')
    const blueCard = item('bs11-104-blue-card', 'blue')
    const state = withPlayers(createBattleState(), {
      battleArea: [entry(cakeWitch, [item('bs11-104-hp')])],
      deck: [blackCard, redCard, blueCard, item('bs11-104-deck-tail')],
      hand: [item('bs11-104-hand')],
    })

    const damaged = executeCardEffect(
      state,
      { sourcePlayerId: 'player-two', sourceInstanceId: 'attacker' },
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 1, max: 1 },
      },
      [cakeWitch.instanceId],
    )
    expect(damaged.pendingFaintEffects?.[0]).toMatchObject({
      sourceInstanceId: cakeWitch.instanceId,
      effect: {
        kind: 'inspect-deck',
        filterColor: 'black',
      },
    })

    const inspected = applyGameCommand(damaged, {
      kind: 'resolve-faint-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    const pending = inspected.pendingInspectDeck!
    expect(pending).toMatchObject({
      lookCount: 3,
      pickCount: 1,
      filterColor: 'black',
      optionalPick: true,
      restDestination: 'trash',
    })
    const revealedIds = pending.revealedCards.map((card) => card.instanceId)
    const redId = redCard.instanceId
    expect(() => resolveInspectDeck(
      inspected,
      'player-one',
      [redId],
      revealedIds.filter((id) => id !== redId),
    )).toThrow('只能選擇顏色為 black')

    const restOrder = revealedIds.filter((id) => id !== blackCard.instanceId)
    const resolved = resolveInspectDeck(
      inspected,
      'player-one',
      [blackCard.instanceId],
      restOrder,
    )
    expect(resolved.pendingInspectDeck).toBeNull()
    expect(resolved.players['player-one'].hand).toContainEqual(blackCard)
    expect(resolved.players['player-one'].discardPile.map((card) => card.instanceId)).toEqual(
      expect.arrayContaining([redCard.instanceId, blueCard.instanceId]),
    )
  })
})

describe('BS11-109 Emblem of Darkness runtime', () => {
  it('pays 1K and selects only a Special Play Cookie from five viewed cards', () => {
    const emblem = converted('BS11-109', 'bs11-109-emblem')
    const specialPlay = convertedCookie('BS11-111', 'bs11-109-special-play')
    const ordinaryCookie = cookie('bs11-109-ordinary-cookie')
    const blackItem = item('bs11-109-black-item', 'black')
    const redItem = item('bs11-109-red-item', 'red')
    const blueItem = item('bs11-109-blue-item', 'blue')
    const payment = item('bs11-109-payment', 'black')
    const state = withPlayers(createBattleState(), {
      hand: [emblem],
      supportArea: [{ card: payment, rested: false }],
      deck: [ordinaryCookie, specialPlay, blackItem, redItem, blueItem],
    })

    const paid = applyGameCommand(state, {
      kind: 'begin-play-item',
      playerId: 'player-one',
      instanceId: emblem.instanceId,
      paymentIds: [payment.instanceId],
    })
    expect(paid.players['player-one'].supportArea[0]?.rested).toBe(true)
    expect(paid.pendingAbilityEffect).toBeDefined()

    const inspected = applyGameCommand(paid, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    const pending = inspected.pendingInspectDeck!
    expect(pending).toMatchObject({
      lookCount: 5,
      pickCount: 1,
      filterType: 'cookie',
      filterHasSpecialPlay: true,
      optionalPick: true,
      restDestination: 'trash',
    })
    const revealedIds = pending.revealedCards.map((card) => card.instanceId)
    expect(() => resolveInspectDeck(
      inspected,
      'player-one',
      [ordinaryCookie.instanceId],
      revealedIds.filter((id) => id !== ordinaryCookie.instanceId),
    )).toThrow('必須具有 Special Play')

    const resolved = resolveInspectDeck(
      inspected,
      'player-one',
      [specialPlay.instanceId],
      revealedIds.filter((id) => id !== specialPlay.instanceId),
    )
    expect(resolved.pendingInspectDeck).toBeNull()
    expect(resolved.players['player-one'].hand).toContainEqual(specialPlay)
    expect(resolved.players['player-one'].discardPile.map((card) => card.instanceId)).toEqual(
      expect.arrayContaining([
        emblem.instanceId,
        ordinaryCookie.instanceId,
        blackItem.instanceId,
        redItem.instanceId,
        blueItem.instanceId,
      ]),
    )
  })
})

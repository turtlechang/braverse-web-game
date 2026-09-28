import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialCardToExtraDeckCard,
  convertOfficialCardToGameCard,
} from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { refreshDeck } from './refresh'
import { isExtraDeckPlayRequirementMet } from './extra-deck'
import { createBattleState, cookie, item } from './test-helpers/battle-helpers'
import type {
  CookieCard,
  CookieInBattle,
  ExtraDeckCard,
  GameCard,
  GameState,
} from './types'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const findRecord = (cardNumber: string): OfficialCardRecord => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  return record
}

const whiteLily = (): CookieCard => {
  const result = convertOfficialCardToGameCard(
    findRecord('BS11-090'),
    'bs11-twenty-third-runtime-source',
  )
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') {
    throw new Error('BS11-090 must convert to a Cookie')
  }
  return { ...result.gameCard, instanceId: 'BS11-090:source' }
}

const avatarOfDestiny = (): ExtraDeckCard => {
  const result = convertOfficialCardToExtraDeckCard(
    findRecord('BS11-091'),
    'bs11-twenty-third-runtime-extra',
  )
  if (result.status !== 'converted') {
    throw new Error(`BS11-091: ${result.reason}`)
  }
  return { ...result.extraDeckCard, instanceId: 'BS11-091:extra' }
}

const entry = (card: CookieCard, hpCards: GameCard[]): CookieInBattle => ({
  card,
  hpCards,
  rested: false,
  battleEntryId: `${card.instanceId}:battle`,
})

const makeState = (
  deck: GameCard[],
  discardPile: GameCard[] = [],
): GameState => {
  const base = createBattleState()
  const source = whiteLily()
  const extra = avatarOfDestiny()
  return {
    ...base,
    extraDeckPlayUsedThisTurn: false,
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        hand: [],
        breakArea: [],
      },
      'player-two': {
        ...base.players['player-two'],
        hand: [],
        battleArea: [entry(source, Array.from({ length: 6 }, (_, index) => item(`bs11-090:hp-${index}`)))],
        supportArea: [],
        deck,
        extraDeck: [extra],
        breakArea: [],
        discardPile,
      },
    },
  }
}

const activateWhiteLily = (state: GameState): GameState => {
  let current = applyGameCommand(state, {
    kind: 'begin-activate-skill',
    playerId: 'player-two',
    sourceInstanceId: 'BS11-090:source',
    trigger: 'activate',
    paymentIds: [],
  })
  expect(current.players['player-two'].battleArea).toEqual([])
  expect(current.players['player-two'].breakArea.map((card) => card.instanceId))
    .toContain('BS11-090:source')
  expect(current.pendingAbilityEffect).toMatchObject({ effectIndex: 0 })

  current = applyGameCommand(current, {
    kind: 'resolve-ability-effect',
    playerId: 'player-two',
    targetIds: [],
  })
  expect(current.pendingExtraDeckAttack).toMatchObject({
    resolution: 'play',
    sourceInstanceId: 'BS11-090:source',
    cardName: 'Avatar of Destiny',
    candidateIds: ['BS11-091:extra'],
    extraHp: 3,
    ignorePlayRequirements: true,
  })
  expect(isExtraDeckPlayRequirementMet(
    current,
    'player-two',
    current.players['player-two'].extraDeck![0]!,
  )).toBe(false)
  return current
}

describe('BS11-090 White Lily Cookie runtime', () => {
  it('faints itself, opens direct EXTRA play, and gives Avatar of Destiny +3 HP', () => {
    const current = activateWhiteLily(
      makeState(Array.from({ length: 9 }, (_, index) => item(`bs11-090:deck-${index}`))),
    )
    const resolved = applyGameCommand(current, {
      kind: 'resolve-extra-deck-attack',
      playerId: 'player-two',
      extraDeckInstanceId: 'BS11-091:extra',
    })
    const player = resolved.players['player-two']
    const deployed = player.battleArea.find(
      (cookie) => cookie.card.instanceId === 'BS11-091:extra',
    )

    expect(deployed?.card).toMatchObject({
      name: 'Avatar of Destiny',
      extraDeckOrigin: 'extra',
    })
    expect(deployed?.hpCards).toHaveLength(8)
    expect(player.deck).toHaveLength(1)
    expect(player.extraDeck).toEqual([])
    expect(resolved.pendingExtraDeckAttack).toBeNull()
    expect(resolved.pendingAbilityEffect).toBeUndefined()
    expect(resolved.extraDeckPlayUsedThisTurn).toBe(true)
  })

  it('keeps the +3 HP setup through Refresh when the deck ends after entry', () => {
    const refreshCookie = cookie('bs11-090:refresh-cookie', 1, 1)
    const current = activateWhiteLily(
      makeState(
        Array.from({ length: 8 }, (_, index) => item(`bs11-090:short-deck-${index}`)),
        [refreshCookie, item('bs11-090:refill')],
      ),
    )
    const pendingRefresh = applyGameCommand(current, {
      kind: 'resolve-extra-deck-attack',
      playerId: 'player-two',
      extraDeckInstanceId: 'BS11-091:extra',
    })
    expect(pendingRefresh.pendingRefresh).toMatchObject({
      playerId: 'player-two',
    })
    expect(pendingRefresh.players['player-two'].battleArea[0]?.hpCards)
      .toHaveLength(8)

    const refreshed = refreshDeck(
      pendingRefresh,
      'player-two',
      refreshCookie.instanceId,
      (cards) => cards,
    )
    expect(refreshed.pendingRefresh).toBeNull()
    expect(refreshed.players['player-two'].deck.map((card) => card.instanceId))
      .toEqual([
        'bs11-090:refill',
        'bs11-090:hp-0',
        'bs11-090:hp-1',
        'bs11-090:hp-2',
        'bs11-090:hp-3',
        'bs11-090:hp-4',
        'bs11-090:hp-5',
      ])
    expect(refreshed.players['player-two'].battleArea[0]?.hpCards)
      .toHaveLength(8)
  })
})

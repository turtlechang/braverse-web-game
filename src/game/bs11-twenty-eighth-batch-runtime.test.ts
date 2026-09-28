import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialCardToExtraDeckCard,
  convertOfficialCardToGameCard,
} from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { canPlayExtraDeckCookie, playExtraDeckCookie } from './actions'
import { isExtraDeckPlayRequirementMet } from './extra-deck'
import { isOpponentBattleMovementPrevented } from './effects/targeting'
import { createBattleState, cookie, item } from './test-helpers/battle-helpers'
import type {
  CookieCard,
  CookieInBattle,
  ExtraDeckCard,
  GameCard,
  GameState,
  StageCard,
} from './types'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const findRecord = (cardNumber: string): OfficialCardRecord => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  return record
}

const convertedCookie = (cardNumber: string, instanceId: string): CookieCard => {
  const result = convertOfficialCardToGameCard(
    findRecord(cardNumber),
    `bs11-twenty-eighth-${instanceId}`,
  )
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') {
    throw new Error(`${cardNumber} did not convert to a Cookie`)
  }
  return { ...result.gameCard, instanceId }
}

const convertedCastle = (): StageCard => {
  const result = convertOfficialCardToGameCard(
    findRecord('BS11-108'),
    'bs11-twenty-eighth-castle',
  )
  if (result.status !== 'converted' || result.gameCard.type !== 'stage') {
    throw new Error('BS11-108 did not convert to a Stage')
  }
  return { card: result.gameCard, rested: false }
}

const convertedExtra = (): ExtraDeckCard => {
  const result = convertOfficialCardToExtraDeckCard(
    findRecord('BS11-116'),
    'bs11-twenty-eighth-extra',
  )
  if (result.status !== 'converted') {
    throw new Error(`BS11-116 did not convert: ${result.reason}`)
  }
  return { ...result.extraDeckCard, instanceId: 'BS11-116:extra' }
}

const entry = (card: CookieCard, hpCards: GameCard[]): CookieInBattle => ({
  card,
  hpCards,
  rested: false,
  battleEntryId: `${card.instanceId}:battle`,
  enteredFrom: 'hand',
  enteredTurn: 2,
})

const breakCookie = (instanceId: string, level: number): CookieCard => ({
  ...cookie(instanceId, 1, 1),
  level,
})

const makeState = (options: {
  withStage?: boolean
  breakLevels?: number[]
  withSpecialPlay?: boolean
} = {}): GameState => {
  const base = createBattleState()
  const target = convertedCookie('BS11-115', 'BS11-115:target')
  const targetCard = options.withSpecialPlay === false
    ? {
        ...target,
        skill: target.skill
          ? { ...target.skill, specialPlayCost: undefined }
          : undefined,
      }
    : target
  const targetEntry = entry(targetCard, [
    item('bs11-116:existing-hp-1'),
    item('bs11-116:existing-hp-2'),
    item('bs11-116:existing-hp-3'),
  ])
  return {
    ...base,
    activePlayerId: 'player-two',
    phase: 'main',
    extraDeckPlayUsedThisTurn: false,
    players: {
      ...base.players,
      'player-two': {
        ...base.players['player-two'],
        deck: [
          item('bs11-116:awaken-hp-1'),
          item('bs11-116:awaken-hp-2'),
          item('bs11-116:deck-tail'),
        ],
        battleArea: [targetEntry],
        breakArea: (options.breakLevels ?? [4, 3]).map((level, index) =>
          breakCookie(`bs11-116:break-${index}`, level),
        ),
        stage: options.withStage === false ? null : convertedCastle(),
        extraDeck: [convertedExtra()],
      },
    },
  }
}

describe('BS11-116 Dark Enchantress Awaken runtime', () => {
  it('requires break LV.7, the named Stage, and a same-turn Special Play target', () => {
    const valid = makeState()
    const extra = valid.players['player-two'].extraDeck![0]!

    expect(isExtraDeckPlayRequirementMet(valid, 'player-two', extra)).toBe(true)
    expect(canPlayExtraDeckCookie(valid, 'player-two', extra.instanceId)).toBe(true)

    expect(isExtraDeckPlayRequirementMet(
      makeState({ withStage: false }),
      'player-two',
      extra,
    )).toBe(false)
    expect(isExtraDeckPlayRequirementMet(
      makeState({ breakLevels: [3, 3] }),
      'player-two',
      extra,
    )).toBe(false)
    expect(canPlayExtraDeckCookie(
      makeState({ withSpecialPlay: false }),
      'player-two',
      extra.instanceId,
    )).toBe(false)
  })

  it('overlays the LV.3 target, adds HP+2, and keeps movement protection active', () => {
    const state = makeState()
    const resolved = playExtraDeckCookie(
      state,
      'player-two',
      'BS11-116:extra',
    )
    const player = resolved.players['player-two']
    const awakened = player.battleArea[0]!

    expect(player.extraDeck).toEqual([])
    expect(awakened.card).toMatchObject({
      id: 'BS11-116',
      instanceId: 'BS11-116:extra',
      extraDeckOrigin: 'awakened',
      awakenHpBonus: 2,
      skill: {
        trigger: 'passive',
        passiveEffects: [{
          kind: 'prevent-opponent-battle-movement',
          sourceOnly: true,
        }],
      },
    })
    expect(awakened.hpCards.map((card) => card.instanceId)).toEqual([
      'bs11-116:existing-hp-1',
      'bs11-116:existing-hp-2',
      'bs11-116:existing-hp-3',
      'bs11-116:awaken-hp-1',
      'bs11-116:awaken-hp-2',
    ])
    expect(awakened.awakenedUnderlay?.map((card) => card.instanceId)).toEqual([
      'BS11-115:target',
    ])
    expect(resolved.extraDeckPlayUsedThisTurn).toBe(true)
    expect(isOpponentBattleMovementPrevented(
      resolved,
      'player-one',
      'BS11-116:extra',
    )).toBe(true)
    expect(isOpponentBattleMovementPrevented(
      resolved,
      'player-two',
      'BS11-116:extra',
    )).toBe(false)
  })
})

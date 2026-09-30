import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { deployCookie } from './actions'
import { applyGameCommand } from './commands'
import { executeCardEffect } from './effects/execute'
import { canActivateCookieSkill } from './skills'
import { createBattleState, cookie, item } from './test-helpers/battle-helpers'
import type { CardSkill, CookieCard, CookieInBattle, GameCard, GameState } from './types'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const candidate = (cardNumber: string): CookieCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  const result = convertOfficialCardToGameCard(record, `bs11-twenty-fifth-${cardNumber}`)
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') {
    throw new Error(`${cardNumber} did not convert to a Cookie`)
  }
  return { ...result.gameCard, instanceId: `${cardNumber}:source` }
}

const entry = (card: CookieCard, hpCards: GameCard[]): CookieInBattle => ({
  card,
  hpCards,
  rested: false,
  battleEntryId: `${card.instanceId}:battle`,
})

const blackLevelOneCookie = (instanceId: string): CookieCard => ({
  ...cookie(instanceId, 1, 2),
  energyColor: 'black',
})

const makeSpecialPlayState = (
  source: CookieCard,
  hand: GameCard[] = [],
  discardPile: GameCard[] = [],
): { state: GameState; sacrifice: CookieCard } => {
  const base = createBattleState()
  const sacrifice = blackLevelOneCookie(`${source.instanceId}:special-cost`)
  return {
    state: {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          hand: [source, ...hand],
          battleArea: [entry(sacrifice, [item(`${sacrifice.instanceId}:hp-1`), item(`${sacrifice.instanceId}:hp-2`)] )],
          deck: Array.from({ length: 10 }, (_, index) => item(`${source.instanceId}:deck-${index}`)),
          discardPile,
        },
      },
    },
    sacrifice,
  }
}

const resolveOnPlay = (
  state: GameState,
  source: CookieCard,
  discardHandIds: string[] = [],
): GameState => applyGameCommand(state, {
  kind: 'begin-activate-skill',
  playerId: 'player-two',
  sourceInstanceId: source.instanceId,
  trigger: 'on-play',
  paymentIds: [],
  discardHandIds,
})

describe('BS11-111～113 Special Play runtime', () => {
  it('Mold Dough Cookie pays the shared black LV.1 Special Play cost and resolves On Play damage', () => {
    const source = candidate('BS11-111')
    const { state, sacrifice } = makeSpecialPlayState(
      source,
      [item('bs11-111:discard-cost')],
    )

    let current = deployCookie(state, source.instanceId, sacrifice.instanceId)
    expect(current.players['player-two'].battleArea.map((entry) => entry.card.instanceId))
      .toContain(source.instanceId)
    expect(current.players['player-two'].discardPile.map((card) => card.instanceId))
      .toContain(sacrifice.instanceId)

    current = resolveOnPlay(current, source, ['bs11-111:discard-cost'])
    expect(current.pendingAbilityEffect).toMatchObject({ effectIndex: 0 })

    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: ['defender'],
    })
    expect(current.players['player-one'].battleArea[0]?.hpCards).toHaveLength(2)
    expect(current.players['player-two'].hand.map((card) => card.instanceId))
      .not.toContain('bs11-111:discard-cost')
  })

  it('Pom-pom Dough Cookie recovers a black Cookie only while the hand condition is met', () => {
    const source = candidate('BS11-112')
    const recoverable = blackLevelOneCookie('bs11-112:recoverable')
    const { state, sacrifice } = makeSpecialPlayState(
      source,
      [item('bs11-112:hand-1'), item('bs11-112:hand-2'), item('bs11-112:hand-3')],
      [recoverable],
    )

    let current = deployCookie(state, source.instanceId, sacrifice.instanceId)
    current = resolveOnPlay(current, source)
    expect(current.pendingAbilityEffect).toMatchObject({ effectIndex: 0 })

    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: [recoverable.instanceId],
    })
    expect(current.players['player-two'].hand.map((card) => card.instanceId))
      .toContain(recoverable.instanceId)
    expect(current.players['player-two'].discardPile.map((card) => card.instanceId))
      .not.toContain(recoverable.instanceId)
  })

  it('Venom Dough Cookie draws up to two cards while the hand condition is met', () => {
    const source = candidate('BS11-113')
    const { state, sacrifice } = makeSpecialPlayState(
      source,
      [item('bs11-113:hand-1'), item('bs11-113:hand-2')],
    )

    let current = deployCookie(state, source.instanceId, sacrifice.instanceId)
    current = resolveOnPlay(current, source)
    expect(current.pendingAbilityEffect).toMatchObject({ effectIndex: 0 })

    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: [],
    })
    expect(current.pendingDrawUpTo).toMatchObject({ max: 2 })

    current = applyGameCommand(current, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-two',
      drawCount: 2,
    })
    expect(current.pendingDrawUpTo).toBeNull()
    expect(current.players['player-two'].hand.map((card) => card.instanceId))
      .toEqual(expect.arrayContaining(['bs11-113:hand-1', 'bs11-113:hand-2']))
  })
})

describe('BS11-112 level-restricted On Play lock', () => {
  const onPlaySkill: CardSkill = {
    trigger: 'on-play',
    oncePerTurn: false,
    yourTurn: false,
    restSource: false,
    cost: { energy: {}, discardHand: 0 },
    text: 'On Play test skill',
    effects: [],
  }

  const stateWithPendingOnPlay = (level: number): GameState => {
    const base = createBattleState()
    const source: CookieCard = {
      ...cookie(`on-play-level-${level}`, 1, 2),
      level,
      skill: onPlaySkill,
    }
    return {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          battleArea: [entry(source, [item(`${source.instanceId}:hp-1`), item(`${source.instanceId}:hp-2`)] )],
        },
      },
      pendingOnPlay: {
        playerId: 'player-two',
        sourceInstanceId: source.instanceId,
        origin: 'hand',
      },
    }
  }

  it('locks LV.2 and higher Cookies while leaving LV.1 On Play available', () => {
    const locked = executeCardEffect(
      createBattleState(),
      { sourcePlayerId: 'player-one', sourceInstanceId: 'attacker' },
      { kind: 'prevent-opponent-on-play', duration: 'this-turn', minLevel: 2 },
      [],
    )
    expect(locked.onPlayDisabledMinLevelUntilTurn).toEqual({
      'player-two': { turn: locked.turnNumber, minLevel: 2 },
    })
    expect(canActivateCookieSkill(
      stateWithPendingOnPlay(1),
      'player-two',
      'on-play-level-1',
      'on-play',
    )).toBe(true)
    expect(canActivateCookieSkill(
      { ...stateWithPendingOnPlay(2), onPlayDisabledMinLevelUntilTurn: locked.onPlayDisabledMinLevelUntilTurn },
      'player-two',
      'on-play-level-2',
      'on-play',
    )).toBe(false)
  })
})

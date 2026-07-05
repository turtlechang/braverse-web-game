import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  getBreakToBattleCandidates,
  getTrapTargetCandidates,
  playTrap,
  getCardPoolEntry,
  createCard,
  type CookieCard,
  type GameCard,
  type GameState,
} from '.'
import { GameRuleError } from './errors'

const asMainPhase = (state: GameState): GameState => ({
  ...state,
  phase: 'main',
  activePlayerId: 'player-one',
})

const makeCookie = (
  overrides: Partial<CookieCard> & { instanceId: string },
): CookieCard => ({
  id: overrides.instanceId,
  name: overrides.instanceId,
  type: 'cookie',
  level: 1,
  hp: 2,
  attack: 1,
  attackCost: 0,
  ...overrides,
})

const yellowSupport = (id: string): GameCard => ({
  id,
  instanceId: id,
  name: id,
  type: 'item',
  energyColor: 'yellow',
})

describe('battle area capacity for break-to-battle', () => {
  it('offers no candidates once the battle area already holds 2 cookies', () => {
    const base = asMainPhase(createDemoGame())
    const breakCookie = makeCookie({ instanceId: 'break-cookie', energyColor: 'yellow' })
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            { card: makeCookie({ instanceId: 'a' }), hpCards: [], rested: false },
            { card: makeCookie({ instanceId: 'b' }), hpCards: [], rested: false },
          ],
          breakArea: [breakCookie],
        },
      },
    }

    const candidates = getBreakToBattleCandidates(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'source' },
      { exactLevel: 1, energyColor: 'yellow' },
    )
    expect(candidates).toHaveLength(0)
  })

  it('still offers the candidate when the battle area has room', () => {
    const base = asMainPhase(createDemoGame())
    const breakCookie = makeCookie({ instanceId: 'break-cookie', energyColor: 'yellow' })
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            { card: makeCookie({ instanceId: 'a' }), hpCards: [], rested: false },
          ],
          breakArea: [breakCookie],
        },
      },
    }

    const candidates = getBreakToBattleCandidates(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'source' },
      { exactLevel: 1, energyColor: 'yellow' },
    )
    expect(candidates).toHaveLength(1)
  })
})

describe('BS1-050 Broken Signpost redirect-attack', () => {
  it('excludes the currently-attacked cookie from redirect target candidates', () => {
    const pool = getCardPoolEntry('BS1-050')!
    const trapCard = createCard(pool, 'player-two', 1)
    const cookiePool = getCardPoolEntry('BS1-001')!
    const attackedCookie = createCard(cookiePool, 'player-two', 1) as CookieCard
    const otherCookie = createCard(cookiePool, 'player-two', 2) as CookieCard
    const attackerCookie = createCard(cookiePool, 'player-one', 1) as CookieCard

    const base = createDemoGame()
    const state: GameState = {
      ...base,
      pendingBattle: {
        attackerPlayerId: 'player-one',
        defenderPlayerId: 'player-two',
        attackerInstanceId: attackerCookie.instanceId,
        targetInstanceId: attackedCookie.instanceId,
        declaredDamage: 1,
        remainingDamage: 1,
        stage: 'trap',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [{ card: attackerCookie, hpCards: [], rested: false }],
        },
        'player-two': {
          ...base.players['player-two'],
          hand: [trapCard],
          battleArea: [
            { card: attackedCookie, hpCards: base.players['player-two'].deck.slice(0, 2), rested: false },
            { card: otherCookie, hpCards: base.players['player-two'].deck.slice(2, 4), rested: false },
          ],
          supportArea: [{ card: yellowSupport('y1'), rested: false }],
        },
      },
    }

    const candidates = getTrapTargetCandidates(state, 'player-two', trapCard.instanceId)
    expect(candidates.map((c) => c.card.instanceId)).toEqual([otherCookie.instanceId])

    const result = playTrap(state, 'player-two', {
      trapInstanceId: trapCard.instanceId,
      paymentIds: ['y1'],
      targetIds: [otherCookie.instanceId],
    })
    expect(result.pendingBattle?.targetInstanceId).toBe(otherCookie.instanceId)
  })

  it('rejects redirecting to the cookie already under attack', () => {
    const pool = getCardPoolEntry('BS1-050')!
    const trapCard = createCard(pool, 'player-two', 1)
    const cookiePool = getCardPoolEntry('BS1-001')!
    const attackedCookie = createCard(cookiePool, 'player-two', 1) as CookieCard
    const attackerCookie = createCard(cookiePool, 'player-one', 1) as CookieCard

    const base = createDemoGame()
    const state: GameState = {
      ...base,
      pendingBattle: {
        attackerPlayerId: 'player-one',
        defenderPlayerId: 'player-two',
        attackerInstanceId: attackerCookie.instanceId,
        targetInstanceId: attackedCookie.instanceId,
        declaredDamage: 1,
        remainingDamage: 1,
        stage: 'trap',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [{ card: attackerCookie, hpCards: [], rested: false }],
        },
        'player-two': {
          ...base.players['player-two'],
          hand: [trapCard],
          battleArea: [
            { card: attackedCookie, hpCards: base.players['player-two'].deck.slice(0, 2), rested: false },
          ],
          supportArea: [{ card: yellowSupport('y1'), rested: false }],
        },
      },
    }

    expect(getTrapTargetCandidates(state, 'player-two', trapCard.instanceId)).toHaveLength(0)
    expect(() =>
      playTrap(state, 'player-two', {
        trapInstanceId: trapCard.instanceId,
        paymentIds: ['y1'],
        targetIds: [attackedCookie.instanceId],
      }),
    ).toThrow(GameRuleError)
  })
})

describe('BS1-051 Super-Vita Jelly Bar gain-hp trap targeting', () => {
  it('lets the defender choose which of their own cookies gains +1 HP', () => {
    const pool = getCardPoolEntry('BS1-051')!
    const trapCard = createCard(pool, 'player-two', 1)
    const cookiePool = getCardPoolEntry('BS1-001')!
    const attackedCookie = createCard(cookiePool, 'player-two', 1) as CookieCard
    const otherCookie = createCard(cookiePool, 'player-two', 2) as CookieCard
    const attackerCookie = createCard(cookiePool, 'player-one', 1) as CookieCard

    const base = createDemoGame()
    const state: GameState = {
      ...base,
      pendingBattle: {
        attackerPlayerId: 'player-one',
        defenderPlayerId: 'player-two',
        attackerInstanceId: attackerCookie.instanceId,
        targetInstanceId: attackedCookie.instanceId,
        declaredDamage: 1,
        remainingDamage: 1,
        stage: 'trap',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [{ card: attackerCookie, hpCards: [], rested: false }],
        },
        'player-two': {
          ...base.players['player-two'],
          hand: [trapCard],
          battleArea: [
            { card: attackedCookie, hpCards: base.players['player-two'].deck.slice(0, 2), rested: false },
            { card: otherCookie, hpCards: base.players['player-two'].deck.slice(2, 3), rested: false },
          ],
          supportArea: [{ card: yellowSupport('y1'), rested: false }],
        },
      },
    }

    const candidates = getTrapTargetCandidates(state, 'player-two', trapCard.instanceId)
    expect(candidates.map((c) => c.card.instanceId).sort()).toEqual(
      [attackedCookie.instanceId, otherCookie.instanceId].sort(),
    )

    const result = playTrap(state, 'player-two', {
      trapInstanceId: trapCard.instanceId,
      paymentIds: ['y1'],
      targetIds: [otherCookie.instanceId],
    })

    const other = result.players['player-two'].battleArea.find(
      (c) => c.card.instanceId === otherCookie.instanceId,
    )
    const attacked = result.players['player-two'].battleArea.find(
      (c) => c.card.instanceId === attackedCookie.instanceId,
    )
    expect(other?.hpCards).toHaveLength(2)
    expect(attacked?.hpCards).toHaveLength(2)
  })
})

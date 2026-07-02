import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  executeCardEffect,
  getAfterDamageEffectCandidates,
  resolveBattleAutomatically,
  resolveNextAfterDamageEffect,
  type CookieCard,
  type EffectContext,
  type GameCard,
  type GameState,
} from '.'
import { item } from './test-helpers/battle-helpers'

const createMalaSauceCookie = (instanceId: string): CookieCard => ({
  id: 'BS1-006',
  instanceId,
  name: 'Mala Sauce Cookie',
  type: 'cookie',
  officialType: 'cookie',
  energyColor: 'red',
  level: 2,
  hp: 5,
  attack: 2,
  attackCost: 1,
  attackEnergyCost: { red: 1 },
  skill: {
    trigger: 'passive',
    oncePerTurn: true,
    yourTurn: false,
    restSource: false,
    cost: { energy: {}, discardHand: 0 },
    text: 'If this Cookie remains in the battle area after receiving damage, select up to 1 of your opponent\'s Cookies. That Cookie receives 1 damage.',
    afterDamage: true,
    effects: [
      {
        kind: 'damage',
        amount: 1,
        target: {
          side: 'opponent',
          min: 0,
          max: 1,
        },
      },
    ],
  },
})

const makeCookie = (
  instanceId: string,
  name: string,
  level: number,
  hp: number,
): CookieCard => ({
  id: `test-${instanceId}`,
  instanceId,
  name,
  type: 'cookie',
  officialType: 'cookie',
  energyColor: 'red',
  level,
  hp,
  attack: 1,
  attackCost: 0,
})

const createGameWithMalaSauce = (): GameState => {
  const base = createDemoGame()
  const malaCookie = createMalaSauceCookie('mala-1')
  const attackerCookie = makeCookie('attacker-1', 'Attacker Cookie', 1, 3)
  const opponentCookie1 = makeCookie('opponent-1', 'Opponent Cookie 1', 1, 3)
  const opponentCookie2 = makeCookie('opponent-2', 'Opponent Cookie 2', 1, 2)

  const malaHpCards: GameCard[] = Array.from({ length: 5 }, (_, i) =>
    item(`mala-hp-${i}`),
  )

  const attackerHpCards: GameCard[] = Array.from({ length: 3 }, (_, i) =>
    item(`attacker-hp-${i}`),
  )

  return {
    ...base,
    phase: 'main',
    activePlayerId: 'player-one',
    status: 'playing',
    pendingBattle: {
      attackerPlayerId: 'player-two',
      defenderPlayerId: 'player-one',
      attackerInstanceId: 'attacker-1',
      targetInstanceId: 'mala-1',
      declaredDamage: 1,
      remainingDamage: 1,
      stage: 'damage',
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
        battleArea: [{ card: malaCookie, hpCards: malaHpCards, rested: false }],
      },
      'player-two': {
        ...base.players['player-two'],
        battleArea: [
          { card: attackerCookie, hpCards: attackerHpCards, rested: false },
          {
            card: opponentCookie1,
            hpCards: [item('opp1-hp')],
            rested: false,
          },
          {
            card: opponentCookie2,
            hpCards: [item('opp2-hp')],
            rested: false,
          },
        ],
      },
    },
  }
}

describe('BS1-006 Mala Sauce Cookie after-damage trigger', () => {
  it('auto-resolves after-damage effect when cookie survives battle damage', () => {
    const state = createGameWithMalaSauce()
    const result = resolveBattleAutomatically(state)

    expect(result.pendingAfterDamageEffects).toBeFalsy()
    expect(result.pendingBattle).toBeFalsy()

    const damagedOpponent = result.players['player-two'].battleArea.find(
      (c) => c.hpCards.length < 3,
    )
    expect(damagedOpponent).toBeDefined()
    expect(damagedOpponent!.hpCards.length).toBe(2)
  })

  it('auto-resolves after-damage effect to damage an opponent cookie', () => {
    const state = createGameWithMalaSauce()
    const afterBattle = resolveBattleAutomatically(state)

    expect(afterBattle.pendingAfterDamageEffects).toBeFalsy()
    expect(afterBattle.pendingBattle).toBeFalsy()

    const damaged = afterBattle.players['player-two'].battleArea.find(
      (c) => c.hpCards.length < 3,
    )
    expect(damaged).toBeDefined()
    expect(damaged!.hpCards.length).toBe(2)
  })

  it('does not queue effect when cookie faints from damage', () => {
    const base = createDemoGame()
    const malaCookie = createMalaSauceCookie('mala-faint')

    const attackerCookie = makeCookie('attacker-faint', 'Attacker', 1, 3)

    const malaHpCards: GameCard[] = [item('mala-faint-hp')]

    const attackerHpCards: GameCard[] = Array.from({ length: 3 }, (_, i) =>
      item(`attacker-faint-hp-${i}`),
    )

    const state: GameState = {
      ...base,
      phase: 'main',
      activePlayerId: 'player-one',
      status: 'playing',
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: 'attacker-faint',
        targetInstanceId: 'mala-faint',
        declaredDamage: 1,
        remainingDamage: 1,
        stage: 'damage',
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
          battleArea: [
            { card: malaCookie, hpCards: malaHpCards, rested: false },
          ],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [
            { card: attackerCookie, hpCards: attackerHpCards, rested: false },
          ],
        },
      },
    }

    const result = resolveBattleAutomatically(state)

    expect(result.pendingAfterDamageEffects).toBeUndefined()
  })

  it('registers oncePerTurn use when after-damage effect is resolved', () => {
    const base = createDemoGame()
    const malaCookie = createMalaSauceCookie('mala-once')
    const opponentCookie = makeCookie('opp-once', 'Opponent', 1, 3)

    const malaHpCards: GameCard[] = Array.from({ length: 5 }, (_, i) =>
      item(`mala-once-hp-${i}`),
    )

    const state: GameState = {
      ...base,
      phase: 'main',
      activePlayerId: 'player-two',
      status: 'playing',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [{ card: malaCookie, hpCards: malaHpCards, rested: false }],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [
            { card: opponentCookie, hpCards: [item('opp-once-hp')], rested: false },
          ],
        },
      },
    }

    const context: EffectContext = {
      sourcePlayerId: 'player-two',
      sourceInstanceId: 'opp-once',
    }
    const dmgEffect = { kind: 'damage' as const, amount: 1, target: { side: 'opponent' as const, min: 1, max: 1 } }
    const afterDmgState = executeCardEffect(state, context, dmgEffect, ['mala-once'])

    expect(afterDmgState.pendingAfterDamageEffects).toBeDefined()
    expect(afterDmgState.pendingAfterDamageEffects!.length).toBe(1)

    const candidates = getAfterDamageEffectCandidates(afterDmgState)
    expect(candidates.length).toBeGreaterThan(0)

    const targetId = candidates[0].card.instanceId
    const resolved = resolveNextAfterDamageEffect(afterDmgState, [targetId])

    expect(resolved.pendingAfterDamageEffects).toBeUndefined()
    expect(resolved.skillUsesThisTurn).toContain('mala-once')

    const secondDmgResult = executeCardEffect(resolved, context, dmgEffect, ['mala-once'])
    expect(secondDmgResult.pendingAfterDamageEffects).toBeUndefined()
  })

  it('triggers after-damage from effect damage, not just battle damage', () => {
    const base = createDemoGame()
    const malaCookie = createMalaSauceCookie('mala-effect')
    const opponentCookie = makeCookie('opp-effect', 'Opponent', 1, 3)

    const malaHpCards: GameCard[] = Array.from({ length: 5 }, (_, i) =>
      item(`mala-eff-hp-${i}`),
    )

    const state: GameState = {
      ...base,
      phase: 'main',
      activePlayerId: 'player-two',
      status: 'playing',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [{ card: malaCookie, hpCards: malaHpCards, rested: false }],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [
            { card: opponentCookie, hpCards: [item('opp-eff-hp')], rested: false },
          ],
        },
      },
    }

    const context: EffectContext = {
      sourcePlayerId: 'player-two',
      sourceInstanceId: 'opp-effect',
    }
    const dmgEffect = { kind: 'damage' as const, amount: 1, target: { side: 'opponent' as const, min: 1, max: 1 } }

    const result = executeCardEffect(state, context, dmgEffect, ['mala-effect'])

    expect(result.pendingAfterDamageEffects).toBeDefined()
    expect(result.pendingAfterDamageEffects!.length).toBe(1)
    expect(result.pendingAfterDamageEffects![0].sourceInstanceId).toBe('mala-effect')
    expect(result.pendingAfterDamageEffects![0].sourcePlayerId).toBe('player-one')

    const damaged = result.players['player-one'].battleArea.find(
      (c) => c.card.instanceId === 'mala-effect',
    )
    expect(damaged).toBeDefined()
    expect(damaged!.hpCards.length).toBe(4)
  })

  it('detects afterDamage property in card adapter', async () => {
    const mod = await import('../cards/official-effect-adapter')
    const convertOfficialCookieSkill = mod.convertOfficialCookieSkill
    const card = {
      sourceId: 1,
      locale: 'en',
      cardNumber: 'BS1-006',
      baseCardNumber: 'BS1-006',
      variant: null,
      name: 'Mala Sauce Cookie',
      type: 'cookie' as const,
      officialType: 'Cookie',
      rarity: null,
      grade: null,
      level: 2,
      hp: 5,
      energyType: null,
      color: 'Red',
      skill: {
        name: null,
        text: '{ap} If this Cookie remains in the battle area after receiving damage, select up to 1 of your opponent\'s Cookies. That Cookie receives 1 damage.',
      },
      attackText: null,
      flipText: null,
      keywords: [],
      product: { id: null, title: null, category: null },
      restrictions: { banned: false, limited: false },
      flags: { enabled: true, hidden: false, extra: false },
      imageUrl: '',
      officialUpdatedAt: null,
      sourceUrl: '',
    }
    const result = convertOfficialCookieSkill(card)
    expect(result).toBeDefined()
    expect(result!.afterDamage).toBe(true)
  })
})

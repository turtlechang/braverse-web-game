import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  executeCardEffect,
  getEffectTargetCandidates,
  resolveOptionalCostAttack,
  type CookieCard,
  type GameCard,
  type GameState,
  type PendingBattle,
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
  level: 2,
  hp: 3,
  attack: 2,
  attackCost: 3,
  ...overrides,
})

describe('BS1-044 Bell Pepper Cookie', () => {
  it('does not gain +1 HP once its current HP is 4 or higher', () => {
    const base = createDemoGame()
    const highHpCookie = makeCookie({ instanceId: 'bell-pepper-high' })
    const hpCards: GameCard[] = Array.from({ length: 5 }, (_, i) => ({
      id: `hp-${i}`,
      instanceId: `hp-${i}`,
      name: `HP ${i}`,
      type: 'item',
    }))
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [{ card: highHpCookie, hpCards: hpCards.slice(0, 4), rested: false }],
        },
      },
    }

    expect(() =>
      executeCardEffect(
        state,
        {
          sourcePlayerId: 'player-one',
          sourceInstanceId: highHpCookie.instanceId,
        },
        {
          kind: 'gain-hp',
          amount: 1,
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          condition: { kind: 'source-hp-less-than', amount: 4 },
        },
        [],
      ),
    ).toThrow(GameRuleError)
  })

  it('gains +1 HP while its current HP is exactly 3 (HP 3 or below triggers)', () => {
    const base = createDemoGame()
    const hpCards: GameCard[] = Array.from({ length: 5 }, (_, i) => ({
      id: `hp-${i}`,
      instanceId: `hp-${i}`,
      name: `HP ${i}`,
      type: 'item',
    }))
    const fullHpCookie = makeCookie({ instanceId: 'bell-pepper-full' })
    const fullState: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            { card: fullHpCookie, hpCards: hpCards.slice(0, 3), rested: false },
          ],
        },
      },
    }

    const resolved = executeCardEffect(
      fullState,
      {
        sourcePlayerId: 'player-one',
        sourceInstanceId: fullHpCookie.instanceId,
      },
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'source-hp-less-than', amount: 4 },
      },
      [],
    )
    expect(resolved.players['player-one'].battleArea[0].hpCards).toHaveLength(4)
  })

  it('optional attack-then damage requires paying energy and can only hit the original attack target', () => {
    const base = asMainPhase(createDemoGame())
    const attacker = makeCookie({ instanceId: 'attacker', energyColor: 'yellow' })
    const originalTarget = makeCookie({ instanceId: 'original-target' })
    const otherOpponentCookie = makeCookie({ instanceId: 'other-cookie' })
    const yellowSupport: GameCard = {
      id: 'yellow-support-1',
      instanceId: 'yellow-support-1',
      name: 'Yellow Support 1',
      type: 'item',
      energyColor: 'yellow',
    }
    const yellowSupport2: GameCard = {
      id: 'yellow-support-2',
      instanceId: 'yellow-support-2',
      name: 'Yellow Support 2',
      type: 'item',
      energyColor: 'yellow',
    }

    const battle: PendingBattle = {
      attackerPlayerId: 'player-one',
      defenderPlayerId: 'player-two',
      attackerInstanceId: attacker.instanceId,
      targetInstanceId: originalTarget.instanceId,
      declaredDamage: 2,
      remainingDamage: 0,
      stage: 'attack-effect',
      trapUsed: false,
      revealedHpCard: null,
      preventKnockoutTargetIds: [],
      faintedColors: [],
      attackEffects: [
        {
          kind: 'optional-cost-attack',
          cost: { energy: { yellow: 2 }, discardHand: 0 },
          effects: [
            {
              kind: 'damage',
              amount: 3,
              target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
            },
          ],
          effectText: 'bonus damage',
        },
      ],
      attackEffectIndex: 0,
    }

    const state: GameState = {
      ...base,
      pendingOptionalCostAttack: {
        playerId: 'player-one',
        sourceInstanceId: attacker.instanceId,
        sourceCardName: attacker.name,
        cost: { energy: { yellow: 2 }, discardHand: 0 },
        effects: [
          {
            kind: 'damage',
            amount: 3,
            target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
          },
        ],
        effectText: 'bonus damage',
      },
      pendingBattle: battle,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [{ card: attacker, hpCards: [], rested: true }],
          supportArea: [
            { card: yellowSupport, rested: false },
            { card: yellowSupport2, rested: false },
          ],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [
            {
              card: originalTarget,
              hpCards: base.players['player-two'].deck.slice(0, 3),
              rested: false,
            },
            {
              card: otherOpponentCookie,
              hpCards: base.players['player-two'].deck.slice(3, 6),
              rested: false,
            },
          ],
        },
      },
    }

    // cannot redirect the bonus damage to a different opponent cookie
    expect(() =>
      resolveOptionalCostAttack(
        state,
        'player-one',
        'pay',
        [],
        [otherOpponentCookie.instanceId],
        [yellowSupport.instanceId, yellowSupport2.instanceId],
      ),
    ).toThrow(GameRuleError)

    // must actually pay the 2 yellow energy cost
    expect(() =>
      resolveOptionalCostAttack(
        state,
        'player-one',
        'pay',
        [],
        [originalTarget.instanceId],
        [],
      ),
    ).toThrow(GameRuleError)

    // correctly targeting the original attack target with full payment succeeds
    const resolved = resolveOptionalCostAttack(
      state,
      'player-one',
      'pay',
      [],
      [originalTarget.instanceId],
      [yellowSupport.instanceId, yellowSupport2.instanceId],
    )
    const damagedTarget = resolved.players['player-two'].battleArea.find(
      (cookie) => cookie.card.instanceId === originalTarget.instanceId,
    )
    expect(damagedTarget).toBeUndefined()
    expect(resolved.players['player-two'].breakArea).toContainEqual(
      originalTarget,
    )
    expect(
      resolved.players['player-one'].supportArea.every((s) => s.rested),
    ).toBe(true)
  })

  it('the bonus effect has no valid target once the original attack target has already fainted', () => {
    const base = asMainPhase(createDemoGame())
    const attacker = makeCookie({ instanceId: 'attacker', energyColor: 'yellow' })
    const replacementCookie = makeCookie({ instanceId: 'replacement-cookie' })

    const state: GameState = {
      ...base,
      pendingBattle: {
        attackerPlayerId: 'player-one',
        defenderPlayerId: 'player-two',
        attackerInstanceId: attacker.instanceId,
        targetInstanceId: 'already-fainted-cookie',
        declaredDamage: 2,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          battleArea: [
            {
              card: replacementCookie,
              hpCards: base.players['player-two'].deck.slice(0, 3),
              rested: false,
            },
          ],
        },
      },
    }

    const candidates = getEffectTargetCandidates(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: attacker.instanceId },
      { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
    )
    expect(candidates).toHaveLength(0)
  })
})

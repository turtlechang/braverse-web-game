import { describe, expect, it } from 'vitest'
import {
  getAttackDamageAgainst,
  applyGameCommand,
  getBreakToBattleCandidates,
  getEffectTargetCandidates,
  getEffectiveAttack,
  getForcedAttackTargetId,
  resolveNextDamage,
  type CardEffect,
  type GameCard,
  type GameState,
} from '.'
import {
  BS4_CONDITION_CARD_NUMBERS,
  createBlueActivateSkillDemoState,
  createBlueInspectDeckDemoState,
  createBlueOptionalCostAttackDemoState,
  createAiDiscardRevealDemoState,
  createBs3SpecialVictoryDemoState,
  createBreakToTrashDemoState,
  createCardCheckDemoState,
  createBs4ConditionDemoState,
  createReplacementChoiceDemoState,
  createSt5010OnPlayDemoState,
  createSupportToTrashSkillDemoState,
  createTrapResponseDemoState,
  isLocalhost,
  parseTestStateConfig,
} from './demo'
import { getTrapCandidates, resolveFlip } from './battle'
import { cookie } from './test-helpers/battle-helpers'
import { canActivateStage } from './card-abilities'
import { isEffectConditionMet } from './effects'
import { canActivateCookieSkill } from './skills'
import { isSpecialVictoryConditionMet } from './victory'

describe('isLocalhost', () => {
  it('allows localhost', () => {
    expect(isLocalhost('localhost')).toBe(true)
  })

  it('allows 127.0.0.1', () => {
    expect(isLocalhost('127.0.0.1')).toBe(true)
  })

  it('allows IPv6 localhost', () => {
    expect(isLocalhost('[::1]')).toBe(true)
  })

  it('rejects arbitrary hostname', () => {
    expect(isLocalhost('example.com')).toBe(false)
  })

  it('rejects production-like domain', () => {
    expect(isLocalhost('braverse.game')).toBe(false)
  })
})

describe('parseTestStateConfig', () => {
  it('returns lv1 config when localhost and test-state=break-to-trash-lv1', () => {
    const result = parseTestStateConfig('?test-state=break-to-trash-lv1', 'localhost')
    expect(result).toEqual({ kind: 'break-to-trash', level: 1 })
  })

  it('returns lv2 config when localhost and test-state=break-to-trash-lv2', () => {
    const result = parseTestStateConfig('?test-state=break-to-trash-lv2', '127.0.0.1')
    expect(result).toEqual({ kind: 'break-to-trash', level: 2 })
  })

  it('returns payable trap response config on localhost', () => {
    const result = parseTestStateConfig(
      '?test-state=trap-payable',
      'localhost',
    )
    expect(result).toEqual({ kind: 'trap-response', payable: true })
  })

  it('returns unpayable trap response config on localhost', () => {
    const result = parseTestStateConfig(
      '?test-state=trap-unpayable',
      'localhost',
    )
    expect(result).toEqual({ kind: 'trap-response', payable: false })
  })

  it('returns replacement choice config on localhost', () => {
    const result = parseTestStateConfig(
      '?test-state=replacement-choice',
      'localhost',
    )
    expect(result).toEqual({ kind: 'replacement-choice' })
  })

  it('returns support-to-trash skill config on localhost', () => {
    const result = parseTestStateConfig(
      '?test-state=st3-002-skill',
      'localhost',
    )
    expect(result).toEqual({ kind: 'support-to-trash-skill' })
  })

  it('returns ST5-010 OnPlay config on localhost', () => {
    const result = parseTestStateConfig(
      '?test-state=st5-010-on-play',
      'localhost',
    )
    expect(result).toEqual({ kind: 'st5-010-on-play' })
  })

  it('returns AI discard reveal config on localhost', () => {
    const result = parseTestStateConfig(
      '?test-state=ai-discard-reveal',
      'localhost',
    )
    expect(result).toEqual({ kind: 'ai-discard-reveal' })
  })

  it('returns null when localhost but unknown test-state', () => {
    const result = parseTestStateConfig('?test-state=foo', 'localhost')
    expect(result).toBeNull()
  })

  it('returns null when localhost but no test-state param', () => {
    const result = parseTestStateConfig('', 'localhost')
    expect(result).toBeNull()
  })

  it('returns null when non-localhost even with valid test-state', () => {
    const result = parseTestStateConfig('?test-state=break-to-trash-lv1', 'braverse.game')
    expect(result).toBeNull()
  })

  it('returns null when non-localhost even with valid test-state on example.com', () => {
    const result = parseTestStateConfig('?test-state=break-to-trash-lv2', 'example.com')
    expect(result).toBeNull()
  })

  it('returns null on arbitrary domain with unknown test-state', () => {
    const result = parseTestStateConfig('?test-state=foo', 'evil-site.com')
    expect(result).toBeNull()
  })
})

describe('createSupportToTrashSkillDemoState', () => {
  it('creates ST3-002 in battle with a support cost and opponent target', () => {
    const state = createSupportToTrashSkillDemoState()
    const player = state.players['player-one']
    const opponent = state.players['player-two']

    expect(state.phase).toBe('main')
    expect(player.battleArea[0].card.id).toBe('ST3-002')
    expect(player.supportArea).toHaveLength(2)
    expect(opponent.battleArea).toHaveLength(1)
    expect(opponent.supportArea).toHaveLength(2)
  })
})

describe('createSt5010OnPlayDemoState', () => {
  it('uses official Carol Cookie for a player replacement during the AI turn', () => {
    const state = createSt5010OnPlayDemoState()
    const player = state.players['player-one']
    const opponent = state.players['player-two']

    expect(state.activePlayerId).toBe('player-two')
    expect(state.phase).toBe('main')
    expect(state.pendingReplacement).toMatchObject({
      tasks: [{ playerId: 'player-one', remaining: 1 }],
    })
    expect(player.hand.map((card) => card.id)).toContain('ST5-010')
    expect(player.supportArea[0].card.energyColor).toBe('purple')
    expect(opponent.battleArea[0].hpCards).toHaveLength(2)
    expect(opponent.hand.some((card) => card.type === 'cookie')).toBe(true)
  })
})

describe('createAiDiscardRevealDemoState', () => {
  it('waits for AI to discard multiple cards for public confirmation', () => {
    const state = createAiDiscardRevealDemoState()

    expect(state.pendingOpponentHandDiscard).toMatchObject({
      playerId: 'player-two',
      count: 2,
    })
    expect(state.players['player-two'].hand).toHaveLength(2)
  })
})

describe('createReplacementChoiceDemoState', () => {
  it('creates a pending optional replacement with one legal Cookie', () => {
    const state = createReplacementChoiceDemoState()

    expect(state.pendingReplacement?.tasks[0]).toEqual({
      playerId: 'player-one',
      remaining: 1,
    })
    expect(state.players['player-one'].battleArea).toHaveLength(1)
    expect(
      state.players['player-one'].hand.filter(
        (card) => card.type === 'cookie',
      ),
    ).toHaveLength(1)
  })
})

describe('createBreakToTrashDemoState', () => {
  it('creates a main-phase game with ST2-008 in hand', () => {
    const state = createBreakToTrashDemoState(1)

    expect(state.status).toBe('playing')
    expect(state.phase).toBe('main')
    expect(state.activePlayerId).toBe('player-one')

    const p1 = state.players['player-one']
    expect(p1.hand.some((c) => c.id === 'ST2-008')).toBe(true)
    expect(p1.supportArea).toHaveLength(2)
    expect(p1.supportArea.every((s) => !s.rested)).toBe(true)
  })

  it('places a LV.1 cookie in break area for lv1 variant', () => {
    const state = createBreakToTrashDemoState(1)
    const p1 = state.players['player-one']

    expect(p1.breakArea).toHaveLength(1)
    expect(p1.breakArea[0].level).toBe(1)
  })

  it('places a LV.2 cookie in break area for lv2 variant', () => {
    const state = createBreakToTrashDemoState(2)
    const p1 = state.players['player-one']

    expect(p1.breakArea).toHaveLength(1)
    expect(p1.breakArea[0].level).toBe(2)
  })

  it('allows ST2-008 OnPlay activation with lv1 break area', () => {
    const state = createBreakToTrashDemoState(1)
    const p1 = state.players['player-one']
    const eclair = p1.hand.find((c) => c.id === 'ST2-008')!

    expect(eclair.skill).toBeDefined()
    expect(eclair.skill!.trigger).toBe('on-play')

    const context = {
      sourcePlayerId: 'player-one' as const,
      sourceInstanceId: eclair.instanceId,
    }
    const effect = eclair.skill!.effects[0]
    expect(isEffectConditionMet(state, context, effect)).toBe(true)
  })

  it('still allows ST2-008 OnPlay activation even with lv2 break area (no valid targets only)', () => {
    const state = createBreakToTrashDemoState(2)
    const p1 = state.players['player-one']
    const eclair = p1.hand.find((c) => c.id === 'ST2-008')!

    const context = {
      sourcePlayerId: 'player-one' as const,
      sourceInstanceId: eclair.instanceId,
    }
    const effect = eclair.skill!.effects[0]
    expect(isEffectConditionMet(state, context, effect)).toBe(true)
  })
})

describe('createTrapResponseDemoState', () => {
  it('creates a payable trap candidate for the response modal', () => {
    const state = createTrapResponseDemoState(true)
    expect(getTrapCandidates(state, 'player-one')).toHaveLength(1)
  })

  it('creates no trap candidates when support cannot pay the cost', () => {
    const state = createTrapResponseDemoState(false)
    expect(getTrapCandidates(state, 'player-one')).toEqual([])
  })
})

describe('createCardCheckDemoState', () => {
  it('keeps the generic FLIP scenario below the break-level defeat limit', () => {
    const state = createCardCheckDemoState('BS3-004')
    const breakLevel = state.players['player-one'].breakArea.reduce(
      (total, cookie) => total + cookie.level,
      0,
    )

    expect(breakLevel).toBe(9)

    const resolved = resolveFlip(state, 'player-one', { activate: true })

    expect(resolved.status).toBe('playing')
    expect(resolved.pendingBattle).toBeNull()
    expect(resolved.players['player-one'].hand).toHaveLength(5)
    expect(resolved.players['player-one'].discardPile).toContainEqual(
      expect.objectContaining({ id: 'BS3-004' }),
    )
  })

  it('prepares BS5 condition card-check fixtures for both target and Then paths', () => {
    const trap087 = createCardCheckDemoState('BS5-087')
    expect(
      trap087.players['player-one'].breakArea.reduce(
        (total, card) => total + card.level,
        0,
      ),
    ).toBeGreaterThanOrEqual(6)

    const trap109 = createCardCheckDemoState('BS5-109')
    expect(
      trap109.players['player-two'].battleArea.some(
        (entry) => entry.card.level === 1,
      ),
    ).toBe(true)

    const attack071 = createCardCheckDemoState('BS5-071')
    expect(attack071.players['player-one'].hand).toHaveLength(2)

    const attack098 = createCardCheckDemoState('BS5-098')
    expect(attack098.players['player-one'].battleArea[0].hpCards).toHaveLength(1)

    const attack094 = createCardCheckDemoState('BS5-094')
    expect(
      attack094.players['player-one'].discardPile.filter(
        (card) =>
          card.id.startsWith('BS5-094-purple-cookie-') &&
          card.type === 'cookie' &&
          card.energyColor === 'purple' &&
          !card.flip,
      ),
    ).toHaveLength(5)

    for (const cardNumber of ['BS5-085', 'BS5-097'] as const) {
      const state = createCardCheckDemoState(cardNumber)
      expect(state.pendingBattle?.faintedColors).toEqual(['yellow'])
    }
  })
})

const findCardInState = (state: ReturnType<typeof createBs4ConditionDemoState>, cardNumber: string): GameCard => {
  for (const player of Object.values(state.players)) {
    const zones: GameCard[] = [
      ...player.hand,
      ...player.breakArea,
      ...player.discardPile,
      ...player.battleArea.map((entry) => entry.card),
      ...player.supportArea.map((support) => support.card),
      ...(player.stage ? [player.stage.card] : []),
    ]
    const card = zones.find((candidate) => candidate.id === cardNumber)
    if (card) return card
  }
  throw new Error(`Missing ${cardNumber} in BS4 condition fixture`)
}

const collectConditionalEffects = (effects: CardEffect[]): CardEffect[] =>
  effects.flatMap((effect) => {
    const ownCondition =
      'condition' in effect && effect.condition ? [effect] : []
    const nested =
      effect.kind === 'optional-cost-attack'
        ? collectConditionalEffects(effect.effects)
        : []
    return [...ownCondition, ...nested]
  })

describe('BS4 condition fixtures', () => {
  it.each(BS4_CONDITION_CARD_NUMBERS)(
    '%s has explicit met and unmet test-state routes',
    (cardNumber) => {
      for (const conditionMet of [true, false]) {
        const state = createBs4ConditionDemoState(cardNumber, conditionMet)
        const parsed = parseTestStateConfig(
          `?test-state=bs4-condition:${cardNumber}:${conditionMet ? 'met' : 'unmet'}`,
          'localhost',
        )
        expect(parsed).toEqual({
          kind: 'bs4-condition',
          cardNumber,
          conditionMet,
        })

        const card = findCardInState(state, cardNumber)
        const effects = collectConditionalEffects([
          ...(card.skill?.effects ?? []),
          ...(card.type === 'cookie' ? card.attackEffects ?? [] : []),
          ...(card.item?.effects ?? []),
        ])
        const context = {
          sourcePlayerId: 'player-one' as const,
          sourceInstanceId: card.instanceId,
          attackTargetInstanceId: state.pendingBattle?.targetInstanceId,
        }
        expect(
          effects.map((effect) => isEffectConditionMet(state, context, effect)),
        ).toEqual(effects.map(() => conditionMet))

        if (cardNumber === 'BS4-012') {
          expect(getEffectiveAttack(state, card.instanceId)).toBe(
            conditionMet ? 5 : 3,
          )
        }
        if (cardNumber === 'BS4-014') {
          expect(
            getAttackDamageAgainst(
              state,
              state.pendingBattle!.attackerInstanceId,
              card.instanceId,
            ),
          ).toBe(conditionMet ? 0 : 1)
        }
        if (cardNumber === 'BS4-016') {
          const attackEffect =
            card.type === 'cookie' ? card.attackEffects?.[0] : undefined
          expect(attackEffect?.kind).toBe('damage')
          if (attackEffect?.kind === 'damage') {
            const targetCandidates = getEffectTargetCandidates(
              state,
              context,
              attackEffect.target,
            )
            expect(targetCandidates.length > 0).toBe(conditionMet)
          }
        }
        if (cardNumber === 'BS4-024') {
          expect(getForcedAttackTargetId(state, 'player-two')).toBe(
            conditionMet
              ? state.players['player-one'].battleArea[0].card.instanceId
              : undefined,
          )
        }
        if (cardNumber === 'BS4-040') {
          const reviveEffect = card.item?.effects[1]
          expect(reviveEffect?.kind).toBe('break-to-battle')
          if (reviveEffect?.kind === 'break-to-battle') {
            const reviveCandidates = getBreakToBattleCandidates(
              state,
              context,
              reviveEffect,
            )
            expect(reviveCandidates.length > 0).toBe(conditionMet)
          }
        }
      }
    },
  )

  it('BS4-011 met fixture exposes its draw and discard UI sequence after the faint', () => {
    const state = createBs4ConditionDemoState('BS4-011', true)

    expect(state.pendingAbilityEffect).toMatchObject({
      sourceCardName: 'Chili Pepper Cookie',
      effects: [{ kind: 'draw' }, { kind: 'discard-hand' }],
    })
  })

  it('BS4-005 card-check fixture keeps one HP card for its activation cost', () => {
    const state = createCardCheckDemoState('BS4-005')
    const source = state.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS4-005',
    )

    expect(source?.hpCards).toHaveLength(1)
  })

  it('BS4-005 card-check fixture starts its sequential damage after selecting both opponents', () => {
    const state = createCardCheckDemoState('BS4-005')
    const source = state.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS4-005',
    )
    expect(source).toBeDefined()

    const activated = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source!.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
      hpToTrashTargetIds: [source!.card.instanceId],
    })
    expect(
      activated.players['player-one'].battleArea.map(
        (entry) => entry.card.instanceId,
      ),
    ).not.toContain(source!.card.instanceId)
    const resolved = applyGameCommand(activated, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: state.players['player-two'].battleArea.map(
        (entry) => entry.card.instanceId,
      ),
    })

    expect(resolved.pendingBattle).toMatchObject({
      stage: 'damage',
      effectDamageSequence: {
        remainingTargetInstanceIds: [
          state.players['player-two'].battleArea[1].card.instanceId,
        ],
      },
    })

    // 支付最後一張來源 HP 會令火精靈昏厥，但已啟動的效果仍須依序
    // 結算兩個對手目標；來源離場不能讓第一個目標的傷害被略過。
    const afterFirstDamage = resolveNextDamage(resolved)
    expect(afterFirstDamage.players['player-two'].battleArea).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          card: expect.objectContaining({ instanceId: 'opp-lv1' }),
          hpCards: expect.arrayContaining([
            expect.objectContaining({ instanceId: 'opp-lv1-hp-0' }),
          ]),
        }),
      ]),
    )
    expect(
      afterFirstDamage.players['player-two'].battleArea.find(
        (entry) => entry.card.instanceId === 'opp-lv1',
      )?.hpCards,
    ).toHaveLength(5)
    expect(afterFirstDamage.pendingBattle).toMatchObject({
      stage: 'damage',
      targetInstanceId: 'opp-lv3',
    })

    const afterSecondDamage = resolveNextDamage(afterFirstDamage)
    expect(
      afterSecondDamage.players['player-two'].battleArea.find(
        (entry) => entry.card.instanceId === 'opp-lv3',
      )?.hpCards,
    ).toHaveLength(4)
    expect(afterSecondDamage.pendingBattle).toBeNull()
  })

  it('BS4-005 cost faint with an empty battle area queues replacement before the effect', () => {
    const base = createCardCheckDemoState('BS4-005')
    const source = base.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS4-005',
    )
    expect(source).toBeDefined()
    const replacementCookie = cookie('bs4-005-replacement', 2, 4)
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: base.players['player-one'].battleArea.filter(
            (entry) => entry.card.instanceId !== 'self-extra-1',
          ),
          hand: [replacementCookie, ...base.players['player-one'].hand],
        },
      },
    }

    const activated = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source!.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
      hpToTrashTargetIds: [source!.card.instanceId],
    })

    // 戰場清空：補位任務與效果佇列同時建立，但效果被強制補位擋下。
    expect(activated.players['player-one'].battleArea).toHaveLength(0)
    expect(activated.pendingReplacement).toMatchObject({
      tasks: [{ playerId: 'player-one', remaining: 1 }],
    })
    expect(activated.pendingAbilityEffect).toBeDefined()
    expect(() =>
      applyGameCommand(activated, {
        kind: 'resolve-ability-effect',
        playerId: 'player-one',
        targetIds: state.players['player-two'].battleArea.map(
          (entry) => entry.card.instanceId,
        ),
      }),
    ).toThrowError()

    // 補位完成後效果照常依序結算。
    const replaced = applyGameCommand(activated, {
      kind: 'replace-cookie',
      playerId: 'player-one',
      instanceId: replacementCookie.instanceId,
    })
    expect(replaced.pendingReplacement).toBeNull()
    expect(replaced.pendingOnPlay).toBeNull()
    const resolved = applyGameCommand(replaced, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: state.players['player-two'].battleArea.map(
        (entry) => entry.card.instanceId,
      ),
    })
    expect(resolved.pendingBattle).toMatchObject({
      stage: 'damage',
      effectDamageSequence: {
        remainingTargetInstanceIds: [
          state.players['player-two'].battleArea[1].card.instanceId,
        ],
      },
    })
  })

  it('BS4-005 cost faint with no cookies to replace loses before any damage', () => {
    const base = createCardCheckDemoState('BS4-005')
    const source = base.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS4-005',
    )
    expect(source).toBeDefined()
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: base.players['player-one'].battleArea.filter(
            (entry) => entry.card.instanceId !== 'self-extra-1',
          ),
          hand: [],
        },
      },
    }

    const activated = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source!.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
      hpToTrashTargetIds: [source!.card.instanceId],
    })

    expect(activated.status).toBe('finished')
    expect(activated.result).toMatchObject({
      loserId: 'player-one',
      reason: 'no-cookie-available',
    })
    expect(activated.pendingBattle).toBeNull()
    expect(activated.pendingAbilityEffect).toBeUndefined()
  })
})

describe('createBlueActivateSkillDemoState', () => {
  it('payable: ST4-012 in battle with hand cards ready to activate', () => {
    const state = createBlueActivateSkillDemoState(true)
    const p1 = state.players['player-one']
    expect(p1.battleArea[0].card.id).toBe('ST4-012')
    expect(p1.hand.length).toBeGreaterThanOrEqual(1)
    expect(state.phase).toBe('main')
    expect(canActivateCookieSkill(state, 'player-one', p1.battleArea[0].card.instanceId, 'activate')).toBe(true)
  })

  it('unpayable: empty hand returns false from canActivateCookieSkill', () => {
    const state = createBlueActivateSkillDemoState(false)
    const p1 = state.players['player-one']
    expect(p1.hand).toHaveLength(0)
    expect(canActivateCookieSkill(state, 'player-one', p1.battleArea[0].card.instanceId, 'activate')).toBe(false)
  })
})

describe('createBlueOptionalCostAttackDemoState', () => {
  it('payable: pendingBattle at attack-effect with optional-cost-attack', () => {
    const state = createBlueOptionalCostAttackDemoState(true)
    expect(state.pendingBattle).toBeDefined()
    expect(state.pendingBattle!.stage).toBe('attack-effect')
    expect(state.pendingBattle!.attackEffects[0].kind).toBe('optional-cost-attack')
    expect(state.players['player-one'].hand.length).toBeGreaterThanOrEqual(2)
    expect(
      state.players['player-one'].hand.some((card) => card.type === 'cookie'),
    ).toBe(true)
    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
  })

  it('unpayable: hand has less than 2 cards', () => {
    const state = createBlueOptionalCostAttackDemoState(false)
    expect(state.players['player-one'].hand.length).toBeLessThan(2)
  })
})

describe('createBlueInspectDeckDemoState', () => {
  it('has pendingInspectDeck with 3 revealed cards', () => {
    const state = createBlueInspectDeckDemoState()
    expect(state.pendingInspectDeck).toBeDefined()
    expect(state.pendingInspectDeck!.revealedCards).toHaveLength(3)
    expect(state.pendingInspectDeck!.lookCount).toBe(3)
    expect(state.pendingInspectDeck!.pickCount).toBe(1)
    expect(state.pendingInspectDeck!.playerId).toBe('player-one')
  })

  it('deck excludes revealed cards', () => {
    const state = createBlueInspectDeckDemoState()
    const deckIds = new Set(state.players['player-one'].deck.map((c) => c.instanceId))
    for (const c of state.pendingInspectDeck!.revealedCards) {
      expect(deckIds.has(c.instanceId)).toBe(false)
    }
  })
})

describe('parseTestStateConfig blue states', () => {
  it('blue-activate-payable', () => {
    expect(parseTestStateConfig('?test-state=blue-activate-payable', 'localhost')).toEqual({ kind: 'blue-activate-skill', payable: true })
  })
  it('blue-activate-unpayable', () => {
    expect(parseTestStateConfig('?test-state=blue-activate-unpayable', 'localhost')).toEqual({ kind: 'blue-activate-skill', payable: false })
  })
  it('blue-attack-payable', () => {
    expect(parseTestStateConfig('?test-state=blue-attack-payable', 'localhost')).toEqual({ kind: 'blue-optional-cost-attack', payable: true })
  })
  it('blue-attack-unpayable', () => {
    expect(parseTestStateConfig('?test-state=blue-attack-unpayable', 'localhost')).toEqual({ kind: 'blue-optional-cost-attack', payable: false })
  })
  it('blue-inspect-deck', () => {
    expect(parseTestStateConfig('?test-state=blue-inspect-deck', 'localhost')).toEqual({ kind: 'blue-inspect-deck' })
  })
})

describe('createBlueActivateSkillDemoState', () => {
  it('payable: Werewolf in battle with hand cards for discard cost', () => {
    const state = createBlueActivateSkillDemoState(true)
    const p1 = state.players['player-one']
    expect(state.phase).toBe('main')
    expect(state.activePlayerId).toBe('player-one')
    expect(p1.battleArea[0].card.id).toBe('ST4-012')
    expect(p1.hand.length).toBeGreaterThanOrEqual(1)
    expect(canActivateCookieSkill(state, 'player-one', p1.battleArea[0].card.instanceId, 'activate')).toBe(true)
  })
  it('unpayable: empty hand, activate skill returns false', () => {
    const state = createBlueActivateSkillDemoState(false)
    const p1 = state.players['player-one']
    expect(p1.hand).toHaveLength(0)
    expect(canActivateCookieSkill(state, 'player-one', p1.battleArea[0].card.instanceId, 'activate')).toBe(false)
  })
})

describe('createBlueOptionalCostAttackDemoState', () => {
  it('payable: attacker has 4 hand cards, pendingBattle at attack-effect', () => {
    const state = createBlueOptionalCostAttackDemoState(true)
    expect(state.pendingBattle).toBeDefined()
    expect(state.pendingBattle!.stage).toBe('attack-effect')
    expect(state.pendingBattle!.attackEffects[0].kind).toBe('optional-cost-attack')
    expect(state.players['player-one'].hand.length).toBeGreaterThanOrEqual(2)
  })
  it('unpayable: hand has less than 2 cards', () => {
    const state = createBlueOptionalCostAttackDemoState(false)
    expect(state.players['player-one'].hand.length).toBeLessThan(2)
  })
})

describe('createBlueInspectDeckDemoState', () => {
  it('pendingInspectDeck with 3 revealed cards', () => {
    const state = createBlueInspectDeckDemoState()
    expect(state.pendingInspectDeck).toBeDefined()
    expect(state.pendingInspectDeck!.revealedCards).toHaveLength(3)
    expect(state.pendingInspectDeck!.lookCount).toBe(3)
    expect(state.pendingInspectDeck!.pickCount).toBe(1)
    expect(state.pendingInspectDeck!.playerId).toBe('player-one')
  })
  it('deck does not contain revealed cards', () => {
    const state = createBlueInspectDeckDemoState()
    const deckIds = new Set(state.players['player-one'].deck.map((c) => c.instanceId))
    for (const revealed of state.pendingInspectDeck!.revealedCards) {
      expect(deckIds.has(revealed.instanceId)).toBe(false)
    }
  })
})

describe('parseTestStateConfig blue states', () => {
  it('returns blue-activate-skill payable', () => {
    const r = parseTestStateConfig('?test-state=blue-activate-payable', 'localhost')
    expect(r).toEqual({ kind: 'blue-activate-skill', payable: true })
  })
  it('returns blue-activate-skill unpayable', () => {
    const r = parseTestStateConfig('?test-state=blue-activate-unpayable', 'localhost')
    expect(r).toEqual({ kind: 'blue-activate-skill', payable: false })
  })
  it('returns blue-optional-cost-attack payable', () => {
    const r = parseTestStateConfig('?test-state=blue-attack-payable', 'localhost')
    expect(r).toEqual({ kind: 'blue-optional-cost-attack', payable: true })
  })
  it('returns blue-optional-cost-attack unpayable', () => {
    const r = parseTestStateConfig('?test-state=blue-attack-unpayable', 'localhost')
    expect(r).toEqual({ kind: 'blue-optional-cost-attack', payable: false })
  })
  it('returns blue-inspect-deck', () => {
    const r = parseTestStateConfig('?test-state=blue-inspect-deck', 'localhost')
    expect(r).toEqual({ kind: 'blue-inspect-deck' })
  })
  it('returns soul-jam-019-equipped', () => {
    const r = parseTestStateConfig('?test-state=soul-jam-019-equipped', 'localhost')
    expect(r).toEqual({ kind: 'soul-jam-019-equipped' })
  })
  it('returns soul-jam-043-equipped', () => {
    expect(parseTestStateConfig('?test-state=soul-jam-043-equipped', 'localhost')).toEqual({ kind: 'soul-jam-043-equipped' })
  })
  it('returns soul-jam-066-equipped', () => {
    expect(parseTestStateConfig('?test-state=soul-jam-066-equipped', 'localhost')).toEqual({ kind: 'soul-jam-066-equipped' })
  })
  it('returns soul-jam-091-equipped', () => {
    expect(parseTestStateConfig('?test-state=soul-jam-091-equipped', 'localhost')).toEqual({ kind: 'soul-jam-091-equipped' })
  })
  it('returns soul-jam-115-equipped', () => {
    expect(parseTestStateConfig('?test-state=soul-jam-115-equipped', 'localhost')).toEqual({ kind: 'soul-jam-115-equipped' })
  })
  it('returns soul-jam-115-protection-demo', () => {
    expect(parseTestStateConfig('?test-state=soul-jam-115-protection-demo', 'localhost')).toEqual({ kind: 'soul-jam-115-protection-demo' })
  })
  it('returns the BS3-121 special victory config', () => {
    expect(parseTestStateConfig('?test-state=bs3-121-special-victory', 'localhost')).toEqual({ kind: 'bs3-121-special-victory' })
  })
  it('returns null for non-localhost', () => {
    expect(parseTestStateConfig('?test-state=blue-inspect-deck', 'example.com')).toBeNull()
  })
})

describe('createBs3SpecialVictoryDemoState', () => {
  it('uses real BS3 cards and provides the exact victory requirements', () => {
    const state = createBs3SpecialVictoryDemoState()
    const player = state.players['player-one']
    const supportCards = player.supportArea.map(({ card }) => card)

    expect(player.stage?.card.id).toBe('BS3-121')
    expect(supportCards.filter((card) => card.keywords?.includes('ancient'))).toHaveLength(5)
    expect(supportCards.filter((card) => card.keywords?.includes('soul-jam'))).toHaveLength(5)
    expect(new Set(supportCards.map((card) => card.name)).size).toBe(10)
    const condition = player.stage?.card.stageAbility?.specialVictory
    expect(condition).toBeDefined()
    expect(isSpecialVictoryConditionMet(state, 'player-one', condition!)).toBe(true)
    expect(canActivateStage(state, 'player-one')).toBe(true)
  })
})

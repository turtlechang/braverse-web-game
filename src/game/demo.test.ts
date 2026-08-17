import { describe, expect, it } from 'vitest'
import {
  getAttackDamageAgainst,
  applyGameCommand,
  getBreakToBattleCandidates,
  getEffectTargetCandidates,
  getEffectiveAttack,
  getForcedAttackTargetId,
  resolveNextDamage,
  advancePhase,
  type CardEffect,
  type GameCard,
  type GameState,
} from '.'
import {
  P_CONDITION_CARD_NUMBERS,
  BS4_CONDITION_CARD_NUMBERS,
  createBlueActivateSkillDemoState,
  createBlueInspectDeckDemoState,
  createBlueOptionalCostAttackDemoState,
  createAiDiscardRevealDemoState,
  createBs2015CostDepartureDemoState,
  createBs3SilverbellConditionDemoState,
  createBs3SpecialVictoryDemoState,
  createBs5CroissantEndPhaseDemoState,
  createBs5FaintDemoState,
  createBs5FlipDemoState,
  createBs5ItemConditionDemoState,
  createBs5Item111DemoState,
  createBs5StageConditionDemoState,
  createBs5TrapDemoState,
  createBs6ConditionDemoState,
  createBreakToTrashDemoState,
  createCardCheckDemoState,
  createCardNegativeDemoState,
  createBs4077TimekeeperCostDemoState,
  createBs6008TrapDemoState,
  createBs6079OnPlayDemoState,
  createP082TrapDemoState,
  createPConditionDemoState,
  createP084ItemConditionDemoState,
  createP147SpecialPlayDemoState,
  createBs4ConditionDemoState,
  createBs4024TargetRestrictionDemoState,
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
import {
  getBreakToTrashCandidates,
  getTrashCookieCandidates,
  isEffectConditionMet,
} from './effects'
import { canActivateCookieSkill } from './skills'
import { isSpecialVictoryConditionMet } from './victory'
import pFormalDocument from '../../data/cards/official-p-0xx-remaining.en.json'
import type { OfficialCardRecord } from '../cards/types'

const pFormalRecords = pFormalDocument.cards as OfficialCardRecord[]

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

  it('parses both BS2-015 post-cost test-state routes on localhost', () => {
    expect(
      parseTestStateConfig('?test-state=bs2-015-cost:terminal', 'localhost'),
    ).toEqual({
      kind: 'bs2-015-cost',
      replacementAvailable: false,
    })
    expect(
      parseTestStateConfig('?test-state=bs2-015-cost:replacement', 'localhost'),
    ).toEqual({
      kind: 'bs2-015-cost',
      replacementAvailable: true,
    })
  })

  it('parses focused P-0XX payment and Special Play routes on localhost', () => {
    expect(parseTestStateConfig('?test-state=p082-trap:cookie', 'localhost')).toEqual({
      kind: 'p082-trap',
      payment: 'cookie',
    })
    expect(parseTestStateConfig('?test-state=p084-item:met', 'localhost')).toEqual({
      kind: 'p084-item-condition',
      conditionMet: true,
    })
    expect(parseTestStateConfig('?test-state=p147-special-play', 'localhost')).toEqual({
      kind: 'p147-special-play',
    })
  })

  it('parses BS5 focused A/B test-state routes only on localhost', () => {
    expect(parseTestStateConfig('?test-state=bs5-flip:BS5-009:activate', 'localhost')).toEqual({
      kind: 'bs5-flip',
      cardNumber: 'BS5-009',
      activate: true,
    })
    expect(parseTestStateConfig('?test-state=bs5-faint:BS5-007:unmet', 'localhost')).toEqual({
      kind: 'bs5-faint',
      cardNumber: 'BS5-007',
      conditionMet: false,
    })
    expect(parseTestStateConfig('?test-state=bs5-trap:BS5-087:met', 'localhost')).toEqual({
      kind: 'bs5-trap',
      cardNumber: 'BS5-087',
      conditionMet: true,
    })
    expect(parseTestStateConfig('?test-state=bs5-item:BS5-111:unmet', 'localhost')).toEqual({
      kind: 'bs5-item-111',
      conditionMet: false,
    })
    expect(parseTestStateConfig('?test-state=bs5-item:BS5-111:met', 'localhost')).toEqual({
      kind: 'bs5-item-111',
      conditionMet: true,
    })
    expect(parseTestStateConfig('?test-state=bs5-item:BS5-020:met', 'localhost')).toEqual({
      kind: 'bs5-item-condition',
      cardNumber: 'BS5-020',
      conditionMet: true,
    })
    expect(parseTestStateConfig('?test-state=bs5-stage:BS5-022:unmet', 'localhost')).toEqual({
      kind: 'bs5-stage-condition',
      cardNumber: 'BS5-022',
      conditionMet: false,
    })
    expect(parseTestStateConfig('?test-state=bs5-faint:BS4-011:met', 'localhost')).toBeNull()
  })

  it('parses the BS5-060 end-phase Browser A/B routes', () => {
    expect(
      parseTestStateConfig('?test-state=bs5-060-end-phase:rested', 'localhost'),
    ).toEqual({ kind: 'bs5-060-end-phase', supportState: 'rested' })
    expect(
      parseTestStateConfig('?test-state=bs5-060-end-phase:active', 'localhost'),
    ).toEqual({ kind: 'bs5-060-end-phase', supportState: 'active' })
  })

  it('parses BS6 candidate A/B test-state routes only on localhost', () => {
    expect(
      parseTestStateConfig('?test-state=bs6-condition:BS6-039:met', 'localhost'),
    ).toEqual({
      kind: 'bs6-condition',
      cardNumber: 'BS6-039',
      conditionMet: true,
    })
    expect(
      parseTestStateConfig('?test-state=bs6-condition:BS6-039:unmet', 'localhost'),
    ).toEqual({
      kind: 'bs6-condition',
      cardNumber: 'BS6-039',
      conditionMet: false,
    })
    expect(
      parseTestStateConfig('?test-state=bs6-condition:BS6-034:met', 'localhost'),
    ).toBeNull()
  })

  it('parses the BS4-024 target-restriction browser route only on localhost', () => {
    expect(
      parseTestStateConfig('?test-state=bs4-024-target-restriction', 'localhost'),
    ).toEqual({ kind: 'bs4-024-target-restriction' })
    expect(
      parseTestStateConfig('?test-state=bs4-024-target-restriction', 'example.com'),
    ).toBeNull()
  })

  it('parses the generic negative card-check route only on localhost', () => {
    expect(
      parseTestStateConfig('?test-state=card-negative:BS6-020', 'localhost'),
    ).toEqual({ kind: 'card-negative', cardNumber: 'BS6-020' })
    expect(
      parseTestStateConfig('?test-state=card-negative:BS6-020', 'example.com'),
    ).toBeNull()
  })

  it('parses the BS6-079 OnPlay A/B routes only on localhost', () => {
    expect(
      parseTestStateConfig('?test-state=bs6-079-on-play-clear', 'localhost'),
    ).toEqual({ kind: 'bs6-079-on-play', blocked: false })
    expect(
      parseTestStateConfig('?test-state=bs6-079-on-play-blocked', 'localhost'),
    ).toEqual({ kind: 'bs6-079-on-play', blocked: true })
    expect(
      parseTestStateConfig('?test-state=bs6-079-on-play-blocked', 'example.com'),
    ).toBeNull()
  })

  it('parses the BS6-008 Trap A/B routes only on localhost', () => {
    expect(
      parseTestStateConfig('?test-state=bs6-008-trap-blocked', 'localhost'),
    ).toEqual({ kind: 'bs6-008-trap', remainingHp: 4 })
    expect(
      parseTestStateConfig('?test-state=bs6-008-trap-open', 'localhost'),
    ).toEqual({ kind: 'bs6-008-trap', remainingHp: 5 })
    expect(
      parseTestStateConfig('?test-state=bs6-008-trap-blocked', 'example.com'),
    ).toBeNull()
  })

  it('parses the BS4-077 Timekeeper cost route only on localhost', () => {
    expect(
      parseTestStateConfig('?test-state=bs4-077-timekeeper-cost', 'localhost'),
    ).toEqual({ kind: 'bs4-077-timekeeper-cost' })
    expect(
      parseTestStateConfig('?test-state=bs4-077-timekeeper-cost', 'example.com'),
    ).toBeNull()
  })

  it('creates BS6-012 hand-count A/B fixtures for end-phase verification', () => {
    const met = createBs6ConditionDemoState('BS6-012', true)
    const unmet = createBs6ConditionDemoState('BS6-012', false)
    const getSourceAndEffect = (state: GameState) => {
      const source = state.players['player-one'].battleArea.find(
        (entry) => entry.card.id === 'BS6-012',
      )
      if (!source?.card.skill) throw new Error('BS6-012 formal source is required')
      return { source, effect: source.card.skill.effects[0]! }
    }
    const metSource = getSourceAndEffect(met)
    const unmetSource = getSourceAndEffect(unmet)

    expect(met.players['player-one'].hand).toHaveLength(4)
    expect(unmet.players['player-one'].hand).toHaveLength(6)
    expect(isEffectConditionMet(met, {
      sourcePlayerId: 'player-one',
      sourceInstanceId: metSource.source.card.instanceId,
    }, metSource.effect)).toBe(true)
    expect(isEffectConditionMet(unmet, {
      sourcePlayerId: 'player-one',
      sourceInstanceId: unmetSource.source.card.instanceId,
    }, unmetSource.effect)).toBe(false)
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
    expect(
      Object.values(state.players).every((player) =>
        player.battleArea.every((cookie) => cookie.hpCards.length >= 1),
      ),
    ).toBe(true)
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

describe('createBs6008TrapDemoState', () => {
  it('keeps a payable BS6-020 trap out of the response window at 4 HP', () => {
    const blocked = createBs6008TrapDemoState(4)

    expect(blocked.pendingBattle?.trapsDisabled).toBe(true)
    expect(blocked.players['player-one'].supportArea).toHaveLength(2)
    expect(blocked.players['player-one'].hand).toContainEqual(
      expect.objectContaining({ id: 'BS6-020' }),
    )
    expect(getTrapCandidates(blocked, 'player-one')).toEqual([])
  })

  it('keeps the same payable trap available at 5 HP', () => {
    const open = createBs6008TrapDemoState(5)

    expect(open.pendingBattle?.trapsDisabled).toBeUndefined()
    expect(getTrapCandidates(open, 'player-one')).toContainEqual(
      expect.objectContaining({ id: 'BS6-020' }),
    )
  })
})

describe('createCardCheckDemoState', () => {
  it('keeps the generic FLIP scenario below the break-level defeat limit', () => {
    const state = createCardCheckDemoState('BS3-004')
    const breakLevel = state.players['player-one'].breakArea.reduce(
      (total, cookie) => total + cookie.level,
      0,
    )

    expect(breakLevel).toBe(5)

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

  it('prepares BS3-061 with a payable six-card support area', () => {
    const state = createCardCheckDemoState('BS3-061')

    expect(state.players['player-one'].supportArea).toHaveLength(6)
    expect(state.pendingFaintEffects?.[0]?.effect).toMatchObject({
      kind: 'support-to-trash',
      amount: 1,
    })
  })

  it('prepares BS3-113 with the 15 purple discard cards required for its OnPlay damage order', () => {
    const state = createCardCheckDemoState('BS3-113')
    const source = state.players['player-one'].hand.find(
      (card) => card.id === 'BS3-113',
    )

    expect(source?.skill).toMatchObject({ trigger: 'on-play' })
    expect(
      state.players['player-one'].discardPile.filter(
        (card) => card.energyColor === 'purple',
      ),
    ).toHaveLength(15)
    expect(state.players['player-two'].battleArea).toHaveLength(2)
  })

  it('prepares BS6-096 with a full battle area, LV.3 condition and purple LV.1 trash target', () => {
    const state = createCardCheckDemoState('BS6-096')
    const source = state.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS6-096',
    )
    const effect = state.pendingBattle?.attackEffects[0]

    expect(state.players['player-one'].battleArea).toHaveLength(2)
    expect(
      state.players['player-one'].battleArea.some((entry) => entry.card.level === 3),
    ).toBe(true)
    expect(
      state.players['player-one'].discardPile,
    ).toContainEqual(
      expect.objectContaining({
        id: 'BS6-096-purple-lv1',
        type: 'cookie',
        level: 1,
        energyColor: 'purple',
      }),
    )
    expect(source?.card.attackEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'optional-cost-attack' }),
    ]))
    expect(effect).toMatchObject({ kind: 'optional-cost-attack' })
  })

  it('prepares BS4-062 with eight active green supports for payment and effect selection', () => {
    const state = createCardCheckDemoState('BS4-062')
    const supports = state.players['player-one'].supportArea

    expect(supports).toHaveLength(8)
    expect(
      supports.every(
        (support) =>
          !support.rested && support.card.energyColor === 'green',
      ),
    ).toBe(true)
  })

  it('loads BS6 formal cards for localhost card-check through the formal pool', () => {
    const prophet = createCardCheckDemoState('BS6-034')
    const prophetSource = prophet.players['player-one'].hand.find(
      (card) => card.id === 'BS6-034',
    )
    expect(prophetSource?.skill).toMatchObject({
      trigger: 'on-play',
      effects: [{ kind: 'reorder-hp' }],
    })

    const croissant = createCardCheckDemoState('BS6-039')
    const croissantSource = croissant.players['player-one'].hand.find(
      (card) => card.id === 'BS6-039',
    )
    expect(croissantSource?.skill).toMatchObject({
      trigger: 'on-play',
      cost: { energy: { yellow: 1 } },
      effects: [{ kind: 'opponent-break-to-trash-then-battle-to-break' }],
    })

    const schneeball = createCardCheckDemoState('BS6-091')
    const schneeballSource = schneeball.players['player-one'].battleArea[0]?.card
    expect(schneeball.pendingOnPlay).toMatchObject({ origin: 'trash' })
    expect(schneeballSource?.skill).toMatchObject({
      trigger: 'on-play',
      fromTrashArea: true,
      effects: [
        {
          kind: 'break-to-trash',
          energyColor: 'purple',
          exactLevel: 1,
          excludeCardId: 'BS6-091',
        },
      ],
    })
    const effect = schneeballSource?.skill?.effects[0]
    if (!effect || effect.kind !== 'break-to-trash' || !schneeballSource) {
      throw new Error('BS6-091 formal fixture is required')
    }
    expect(
      getBreakToTrashCandidates(
        schneeball,
        {
          sourcePlayerId: 'player-one',
          sourceInstanceId: schneeballSource.instanceId,
        },
        effect,
      ).map((card) => card.instanceId),
    ).toContain('BS6-091-break-eligible-purple-lv1')
    expect(
      getBreakToTrashCandidates(
        schneeball,
        {
          sourcePlayerId: 'player-one',
          sourceInstanceId: schneeballSource.instanceId,
        },
        effect,
      ).map((card) => card.instanceId),
    ).not.toContain('BS6-091-break-excluded')
  })

  it('prepares BS6-053 attack fixture with full HP and exactly five active supports', () => {
    const state = createCardCheckDemoState('BS6-053')
    const source = state.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS6-053',
    )

    expect(source?.hpCards).toHaveLength(3)
    expect(source?.rested).toBe(true)
    expect(state.players['player-one'].supportArea).toHaveLength(5)
    expect(
      state.players['player-one'].supportArea.every((support) => !support.rested),
    ).toBe(true)
    expect(state.pendingBattle).toMatchObject({
      stage: 'attack-effect',
      attackEffects: [
        expect.objectContaining({
          kind: 'gain-hp',
          amount: 1,
          target: {
            side: 'self',
            min: 1,
            max: 1,
            sourceOnly: true,
          },
        }),
      ],
    })
  })

  it('prepares BS6-055 passive fixture with fewer own supports than the opponent', () => {
    const state = createCardCheckDemoState('BS6-055')
    const source = state.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS6-055',
    )

    expect(source?.hpCards).toHaveLength(4)
    expect(source?.rested).toBe(false)
    expect(state.players['player-one'].supportArea).toHaveLength(4)
    expect(state.players['player-two'].supportArea).toHaveLength(6)
    expect(source?.card.skill).toMatchObject({
      trigger: 'passive',
      yourTurn: true,
      effects: [
        {
          kind: 'modify-damage-received',
          condition: { kind: 'support-count-less-than-opponent', difference: 1 },
        },
      ],
    })
  })

  it('builds BS6-079 OnPlay A/B fixtures with and without Timekeeper', () => {
    const clear = createBs6079OnPlayDemoState(false)
    const blocked = createBs6079OnPlayDemoState(true)
    const clearSource = clear.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS6-079',
    )
    const clearTarget = clear.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'self-extra-1',
    )

    expect(clear.pendingOnPlay).toMatchObject({
      sourceInstanceId: clearSource?.card.instanceId,
    })
    expect(clearTarget?.card).toMatchObject({
      type: 'cookie',
      level: 1,
      energyColor: 'blue',
    })
    expect(
      blocked.players['player-two'].battleArea.map((entry) => entry.card.id),
    ).toEqual(['BS6-010'])
    expect(blocked.players['player-two'].battleArea[0]?.card.skill).toMatchObject({
      trigger: 'passive',
      effects: [{ kind: 'prevent-opponent-battle-movement' }],
    })
  })

  it('builds BS4-077 with a blue ally and BS6-010 for the cost-not-effect Browser flow', () => {
    const state = createBs4077TimekeeperCostDemoState()

    expect(state.activePlayerId).toBe('player-one')
    expect(state.phase).toBe('main')
    expect(state.players['player-one'].battleArea.map((entry) => entry.card.id)).toEqual([
      'BS4-077',
      'bs4-077-blue-ally',
    ])
    expect(state.players['player-two'].battleArea[0]?.card.id).toBe('BS6-010')
    expect(state.players['player-two'].battleArea[0]?.card.skill?.effects).toEqual([
      { kind: 'prevent-opponent-battle-movement' },
    ])
  })

  it('creates a negative Browser fixture with every support card rested', () => {
    const state = createCardNegativeDemoState('BS6-020')

    expect(state.players['player-one'].supportArea.length).toBeGreaterThan(0)
    expect(
      state.players['player-one'].supportArea.every((support) => support.rested),
    ).toBe(true)
    expect(
      state.players['player-one'].hand.some((card) => card.id === 'BS6-020'),
    ).toBe(true)
  })

  it('prepares BS6-041 with three Cookies in the break area for its item condition', () => {
    const state = createCardCheckDemoState('BS6-041')

    expect(
      state.players['player-one'].breakArea.filter((card) => card.type === 'cookie'),
    ).toHaveLength(3)
  })

  it('prepares BS6 Browser skill routes with their required legal candidates', () => {
    const bs6062 = createCardCheckDemoState('BS6-062')
    expect(bs6062.players['player-one'].supportArea).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          card: expect.objectContaining({ type: 'cookie' }),
        }),
      ]),
    )

    const bs6025 = createCardCheckDemoState('BS6-025')
    expect(bs6025.players['player-one'].breakArea).toEqual([
      expect.objectContaining({ level: 2 }),
    ])

    const bs6032 = createCardCheckDemoState('BS6-032')
    expect(bs6032.players['player-one'].hand).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'cookie' })]),
    )

    const bs6045 = createCardCheckDemoState('BS6-045')
    expect(bs6045.players['player-two'].supportArea).toHaveLength(10)

    const bs6057 = createCardCheckDemoState('BS6-057')
    expect(bs6057.players['player-one'].supportArea).toEqual(
      expect.arrayContaining([expect.objectContaining({ card: expect.objectContaining({ type: 'cookie' }) })]),
    )

    const bs6081 = createCardCheckDemoState('BS6-081')
    expect(bs6081.players['player-one'].hand).toHaveLength(5)
  })

  it('creates BS6-039 met and unmet break-level fixtures without removing the source card', () => {
    const met = createBs6ConditionDemoState('BS6-039', true)
    const unmet = createBs6ConditionDemoState('BS6-039', false)
    const getSourceAndEffect = (state: GameState) => {
      const source = state.players['player-one'].hand.find(
        (card) => card.id === 'BS6-039',
      )
      if (!source?.skill) throw new Error('BS6-039 formal source is required')
      return { source, effect: source.skill.effects[0]! }
    }
    const metSource = getSourceAndEffect(met)
    const unmetSource = getSourceAndEffect(unmet)

    expect(isEffectConditionMet(met, {
      sourcePlayerId: 'player-one',
      sourceInstanceId: metSource.source.instanceId,
    }, metSource.effect)).toBe(true)
    expect(isEffectConditionMet(unmet, {
      sourcePlayerId: 'player-one',
      sourceInstanceId: unmetSource.source.instanceId,
    }, unmetSource.effect)).toBe(false)
    expect(unmet.players['player-two'].breakArea).toEqual([
      expect.objectContaining({ level: 7 }),
    ])
  })

  it('prepares BS6-106 with a vacant battle slot and a legal purple HP 2 trash Cookie', () => {
    const state = createCardCheckDemoState('BS6-106')
    const trap = state.players['player-one'].hand.find(
      (card) => card.id === 'BS6-106',
    )
    const effect = trap?.trap?.effects.find(
      (entry) => entry.kind === 'trash-to-battle',
    )

    expect(state.players['player-one'].battleArea).toHaveLength(1)
    expect(effect?.kind).toBe('trash-to-battle')
    if (effect?.kind !== 'trash-to-battle' || !trap) {
      throw new Error('BS6-106 trash-to-battle fixture is required')
    }
    expect(
      getTrashCookieCandidates(
        state,
        {
          sourcePlayerId: 'player-one',
          sourceInstanceId: trap.instanceId,
          sourceCardName: trap.name,
        },
        effect,
      ),
    ).toEqual([
      expect.objectContaining({
        instanceId: 'BS6-106-purple-hp2-trash-cookie',
        energyColor: 'purple',
        hp: 2,
      }),
    ])
  })

  it('prepares focused P-0XX fixtures for both alternative and conditional paths', () => {
    const p082Energy = createP082TrapDemoState('energy')
    const p082Cookie = createP082TrapDemoState('cookie')
    expect(p082Energy.players['player-one'].discardPile).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'p082-alternative-cookie' })]),
    )
    expect(p082Cookie.players['player-one'].discardPile).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'p082-alternative-cookie' })]),
    )
    expect(getTrapCandidates(p082Energy, 'player-one')).toHaveLength(1)
    expect(getTrapCandidates(p082Cookie, 'player-one')).toHaveLength(1)
    expect(
      p082Energy.players['player-one'].supportArea.every(
        (support) => support.card.energyColor === 'yellow',
      ),
    ).toBe(true)

    const p084Met = createP084ItemConditionDemoState(true)
    const p084Unmet = createP084ItemConditionDemoState(false)
    expect(p084Met.cookiesFaintedThisTurn?.['player-one']).toBe(1)
    expect(p084Unmet.cookiesFaintedThisTurn?.['player-one']).toBe(0)
    expect(p084Met.players['player-one'].supportArea[0].card.energyColor).toBe('red')

    const p147 = createP147SpecialPlayDemoState()
    expect(p147.players['player-one'].battleArea[0].card).toMatchObject({
      level: 1,
      energyColor: 'black',
    })
    expect(p147.players['player-two'].hand).toHaveLength(4)
  })

  it('builds a generic card-check state for every promoted P-0XX record', () => {
    for (const record of pFormalRecords) {
      const state = createCardCheckDemoState(record.cardNumber)
      const source = [
        ...state.players['player-one'].hand,
        ...state.players['player-one'].battleArea.map((entry) => entry.card),
        ...state.players['player-one'].breakArea,
        ...(state.pendingBattle?.revealedHpCard
          ? [state.pendingBattle.revealedHpCard]
          : []),
      ].find((card) => card.id === record.baseCardNumber)

      expect(source, record.cardNumber).toBeDefined()
    }
  })

  it.each(P_CONDITION_CARD_NUMBERS)(
    '%s exposes legal dedicated met and unmet Browser fixtures',
    (cardNumber) => {
      for (const conditionMet of [true, false]) {
        const state = createPConditionDemoState(cardNumber, conditionMet)
        const parsed = parseTestStateConfig(
          `?test-state=p-condition:${cardNumber}:${conditionMet ? 'met' : 'unmet'}`,
          'localhost',
        )
        expect(parsed).toEqual({
          kind: 'p-condition',
          cardNumber,
          conditionMet,
        })
        expect(state.status).toBe('playing')
        expect(
          [
            ...state.players['player-one'].hand,
            ...state.players['player-one'].battleArea.map((entry) => entry.card),
          ].some(
            (card) =>
              card.id === cardNumber || card.instanceId.includes(cardNumber),
          ),
        ).toBe(true)
      }
    },
  )

  it('keeps BS3-061 condition routes payable while changing the post-cost threshold', () => {
    const met = createBs3SilverbellConditionDemoState(true)
    const unmet = createBs3SilverbellConditionDemoState(false)

    expect(met.players['player-one'].supportArea).toHaveLength(6)
    expect(unmet.players['player-one'].supportArea).toHaveLength(5)
    expect(parseTestStateConfig('?test-state=bs3-061-condition:met', 'localhost')).toEqual({
      kind: 'bs3-061-condition',
      conditionMet: true,
    })
    expect(parseTestStateConfig('?test-state=bs3-061-condition:unmet', 'localhost')).toEqual({
      kind: 'bs3-061-condition',
      conditionMet: false,
    })
  })

  it('provides BS5 focused A/B fixtures for FLIP, faint, traps, items, stages, and BS5-111', () => {
    const flip = createBs5FlipDemoState('BS5-009', true)
    expect(flip.pendingBattle?.stage).toBe('flip')

    const faintMet = createBs5FaintDemoState('BS5-007', true)
    expect(faintMet.pendingFaintEffects?.[0]?.cost).toMatchObject({
      discardHand: 1,
      discardHandColor: 'red',
      discardHandType: 'item',
    })
    const bs5072Met = createBs5FaintDemoState('BS5-072', true)
    const bs5072Unmet = createBs5FaintDemoState('BS5-072', false)
    expect(bs5072Met.pendingFaintEffects).toHaveLength(1)
    expect(bs5072Unmet.pendingFaintEffects).toHaveLength(1)
    expect(bs5072Met.players['player-one'].breakArea).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'BS5-072' }),
        expect.objectContaining({ id: 'BS5-072-break-1' }),
        expect.objectContaining({ id: 'BS5-072-break-2' }),
      ]),
    )
    expect(bs5072Met.players['player-one'].breakArea.reduce((sum, card) => sum + card.level, 0))
      .toBe(8)
    expect(bs5072Unmet.players['player-one'].breakArea).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'BS5-072' })]),
    )
    expect(bs5072Unmet.players['player-one'].breakArea.reduce((sum, card) => sum + card.level, 0))
      .toBe(2)
    expect(
      createBs5FaintDemoState('BS5-011', false).players['player-two'].battleArea.every(
        (entry) => entry.card.level !== 1,
      ),
    ).toBe(true)
    expect(createBs5FaintDemoState('BS5-007', false).players['player-one'].hand)
      .not.toContainEqual(expect.objectContaining({ energyColor: 'red' }))

    const trapMet = createBs5TrapDemoState('BS5-087', true)
    const trapUnmet = createBs5TrapDemoState('BS5-087', false)
    expect(trapMet.players['player-one'].breakArea.reduce((sum, card) => sum + card.level, 0))
      .toBeGreaterThanOrEqual(6)
    expect(trapUnmet.players['player-one'].breakArea).toHaveLength(0)

    const itemMet = createBs5Item111DemoState(true)
    const itemUnmet = createBs5Item111DemoState(false)
    expect(itemMet.players['player-one'].battleArea[0].card.keywords).toContain('dragon')
    expect(itemMet.players['player-one'].battleArea[0].hpCards).toHaveLength(3)
    expect(itemUnmet.players['player-one'].battleArea[0].hpCards).toHaveLength(4)

    const item020Met = createBs5ItemConditionDemoState('BS5-020', true)
    const item020Unmet = createBs5ItemConditionDemoState('BS5-020', false)
    expect(item020Met.players['player-one'].battleArea).toHaveLength(2)
    expect(item020Met.players['player-one'].battleArea.filter((entry) => entry.hpCards.length === 1))
      .toHaveLength(2)
    expect(item020Unmet.players['player-one'].battleArea.filter((entry) => entry.hpCards.length === 1))
      .toHaveLength(1)

    const stage022Met = createBs5StageConditionDemoState('BS5-022', true)
    const stage022Unmet = createBs5StageConditionDemoState('BS5-022', false)
    expect(stage022Met.players['player-one'].battleArea[0].card.id).toBe('BS5-013')
    expect(stage022Unmet.players['player-one'].battleArea[0].card.id).not.toBe('BS5-013')
    expect(stage022Met.players['player-one'].battleArea[0].hpCards).toHaveLength(4)
  })

  it('builds the BS5-060 end-phase A/B fixture around the real attack window', () => {
    const rested = createBs5CroissantEndPhaseDemoState('rested')
    const active = createBs5CroissantEndPhaseDemoState('active')

    expect(rested.pendingBattle?.stage).toBe('attack-effect')
    expect(rested.players['player-one'].supportArea.filter((support) => support.rested))
      .toHaveLength(4)
    expect(active.players['player-one'].supportArea.some((support) => support.rested))
      .toBe(false)
  })

  it('resolves BS5-060 only when the turn reaches end phase and activates at most 3 supports', () => {
    let rested = applyGameCommand(
      createBs5CroissantEndPhaseDemoState('rested'),
      { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [] },
    )
    expect(rested.pendingEndOfTurnEffects).toMatchObject([
      {
        sourceCardName: 'Croissant Cookie',
        effects: [{ kind: 'set-active', supportCount: 3 }],
      },
    ])
    expect(rested.players['player-one'].supportArea.filter((support) => support.rested))
      .toHaveLength(4)

    rested = advancePhase(rested)
    expect(rested.phase).toBe('end')
    expect(rested.players['player-one'].supportArea.filter((support) => support.rested))
      .toHaveLength(4)

    rested = advancePhase(rested)
    expect(rested.pendingEndOfTurnEffects ?? []).toHaveLength(0)
    expect(rested.players['player-one'].supportArea.filter((support) => support.rested))
      .toHaveLength(1)

    let active = applyGameCommand(
      createBs5CroissantEndPhaseDemoState('active'),
      { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [] },
    )
    active = advancePhase(advancePhase(active))
    expect(active.pendingEndOfTurnEffects ?? []).toHaveLength(0)
    expect(active.players['player-one'].supportArea.some((support) => support.rested))
      .toBe(false)
  })

  it('keeps BS5 Browser card-check Cookies at legal positive HP', () => {
    const bs5005 = createCardCheckDemoState('BS5-005')
    expect(bs5005.players['player-one'].battleArea).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          card: expect.objectContaining({ id: 'BS5-005' }),
          hpCards: expect.any(Array),
        }),
        expect.objectContaining({
          card: expect.objectContaining({ id: 'self-extra-1', level: 2 }),
          hpCards: expect.any(Array),
        }),
      ]),
    )
    expect(bs5005.players['player-one'].battleArea.every((entry) => entry.hpCards.length >= 1))
      .toBe(true)

    const bs5010 = createCardCheckDemoState('BS5-010')
    expect(bs5010.players['player-one'].battleArea[0].hpCards.length).toBeGreaterThanOrEqual(1)

    const bs5011 = createBs5FaintDemoState('BS5-011', true)
    expect(bs5011.players['player-two'].battleArea.every((entry) => entry.hpCards.length >= 1))
      .toBe(true)
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
  it('creates a real attack target restriction fixture for BS4-024', () => {
    const state = createBs4024TargetRestrictionDemoState()
    const opponentBattleArea = state.players['player-two'].battleArea

    expect(state.activePlayerId).toBe('player-one')
    expect(opponentBattleArea[0]?.card.id).toBe('BS4-024')
    expect(opponentBattleArea[1]?.card.level).toBe(3)
    expect(opponentBattleArea[1]?.card.energyColor).toBe('yellow')
    expect(getForcedAttackTargetId(state, 'player-one')).toBe(
      opponentBattleArea[0]!.card.instanceId,
    )
  })

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

  it('BS2-015 card-check fixture keeps the source Cookie at positive HP', () => {
    const state = createCardCheckDemoState('BS2-015')
    const source = state.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS2-015',
    )

    expect(source?.hpCards.length).toBeGreaterThanOrEqual(1)
  })

  it.each([
    ['BS4-106', 10],
    ['BS4-107', 15],
  ] as const)(
    '%s generic card-check fixture satisfies its opponent-trash condition',
    (cardNumber, trashCount) => {
      const state = createCardCheckDemoState(cardNumber)
      const item = state.players['player-one'].hand.find(
        (card) => card.id === cardNumber,
      )

      expect(item?.type).toBe('item')
      expect(state.players['player-two'].discardPile).toHaveLength(trashCount)
      expect(state.players['player-one'].deck.length).toBeGreaterThanOrEqual(3)
      expect(
        item?.item?.effects.every((effect) =>
          isEffectConditionMet(state, {
            sourcePlayerId: 'player-one',
            sourceInstanceId: item.instanceId,
          }, effect),
        ),
      ).toBe(true)
    },
  )

  it('prepares both BS2-015 post-cost replacement outcomes', () => {
    const terminal = createBs2015CostDepartureDemoState(false)
    const replacement = createBs2015CostDepartureDemoState(true)

    expect(terminal.players['player-one'].battleArea).toHaveLength(1)
    expect(terminal.players['player-one'].battleArea[0].card.id).toBe('BS2-015')
    expect(terminal.players['player-one'].battleArea[0].hpCards.length)
      .toBeGreaterThanOrEqual(1)
    expect(terminal.players['player-one'].hand).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'cookie' })]),
    )
    expect(replacement.players['player-one'].hand).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'cookie' })]),
    )
  })

  it.each([
    ['BS5-016', 3],
    ['BS5-013', 4],
  ] as const)('%s card-check fixture keeps the HP cards needed by its effect path', (cardNumber, hpCount) => {
    const state = createCardCheckDemoState(cardNumber)
    const source = state.players['player-one'].battleArea.find(
      (entry) => entry.card.id === cardNumber,
    )

    expect(source?.hpCards).toHaveLength(hpCount)
  })

  it('BS6-001 card-check fixture pays two HP cards then resolves its self attack bonus', () => {
    const state = createCardCheckDemoState('BS6-001')
    const source = state.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS6-001',
    )
    const target = state.players['player-one'].battleArea.find(
      (entry) => entry.card.id !== 'BS6-001',
    )

    expect(source?.hpCards).toHaveLength(3)
    expect(target).toBeDefined()
    expect(
      canActivateCookieSkill(
        state,
        'player-one',
        source!.card.instanceId,
        'activate',
      ),
    ).toBe(true)

    const paid = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source!.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
      hpToTrashTargetIds: [source!.card.instanceId],
    })
    expect(
      paid.players['player-one'].battleArea.find(
        (entry) => entry.card.instanceId === source!.card.instanceId,
      )?.hpCards,
    ).toHaveLength(1)

    const resolved = applyGameCommand(paid, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [target!.card.instanceId],
    })

    expect(resolved.pendingAbilityEffect).toBeUndefined()
    expect(getEffectiveAttack(resolved, target!.card.instanceId)).toBe(
      target!.card.attack + 1,
    )
  })

  it('BS5-016 can be activated before its post-payment HP-card condition is known', () => {
    const state = createCardCheckDemoState('BS5-016')
    const source = state.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS5-016',
    )
    expect(source).toBeDefined()
    expect(
      canActivateCookieSkill(state, 'player-one', source!.card.instanceId, 'activate'),
    ).toBe(true)

    const paid = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source!.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
      hpToTrashTargetIds: [source!.card.instanceId],
    })

    expect(paid.costRecord).toMatchObject({ hpTrashTopCardType: 'item' })
    expect(paid.costRecord?.hpTrashTopCardInstanceId).toBe(
      'BS5-016-source-hp-3',
    )
    expect(paid.pendingAbilityEffect?.sourceCardName).toBe('Tiramisu Cookie')
  })

  it('BS5-016 resolves its damage after the HP cost reveals a non-Cookie card', () => {
    const state = createCardCheckDemoState('BS5-016')
    const source = state.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS5-016',
    )
    const target = state.players['player-two'].battleArea[0]
    expect(source).toBeDefined()
    expect(target).toBeDefined()

    const paid = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source!.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
      hpToTrashTargetIds: [source!.card.instanceId],
    })
    const resolved = applyGameCommand(paid, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [target.card.instanceId],
    })

    expect(
      resolved.players['player-two'].battleArea.find(
        (entry) => entry.card.instanceId === target.card.instanceId,
      )?.hpCards,
    ).toHaveLength(target.hpCards.length - 1)
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

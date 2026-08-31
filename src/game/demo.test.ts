import { describe, expect, it } from 'vitest'
import {
  getAttackDamageAgainst,
  applyGameCommand,
  getBreakToBattleCandidates,
  getEffectSelectionCandidates,
  getEffectTargetCandidates,
  getEffectiveAttack,
  getAttackEnergyCostForState,
  getForcedAttackTargetId,
  resolveNextDamage,
  resolveAttackEffect,
  resolveFaintEffect,
  advancePhase,
  type CardEffect,
  type GameCard,
  type GameState,
  canPlayExtraDeckCookie,
} from '.'
import {
  P_CONDITION_CARD_NUMBERS,
  BS4_CONDITION_CARD_NUMBERS,
  createBlueActivateSkillDemoState,
  createBlueInspectDeckDemoState,
  createBlueOptionalCostAttackDemoState,
  createAiDiscardRevealDemoState,
  createBs2015CostDepartureDemoState,
  createBs8076ActivePreventionDemoState,
  createBs8084AttackRequirementDemoState,
  createBs8ExtraDeckDemoState,
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
  createBs4026OnPlayDemoState,
  createBs6031AttackAfterDemoState,
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
import {
  getTrapCandidates,
  playTrap,
  resolveFlip,
  resolveOptionalCostAttack,
} from './battle'
import { cookie } from './test-helpers/battle-helpers'
import { canActivateStage } from './card-abilities'
import {
  getBreakToTrashCandidates,
  getTrashCookieCandidates,
  getTrashToHandCandidates,
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

  it('parses a strict skill-only card-check route only on localhost', () => {
    expect(parseTestStateConfig('?test-state=card-skill:BS8-010', 'localhost')).toEqual({
      kind: 'card-check',
      cardNumber: 'BS8-010',
      preferSkillSurface: true,
    })
    expect(parseTestStateConfig('?test-state=card-skill:BS8-010', 'example.com')).toBeNull()
  })

  it('parses BS8 EXTRA Deck positive and blocked test-state routes only on localhost', () => {
    expect(
      parseTestStateConfig('?test-state=bs8-extra-deck:met', 'localhost'),
    ).toEqual({ kind: 'bs8-extra-deck', conditionMet: true })
    expect(
      parseTestStateConfig('?test-state=bs8-extra-deck:unmet', 'localhost'),
    ).toEqual({ kind: 'bs8-extra-deck', conditionMet: false })
    expect(
      parseTestStateConfig('?test-state=bs8-extra-deck:met', 'example.com'),
    ).toBeNull()
  })

  it('parses the localhost-only BS8-084 attack-discard A/B routes', () => {
    expect(
      parseTestStateConfig('?test-state=bs8-084-attack-discard:payable', 'localhost'),
    ).toEqual({ kind: 'bs8-084-attack-discard', payable: true })
    expect(
      parseTestStateConfig('?test-state=bs8-084-attack-discard:unpayable', 'localhost'),
    ).toEqual({ kind: 'bs8-084-attack-discard', payable: false })
    expect(
      parseTestStateConfig('?test-state=bs8-084-attack-discard:payable', 'example.com'),
    ).toBeNull()
  })

  it('creates a BS8 EXTRA Deck Browser fixture with a truthful positive or blocked entry condition', () => {
    const met = createBs8ExtraDeckDemoState(true)
    const unmet = createBs8ExtraDeckDemoState(false)
    const playerOne = met.players['player-one']
    if (!playerOne) throw new Error('BS8 fixture must provide player one')
    const avatar = playerOne.extraDeck?.[0]
    if (!avatar) throw new Error('BS8 fixture must provide Avatar of Ruin')
    const instanceId = avatar.instanceId

    expect(avatar).toMatchObject({
      id: 'BS8-005',
      name: 'Avatar of Ruin Cookie',
      type: 'extra',
      level: 3,
      attackEffects: [
        { kind: 'damage-all', amount: 1, side: 'opponent' },
        { kind: 'damage-all', amount: 1, side: 'self', excludeSource: true },
      ],
    })
    expect(canPlayExtraDeckCookie(met, 'player-one', instanceId)).toBe(true)
    expect(canPlayExtraDeckCookie(unmet, 'player-one', instanceId)).toBe(false)
    expect(playerOne.supportArea).toHaveLength(3)
    expect(playerOne.supportArea.every((support) => !support.rested)).toBe(true)
    expect(playerOne.battleArea[0]?.hpCards).toHaveLength(3)
    expect(met.players['player-two'].battleArea[0]?.hpCards).toHaveLength(6)
  })

  it('creates the BS8-076 active-phase decision with exactly two discard candidates', () => {
    const state = createBs8076ActivePreventionDemoState()
    const target = state.players['player-one'].battleArea.find(
      (entry) => entry.card.name === 'BS8-076 Active Phase Target',
    )

    expect(state.phase).toBe('active')
    expect(state.pendingOpponentHandDiscard).toMatchObject({
      playerId: 'player-one',
      count: 2,
      optional: true,
      activePhaseCookieInstanceId: target?.card.instanceId,
    })
    expect(state.players['player-one'].hand).toHaveLength(2)
    expect(target?.rested).toBe(true)
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
      parseTestStateConfig('?test-state=card-skill-negative:BS8-010', 'localhost'),
    ).toEqual({
      kind: 'card-negative',
      cardNumber: 'BS8-010',
      preferSkillSurface: true,
    })
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

  it('parses the BS4-026 OnPlay and BS6-031 attack-after routes only on localhost', () => {
    expect(
      parseTestStateConfig('?test-state=bs4-026-on-play-blocked', 'localhost'),
    ).toEqual({ kind: 'bs4-026-on-play', blocked: true })
    expect(
      parseTestStateConfig('?test-state=bs6-031-attack-after-unpayable', 'localhost'),
    ).toEqual({ kind: 'bs6-031-attack-after', payable: false })
    expect(
      parseTestStateConfig('?test-state=bs6-031-attack-after-unpayable', 'example.com'),
    ).toBeNull()
  })

  it('parses the direct BS6-010 movement A/B aliases only on localhost', () => {
    expect(
      parseTestStateConfig('?test-state=bs6-010-open', 'localhost'),
    ).toEqual({ kind: 'bs6-010-movement', blocked: false })
    expect(
      parseTestStateConfig('?test-state=bs6-010-blocked', 'localhost'),
    ).toEqual({ kind: 'bs6-010-movement', blocked: true })
    expect(
      parseTestStateConfig('?test-state=bs6-010-blocked', 'example.com'),
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
  it('keeps a deployed Blocker at positive full HP in card-check fixtures', () => {
    const state = createCardCheckDemoState('BS4-014')
    const blocker = state.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS4-014',
    )

    expect(blocker).toBeDefined()
    expect(blocker?.hpCards).toHaveLength(blocker?.card.hp ?? 0)
    expect(blocker?.hpCards.length).toBeGreaterThan(0)
  })

  it.each(['BS4-014', 'BS4-042', 'BS4-072', 'BS5-092'])(
    'marks the attacker rested in the %s pending-battle card-check fixture',
    (cardNumber) => {
      const state = createCardCheckDemoState(cardNumber)
      const pendingBattle = state.pendingBattle
      const attacker = pendingBattle
        ? state.players[pendingBattle.attackerPlayerId].battleArea.find(
            (entry) =>
              entry.card.instanceId === pendingBattle.attackerInstanceId,
          )
        : undefined

      expect(pendingBattle).not.toBeNull()
      expect(attacker?.rested).toBe(true)
    },
  )

  it('keeps every opposing Cookie rested in generic trap fixtures', () => {
    const state = createCardCheckDemoState('BS6-085')

    expect(state.pendingBattle?.stage).toBe('trap')
    expect(
      state.players['player-two'].battleArea.every((entry) => entry.rested),
    ).toBe(true)
  })

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

  it('does not open a FLIP decision for attachment records without a FlipAbility', () => {
    const state = createCardCheckDemoState('BS2-042')

    expect(state.pendingBattle).toBeNull()
    const attachmentRecord = state.players['player-one'].hand.find(
      (card) => card.id === 'BS2-042',
    )
    expect(attachmentRecord).toMatchObject({
      type: 'cookie',
      officialType: 'flip',
    })
    expect(attachmentRecord).not.toHaveProperty('flip')
  })

  it('prepares BS6-013 with a real same-name partner and removes it in the negative route', () => {
    const positive = createCardCheckDemoState('BS6-013')
    const positiveCookies = positive.players['player-one'].battleArea.filter(
      (entry) => entry.card.id === 'BS6-013',
    )
    expect(positiveCookies).toHaveLength(2)
    expect(new Set(positiveCookies.map((entry) => entry.card.instanceId)).size).toBe(2)

    const attackEffect = positive.pendingBattle?.attackEffects[0]
    const sourceInstanceId = positive.pendingBattle?.attackerInstanceId
    if (!attackEffect || !sourceInstanceId) throw new Error('BS6-013 attack fixture is incomplete')
    expect(
      isEffectConditionMet(
        positive,
        { sourcePlayerId: 'player-one', sourceInstanceId },
        attackEffect,
      ),
    ).toBe(true)

    const negative = createCardNegativeDemoState('BS6-013')
    expect(
      negative.players['player-one'].battleArea.filter(
        (entry) => entry.card.id === 'BS6-013',
      ),
    ).toHaveLength(1)
    const negativeEffect = negative.pendingBattle?.attackEffects[0]
    const negativeSourceId = negative.pendingBattle?.attackerInstanceId
    if (!negativeEffect || !negativeSourceId) throw new Error('BS6-013 negative fixture is incomplete')
    expect(
      isEffectConditionMet(
        negative,
        { sourcePlayerId: 'player-one', sourceInstanceId: negativeSourceId },
        negativeEffect,
      ),
    ).toBe(false)
  })

  it('prepares BS6-007 with faint evidence and opponent supports for both routes', () => {
    const positive = createCardCheckDemoState('BS6-007')
    expect(positive.players['player-two'].supportArea).toHaveLength(2)
    expect(positive.pendingBattle?.faintedColors).toEqual(['red'])
    expect(positive.pendingBattle?.faintedCookies).toEqual([
      expect.objectContaining({ playerId: 'player-two', level: 1 }),
    ])
    const positiveEffect = positive.pendingBattle?.attackEffects[0]
    const positiveSourceId = positive.pendingBattle?.attackerInstanceId
    if (!positiveEffect || !positiveSourceId) throw new Error('BS6-007 attack fixture is incomplete')
    expect(
      isEffectConditionMet(
        positive,
        { sourcePlayerId: 'player-one', sourceInstanceId: positiveSourceId },
        positiveEffect,
      ),
    ).toBe(true)

    const negative = createCardNegativeDemoState('BS6-007')
    expect(negative.players['player-two'].supportArea).toHaveLength(2)
    expect(negative.pendingBattle?.faintedColors).toEqual([])
    const negativeEffect = negative.pendingBattle?.attackEffects[0]
    const negativeSourceId = negative.pendingBattle?.attackerInstanceId
    if (!negativeEffect || !negativeSourceId) throw new Error('BS6-007 negative fixture is incomplete')
    expect(
      isEffectConditionMet(
        negative,
        { sourcePlayerId: 'player-one', sourceInstanceId: negativeSourceId },
        negativeEffect,
      ),
    ).toBe(false)
  })

  it('prepares P-053 with met and unmet post-battle faint conditions', () => {
    const positive = createCardCheckDemoState('P-053')
    const positiveEffect = positive.pendingBattle?.attackEffects[0]
    const positiveSourceId = positive.pendingBattle?.attackerInstanceId
    if (!positiveEffect || !positiveSourceId) {
      throw new Error('P-053 attack fixture is incomplete')
    }
    expect(positive.pendingBattle?.faintedColors).toHaveLength(1)
    expect(
      isEffectConditionMet(
        positive,
        { sourcePlayerId: 'player-one', sourceInstanceId: positiveSourceId },
        positiveEffect,
      ),
    ).toBe(true)

    const negative = createCardNegativeDemoState('P-053')
    const negativeEffect = negative.pendingBattle?.attackEffects[0]
    const negativeSourceId = negative.pendingBattle?.attackerInstanceId
    if (!negativeEffect || !negativeSourceId) {
      throw new Error('P-053 negative fixture is incomplete')
    }
    expect(negative.pendingBattle?.faintedColors).toEqual([])
    expect(
      isEffectConditionMet(
        negative,
        { sourcePlayerId: 'player-one', sourceInstanceId: negativeSourceId },
        negativeEffect,
      ),
    ).toBe(false)
  })

  it('prepares P-130 above and below its remaining-HP threshold', () => {
    const assertCondition = (state: GameState, expected: boolean) => {
      const effect = state.pendingBattle?.attackEffects[0]
      const sourceInstanceId = state.pendingBattle?.attackerInstanceId
      if (!effect || !sourceInstanceId) {
        throw new Error('P-130 attack fixture is incomplete')
      }
      expect(
        isEffectConditionMet(
          state,
          { sourcePlayerId: 'player-one', sourceInstanceId },
          effect,
        ),
      ).toBe(expected)
    }

    const positive = createCardCheckDemoState('P-130')
    expect(
      positive.players['player-one'].battleArea.find(
        (entry) => entry.card.id === 'P-130',
      )?.hpCards,
    ).toHaveLength(3)
    assertCondition(positive, true)

    const negative = createCardNegativeDemoState('P-130')
    expect(
      negative.players['player-one'].battleArea.find(
        (entry) => entry.card.id === 'P-130',
      )?.hpCards,
    ).toHaveLength(2)
    assertCondition(negative, false)
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

  it('prepares BS6-063 with exactly five supports so its trap Then effect can continue', () => {
    const state = createCardCheckDemoState('BS6-063')
    const trap = state.players['player-one'].hand.find(
      (card) => card.id === 'BS6-063',
    )

    expect(trap?.instanceId).toBe('player-one-BS6-063-1')
    expect(state.players['player-one'].supportArea).toHaveLength(5)
    expect(
      state.players['player-one'].supportArea.every((support) => !support.rested),
    ).toBe(true)

    const played = playTrap(state, 'player-one', {
      trapInstanceId: trap!.instanceId,
      paymentIds: ['support-pay-0', 'support-pay-1'],
      targetIds: ['trap-attacker'],
    })

    expect(played.pendingAbilityEffect).toMatchObject({
      effectIndex: 1,
      battleContinuation: 'after-trap',
    })
    expect(played.pendingAbilityEffect?.effects[1]).toMatchObject({
      kind: 'choose-one',
      condition: {
        kind: 'all-of',
        conditions: [
          { kind: 'support-count-at-least', count: 5 },
          { kind: 'support-count-at-most', count: 5 },
        ],
      },
    })

    const chosen = applyGameCommand(played, {
      kind: 'resolve-choose-one',
      playerId: 'player-one',
      modeIndex: 0,
    })
    const resolved = applyGameCommand(chosen, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })

    expect(resolved.players['player-one'].supportArea).toHaveLength(6)
    expect(
      resolved.players['player-one'].supportArea.at(-1),
    ).toMatchObject({ rested: true, card: { id: 'p1-deck-0' } })
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

    const peeledCarrot = createCardCheckDemoState('BS6-087')
    const peeledCarrotSource = peeledCarrot.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS6-087',
    )?.card
    expect(peeledCarrot.pendingOnPlay).toMatchObject({
      sourceInstanceId: peeledCarrotSource?.instanceId,
      origin: 'trash',
    })
    expect(peeledCarrot.players['player-one'].hand).not.toContainEqual(
      expect.objectContaining({ id: 'BS6-087' }),
    )
    expect(peeledCarrotSource?.skill).toMatchObject({
      trigger: 'on-play',
      fromTrashArea: true,
      effects: [{ kind: 'trash-to-hand', energyColor: 'purple', max: 1 }],
    })
    const peeledCarrotEffect = peeledCarrotSource?.skill?.effects[0]
    if (!peeledCarrotSource || !peeledCarrotEffect || peeledCarrotEffect.kind !== 'trash-to-hand') {
      throw new Error('BS6-087 formal fixture is required')
    }
    expect(
      getTrashToHandCandidates(
        peeledCarrot,
        {
          sourcePlayerId: 'player-one',
          sourceInstanceId: peeledCarrotSource.instanceId,
        },
        peeledCarrotEffect,
      ).map((candidate) => candidate.instanceId),
    ).toContain('trash-cookie-2')
  })

  it('routes BS8 attack Then candidates through a real payable attack, not a prebuilt post-attack window', () => {
    const state = createCardCheckDemoState('BS8-076')
    const negative = createCardNegativeDemoState('BS8-076')
    const source = state.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS8-076',
    )

    expect(source?.card.attackEffects).toMatchObject([
      {
        kind: 'optional-cost-attack',
        mandatory: true,
        cost: { selfToDeckBottom: true },
      },
    ])
    expect(source?.rested).toBe(false)
    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-one'].supportArea.some((support) => !support.rested)).toBe(true)
    expect(negative.pendingBattle).toBeNull()
    expect(negative.players['player-one'].supportArea.every((support) => support.rested)).toBe(true)
  })

  it('uses the normalized attack energy for a colourless BS8 alternate-art fixture', () => {
    const state = createCardCheckDemoState('BS8-083@2')
    const source = state.players['player-one'].battleArea.find(
      (cookie) => cookie.card.id === 'BS8-083',
    )

    expect(source?.card.attackEnergyCost).toEqual({ blue: 3 })
    expect(state.players['player-one'].supportArea.map((support) => support.card.energyColor))
      .toEqual(['blue', 'blue', 'blue', 'blue', 'blue', 'blue'])
  })

  it('sets the positive BS8 support-count attack Then fixtures to their printed condition', () => {
    for (const [cardNumber, ownSupportCount] of [
      ['BS8-054', 1],
      ['BS8-067', 2],
    ] as const) {
      const state = createCardCheckDemoState(cardNumber)
      expect(state.players['player-one'].supportArea).toHaveLength(ownSupportCount)
      expect(state.players['player-two'].supportArea).toHaveLength(3)
    }
  })

  it('keeps the BS8-084 attack Then hand condition met', () => {
    expect(createCardCheckDemoState('BS8-084').players['player-one'].hand).toHaveLength(3)
  })

  it('can select the BS8-010 and BS8-083 ability surfaces without hiding them behind Then', () => {
    const redVelvet = createCardCheckDemoState('BS8-010', {
      preferSkillSurface: true,
    })
    const redVelvetSource = redVelvet.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS8-010',
    )
    expect(redVelvetSource).toBeDefined()
    expect(redVelvet.cookiesFaintedThisTurn?.['player-one']).toBe(1)
    expect(
      canActivateCookieSkill(
        redVelvet,
        'player-one',
        redVelvetSource!.card.instanceId,
        'activate',
      ),
    ).toBe(true)

    const frostQueen = createCardCheckDemoState('BS8-083', {
      preferSkillSurface: true,
    })
    expect(frostQueen.players['player-one'].hand).toContainEqual(
      expect.objectContaining({ id: 'BS8-083' }),
    )
    expect(
      frostQueen.players['player-one'].battleArea.some((entry) => entry.card.id === 'BS8-083'),
    ).toBe(false)
  })

  it('builds the BS8-084 Browser A/B fixture around its mandatory pre-attack discard', () => {
    const payable = createBs8084AttackRequirementDemoState(true)
    const attacker = payable.players['player-one'].battleArea[0]
    const sherbet = payable.players['player-two'].battleArea[0]
    if (!attacker || !sherbet) {
      throw new Error('BS8-084 Browser fixture is incomplete')
    }

    const pendingDiscard = applyGameCommand(payable, {
      kind: 'declare-attack',
      playerId: 'player-one',
      attackerInstanceId: attacker.card.instanceId,
      targetInstanceId: sherbet.card.instanceId,
      supportPaymentIds: [],
    })
    expect(pendingDiscard.pendingBattle).toBeNull()
    expect(pendingDiscard.players['player-one'].battleArea[0]?.rested).toBe(false)
    expect(pendingDiscard.pendingOpponentHandDiscard).toMatchObject({
      playerId: 'player-one',
      count: 1,
      sourceInstanceId: sherbet.card.instanceId,
      attackDeclaration: {
        attackerInstanceId: attacker.card.instanceId,
        targetInstanceId: sherbet.card.instanceId,
      },
    })

    const unpayable = createBs8084AttackRequirementDemoState(false)
    expect(() =>
      applyGameCommand(unpayable, {
        kind: 'declare-attack',
        playerId: 'player-one',
        attackerInstanceId: unpayable.players['player-one'].battleArea[0]!.card.instanceId,
        targetInstanceId: unpayable.players['player-two'].battleArea[0]!.card.instanceId,
        supportPaymentIds: [],
      }),
    ).toThrow('無法宣告攻擊：必須先棄置 1 張手牌。')
  })

  it('reserves a battle slot for BS8-112 to play its LV.2+ trash target', () => {
    expect(createCardCheckDemoState('BS8-112').players['player-one'].battleArea).toHaveLength(1)
  })

  it('sets every BS8 conditional Activate fixture on its printed positive side', () => {
    for (const cardNumber of [
      'BS8-032',
      'BS8-034',
      'BS8-039',
      'BS8-052',
      'BS8-057',
      'BS8-062',
      'BS8-078',
      'BS8-092',
      'BS8-113',
      'BS8-120',
    ]) {
      const state = createCardCheckDemoState(cardNumber)
      const source = state.players['player-one'].battleArea.find(
        (entry) => entry.card.id === cardNumber,
      )

      expect(source, `${cardNumber} must be deployed`).toBeDefined()
      expect(
        canActivateCookieSkill(
          state,
          'player-one',
          source!.card.instanceId,
          'activate',
        ),
        `${cardNumber} positive card-check fixture must be legally activatable`,
      ).toBe(true)
    }
  })

  it('prepares BS8 static attack fixtures with their printed condition and cost boundary', () => {
    const chives = createCardCheckDemoState('BS8-061')
    expect(chives.players['player-one'].supportArea).toHaveLength(1)
    expect(chives.players['player-two'].supportArea).toHaveLength(3)
    const chivesSource = chives.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS8-061',
    )
    expect(chivesSource?.card.attack).toBe(1)
    expect(getEffectiveAttack(chives, chivesSource!.card.instanceId)).toBe(2)

    const chivesNegative = createCardNegativeDemoState('BS8-061')
    const chivesNegativeSource = chivesNegative.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS8-061',
    )
    expect(chivesNegative.players['player-one'].supportArea).toHaveLength(1)
    expect(chivesNegative.players['player-two'].supportArea).toHaveLength(1)
    expect(
      getEffectiveAttack(chivesNegative, chivesNegativeSource!.card.instanceId),
    ).toBe(1)

    const cacao = createCardCheckDemoState('BS8-125')
    const cacaoSource = cacao.players['player-one'].battleArea[0]
    expect(cacaoSource?.card.name).toBe('Dark Cacao Cookie')
    expect(cacaoSource?.card.attackEnergyCost).toEqual({ purple: 1 })
    expect(createCardNegativeDemoState('BS8-075').players['player-one'].supportArea)
      .toHaveLength(5)
    const cacaoNegative = createCardNegativeDemoState('BS8-125')
    expect(cacaoNegative.players['player-one'].discardPile).toHaveLength(13)
    const cacaoStage = cacaoNegative.players['player-one'].hand.find(
      (card) => card.id === 'BS8-125',
    )!
    const afterStagePlacement = applyGameCommand(cacaoNegative, {
      kind: 'play-stage',
      playerId: 'player-one',
      instanceId: cacaoStage.instanceId,
      paymentIds: cacaoNegative.players['player-one'].supportArea
        .slice(0, 2)
        .map((support) => support.card.instanceId),
    })
    expect(afterStagePlacement.players['player-one'].discardPile).toHaveLength(14)
    expect(
      getAttackEnergyCostForState(
        afterStagePlacement,
        afterStagePlacement.players['player-one'].battleArea[0]!.card.instanceId,
      ),
    ).toEqual({ purple: 1 })
  })

  it('sets the merged BS8 Cheesebird skill condition through a real break-entry teammate', () => {
    const state = createCardCheckDemoState('BS8-028@1')
    const teammate = state.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )

    expect(teammate).toMatchObject({
      enteredFrom: 'break',
      enteredTurn: state.turnNumber,
    })
  })

  it('removes the merged BS8 Cheesebird break-entry fact from the negative fixture', () => {
    const state = createCardNegativeDemoState('BS8-028@1')
    const teammate = state.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )

    expect(teammate?.enteredFrom).toBeUndefined()
    expect(teammate?.enteredTurn).toBeUndefined()
  })

  it('prepares BS8-043 with its only other battle slot occupied by a LV.3 Cookie that entered from break this turn', () => {
    const state = createCardCheckDemoState('BS8-043')
    const teammate = state.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )

    expect(state.players['player-one'].battleArea).toHaveLength(2)
    expect(teammate).toMatchObject({
      card: { level: 3 },
      enteredFrom: 'break',
      enteredTurn: state.turnNumber,
    })
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

  it('prepares BS6-024 attack follow-up with a LV.3 Cookie in the break area', () => {
    const state = createCardCheckDemoState('BS6-024')
    const source = state.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS6-024',
    )

    expect(source?.rested).toBe(true)
    expect(state.players['player-one'].breakArea).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'BS6-024-break-lv3',
          type: 'cookie',
          level: 3,
        }),
      ]),
    )
    expect(state.pendingBattle).toMatchObject({
      stage: 'attack-effect',
      attackEffects: [
        expect.objectContaining({
          kind: 'damage-by-break-count',
          exactBreakLevel: 3,
        }),
      ],
    })
  })

  it('prepares BS6-018 as an active 1-HP attacker for its conditional attack follow-up', () => {
    const state = createCardCheckDemoState('BS6-018')
    const source = state.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS6-018',
    )
    const target = state.players['player-two'].battleArea[0]
    const supportPaymentIds = state.players['player-one'].supportArea
      .slice(0, 2)
      .map((support) => support.card.instanceId)

    expect(source?.hpCards).toHaveLength(1)
    expect(source?.rested).toBe(false)
    expect(state.pendingBattle).toBeNull()

    const declared = applyGameCommand(state, {
      kind: 'declare-attack',
      playerId: 'player-one',
      attackerInstanceId: source!.card.instanceId,
      targetInstanceId: target.card.instanceId,
      supportPaymentIds,
    })

    expect(declared.pendingBattle).toMatchObject({
      stage: 'trap',
      attackerInstanceId: source?.card.instanceId,
      targetInstanceId: target.card.instanceId,
      attackEffects: [
        expect.objectContaining({
          kind: 'modify-attack',
          amount: 1,
          condition: { kind: 'source-hp-less-than', amount: 2 },
        }),
      ],
    })
    expect(
      declared.players['player-one'].battleArea.find(
        (entry) => entry.card.instanceId === source?.card.instanceId,
      )?.rested,
    ).toBe(true)
  })

  it('prepares BS6-018 negative route at full HP with a legal attack payment', () => {
    const state = createCardNegativeDemoState('BS6-018')
    const source = state.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS6-018',
    )

    expect(source?.hpCards).toHaveLength(2)
    expect(source?.rested).toBe(false)
    expect(state.pendingBattle).toBeNull()
    expect(
      state.players['player-one'].supportArea.filter(
        (support) => !support.rested,
      ),
    ).toHaveLength(6)
  })

  it.each([
    ['BS6-059', 3, 5],
    ['BS6-060', 4, 6],
    ['BS6-061', 2, 7],
  ] as const)(
    '%s attack fixture keeps the source at full HP and exposes its post-attack cost candidates',
    (cardNumber, hpCount, supportCount) => {
      const state = createCardCheckDemoState(cardNumber)
      const source = state.players['player-one'].battleArea.find(
        (entry) => entry.card.id === cardNumber,
      )

      expect(source?.hpCards).toHaveLength(hpCount)
      expect(source?.rested).toBe(true)
      expect(state.players['player-one'].supportArea).toHaveLength(supportCount)
      expect(state.pendingBattle).toMatchObject({
        stage: 'attack-effect',
        attackerInstanceId: source?.card.instanceId,
      })
      if (cardNumber === 'BS6-061') {
        expect(
          state.players['player-one'].supportArea.some(
            (support) => support.card.type === 'cookie',
          ),
        ).toBe(true)
      }
    },
  )

  it('prepares BS6-058 OnPlay with the required two-card support-count gap', () => {
    const state = createCardCheckDemoState('BS6-058')
    const source = state.players['player-one'].hand.find(
      (card) => card.id === 'BS6-058',
    )

    expect(source?.skill).toMatchObject({ trigger: 'on-play' })
    expect(state.players['player-one'].supportArea).toHaveLength(2)
    expect(state.players['player-two'].supportArea).toHaveLength(4)
    expect(
      state.players['player-two'].supportArea.length -
        state.players['player-one'].supportArea.length,
    ).toBeGreaterThanOrEqual(2)
  })

  it('prepares BS6-064 with fewer own supports so its stage Activate is testable', () => {
    const state = createCardCheckDemoState('BS6-064')

    expect(state.players['player-one'].hand.some((card) => card.id === 'BS6-064')).toBe(true)
    expect(state.players['player-one'].supportArea).toHaveLength(2)
    expect(state.players['player-two'].supportArea).toHaveLength(4)
    expect(
      state.players['player-two'].supportArea.length -
        state.players['player-one'].supportArea.length,
    ).toBeGreaterThanOrEqual(1)
  })

  it('prepares BS6-021 with an LV.2+ Cookie at exactly 1 remaining HP', () => {
    const state = createCardCheckDemoState('BS6-021')
    const stage = state.players['player-one'].hand.find(
      (card) => card.id === 'BS6-021',
    )
    const target = state.players['player-one'].battleArea[0]

    expect(stage?.stageAbility?.effects).toMatchObject([
      {
        kind: 'modify-attack',
        target: { minLevel: 2, maxRemainingHp: 3 },
        thenDrawUpToIfTargetRemainingHp: { remainingHp: 1, max: 1 },
      },
    ])
    expect(target?.card.level).toBeGreaterThanOrEqual(2)
    expect(target?.hpCards).toHaveLength(1)
    expect(state.players['player-one'].supportArea.every((support) => !support.rested)).toBe(true)
  })

  it('prepares BS6-019 with its HP and opponent support conditions', () => {
    const state = createCardCheckDemoState('BS6-019')
    const item = state.players['player-one'].hand.find(
      (card) => card.id === 'BS6-019',
    )

    expect(item?.item?.effects).toMatchObject([
      { kind: 'hp-to-hand', amount: 1 },
      { kind: 'rest-support', side: 'opponent', amount: 2 },
    ])
    expect(state.players['player-one'].battleArea[0]?.hpCards.length).toBeGreaterThan(0)
    expect(state.players['player-two'].breakArea).toHaveLength(0)
    expect(state.players['player-two'].supportArea).toHaveLength(3)
    expect(
      state.players['player-two'].supportArea.every((support) => !support.rested),
    ).toBe(true)

    if (!item?.item) throw new Error('BS6-019 item ability is required')
    const restEffect = item.item.effects.find(
      (effect) => effect.kind === 'rest-support',
    )
    if (!restEffect || restEffect.kind !== 'rest-support') {
      throw new Error('BS6-019 rest-support effect is required')
    }
    expect(
      getEffectSelectionCandidates(
        state,
        {
          sourcePlayerId: 'player-one',
          sourceInstanceId: item.instanceId,
        },
        restEffect,
      ),
    ).toHaveLength(3)
  })

  it('keeps BS6-021 placement payment active while removing all legal targets on the negative route', () => {
    const state = createCardNegativeDemoState('BS6-021')
    const stage = state.players['player-one'].hand.find(
      (card) => card.id === 'BS6-021',
    )

    expect(stage).toBeDefined()
    expect(state.players['player-one'].supportArea.every((support) => !support.rested)).toBe(true)
    expect(
      state.players['player-one'].battleArea.every((entry) => entry.card.level < 2),
    ).toBe(true)
  })

  it('prepares BS6-043 with a yellow Cookie in hand and rested supports for its end phase', () => {
    const state = createCardCheckDemoState('BS6-043')
    const stage = state.players['player-one'].hand.find(
      (card) => card.id === 'BS6-043',
    )

    expect(stage?.stageAbility?.effects).toMatchObject([
      { kind: 'hand-to-break', amount: 1, energyColor: 'yellow' },
      { kind: 'set-active', supportCount: 2, selectable: true, optional: true },
      { kind: 'draw-up-to', max: 1 },
    ])
    expect(
      state.players['player-one'].hand.filter(
        (card) => card.type === 'cookie' && card.energyColor === 'yellow',
      ),
    ).toHaveLength(1)
    expect(
      state.players['player-one'].supportArea.filter((support) => support.rested),
    ).toHaveLength(2)
  })

  it('prepares BS6-042 negative route with the break-area condition unmet', () => {
    const state = createCardNegativeDemoState('BS6-042')

    expect(state.players['player-one'].breakArea).toHaveLength(2)
    expect(state.players['player-one'].supportArea.every((support) => !support.rested)).toBe(true)
    expect(state.pendingBattle?.stage).toBe('trap')
  })

  it('prepares BS6-043 negative route with no yellow Cookie in hand but active payment', () => {
    const state = createCardNegativeDemoState('BS6-043')

    expect(state.players['player-one'].hand.some((card) => card.type === 'cookie')).toBe(false)
    expect(state.players['player-one'].supportArea.every((support) => !support.rested)).toBe(true)
    expect(state.players['player-one'].hand.some((card) => card.id === 'BS6-043')).toBe(true)
  })

  it('prepares BS6-059 attack follow-up with exactly five supports and a self target', () => {
    const state = createCardCheckDemoState('BS6-059')
    const source = state.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS6-059',
    )

    expect(state.players['player-one'].supportArea).toHaveLength(5)
    expect(state.pendingBattle?.stage).toBe('attack-effect')
    expect(state.pendingBattle?.attackEffects[0]).toMatchObject({
      kind: 'return-to-hand',
      target: { sourceOnly: true, min: 0, max: 1 },
    })
    expect(source).toBeDefined()
  })

  it('returns BS6-059 to hand when its optional self target is confirmed', () => {
    const state = createCardCheckDemoState('BS6-059')
    const source = state.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS6-059',
    )!
    const next = resolveAttackEffect(state, 'player-one', [source.card.instanceId])

    expect(next.players['player-one'].hand.some((card) => card.id === 'BS6-059')).toBe(true)
    expect(
      next.players['player-one'].battleArea.some(
        (entry) => entry.card.id === 'BS6-059',
      ),
    ).toBe(false)
  })

  it('prepares BS2-043 faint cost with two legal hand cards', () => {
    const state = createCardCheckDemoState('BS2-043')

    expect(state.pendingFaintEffects?.[0]?.cost).toMatchObject({
      discardHand: 2,
    })
    expect(state.players['player-one'].hand).toHaveLength(4)
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

  it('keeps BS6-072 in hand so the real deploy command opens its OnPlay effect', () => {
    const state = createCardCheckDemoState('BS6-072')
    const source = state.players['player-one'].hand.find(
      (card) => card.id === 'BS6-072',
    )

    expect(source).toBeDefined()
    expect(state.pendingBattle).toBeNull()
    expect(state.pendingOnPlay).toBeNull()

    const deployed = applyGameCommand(state, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: source!.instanceId,
    })

    expect(deployed.players['player-one'].battleArea).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ card: expect.objectContaining({ id: 'BS6-072' }) }),
      ]),
    )
    expect(deployed.pendingOnPlay).toMatchObject({
      playerId: 'player-one',
      sourceInstanceId: source!.instanceId,
      origin: 'hand',
    })
  })

  it('keeps BS6-031 in hand so its OnPlay skill is tested through deployment', () => {
    const state = createCardCheckDemoState('BS6-031')
    const source = state.players['player-one'].hand.find(
      (card) => card.id === 'BS6-031',
    )

    expect(source).toMatchObject({
      id: 'BS6-031',
      type: 'cookie',
      skill: {
        trigger: 'on-play',
        cost: { energy: { yellow: 1 } },
      },
    })
    expect(state.pendingBattle).toBeNull()
    expect(state.pendingOnPlay).toBeNull()

    const deployed = applyGameCommand(state, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: source!.instanceId,
    })

    expect(deployed.players['player-one'].battleArea).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          card: expect.objectContaining({ id: 'BS6-031' }),
        }),
      ]),
    )
    expect(deployed.pendingOnPlay).toMatchObject({
      playerId: 'player-one',
      sourceInstanceId: source!.instanceId,
      origin: 'hand',
    })
  })

  it('keeps BS6-074 in hand so its blue energy and discard costs are testable', () => {
    const state = createCardCheckDemoState('BS6-074')
    const source = state.players['player-one'].hand.find(
      (card) => card.id === 'BS6-074',
    )

    expect(source).toBeDefined()
    expect(source?.type).toBe('cookie')
    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-one'].supportArea).toHaveLength(6)

    const deployed = applyGameCommand(state, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: source!.instanceId,
    })

    expect(deployed.pendingOnPlay).toMatchObject({
      playerId: 'player-one',
      sourceInstanceId: source!.instanceId,
      origin: 'hand',
    })
    expect(deployed.players['player-one'].battleArea).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ card: expect.objectContaining({ id: 'BS6-074' }) }),
      ]),
    )
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

  it('builds BS4-026 OnPlay A/B fixtures with a valid target and Timekeeper', () => {
    const clear = createBs4026OnPlayDemoState(false)
    const blocked = createBs4026OnPlayDemoState(true)
    const clearSource = clear.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS4-026',
    )

    expect(clear.pendingOnPlay).toMatchObject({
      sourceInstanceId: clearSource?.card.instanceId,
    })
    expect(
      clear.players['player-two'].battleArea.some(
        (entry) => entry.card.level <= 2,
      ),
    ).toBe(true)
    expect(blocked.players['player-two'].battleArea[0]?.card.id).toBe('BS6-010')
  })

  it('builds BS6-031 attack-after fixtures through the real resolve command', () => {
    const payable = createBs6031AttackAfterDemoState(true)
    const unpayable = createBs6031AttackAfterDemoState(false)

    expect(payable.pendingOptionalCostAttack).toMatchObject({
      sourceCardName: 'Timekeeper Cookie',
      cost: { energy: { yellow: 1 } },
    })
    expect(
      payable.players['player-one'].supportArea.every((support) => !support.rested),
    ).toBe(true)
    expect(
      unpayable.players['player-one'].supportArea.every((support) => support.rested),
    ).toBe(true)
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
    expect(
      bs6062.players['player-one'].supportArea.filter(
        (support) => support.card.type === 'cookie',
      ),
    ).toHaveLength(3)
    expect(
      bs6062.players['player-one'].supportArea.filter(
        (support) => support.card.type !== 'cookie',
      ).length,
    ).toBeGreaterThan(0)

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
    const bs6057Source = bs6057.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS6-057',
    )?.card
    expect(bs6057Source?.skill?.cost).toMatchObject({
      supportToHand: 1,
      supportToHandType: 'cookie',
    })
    expect(bs6057Source?.skill?.effects).toEqual([
      { kind: 'draw-up-to', max: 1 },
    ])
    expect(bs6057.players['player-one'].supportArea).toEqual(
      expect.arrayContaining([expect.objectContaining({ card: expect.objectContaining({ type: 'cookie' }) })]),
    )
    expect(bs6057.players['player-one'].supportArea).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ card: expect.objectContaining({ id: 'hand-cookie-filler' }) }),
      ]),
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

    const petrification = createBs5TrapDemoState('BS5-065', true)
    expect(petrification.pendingBattle?.stage).toBe('trap')
    expect(
      petrification.players['player-two'].battleArea.every(
        (entry) => entry.rested,
      ),
    ).toBe(true)

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

  it('builds the BS6-016 positive card-check route with one remaining HP', () => {
    const state = createCardCheckDemoState('BS6-016')
    const source = state.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS6-016',
    )

    expect(source).toBeDefined()
    expect(source?.hpCards).toHaveLength(1)
    expect(state.pendingBattle).toMatchObject({
      stage: 'attack-effect',
      attackerPlayerId: 'player-one',
      attackerInstanceId: source?.card.instanceId,
    })

    const effect = source?.card.attackEffects?.[0]
    expect(effect).toMatchObject({
      kind: 'damage',
      condition: { kind: 'source-hp-less-than', amount: 2 },
    })
    expect(
      isEffectConditionMet(state, {
        sourcePlayerId: 'player-one',
        sourceInstanceId: source!.card.instanceId,
      }, effect!),
    ).toBe(true)
  })

  it('builds the BS6-016 negative card-check route above the HP threshold', () => {
    const state = createCardNegativeDemoState('BS6-016')
    const source = state.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS6-016',
    )

    expect(source).toBeDefined()
    expect(source?.hpCards).toHaveLength(3)
    expect(state.pendingBattle).toMatchObject({
      stage: 'attack-effect',
      attackerInstanceId: source?.card.instanceId,
    })

    const effect = source?.card.attackEffects?.[0]
    expect(
      isEffectConditionMet(state, {
        sourcePlayerId: 'player-one',
        sourceInstanceId: source!.card.instanceId,
      }, effect!),
    ).toBe(false)
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

  it('keeps BS2-049 and BS2-050 trap conditions reachable in card-check', () => {
    const drawTrap = createCardCheckDemoState('BS2-049')
    const returnTrap = createCardCheckDemoState('BS2-050')

    expect(drawTrap.pendingBattle?.stage).toBe('trap')
    expect(
      drawTrap.players['player-one'].hand,
    ).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'BS2-049' })]))
    expect(returnTrap.pendingBattle?.stage).toBe('trap')
    expect(returnTrap.players['player-one'].battleArea[0].hpCards).toHaveLength(3)
    expect(
      returnTrap.players['player-one'].hand,
    ).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'BS2-050' })]))
  })

  it('BS6-042 card-check fixture provides three Cookies for its trap condition', () => {
    const state = createCardCheckDemoState('BS6-042')

    expect(
      state.players['player-one'].breakArea.filter((card) => card.type === 'cookie'),
    ).toHaveLength(3)
    expect(getTrapCandidates(state, 'player-one')).toContainEqual(
      expect.objectContaining({ id: 'BS6-042' }),
    )
  })

  it('satisfies BS2-060 opponent-trash condition for the faint trace', () => {
    const state = createCardCheckDemoState('BS2-060')

    expect(state.pendingFaintEffects).toHaveLength(1)
    expect(state.players['player-two'].discardPile).toHaveLength(20)
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

  it('keeps BS7-001 in the candidate Browser fixture, with the LV.3 target boundary enforced', () => {
    const state = createCardCheckDemoState('BS7-001')
    const source = state.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS7-001',
    )
    const target = state.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )

    expect(source?.hpCards).toHaveLength(2)
    expect(target?.card.level).toBe(3)
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
    const pending = paid.pendingAbilityEffect
    expect(pending).toBeDefined()
    expect(
      getEffectSelectionCandidates(
        paid,
        {
          sourcePlayerId: pending!.sourcePlayerId,
          sourceInstanceId: pending!.sourceInstanceId,
        },
        pending!.effects[pending!.effectIndex]!,
      ).map((entry) => entry.instanceId),
    ).toEqual([target!.card.instanceId])

    const resolved = applyGameCommand(paid, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [target!.card.instanceId],
    })
    expect(getEffectiveAttack(resolved, target!.card.instanceId)).toBe(
      target!.card.attack + 1,
    )

    const negative = createCardNegativeDemoState('BS7-001')
    const negativeSource = negative.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS7-001',
    )
    const invalidLv2Target = negative.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )
    expect(negativeSource?.hpCards).toHaveLength(2)
    expect(invalidLv2Target?.card.level).toBe(2)

    const negativePaid = applyGameCommand(negative, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: negativeSource!.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
      hpToTrashTargetIds: [negativeSource!.card.instanceId],
    })
    const negativePending = negativePaid.pendingAbilityEffect
    expect(negativePending).toBeDefined()
    expect(
      getEffectSelectionCandidates(
        negativePaid,
        {
          sourcePlayerId: negativePending!.sourcePlayerId,
          sourceInstanceId: negativePending!.sourceInstanceId,
        },
        negativePending!.effects[negativePending!.effectIndex]!,
      ),
    ).toEqual([])
    expect(() =>
      applyGameCommand(negativePaid, {
        kind: 'resolve-ability-effect',
        playerId: 'player-one',
        targetIds: [invalidLv2Target!.card.instanceId],
      }),
    ).toThrow('選擇的卡牌不是此效果的合法目標。')
  })

  it('keeps BS7-002 in the candidate FLIP fixture with a real red Arena A/B boundary', () => {
    const positive = createCardCheckDemoState('BS7-002')
    const positiveArena = positive.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )
    const positiveTarget = positive.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === positive.pendingBattle?.targetInstanceId,
    )

    expect(positive.pendingBattle).toMatchObject({
      stage: 'flip',
      revealedHpCard: expect.objectContaining({ id: 'BS7-002' }),
    })
    expect(positiveTarget?.card.level).toBe(2)
    expect(positiveArena?.card).toMatchObject({
      energyColor: 'red',
      keywords: ['arena'],
    })

    const resolved = resolveFlip(positive, 'player-one', { activate: true })
    expect(
      resolved.players['player-one'].battleArea.find(
        (entry) => entry.card.instanceId === positiveTarget?.card.instanceId,
      )?.hpCards,
    ).toHaveLength(2)

    const negative = createCardNegativeDemoState('BS7-002')
    const negativeArena = negative.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )
    expect(negativeArena?.card).toMatchObject({ energyColor: 'red', keywords: [] })

    const blocked = resolveFlip(negative, 'player-one', { activate: true })
    expect(blocked.players['player-one'].battleArea[0]?.hpCards).toHaveLength(1)
    expect(blocked.players['player-one'].discardPile).toContainEqual(
      expect.objectContaining({ id: 'BS7-002' }),
    )
  })

  it('keeps BS7-003 On Play condition truthful across the runtime A/B boundary', () => {
    const positive = createCardCheckDemoState('BS7-003')
    const positiveSource = positive.players['player-one'].hand.find(
      (card) => card.id === 'BS7-003',
    )
    const positivePartner = positive.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )

    expect(positiveSource?.skill?.trigger).toBe('on-play')
    expect(positivePartner?.card.keywords).toEqual(['arena'])

    const deployed = applyGameCommand(positive, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: positiveSource!.instanceId,
    })
    expect(deployed.pendingOnPlay).toMatchObject({
      playerId: 'player-one',
      sourceInstanceId: positiveSource!.instanceId,
      origin: 'hand',
    })

    const queued = applyGameCommand(deployed, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: positiveSource!.instanceId,
      trigger: 'on-play',
      paymentIds: [],
    })
    expect(queued.pendingAbilityEffect).toMatchObject({
      effects: [
        {
          kind: 'disable-block',
          condition: {
            kind: 'battle-area-has-keyword',
            keyword: 'arena',
            excludeSource: true,
          },
        },
      ],
    })

    const resolved = applyGameCommand(queued, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(resolved.pendingAbilityEffect).toBeUndefined()
    expect(resolved.blockDisabledUntilTurn?.['player-two']).toBe(
      resolved.turnNumber,
    )

    const negative = createCardNegativeDemoState('BS7-003')
    const negativeSource = negative.players['player-one'].hand.find(
      (card) => card.id === 'BS7-003',
    )
    const negativePartner = negative.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )
    expect(negativePartner?.card.keywords).toEqual([])

    const negativeDeployed = applyGameCommand(negative, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: negativeSource!.instanceId,
    })
    expect(canActivateCookieSkill(
      negativeDeployed,
      'player-one',
      negativeSource!.instanceId,
      'on-play',
    )).toBe(false)
    const negativeResolved = applyGameCommand(negativeDeployed, {
      kind: 'skip-on-play',
      playerId: 'player-one',
      sourceInstanceId: negativeSource!.instanceId,
    })
    expect(negativeResolved.pendingOnPlay).toBeNull()
    expect(negativeResolved.pendingAbilityEffect).toBeUndefined()
    expect(negativeResolved.blockDisabledUntilTurn?.['player-two']).toBeUndefined()
  })

  it('keeps BS7-004 effect-damage condition and red payment on the real skill queue', () => {
    const positive = createCardCheckDemoState('BS7-004')
    const source = positive.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS7-004',
    )
    const target = positive.players['player-two'].battleArea[0]
    const payment = positive.players['player-one'].supportArea[0]

    expect(positive.arenaCookieDealtEffectDamageThisTurn?.['player-one']).toBe(true)
    expect(source?.card.keywords).toEqual(['arena'])
    expect(
      canActivateCookieSkill(
        positive,
        'player-one',
        source!.card.instanceId,
        'activate',
      ),
    ).toBe(true)

    const queued = applyGameCommand(positive, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source!.card.instanceId,
      trigger: 'activate',
      paymentIds: [payment!.card.instanceId],
    })
    expect(queued.pendingAbilityEffect).toMatchObject({
      effects: [
        {
          kind: 'damage',
          amount: 1,
          condition: { kind: 'arena-cookie-dealt-effect-damage-this-turn' },
        },
      ],
    })

    const resolved = applyGameCommand(queued, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [target.card.instanceId],
    })
    expect(
      resolved.players['player-two'].battleArea.find(
        (entry) => entry.card.instanceId === target.card.instanceId,
      )?.hpCards,
    ).toHaveLength(target.hpCards.length - 1)

    const negative = createCardNegativeDemoState('BS7-004')
    const negativeSource = negative.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS7-004',
    )
    expect(negative.arenaCookieDealtEffectDamageThisTurn?.['player-one']).toBe(false)
    expect(
      canActivateCookieSkill(
        negative,
        'player-one',
        negativeSource!.card.instanceId,
        'activate',
      ),
    ).toBe(false)
    expect(() =>
      applyGameCommand(negative, {
        kind: 'begin-activate-skill',
        playerId: 'player-one',
        sourceInstanceId: negativeSource!.card.instanceId,
        trigger: 'activate',
        paymentIds: [negative.players['player-one'].supportArea[0]!.card.instanceId],
      }),
    ).toThrow('目前無法發動這個餅乾技能。')
  })

  it('keeps BS7-006 On Play HP cost and optional draw in order', () => {
    const positive = createCardCheckDemoState('BS7-006')
    const source = positive.players['player-one'].hand.find(
      (card) => card.id === 'BS7-006',
    )
    expect(source?.skill?.trigger).toBe('on-play')

    const deployed = applyGameCommand(positive, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: source!.instanceId,
    })
    const activated = applyGameCommand(deployed, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source!.instanceId,
      trigger: 'on-play',
      paymentIds: [],
      hpToTrashTargetIds: [source!.instanceId],
    })
    expect(
      activated.players['player-one'].battleArea.find(
        (entry) => entry.card.instanceId === source!.instanceId,
      )?.hpCards,
    ).toHaveLength(1)
    expect(activated.pendingAbilityEffect).toMatchObject({
      effects: [{ kind: 'draw-up-to', max: 1 }],
    })

    const drawPending = applyGameCommand(activated, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(drawPending.pendingDrawUpTo).toMatchObject({
      playerId: 'player-one',
      max: 1,
    })
    const drawn = applyGameCommand(drawPending, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-one',
      drawCount: 1,
    })
    expect(drawn.pendingDrawUpTo).toBeNull()
    expect(drawn.players['player-one'].deck).toHaveLength(17)

    const negative = createCardNegativeDemoState('BS7-006')
    const negativeSource = negative.players['player-one'].hand.find(
      (card) => card.id === 'BS7-006',
    )
    const negativeDeployed = applyGameCommand(negative, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: negativeSource!.instanceId,
    })
    const skipped = applyGameCommand(negativeDeployed, {
      kind: 'skip-on-play',
      playerId: 'player-one',
      sourceInstanceId: negativeSource!.instanceId,
    })
    expect(skipped.pendingOnPlay).toBeNull()
    expect(skipped.pendingAbilityEffect).toBeUndefined()
    expect(
      skipped.players['player-one'].battleArea.find(
        (entry) => entry.card.instanceId === negativeSource!.instanceId,
      )?.hpCards,
    ).toHaveLength(2)
  })

  it('keeps BS7-007 On Play damage scoped to either-side Arena Cookies', () => {
    const positive = createCardCheckDemoState('BS7-007')
    const source = positive.players['player-one'].hand.find(
      (card) => card.id === 'BS7-007',
    )
    const opponentArena = positive.players['player-two'].battleArea[0]
    expect(source?.skill?.trigger).toBe('on-play')
    expect(opponentArena?.card.keywords).toEqual(['arena'])

    const deployed = applyGameCommand(positive, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: source!.instanceId,
    })
    const queued = applyGameCommand(deployed, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source!.instanceId,
      trigger: 'on-play',
      paymentIds: [],
    })
    expect(queued.pendingAbilityEffect).toMatchObject({
      effects: [
        {
          kind: 'damage',
          target: { side: 'either', keyword: 'arena' },
        },
      ],
    })
    const resolved = applyGameCommand(queued, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [opponentArena!.card.instanceId],
    })
    expect(
      resolved.players['player-two'].battleArea[0]?.hpCards,
    ).toHaveLength(opponentArena!.hpCards.length - 1)

    const negative = createCardNegativeDemoState('BS7-007')
    const negativeSource = negative.players['player-one'].hand.find(
      (card) => card.id === 'BS7-007',
    )
    const negativeDeployed = applyGameCommand(negative, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: negativeSource!.instanceId,
    })
    const skipped = applyGameCommand(negativeDeployed, {
      kind: 'skip-on-play',
      playerId: 'player-one',
      sourceInstanceId: negativeSource!.instanceId,
    })
    expect(skipped.pendingOnPlay).toBeNull()
    expect(skipped.pendingAbilityEffect).toBeUndefined()
    expect(skipped.players['player-two'].battleArea[0]?.hpCards).toHaveLength(6)
  })

  it('keeps BS7-008 Arena HP payment before the self-side HP gain', () => {
    const positive = createCardCheckDemoState('BS7-008')
    const source = positive.players['player-one'].hand.find(
      (card) => card.id === 'BS7-008',
    )
    const arenaCost = positive.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )
    expect(arenaCost?.card.keywords).toEqual(['arena'])

    const deployed = applyGameCommand(positive, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: source!.instanceId,
    })
    const paid = applyGameCommand(deployed, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source!.instanceId,
      trigger: 'on-play',
      paymentIds: [],
      hpToTrashTargetIds: [arenaCost!.card.instanceId],
    })
    expect(
      paid.players['player-one'].battleArea.find(
        (entry) => entry.card.instanceId === arenaCost!.card.instanceId,
      )?.hpCards,
    ).toHaveLength(arenaCost!.hpCards.length - 1)
    expect(paid.pendingAbilityEffect).toMatchObject({
      effects: [{ kind: 'gain-hp', amount: 1 }],
    })
    const gained = applyGameCommand(paid, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [source!.instanceId],
    })
    expect(
      gained.players['player-one'].battleArea.find(
        (entry) => entry.card.instanceId === source!.instanceId,
      )?.hpCards,
    ).toHaveLength(4)

    const negative = createCardNegativeDemoState('BS7-008')
    const negativeSource = negative.players['player-one'].hand.find(
      (card) => card.id === 'BS7-008',
    )
    const negativeDeployed = applyGameCommand(negative, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: negativeSource!.instanceId,
    })
    const skipped = applyGameCommand(negativeDeployed, {
      kind: 'skip-on-play',
      playerId: 'player-one',
      sourceInstanceId: negativeSource!.instanceId,
    })
    expect(skipped.pendingOnPlay).toBeNull()
    expect(skipped.pendingAbilityEffect).toBeUndefined()
    expect(
      skipped.players['player-one'].battleArea.find(
        (entry) => entry.card.instanceId === negativeSource!.instanceId,
      )?.hpCards,
    ).toHaveLength(3)
  })

  it('keeps BS7-010 faint damage behind the remaining Arena condition', () => {
    const positive = createCardCheckDemoState('BS7-010')
    const faint = positive.pendingFaintEffects?.[0]
    const positiveArena = positive.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )
    const positiveTarget = positive.players['player-two'].battleArea[0]

    expect(faint?.effect).toMatchObject({
      kind: 'damage',
      amount: 1,
      condition: {
        kind: 'battle-area-has-keyword',
        side: 'self',
        keyword: 'arena',
      },
    })
    expect(positiveArena?.card.keywords).toEqual(['arena'])
    expect(isEffectConditionMet(positive, faint!.context, faint!.effect)).toBe(true)

    const resolved = resolveFaintEffect(positive, [positiveTarget!.card.instanceId])
    expect(resolved.pendingFaintEffects).toBeUndefined()
    expect(resolved.players['player-two'].battleArea[0]?.hpCards).toHaveLength(
      positiveTarget!.hpCards.length - 1,
    )

    const negative = createCardNegativeDemoState('BS7-010')
    const negativeFaint = negative.pendingFaintEffects?.[0]
    const negativeTarget = negative.players['player-two'].battleArea[0]
    expect(
      negative.players['player-one'].battleArea.find(
        (entry) => entry.card.instanceId === 'self-extra-1',
      )?.card.keywords,
    ).toEqual([])
    expect(isEffectConditionMet(negative, negativeFaint!.context, negativeFaint!.effect)).toBe(false)

    const blocked = resolveFaintEffect(negative, [negativeTarget!.card.instanceId])
    expect(blocked.pendingFaintEffects).toBeUndefined()
    expect(blocked.players['player-two'].battleArea[0]?.hpCards).toHaveLength(
      negativeTarget!.hpCards.length,
    )
  })

  it('keeps BS7-011 FLIP draw behind both hand-size and red Arena conditions', () => {
    const positive = createCardCheckDemoState('BS7-011')
    const positiveArena = positive.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )
    expect(positive.pendingBattle).toMatchObject({
      stage: 'flip',
      revealedHpCard: expect.objectContaining({ id: 'BS7-011' }),
    })
    expect(positive.players['player-one'].hand).toHaveLength(4)
    expect(positiveArena?.card).toMatchObject({
      energyColor: 'red',
      keywords: ['arena'],
    })

    const resolved = resolveFlip(positive, 'player-one', { activate: true })
    expect(resolved.players['player-one'].hand).toHaveLength(6)
    expect(resolved.players['player-one'].discardPile).toContainEqual(
      expect.objectContaining({ id: 'BS7-011' }),
    )

    const negative = createCardNegativeDemoState('BS7-011')
    const negativeArena = negative.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )
    expect(negativeArena?.card).toMatchObject({
      energyColor: 'red',
      keywords: [],
    })
    const blocked = resolveFlip(negative, 'player-one', { activate: true })
    expect(blocked.players['player-one'].hand).toHaveLength(4)
    expect(blocked.players['player-one'].discardPile).toContainEqual(
      expect.objectContaining({ id: 'BS7-011' }),
    )
  })

  it('keeps BS7-012 attack bonus locked to the Arena HP cost Cookie', () => {
    const positive = createCardCheckDemoState('BS7-012')
    const source = positive.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS7-012',
    )
    const arenaCost = positive.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )
    expect(source?.card.skill).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { hpToTrash: { amount: 1, keyword: 'arena' } },
    })
    expect(arenaCost?.card.keywords).toEqual(['arena'])

    const queued = applyGameCommand(positive, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source!.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
      hpToTrashTargetIds: [arenaCost!.card.instanceId],
    })
    expect(queued.costRecord).toMatchObject({
      hpTrashCookieInstanceId: arenaCost!.card.instanceId,
    })
    expect(queued.pendingAbilityEffect).toMatchObject({
      effects: [
        {
          kind: 'modify-attack',
          target: { side: 'self', costSelected: true },
        },
      ],
    })

    const resolved = applyGameCommand(queued, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [arenaCost!.card.instanceId],
    })
    expect(
      resolved.players['player-one'].battleArea.find(
        (entry) => entry.card.instanceId === arenaCost!.card.instanceId,
      )?.hpCards,
    ).toHaveLength(arenaCost!.hpCards.length - 1)
    expect(getEffectiveAttack(resolved, arenaCost!.card.instanceId)).toBe(
      arenaCost!.card.attack + 1,
    )

    const negative = createCardNegativeDemoState('BS7-012')
    const negativeSource = negative.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS7-012',
    )
    expect(
      canActivateCookieSkill(
        negative,
        'player-one',
        negativeSource!.card.instanceId,
        'activate',
      ),
    ).toBe(false)
  })

  it('applies BS7-013 only to red LV.2+ Arena effect-damage sources', () => {
    const positive = createCardCheckDemoState('BS7-013')
    const positiveSource = positive.players['player-one'].hand.find(
      (card) => card.id === 'BS7-013-effect-source',
    )
    const positiveTarget = positive.players['player-two'].battleArea[0]
    expect(positiveSource?.skill?.effects[0]).toMatchObject({
      kind: 'damage',
      amount: 1,
    })

    const positiveDeployed = applyGameCommand(positive, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: positiveSource!.instanceId,
    })
    const positiveQueued = applyGameCommand(positiveDeployed, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: positiveSource!.instanceId,
      trigger: 'on-play',
      paymentIds: [],
    })
    const positiveResolved = applyGameCommand(positiveQueued, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [positiveTarget!.card.instanceId],
    })
    expect(
      positiveResolved.players['player-two'].battleArea[0]?.hpCards,
    ).toHaveLength(positiveTarget!.hpCards.length - 2)

    const negative = createCardNegativeDemoState('BS7-013')
    const negativeSource = negative.players['player-one'].hand.find(
      (card) => card.id === 'BS7-013-effect-source',
    )
    const negativeTarget = negative.players['player-two'].battleArea[0]
    const negativeDeployed = applyGameCommand(negative, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: negativeSource!.instanceId,
    })
    const negativeQueued = applyGameCommand(negativeDeployed, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: negativeSource!.instanceId,
      trigger: 'on-play',
      paymentIds: [],
    })
    const negativeResolved = applyGameCommand(negativeQueued, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [negativeTarget!.card.instanceId],
    })
    expect(
      negativeResolved.players['player-two'].battleArea[0]?.hpCards,
    ).toHaveLength(negativeTarget!.hpCards.length - 1)
  })

  it('keeps BS7-014 named-cookie attack aura separate from its Activate damage', () => {
    const positive = createCardCheckDemoState('BS7-014')
    const positiveSource = positive.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS7-014',
    )
    const positivePartner = positive.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )
    expect(positivePartner?.card.name).toBe('Kouign-Amann Cookie')
    expect(getEffectiveAttack(positive, positiveSource!.card.instanceId)).toBe(
      positiveSource!.card.attack + 1,
    )

    const positiveDiscard = positive.players['player-one'].hand[0]
    const positiveTarget = positive.players['player-two'].battleArea[1]
    const positiveQueued = applyGameCommand(positive, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: positiveSource!.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
      discardHandIds: [positiveDiscard.instanceId],
    })
    const positiveResolved = applyGameCommand(positiveQueued, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [positiveTarget!.card.instanceId],
    })
    expect(positiveResolved.players['player-two'].battleArea[1]?.hpCards)
      .toHaveLength(positiveTarget!.hpCards.length - 1)

    const negative = createCardNegativeDemoState('BS7-014')
    const negativeSource = negative.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS7-014',
    )
    const negativePartner = negative.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )
    expect(negativePartner?.card.name).toBe('self-extra-1')
    expect(getEffectiveAttack(negative, negativeSource!.card.instanceId)).toBe(
      negativeSource!.card.attack,
    )
  })

  it('prepares BS7-015 Arena attack Then damage with positive and negative conditions', () => {
    const positive = createCardCheckDemoState('BS7-015')
    const positiveSource = positive.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS7-015',
    )
    const positiveEffect = positive.pendingBattle?.attackEffects[0]
    if (!positiveSource || !positiveEffect) throw new Error('BS7-015 positive fixture is incomplete')
    expect(positive.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )?.card.keywords).toContain('arena')
    expect(isEffectConditionMet(
      positive,
      { sourcePlayerId: 'player-one', sourceInstanceId: positiveSource.card.instanceId },
      positiveEffect,
    )).toBe(true)
    const positiveTarget = positive.players['player-two'].battleArea[0]
    const positiveResolved = resolveAttackEffect(positive, 'player-one', [positiveTarget.card.instanceId])
    expect(positiveResolved.players['player-two'].battleArea[0]?.hpCards).toHaveLength(
      positiveTarget.hpCards.length - 2,
    )

    const negative = createCardNegativeDemoState('BS7-015')
    const negativeSource = negative.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS7-015',
    )
    const negativeEffect = negative.pendingBattle?.attackEffects[0]
    if (!negativeSource || !negativeEffect) throw new Error('BS7-015 negative fixture is incomplete')
    expect(negative.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )?.card.keywords).not.toContain('arena')
    expect(isEffectConditionMet(
      negative,
      { sourcePlayerId: 'player-one', sourceInstanceId: negativeSource.card.instanceId },
      negativeEffect,
    )).toBe(false)
    const negativeTarget = negative.players['player-two'].battleArea[0]
    const negativeResolved = resolveAttackEffect(negative, 'player-one', [negativeTarget.card.instanceId])
    expect(negativeResolved.players['player-two'].battleArea[0]?.hpCards).toHaveLength(
      negativeTarget.hpCards.length,
    )
  })

  it('keeps BS7-016 On Play draw gated by the effect-damage flag', () => {
    const positive = createCardCheckDemoState('BS7-016')
    const positiveSource = positive.players['player-one'].hand.find(
      (card) => card.id === 'BS7-016',
    )
    expect(positive.arenaCookieDealtEffectDamageThisTurn?.['player-one']).toBe(true)
    const positiveDeployed = applyGameCommand(positive, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: positiveSource!.instanceId,
    })
    const positiveQueued = applyGameCommand(positiveDeployed, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: positiveSource!.instanceId,
      trigger: 'on-play',
      paymentIds: [],
    })
    expect(positiveQueued.pendingAbilityEffect).toMatchObject({
      effects: [
        {
          kind: 'draw-up-to',
          max: 1,
          condition: { kind: 'arena-cookie-dealt-effect-damage-this-turn' },
        },
      ],
    })
    const positiveDrawPending = applyGameCommand(positiveQueued, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(positiveDrawPending.pendingDrawUpTo).toMatchObject({ max: 1 })
    const positiveDrawn = applyGameCommand(positiveDrawPending, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-one',
      drawCount: 1,
    })
    expect(positiveDrawn.players['player-one'].deck).toHaveLength(14)

    const negative = createCardNegativeDemoState('BS7-016')
    const negativeSource = negative.players['player-one'].hand.find(
      (card) => card.id === 'BS7-016',
    )
    expect(negative.arenaCookieDealtEffectDamageThisTurn?.['player-one']).toBe(false)
    const negativeDeployed = applyGameCommand(negative, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: negativeSource!.instanceId,
    })
    const negativeSkipped = applyGameCommand(negativeDeployed, {
      kind: 'skip-on-play',
      playerId: 'player-one',
      sourceInstanceId: negativeSource!.instanceId,
    })
    expect(negativeSkipped.pendingOnPlay).toBeNull()
    expect(negativeSkipped.pendingAbilityEffect).toBeUndefined()
    expect(negativeSkipped.players['player-one'].deck).toHaveLength(15)
  })

  it('keeps BS7-017 draw-then-discard gated by a low-HP Arena Cookie', () => {
    const positive = createCardCheckDemoState('BS7-017')
    const positiveSource = positive.players['player-one'].hand.find(
      (card) => card.id === 'BS7-017',
    )
    const positivePartner = positive.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )
    expect(positivePartner?.card.keywords).toContain('arena')
    expect(positivePartner?.hpCards).toHaveLength(2)
    const positiveDeployed = applyGameCommand(positive, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: positiveSource!.instanceId,
    })
    const positiveQueued = applyGameCommand(positiveDeployed, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: positiveSource!.instanceId,
      trigger: 'on-play',
      paymentIds: [],
    })
    expect(positiveQueued.pendingAbilityEffect).toMatchObject({
      effects: [
        {
          kind: 'draw-up-to-then-discard',
          max: 2,
          discardCount: 1,
          condition: { maxRemainingHp: 2 },
        },
      ],
    })
    const positiveDrawPending = applyGameCommand(positiveQueued, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(positiveDrawPending.pendingDrawUpTo).toMatchObject({
      max: 2,
      afterEffectsRequireDraw: true,
    })
    const positiveDrawn = applyGameCommand(positiveDrawPending, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-one',
      drawCount: 2,
    })
    expect(positiveDrawn.pendingOpponentHandDiscard).toMatchObject({ count: 1 })
    const positiveDiscarded = applyGameCommand(positiveDrawn, {
      kind: 'resolve-opponent-hand-discard',
      playerId: 'player-one',
      cardIds: [positiveDrawn.players['player-one'].hand[0]!.instanceId],
    })
    expect(positiveDiscarded.pendingOpponentHandDiscard).toBeNull()

    const negative = createCardNegativeDemoState('BS7-017')
    const negativeSource = negative.players['player-one'].hand.find(
      (card) => card.id === 'BS7-017',
    )
    expect(negative.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )?.card.keywords).not.toContain('arena')
    const negativeDeployed = applyGameCommand(negative, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: negativeSource!.instanceId,
    })
    const negativeSkipped = applyGameCommand(negativeDeployed, {
      kind: 'skip-on-play',
      playerId: 'player-one',
      sourceInstanceId: negativeSource!.instanceId,
    })
    expect(negativeSkipped.pendingOnPlay).toBeNull()
    expect(negativeSkipped.pendingAbilityEffect).toBeUndefined()
    expect(negativeSkipped.pendingDrawUpTo).toBeUndefined()
  })

  it('keeps BS7-018 attack Then target damage gated by another Arena Cookie', () => {
    const positive = createCardCheckDemoState('BS7-018')
    const positiveSource = positive.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS7-018',
    )
    const positiveEffect = positive.pendingBattle?.attackEffects[0]
    if (!positiveSource || !positiveEffect) throw new Error('BS7-018 positive fixture is incomplete')
    expect(isEffectConditionMet(
      positive,
      { sourcePlayerId: 'player-one', sourceInstanceId: positiveSource.card.instanceId },
      positiveEffect,
    )).toBe(true)
    const positiveTarget = positive.players['player-two'].battleArea[0]
    const positiveResolved = resolveAttackEffect(positive, 'player-one', [positiveTarget.card.instanceId])
    expect(positiveResolved.players['player-two'].battleArea[0]?.hpCards).toHaveLength(
      positiveTarget.hpCards.length - 1,
    )

    const negative = createCardNegativeDemoState('BS7-018')
    const negativeSource = negative.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS7-018',
    )
    const negativeEffect = negative.pendingBattle?.attackEffects[0]
    if (!negativeSource || !negativeEffect) throw new Error('BS7-018 negative fixture is incomplete')
    expect(isEffectConditionMet(
      negative,
      { sourcePlayerId: 'player-one', sourceInstanceId: negativeSource.card.instanceId },
      negativeEffect,
    )).toBe(false)
    const negativeTarget = negative.players['player-two'].battleArea[0]
    const negativeResolved = resolveAttackEffect(negative, 'player-one', [negativeTarget.card.instanceId])
    expect(negativeResolved.players['player-two'].battleArea[0]?.hpCards).toHaveLength(
      negativeTarget.hpCards.length,
    )
  })

  it('keeps BS7-019 optional red-energy attack Then damage gated by Arena', () => {
    const positive = createCardCheckDemoState('BS7-019')
    const positiveSource = positive.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS7-019',
    )
    const positiveTarget = positive.players['player-two'].battleArea[0]
    const positivePending = resolveAttackEffect(positive, 'player-one', [])
    expect(positivePending.pendingOptionalCostAttack).toMatchObject({
      cost: { energy: { red: 1 } },
    })
    const positivePayment = positive.players['player-one'].supportArea[0]!.card.instanceId
    const positiveResolved = resolveOptionalCostAttack(
      positivePending,
      'player-one',
      'pay',
      [],
      [positiveTarget.card.instanceId],
      [positivePayment],
    )
    expect(positiveResolved.players['player-two'].battleArea[0]?.hpCards).toHaveLength(
      positiveTarget.hpCards.length - 1,
    )
    expect(positiveSource).toBeDefined()

    const negative = createCardNegativeDemoState('BS7-019')
    const negativeTarget = negative.players['player-two'].battleArea[0]
    const negativePending = resolveAttackEffect(negative, 'player-one', [])
    expect(negativePending.pendingOptionalCostAttack).toBeUndefined()
    expect(negativePending.players['player-two'].battleArea[0]?.hpCards).toHaveLength(
      negativeTarget.hpCards.length,
    )
  })

  it('keeps BS7-020 item damage gated by a two-level break lead', () => {
    const positive = createCardCheckDemoState('BS7-020')
    expect(positive.players['player-one'].breakArea.map((card) => card.level)).toEqual([3, 3])
    const positiveItem = positive.players['player-one'].hand.find(
      (card) => card.id === 'BS7-020',
    )
    if (!positiveItem) throw new Error('BS7-020 positive fixture is incomplete')
    const positivePending = applyGameCommand(positive, {
      kind: 'begin-play-item',
      playerId: 'player-one',
      instanceId: positiveItem.instanceId,
      paymentIds: ['support-pay-0'],
    })
    const positiveResolved = applyGameCommand(positivePending, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: ['opp-lv1'],
    })
    expect(positiveResolved.players['player-two'].battleArea[0]?.hpCards).toHaveLength(3)

    const negative = createCardNegativeDemoState('BS7-020')
    expect(negative.players['player-one'].breakArea.map((card) => card.level)).toEqual([2, 2])
    const negativeItem = negative.players['player-one'].hand.find(
      (card) => card.id === 'BS7-020',
    )
    if (!negativeItem) throw new Error('BS7-020 negative fixture is incomplete')
    const negativePending = applyGameCommand(negative, {
      kind: 'begin-play-item',
      playerId: 'player-one',
      instanceId: negativeItem.instanceId,
      paymentIds: ['support-pay-0'],
    })
    expect(negativePending.pendingAbilityEffect).toBeUndefined()
    expect(negativePending.players['player-two'].battleArea[0]?.hpCards).toHaveLength(6)
  })

  it('keeps BS7-021 Arena trap response gated by the defender board', () => {
    const positive = createCardCheckDemoState('BS7-021')
    const positiveTrap = positive.players['player-one'].hand.find(
      (card) => card.id === 'BS7-021',
    )
    expect(positiveTrap).toBeDefined()
    expect(getTrapCandidates(positive, 'player-one')).toContainEqual(
      expect.objectContaining({ id: 'BS7-021' }),
    )
    const positivePlayed = playTrap(positive, 'player-one', {
      trapInstanceId: positiveTrap!.instanceId,
      paymentIds: ['support-pay-0', 'support-pay-1'],
      targetIds: ['trap-attacker'],
    })
    expect(positivePlayed.pendingBattle?.stage).toBe('damage')
    expect(positivePlayed.pendingBattle?.damageTargetInstanceId).toBe('trap-attacker')

    const negative = createCardNegativeDemoState('BS7-021')
    expect(getTrapCandidates(negative, 'player-one')).toEqual([])
  })

  it('keeps BS7-022 stage damage gated by the Arena effect-damage flag', () => {
    const positive = createCardCheckDemoState('BS7-022')
    expect(positive.arenaCookieDealtEffectDamageThisTurn?.['player-one']).toBe(true)
    const stage = positive.players['player-one'].hand.find(
      (card) => card.id === 'BS7-022',
    )
    expect(stage?.stageAbility?.effects).toMatchObject([
      {
        kind: 'damage',
        amount: 1,
        condition: { kind: 'arena-cookie-dealt-effect-damage-this-turn' },
      },
    ])

    const negative = createCardNegativeDemoState('BS7-022')
    expect(negative.arenaCookieDealtEffectDamageThisTurn?.['player-one']).toBe(false)
  })

  it('keeps BS7-023 as an attack-only Arena Cookie in the candidate Browser fixture', () => {
    const positive = createCardCheckDemoState('BS7-023')
    const positiveSource = positive.players['player-one'].hand.find(
      (entry) => entry.id === 'BS7-023',
    )

    expect(positiveSource).toMatchObject({
      name: 'Honorable Paladin Trainee',
      type: 'cookie',
      level: 2,
      hp: 3,
      attack: 2,
      attackCost: 2,
      attackEnergyCost: { yellow: 1, neutral: 1 },
      keywords: ['arena'],
    })
    expect(positiveSource?.skill).toBeUndefined()

    const negative = createCardNegativeDemoState('BS7-023')
    expect(negative.players['player-one'].hand.some((card) => card.id === 'BS7-023')).toBe(true)
    expect(
      negative.players['player-one'].supportArea.every((support) => support.rested),
    ).toBe(true)
    expect(negative.players['player-two'].battleArea[0]?.hpCards).toHaveLength(6)
  })

  it('keeps BS7-024 HP-return payment and attacked-Cookie damage on the same optional path', () => {
    const positive = createCardCheckDemoState('BS7-024')
    const positiveTarget = positive.players['player-two'].battleArea[0]
    const positivePartner = positive.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )
    if (!positiveTarget || !positivePartner) {
      throw new Error('BS7-024 positive fixture is incomplete')
    }
    const positivePending = resolveAttackEffect(positive, 'player-one', [])
    expect(positivePending.pendingOptionalCostAttack).toMatchObject({
      cost: { hpToHand: { amount: 1, keyword: 'arena' } },
    })
    const returnedHpId = positivePartner.hpCards.at(-1)?.instanceId
    if (!returnedHpId) throw new Error('BS7-024 positive HP fixture is incomplete')
    const positiveResolved = resolveOptionalCostAttack(
      positivePending,
      'player-one',
      'pay',
      [],
      [positiveTarget.card.instanceId],
      [],
      [],
      [],
      [],
      ['self-extra-1'],
    )
    expect(
      positiveResolved.players['player-one'].battleArea.find(
        (entry) => entry.card.instanceId === 'self-extra-1',
      )?.hpCards,
    ).toHaveLength(positivePartner.hpCards.length - 1)
    expect(positiveResolved.players['player-one'].hand).toContainEqual(
      expect.objectContaining({ instanceId: returnedHpId }),
    )
    expect(positiveResolved.players['player-two'].battleArea[0]?.hpCards).toHaveLength(
      positiveTarget.hpCards.length - 1,
    )

    const negative = createCardNegativeDemoState('BS7-024')
    const negativeTarget = negative.players['player-two'].battleArea[0]
    const negativePending = resolveAttackEffect(negative, 'player-one', [])
    expect(negativePending.pendingOptionalCostAttack).toMatchObject({
      cost: { hpToHand: { amount: 1, keyword: 'arena' } },
    })
    expect(
      negative.players['player-one'].battleArea.find(
        (entry) => entry.card.instanceId === 'self-extra-1',
      )?.card.keywords,
    ).not.toContain('arena')
    const negativeSkipped = resolveOptionalCostAttack(
      negativePending,
      'player-one',
      'skip',
    )
    expect(negativeSkipped.players['player-two'].battleArea[0]?.hpCards).toHaveLength(
      negativeTarget!.hpCards.length,
    )
    expect(
      negativeSkipped.players['player-one'].battleArea.find(
        (entry) => entry.card.instanceId === 'self-extra-1',
      )?.hpCards,
    ).toHaveLength(4)
  })

  it('BS7-024 queues a replacement when its HP-return cost defeats an Arena Cookie', () => {
    const state = createCardCheckDemoState('BS7-024')
    const target = state.players['player-two'].battleArea[0]
    const partner = state.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )
    if (!target || !partner) {
      throw new Error('BS7-024 replacement fixture is incomplete')
    }
    partner.hpCards = [partner.hpCards.at(-1)!]

    const pending = resolveAttackEffect(state, 'player-one', [])
    const result = resolveOptionalCostAttack(
      pending,
      'player-one',
      'pay',
      [],
      [target.card.instanceId],
      [],
      [],
      [],
      [],
      ['self-extra-1'],
    )

    expect(
      result.players['player-one'].battleArea.some(
        (entry) => entry.card.instanceId === 'self-extra-1',
      ),
    ).toBe(false)
    expect(result.players['player-one'].breakArea).toContainEqual(partner.card)
    expect(result.pendingReplacement).toMatchObject({
      tasks: [{ playerId: 'player-one', remaining: 1 }],
    })
  })

  it('keeps BS7-025 yellow Arena FLIP HP gain gated by the real colour condition', () => {
    const positive = createCardCheckDemoState('BS7-025')
    const positiveArena = positive.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )
    const positiveTarget = positive.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === positive.pendingBattle?.targetInstanceId,
    )

    expect(positive.pendingBattle).toMatchObject({
      stage: 'flip',
      revealedHpCard: expect.objectContaining({ id: 'BS7-025' }),
    })
    expect(positiveTarget?.card.level).toBe(2)
    expect(positiveArena?.card).toMatchObject({
      energyColor: 'yellow',
      keywords: ['arena'],
    })
    const resolved = resolveFlip(positive, 'player-one', { activate: true })
    expect(
      resolved.players['player-one'].battleArea.find(
        (entry) => entry.card.instanceId === positiveTarget?.card.instanceId,
      )?.hpCards,
    ).toHaveLength(2)

    const negative = createCardNegativeDemoState('BS7-025')
    const negativeArena = negative.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )
    expect(negativeArena?.card).toMatchObject({ energyColor: 'yellow', keywords: [] })
    const blocked = resolveFlip(negative, 'player-one', { activate: true })
    expect(blocked.players['player-one'].battleArea[0]?.hpCards).toHaveLength(1)
    expect(blocked.players['player-one'].discardPile).toContainEqual(
      expect.objectContaining({ id: 'BS7-025' }),
    )
  })

  it('keeps BS7-026 self-break payment before the optional Arena HP target', () => {
    const positive = createCardCheckDemoState('BS7-026')
    const positiveSource = positive.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS7-026',
    )
    const positiveTarget = positive.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )
    if (!positiveSource || !positiveTarget) throw new Error('BS7-026 positive fixture is incomplete')
    const positivePending = resolveAttackEffect(positive, 'player-one', [])
    expect(positivePending.pendingOptionalCostAttack).toMatchObject({
      cost: { energy: {}, selfToBreakArea: true },
    })
    const positiveResolved = resolveOptionalCostAttack(
      positivePending,
      'player-one',
      'pay',
      [],
      [positiveTarget.card.instanceId],
    )
    expect(positiveResolved.players['player-one'].battleArea).not.toContainEqual(
      expect.objectContaining({ card: expect.objectContaining({ id: 'BS7-026' }) }),
    )
    expect(positiveResolved.players['player-one'].breakArea).toContainEqual(
      expect.objectContaining({ id: 'BS7-026' }),
    )
    expect(
      positiveResolved.players['player-one'].battleArea.find(
        (entry) => entry.card.instanceId === 'self-extra-1',
      )?.hpCards,
    ).toHaveLength(3)

    const negative = createCardNegativeDemoState('BS7-026')
    const negativePending = resolveAttackEffect(negative, 'player-one', [])
    expect(negativePending.pendingOptionalCostAttack).toBeUndefined()
    expect(negative.players['player-one'].battleArea).toContainEqual(
      expect.objectContaining({ card: expect.objectContaining({ id: 'BS7-026' }) }),
    )
    expect(negative.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )?.hpCards).toHaveLength(2)
  })

  it('keeps BS7-027 yellow Activate gated by the Arena break-area event', () => {
    const positive = createCardCheckDemoState('BS7-027')
    const source = positive.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS7-027',
    )
    const target = positive.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )
    const paymentId = positive.players['player-one'].supportArea[0]?.card.instanceId
    if (!source || !target || !paymentId) throw new Error('BS7-027 positive fixture is incomplete')

    expect(positive.arenaCookiesPlacedInBreakThisTurn?.['player-one']).toBe(1)
    expect(positive.players['player-one'].breakArea).toContainEqual(
      expect.objectContaining({ keywords: ['arena'] }),
    )
    expect(canActivateCookieSkill(
      positive,
      'player-one',
      source.card.instanceId,
      'activate',
    )).toBe(true)

    const paid = applyGameCommand(positive, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.card.instanceId,
      trigger: 'activate',
      paymentIds: [paymentId],
    })
    const resolved = applyGameCommand(paid, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [target.card.instanceId],
    })
    expect(resolved.attackModifiers).toContainEqual(
      expect.objectContaining({
        targetInstanceId: target.card.instanceId,
        amount: 2,
      }),
    )

    const negative = createCardNegativeDemoState('BS7-027')
    const negativeSource = negative.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS7-027',
    )
    expect(negative.arenaCookiesPlacedInBreakThisTurn?.['player-one']).toBe(0)
    expect(negative.players['player-one'].breakArea).not.toContainEqual(
      expect.objectContaining({ keywords: ['arena'] }),
    )
    expect(canActivateCookieSkill(
      negative,
      'player-one',
      negativeSource!.card.instanceId,
      'activate',
    )).toBe(false)
  })

  it('keeps BS7-028 through BS7-032 behind their Arena break-event conditions', () => {
    const drawPositive = createCardCheckDemoState('BS7-028')
    const drawSource = drawPositive.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS7-028',
    )
    const drawPaid = applyGameCommand(drawPositive, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: drawSource!.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
    })
    const drawWindow = applyGameCommand(drawPaid, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(drawWindow.pendingDrawUpTo).toBeDefined()
    const drawResolved = applyGameCommand(drawWindow, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-one',
      drawCount: 1,
    })
    expect(drawResolved.players['player-one'].deck).toHaveLength(
      drawPositive.players['player-one'].deck.length - 1,
    )

    const drawNegative = createCardNegativeDemoState('BS7-028')
    const drawNegativeSource = drawNegative.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS7-028',
    )
    expect(canActivateCookieSkill(
      drawNegative,
      'player-one',
      drawNegativeSource!.card.instanceId,
      'activate',
    )).toBe(false)

    const damagePositive = createCardCheckDemoState('BS7-029')
    const damageSource = damagePositive.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS7-029',
    )
    const damagePayment = damagePositive.players['player-one'].supportArea[0]!.card.instanceId
    const damagePaid = applyGameCommand(damagePositive, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: damageSource!.card.instanceId,
      trigger: 'activate',
      paymentIds: [damagePayment],
    })
    const damageTarget = damagePositive.players['player-two'].battleArea[0]
    const damageResolved = applyGameCommand(damagePaid, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [damageTarget.card.instanceId],
    })
    expect(damageResolved.players['player-two'].battleArea[0]?.hpCards).toHaveLength(
      damageTarget.hpCards.length - 2,
    )

    const flipPositive = createCardCheckDemoState('BS7-030')
    const flipTarget = flipPositive.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === flipPositive.pendingBattle?.targetInstanceId,
    )
    expect(flipPositive.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )?.card.energyColor).toBe('yellow')
    const flipResolved = resolveFlip(flipPositive, 'player-one', { activate: true })
    expect(flipResolved.players['player-one'].deck).toHaveLength(
      flipPositive.players['player-one'].deck.length - 2,
    )
    expect(flipTarget).toBeDefined()

    const flipNegative = createCardNegativeDemoState('BS7-030')
    expect(flipNegative.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )?.card.keywords).toEqual([])
    const flipBlocked = resolveFlip(flipNegative, 'player-one', { activate: true })
    expect(flipBlocked.players['player-one'].deck).toHaveLength(
      flipNegative.players['player-one'].deck.length,
    )

    const onPlayPositive = createCardCheckDemoState('BS7-031')
    const onPlaySource = onPlayPositive.players['player-one'].hand.find(
      (card) => card.id === 'BS7-031',
    )
    const onPlayTarget = onPlayPositive.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'self-extra-1',
    )
    const onPlayDeployed = applyGameCommand(onPlayPositive, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: onPlaySource!.instanceId,
    })
    const onPlayPaid = applyGameCommand(onPlayDeployed, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: onPlaySource!.instanceId,
      trigger: 'on-play',
      paymentIds: [onPlayPositive.players['player-one'].supportArea[0]!.card.instanceId],
      discardHandIds: [onPlayPositive.players['player-one'].hand.find(
        (card) => card.instanceId !== onPlaySource!.instanceId,
      )!.instanceId],
    })
    const onPlayResolved = applyGameCommand(onPlayPaid, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [onPlayTarget!.card.instanceId],
    })
    expect(onPlayResolved.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === onPlayTarget!.card.instanceId,
    )?.hpCards).toHaveLength(onPlayTarget!.hpCards.length + 1)

    const restPositive = createCardCheckDemoState('BS7-032')
    const restSource = restPositive.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS7-032',
    )
    expect(restSource?.rested).toBe(true)
    const restPaid = applyGameCommand(restPositive, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: restSource!.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
    })
    const restResolved = applyGameCommand(restPaid, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [restSource!.card.instanceId],
    })
    expect(restResolved.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === restSource!.card.instanceId,
    )?.rested).toBe(false)
    const restNegative = createCardNegativeDemoState('BS7-032')
    const restNegativeSource = restNegative.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS7-032',
    )
    expect(canActivateCookieSkill(
      restNegative,
      'player-one',
      restNegativeSource!.card.instanceId,
      'activate',
    )).toBe(false)
  })

  it('BS6-036 card-check fixture exposes an LV.3 break Cookie for its HP-gain Then', () => {
    const state = createCardCheckDemoState('BS6-036')
    const source = state.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS6-036',
    )

    expect(source).toBeDefined()
    expect(
      state.players['player-one'].breakArea.filter((card) => card.level === 3),
    ).toHaveLength(1)

    const pending = resolveAttackEffect(state, 'player-one', [])
    expect(pending.pendingOptionalCostAttack).toMatchObject({
      cost: { energy: { yellow: 1 } },
      effects: [
        {
          kind: 'gain-hp',
          amount: 1,
          perBreakCard: { exactLevel: 3 },
          target: { sourceOnly: true },
        },
      ],
    })

    const paymentId = pending.players['player-one'].supportArea[0]!.card.instanceId
    const resolved = resolveOptionalCostAttack(
      pending,
      'player-one',
      'pay',
      [],
      [],
      [paymentId],
    )
    expect(
      resolved.players['player-one'].battleArea.find(
        (entry) => entry.card.id === 'BS6-036',
      )?.hpCards,
    ).toHaveLength(5)
  })

  it('resolves BS7-038 attack movement in order and excludes the placed Cookie', () => {
    const state = createCardCheckDemoState('BS7-038')
    const handCookie = state.players['player-one'].hand.find(
      (card) => card.type === 'cookie',
    )
    expect(handCookie).toBeDefined()

    const first = resolveAttackEffect(
      state,
      'player-one',
      [handCookie!.instanceId],
    )
    expect(first.pendingAbilityEffect?.effects[0]).toMatchObject({
      kind: 'break-to-hand',
      keyword: 'arena',
      excludePreviousHandToBreak: true,
    })
    expect(first.players['player-one'].breakArea).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ instanceId: handCookie!.instanceId }),
      ]),
    )
    const followUp = getEffectSelectionCandidates(
      first,
      {
        sourcePlayerId: 'player-one',
        sourceInstanceId: first.pendingAbilityEffect!.sourceInstanceId,
      },
      first.pendingAbilityEffect!.effects[0],
    )
    expect(followUp.map((card) => card.instanceId)).toEqual([
      'BS7-038-arena-break',
    ])

    const completed = applyGameCommand(first, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: followUp.map((card) => card.instanceId),
    })
    expect(completed.pendingAbilityEffect).toBeUndefined()
    expect(completed.players['player-one'].hand).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ instanceId: 'BS7-038-arena-break' }),
      ]),
    )
    expect(completed.players['player-one'].breakArea).toEqual([
      expect.objectContaining({ instanceId: handCookie!.instanceId }),
    ])

    const negative = createCardNegativeDemoState('BS7-038')
    const negativeHandCookie = negative.players['player-one'].hand.find(
      (card) => card.type === 'cookie',
    )
    const negativeFirst = resolveAttackEffect(
      negative,
      'player-one',
      [negativeHandCookie!.instanceId],
    )
    const negativeCompleted = applyGameCommand(negativeFirst, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(negativeCompleted.players['player-one'].hand).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ instanceId: 'BS7-038-arena-break' }),
      ]),
    )
  })

  it('resolves BS7-039 attack damage only when the Arena break event is present', () => {
    const positive = createCardCheckDemoState('BS7-039')
    const targets = positive.players['player-two'].battleArea
    const targetIds = targets.map((target) => target.card.instanceId)
    const selected = resolveAttackEffect(positive, 'player-one', targetIds)
    expect(selected.pendingBattle?.effectDamageSequence).toMatchObject({
      remainingTargetInstanceIds: targetIds.slice(1),
      continuation: 'attack-effect',
    })

    const afterFirst = resolveNextDamage(selected)
    expect(afterFirst.players['player-two'].battleArea[0]?.hpCards).toHaveLength(
      targets[0].hpCards.length - 1,
    )
    if (targets.length > 1) {
      const afterSecond = resolveNextDamage(afterFirst)
      expect(afterSecond.players['player-two'].battleArea[1]?.hpCards).toHaveLength(
        targets[1].hpCards.length - 1,
      )
    }

    const negative = createCardNegativeDemoState('BS7-039')
    const negativeTarget = negative.players['player-two'].battleArea[0]
    const negativeResolved = resolveAttackEffect(negative, 'player-one', [])
    expect(negativeResolved.players['player-two'].battleArea[0]?.hpCards).toHaveLength(
      negativeTarget.hpCards.length,
    )
  })

  it('requires BS7-082 to discard enough cards before ordered all-target damage', () => {
    const positive = createCardCheckDemoState('BS7-082')
    const discarded = resolveAttackEffect(positive, 'player-one', [])
    expect(discarded.pendingOpponentHandDiscard).toMatchObject({
      count: 1,
      atLeast: true,
    })

    const handIds = discarded.players['player-one'].hand
      .slice(0, 2)
      .map((card) => card.instanceId)
    const afterDiscard = applyGameCommand(discarded, {
      kind: 'resolve-opponent-hand-discard',
      playerId: 'player-one',
      cardIds: handIds,
    })
    const targets = afterDiscard.players['player-two'].battleArea
    const targetIds = targets.map((target) => target.card.instanceId)
    const selected = resolveAttackEffect(afterDiscard, 'player-one', targetIds)
    expect(selected.pendingBattle?.effectDamageSequence).toMatchObject({
      remainingTargetInstanceIds: targetIds.slice(1),
      continuation: 'attack-effect',
    })

    const afterFirst = resolveNextDamage(selected)
    expect(afterFirst.players['player-two'].battleArea[0]?.hpCards).toHaveLength(
      targets[0].hpCards.length - 1,
    )
  })

  it('requires BS7-040 faint target and pays its yellow source energy', () => {
    const positive = createCardCheckDemoState('BS7-040')
    const target = positive.players['player-one'].battleArea[0]
    const payment = positive.players['player-one'].supportArea[0].card.instanceId
    const resolved = resolveFaintEffect(
      positive,
      [target.card.instanceId],
      [payment],
    )
    expect(resolved.players['player-one'].battleArea[0]?.hpCards).toHaveLength(
      target.hpCards.length + 1,
    )
    expect(resolved.players['player-one'].supportArea[0].rested).toBe(true)

    const negative = createCardNegativeDemoState('BS7-040')
    const negativeResolved = resolveFaintEffect(negative, [], [])
    expect(negativeResolved.players['player-one'].battleArea[0]?.hpCards).toHaveLength(
      4,
    )
    expect(negativeResolved.players['player-one'].supportArea[0].rested).toBe(false)
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

  it('BS4-005 cost faint with an empty battle area resolves the effect before replacement', () => {
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

    // 戰場清空：先保留完整效果佇列，不能先建立補位任務。
    expect(activated.players['player-one'].battleArea).toHaveLength(0)
    expect(activated.pendingReplacement).toBeNull()
    expect(activated.pendingAbilityEffect).toBeDefined()

    let resolved = applyGameCommand(activated, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: state.players['player-two'].battleArea.map(
        (entry) => entry.card.instanceId,
      ),
    })
    while (resolved.pendingBattle) {
      resolved = applyGameCommand(resolved, {
        kind: 'resolve-next-damage',
        playerId: 'player-two',
      })
    }

    expect(resolved.pendingAbilityEffect).toBeUndefined()
    expect(resolved.pendingReplacement).toMatchObject({
      tasks: [{ playerId: 'player-one', remaining: 1 }],
    })

    // 整條效果完成後才可補位。
    const replaced = applyGameCommand(resolved, {
      kind: 'replace-cookie',
      playerId: 'player-one',
      instanceId: replacementCookie.instanceId,
    })
    expect(replaced.pendingReplacement).toBeNull()
    expect(replaced.pendingOnPlay).toBeNull()
    expect(replaced.pendingBattle).toBeNull()
  })

  it('BS4-005 cost faint with no cookies to replace resolves damage before defeat', () => {
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

    expect(activated.status).toBe('playing')
    expect(activated.pendingAbilityEffect).toBeDefined()

    let resolved = applyGameCommand(activated, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: state.players['player-two'].battleArea.map(
        (entry) => entry.card.instanceId,
      ),
    })
    while (resolved.pendingBattle) {
      resolved = applyGameCommand(resolved, {
        kind: 'resolve-next-damage',
        playerId: 'player-two',
      })
    }

    expect(resolved.pendingReplacement).toMatchObject({
      tasks: [{ playerId: 'player-one', remaining: 1 }],
    })
    const defeated = applyGameCommand(resolved, {
      kind: 'skip-replacement',
      playerId: 'player-one',
    })
    expect(defeated.status).toBe('finished')
    expect(defeated.result).toMatchObject({
      loserId: 'player-one',
      reason: 'no-cookie-available',
    })
    expect(defeated.pendingBattle).toBeNull()
    expect(defeated.pendingAbilityEffect).toBeUndefined()
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

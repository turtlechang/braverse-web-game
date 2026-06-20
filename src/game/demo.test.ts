import { describe, expect, it } from 'vitest'
import {
  createBlueActivateSkillDemoState,
  createBlueInspectDeckDemoState,
  createBlueOptionalCostAttackDemoState,
  createBreakToTrashDemoState,
  createReplacementChoiceDemoState,
  createSupportToTrashSkillDemoState,
  createTrapResponseDemoState,
  isLocalhost,
  parseTestStateConfig,
} from './demo'
import { getTrapCandidates } from './battle'
import { isEffectConditionMet } from './effects'
import { canActivateCookieSkill } from './skills'

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
  it('returns null for non-localhost', () => {
    expect(parseTestStateConfig('?test-state=blue-inspect-deck', 'example.com')).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import {
  createBreakToTrashDemoState,
  createReplacementChoiceDemoState,
  createTrapResponseDemoState,
  isLocalhost,
  parseTestStateConfig,
} from './demo'
import { getTrapCandidates } from './battle'
import { isEffectConditionMet } from './effects'

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

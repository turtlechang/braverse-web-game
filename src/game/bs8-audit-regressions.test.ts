import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { getCardPoolEntry } from './card-pool'
import { applyGameCommand } from './commands'
import { getCookieEffectiveHp } from './helpers'
import { createBattleState } from './test-helpers/battle-helpers'
import type { CookieCard, GameCard, GameState } from './types'

const official = (id: string, suffix: string): GameCard => {
  const entry = getCardPoolEntry(id)
  if (!entry) throw new Error(`Missing formal card ${id}`)
  const result = convertOfficialCardToGameCard(entry)
  if (result.status !== 'converted') throw new Error(`Unconverted ${id}`)
  return { ...result.gameCard, instanceId: `${id}:${suffix}` }
}

const cookie = (id: string, suffix: string): CookieCard => {
  const result = official(id, suffix)
  if (result.type !== 'cookie') throw new Error(`Not a Cookie: ${id}`)
  return result
}

const hp = (suffix: string) => official('BS8-020', suffix)
const inBattle = (card: CookieCard, count: number) => ({
  card,
  hpCards: Array.from({ length: count }, (_, index) => hp(`${card.instanceId}-hp-${index}`)),
  rested: false,
})

const skillState = (id: string, sourceHp: number): GameState => {
  const base = createBattleState()
  return {
    ...base,
    activePlayerId: 'player-one',
    players: {
      'player-one': {
        ...base.players['player-one'],
        battleArea: [inBattle(cookie(id, 'source'), sourceHp)],
        supportArea: [{ card: official('BS8-004', 'energy'), rested: false }],
        hand: [],
        deck: Array.from({ length: 12 }, (_, index) => hp(`deck-${index}`)),
      },
      'player-two': {
        ...base.players['player-two'],
        battleArea: [inBattle(cookie('BS8-030', 'opponent'), 4)],
        hand: [],
      },
    },
  }
}

const activate = (state: GameState, paymentIds = ['BS8-004:energy']) =>
  applyGameCommand(state, {
    kind: 'activate-skill',
    playerId: 'player-one',
    sourceInstanceId: state.players['player-one'].battleArea[0].card.instanceId,
    trigger: 'activate',
    paymentIds,
    effectTargets: [['BS8-030:opponent']],
  })

describe('BS8-004 exact source HP and support payment', () => {
  it.each(['BS8-004', 'BS8-004@1'])('%s deals two damage only at one effective HP', (id) => {
    const state = skillState(id, 1)
    const next = activate(state)
    expect(next.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
    expect(next.players['player-one'].supportArea[0].rested).toBe(true)
    expect(next.players['player-one'].battleArea[0].rested).toBe(true)
    expect(() => activate(next)).toThrow()
    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(4)
  })

  it('rejects two physical HP without paying', () => {
    const state = skillState('BS8-004', 2)
    expect(getCookieEffectiveHp(state.players['player-one'].battleArea[0])).toBe(2)
    const before = structuredClone(state)
    expect(() => activate(state)).toThrow()
    expect(state).toEqual(before)
  })

  it('allows one physical HP even when that hidden card contains a gain-HP FLIP', () => {
    const state = skillState('BS8-004', 1)
    state.players['player-one'].battleArea[0].hpCards = [official('BS8-036', 'unrevealed-flip')]
    expect(getCookieEffectiveHp(state.players['player-one'].battleArea[0])).toBe(1)
    const next = activate(state)
    expect(next.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
    expect(next.players['player-one'].supportArea[0].rested).toBe(true)
  })

  it('rejects missing, wrong-color and rested energy before damage', () => {
    const state = skillState('BS8-004', 1)
    expect(() => activate(state, [])).toThrow()
    state.players['player-one'].supportArea = [{ card: official('BS8-103', 'purple'), rested: false }]
    expect(() => activate(state, ['BS8-103:purple'])).toThrow()
    state.players['player-one'].supportArea = [{ card: official('BS8-004', 'energy'), rested: true }]
    expect(() => activate(state)).toThrow()
    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(4)
  })
})

const darkCacaoState = (id: string): GameState => {
  const state = skillState(id, 4)
  state.pendingOnPlay = { playerId: 'player-one', sourceInstanceId: `${id}:source`, origin: 'trash' }
  state.players['player-one'].supportArea = [{ card: official('BS8-103', 'purple'), rested: false }]
  state.players['player-two'].battleArea.push(inBattle(cookie('BS8-030', 'opponent-two'), 3))
  return state
}

const activateDarkCacao = (state: GameState, paymentIds: string[], targets: string[]) =>
  applyGameCommand(state, {
    kind: 'activate-skill', playerId: 'player-one',
    sourceInstanceId: state.players['player-one'].battleArea[0].card.instanceId,
    trigger: 'on-play', paymentIds, effectTargets: [targets],
  })

describe('BS8-103 optional On Play paid from support', () => {
  it.each(['BS8-103', 'BS8-103@1', 'BS8-103@2'])('%s pays purple support and independently selects each Cookie', (id) => {
    const state = darkCacaoState(id)
    const next = activateDarkCacao(state, ['BS8-103:purple'], ['BS8-030:opponent-two'])
    expect(next.players['player-one'].supportArea[0].rested).toBe(true)
    expect(next.players['player-two'].battleArea.map((entry) => entry.hpCards.length)).toEqual([4, 2])
    expect(next.pendingOnPlay).toBeNull()
  })

  it('allows zero HP selections after payment, or skips On Play without payment', () => {
    const state = darkCacaoState('BS8-103')
    const paid = activateDarkCacao(state, ['BS8-103:purple'], [])
    expect(paid.players['player-one'].supportArea[0].rested).toBe(true)
    expect(paid.players['player-two'].battleArea.map((entry) => entry.hpCards.length)).toEqual([4, 3])
    const skipped = applyGameCommand(state, {
      kind: 'skip-on-play', playerId: 'player-one', sourceInstanceId: 'BS8-103:source',
    })
    expect(skipped.players['player-one'].supportArea[0].rested).toBe(false)
    expect(skipped.players['player-two'].battleArea.map((entry) => entry.hpCards.length)).toEqual([4, 3])
  })

  it('rejects no support, rested support, wrong color and the wrong origin', () => {
    const state = darkCacaoState('BS8-103')
    state.players['player-one'].supportArea = []
    expect(() => activateDarkCacao(state, [], ['BS8-030:opponent'])).toThrow()
    state.players['player-one'].supportArea = [{ card: official('BS8-103', 'purple'), rested: true }]
    expect(() => activateDarkCacao(state, ['BS8-103:purple'], ['BS8-030:opponent'])).toThrow()
    state.players['player-one'].supportArea = [{ card: official('BS8-004', 'red'), rested: false }]
    expect(() => activateDarkCacao(state, ['BS8-004:red'], ['BS8-030:opponent'])).toThrow()
    state.players['player-one'].supportArea = [{ card: official('BS8-103', 'purple'), rested: false }]
    state.pendingOnPlay = { playerId: 'player-one', sourceInstanceId: 'BS8-103:source', origin: 'hand' }
    expect(() => activateDarkCacao(state, ['BS8-103:purple'], ['BS8-030:opponent'])).toThrow()
  })
})

const warmthState = (remainingHand = 0): GameState => {
  const state = skillState('BS8-004', 2)
  state.players['player-one'].supportArea.push({ card: official('BS8-004', 'energy-two'), rested: false })
  state.players['player-two'].hand = [official('BS8-098', 'trap'), ...Array.from({ length: remainingHand }, (_, index) => hp(`hand-${index}`))]
  state.players['player-two'].deck = Array.from({ length: 8 }, (_, index) => hp(`opponent-deck-${index}`))
  state.players['player-two'].supportArea = Array.from({ length: 3 }, (_, index) => ({ card: official('BS8-098', `blue-${index}`), rested: false }))
  const declared = applyGameCommand(state, {
    kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: 'BS8-004:source',
    targetInstanceId: 'BS8-030:opponent', supportPaymentIds: ['BS8-004:energy', 'BS8-004:energy-two'],
  })
  const played = applyGameCommand(declared, {
    kind: 'play-trap', playerId: 'player-two', trapInstanceId: 'BS8-098:trap',
    paymentIds: ['BS8-098:blue-0', 'BS8-098:blue-1'], targetIds: ['BS8-004:source'],
  })
  expect(played.pendingAbilityEffect).toMatchObject({ effectIndex: 1, battleContinuation: 'after-trap' })
  return applyGameCommand(played, {
    kind: 'resolve-ability-effect', playerId: 'player-two', targetIds: [],
  })
}

const payWarmth = (state: GameState, paymentIds = ['BS8-098:blue-2']) => {
  const paid = applyGameCommand(state, {
    kind: 'resolve-optional-cost-attack', playerId: 'player-two', action: 'pay', paymentIds,
  })
  return applyGameCommand(paid, {
    kind: 'resolve-ability-effect', playerId: 'player-two', targetIds: [],
  })
}

describe('BS8-098 paid Then draw during a real attack', () => {
  it.each([0, 3])('offers and resolves drawing %s cards, then resumes damage', (drawCount) => {
    let state = warmthState(2)
    expect(state.pendingOptionalCostAttack?.cost.energy).toEqual({ blue: 1 })
    expect(state.players['player-two'].supportArea.map((entry) => entry.rested)).toEqual([true, true, false])
    state = payWarmth(state)
    expect(state.pendingDrawUpTo?.max).toBe(3)
    state = applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId: 'player-two', drawCount })
    expect(state.players['player-two'].hand).toHaveLength(2 + drawCount)
    expect(state.players['player-two'].supportArea.every((entry) => entry.rested)).toBe(true)
    expect(state.pendingOptionalCostAttack).toBeNull()
    expect(state.pendingDrawUpTo).toBeNull()
    expect(state.pendingBattle?.stage).toBe('damage')
  })

  it('checks the hand condition after the trap leaves hand', () => {
    const state = payWarmth(warmthState(3))
    expect(state.pendingDrawUpTo).toBeUndefined()
    expect(state.players['player-two'].hand).toHaveLength(3)
    expect(state.players['player-two'].supportArea.every((entry) => entry.rested)).toBe(true)
  })

  it('allows skipping the additional cost and rejects paying with spent or missing support', () => {
    const state = warmthState()
    expect(() => payWarmth(state, [])).toThrow()
    expect(() => payWarmth(state, ['BS8-098:blue-0'])).toThrow()
    const skipped = applyGameCommand(state, {
      kind: 'resolve-optional-cost-attack', playerId: 'player-two', action: 'skip',
    })
    expect(skipped.players['player-two'].hand).toHaveLength(0)
    expect(skipped.players['player-two'].supportArea[2].rested).toBe(false)
    expect(skipped.pendingOptionalCostAttack).toBeNull()
    expect(skipped.pendingDrawUpTo).toBeUndefined()
  })

  it('preserves the remaining draws and battle continuation across Refresh', () => {
    const offered = warmthState()
    offered.players['player-two'].deck = [hp('last-deck-card')]
    offered.players['player-two'].discardPile = [
      cookie('BS8-030', 'refresh-cost'),
      ...Array.from({ length: 5 }, (_, index) => hp(`refresh-card-${index}`)),
    ]
    const drawing = payWarmth(offered)
    const refresh = applyGameCommand(drawing, {
      kind: 'resolve-draw-up-to', playerId: 'player-two', drawCount: 3,
    })
    expect(refresh.pendingRefresh?.playerId).toBe('player-two')
    const completed = applyGameCommand(refresh, {
      kind: 'refresh-deck', playerId: 'player-two', cookieInstanceId: 'BS8-030:refresh-cost', shuffleSeed: 8098,
    })
    expect(completed.players['player-two'].hand).toHaveLength(3)
    expect(completed.pendingRefresh).toBeNull()
    expect(completed.pendingBattle?.stage).toBe('damage')
  })
})

const cakeWolfFaintState = (): GameState => {
  const state = skillState('BS8-011', 3)
  state.players['player-one'].battleArea.push(inBattle(cookie('BS8-018', 'wolf'), 1))
  state.players['player-one'].supportArea.push({ card: official('BS8-004', 'faint-energy'), rested: false })
  return applyGameCommand(state, {
    kind: 'activate-skill', playerId: 'player-one', sourceInstanceId: 'BS8-011:source',
    trigger: 'activate', paymentIds: ['BS8-004:energy'],
    effectTargets: [['BS8-018:wolf', 'BS8-030:opponent']],
  })
}

describe('BS8-018 legacy faint sourceEnergy represents actual support payment', () => {
  it('requires red support before moving the source from Break to Trash', () => {
    const state = cakeWolfFaintState()
    expect(state.pendingFaintEffects?.[0].sourceEnergy).toEqual({ red: 1 })
    expect(state.players['player-one'].breakArea.map((card) => card.instanceId)).toContain('BS8-018:wolf')
    expect(() => applyGameCommand(state, {
      kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [], paymentIds: ['BS8-004:energy'],
    })).toThrow()
    const paid = applyGameCommand(state, {
      kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [], paymentIds: ['BS8-004:faint-energy'],
    })
    expect(paid.players['player-one'].supportArea[1].rested).toBe(true)
    expect(paid.players['player-one'].breakArea.map((card) => card.instanceId)).not.toContain('BS8-018:wolf')
    expect(paid.players['player-one'].discardPile.map((card) => card.instanceId)).toContain('BS8-018:wolf')
    const completed = applyGameCommand(paid, {
      kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: ['BS8-030:opponent'],
    })
    expect(completed.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
  })

  it('skipping preserves the source in Break and suppresses its entire damage branch', () => {
    const state = cakeWolfFaintState()
    const skipped = applyGameCommand(state, {
      kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [], paymentIds: [],
    })
    expect(skipped.players['player-one'].breakArea.map((card) => card.instanceId)).toContain('BS8-018:wolf')
    expect(skipped.players['player-one'].supportArea[1].rested).toBe(false)
    expect(skipped.pendingFaintEffects ?? []).toHaveLength(0)
    expect(skipped.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
  })
})

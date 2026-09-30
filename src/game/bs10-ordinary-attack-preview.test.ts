import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import {
  createCardCheckDemoState,
  createCardNegativeDemoState,
} from './demo'

type PreviewState = ReturnType<typeof createCardCheckDemoState>

const declareOrdinaryAttack = (state: PreviewState): PreviewState => {
  const source = state.players['player-one'].battleArea[0]
  const target = state.players['player-two'].battleArea[0]
  if (!source || !target) throw new Error('BS10 ordinary attack fixture is missing source or target')
  return applyGameCommand(state, {
    kind: 'declare-attack',
    playerId: 'player-one',
    attackerInstanceId: source.card.instanceId,
    targetInstanceId: target.card.instanceId,
    supportPaymentIds: state.players['player-one'].supportArea
      .slice(0, source.card.attackCost)
      .map(({ card }) => card.instanceId),
  })
}

const settleDamage = (initial: PreviewState): PreviewState => {
  let state = declareOrdinaryAttack(initial)
  if (state.pendingBattle?.stage === 'trap') {
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
  }
  for (let step = 0; state.pendingBattle || state.pendingReplacement; step += 1) {
    if (state.pendingReplacement) {
      state = applyGameCommand(state, { kind: 'skip-replacement', playerId: 'player-two' })
    } else if (state.pendingBattle?.stage === 'damage') {
      state = applyGameCommand(state, {
        kind: 'resolve-next-damage',
        playerId: 'player-two',
      })
    } else {
      break
    }
  }
  return state
}

const sourceOf = (state: PreviewState, cardNumber: string) =>
  state.players['player-one'].battleArea.find((entry) => entry.card.id === cardNumber)

describe('BS10 ordinary attack preview fixtures', () => {
  it.each([
    ['BS10-006', 2, ['BS6-002', 'BS6-002', 'BS6-002', 'BS6-004', 'BS6-004', 'BS6-004']],
    ['BS10-007', 3, ['BS6-002', 'BS6-002', 'BS6-002', 'BS6-004', 'BS6-004', 'BS6-004']],
    ['BS10-010', 2, ['BS6-002', 'BS6-047', 'BS6-002', 'BS6-047', 'BS6-002', 'BS6-047']],
  ] as const)('%s exposes exact candidate, target, and payment cards', (cardNumber, cost, supportIds) => {
    const positive = createCardCheckDemoState(cardNumber, { normalAttack: 'payable' })
    const source = sourceOf(positive, cardNumber)!
    const target = positive.players['player-two'].battleArea[0]!

    expect(source.card.imageUrl).toBeTruthy()
    expect(source.card.attackCost).toBe(cost)
    expect(source.rested).toBe(false)
    expect(positive.players['player-one'].supportArea.map(({ card }) => card.id)).toEqual(supportIds)
    expect(positive.players['player-one'].supportArea.every(({ card, rested }) =>
      Boolean(card.imageUrl) && rested === false,
    )).toBe(true)
    expect(target.card.imageUrl).toBeTruthy()
    expect(target.card.id).toBe(cardNumber === 'BS10-010' ? 'BS6-079' : 'BS6-080')
    expect(target.hpCards).toHaveLength(cardNumber === 'BS10-006' ? 2 : cardNumber === 'BS10-007' ? 3 : 5)
    if (cardNumber !== 'BS10-010') {
      expect(positive.players['player-two'].battleArea[1]?.card.id).toBe('BS6-079')
      expect(positive.players['player-two'].battleArea[1]?.hpCards).toHaveLength(5)
    }
    expect(positive.players['player-one'].supportArea.filter(({ rested }) => !rested)).toHaveLength(6)
  })

  it.each([
    ['BS10-006', 2],
    ['BS10-007', 3],
    ['BS10-010', 2],
  ] as const)('%s negative route keeps source active but blocks with cost - 1 active supports', (cardNumber, cost) => {
    const negative = createCardNegativeDemoState(cardNumber, { normalAttack: 'blocked' })
    const source = sourceOf(negative, cardNumber)!
    const target = negative.players['player-two'].battleArea[0]!

    expect(source.rested).toBe(false)
    expect(negative.players['player-one'].supportArea.filter(({ rested }) => !rested)).toHaveLength(cost - 1)
    expect(negative.players['player-one'].supportArea.some(({ rested }) => rested)).toBe(true)
    expect(target.hpCards).toHaveLength(cardNumber === 'BS10-006' ? 2 : cardNumber === 'BS10-007' ? 3 : 5)
    expect(() => declareOrdinaryAttack(negative)).toThrow()
  })

  it('resolves BS10-006 against BS6-080 and then applies its attack-after damage to BS6-079', () => {
    const initial = createCardCheckDemoState('BS10-006', { normalAttack: 'payable' })
    const settled = settleDamage(initial)
    expect(settled.pendingBattle?.stage).toBe('attack-effect')
    expect(settled.players['player-two'].battleArea.some((entry) => entry.card.id === 'BS6-080')).toBe(false)
    const survivor = settled.players['player-two'].battleArea.find((entry) => entry.card.id === 'BS6-079')!
    expect(survivor.hpCards).toHaveLength(5)

    const finished = applyGameCommand(settled, {
      kind: 'resolve-attack-effect',
      playerId: 'player-one',
      targetIds: [survivor.card.instanceId],
    })
    expect(finished.players['player-two'].battleArea.find((entry) => entry.card.id === 'BS6-079')?.hpCards).toHaveLength(4)
  })

  it('resolves BS10-007 against a real BS6-080 faint and permits its 0-card skill draw', () => {
    const initial = createCardCheckDemoState('BS10-007', { normalAttack: 'payable' })
    const settled = settleDamage(initial)
    expect(settled.pendingBattle).toBeNull()
    expect(settled.cookiesFaintedThisTurn?.['player-two']).toBe(1)
    expect(settled.players['player-two'].battleArea.some((entry) => entry.card.id === 'BS6-080')).toBe(false)
    const source = sourceOf(settled, 'BS10-007')!
    const activated = applyGameCommand(settled, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
    })
    const pendingDraw = applyGameCommand(activated, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(pendingDraw.pendingDrawUpTo?.max).toBe(1)
    const drawZero = applyGameCommand(pendingDraw, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-one',
      drawCount: 0,
    })
    expect(drawZero.pendingDrawUpTo).toBeNull()
  })

  it('resolves BS10-010 vanilla 2N attack against real BS6-079 from HP5 to HP2', () => {
    const initial = createCardCheckDemoState('BS10-010', { normalAttack: 'payable' })
    const settled = settleDamage(initial)
    const target = settled.players['player-two'].battleArea.find((entry) => entry.card.id === 'BS6-079')
    expect(settled.pendingBattle).toBeNull()
    expect(target?.hpCards).toHaveLength(2)
  })
})

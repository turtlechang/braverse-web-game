import { expect, it } from 'vitest'
import { createBs12FinalPhysicalDemoState } from './demo'
import { applyGameCommand } from './commands'
import { getOptionalCostAttackPrompt } from '../components/modals/optionalCostAttackPrompt'
import { getEffectSelectionCandidates } from './effects'
import { maskGameStateForViewer } from './masked-state'
import { createPlayerView } from './player-view'

const begin = (number: 'BS12-112' | 'BS12-112@1') => {
  let state = createBs12FinalPhysicalDemoState(number, 'new-hp-target')
  state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: 'final-source', targetInstanceId: 'final-enemy', supportPaymentIds: ['final-payment-0', 'final-payment-1', 'final-payment-2'] })
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
  while (state.pendingBattle?.stage === 'damage') state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
  return applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [] })
}

for (const number of ['BS12-112', 'BS12-112@1'] as const) {
  it(number + ' never previews hidden HP before committing the source payment', () => {
    const state = begin(number), before = structuredClone(state)
    const prompt = getOptionalCostAttackPrompt(state, 'player-one')!
    expect(prompt.needsTarget).toBe(false)
    expect(prompt.targetCandidates).toEqual([])
    expect(state).toEqual(before)
  })
  it(number + ' masks HP before payment and publishes actual Trash after payment for both players', () => {
    const state = begin(number)
    const source = state.players['player-one'].battleArea.find(c => c.card.instanceId === 'final-source')!
    const paid = applyGameCommand(state, { kind: 'resolve-optional-cost-attack', playerId: 'player-one', action: 'pay', targetIds: [], discardCardIds: [], paymentIds: [] })
    for (const viewer of ['player-one', 'player-two'] as const) {
      const masked = maskGameStateForViewer(state, viewer)
      expect(masked.players['player-one'].battleArea.find(c => c.card.instanceId === 'final-source')!.hpCards.every(c => c.id === 'hidden')).toBe(true)
      if (viewer === 'player-one') expect(getOptionalCostAttackPrompt(masked, viewer)?.targetCandidates).toEqual([])
      const view = createPlayerView(state, viewer)
      expect((viewer === 'player-one' ? view.self : view.opponent).battleArea.find(c => c.card.instanceId === 'final-source')?.faceUpHpCards).toBeUndefined()
      const paidMasked = maskGameStateForViewer(paid, viewer)
      expect(paidMasked.players['player-one'].discardPile.slice(-5)).toEqual([source.card, ...source.hpCards])
    }
  })
  for (const targetIds of [[], ['final-own-deck-0'], ['final-own-deck-1', 'final-own-deck-2']]) {
    it(number + ' commits all source HP before public recovery selection ' + targetIds.length, () => {
      const state = begin(number), before = structuredClone(state)
      const source = state.players['player-one'].battleArea.find(c => c.card.instanceId === 'final-source')!
      const paid = applyGameCommand(state, { kind: 'resolve-optional-cost-attack', playerId: 'player-one', action: 'pay', targetIds: [], discardCardIds: [], paymentIds: [] })
      expect(paid.pendingOptionalCostAttack).toBeNull()
      expect(paid.players['player-one'].battleArea.some(c => c.card.instanceId === 'final-source')).toBe(false)
      expect(paid.players['player-one'].discardPile).toEqual([...before.players['player-one'].discardPile, source.card, ...source.hpCards])
      expect(paid.players['player-one'].hand).toEqual(before.players['player-one'].hand)
      expect(paid.pendingAbilityEffect?.battleContinuation).toBe('attack-effect')
      const pending = paid.pendingAbilityEffect!
      const candidates = getEffectSelectionCandidates(paid, { sourcePlayerId: 'player-one', sourceInstanceId: pending.sourceInstanceId }, pending.effects[pending.effectIndex])
      expect(candidates.map(c => c.instanceId)).toEqual(['final-special-cost', 'final-own-deck-0', 'final-own-deck-1', 'final-own-deck-2'])
      expect(() => applyGameCommand(paid, { kind: 'resolve-optional-cost-attack', playerId: 'player-one', action: 'skip' })).toThrow()
      const done = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds })
      expect(done.players['player-one'].hand.map(c => c.instanceId)).toEqual(targetIds)
      expect(done.players['player-one'].discardPile).toEqual(paid.players['player-one'].discardPile.filter(c => !targetIds.includes(c.instanceId)))
      expect(done.players['player-one'].breakArea).toEqual(before.players['player-one'].breakArea)
      expect(done.pendingAbilityEffect).toBeFalsy()
      expect(state).toEqual(before)
    })
  }
}

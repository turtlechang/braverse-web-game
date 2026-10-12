import { describe, expect, it } from 'vitest'
import { createAiTrapTargetPreview } from '../../ai-trap-target-demo'
import { takeAiStep } from '../../ai'
import { applyGameCommand } from '../../commands'
import { getCardPoolEntry } from '../../card-pool'
import { createCard } from '../../starter-deck'
import type { PlayerId } from '../../types'

const owner = 'player-two' as const
const printed = (id: string, player: PlayerId = owner, copy = 1) => {
  const raw = getCardPoolEntry(id)
  if (!raw) throw new Error(`Missing original printing ${id}`)
  return createCard(raw, player, copy)
}
const chosenTrap = (state: ReturnType<typeof createAiTrapTargetPreview>, next: ReturnType<typeof takeAiStep>) => {
  const command = next.state.commandLog?.slice(state.commandLog?.length ?? 0)
    .find(entry => entry.commandKind === 'play-trap')?.payload
  if (command?.kind !== 'play-trap') throw new Error('Expected actual trap command')
  return command
}

describe('Public trap targeting protects the current defender', () => {
  it.each([3, 4, 5] as const)('Lv.%s targets the attacker instead of a valuable rested Cookie', level => {
    const state = createAiTrapTargetPreview(), before = structuredClone(state)
    for (const player of Object.values(state.players)) {
      const cards = [...player.deck, ...player.hand, ...player.supportArea.map(s => s.card),
        ...player.battleArea.flatMap(s => [s.card, ...s.hpCards])]
      expect(cards).toHaveLength(60)
      expect(new Set(cards.map(c => c.instanceId)).size).toBe(60)
      expect(player.battleArea.length).toBeLessThanOrEqual(2)
      const counts = new Map<string, number>()
      for (const card of cards) counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
      expect([...counts.values()].every(n => n <= 4)).toBe(true)
    }
    expect(state.pendingBattle?.stage).toBe('trap')
    expect(state.players['player-one'].supportArea.every(s => s.rested)).toBe(true)
    const next = takeAiStep(state, owner, { level, seed: 2026121993, searchNow: () => 0 })
    const command = chosenTrap(state, next)
    expect(command.targetIds).toEqual([state.pendingBattle!.attackerInstanceId])
    expect(command.paymentIds).toHaveLength(1)
    expect(command.supportTrashIds).toHaveLength(1)
    const settled = applyGameCommand(next.state, { kind: 'resolve-next-damage', playerId: owner })
    expect(settled.players[owner].battleArea[0].hpCards).toHaveLength(2)
    expect(settled.players[owner].supportArea).toHaveLength(1)
    expect(state).toEqual(before)
  })

  // Original public card effects with synthetic policy variants. These are
  // not additional individual physical-card or complete-deck acceptance cases.
  it.each([
    ['ST8-018', 'ST3-016'], ['BS12-065', 'ST4-020'],
    ['BS12-087', 'ST5-020'], ['ST10-019', 'ST5-020'], ['BS12-105', 'BS11-110'],
  ])('uses the actual mitigation of %s instead of card retention', (trapId, supportId) => {
    const state = createAiTrapTargetPreview()
    state.players[owner].hand = [printed(trapId)]
    state.players[owner].supportArea = [1, 2].map(copy => ({ card: printed(supportId, owner, copy), rested: false }))
    if (trapId === 'BS12-105') {
      const card = printed('BS12-112')
      if (card.type !== 'cookie') throw new Error('Expected Cookie')
      state.players[owner].battleArea[0].card = card
      state.pendingBattle!.targetInstanceId = card.instanceId
    }
    const before = structuredClone(state)
    const next = takeAiStep(state, owner, { level: 5, seed: 2026121993, searchNow: () => 0 })
    expect(chosenTrap(state, next).targetIds).toEqual([state.pendingBattle!.attackerInstanceId])
    expect(state).toEqual(before)
  })

  it.each(['nonlethal', 'immune'] as const)('preserves normal selection without a saving current-attack reduction (%s)', variant => {
    const state = createAiTrapTargetPreview()
    if (variant === 'nonlethal') state.players[owner].battleArea[0].hpCards.push(printed('ST1-020'))
    else state.damageReceivedModifiers.push({ sourceInstanceId: 'public-protection',
      targetInstanceId: state.pendingBattle!.targetInstanceId, amount: -2,
      damageType: 'attack', expiresAfterTurn: state.turnNumber })
    const next = takeAiStep(state, owner, { level: 5, seed: 2026121993, searchNow: () => 0 })
    expect(chosenTrap(state, next).targetIds).toEqual([state.players['player-one'].battleArea[1].card.instanceId])
  })

  it('does not use hidden deck or HP faces to choose the saving target', () => {
    const state = createAiTrapTargetPreview()
    for (const player of Object.values(state.players)) {
      player.deck = player.deck.map(card => ({ ...printed('BS12-060', player.id), instanceId: card.instanceId }))
      for (const source of player.battleArea) source.hpCards = source.hpCards.map(card =>
        ({ ...printed('BS12-060', player.id), instanceId: card.instanceId }))
    }
    const next = takeAiStep(state, owner, { level: 5, seed: 2026121993, searchNow: () => 0 })
    expect(chosenTrap(state, next).targetIds).toEqual([state.pendingBattle!.attackerInstanceId])
  })
})

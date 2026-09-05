import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { createBs8011DoubleSkillDemoState } from './demo'
import { canActivateCookieSkill } from './skills'
import { takeAiStep } from './ai'
import { getCardPoolEntry } from './card-pool'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'

const fixture = () => {
  const state = createBs8011DoubleSkillDemoState()
  const own = state.players['player-one']
  const opponent = state.players['player-two']
  return { state, own, opponent, command: {
    kind: 'begin-activate-skill' as const,
    playerId: 'player-one' as const,
    sourceInstanceId: own.battleArea[0].card.instanceId,
    trigger: 'activate' as const,
    paymentIds: [own.supportArea[0].card.instanceId],
  } }
}

describe('BS8-011 selects both Cookies as a cost before damage (rules v1.8 8-2/8-3)', () => {
  it('rejects omitted, incomplete, duplicate, and same-player choices without spending resources', () => {
    const { state, own, opponent, command } = fixture()
    const before = structuredClone(state)
    for (const targetIds of [undefined, [], [own.battleArea[0].card.instanceId],
      own.battleArea.map((cookie) => cookie.card.instanceId),
      [opponent.battleArea[0].card.instanceId, opponent.battleArea[0].card.instanceId]]) {
      expect(() => applyGameCommand(state, { ...command, targetIds })).toThrow()
      expect(state).toEqual(before)
    }
  })

  it('one confirmation locks one Cookie per player and applies both damage with one payment', () => {
    const { state, own, opponent, command } = fixture()
    const targets = [own.battleArea[1], opponent.battleArea[0]]
    const result = applyGameCommand(state, {
      ...command, targetIds: targets.map((cookie) => cookie.card.instanceId),
    })
    for (const [index, playerId] of (['player-one', 'player-two'] as const).entries()) {
      expect(result.players[playerId].battleArea.find((cookie) =>
        cookie.card.instanceId === targets[index].card.instanceId)?.hpCards)
        .toHaveLength(targets[index].hpCards.length - 1)
    }
    expect(result.players['player-one'].supportArea.filter((support) => support.rested)).toHaveLength(1)
    expect(result.pendingAbilityEffect).toBeUndefined()
    const steps = result.commandLog?.at(-1)?.steps ?? []
    expect(steps.some((step) => step.cards?.length === 2 && step.text.includes('效果目標'))).toBe(true)
    expect(steps.some((step) => step.text.includes('Saffron Buffalo Shaman') && step.text.includes('受到 1 點傷害'))).toBe(true)
    expect(steps.some((step) => step.text.includes('opp-lv1') && step.text.includes('受到 1 點傷害'))).toBe(true)
    expect(canActivateCookieSkill(result, 'player-one', command.sourceInstanceId, 'activate')).toBe(false)
    expect(canActivateCookieSkill(result, 'player-one', own.battleArea[1].card.instanceId, 'activate')).toBe(true)
  })

  it('does not offer the skill when only one player has selectable Cookies', () => {
    const { state, command } = fixture()
    state.players['player-two'].battleArea = []
    expect(canActivateCookieSkill(state, 'player-one', command.sourceInstanceId, 'activate')).toBe(false)
  })

  it.each([2, 3, 4, 5] as const)('AI Lv.%s selects a legal pair for an available finishing skill', (level) => {
    const { state } = fixture()
    state.players['player-one'].supportArea = state.players['player-one'].supportArea.slice(0, 1)
    state.players['player-one'].hand = []
    state.players['player-one'].battleArea.forEach((cookie) => { cookie.rested = true })
    state.players['player-two'].battleArea = state.players['player-two'].battleArea.slice(0, 1)
    state.players['player-two'].battleArea[0].hpCards = state.players['player-two'].battleArea[0].hpCards.slice(0, 1)
    const result = takeAiStep(state, 'player-one', { level, seed: 1 })
    expect(result.action).toBe('activate-skill')
    expect(result.state.players['player-two'].battleArea).toHaveLength(0)
    expect(result.state.players['player-one'].battleArea).toHaveLength(2)
    expect(result.state.players['player-one'].supportArea[0].rested).toBe(true)
  })

  it.each([false, true])('keeps both selected targets through a real HP FLIP (opponent first=%s)', (opponentFirst) => {
    const { state, own, opponent, command } = fixture()
    const record = getCardPoolEntry('BS8-001')
    if (!record) throw new Error('Missing formal FLIP witness')
    const converted = convertOfficialCardToGameCard(record)
    if (converted.status !== 'converted' || !converted.gameCard.flip) throw new Error('Expected a real FLIP')
    const flip = converted.gameCard
    const target = opponent.battleArea[0]
    target.hpCards[target.hpCards.length - 1] = { ...flip, instanceId: 'paired-real-flip' }
    const pair = [own.battleArea[0], target]
    if (opponentFirst) pair.reverse()
    let next = applyGameCommand(state, { ...command, targetIds: pair.map((cookie) => cookie.card.instanceId) })
    expect(next.commandLog?.at(-1)?.steps?.some((step) => step.text.includes('等待 HP／FLIP'))).toBe(true)
    expect(next.pendingBattle?.damageTargetInstanceId).toBe(pair[0].card.instanceId)
    expect(next.pendingBattle?.effectDamageSequence?.remainingTargetInstanceIds).toEqual([pair[1].card.instanceId])
    let sawFlip = false
    for (let step = 0; step < 12 && next.pendingBattle; step += 1) {
      if (next.pendingBattle.stage === 'flip') {
        sawFlip = true
        next = applyGameCommand(next, { kind: 'resolve-flip', playerId: 'player-two', activate: false })
      } else {
        next = applyGameCommand(next, { kind: 'resolve-next-damage', playerId: next.pendingBattle.damagePlayerId ?? next.pendingBattle.defenderPlayerId })
      }
    }
    expect(sawFlip).toBe(true)
    expect(next.pendingBattle).toBeNull()
    expect(next.pendingAbilityEffect).toBeUndefined()
    expect(next.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
    expect(next.players['player-two'].battleArea[0].hpCards).toHaveLength(5)
  })
})

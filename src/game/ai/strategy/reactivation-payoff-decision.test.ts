import { describe, expect, it } from 'vitest'
import { getCardPoolEntry } from '../../card-pool'
import { applyGameCommand } from '../../commands'
import { createPlayerView } from '../../player-view'
import { canActivateCookieSkill } from '../../skills'
import { createCard } from '../../starter-deck'
import { createBattleState, item } from '../../test-helpers/battle-helpers'
import type { CardEffect, CookieCard } from '../../types'
import { createKnowledgeState } from './knowledge-state'
import { createPendingSelectionStrategy } from './pending-selection'

const printedCookie = (id: string): CookieCard => {
  const raw = getCardPoolEntry(id)
  if (!raw) throw new Error(`Missing promoted printing ${id}`)
  const card = createCard(raw, 'player-one', 1)
  if (card.type !== 'cookie') throw new Error('Expected Cookie')
  return card
}

const setup = (recipient: CookieCard) => {
  const state = createBattleState()
  state.activePlayerId = 'player-one'
  state.phase = 'main'
  const source = printedCookie('BS12-016')
  state.players['player-one'].battleArea = [recipient, source].map(card => ({
    card, hpCards: Array.from({ length: card.hp }, (_, i) => item(`${card.id}-hp-${i}`)),
    rested: false, battleEntryId: `${card.instanceId}:entry`,
  }))
  return { state, source }
}

const ready: CardEffect = { kind: 'set-cookie-active', target: { side: 'self', min: 0, max: 1 } }

describe('public reactivation payoff decisions', () => {
  it.each([3, 4, 5] as const)('Lv.%i retains an active recipient that unlocks its printed Activate', level => {
    const recipient = printedCookie('P-175')
    const { state, source } = setup(recipient)
    const before = structuredClone(state)
    const selection = createPendingSelectionStrategy(createPlayerView(state, 'player-one'), createKnowledgeState('player-one'), level)
    const targetIds = selection.selectEffectTargetIds(ready, [recipient.instanceId], 1)
    expect(canActivateCookieSkill(state, 'player-one', recipient.instanceId, 'activate')).toBe(false)
    const next = applyGameCommand(state, { kind: 'activate-skill', playerId: 'player-one',
      sourceInstanceId: source.instanceId, trigger: 'activate', paymentIds: [], effectTargets: [targetIds] })
    expect(targetIds).toEqual([recipient.instanceId])
    expect(canActivateCookieSkill(next, 'player-one', recipient.instanceId, 'activate')).toBe(true)
    expect(state).toEqual(before)
  })

  it.each([3, 4, 5] as const)('Lv.%i retains the printed attack Then payoff on an active Cookie', level => {
    const recipient = printedCookie('BS12-016')
    const { state } = setup(recipient)
    // Keep one physical instance of this printing in the public fixture.
    state.players['player-one'].battleArea.pop()
    const selection = createPendingSelectionStrategy(createPlayerView(state, 'player-one'), createKnowledgeState('player-one'), level)
    expect(selection.selectEffectTargetIds(ready, [recipient.instanceId], 1)).toEqual([recipient.instanceId])
  })

  it('uses structured conditions with arbitrary card identities and nested alternatives', () => {
    const recipient = { ...printedCookie('P-175'), id: 'arbitrary-printing', instanceId: 'arbitrary-instance', name: 'arbitrary name' }
    if (!recipient.skill) throw new Error('Expected printed Activate')
    recipient.skill = { ...recipient.skill, effects: [{ kind: 'draw', amount: 1,
      condition: { kind: 'all-of', conditions: [{ kind: 'source-set-active-by-effect-this-turn' }, { kind: 'hand-count-at-most', count: 20 }] } }] }
    const { state } = setup(recipient)
    const selection = createPendingSelectionStrategy(createPlayerView(state, 'player-one'), createKnowledgeState('player-one'), 5)
    expect(selection.selectEffectTargetIds(ready, [recipient.instanceId], 1)).toEqual([recipient.instanceId])
  })

  it('skips active Cookies whose only reactivation condition belongs to On Play', () => {
    const recipient = printedCookie('P-175')
    if (!recipient.skill) throw new Error('Expected printed Activate')
    recipient.skill = { ...recipient.skill, trigger: 'on-play' }
    const { state } = setup(recipient)
    const selection = createPendingSelectionStrategy(createPlayerView(state, 'player-one'), createKnowledgeState('player-one'), 5)
    expect(selection.selectEffectTargetIds(ready, [recipient.instanceId], 1)).toEqual([])
  })

  it('does not spend another optional reactivation on an already enabled active recipient', () => {
    const recipient = printedCookie('P-175')
    const { state } = setup(recipient)
    state.cookiesSetActiveByEffectThisTurn = { [`${recipient.instanceId}:entry`]: true }
    const view = createPlayerView(state, 'player-one')
    expect(view.self.battleArea[0].setActiveByEffectThisTurn).toBe(true)
    expect(view.self.battleArea[0]).not.toHaveProperty('hpCards')
    const selection = createPendingSelectionStrategy(view, createKnowledgeState('player-one'), 5)
    expect(selection.selectEffectTargetIds(ready, [recipient.instanceId], 1)).toEqual([])
    view.self.battleArea[0].rested = true
    const restedSelection = createPendingSelectionStrategy(view, createKnowledgeState('player-one'), 5)
    expect(restedSelection.selectEffectTargetIds(ready, [recipient.instanceId], 1)).toEqual([recipient.instanceId])
  })
})

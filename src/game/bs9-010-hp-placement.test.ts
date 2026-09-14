import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { getExtraDeckCookieUnavailableReason } from './actions'
import { createCardCheckDemoState, createCardNegativeDemoState } from './demo'
import { getEffectSelectionCandidates } from './effects'
import { maskGameStateForViewer } from './masked-state'
import { createPlayerView } from './player-view'
import { executeCardEffect } from './effects'
import type { GameState } from './types'

const sourceId = 'bs9-010-demo-extra'
const source = (state: GameState) => state.players['player-one'].battleArea.find(
  (cookie) => cookie.card.instanceId === sourceId,
)!

const enter = () => applyGameCommand(createCardCheckDemoState('BS9-010'), {
  kind: 'play-extra-deck-cookie', playerId: 'player-one', instanceId: sourceId,
})

const beginOnPlay = (state = enter()) => applyGameCommand(state, {
  kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: sourceId,
  trigger: 'on-play', paymentIds: [],
})

const handChoices = (state: GameState) => getEffectSelectionCandidates(state, {
  sourcePlayerId: 'player-one', sourceInstanceId: sourceId,
}, state.pendingAbilityEffect!.effects[0])

const settleOnPlay = (state: GameState) => applyGameCommand(state, {
  kind: 'resolve-ability-effect', playerId: 'player-one',
  targetIds: [handChoices(state)[0].instanceId],
})

const beginThen = () => {
  let state = settleOnPlay(beginOnPlay())
  const defenderId = state.players['player-two'].battleArea[0].card.instanceId
  state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-one',
    attackerInstanceId: sourceId, targetInstanceId: defenderId,
    supportPaymentIds: state.players['player-one'].supportArea.slice(0, 2).map((entry) => entry.card.instanceId) })
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
  while (state.pendingBattle?.stage === 'damage') {
    state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
  }
  return applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [] })
}

describe('BS9-010 printed face-up bottom HP placement', () => {
  it('offers blind opponent hand slots with the same IDs in local and online views', () => {
    const state = beginOnPlay()
    const choices = handChoices(state)
    expect(choices).toHaveLength(2)
    expect(choices[0].id).toBe('hidden')
    expect(choices[0].imageUrl).toBeUndefined()
    expect(choices[0].name).not.toBe(state.players['player-two'].hand[0].name)
    expect(handChoices(maskGameStateForViewer(state, 'player-one'))).toEqual(choices)
  })

  it('places the selected opponent hand card face-up at the bottom, preserving all original HP', () => {
    const state = beginOnPlay()
    const hpBefore = source(state).hpCards
    const selected = state.players['player-two'].hand[0]
    const result = settleOnPlay(state)
    expect(source(result).hpCards).toEqual([selected, ...hpBefore])
    expect(result.players['player-two'].hand).toEqual(state.players['player-two'].hand.slice(1))
    for (const viewer of ['player-one', 'player-two'] as const) {
      const publicHp = source(maskGameStateForViewer(result, viewer)).hpCards
      expect(publicHp[0]).toEqual(selected)
      expect(publicHp.slice(1).every((card) => card.id === 'hidden')).toBe(true)
      const view = createPlayerView(result, viewer)
      const side = viewer === 'player-one' ? view.self : view.opponent
      expect(side.battleArea.find((cookie) => cookie.card.instanceId === sourceId)?.faceUpHpCards)
        .toEqual([{ position: 0, card: selected }])
    }
    const log = result.commandLog!.at(-1)!
    expect(log.steps?.some((step) => step.text.includes('正面朝上') && step.text.includes('最下方'))).toBe(true)
    expect(log.steps?.flatMap((step) => step.cards ?? [])).toContainEqual(selected)
    expect(JSON.stringify(log)).not.toContain(state.players['player-two'].hand[1].instanceId)
    expect(source(state).hpCards).toEqual(hpBefore)
  })

  it('resolves an online blind slot to the same second hand card without revealing the first', () => {
    const state = beginOnPlay()
    const choice = handChoices(maskGameStateForViewer(state, 'player-one'))[1]
    const result = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [choice.instanceId] })
    expect(source(result).hpCards[0]).toEqual(state.players['player-two'].hand[1])
    expect(result.players['player-two'].hand).toEqual([state.players['player-two'].hand[0]])
    const view = maskGameStateForViewer(result, 'player-one')
    expect(view.players['player-two'].hand[0].id).toBe('hidden')
  })

  it('allows On Play zero without moving cards or revealing the opponent hand', () => {
    const state = beginOnPlay()
    const result = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
    expect(source(result).hpCards).toEqual(source(state).hpCards)
    expect(result.players['player-two'].hand).toEqual(state.players['player-two'].hand)
    expect(result.pendingAbilityEffect).toBeUndefined()
  })

  it.each([
    ['player-two-hidden-hand-2'], ['player-one-hidden-hand-0'],
    ['bs9-010-opponent-hand'], ['player-two-hidden-hand-0', 'player-two-hidden-hand-1'],
    ['player-two-hidden-hand-0', 'player-two-hidden-hand-0'],
  ])('rejects illegal or excessive hand selections %j', (...ids) => {
    const state = beginOnPlay()
    expect(() => applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: ids })).toThrow()
  })

  it.each([
    { energyColor: 'red' as const, level: 2 },
    { energyColor: 'yellow' as const, level: 1 },
  ])('does not count a wrong color or level faint (%j)', (record) => {
    const base = createCardCheckDemoState('BS9-010')
    const state = { ...base, cookiesFaintedDuringOpponentPreviousTurn: {
      'player-one': [{ energyColor: 'red' as const, level: 1 }, record],
    } }
    expect(() => applyGameCommand(state, { kind: 'play-extra-deck-cookie', playerId: 'player-one', instanceId: sourceId })).toThrow()
  })

  it('does not use current-turn faints or the opponent casualties to satisfy EXTRA', () => {
    const base = createCardCheckDemoState('BS9-010')
    const state: GameState = { ...base,
      cookiesFaintedThisTurnDetails: { 'player-one': [{ energyColor: 'red', level: 1 }, { energyColor: 'red', level: 1 }] },
      cookiesFaintedDuringOpponentPreviousTurn: { 'player-two': [{ energyColor: 'red', level: 1 }, { energyColor: 'red', level: 1 }] },
    }
    expect(() => applyGameCommand(state, { kind: 'play-extra-deck-cookie', playerId: 'player-one', instanceId: sourceId })).toThrow()
  })

  it('clears a public marker when HP leaves and returns face-down to the same Cookie', () => {
    const state = settleOnPlay(beginOnPlay())
    const card = source(state).hpCards[0]
    const topPublicHpState: GameState = { ...state, players: { ...state.players,
      'player-one': { ...state.players['player-one'], battleArea: state.players['player-one'].battleArea.map((cookie) =>
        cookie.card.instanceId === sourceId ? { ...cookie, hpCards: [cookie.hpCards[1], card] } : cookie) },
    } }
    const receiver = topPublicHpState.players['player-one'].battleArea[0]
    const moved = executeCardEffect(topPublicHpState, { sourcePlayerId: 'player-one', sourceInstanceId: sourceId }, {
      kind: 'transfer-hp', direction: 'from-source', amount: 1, target: { side: 'self', min: 1, max: 1 },
    }, [receiver.card.instanceId])
    expect(source(moved).faceUpHpCardInstanceIds ?? []).not.toContain(card.instanceId)
    const receiverAfter = moved.players['player-one'].battleArea.find((cookie) => cookie.card.instanceId === receiver.card.instanceId)!
    expect(receiverAfter.faceUpHpCardInstanceIds ?? []).not.toContain(card.instanceId)
    const publicReceiver = maskGameStateForViewer(moved, 'player-one').players['player-one'].battleArea[0]
    expect(publicReceiver.hpCards.at(-1)?.id).toBe('hidden')
    const returned = executeCardEffect(moved, { sourcePlayerId: 'player-one', sourceInstanceId: sourceId }, {
      kind: 'transfer-hp', direction: 'to-source', amount: 1, target: { side: 'self', min: 1, max: 1 },
    }, [receiver.card.instanceId])
    expect(source(returned).hpCards.at(-1)).toEqual(card)
    expect(source(maskGameStateForViewer(returned, 'player-one')).hpCards.at(-1)?.id).toBe('hidden')
  })

  it('moves the chosen opponent Cookie top HP face-up to the bottom after paying Then', () => {
    const state = beginThen()
    const defenderId = state.players['player-two'].battleArea[0].card.instanceId
    const hpBefore = source(state).hpCards
    const donorHp = state.players['player-two'].battleArea[0].hpCards
    const moved = donorHp.at(-1)!
    const payment = state.players['player-one'].supportArea.find((entry) => !entry.rested)!
    const result = applyGameCommand(state, { kind: 'resolve-optional-cost-attack',
      playerId: 'player-one', action: 'pay', paymentIds: [payment.card.instanceId], targetIds: [defenderId] })
    expect(source(result).hpCards).toEqual([moved, ...hpBefore])
    expect(result.players['player-two'].battleArea[0].hpCards).toEqual(donorHp.slice(0, -1))
    expect(result.players['player-one'].supportArea.every((entry) => entry.rested)).toBe(true)
    expect(result.pendingBattle).toBeNull()
    for (const viewer of ['player-one', 'player-two'] as const) {
      const hp = source(maskGameStateForViewer(result, viewer)).hpCards
      expect(hp[0]).toEqual(moved)
      expect(hp[1]).toEqual(hpBefore[0])
      expect(hp.slice(2).every((card) => card.id === 'hidden')).toBe(true)
    }
  })

  it.each(['skip', 'pay'] as const)('allows Then %s with zero targets and preserves HP', (action) => {
    const state = beginThen()
    const payment = state.players['player-one'].supportArea[2].card.instanceId
    const result = applyGameCommand(state, { kind: 'resolve-optional-cost-attack', playerId: 'player-one',
      action, paymentIds: action === 'pay' ? [payment] : [], targetIds: [] })
    expect(source(result).hpCards).toEqual(source(state).hpCards)
    expect(result.players['player-two'].battleArea[0].hpCards).toEqual(state.players['player-two'].battleArea[0].hpCards)
    expect(result.players['player-one'].supportArea[2].rested).toBe(action === 'pay')
    expect(result.pendingBattle).toBeNull()
  })

  it.each(['missing-energy', 'rested-energy', 'source-cookie', 'own-target', 'duplicate-target'] as const)(
    'rejects Then %s without spending the remaining support', (invalid) => {
      const state = beginThen()
      const targetId = state.players['player-two'].battleArea[0].card.instanceId
      const paymentId = state.players['player-one'].supportArea[2].card.instanceId
      const paymentIds = invalid === 'missing-energy' ? [] : [invalid === 'rested-energy'
        ? state.players['player-one'].supportArea[0].card.instanceId : invalid === 'source-cookie' ? sourceId : paymentId]
      const targetIds = invalid === 'own-target' ? [sourceId] : invalid === 'duplicate-target' ? [targetId, targetId] : [targetId]
      expect(() => applyGameCommand(state, { kind: 'resolve-optional-cost-attack', playerId: 'player-one',
        action: 'pay', paymentIds, targetIds })).toThrow()
      expect(state.players['player-one'].supportArea[2].rested).toBe(false)
    },
  )

  it('rejects EXTRA at one qualifying faint and outside the owner main phase', () => {
    const base = createCardCheckDemoState('BS9-010')
    expect(getExtraDeckCookieUnavailableReason(createCardNegativeDemoState('BS9-010'), 'player-one', sourceId))
      .toBe('對手上一回合我方紅色 LV.1 餅乾昏厥數尚未達到 2 張。')
    expect(getExtraDeckCookieUnavailableReason(base, 'player-one', sourceId)).toBeNull()
    for (const state of [createCardNegativeDemoState('BS9-010'),
      { ...base, phase: 'support' as const }, { ...base, activePlayerId: 'player-two' as const }]) {
      expect(() => applyGameCommand(state, { kind: 'play-extra-deck-cookie', playerId: 'player-one', instanceId: sourceId })).toThrow()
    }
  })
})

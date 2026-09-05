/// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { applyGameCommand, canActivateCookieSkill, type GameState } from '../game'
import { getCardPoolEntry } from '../game/card-pool'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { createBattleState, cookie, item } from '../game/test-helpers/battle-helpers'
import { usePendingEffect } from './usePendingEffect'
import { createCardCheckDemoState, parseTestStateConfig } from '../game/demo'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const fixture = (hp: number): GameState => {
  const record = getCardPoolEntry('BS8-003')
  if (!record) throw new Error('Missing formal BS8-003')
  const converted = convertOfficialCardToGameCard(record)
  if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie') throw new Error('BS8-003 must be a Cookie')
  const base = createBattleState()
  return { ...base, phase: 'main', activePlayerId: 'player-one', skillUsesThisTurn: [], players: {
    ...base.players,
    'player-one': { ...base.players['player-one'], hand: [item('discard-cost')],
      deck: Array.from({length: 6}, (_, i) => item(`deck-${i}`)),
      battleArea: [
        { card: {...converted.gameCard, instanceId: 'source'}, hpCards: Array.from({length: hp}, (_, i) => item(`source-hp-${i}`)), rested: false, battleEntryId: 'source-entry' },
        { card: cookie('ally'), hpCards: Array.from({length: 4}, (_, i) => item(`ally-hp-${i}`)), rested: false },
      ],
    },
  } }
}

const activate = (state: GameState) => applyGameCommand(state, {
  kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: 'source', trigger: 'activate', paymentIds: [], discardHandIds: ['discard-cost'],
})

describe('BS8-003 official FAQ condition scope', () => {
  it('keeps HP-two Browser fixtures local and preserves the two cards distinct rulings', () => {
    for (const number of ['BS8-002', 'BS8-003']) {
      const url = `?test-state=bs8-hp-condition:${number}:unmet`
      const config = parseTestStateConfig(url, 'localhost')
      expect(config).toMatchObject({kind:'card-check', cardNumber:number, sourceHpCount:2})
      expect(parseTestStateConfig(url, 'example.com')).toBeNull()
      if (config?.kind !== 'card-check') throw new Error('Expected card-check')
      const state = createCardCheckDemoState(config.cardNumber, config)
      const source = state.players['player-one'].battleArea.find(entry => entry.card.id === number)!
      expect(source.hpCards).toHaveLength(2)
      expect(canActivateCookieSkill(state, 'player-one', source.card.instanceId, 'activate')).toBe(number === 'BS8-003')
    }
  })
  it.each([2, 5])('permits the discard at source HP %i, skips HP gain, and consumes the use', (hp) => {
    const initial = fixture(hp)
    expect(canActivateCookieSkill(initial, 'player-one', 'source', 'activate')).toBe(true)
    const next = activate(initial)
    expect(next.players['player-one'].hand).toHaveLength(0)
    expect(next.players['player-one'].discardPile.map(card => card.instanceId)).toContain('discard-cost')
    expect(next.players['player-one'].battleArea.map(entry => entry.hpCards.length)).toEqual([hp, 4])
    expect(next.players['player-one'].deck).toHaveLength(6)
    expect(next.pendingAbilityEffect).toBeUndefined()
    expect(() => activate(next)).toThrow()
    expect(initial.players['player-one'].hand).toHaveLength(1)
  })

  it('gains HP for all eligible Cookies when source HP is one', () => {
    const paid = activate(fixture(1))
    const next = applyGameCommand(paid, {kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: ['source', 'ally']})
    expect(next.players['player-one'].battleArea.map(entry => entry.hpCards.length)).toEqual([2, 5])
    expect(next.players['player-one'].deck).toHaveLength(4)
    expect(next.pendingAbilityEffect).toBeUndefined()
  })

  it('still rejects missing discard payment and the wrong phase', () => {
    const initial = fixture(2)
    const noHand = {...initial, players: {...initial.players, 'player-one': {...initial.players['player-one'], hand: []}}}
    expect(() => activate(noHand)).toThrow()
    expect(() => activate({...initial, phase: 'support'})).toThrow()
    expect(() => applyGameCommand(initial, {kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: 'source', trigger: 'activate', paymentIds: []})).toThrow()
  })

  it('lets the local UI select the discard at HP two and settles with a truthful no-op message', async () => {
    const initial = fixture(2)
    let current = initial
    let captured: ReturnType<typeof usePendingEffect> | null = null
    let message = ''
    function Harness() {
      const [game, setGame] = useState(initial)
      current = game
      captured = usePendingEffect({
        game, setGame, viewerPlayerId: 'player-one', setMessage: (text) => {message = text},
        dispatch: (command) => { setGame((Array.isArray(command) ? command : [command]).reduce((state, action) => applyGameCommand(state, action), game)) },
        clearAttacker: () => {}, setInspectedHpPile: () => {},
        hasFaint: false, faintTargetIds: new Set(), selectedFaintTargetIds: [], faintMinMax: {min:0,max:0}, setSelectedFaintTargetIds: () => {},
        hasAfterDamage: false, afterDamageTargetIds: new Set(), selectedAfterDamageTargetIds: [], afterDamageMinMax: {min:0,max:0}, setSelectedAfterDamageTargetIds: () => {},
      })
      return null
    }
    const root = createRoot(document.createElement('div'))
    try {
      await act(() => root.render(<Harness />))
      await act(() => captured!.beginCookieSkill(initial, initial.players['player-one'].battleArea[0].card, 'player-one', 'activate', 'Activate'))
      expect(captured!.pendingEffect).toBeTruthy()
      expect(captured!.currentEffectConditionMet).toBe(false)
      await act(() => captured!.toggleSkillDiscardHand('discard-cost'))
      await act(() => captured!.confirmEffect())
      expect(current.players['player-one'].hand).toHaveLength(0)
      expect(current.players['player-one'].battleArea.map(entry => entry.hpCards.length)).toEqual([2, 4])
      expect(captured!.pendingEffect).toBeNull()
      expect(message).toContain('已支付代價；效果條件未滿足，效果未執行')
    } finally {
      await act(() => root.unmount())
    }
  })
})

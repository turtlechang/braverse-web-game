import { describe, expect, it } from 'vitest'
import { createCardCheckDemoState, createCardNegativeDemoState } from './demo'
import { applyGameCommand } from './commands'
import { executeCardEffect, isEffectConditionMet } from './effects'
import { advancePhase } from './turn'
import { getCardPoolEntry } from './card-pool'
import { canActivateCookieSkill, getCookieSkillUnavailableReason } from './skills'
import { resolveBattleAutomatically } from './battle'
import bs8 from '../../data/cards/official-land-of-fire-and-ruin-realm-of-apathy-bs8.en.json'

describe('BS8 yellow Browser condition fixtures', () => {
  it('BS8-037 OnPlay pays yellow once and only adds one HP to its source; declining does not pay', () => {
    const initial = createCardCheckDemoState('BS8-037')
    const source = initial.players['player-one'].hand.find((card) => card.id === 'BS8-037')!
    const state = applyGameCommand(initial, { kind: 'deploy-cookie', playerId: 'player-one', instanceId: source.instanceId })
    const player = state.players['player-one']
    const command = { kind: 'begin-activate-skill' as const, playerId: 'player-one' as const, sourceInstanceId: source.instanceId,
      trigger: 'on-play' as const, paymentIds: [player.supportArea[0].card.instanceId] }
    expect(() => applyGameCommand(state, { ...command, paymentIds: [] })).toThrow()
    const noYellow = { ...state, players: { ...state.players, 'player-one': { ...player,
      supportArea: player.supportArea.map((entry) => ({ ...entry, card: { ...entry.card, energyColor: 'blue' as const } })) } } }
    expect(() => applyGameCommand(noYellow, command)).toThrow()
    const paid = applyGameCommand(state, command)
    const resolved = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
    expect(resolved.players['player-one'].battleArea.find((entry) => entry.card.instanceId === source.instanceId)?.hpCards).toHaveLength(3)
    expect(resolved.players['player-one'].deck.length).toBe(player.deck.length - 1)
    expect(resolved.players['player-one'].battleArea[0]).toEqual(player.battleArea[0])
    expect(() => applyGameCommand(resolved, command)).toThrow()
    const declined = applyGameCommand(state, { kind: 'skip-on-play', playerId: 'player-one', sourceInstanceId: source.instanceId })
    expect(declined.players['player-one']).toEqual(player)
  })
  it('BS8-033 variant has yellow energy and pays its neutral attack with mixed colours', () => {
    const initial = createCardCheckDemoState('BS8-033@1')
    const source = initial.players['player-one'].hand.find((card) => card.id === 'BS8-033')!
    expect(source).toMatchObject({ energyColor: 'yellow', attack: 3, attackEnergyCost: { neutral: 3 } })
    expect(source.type === 'cookie' && source.skill).toBeUndefined()
    const deployed = applyGameCommand(initial, { kind: 'deploy-cookie', playerId: 'player-one', instanceId: source.instanceId })
    const colours = ['blue', 'red', 'green'] as const
    const supportArea = deployed.players['player-one'].supportArea.slice(0, 3).map((entry, index) => ({ ...entry, card: { ...entry.card, energyColor: colours[index] } }))
    const state = { ...deployed, players: { ...deployed.players, 'player-one': { ...deployed.players['player-one'], supportArea } } }
    const command = { kind: 'declare-attack' as const, playerId: 'player-one' as const, attackerInstanceId: source.instanceId,
      targetInstanceId: state.players['player-two'].battleArea[0].card.instanceId, supportPaymentIds: supportArea.map((entry) => entry.card.instanceId) }
    expect(() => applyGameCommand(state, { ...command, supportPaymentIds: command.supportPaymentIds.slice(0, 2) })).toThrow()
    const resolved = resolveBattleAutomatically(applyGameCommand(state, command))
    expect(resolved.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
  })
  it.each(['BS8-031', 'BS8-031@1'])('%s pays LV3 trash before exactly two Break Cookies totalling at most 3 return', (cardNumber) => {
    const initial = createCardCheckDemoState(cardNumber)
    const source = initial.players['player-one'].hand.find((card) => card.id === 'BS8-031')!
    const state = applyGameCommand(initial, { kind: 'deploy-cookie', playerId: 'player-one', instanceId: source.instanceId })
    const player = state.players['player-one']
    const costCard = player.discardPile.find((card) => card.id === 'BS8-030')!
    const command = { kind: 'begin-activate-skill' as const, playerId: 'player-one' as const,
      sourceInstanceId: source.instanceId, trigger: 'on-play' as const, paymentIds: [player.supportArea[0].card.instanceId],
      trashCookieToBreakAreaIds: [costCard.instanceId] }
    expect(canActivateCookieSkill(state, 'player-one', source.instanceId, 'on-play')).toBe(true)
    for (const ids of [[], [costCard.instanceId, costCard.instanceId], [player.discardPile[0].instanceId]]) {
      expect(() => applyGameCommand(state, { ...command, trashCookieToBreakAreaIds: ids })).toThrow()
    }
    expect(() => applyGameCommand(state, { ...command, paymentIds: [] })).toThrow()
    const pending = applyGameCommand(state, command)
    expect(pending.players['player-one'].breakArea).toContainEqual(costCard)
    expect(pending.players['player-one'].discardPile).not.toContainEqual(costCard)
    expect(pending.players['player-one'].supportArea[0].rested).toBe(true)
    expect(pending.pendingAbilityEffect?.effects).toHaveLength(1)
    expect(JSON.stringify(pending.commandLog)).toContain('技能代價：棄牌區餅乾放入休息區')
    const targetIds = player.breakArea.map((card) => card.instanceId)
    for (const ids of [[], targetIds.slice(0, 1), [targetIds[0], costCard.instanceId], [targetIds[0], targetIds[0]], [targetIds[0], targetIds[0], targetIds[1]]]) {
      expect(() => applyGameCommand(pending, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: ids })).toThrow()
    }
    const resolved = applyGameCommand(pending, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds })
    expect(resolved.players['player-one'].breakArea).toEqual([costCard])
    expect(resolved.players['player-one'].hand.length).toBe(player.hand.length + 2)
    expect(state.players['player-one'].discardPile).toContainEqual(costCard)
    const negativeInitial = createCardNegativeDemoState(cardNumber)
    const negative = applyGameCommand(negativeInitial, { kind: 'deploy-cookie', playerId: 'player-one', instanceId: source.instanceId })
    expect(canActivateCookieSkill(negative, 'player-one', source.instanceId, 'on-play')).toBe(false)
    expect(getCookieSkillUnavailableReason(negative, 'player-one', source.instanceId, 'on-play')).toContain('棄牌區沒有符合')
    const atSeven = { ...state, players: { ...state.players, 'player-one': { ...player,
      breakArea: [...player.breakArea,
        { ...player.breakArea[1], instanceId: 'break-boundary-lv2-a' },
        { ...player.breakArea[1], instanceId: 'break-boundary-lv2-b' }],
    } } }
    expect(atSeven.players['player-one'].breakArea.reduce((sum, card) => sum + card.level, 0)).toBe(7)
    const defeated = applyGameCommand(atSeven, command)
    expect(defeated.status).toBe('finished')
    expect(defeated.result).toMatchObject({ winnerId: 'player-two', reason: 'break-level-limit' })
    expect(defeated.players['player-one'].hand).toEqual(player.hand)
    expect(defeated.players['player-one'].breakArea).toHaveLength(5)
    expect(defeated.pendingAbilityEffect).toBeFalsy()
  })
  it('BS8-030 requires two yellow plus two arbitrary support energy for its vanilla attack', () => {
    const initial = createCardCheckDemoState('BS8-030')
    const card = initial.players['player-one'].hand.find((card) => card.id === 'BS8-030')!
    const deployed = applyGameCommand(initial, { kind: 'deploy-cookie', playerId: 'player-one', instanceId: card.instanceId })
    const source = deployed.players['player-one'].battleArea.find((entry) => entry.card.id === 'BS8-030')!
    expect(source.card).toMatchObject({ attack: 4, attackEnergyCost: { yellow: 2, neutral: 2 } })
    expect(source.card.skill).toBeUndefined()
    expect(source.card.attackEffects).toBeUndefined()
    for (const yellow of [1, 2]) {
      const supportArea = deployed.players['player-one'].supportArea.slice(0, 4).map((entry, index) => ({ ...entry, card: { ...entry.card, energyColor: index < yellow ? 'yellow' as const : 'blue' as const } }))
      const state = { ...deployed, players: { ...deployed.players, 'player-one': { ...deployed.players['player-one'], supportArea } } }
      const command = { kind: 'declare-attack' as const, playerId: 'player-one' as const, attackerInstanceId: source.card.instanceId, targetInstanceId: state.players['player-two'].battleArea[0].card.instanceId, supportPaymentIds: supportArea.map((entry) => entry.card.instanceId) }
      if (yellow === 1) expect(() => applyGameCommand(state, command)).toThrow()
      else {
        const result = resolveBattleAutomatically(applyGameCommand(state, command))
        expect(result.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
      }
    }
  })
  it('BS8-029 draws exactly the chosen 0 or 1, blocks unmet history and reuse', () => {
    const state = createCardCheckDemoState('BS8-029@1')
    const player = state.players['player-one']
    const source = player.battleArea[0].card
    expect(source.energyColor).toBe('yellow')
    const negative = createCardNegativeDemoState('BS8-029@1')
    expect(canActivateCookieSkill(negative, 'player-one', source.instanceId, 'activate')).toBe(false)
    for (const count of [0, 1]) {
      let result = applyGameCommand(state, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: source.instanceId, trigger: 'activate', paymentIds: [] })
      result = applyGameCommand(result, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
      expect(() => applyGameCommand(result, { kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount: 2 })).toThrow()
      result = applyGameCommand(result, { kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount: count })
      expect(result.players['player-one'].hand.length).toBe(player.hand.length + count)
      expect(result.players['player-one'].deck.length).toBe(player.deck.length - count)
      expect(canActivateCookieSkill(result, 'player-one', source.instanceId, 'activate')).toBe(false)
    }
  })
  it('BS8-028 remembers a real Break entry after departure, permits zero, and enforces once per turn', () => {
    const original = createCardNegativeDemoState('BS8-028@1')
    const player = original.players['player-one']
    const source = player.battleArea[0].card
    const companion = player.battleArea[1].card
    expect(source.energyColor).toBe('yellow')
    expect(getCardPoolEntry('BS8-028@1')?.color).toBe('YELLOW')
    const context = { sourcePlayerId: 'player-one' as const, sourceInstanceId: source.instanceId }
    expect(canActivateCookieSkill(original, 'player-one', source.instanceId, 'activate')).toBe(false)
    const prepared = { ...original, players: { ...original.players, 'player-one': {
      ...player, battleArea: player.battleArea.slice(0, 1), breakArea: [companion],
    } } }
    const entered = executeCardEffect(prepared, context, { kind: 'break-to-battle', amount: 1 }, [companion.instanceId])
    const departed = executeCardEffect(entered, context, { kind: 'return-to-hand', target: { side: 'self', min: 1, max: 1 } }, [companion.instanceId])
    expect(departed.players['player-one'].battleArea).toHaveLength(1)
    expect(departed.cookiesPlayedFromBreakThisTurn?.['player-one']).toBe(true)
    expect(canActivateCookieSkill(departed, 'player-one', source.instanceId, 'activate')).toBe(true)
    for (const chooseTarget of [true, false]) {
      let resolved = applyGameCommand(departed, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: source.instanceId, trigger: 'activate', paymentIds: [] })
      const target = departed.players['player-two'].battleArea[0]
      resolved = applyGameCommand(resolved, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: chooseTarget ? [target.card.instanceId] : [] })
      resolved = resolveBattleAutomatically(resolved)
      expect(resolved.players['player-two'].battleArea[0].hpCards.length).toBe(target.hpCards.length - Number(chooseTarget))
      expect(canActivateCookieSkill(resolved, 'player-one', source.instanceId, 'activate')).toBe(false)
      if (!chooseTarget) expect(JSON.stringify(resolved.commandLog)).toContain('選擇 0 個目標')
    }
    const nextTurn = advancePhase(advancePhase(departed))
    expect(nextTurn.cookiesPlayedFromBreakThisTurn?.['player-one']).not.toBe(true)
  })
  it('awakens BS8-027 with two added HP and damages every opponent after its paid attack', () => {
    let state = createCardCheckDemoState('BS8-027')
    const opponent = state.players['player-two'].battleArea[0]
    state = { ...state, players: { ...state.players, 'player-two': {
      ...state.players['player-two'], battleArea: [opponent, {
        ...opponent, card: { ...opponent.card, instanceId: 'second-opponent' },
        hpCards: opponent.hpCards.map((card) => ({ ...card, instanceId: `second-${card.instanceId}` })),
      }],
    } } }
    const player = state.players['player-one']
    state = applyGameCommand(state, { kind: 'play-extra-deck-cookie', playerId: 'player-one',
      instanceId: player.extraDeck![0].instanceId })
    const awakened = state.players['player-one'].battleArea[0]
    expect(awakened.hpCards).toHaveLength(6)
    expect(awakened.card.id).toBe('BS8-027')
    const withTrashTarget = { ...state, players: { ...state.players, 'player-one': {
      ...state.players['player-one'], discardPile: [player.battleArea[0].card],
    } } }
    expect(canActivateCookieSkill(withTrashTarget, 'player-one', awakened.card.instanceId, 'activate')).toBe(false)
    state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-one',
      attackerInstanceId: awakened.card.instanceId, targetInstanceId: opponent.card.instanceId,
      supportPaymentIds: player.supportArea.map((entry) => entry.card.instanceId) })
    state = resolveBattleAutomatically(state)
    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-two'].battleArea.map((entry) => entry.hpCards.length)).toEqual([2, 5])
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(6)
  })
  it('preserves every BS8-027 variant and exchanges the Break source before the locked trash target', () => {
    for (const card of bs8.cards.filter((card) => card.baseCardNumber === 'BS8-027')) {
      const positive = createCardCheckDemoState(card.cardNumber, { preferSkillSurface: true })
      const player = positive.players['player-one']
      const source = player.breakArea[0]
      const target = player.discardPile[0]
      expect(source.imageUrl).toBe(card.imageUrl)
      const pending = applyGameCommand(positive, {
        kind: 'begin-activate-skill', playerId: 'player-one',
        sourceInstanceId: source.instanceId, trigger: 'activate', paymentIds: [],
      })
      expect(() => applyGameCommand(pending, {
        kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [],
      })).toThrow()
      const resolved = applyGameCommand(pending, {
        kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [target.instanceId],
      })
      expect(resolved.status).toBe('playing')
      expect(resolved.pendingAbilityEffect).toBeUndefined()
      expect(resolved.players['player-one'].breakArea.map((card) => card.instanceId)).not.toContain(source.instanceId)
      expect(resolved.players['player-one'].breakArea.map((card) => card.instanceId)).toContain(target.instanceId)
      expect(resolved.players['player-one'].discardPile.map((card) => card.instanceId)).toContain(source.instanceId)
      expect(resolved.players['player-one'].breakArea.reduce((sum, card) => sum + card.level, 0)).toBe(9)
      const negative = createCardNegativeDemoState(card.cardNumber, { preferSkillSurface: true })
      expect(canActivateCookieSkill(negative, 'player-one', source.instanceId, 'activate')).toBe(false)
      expect(getCookieSkillUnavailableReason(negative, 'player-one', source.instanceId, 'activate')).toContain('Golden Cheese Cookie')
    }
  })
  it.each(['BS8-026', 'BS8-026@1'])('%s isolates HP 4 versus HP 5 with a payable attack', (cardNumber) => {
    for (const negative of [false, true]) {
      const state = negative
        ? createCardNegativeDemoState(cardNumber)
        : createCardCheckDemoState(cardNumber)
      const player = state.players['player-one']
      const source = player.battleArea[0]
      const effect = source.card.attackEffects?.[0]
      if (!effect) throw new Error('Missing Golden Cheese attack follow-up')
      expect(source.hpCards).toHaveLength(negative ? 5 : 4)
      expect(source.rested).toBe(false)
      expect(state.pendingBattle).toBeNull()
      expect(isEffectConditionMet(state, {
        sourcePlayerId: 'player-one',
        sourceInstanceId: source.card.instanceId,
      }, effect)).toBe(!negative)
      const declared = applyGameCommand(state, {
        kind: 'declare-attack',
        playerId: 'player-one',
        attackerInstanceId: source.card.instanceId,
        targetInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
        supportPaymentIds: player.supportArea.slice(0, 3).map((entry) => entry.card.instanceId),
      })
      expect(declared.pendingBattle?.stage).toBe('trap')
      expect(declared.players['player-one'].supportArea.filter((entry) => entry.rested)).toHaveLength(3)
    }
  })
})

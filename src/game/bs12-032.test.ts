import { describe, expect, it } from 'vitest'
import { createBs12CarpetDemoState, createBs12ChouxDemoState, parseTestStateConfig } from './demo'
import { executeCardEffect } from './effects'
import { applyGameCommand, getPendingDecision } from './commands'
import { getAfterDamageEffectCandidates, getAfterDamageEffectSourceCard, resolveNextAfterDamageEffect } from './battle'
import { compilePendingDecisionDescriptor } from './decision-descriptor-compiler'
import { takeAiStep } from './ai'
import { describeCommandSteps } from './command-log'
import { collectBreakEntryCostEffects } from './break-effect-triggers'
import type { CardEffect, GameState } from './types'
import { canActivateCookieSkill } from './skills'
const playerId = 'player-one' as const
const context = { sourcePlayerId: playerId, sourceInstanceId: 'bs12-032-mover' }
const move: CardEffect = { kind: 'battle-to-break', target: { side: 'self', min: 0, max: 1 } }
const resolve = (state: GameState, ids: string[] = ['bs12-032-mover']) => applyGameCommand(state, { kind: 'resolve-after-damage-effect', playerId, targetIds: ids })

describe.each(['BS12-032', 'BS12-032@1'] as const)('%s source Break entry by Arena effect', number => {
  const onPlayState = (): GameState => ({ ...createBs12ChouxDemoState('positive', number),
    pendingOnPlay: { playerId, sourceInstanceId: context.sourceInstanceId, origin: 'hand' },
  })
  it('uses the physical six-HP Sugar Swan as the ordinary damage bearer', () => {
    const defender = createBs12ChouxDemoState('positive', number).players['player-two'].battleArea[0]
    expect(defender.card).toMatchObject({ id: 'BS6-008', name: 'Sugar Swan Cookie', hp: 6 })
    expect(defender.hpCards).toHaveLength(6)
  })
  it('printed BS7-033 pays another Arena as a cost before its only damage effect', () => {
    const before = onPlayState()
    const snapshot = structuredClone(before)
    const paid = applyGameCommand(before, { kind: 'begin-activate-skill', playerId, sourceInstanceId: context.sourceInstanceId,
      trigger: 'on-play', paymentIds: [], trashBattleCookieIds: ['bs12-032-source'],
    })
    expect(before).toEqual(snapshot)
    expect(paid.players[playerId].breakArea.map(card => card.instanceId)).toEqual(['bs12-032-source'])
    expect(paid.players[playerId].discardPile).toHaveLength(2)
    expect(paid.players[playerId].deck).toHaveLength(12)
    expect(paid.pendingAbilityEffect?.effects).toEqual([{ kind: 'damage', amount: 2, target: { side: 'opponent', min: 0, max: 1 } }])
    expect(paid.pendingAfterDamageEffects).toHaveLength(1)
    expect(describeCommandSteps(before, paid, { kind: 'begin-activate-skill', playerId, sourceInstanceId: context.sourceInstanceId,
      trigger: 'on-play', paymentIds: [], trashBattleCookieIds: ['bs12-032-source'],
    })?.map(step => step.text).join(' ')).toMatch(/代價.*休息區/)
    expect(() => resolve(paid)).toThrow()
    const damaged = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds: ['bs12-032-opponent'] })
    expect(damaged.players['player-two'].battleArea[0].hpCards).toHaveLength(4)
    const done = resolve(damaged)
    expect(done.players[playerId].battleArea[0].hpCards).toHaveLength(6)
    expect(done.players[playerId].deck).toHaveLength(11)
    expect(done.pendingAfterDamageEffects).toBeUndefined()
  })
  it('printed BS7-033 cannot pay with itself or a non-Arena ally', () => {
    const before = onPlayState()
    expect(() => applyGameCommand(before, { kind: 'begin-activate-skill', playerId, sourceInstanceId: context.sourceInstanceId,
      trigger: 'on-play', paymentIds: [], trashBattleCookieIds: [context.sourceInstanceId],
    })).toThrow()
    const blocked = { ...before, players: { ...before.players, [playerId]: { ...before.players[playerId],
      battleArea: before.players[playerId].battleArea.map(cookie => cookie.card.instanceId === 'bs12-032-source'
        ? { ...cookie, card: { ...cookie.card, keywords: [] } } : cookie),
    } } }
    expect(canActivateCookieSkill(blocked, playerId, context.sourceInstanceId, 'on-play')).toBe(false)
  })
  it('printed BS7-033 may skip damage and HP after paying its required movement', () => {
    const paid = applyGameCommand(onPlayState(), { kind: 'begin-activate-skill', playerId, sourceInstanceId: context.sourceInstanceId,
      trigger: 'on-play', paymentIds: [], trashBattleCookieIds: ['bs12-032-source'],
    })
    const outer = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds: [] })
    const done = resolve(outer, [])
    expect(done.players[playerId].breakArea).toHaveLength(1)
    expect(done.players[playerId].deck).toHaveLength(12)
    expect(done.players['player-two']).toEqual(paid.players['player-two'])
    expect(done.pendingAfterDamageEffects).toBeUndefined()
  })
  it('printed BS7-033 cost on the opponent turn does not activate Your Turn HP', () => {
    expect(parseTestStateConfig(`?test-state=${number.toLowerCase()}:on-play-opponent-turn`, 'localhost')).toEqual({
      kind: 'bs12-032', cardNumber: number, scenario: 'on-play-opponent-turn',
    })
    const before = createBs12ChouxDemoState('on-play-opponent-turn', number)
    expect(before.activePlayerId).toBe('player-two')
    expect(before.pendingOnPlay?.playerId).toBe(playerId)
    const paid = applyGameCommand(before, { kind: 'begin-activate-skill', playerId, sourceInstanceId: context.sourceInstanceId,
      trigger: 'on-play', paymentIds: [], trashBattleCookieIds: ['bs12-032-source'],
    })
    expect(paid.players[playerId].breakArea).toHaveLength(1)
    expect(paid.pendingAfterDamageEffects).toBeUndefined()
    const done = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds: ['bs12-032-opponent'] })
    expect(done.players['player-two'].battleArea[0].hpCards).toHaveLength(4)
    expect(done.players[playerId].battleArea[0].hpCards).toHaveLength(5)
    expect(done.players[playerId].deck).toHaveLength(12)
    expect(done.pendingAfterDamageEffects).toBeUndefined()
  })
  it('routes both physical prints and preserves raw candidate isolation', () => {
    expect(parseTestStateConfig(`?test-state=${number.toLowerCase()}:positive`, 'localhost')).toEqual({ kind: 'bs12-032', cardNumber: number, scenario: 'positive' })
    expect(parseTestStateConfig(`?test-state=${number}:positive`, 'example.com')).toBeNull()
  })
  it('routes the manual card URL to the printed Arena FLIP faint workflow', () => {
    expect(parseTestStateConfig(`?test-state=card:${number}`, 'localhost')).toEqual({ kind: 'bs12-032', cardNumber: number, scenario: 'arena-faint' })
    const state = createBs12ChouxDemoState('arena-faint', number)
    expect(state.players[playerId].battleArea[0].hpCards).toHaveLength(1)
    expect(state.players['player-two'].battleArea[0].hpCards[0].id).toBe('BS12-004')
    expect(state.pendingAfterDamageEffects).toBeUndefined()
    expect(parseTestStateConfig(`?test-state=card:${number}`, 'example.com')).toBeNull()
  })
  it.each(['positive', 'rested-source', 'equipped-source'] as const)('direct Arena movement queues source outside battle: %s', scenario => {
    const before = createBs12ChouxDemoState(scenario, number)
    const snapshot = structuredClone(before)
    const moved = executeCardEffect({ ...before, pendingOnPlay: null }, context, move, ['bs12-032-source'])
    expect(before).toEqual(snapshot)
    expect(moved.players[playerId].breakArea.map(c => c.instanceId)).toEqual(['bs12-032-source'])
    expect(moved.cookiesFaintedThisTurn?.[playerId] ?? 0).toBe(0)
    expect(moved.pendingFaintEffects).toBeUndefined()
    expect(moved.pendingAfterDamageEffects).toHaveLength(1)
    expect(moved.pendingAfterDamageEffects![0]).toMatchObject({ triggerReason: 'break-by-arena-effect', sourceInstanceId: 'bs12-032-source' })
    expect(getAfterDamageEffectCandidates(moved).map(c => c.card.instanceId)).toEqual(['bs12-032-mover'])
    expect(compilePendingDecisionDescriptor(moved)?.steps.find(s => s.kind === 'target')).toMatchObject({ min: 0, max: 1, candidateIds: ['bs12-032-mover'] })
    const oldHp = moved.players[playerId].battleArea[0].hpCards.length
    const done = resolve(moved)
    expect(done.players[playerId].battleArea[0].hpCards).toHaveLength(oldHp + 1)
    expect(done.players[playerId].deck).toHaveLength(11)
    expect(done.players['player-two']).toEqual(moved.players['player-two'])
    expect(done.pendingAfterDamageEffects).toBeUndefined()
  })
  it('generic direct movement preserves an outer two-step ability; this is not BS7-033 cost acceptance', () => {
    const initial: GameState = { ...createBs12ChouxDemoState('positive', number), pendingOnPlay: null,
      pendingAbilityEffect: { playerId, sourcePlayerId: playerId, sourceInstanceId: context.sourceInstanceId, sourceCardName: 'Arena movement mechanism fixture', sourceKind: 'skill',
        effects: [move, { kind: 'damage', amount: 2, target: { side: 'opponent', min: 0, max: 1 } }], effectIndex: 0 } }
    const moved = applyGameCommand(initial, { kind: 'resolve-ability-effect', playerId, targetIds: ['bs12-032-source'] })
    // Ordinary ability targets are handled by the existing ability panel,
    // rather than the PendingDecision union. The standby choice stays hidden.
    expect(getPendingDecision(moved)).toBeNull()
    expect(moved.pendingAbilityEffect?.effectIndex).toBe(1)
    expect(() => resolve(moved)).toThrow()
    expect(() => resolveNextAfterDamageEffect(moved, ['bs12-032-mover'])).toThrow(/先完成/)
    const outerDone = applyGameCommand(moved, { kind: 'resolve-ability-effect', playerId, targetIds: ['bs12-032-opponent'] })
    expect(getPendingDecision(outerDone)?.kind).toBe('after-damage-effect')
    const done = resolve(outerDone)
    expect(done.players['player-two'].battleArea[0].hpCards).toHaveLength(4)
    expect(done.pendingAbilityEffect).toBeUndefined()
    expect(done.pendingReplacement?.tasks[0]).toMatchObject({ playerId, remaining: 1 })
  })
  it.each(['non-arena', 'opponent-turn', 'old-break'] as const)('keeps HP and deck unchanged without qualifying event: %s', scenario => {
    const before = { ...createBs12ChouxDemoState(scenario, number), pendingOnPlay: null }
    const target = scenario === 'old-break' ? 'bs12-032-old-ally' : 'bs12-032-source'
    const moved = executeCardEffect(before, context, move, [target])
    expect(moved.pendingAfterDamageEffects).toBeUndefined()
    expect(moved.players[playerId].deck).toHaveLength(12)
  })
  it('031 Arena movement cost queues HP until its own draw and damage effects finish', () => {
    const paid = applyGameCommand(createBs12ChouxDemoState('cost', number), { kind: 'begin-play-item', playerId, instanceId: 'bs12-032-item', paymentIds: ['bs12-032-payment-0', 'bs12-032-payment-1'], trashBattleCookieIds: ['bs12-032-source'] })
    expect(paid.players[playerId].breakArea[0].instanceId).toBe('bs12-032-source')
    expect(paid.players[playerId].supportArea.every(entry => entry.rested)).toBe(true)
    expect(paid.pendingAfterDamageEffects).toHaveLength(1)
    expect(paid.pendingAfterDamageEffects![0].sourceInstanceId).toBe('bs12-032-source')
    expect(() => resolve(paid)).toThrow()
    const chooseDraw = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds: [] })
    const drawn = applyGameCommand(chooseDraw, { kind: 'resolve-draw-up-to', playerId, drawCount: 1 })
    const itemDone = applyGameCommand(drawn, { kind: 'resolve-ability-effect', playerId, targetIds: ['bs12-032-opponent'] })
    expect(getPendingDecision(itemDone)?.kind).toBe('after-damage-effect')
    const hp = itemDone.players[playerId].battleArea[0].hpCards.length
    const done = resolve(itemDone)
    expect(done.players[playerId].battleArea[0].hpCards).toHaveLength(hp + 1)
    expect(done.players[playerId].deck).toHaveLength(10)
    expect(done.players['player-two'].battleArea[0].hpCards).toHaveLength(5)
    expect(done.pendingAfterDamageEffects).toBeUndefined()
  })
  it.each([0, 3])('028 Arena hand movement cost queues HP after drawing %s', count => {
    const initial = createBs12CarpetDemoState()
    const source = createBs12ChouxDemoState('cost', number).players[playerId].battleArea[0].card
    const before = { ...initial, players: { ...initial.players, [playerId]: { ...initial.players[playerId],
      hand: initial.players[playerId].hand.map(card => card.instanceId === 'bs12-028-yellow-cost' ? source : card),
    } } }
    const paid = applyGameCommand(before, { kind: 'begin-play-item', playerId, instanceId: 'bs12-028-item', paymentIds: ['bs12-028-payment'], handToBreakAreaIds: [source.instanceId] })
    expect(paid.pendingAfterDamageEffects).toHaveLength(1)
    const drawChoice = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds: [] })
    const drawn = applyGameCommand(drawChoice, { kind: 'resolve-draw-up-to', playerId, drawCount: count })
    expect(getPendingDecision(drawn)?.kind).toBe('after-damage-effect')
    const target = drawn.players[playerId].battleArea[0]
    const done = resolve(drawn, [target.card.instanceId])
    expect(done.players[playerId].battleArea[0].hpCards).toHaveLength(target.hpCards.length + 1)
    expect(done.players[playerId].deck).toHaveLength(11 - count)
  })
  it('a direct Arena cost reaching Break LV10 ends before creating an HP choice', () => {
    const initial = createBs12ChouxDemoState('cost', number)
    const source = initial.players[playerId].battleArea[0].card
    const before = { ...initial, players: { ...initial.players, [playerId]: { ...initial.players[playerId],
      breakArea: Array.from({ length: 9 }, (_, i) => ({ ...source, instanceId: `old-break-${i}` })),
    } } }
    const after = applyGameCommand(before, { kind: 'begin-play-item', playerId, instanceId: 'bs12-032-item', paymentIds: ['bs12-032-payment-0', 'bs12-032-payment-1'], trashBattleCookieIds: ['bs12-032-source'] })
    expect(after.status).toBe('finished')
    expect(after.pendingAfterDamageEffects).toBeUndefined()
    expect(after.players[playerId].deck).toHaveLength(12)
  })
  it('R001 cost collector accepts HP/faint costs and rejects unrelated selections', () => {
    const before = createBs12ChouxDemoState('cost', number)
    const owner = before.players[playerId]
    const after = { ...before, players: { ...before.players, [playerId]: { ...owner, battleArea: owner.battleArea.slice(1), breakArea: [owner.battleArea[0].card] } } }
    const costContext = { sourcePlayerId: playerId, sourceInstanceId: 'bs12-032-item' }
    expect(collectBreakEntryCostEffects(before, after, costContext, { hpToTrash: { amount: 2 } }, {}).pendingAfterDamageEffects).toHaveLength(1)
    expect(collectBreakEntryCostEffects(before, after, costContext, { trashBattleCookie: { count: 1, faint: true } }, { trashBattleCookieIds: ['bs12-032-source'] }).pendingAfterDamageEffects).toHaveLength(1)
    expect(collectBreakEntryCostEffects(before, after, costContext, { trashBattleCookie: { count: 1, toBreakArea: true } }, { trashBattleCookieIds: ['another-cookie'] }).pendingAfterDamageEffects).toBeUndefined()
  })
  it.each(['hand', 'trash'] as const)('shared Arena Activate direct movement cost handles %s provenance', zone => {
    const initial = createBs12ChouxDemoState('cost', number)
    const owner = initial.players[playerId]
    const source = owner.battleArea[0].card
    const mover = createBs12ChouxDemoState('attack', number).players[playerId].battleArea[1].card
    // Isolated shared-cost mechanism, not a claim about the printed 024 skill.
    const arena = { ...mover, instanceId: 'cost-mechanism', skill: { trigger: 'activate' as const,
      oncePerTurn: false, yourTurn: false, restSource: false,
      text: 'Arena cost mechanism fixture',
      cost: zone === 'hand' ? { energy: {}, handToBreakArea: { count: 1 } } : { energy: {}, trashCookieToBreakArea: { count: 1 } },
      effects: [{ kind: 'draw-up-to' as const, max: 1 }],
    } }
    const before = { ...initial, players: { ...initial.players, [playerId]: { ...owner,
      hand: zone === 'hand' ? [source] : [], discardPile: zone === 'trash' ? [source] : [],
      battleArea: [{ ...owner.battleArea[0], card: arena }, owner.battleArea[1]],
    } } }
    const paid = applyGameCommand(before, { kind: 'begin-activate-skill', playerId, sourceInstanceId: 'cost-mechanism', trigger: 'activate', paymentIds: [],
      ...(zone === 'hand' ? { handToBreakAreaIds: [source.instanceId] } : { trashCookieToBreakAreaIds: [source.instanceId] }),
    })
    expect(paid.pendingAfterDamageEffects).toHaveLength(1)
    const choice = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds: [] })
    expect(getPendingDecision(choice)?.kind).toBe('draw-up-to')
    const drawn = applyGameCommand(choice, { kind: 'resolve-draw-up-to', playerId, drawCount: 0 })
    expect(getPendingDecision(drawn)?.kind).toBe('after-damage-effect')
    expect(resolve(drawn, []).pendingAfterDamageEffects).toBeUndefined()
  })
  it('cost trigger respects Arena source and Your Turn independently', () => {
    const before = createBs12ChouxDemoState('cost', number)
    const owner = before.players[playerId]
    const after = { ...before, players: { ...before.players, [playerId]: { ...owner, battleArea: owner.battleArea.slice(1), breakArea: [owner.battleArea[0].card] } } }
    const cost = { trashBattleCookie: { count: 1, toBreakArea: true } }
    const choices = { trashBattleCookieIds: ['bs12-032-source'] }
    const costContext = { sourcePlayerId: playerId, sourceInstanceId: 'bs12-032-item' }
    const noArena = { ...before, players: { ...before.players, [playerId]: { ...owner, hand: owner.hand.map(card => ({ ...card, keywords: [] })) } } }
    expect(collectBreakEntryCostEffects(noArena, after, costContext, cost, choices).pendingAfterDamageEffects).toBeUndefined()
    expect(collectBreakEntryCostEffects(before, { ...after, activePlayerId: 'player-two' }, costContext, cost, choices).pendingAfterDamageEffects).toBeUndefined()
  })
  it.each([[], ['bs12-032-mover']].map(ids => ({ ids })))('031 optional steps and HP choice may skip independently: $ids', ({ ids }) => {
    const before = createBs12ChouxDemoState('cost', number)
    const paid = applyGameCommand(before, { kind: 'begin-play-item', playerId, instanceId: 'bs12-032-item', paymentIds: ['bs12-032-payment-0', 'bs12-032-payment-1'], trashBattleCookieIds: ['bs12-032-source'] })
    const drawChoice = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds: [] })
    const drawn = applyGameCommand(drawChoice, { kind: 'resolve-draw-up-to', playerId, drawCount: 0 })
    const itemDone = applyGameCommand(drawn, { kind: 'resolve-ability-effect', playerId, targetIds: [] })
    const done = resolve(itemDone, ids)
    expect(done.players[playerId].deck).toHaveLength(ids.length ? 11 : 12)
    expect(done.players['player-two']).toEqual(before.players['player-two'])
    expect(done.pendingAfterDamageEffects).toBeUndefined()
  })
  it('zero target still keeps movement paid and records truthful no-op', () => {
    const moved = executeCardEffect({ ...createBs12ChouxDemoState('positive', number), pendingOnPlay: null }, context, move, ['bs12-032-source'])
    const done = resolve(moved, [])
    expect(done.players[playerId].deck).toHaveLength(12)
    expect(done.players[playerId].battleArea[0].hpCards).toEqual(moved.players[playerId].battleArea[0].hpCards)
    expect(describeCommandSteps(moved, done, { kind: 'resolve-after-damage-effect', playerId, targetIds: [] })?.map(s => s.text).join(' ')).toMatch(/休息區移入效果.*未增加 HP/)
  })
  it.each(['hand', 'discardPile'] as const)('direct Arena effect can place the source from %s into Break', zone => {
    const initial = createBs12ChouxDemoState('positive', number)
    const owner = initial.players[playerId]
    const before: GameState = { ...initial, players: { ...initial.players, [playerId]: {
      ...owner, battleArea: owner.battleArea.slice(1), [zone]: [owner.battleArea[0].card],
    } } }
    const moved = executeCardEffect(before, context, { kind: zone === 'hand' ? 'hand-to-break' : 'trash-to-break', amount: 1 }, ['bs12-032-source'])
    expect(moved.players[playerId].breakArea.map(card => card.instanceId)).toEqual(['bs12-032-source'])
    expect(moved.pendingAfterDamageEffects).toHaveLength(1)
    expect(resolve(moved).players[playerId].battleArea[0].hpCards).toHaveLength(owner.battleArea[1].hpCards.length + 1)
  })
  it('cancels a standby effect if its source returns to the private hand before activation', () => {
    const moved = executeCardEffect(createBs12ChouxDemoState('positive', number), context, move, ['bs12-032-source'])
    const returned = executeCardEffect(moved, context, { kind: 'break-to-hand', amount: 1 }, ['bs12-032-source'])
    expect(returned.players[playerId].hand[0].instanceId).toBe('bs12-032-source')
    expect(returned.pendingAfterDamageEffects).toBeUndefined()
    expect(returned.players[playerId].deck).toHaveLength(12)
  })
  it.each([['bs12-032-source'], ['bs12-032-opponent'], ['bs12-032-mover', 'bs12-032-mover']].map(ids => ({ ids })))('rejects illegal targets without mutation: $ids', ({ ids }) => {
    const moved = executeCardEffect({ ...createBs12ChouxDemoState('positive', number), pendingOnPlay: null }, context, move, ['bs12-032-source'])
    const snapshot = structuredClone(moved)
    expect(() => resolve(moved, ids)).toThrow()
    expect(moved).toEqual(snapshot)
  })
  it('AI completes the queued HP choice', () => {
    const moved = executeCardEffect({ ...createBs12ChouxDemoState('positive', number), pendingOnPlay: null }, context, move, ['bs12-032-source'])
    const done = takeAiStep(moved, playerId).state
    expect(done.pendingAfterDamageEffects).toBeUndefined()
    expect(done.players[playerId].battleArea[0].hpCards.length).toBe(moved.players[playerId].battleArea[0].hpCards.length + 1)
  })
  it.each(['ui-choice', 'ui-choice-rested'] as const)('prepared choice permits any friendly Cookie without validating a movement trigger: %s', scenario => {
    const before = createBs12ChouxDemoState(scenario, number)
    expect(before.players[playerId].breakArea[0].instanceId).toBe('bs12-032-source')
    expect(getAfterDamageEffectCandidates(before).map(entry => entry.card.instanceId)).toEqual(['bs12-032-ally', 'bs12-032-ally-other'])
    for (const id of ['bs12-032-ally', 'bs12-032-ally-other']) {
      const after = resolve(before, [id])
      expect(after.players[playerId].battleArea.find(entry => entry.card.instanceId === id)?.hpCards.length).toBe(before.players[playerId].battleArea.find(entry => entry.card.instanceId === id)!.hpCards.length + 1)
      expect(after.players[playerId].deck).toHaveLength(11)
    }
  })
  it('prepared choice skips without drawing and rejects an opponent selection', () => {
    const before = createBs12ChouxDemoState('ui-choice', number)
    expect(() => resolve(before, ['bs12-032-opponent'])).toThrow()
    const after = resolve(before, [])
    expect(after.players).toEqual(before.players)
    expect(after.pendingAfterDamageEffects).toBeUndefined()
  })
  it('prepared HP gain resumes through the ordinary Refresh command without gaining twice', () => {
    const before = createBs12ChouxDemoState('ui-choice-refresh', number)
    const gained = resolve(before, ['bs12-032-ally'])
    expect(gained.players[playerId].battleArea[0].hpCards).toHaveLength(3)
    expect(gained.pendingRefresh?.playerId).toBe(playerId)
    const after = applyGameCommand(gained, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-032-refresh-cost', shuffleSeed: 3 })
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(3)
    expect(after.players[playerId].deck).toHaveLength(6)
    expect(after.pendingRefresh).toBeNull()
    expect(after.pendingAfterDamageEffects).toBeUndefined()
  })
  it('prepared HP choice respects a real HP-gain prevention modifier', () => {
    const before = createBs12ChouxDemoState('ui-choice-prevented', number)
    const after = resolve(before, ['bs12-032-ally'])
    expect(after.players[playerId].deck).toHaveLength(12)
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(after.pendingAfterDamageEffects).toBeUndefined()
  })
  it('public trash keeps the prepared source available while a subsequent private hand move cancels it', () => {
    const publicState = createBs12ChouxDemoState('ui-choice-public-source', number)
    expect(publicState.players[playerId].breakArea).toEqual([])
    expect(getAfterDamageEffectSourceCard(publicState)?.instanceId).toBe('bs12-032-source')
    const fromBreak = createBs12ChouxDemoState('ui-choice', number)
    const privateState = executeCardEffect(fromBreak, { sourcePlayerId: playerId, sourceInstanceId: 'bs12-032-ally' }, { kind: 'break-to-hand', amount: 1 }, ['bs12-032-source'])
    expect(privateState.players[playerId].hand[0].instanceId).toBe('bs12-032-source')
    expect(privateState.pendingAfterDamageEffects).toBeUndefined()
    expect(getAfterDamageEffectSourceCard(privateState)).toBeNull()
  })
})

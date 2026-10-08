import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { createBs12DjDemoState, createBs12PuddingDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canPlayItem, isItemEffectConditionSatisfiedAfterAdditionalCost } from './card-abilities'
import { takeAiStep } from './ai'
import { maskGameStateForViewer } from './masked-state'
import { describeCommandSteps } from './command-log'
import { isOnlineGameCommand } from '../net/onlineProtocol'
import { commandFromLogEntry, replayCommands } from './replay'
import { printedFixtureCard } from './bs12-physical-fixtures.test-helpers'

const card = (number: string, instanceId: string) => {
  const result = convertOfficialCardToGameCard(candidate.cards.find(c => c.cardNumber === number) as OfficialCardRecord)
  if (result.status !== 'converted') throw new Error(`Missing ${number}`)
  return { ...result.gameCard, instanceId }
}
const setup = (withCost = true) => {
  const original = createBs12PuddingDemoState('attack')
  const dj = card('BS12-082', 'dj-source')
  const receiver = card('BS12-001', 'receiver')
  if (dj.type !== 'cookie' || receiver.type !== 'cookie') throw new Error('Missing Cookie')
  return { ...original, players: { ...original.players,
    'player-one': { ...original.players['player-one'], hand: [card('BS12-012', 'item'), ...(withCost ? [card('BS12-075', 'tax')] : [])],
      battleArea: [{ ...original.players['player-one'].battleArea[0], card: receiver, rested: true }],
      supportArea: [{ card: card('BS12-001', 'payment'), rested: false }],
    },
    'player-two': { ...original.players['player-two'], battleArea: [{ ...original.players['player-two'].battleArea[0], card: dj }, original.players['player-two'].battleArea[1]] },
  } }
}
const itemCommand = { kind: 'begin-play-item' as const, playerId: 'player-one' as const, instanceId: 'item', paymentIds: ['payment'] }

it.each([
  ['BS8-047', 'BS8-009', 'BS8-037', 1],
  ['BS9-091', 'BS9-079', 'BS9-081', 2],
] as const)('082 reserves the printed reveal cost of %s independently of its tax', (itemNumber, revealNumber, supportNumber, supportCount) => {
  const base = setup(false)
  const item = printedFixtureCard(itemNumber, 'item')
  const reveal = printedFixtureCard(revealNumber, 'reveal')
  const supportArea = Array.from({ length: supportCount }, (_, i) => ({ card: printedFixtureCard(supportNumber, `payment-${i}`), rested: false }))
  const before = { ...base, players: { ...base.players, 'player-one': { ...base.players['player-one'], hand: [item, reveal], supportArea } } }
  const command = { ...itemCommand, paymentIds: supportArea.map(s => s.card.instanceId), targetIds: ['reveal'] }
  expect(item.item?.effects[0]).toMatchObject({ kind: 'reveal-hand', asCost: true })
  expect(canPlayItem(before, 'player-one', 'item')).toBe(false)
  expect(() => applyGameCommand(before, command)).toThrow()
  const untaxed = { ...before, players: { ...before.players, 'player-two': { ...before.players['player-two'], battleArea: [] } } }
  expect(canPlayItem(untaxed, 'player-one', 'item')).toBe(true)
  const payable = { ...before, players: { ...before.players, 'player-one': { ...before.players['player-one'], hand: [...before.players['player-one'].hand, printedFixtureCard('BS12-075', 'tax')] } } }
  expect(canPlayItem(payable, 'player-one', 'item')).toBe(true)
  const pending = applyGameCommand(payable, command)
  expect(pending.pendingOpponentHandDiscard?.excludedCardIds).toContain('reveal')
  const paid = applyGameCommand(pending, { kind: 'resolve-opponent-hand-discard', playerId: 'player-one', cardIds: ['tax'] })
  expect(paid.costRecord?.revealedHandCardInstanceIds).toEqual(['reveal'])
  expect(paid.players['player-one'].hand).toContainEqual(reveal)
  expect(paid.players['player-one'].discardPile.map(c => c.instanceId)).toEqual(['tax', 'item'])
})

it('082 requires a real additional card before allowing an opponent Item', () => {
  const before = setup(false)
  expect(canPlayItem(before, 'player-one', 'item')).toBe(false)
  expect(() => applyGameCommand(before, itemCommand)).toThrow()
})

it('082 opens the extra discard choice without paying energy or executing the Item', () => {
  const before = setup()
  const pending = applyGameCommand(before, itemCommand)
  expect(pending.players).toEqual(before.players)
  expect(pending.pendingOpponentHandDiscard).toMatchObject({ playerId: 'player-one', count: 1, excludedCardIds: ['item'] })
  expect(pending.pendingAbilityEffect).toBe(before.pendingAbilityEffect)
  expect(pending.pendingAbilityEffect).toBeFalsy()
  const paid = applyGameCommand(pending, { kind: 'resolve-opponent-hand-discard', playerId: 'player-one', cardIds: ['tax'] })
  expect(paid.players['player-one'].hand).toEqual([])
  expect(paid.players['player-one'].discardPile.map(c => c.instanceId)).toEqual(['tax', 'item'])
  expect(paid.players['player-one'].supportArea[0].rested).toBe(true)
  expect(paid.pendingAbilityEffect?.sourceInstanceId).toBe('item')
})

it('082 allows cancellation before paying the additional or printed Item cost', () => {
  const before = setup()
  const pending = applyGameCommand(before, itemCommand)
  const cancelled = applyGameCommand(pending, { kind: 'cancel-item-activation', playerId: 'player-one' })
  expect(cancelled.players).toEqual(before.players)
  expect(cancelled.pendingOpponentHandDiscard).toBeNull()
  expect(cancelled.pendingAbilityEffect).toBe(before.pendingAbilityEffect)
})

const djCommand = { ...itemCommand, instanceId: 'bs12-082-item', paymentIds: ['bs12-082-payment-0'] }
const payTax = (state: ReturnType<typeof createBs12DjDemoState>, ids = ['bs12-082-tax']) =>
  applyGameCommand(state, { kind: 'resolve-opponent-hand-discard', playerId: 'player-one', cardIds: ids })

it('082 permits an Item whose hand limit becomes true after the mandatory tax and Item departure', () => {
  const before = createBs12DjDemoState('hand-threshold')
  const snapshot = structuredClone(before)
  expect(before.players['player-one'].hand).toHaveLength(4)
  expect(canPlayItem(before, 'player-one', 'bs12-082-item')).toBe(true)
  const declared = applyGameCommand(before, { ...djCommand, paymentIds: ['bs12-082-payment-0', 'bs12-082-payment-1'] })
  expect(declared.players).toEqual(before.players)
  const paid = payTax(declared)
  expect(paid.players['player-one'].hand).toHaveLength(2)
  const drawing = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
  expect(drawing.pendingDrawUpTo?.max).toBe(4)
  const result = applyGameCommand(drawing, { kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount: 4 })
  expect(result.players['player-one'].hand).toHaveLength(6)
  expect(result.players['player-one'].deck).toHaveLength(8)
  expect(result.players['player-one'].discardPile.map(card => card.instanceId)).toEqual(['bs12-082-tax', 'bs12-082-item'])
  expect(before).toEqual(snapshot)
})

it('082 still blocks a hand limit that cannot be met after the independent costs', () => {
  const before = createBs12DjDemoState('hand-above-threshold')
  expect(before.players['player-one'].hand).toHaveLength(5)
  expect(canPlayItem(before, 'player-one', 'bs12-082-item')).toBe(false)
})

it('082 post-cost hand preview includes cards returned by the printed cost and does not apply without DJ', () => {
  const before = createBs12DjDemoState('hand-threshold')
  const ability = before.players['player-one'].hand[0].item!
  expect(isItemEffectConditionSatisfiedAfterAdditionalCost(before, 'player-one', {
    ...ability, cost: { energy: { blue: 2 }, supportToHand: 1 },
  }, ability.effects[0])).toBe(false)
  const untaxed = { ...before, players: { ...before.players, 'player-two': { ...before.players['player-two'], battleArea: [] } } }
  expect(canPlayItem(untaxed, 'player-one', 'bs12-082-item')).toBe(false)
  expect(before.players['player-one'].hand).toHaveLength(4)
})

it('082 keeps the candidate fixture local and validates its cancellation protocol', () => {
  expect(parseTestStateConfig('?test-state=bs12-082:positive', 'localhost')).toEqual({ kind: 'bs12-082', scenario: 'positive' })
  expect(parseTestStateConfig('?test-state=bs12-082:positive', 'example.com')).toBeNull()
  expect(isOnlineGameCommand({ kind: 'cancel-item-activation', playerId: 'player-one' })).toBe(true)
  expect(isOnlineGameCommand({ kind: 'cancel-item-activation', playerId: 'unknown' })).toBe(false)
})

it.each(['positive', 'rested-source', 'cookie-cost', 'item-cost', 'stage-cost', 'trap-cost'] as const)('082 taxes a real Item with an arbitrary hand card and source status: %s', scenario => {
  const before = createBs12DjDemoState(scenario)
  const snapshot = structuredClone(before)
  expect(canPlayItem(before, 'player-one', djCommand.instanceId)).toBe(true)
  const pending = applyGameCommand(before, djCommand)
  expect(pending.players).toEqual(before.players)
  const paid = payTax(pending)
  expect(paid.players['player-one'].hand).toEqual([])
  expect(paid.players['player-one'].discardPile.map(c => c.instanceId)).toEqual(['bs12-082-tax', 'bs12-082-item'])
  expect(paid.players['player-one'].supportArea[0].rested).toBe(true)
  expect(paid.players['player-two']).toEqual(before.players['player-two'])
  expect(paid.players['player-one'].battleArea).toEqual(before.players['player-one'].battleArea)
  const result = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: ['bs12-082-receiver'] })
  expect(result.players['player-one'].battleArea[0].rested).toBe(false)
  expect(result.players['player-one'].battleArea[0].hpCards).toHaveLength(4)
  expect(before).toEqual(snapshot)
})

it.each(['source-hand', 'source-support', 'source-discard', 'source-break', 'own-source'] as const)('082 does not tax an Item when the opposing source is outside battle: %s', scenario => {
  const before = createBs12DjDemoState(scenario)
  const result = applyGameCommand(before, djCommand)
  expect(result.pendingOpponentHandDiscard).toBeFalsy()
  expect(result.players['player-one'].hand.map(c => c.instanceId)).toEqual(['bs12-082-tax'])
  expect(result.players['player-one'].discardPile.map(c => c.instanceId)).toEqual(['bs12-082-item'])
  expect(result.players['player-one'].supportArea[0].rested).toBe(true)
})

it.each(['no-hand', 'wrong-energy', 'rested-energy', 'no-energy', 'missing-original-cost', 'multiple-source', 'opponent-turn', 'outside-main'] as const)('082 rejects an illegal declaration without paying resources: %s', scenario => {
  const before = createBs12DjDemoState(scenario)
  const snapshot = structuredClone(before)
  expect(canPlayItem(before, 'player-one', djCommand.instanceId)).toBe(false)
  expect(() => applyGameCommand(before, djCommand)).toThrow()
  expect(before).toEqual(snapshot)
})

it.each([[], ['unknown'], ['bs12-082-item'], ['bs12-082-tax', 'bs12-082-tax'], ['bs12-082-tax', 'bs12-082-tax-two']].map(ids => ({ ids })))('082 rejects invalid additional cost selection $ids', ({ ids }) => {
  const pending = applyGameCommand(createBs12DjDemoState('twice'), djCommand)
  const snapshot = structuredClone(pending)
  expect(() => payTax(pending, ids)).toThrow()
  expect(pending).toEqual(snapshot)
})

it('082 requires the printed Arena-to-break cost and an independent arbitrary discard', () => {
  const before = createBs12DjDemoState('original-cost')
  const pending = applyGameCommand(before, { ...djCommand, handToBreakAreaIds: ['bs12-082-original-cost'] })
  expect(pending.players).toEqual(before.players)
  expect(pending.pendingOpponentHandDiscard?.excludedCardIds).toEqual(['bs12-082-item', 'bs12-082-original-cost'])
  expect(() => payTax(pending, ['bs12-082-original-cost'])).toThrow()
  const paid = payTax(pending)
  expect(paid.players['player-one'].breakArea.map(c => c.instanceId)).toEqual(['bs12-082-original-cost'])
  expect(paid.players['player-one'].discardPile.map(c => c.instanceId)).toEqual(['bs12-082-tax', 'bs12-082-item'])
  const drawing = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
  expect(drawing.pendingDrawUpTo?.max).toBe(3)
  const drawn = applyGameCommand(drawing, { kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount: 2 })
  expect(drawn.players['player-one'].hand).toHaveLength(2)
  expect(drawn.players['player-one'].deck).toHaveLength(10)
})

it('082 records declaration as unpaid, then records actual additional and printed costs', () => {
  const before = createBs12DjDemoState()
  const pending = applyGameCommand(before, djCommand)
  expect(pending.commandLog?.at(-1)?.summary).toContain('尚未支付費用')
  expect(describeCommandSteps(before, pending, djCommand)).toEqual([{ text: '道具宣告：等待選擇額外棄牌，能量與原本代價尚未支付。' }])
  const paid = payTax(pending)
  expect(paid.commandLog?.at(-1)?.summary).toContain('支付「DJ Cookie」要求的額外棄牌代價')
  const text = paid.commandLog?.at(-1)?.steps?.map(step => step.text).join('\n')
  expect(text).toContain('道具額外代價：棄置手牌')
  expect(text).toContain('支付能量（橫置）')
})

it.each(['cancel', 'pay'] as const)('082 replays the public command sequence with its original unpaid Item continuation: %s', action => {
  const before = createBs12DjDemoState()
  const pending = applyGameCommand(before, djCommand)
  const result = action === 'pay' ? payTax(pending)
    : applyGameCommand(pending, { kind: 'cancel-item-activation', playerId: 'player-one' })
  const commands = result.commandLog!.map(commandFromLogEntry)
  expect(commands.every(command => command !== null)).toBe(true)
  const replayed = replayCommands(before, commands.filter(command => command !== null))
  expect(replayed.players).toEqual(result.players)
  expect(replayed.pendingAbilityEffect).toEqual(result.pendingAbilityEffect)
  expect(replayed.pendingOpponentHandDiscard).toEqual(result.pendingOpponentHandDiscard)
})

it('082 preserves the decision owner and hides reserved hand costs from the opponent snapshot', () => {
  const pending = applyGameCommand(createBs12DjDemoState(), djCommand)
  expect(() => applyGameCommand(pending, { kind: 'cancel-item-activation', playerId: 'player-two' })).toThrow()
  expect(() => applyGameCommand(pending, { kind: 'resolve-opponent-hand-discard', playerId: 'player-two', cardIds: ['bs12-082-tax'] })).toThrow()
  expect(maskGameStateForViewer(pending, 'player-one').pendingOpponentHandDiscard?.itemActivation).toEqual(pending.pendingOpponentHandDiscard?.itemActivation)
  expect(maskGameStateForViewer(pending, 'player-two').pendingOpponentHandDiscard?.itemActivation).toBeUndefined()
  expect(maskGameStateForViewer(pending, 'player-two').pendingOpponentHandDiscard?.excludedCardIds).toEqual([])
  expect(() => applyGameCommand(createBs12DjDemoState(), { kind: 'cancel-item-activation', playerId: 'player-one' })).toThrow()
})

it('082 keeps a printed restricted discard independent of the unrestricted additional card', () => {
  const before = setup()
  const item = before.players['player-one'].hand[0]
  if (!item.item) throw new Error('Missing Item')
  item.item = { ...item.item, cost: { energy: { red: 1 }, discardHand: 1, discardHandColor: 'red' } }
  before.players['player-one'].hand.push(card('BS12-001', 'red-cost'))
  const pending = applyGameCommand(before, { ...itemCommand, discardHandIds: ['red-cost'] })
  expect(pending.pendingOpponentHandDiscard?.excludedCardIds).toEqual(['item', 'red-cost'])
  expect(() => applyGameCommand(pending, { kind: 'resolve-opponent-hand-discard', playerId: 'player-one', cardIds: ['red-cost'] })).toThrow()
  const paid = applyGameCommand(pending, { kind: 'resolve-opponent-hand-discard', playerId: 'player-one', cardIds: ['tax'] })
  expect(paid.players['player-one'].discardPile.map(c => c.instanceId)).toEqual(['tax', 'red-cost', 'item'])
})

it('082 does not add an Item tax to a Stage placement or a Cookie Activate skill', () => {
  const stageState = setup(false)
  stageState.players['player-one'].hand = [card('BS12-030', 'stage')]
  stageState.players['player-one'].supportArea = [{ card: card('BS12-025', 'yellow'), rested: false }]
  const placed = applyGameCommand(stageState, { kind: 'play-stage', playerId: 'player-one', instanceId: 'stage', paymentIds: ['yellow'] })
  expect(placed.pendingOpponentHandDiscard).toBeFalsy()
  expect(placed.players['player-one'].stage?.card.instanceId).toBe('stage')
  const source = card('BS12-016', 'cookie-skill')
  if (source.type !== 'cookie') throw new Error('Missing Cookie')
  const cookieState = setup(false)
  cookieState.players['player-one'].hand = []
  cookieState.players['player-one'].battleArea.push({ ...cookieState.players['player-one'].battleArea[0], card: source, rested: false })
  const activated = applyGameCommand(cookieState, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: source.instanceId, trigger: 'activate', paymentIds: [] })
  expect(activated.pendingOpponentHandDiscard).toBeFalsy()
  expect(activated.pendingAbilityEffect?.sourceInstanceId).toBe(source.instanceId)
})

it('082 evaluated AI declares the Item with a separate unpaid additional-cost choice', () => {
  const before = createBs12DjDemoState()
  const declared = takeAiStep(before, 'player-one', { level: 5, seed: 7 })
  expect(declared.action).toBe('play-item')
  expect(declared.state.pendingOpponentHandDiscard?.itemActivation?.instanceId).toBe('bs12-082-item')
  expect(declared.state.players).toEqual(before.players)
})

it('082 pays an independent additional card on each successive Item in the same turn', () => {
  const before = createBs12DjDemoState('twice')
  let state = payTax(applyGameCommand(before, djCommand))
  state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
  state = applyGameCommand(state, { ...djCommand, instanceId: 'bs12-082-item-two', paymentIds: ['bs12-082-payment-1'] })
  const paid = payTax(state, ['bs12-082-tax-two'])
  expect(paid.players['player-one'].hand).toEqual([])
  expect(paid.players['player-one'].discardPile.map(c => c.instanceId)).toEqual(['bs12-082-tax', 'bs12-082-item', 'bs12-082-tax-two', 'bs12-082-item-two'])
  expect(paid.players['player-one'].supportArea.every(s => s.rested)).toBe(true)
  expect(paid.itemsActivatedThisTurn?.['player-one']).toBe(2)
})

it('082 deploys with two HP and attacks for ordinary two using PP without taxing its attack', () => {
  const deployed = applyGameCommand(createBs12DjDemoState('deploy'), { kind: 'deploy-cookie', playerId: 'player-one', instanceId: 'bs12-082-source' })
  expect(deployed.players['player-one'].battleArea.map(c => c.hpCards.length)).toEqual([4, 2])
  expect(deployed.players['player-one'].deck).toHaveLength(10)
  expect(deployed.pendingOnPlay).toBeNull()
  let state = applyGameCommand(createBs12DjDemoState('attack'), { kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: 'bs12-082-source', targetInstanceId: 'bs12-082-opponent', supportPaymentIds: ['bs12-082-payment-0', 'bs12-082-payment-1'] })
  expect(state.pendingOpponentHandDiscard).toBeFalsy()
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
  for (let step = 0; state.pendingBattle?.stage === 'damage' && step < 10; step++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
  expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
  expect(state.players['player-one'].battleArea[0].rested).toBe(true)
  expect(state.players['player-one'].supportArea.every(s => s.rested)).toBe(true)
  expect(state.pendingBattle).toBeNull()
})

it.each([1, 3, 5] as const)('082 AI pays the separate additional cost and resolves the Item at level %s', level => {
  const declared = applyGameCommand(createBs12DjDemoState(), djCommand)
  const paid = takeAiStep(declared, 'player-one', { level, seed: 7 })
  expect(paid.state.pendingOpponentHandDiscard).toBeNull()
  expect(paid.state.players['player-one'].hand).toEqual([])
  expect(paid.state.players['player-one'].discardPile.map(c => c.instanceId)).toEqual(['bs12-082-tax', 'bs12-082-item'])
  const resolved = takeAiStep(paid.state, 'player-one', { level, seed: 7 })
  expect(resolved.state.players['player-one'].battleArea[0].rested).toBe(false)
})

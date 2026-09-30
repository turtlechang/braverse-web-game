import { describe, expect, it } from 'vitest'
import bs10 from '../../data/cards/official-paradise-of-passion-and-sloth-catacombs-of-silence-bs10.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { getCardPoolEntry } from './card-pool'
import { describeCommandSteps } from './command-log'
import { createBattleState, item } from './test-helpers/battle-helpers'
import type { CookieInBattle, GameCard, GameState } from './types'

const records = bs10.cards as unknown as OfficialCardRecord[]

const official = (id: string, suffix: string): GameCard => {
  const record = records.find((card) => card.cardNumber === id)
  if (!record) throw new Error(`Missing candidate ${id}`)
  const result = convertOfficialCardToGameCard(record, `bs10-runtime-${suffix}`)
  if (result.status !== 'converted') throw new Error(`${id}: ${result.reason}`)
  return { ...result.gameCard, instanceId: `${id}:${suffix}` }
}

const formal = (id: string, suffix: string): GameCard => {
  if (id.startsWith('BS10-')) return official(id, suffix)
  const record = getCardPoolEntry(id)
  if (!record) throw new Error(`Missing formal card ${id}`)
  const result = convertOfficialCardToGameCard(record, `bs10-runtime-${suffix}`)
  if (result.status !== 'converted') throw new Error(`${id}: ${result.reason}`)
  return { ...result.gameCard, instanceId: `${id}:${suffix}` }
}

const hp = (id: string) => item(id, 'red')

const entry = (card: GameCard, hpCards: GameCard[], battleEntryId = `${card.instanceId}:battle`): CookieInBattle => ({
  card: card as CookieInBattle['card'], hpCards, rested: false, battleEntryId,
})

const baseState = (one: CookieInBattle[], two: CookieInBattle[], oneSupport = 0, twoSupport = 0): GameState => {
  const base = createBattleState()
  return {
    ...base,
    activePlayerId: 'player-two',
    phase: 'main',
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        battleArea: one,
        hand: [],
        deck: [hp('p1-deck-1'), hp('p1-deck-2'), hp('p1-deck-3')],
        supportArea: Array.from({ length: oneSupport }, (_, i) => ({ card: item(`p1-support-${i}`, 'red'), rested: false })),
        discardPile: [],
      },
      'player-two': {
        ...base.players['player-two'],
        battleArea: two,
        hand: [item('p2-hand-1', 'red'), item('p2-hand-2', 'red')],
        deck: [hp('p2-deck-1'), hp('p2-deck-2'), hp('p2-deck-3')],
        supportArea: Array.from({ length: twoSupport }, (_, i) => ({ card: item(`p2-support-${i}`, 'red'), rested: false })),
        discardPile: [],
      },
    },
  }
}

const settleFaintReplacement = (state: GameState, playerId: 'player-one' | 'player-two'): GameState =>
  state.pendingReplacement
    ? applyGameCommand(state, { kind: 'skip-replacement', playerId })
    : state

const settleDamage = (state: GameState, playerId: 'player-one' | 'player-two'): GameState => {
  let next = settleFaintReplacement(state, playerId)
  for (let i = 0; i < 8 && next.pendingBattle && next.pendingBattle.stage === 'damage'; i += 1) {
    next = applyGameCommand(next, { kind: 'resolve-next-damage', playerId })
    next = settleFaintReplacement(next, playerId)
  }
  return next
}

describe('BS10 second batch runtime through applyGameCommand', () => {
  it.each([0, 1] as const)('BS10-006 resolves a real attack faint, then selects %s opponent target and pays 2R once', (selection) => {
    const attacker = official('BS10-006', 'attacker')
    const defender = official('BS10-010', 'defender')
    const extra = official('BS10-010', 'extra')
    let state = baseState(
      [entry(defender, [hp('defender-hp')]), entry(extra, [hp('extra-hp'), hp('extra-hp-2')])],
      [entry(attacker, [hp('attacker-hp')])],
      0,
      4,
    )
    state = applyGameCommand(state, {
      kind: 'declare-attack', playerId: 'player-two',
      attackerInstanceId: attacker.instanceId, targetInstanceId: defender.instanceId,
      supportPaymentIds: state.players['player-two'].supportArea.slice(0, 2).map((x) => x.card.instanceId),
    })
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-one' })
    state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-one' })
    state = settleDamage(state, 'player-one')
    expect(state.pendingBattle?.stage).toBe('attack-effect')
    expect(state.players['player-two'].supportArea.filter((support) => support.rested)).toHaveLength(2)
    expect(state.players['player-two'].supportArea.filter((support) => !support.rested)).toHaveLength(2)
    const before = state.players['player-one'].battleArea[0].hpCards.length
    if (selection === 1) {
      expect(() => applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: 'player-two', targetIds: [attacker.instanceId] })).toThrow()
    }
    const skipped = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: 'player-two', targetIds: selection ? [extra.instanceId] : [] })
    expect(skipped.players['player-one'].battleArea[0].hpCards).toHaveLength(before - selection)
    expect(skipped.players['player-one'].battleArea).toHaveLength(1)
    expect(skipped.pendingBattle).toBeNull()
  })

  it('BS10-006 condition-false and wrong-side target are blocked without an extra effect', () => {
    const attacker = official('BS10-006', 'attacker-negative')
    const defender = official('BS10-010', 'defender-negative')
    let state = baseState([entry(defender, [hp('defender-hp-negative'), hp('defender-hp-negative-2'), hp('defender-hp-negative-3')])], [entry(attacker, [hp('attacker-hp-negative')])], 0, 2)
    state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-two', attackerInstanceId: attacker.instanceId, targetInstanceId: defender.instanceId, supportPaymentIds: state.players['player-two'].supportArea.map((x) => x.card.instanceId) })
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-one' })
    state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-one' })
    state = settleDamage(state, 'player-one')
    expect(state.pendingBattle?.stage).toBe('attack-effect')
    const previous = state
    state = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: 'player-two', targetIds: [defender.instanceId] })
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
    expect(describeCommandSteps(previous, state, { kind: 'resolve-attack-effect', playerId: 'player-two', targetIds: [defender.instanceId] })?.map((step) => step.text)).toContain('攻擊後效果結果：條件不成立，效果未執行')
  })

  it('BS10-007 draws 0 or 1 only after a real opponent faint and enforces once per turn', () => {
    const attacker = official('BS10-010', 'vanilla-attacker')
    const skill = official('BS10-007', 'skill-source')
    const defender = official('BS10-010', 'vanilla-defender')
    const survivor = official('BS10-010', 'survivor-007')
    let state = baseState([entry(defender, [hp('defender-hp-007')]), entry(survivor, [hp('survivor-hp-007'), hp('survivor-hp-007-2')])], [entry(attacker, [hp('attacker-hp-007')]), entry(skill, [hp('skill-hp-007')])], 0, 4)
    const beforeAttack = structuredClone(state)
    expect(() => applyGameCommand(beforeAttack, { kind: 'begin-activate-skill', playerId: 'player-two', sourceInstanceId: skill.instanceId, trigger: 'activate', paymentIds: [] })).toThrow()
    state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-two', attackerInstanceId: attacker.instanceId, targetInstanceId: defender.instanceId, supportPaymentIds: state.players['player-two'].supportArea.slice(0, 2).map((x) => x.card.instanceId) })
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-one' })
    state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-one' })
    state = settleDamage(state, 'player-one')
    const beforeSkill = state
    state = applyGameCommand(state, { kind: 'begin-activate-skill', playerId: 'player-two', sourceInstanceId: skill.instanceId, trigger: 'activate', paymentIds: [] })
    state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-two', targetIds: [] })
    expect(state.pendingDrawUpTo?.max).toBe(1)
    const handBefore = state.players['player-two'].hand.length
    state = applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId: 'player-two', drawCount: 0 })
    expect(state.players['player-two'].hand).toHaveLength(handBefore)
    expect(() => applyGameCommand(state, { kind: 'begin-activate-skill', playerId: 'player-two', sourceInstanceId: skill.instanceId, trigger: 'activate', paymentIds: [] })).toThrow()
    let drawOne = applyGameCommand(beforeSkill, { kind: 'begin-activate-skill', playerId: 'player-two', sourceInstanceId: skill.instanceId, trigger: 'activate', paymentIds: [] })
    drawOne = applyGameCommand(drawOne, { kind: 'resolve-ability-effect', playerId: 'player-two', targetIds: [] })
    const deckBefore = drawOne.players['player-two'].deck.length
    const handBeforeDraw = [...drawOne.players['player-two'].hand]
    const topDeck = drawOne.players['player-two'].deck[0]
    drawOne = applyGameCommand(drawOne, { kind: 'resolve-draw-up-to', playerId: 'player-two', drawCount: 1 })
    expect(drawOne.players['player-two'].deck).toHaveLength(deckBefore - 1)
    expect(drawOne.players['player-two'].hand).toEqual([...handBeforeDraw, topDeck])
  })

  it.each([true, false])('BS10-008 real HP reveal can activate (discard 1) or decline: %s', (activate) => {
    const attacker = formal('BS9-003@1', `008-attacker-${activate}`)
    const flip = official('BS10-008', `008-flip-${activate}`)
    const defender = official('BS10-010', `008-defender-${activate}`)
    let state = baseState([entry(defender, [flip]), entry(formal('BS10-010', `008-survivor-${activate}`), [hp(`008-survivor-hp-${activate}`)])], [entry(attacker, [hp(`008-attacker-hp-${activate}`)])], 0, 2)
    state = { ...state, players: { ...state.players, 'player-one': { ...state.players['player-one'], hand: [item(`008-discard-${activate}`, 'red')], deck: [hp(`008-rescue-hp-${activate}`), hp(`008-rescue-bottom-${activate}`)] } } }
    state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-two', attackerInstanceId: attacker.instanceId, targetInstanceId: defender.instanceId, supportPaymentIds: state.players['player-two'].supportArea.map((x) => x.card.instanceId) })
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-one' })
    state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-one' })
    expect(state.pendingBattle?.stage).toBe('flip')
    const beforeHand = state.players['player-one'].hand.length
    state = applyGameCommand(state, { kind: 'resolve-flip', playerId: 'player-one', activate, discardHandIds: activate ? [state.players['player-one'].hand[0].instanceId] : [] })
    expect(state.players['player-one'].hand.length).toBe(activate ? beforeHand - 1 : beforeHand)
    const restored = state.players['player-one'].battleArea.find((x) => x.card.instanceId === defender.instanceId)
    if (activate) {
      expect(restored?.hpCards.map((card) => card.instanceId)).toEqual([`008-rescue-hp-${activate}`])
      expect(state.players['player-one'].discardPile.map((card) => card.instanceId)).toEqual(expect.arrayContaining([flip.instanceId, `008-discard-${activate}`]))
    } else {
      expect(restored).toBeUndefined()
    }
    expect(state.players['player-one'].battleArea.find((x) => x.card.instanceId.includes(`008-survivor-${activate}`))?.hpCards).toHaveLength(1)
    expect(state.pendingBattle).toBeNull()
  })

  it('BS10-009 pays a real LV2+ HP cost, reduces only its own attack by 1R, and rejects LV1 or wrong target', () => {
    const source = official('BS10-009', '009-source')
    const ally = formal('BS6-047', '009-ally')
    const opponent = official('BS10-010', '009-opponent')
    const allyTopHp = official('BS10-008', '009-ally-top-flip')
    let state = baseState([entry(source, [hp('009-source-hp-a'), hp('009-source-hp-b')]), entry(ally, [hp('009-ally-hp-bottom'), allyTopHp])], [entry(opponent, [hp('009-opponent-hp-a'), hp('009-opponent-hp-b'), hp('009-opponent-hp-c')])], 1, 0)
    state = { ...state, activePlayerId: 'player-one' }
    const initial = structuredClone(state)
    expect(() => applyGameCommand(initial, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: source.instanceId, trigger: 'activate', paymentIds: [], hpToTrashTargetIds: [opponent.instanceId] })).toThrow()
    expect(initial).toEqual(structuredClone(state))
    const lv1 = formal('BS5-001', '009-lv1')
    const lv1State = { ...state, players: { ...state.players, 'player-one': { ...state.players['player-one'], battleArea: [entry(source, [hp('009-source-hp-a'), hp('009-source-hp-b')]), entry(lv1, [hp('009-lv1-hp')])] } } }
    expect(lv1State.players['player-one'].battleArea).toHaveLength(2)
    expect(lv1State.players['player-one'].battleArea.map((battleEntry) => battleEntry.card.instanceId)).toEqual([source.instanceId, lv1.instanceId])
    const lv1Snapshot = structuredClone(lv1State)
    expect(() => applyGameCommand(lv1State, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: source.instanceId, trigger: 'activate', paymentIds: [], hpToTrashTargetIds: [lv1.instanceId] })).toThrow()
    expect(lv1State).toEqual(lv1Snapshot)
    state = applyGameCommand(state, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: source.instanceId, trigger: 'activate', paymentIds: [], hpToTrashTargetIds: [ally.instanceId] })
    expect(state.players['player-one'].battleArea.find((x) => x.card.instanceId === ally.instanceId)?.hpCards).toHaveLength(1)
    expect(state.players['player-one'].discardPile.map((card) => card.instanceId)).toContain(allyTopHp.instanceId)
    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-one'].discardPile).toHaveLength(1)
    state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [source.instanceId] })
    const oneRed = state.players['player-one'].supportArea[0].card.instanceId
    const attacked = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: source.instanceId, targetInstanceId: opponent.instanceId, supportPaymentIds: [oneRed] })
    expect(attacked.pendingBattle?.attackerInstanceId).toBe(source.instanceId)
    let finished = applyGameCommand(attacked, { kind: 'skip-trap', playerId: 'player-two' })
    while (finished.pendingBattle?.stage === 'damage') finished = applyGameCommand(finished, { kind: 'resolve-next-damage', playerId: 'player-two' })
    expect(finished.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
  })

  it('BS10-010 requires exactly two active Mix energy cards and deals 3 damage', () => {
    const attacker = official('BS10-010', '010-attacker')
    const defender = formal('BS6-079', '010-defender')
    if (defender.type !== 'cookie') throw new Error('BS10-010 fixture requires a Cookie defender')
    const defenderHp = [
      hp('010-defender-hp-1'),
      hp('010-defender-hp-2'),
      hp('010-defender-hp-3'),
      hp('010-defender-hp-4'),
      hp('010-defender-hp-5'),
    ]
    expect(defender.hp).toBe(5)
    expect(defenderHp).toHaveLength(5)
    const state = baseState([entry(defender, defenderHp)], [entry(attacker, [hp('010-attacker-hp')])], 0, 2)
    expect(state.players['player-one'].battleArea).toHaveLength(1)
    state.players['player-two'].supportArea = [
      { card: formal('BS6-002', '010-red-support'), rested: false },
      { card: formal('BS6-047', '010-green-support'), rested: false },
    ]
    const payment = state.players['player-two'].supportArea.map((x) => x.card.instanceId)
    const attacked = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-two', attackerInstanceId: attacker.instanceId, targetInstanceId: defender.instanceId, supportPaymentIds: payment })
    expect(attacked.pendingBattle?.remainingDamage).toBe(3)
    let finished = applyGameCommand(attacked, { kind: 'skip-trap', playerId: 'player-one' })
    while (finished.pendingBattle?.stage === 'damage') finished = applyGameCommand(finished, { kind: 'resolve-next-damage', playerId: 'player-one' })
    expect(finished.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
    const rested = { ...state, players: { ...state.players, 'player-two': { ...state.players['player-two'], supportArea: state.players['player-two'].supportArea.map((support, index) => index === 1 ? { ...support, rested: true } : support) } } }
    expect(() => applyGameCommand(rested, { kind: 'declare-attack', playerId: 'player-two', attackerInstanceId: attacker.instanceId, targetInstanceId: defender.instanceId, supportPaymentIds: rested.players['player-two'].supportArea.map((support) => support.card.instanceId) })).toThrow()
  })
})

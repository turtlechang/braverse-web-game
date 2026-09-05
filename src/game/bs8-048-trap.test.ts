import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { getCardPoolEntry } from './card-pool'
import { applyGameCommand } from './commands'
import { getTrapCandidates } from './battle'
import { createBattleState } from './test-helpers/battle-helpers'
import type { GameCard, GameState } from './types'

const official = (id: string, suffix: string): GameCard => {
  const entry = getCardPoolEntry(id)
  if (!entry) throw new Error(`Missing ${id}`)
  const result = convertOfficialCardToGameCard(entry)
  if (result.status !== 'converted') throw new Error(`Unconverted ${id}`)
  return { ...result.gameCard, instanceId: `${id}:${suffix}` }
}
const cookie = (id: string, suffix: string) => {
  const card = official(id, suffix)
  if (card.type !== 'cookie') throw new Error(`Expected Cookie ${id}`)
  return card
}
const setup = (level: 2 | 3 = 3) => {
  const base = createBattleState()
  const trap = official('BS8-048', 'trap')
  const destruction = official('BS8-021', 'destruction')
  const abundance = official('BS3-043', 'abundance')
  const wrongName = official('BS8-046', 'wrong-name')
  const attacker = cookie('BS8-036', 'attacker')
  const defender = cookie('BS8-034', 'defender')
  const support = official('BS8-037', 'trap-payment')
  const attackSupport = official('BS8-037', 'attack-payment')
  const state: GameState = { ...base, players: { ...base.players,
    'player-one': { ...base.players['player-one'], hand: [trap],
      battleArea: [{ card: defender, hpCards: Array.from({ length: defender.hp }, (_, index) => official('BS8-046', `defender-hp-${index}`)), rested: false }],
      supportArea: [{ card: support, rested: false }], discardPile: [destruction, abundance, wrongName],
      breakArea: [cookie(level === 3 ? 'BS8-039' : 'BS8-034', 'break-condition')],
    },
    'player-two': { ...base.players['player-two'], battleArea: [{ card: attacker, hpCards: [official('BS8-046', 'attacker-hp')], rested: false }], supportArea: [{ card: attackSupport, rested: false }] },
  } }
  const declared = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-two', attackerInstanceId: attacker.instanceId, targetInstanceId: defender.instanceId, supportPaymentIds: [attackSupport.instanceId] })
  expect(declared.pendingBattle).toMatchObject({ stage: 'trap', declaredDamage: 1 })
  const command = { kind: 'play-trap' as const, playerId: 'player-one' as const, trapInstanceId: trap.instanceId, paymentIds: [support.instanceId], targetIds: [] as string[] }
  return { state, declared, trap, destruction, abundance, wrongName, defender, command }
}
const finish = (state: GameState) => {
  const unblocked = state.pendingBattle?.stage === 'trap'
    ? applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-one' })
    : state
  const result = applyGameCommand(unblocked, { kind: 'resolve-next-damage', playerId: 'player-one' })
  expect(result.pendingBattle).toBeFalsy()
  return result
}

describe('BS8-048 Kulfi Legends named Soul Jam recovery', () => {
  it.each(['destruction', 'abundance', 'zero'] as const)('uses the staged UI command path for %s and resumes battle with a truthful public recovery log', (selection) => {
    const { state, declared, trap, destruction, abundance, defender, command } = setup()
    const paid = applyGameCommand(declared, command)
    expect(paid.pendingAbilityEffect).toMatchObject({
      sourceKind: 'trap', sourceInstanceId: trap.instanceId, effectIndex: 0,
      playerId: 'player-one', battleContinuation: 'after-trap',
    })
    expect(paid.players['player-one'].supportArea[0].rested).toBe(true)
    expect(paid.players['player-one'].hand).toEqual([])
    expect(paid.players['player-one'].discardPile).toEqual([...state.players['player-one'].discardPile, trap])
    expect(paid.players['player-one'].battleArea).toEqual(state.players['player-one'].battleArea)
    expect(() => applyGameCommand(paid, { kind: 'resolve-next-damage', playerId: 'player-one' })).toThrow()

    const selected = selection === 'zero' ? [] : [selection === 'destruction' ? destruction : abundance]
    const recovered = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: selected.map((card) => card.instanceId) })
    expect(recovered.pendingAbilityEffect).toBeFalsy()
    expect(recovered.players['player-one'].hand).toEqual(selected)
    expect(recovered.players['player-one'].discardPile).toEqual([...state.players['player-one'].discardPile.filter((card) => !selected.includes(card)), trap])
    const log = recovered.commandLog?.at(-1)
    expect(log?.commandKind).toBe('resolve-ability-effect')
    const text = log?.steps?.map((step) => step.text).join('\n') ?? ''
    if (selected.length > 0) {
      expect(text).toContain(`回收結果：${selected[0].name} 從棄牌區返回手牌。`)
      expect(log?.steps?.flatMap((step) => step.cards ?? [])).toContainEqual(expect.objectContaining({ instanceId: selected[0].instanceId }))
    } else {
      expect(text).toContain('選擇 0')
      expect(text).not.toContain('回收結果：')
    }
    const finished = finish(recovered)
    expect(finished.pendingAbilityEffect).toBeFalsy()
    expect(finished.players['player-one'].battleArea[0].hpCards).toHaveLength(defender.hp - 1)
    expect(finished.players['player-one'].hand).toEqual(selected)
  })

  it.each(['destruction', 'abundance', 'zero'] as const)('at own Break LV3 pays Y1 and recovers %s before normal attack damage', (selection) => {
    const { state, declared, trap, destruction, abundance, defender, command } = setup(3)
    expect(destruction).toMatchObject({ id: 'BS8-021', name: 'Soul Jam: Light of Destruction' })
    expect(abundance).toMatchObject({ id: 'BS3-043', name: 'Soul Jam: Light of Abundance' })
    expect(trap.trap).toMatchObject({ cost: { energy: { yellow: 1 } }, condition: { kind: 'break-level-at-least', level: 3 }, effects: [{ kind: 'trash-to-hand', max: 1, cardNames: ['Soul Jam: Light of Destruction', 'Soul Jam: Light of Abundance'] }] })
    expect(getTrapCandidates(declared, 'player-one')).toContainEqual(trap)
    const selected = selection === 'zero' ? [] : [selection === 'destruction' ? destruction : abundance]
    const result = applyGameCommand(declared, { ...command, targetIds: selected.map((card) => card.instanceId), effectTargets: [selected.map((card) => card.instanceId)] })
    expect(result.players['player-one'].hand).toEqual(selected)
    expect(result.players['player-one'].discardPile).toEqual([...state.players['player-one'].discardPile.filter((card) => !selected.includes(card)), trap])
    expect(result.players['player-one'].supportArea[0].rested).toBe(true)
    expect(result.players['player-one'].battleArea).toEqual(state.players['player-one'].battleArea)
    const finished = finish(result)
    expect(finished.players['player-one'].battleArea[0].hpCards).toHaveLength(defender.hp - 1)
    expect(finished.players['player-one'].hand).toEqual(selected)
  })

  it('at own Break LV2 is unavailable even with an eligible trash card and opponent Break LV3', () => {
    const { declared, trap, destruction, command } = setup(2)
    const state: GameState = { ...declared, players: { ...declared.players, 'player-two': { ...declared.players['player-two'], breakArea: [cookie('BS8-039', 'opponent-break-three')] } } }
    expect(getTrapCandidates(state, 'player-one')).not.toContainEqual(trap)
    expect(() => applyGameCommand(state, { ...command, targetIds: [destruction.instanceId] })).toThrow()
    expect(state.players['player-one'].supportArea[0].rested).toBe(false)
    expect(state.players['player-one'].hand).toContainEqual(trap)
    finish(state)
  })

  it('can select zero when the trash contains neither named Soul Jam', () => {
    const { declared, trap, wrongName, command } = setup()
    const state: GameState = { ...declared, players: { ...declared.players, 'player-one': { ...declared.players['player-one'], discardPile: [wrongName] } } }
    expect(getTrapCandidates(state, 'player-one')).toContainEqual(trap)
    const result = applyGameCommand(state, { ...command, effectTargets: [[]] })
    expect(result.players['player-one'].hand).toEqual([])
    expect(result.players['player-one'].discardPile).toEqual([wrongName, trap])
    expect(result.players['player-one'].supportArea[0].rested).toBe(true)
    finish(result)
  })

  it.each(['wrong-name', 'hand', 'opponent-trash', 'duplicate', 'two-cards'] as const)('rejects %s recovery without paying or using the Trap', (selection) => {
    const { declared, destruction, abundance, wrongName, command } = setup()
    const elsewhere = official('BS8-021', 'elsewhere')
    const state: GameState = { ...declared, players: { ...declared.players,
      'player-one': { ...declared.players['player-one'], hand: [...declared.players['player-one'].hand, elsewhere] },
      'player-two': { ...declared.players['player-two'], discardPile: [official('BS3-043', 'opponent-trash')] },
    } }
    const ids = { 'wrong-name': [wrongName.instanceId], hand: [elsewhere.instanceId], 'opponent-trash': ['BS3-043:opponent-trash'], duplicate: [destruction.instanceId, destruction.instanceId], 'two-cards': [destruction.instanceId, abundance.instanceId] }[selection]
    const snapshot = structuredClone(state)
    expect(() => applyGameCommand(state, { ...command, targetIds: ids, effectTargets: [ids] })).toThrow()
    expect(state).toEqual(snapshot)
  })

  it.each(['missing', 'red', 'rested'] as const)('rejects %s energy despite meeting Break LV3 and choosing zero', (payment) => {
    const { declared, command } = setup()
    const support = official(payment === 'red' ? 'BS8-009' : 'BS8-037', 'invalid-payment')
    const state: GameState = { ...declared, players: { ...declared.players, 'player-one': { ...declared.players['player-one'], supportArea: payment === 'missing' ? [] : [{ card: support, rested: payment === 'rested' }] } } }
    expect(getTrapCandidates(state, 'player-one')).toEqual([])
    expect(() => applyGameCommand(state, { ...command, paymentIds: payment === 'missing' ? [] : [support.instanceId], effectTargets: [[]] })).toThrow()
  })
})

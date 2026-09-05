import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { getCardPoolEntry } from './card-pool'
import { applyGameCommand } from './commands'
import { createBattleState } from './test-helpers/battle-helpers'
import type { CookieCard, GameCard, GameState } from './types'

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
const inBattle = (card: CookieCard) => ({ card, rested: false,
  hpCards: Array.from({ length: card.hp }, (_, index) => official('BS8-046', `${card.instanceId}-hp-${index}`)),
})
const physicalIds = (state: GameState) => [
  ...Object.values(state.players).flatMap((player) => [
    ...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile,
    ...player.supportArea.map((entry) => entry.card),
    ...player.battleArea.flatMap((entry) => [entry.card, ...entry.hpCards, ...(entry.equippedCards ?? []), ...(entry.awakenedUnderlay ?? [])]),
    ...(player.stage ? [player.stage.card] : []), ...(player.extraDeck ?? []),
  ]), ...(state.pendingBattle?.revealedHpCard ? [state.pendingBattle.revealedHpCard] : []),
].map((card) => card.instanceId).sort()

const setup = (level: 6 | 7 = 6, attachments = false, movementBlocker = false) => {
  const base = createBattleState()
  const attacker = cookie('BS8-045', 'attacker')
  const defender = cookie('BS8-034', 'defender')
  const replacement = cookie('BS8-037', 'replacement')
  const equipment = official('BS8-046', 'equipment')
  const underlay = cookie('BS8-037', 'underlay')
  const source = { ...inBattle(attacker), ...(attachments ? { equippedCards: [equipment], awakenedUnderlay: [underlay] } : {}) }
  const supports = [official('BS8-037', 'pay-one'), official('BS8-037', 'pay-two')]
  const breakArea = [cookie('BS8-030', 'break-three-a'), cookie('BS8-030', 'break-three-b'), ...(level === 7 ? [cookie('BS8-037', 'break-one')] : [])]
  const state: GameState = { ...base, players: { ...base.players,
    'player-one': { ...base.players['player-one'], battleArea: [inBattle(defender), ...(movementBlocker ? [inBattle(cookie('BS6-010', 'movement-blocker'))] : [])], hand: [], supportArea: [] },
    'player-two': { ...base.players['player-two'], battleArea: [source], breakArea, hand: [replacement], supportArea: supports.map((card) => ({ card, rested: false })), deck: Array.from({ length: 20 }, (_, index) => official('BS8-046', `deck-${index}`)) },
  } }
  expect(breakArea.reduce((sum, card) => sum + card.level, 0)).toBe(level)
  const command = { kind: 'declare-attack' as const, playerId: 'player-two' as const, attackerInstanceId: attacker.instanceId, targetInstanceId: defender.instanceId, supportPaymentIds: supports.map((card) => card.instanceId) }
  return { state, attacker, defender, source, replacement, equipment, underlay, command }
}

const afterDamage = (state: GameState, command: ReturnType<typeof setup>['command']) => {
  const declared = applyGameCommand(state, command)
  expect(declared.pendingBattle).toMatchObject({ stage: 'trap', declaredDamage: 3 })
  expect(declared.players['player-two'].supportArea.every((entry) => entry.rested)).toBe(true)
  expect(declared.players['player-two'].battleArea[0].rested).toBe(true)
  let next = applyGameCommand(declared, { kind: 'skip-trap', playerId: 'player-one' })
  for (let index = 0; index < 3; index += 1) {
    next = applyGameCommand(next, { kind: 'resolve-next-damage', playerId: 'player-one' })
  }
  expect(next.pendingBattle?.stage).toBe('attack-effect')
  expect(next.players['player-one'].battleArea[0].hpCards).toHaveLength(state.players['player-one'].battleArea[0].hpCards.length - 3)
  expect(next.players['player-two'].breakArea).toEqual(state.players['player-two'].breakArea)
  return next
}
const resolve = (state: GameState, targetIds: string[]) => applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: 'player-two', targetIds })

describe('BS8-045 Habanero mandatory post-attack Break movement', () => {
  it('pays Y2 for three damage, then at Break LV6 moves itself to LV8 and allows normal replacement', () => {
    const { state, attacker, source, replacement, command } = setup(6)
    expect(attacker.level).toBe(2)
    expect(attacker.attackEnergyCost).toEqual({ yellow: 2 })
    expect(attacker.attack).toBe(3)
    expect(attacker.attackEffects).toEqual([{ kind: 'battle-to-break', target: { side: 'self', min: 1, max: 1, sourceOnly: true }, condition: { kind: 'break-level-at-most', level: 6 } }])
    const pending = afterDamage(state, command)
    expect(pending.pendingOptionalCostAttack).toBeFalsy()
    const moved = resolve(pending, [attacker.instanceId])
    expect(moved.players['player-two'].battleArea).toEqual([])
    expect(moved.players['player-two'].breakArea).toContainEqual(attacker)
    expect(moved.players['player-two'].breakArea.reduce((sum, card) => sum + card.level, 0)).toBe(8)
    expect(moved.players['player-two'].discardPile).toEqual(expect.arrayContaining(source.hpCards))
    expect(moved.pendingBattle).toBeFalsy()
    expect(moved.pendingReplacement?.tasks).toEqual([{ playerId: 'player-two', remaining: 1 }])
    expect(physicalIds(moved)).toEqual(physicalIds(state))
    const replaced = applyGameCommand(moved, { kind: 'replace-cookie', playerId: 'player-two', instanceId: replacement.instanceId })
    expect(replaced.players['player-two'].battleArea[0].card).toEqual(replacement)
    expect(replaced.players['player-two'].battleArea[0].hpCards).toHaveLength(replacement.hp)
    expect(replaced.pendingReplacement).toBeFalsy()
    expect(physicalIds(replaced)).toEqual(physicalIds(state))
  })

  it('at Break LV7 deals the same three damage but does not move or discard source HP', () => {
    const { state, attacker, source, command } = setup(7)
    const result = resolve(afterDamage(state, command), [attacker.instanceId])
    expect(result.pendingBattle).toBeFalsy()
    expect(result.pendingReplacement).toBeFalsy()
    expect(result.players['player-two'].battleArea[0]).toEqual({ ...source, rested: true })
    expect(result.players['player-two'].breakArea).toEqual(state.players['player-two'].breakArea)
    expect(result.players['player-two'].discardPile).toEqual(state.players['player-two'].discardPile)
    expect(physicalIds(result)).toEqual(physicalIds(state))
  })

  it('preserves pre-attached equipment and underlay by sending them with HP to trash on departure', () => {
    // This is an attachment-conservation fixture, not a claim that Habanero can Awaken or equip this Item.
    const { state, attacker, source, equipment, underlay, command } = setup(6, true)
    const result = resolve(afterDamage(state, command), [attacker.instanceId])
    expect(result.players['player-two'].discardPile).toEqual(expect.arrayContaining([...source.hpCards, equipment, underlay]))
    expect(result.players['player-two'].breakArea).toContainEqual(attacker)
    expect(physicalIds(result)).toEqual(physicalIds(state))
  })

  it.each(['zero', 'opponent', 'hand', 'duplicate'] as const)('rejects %s target selection instead of skipping the mandatory movement', (selection) => {
    const { state, attacker, defender, replacement, command } = setup()
    const pending = afterDamage(state, command)
    const ids = { zero: [], opponent: [defender.instanceId], hand: [replacement.instanceId], duplicate: [attacker.instanceId, attacker.instanceId] }[selection]
    const snapshot = structuredClone(pending)
    expect(() => resolve(pending, ids)).toThrow()
    expect(pending).toEqual(snapshot)
  })

  it.each(['short', 'red'] as const)('rejects %s attack payment before any damage or source movement', (payment) => {
    const { state, command } = setup()
    const red = official('BS8-009', 'wrong-color')
    const wrong: GameState = payment === 'red' ? { ...state, players: { ...state.players, 'player-two': { ...state.players['player-two'], supportArea: [state.players['player-two'].supportArea[0], { card: red, rested: false }] } } } : state
    const ids = payment === 'short' ? command.supportPaymentIds.slice(0, 1) : [command.supportPaymentIds[0], red.instanceId]
    expect(() => applyGameCommand(wrong, { ...command, supportPaymentIds: ids })).toThrow()
    expect(wrong.players['player-two'].supportArea.every((entry) => !entry.rested)).toBe(true)
    expect(wrong.pendingBattle).toBeFalsy()
  })

  it('respects the opposing real BS6-010 effect-movement lock without falsely logging departure', () => {
    const { state, attacker, source, command } = setup(6, false, true)
    const result = resolve(afterDamage(state, command), [attacker.instanceId])
    expect(result.players['player-two'].battleArea[0]).toEqual({ ...source, rested: true })
    expect(result.players['player-two'].breakArea).toEqual(state.players['player-two'].breakArea)
    expect(result.pendingReplacement).toBeFalsy()
    expect(physicalIds(result)).toEqual(physicalIds(state))
    const trace = result.commandLog?.at(-1)?.steps?.map((step) => step.text).join('\n') ?? ''
    expect(trace).toMatch(/阻擋|禁止|不能|未執行/)
    expect(trace).not.toContain('攻擊後效果結果：將目標餅乾放入休息區')
  })
})

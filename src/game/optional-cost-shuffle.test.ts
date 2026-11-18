import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { takeAiStep } from './ai'
import { resolveOptionalCostAttack } from './battle'
import { applyGameCommand, type ResolveOptionalCostAttackCommand } from './commands'
import type { GameState, PlayerId, Shuffle } from './types'

interface Fixture {
  state: GameState
  command: ResolveOptionalCostAttackCommand
  actor: PlayerId
  seed: number
  sourceCardName: string
}
const load = (): Fixture => JSON.parse(readFileSync(
  new URL('./fixtures/optional-cost-shuffle.json', import.meta.url), 'utf8',
))
const ids = (state: GameState, player: PlayerId) => state.players[player].deck.map(card => card.instanceId)
afterEach(() => vi.restoreAllMocks())

describe('optional attack cost preserves the injected shuffle context', () => {
  it('replays the captured Mangosteen cost without ambient randomness or input mutation', () => {
    const fixture = load(), before = JSON.stringify(fixture.state)
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Ambient randomness is forbidden') })
    expect(fixture.sourceCardName).toBe('Mangosteen Cookie')
    expect(fixture.command.trashToDeckIds).toHaveLength(5)
    const first = applyGameCommand(fixture.state, fixture.command, { shuffleSeed: 119 })
    const replayed = applyGameCommand(fixture.state, fixture.command, { shuffleSeed: 119 })
    expect(replayed).toEqual(first)
    expect(first.players[fixture.actor].deck).toHaveLength(fixture.state.players[fixture.actor].deck.length + 5)
    expect(first.players[fixture.actor].discardPile).toHaveLength(fixture.state.players[fixture.actor].discardPile.length - 5)
    expect(JSON.stringify(fixture.state)).toBe(before)
    expect(random).not.toHaveBeenCalled()
  })

  it('uses the supplied seed while preserving the same physical card multiset', () => {
    const fixture = load()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const first = applyGameCommand(fixture.state, fixture.command, { shuffleSeed: 119 })
    const second = applyGameCommand(fixture.state, fixture.command, { shuffleSeed: 120 })
    expect(ids(first, fixture.actor)).not.toEqual(ids(second, fixture.actor))
    expect(ids(first, fixture.actor).sort()).toEqual(ids(second, fixture.actor).sort())
  })

  it('passes a caller-provided shuffle through the command and cost resolver', () => {
    const fixture = load(), selected = new Set(fixture.command.trashToDeckIds)
    const player = fixture.state.players[fixture.actor]
    const expected = [...player.deck, ...player.discardPile.filter(card => selected.has(card.instanceId))].reverse()
    const reverse: Shuffle = cards => [...cards].reverse()
    const shuffle = vi.fn(reverse)
    vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Ambient randomness is forbidden') })
    const result = applyGameCommand(fixture.state, fixture.command, { shuffle })
    expect(ids(result, fixture.actor)).toEqual(expected.map(card => card.instanceId))
    expect(shuffle).toHaveBeenCalledTimes(1)
  })

  it('supports the same explicit shuffle on the direct resolver API', () => {
    const { state, command: c, actor } = load(), reverse: Shuffle = cards => [...cards].reverse()
    vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Ambient randomness is forbidden') })
    const direct = resolveOptionalCostAttack(state, actor, 'pay', c.discardCardIds, c.targetIds,
      c.paymentIds, c.supportToHandIds, c.hpToTrashIds, c.trashToDeckIds, c.hpToHandIds,
      c.supportToTrashIds, c.positionCostTargetIds, c.cookieToBreakAreaIds, reverse)
    const commanded = applyGameCommand(state, c, { shuffle: reverse })
    expect(direct.players).toEqual(commanded.players)
  })

  it('does not shuffle or pay trash cards when the optional cost is skipped', () => {
    const fixture = load(), shuffle = vi.fn<Shuffle>(() => { throw new Error('Skip must not shuffle') })
    const result = applyGameCommand(fixture.state, {
      kind: 'resolve-optional-cost-attack', playerId: fixture.actor, action: 'skip',
    }, { shuffle })
    expect(ids(result, fixture.actor)).toEqual(ids(fixture.state, fixture.actor))
    expect(result.players[fixture.actor].discardPile).toEqual(fixture.state.players[fixture.actor].discardPile)
    expect(shuffle).not.toHaveBeenCalled()
  })

  it('keeps the actual AI pending decision deterministic under the injected match seed', () => {
    const fixture = load(), random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('AI must inject its shuffle context') })
    const run = () => takeAiStep(fixture.state, fixture.actor, { level: 5, seed: fixture.seed, searchNow: () => 0 })
    const first = run(), second = run()
    expect(first.action).toBe('resolve-optional-cost-attack')
    expect(first.error).toBeUndefined()
    expect(second.state).toEqual(first.state)
    expect(random).not.toHaveBeenCalled()
  })
})

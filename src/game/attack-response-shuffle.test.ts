import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { takeAiStep } from './ai'
import { playAttackResponseSkill } from './battle'
import { applyGameCommand, type PlayAttackResponseCommand } from './commands'
import type { GameState, PlayerId, Shuffle } from './types'

interface Fixture {
  state: GameState
  command: PlayAttackResponseCommand
  actor: PlayerId
  seed: number
  sourceCardName: string
}
const load = (): Fixture => JSON.parse(readFileSync(
  new URL('./fixtures/attack-response-shuffle.json', import.meta.url), 'utf8',
))
const deckIds = (state: GameState, player: PlayerId) => state.players[player].deck.map(card => card.instanceId)
afterEach(() => vi.restoreAllMocks())

describe('attack response costs preserve the injected shuffle context', () => {
  it('replays the captured Rambutan payment without ambient randomness or input mutation', () => {
    const fixture = load(), before = JSON.stringify(fixture.state)
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Ambient randomness is forbidden') })
    expect(fixture.sourceCardName).toBe('Rambutan Cookie')
    expect(fixture.command.trashToDeckIds).toHaveLength(3)
    const result = applyGameCommand(fixture.state, fixture.command, { shuffleSeed: 731 })
    expect(applyGameCommand(fixture.state, fixture.command, { shuffleSeed: 731 })).toEqual(result)
    expect(result.players[fixture.actor].deck).toHaveLength(fixture.state.players[fixture.actor].deck.length + 3)
    expect(result.players[fixture.actor].discardPile).toHaveLength(fixture.state.players[fixture.actor].discardPile.length - 3)
    expect(JSON.stringify(fixture.state)).toBe(before)
    expect(random).not.toHaveBeenCalled()
  })

  it('uses the supplied seed and preserves the physical card multiset', () => {
    const fixture = load()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const first = applyGameCommand(fixture.state, fixture.command, { shuffleSeed: 731 })
    const second = applyGameCommand(fixture.state, fixture.command, { shuffleSeed: 732 })
    expect(deckIds(first, fixture.actor)).not.toEqual(deckIds(second, fixture.actor))
    expect(deckIds(first, fixture.actor).sort()).toEqual(deckIds(second, fixture.actor).sort())
  })

  it('passes a custom shuffle through both the command and direct response API', () => {
    const { state, command, actor } = load(), selected = new Set(command.trashToDeckIds)
    const player = state.players[actor]
    const expected = [...player.deck, ...player.discardPile.filter(card => selected.has(card.instanceId))].reverse()
    const reverse: Shuffle = cards => [...cards].reverse()
    const shuffle = vi.fn(reverse)
    vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Ambient randomness is forbidden') })
    const result = applyGameCommand(state, command, { shuffle })
    expect(deckIds(result, actor)).toEqual(expected.map(card => card.instanceId))
    expect(shuffle).toHaveBeenCalledTimes(1)
    const direct = playAttackResponseSkill(state, actor, command, reverse)
    expect(direct.players).toEqual(result.players)
  })

  it('keeps the actual AI response deterministic under the injected match seed', () => {
    const fixture = load()
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('AI must inject its shuffle context') })
    const run = () => takeAiStep(fixture.state, fixture.actor, { level: 5, seed: fixture.seed, searchNow: () => 0 })
    const first = run(), second = run()
    expect(first.action).toBe('play-attack-response')
    expect(first.error).toBeUndefined()
    expect(second.state).toEqual(first.state)
    expect(random).not.toHaveBeenCalled()
  })
})

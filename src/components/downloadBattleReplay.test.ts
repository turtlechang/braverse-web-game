/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildBattleReplayExport } from '../game'
import { createBattleState } from '../game/test-helpers/battle-helpers'
import { battleReplayFileName, downloadBattleReplay } from './downloadBattleReplay'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('downloadBattleReplay', () => {
  it('serializes an artifact into a browser download with a stable filename', () => {
    vi.useFakeTimers()
    const createObjectURL = vi.fn(() => 'blob:braverse-replay')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    const artifact = buildBattleReplayExport({
      state: createBattleState(),
      mode: 'offline',
      viewerId: 'player-one',
      decks: { playerOne: 'fixture-one', playerTwo: 'fixture-two' },
      now: () => new Date('2026-08-26T12:34:56.000Z'),
    })

    expect(battleReplayFileName(artifact)).toBe(
      'braverse-replay-offline-20260826123456.json',
    )
    expect(downloadBattleReplay(artifact)).toBe(true)
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(click).toHaveBeenCalledTimes(1)
    expect(click.mock.instances[0]).toHaveProperty(
      'download',
      'braverse-replay-offline-20260826123456.json',
    )

    vi.runAllTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:braverse-replay')
  })

  it('returns false when the browser does not provide object URL downloads', () => {
    vi.stubGlobal('URL', {})
    expect(
      downloadBattleReplay(
        buildBattleReplayExport({
          state: createBattleState(),
          mode: 'offline',
          viewerId: 'player-one',
          decks: { playerOne: 'fixture-one', playerTwo: 'fixture-two' },
        }),
      ),
    ).toBe(false)
  })
})

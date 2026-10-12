import type { GameCommand } from '../game/commands'

/** Capture UI entropy once in the command so offline playback uses the same shuffle. */
export const seedOfflineShuffleCommand = (
  command: GameCommand,
  nextSeed: () => number,
): GameCommand => {
  if (command.kind !== 'refresh-deck') return command
  if (command.shuffleSeed !== undefined) return command
  const shuffleSeed = nextSeed()
  if (!Number.isInteger(shuffleSeed) || shuffleSeed < 0 || shuffleSeed > 0xffffffff) {
    throw Error('Offline shuffle seed must be a uint32')
  }
  return { ...command, shuffleSeed }
}

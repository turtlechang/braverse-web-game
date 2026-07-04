import { applyGameCommand } from './commands'
import type { ApplyGameCommandOptions, GameCommand } from './commands'
import type { CommandLogEntry, GameState } from './types'

export const commandFromLogEntry = (entry: CommandLogEntry): GameCommand =>
  entry.payload as unknown as GameCommand

export const replayCommands = (
  initialState: GameState,
  commands: readonly GameCommand[],
  options: ApplyGameCommandOptions = {},
): GameState =>
  commands.reduce<GameState>(
    (state, command) => applyGameCommand(state, command, options),
    initialState,
  )

export const replayCommandLog = (
  initialState: GameState,
  log: readonly CommandLogEntry[],
  options: ApplyGameCommandOptions = {},
): GameState =>
  replayCommands(initialState, log.map(commandFromLogEntry), options)

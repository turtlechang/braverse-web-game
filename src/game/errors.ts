export class GameRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GameRuleError'
  }
}


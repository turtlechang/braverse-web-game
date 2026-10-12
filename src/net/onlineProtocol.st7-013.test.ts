import { describe, expect, it } from 'vitest'
import { isClientMessage, isOnlineGameCommand } from './onlineProtocol'

describe('ST7-013 trash Cookie cost wire validation', () => {
  it.each(['play-item', 'begin-play-item'])('validates the complete item cost shape for %s', kind => {
    const command = { kind, playerId: 'player-one', instanceId: 'original-item', paymentIds: ['yellow-1', 'yellow-2'] }
    expect(isOnlineGameCommand(command)).toBe(true)
    expect(isOnlineGameCommand({ ...command, trashCookieToBreakAreaIds: ['original-yellow-cookie'] })).toBe(true)
    expect(isClientMessage({ type: 'submit-command', command: { ...command, trashCookieToBreakAreaIds: ['original-yellow-cookie'] } })).toBe(true)
    for (const trashCookieToBreakAreaIds of [null, 'cookie', 1, {}, [1], ['cookie', null]]) {
      expect(isOnlineGameCommand({ ...command, trashCookieToBreakAreaIds })).toBe(false)
      expect(isClientMessage({ type: 'submit-command', command: { ...command, trashCookieToBreakAreaIds } })).toBe(false)
    }
  })
})

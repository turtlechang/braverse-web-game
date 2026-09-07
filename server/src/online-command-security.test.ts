import { describe, expect, it } from 'vitest'
import { RoomStore } from './rooms'
import { isClientMessage } from '../../src/net/onlineProtocol'
import { applyGameCommand, getTrapCandidates, OFFICIAL_RED_STARTER_DECK } from '../../src/game'
import { cookie, createBattleState, item } from '../../src/game/test-helpers/battle-helpers'
import type { GameCommand } from '../../src/game'

const setup = () => {
  const store = new RoomStore()
  const room = store.createRoom({
    id: 'security', name: 'Security regression', entries: OFFICIAL_RED_STARTER_DECK,
    createdAt: '', updatedAt: '',
  }, () => {})
  room.status = 'in-progress'
  room.state = createBattleState()
  room.state.players['player-two'].battleArea[0].card.attack = 1
  room.state.players['player-one'].hand.push({
    ...item('usable-trap'), type: 'trap',
    trap: {
      text: 'Reduce attack damage', cost: { energy: {}, discardHand: 0 },
      effects: [{ kind: 'modify-attack', amount: -1, duration: 'this-turn', target: { side: 'opponent', min: 1, max: 1 } }],
    },
  })
  return { store, room }
}

const declare: GameCommand = {
  kind: 'declare-attack', playerId: 'player-two', attackerInstanceId: 'attacker',
  targetInstanceId: 'defender', supportPaymentIds: ['p2-support'],
}

describe('online command authority', () => {
  it('rejects direct automatic attack at both protocol and RoomStore boundaries', () => {
    const { store, room } = setup()
    const command: GameCommand = { ...declare, kind: 'attack' }
    const before = structuredClone(room.state)
    expect(isClientMessage({ type: 'submit-command', command })).toBe(false)
    expect(() => store.applyCommand(room, 'player-two', command)).toThrow('線上對戰不允許')
    expect(room.state).toEqual(before)
  })

  it('cannot take the defender choice, while a legal Trap still resolves normally', () => {
    const { store, room } = setup()
    store.applyCommand(room, 'player-two', declare)
    expect(getTrapCandidates(room.state!, 'player-one').map((card) => card.instanceId)).toContain('usable-trap')
    const before = structuredClone(room.state)
    for (const playerId of ['player-one', 'player-two'] as const) {
      const command: GameCommand = { kind: 'resolve-battle', playerId }
      expect(isClientMessage({ type: 'submit-command', command })).toBe(false)
      expect(() => store.applyCommand(room, playerId, command)).toThrow('線上對戰不允許')
      expect(room.state).toEqual(before)
    }
    expect(() => store.applyCommand(room, 'player-two', { kind: 'skip-trap', playerId: 'player-two' })).toThrow()
    expect(room.state).toEqual(before)
    const play: GameCommand = { kind: 'play-trap', playerId: 'player-one', trapInstanceId: 'usable-trap', paymentIds: [], targetIds: ['attacker'] }
    expect(isClientMessage({ type: 'submit-command', command: play })).toBe(true)
    store.applyCommand(room, 'player-one', play)
    expect(room.state!.players['player-one'].discardPile.map((card) => card.instanceId)).toContain('usable-trap')
    expect(room.state!.players['player-one'].battleArea[0].hpCards).toHaveLength(3)
    if (room.state!.pendingBattle?.stage === 'damage') {
      store.applyCommand(room, 'player-one', { kind: 'resolve-next-damage', playerId: 'player-one' })
    }
    expect(room.state!.players['player-one'].battleArea[0].hpCards).toHaveLength(3)
    expect(room.state!.pendingBattle).toBeNull()
  })

  it('rejects client Refresh seed fields without changing the pending state', () => {
    const { store, room } = setup()
    room.state!.players['player-one'].deck = []
    room.state!.players['player-one'].discardPile = [cookie('renew'), item('a'), item('b'), item('c')]
    room.state!.pendingRefresh = { playerId: 'player-one', remainingDraws: 0 }
    const before = structuredClone(room.state)
    const command: GameCommand = { kind: 'refresh-deck', playerId: 'player-one', cookieInstanceId: 'renew', shuffleSeed: 2 }
    expect(isClientMessage({ type: 'submit-command', command })).toBe(false)
    expect(() => store.applyCommand(room, 'player-one', command)).toThrow('線上對戰不允許')
    expect(room.state).toEqual(before)
    const legal: GameCommand = { kind: 'refresh-deck', playerId: 'player-one', cookieInstanceId: 'renew' }
    expect(isClientMessage({ type: 'submit-command', command: legal })).toBe(true)
    store.applyCommand(room, 'player-one', legal)
    expect(room.state!.players['player-one'].deck.map((card) => card.instanceId).sort()).toEqual(['a', 'b', 'c'])
    expect(room.state!.players['player-one'].breakArea.map((card) => card.instanceId)).toContain('renew')
    expect(room.state!.pendingRefresh).toBeNull()
    // Offline replay keeps its separate, deterministic engine input.
    expect(applyGameCommand(before!, command)).toEqual(applyGameCommand(before!, command))
  })

  it('does not accept inherited object keys as commands or extra Refresh fields', () => {
    for (const kind of ['constructor', 'toString', '__proto__']) {
      expect(isClientMessage({ type: 'submit-command', command: { kind, playerId: 'player-one' } })).toBe(false)
    }
    expect(isClientMessage({ type: 'submit-command', command: { kind: 'refresh-deck', playerId: 'player-one', cookieInstanceId: 'renew', shuffleSeed: undefined } })).toBe(false)
  })
})

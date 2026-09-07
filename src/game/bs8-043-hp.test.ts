import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { getCardPoolEntry } from './card-pool'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState } from './demo'
import { executeCardEffect } from './effects'
import { canActivateCookieSkill } from './skills'
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

const setup = (origin: 'break' | 'hand' = 'break', targetId = 'BS8-039') => {
  const base = createCardCheckDemoState('BS8-043')
  const source = base.players['player-one'].battleArea.find((entry) => entry.card.id === 'BS8-043')!
  const target = cookie(targetId, 'target')
  const support = Array.from({ length: 3 }, (_, index) => ({ card: official('BS8-037', `support-${index}`), rested: false }))
  const initial: GameState = { ...base, players: { ...base.players,
    'player-one': { ...base.players['player-one'], battleArea: [source],
      hand: origin === 'hand' ? [target] : [], breakArea: origin === 'break' ? [target] : [],
      supportArea: support, deck: Array.from({ length: 36 }, (_, index) => official('BS8-046', `deck-${index}`)),
    },
  } }
  const context = { sourcePlayerId: 'player-one' as const, sourceInstanceId: source.card.instanceId }
  const entered = origin === 'hand'
    ? applyGameCommand(initial, { kind: 'deploy-cookie', playerId: 'player-one', instanceId: target.instanceId })
    : executeCardEffect(initial, context, { kind: 'break-to-battle', amount: 1 }, [target.instanceId])
  const command = { kind: 'begin-activate-skill' as const, playerId: 'player-one' as const, sourceInstanceId: source.card.instanceId, trigger: 'activate' as const, paymentIds: [support[0].card.instanceId] }
  return { source, target, entered, context, command }
}

const resolve = (state: GameState, targetIds: string[]) => applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds })
const nextOwnMain = (state: GameState) => {
  let next = state
  for (let step = 0; step < 24 && !(next.turnNumber > state.turnNumber && next.activePlayerId === 'player-one' && next.phase === 'main'); step += 1) {
    next = applyGameCommand(next, { kind: 'advance-phase', playerId: next.activePlayerId })
  }
  expect(next.turnNumber).toBeGreaterThan(state.turnNumber)
  expect(next.activePlayerId).toBe('player-one')
  expect(next.phase).toBe('main')
  return next
}

describe('BS8-043 Fettuccine HP after this-turn Break entry', () => {
  it('pays exactly one yellow support and adds one actual HP card only to the entered LV.3 Cookie', () => {
    const { source, target, entered, command } = setup()
    expect(source.card.skill).toMatchObject({ trigger: 'activate', oncePerTurn: true, cost: { energy: { yellow: 1 } }, effects: [{ kind: 'gain-hp', amount: 1, target: { side: 'self', min: 1, max: 1, minLevel: 3, maxLevel: 3, enteredFrom: 'break', enteredThisTurn: true } }] })
    const beforeTarget = entered.players['player-one'].battleArea.find((entry) => entry.card.instanceId === target.instanceId)!
    expect(beforeTarget).toMatchObject({ enteredFrom: 'break', enteredTurn: entered.turnNumber })
    expect(target.level).toBe(3)
    expect(canActivateCookieSkill(entered, 'player-one', source.card.instanceId, 'activate')).toBe(true)
    const paid = applyGameCommand(entered, command)
    expect(paid.players['player-one'].supportArea.map((entry) => entry.rested)).toEqual([true, false, false])
    expect(paid.players['player-one'].battleArea).toEqual(entered.players['player-one'].battleArea)
    const result = resolve(paid, [target.instanceId])
    expect(result.players['player-one'].battleArea.find((entry) => entry.card.instanceId === target.instanceId)?.hpCards).toEqual([...beforeTarget.hpCards, entered.players['player-one'].deck[0]])
    expect(result.players['player-one'].deck).toEqual(entered.players['player-one'].deck.slice(1))
    expect(result.players['player-one'].battleArea.find((entry) => entry.card.instanceId === source.card.instanceId)?.hpCards).toEqual(source.hpCards)
    expect(result.pendingAbilityEffect).toBeFalsy()
    expect(canActivateCookieSkill(result, 'player-one', source.card.instanceId, 'activate')).toBe(false)
    expect(() => applyGameCommand(result, { ...command, paymentIds: [result.players['player-one'].supportArea[1].card.instanceId] })).toThrow()
  })

  it.each(['empty', 'red', 'rested'] as const)('rejects %s payment without changing HP or support', (payment) => {
    const { entered, command } = setup()
    const paymentCard = official(payment === 'red' ? 'BS8-009' : 'BS8-037', 'invalid-payment')
    const state: GameState = { ...entered, players: { ...entered.players, 'player-one': { ...entered.players['player-one'], supportArea: [{ card: paymentCard, rested: payment === 'rested' }] } } }
    expect(() => applyGameCommand(state, { ...command, paymentIds: payment === 'empty' ? [] : [paymentCard.instanceId] })).toThrow()
    expect(state.players['player-one'].battleArea).toEqual(entered.players['player-one'].battleArea)
    expect(state.players['player-one'].supportArea[0].rested).toBe(payment === 'rested')
  })

  it.each(['hand', 'level-two', 'previous-turn'] as const)('cannot activate or pay when the only target is %s', (scenario) => {
    const { source, target, entered, command } = setup(scenario === 'hand' ? 'hand' : 'break', scenario === 'level-two' ? 'BS8-034' : 'BS8-039')
    const state = scenario === 'previous-turn' ? nextOwnMain(entered) : entered
    const candidate = state.players['player-one'].battleArea.find((entry) => entry.card.instanceId === target.instanceId)!
    if (scenario === 'hand') expect(candidate.enteredFrom).toBe('hand')
    if (scenario === 'level-two') expect(candidate.card.level).toBe(2)
    if (scenario === 'previous-turn') expect(candidate.enteredTurn).toBeLessThan(state.turnNumber)
    expect(canActivateCookieSkill(state, 'player-one', source.card.instanceId, 'activate')).toBe(false)
    expect(() => applyGameCommand(state, command)).toThrow()
    expect(state.players['player-one'].supportArea.every((entry) => !entry.rested)).toBe(true)
    expect(candidate.hpCards).toHaveLength(target.hp)
  })

  it('needs a fresh Break entry next own turn even after once-per-turn resets', () => {
    const { source, target, entered, context, command } = setup()
    const used = resolve(applyGameCommand(entered, command), [target.instanceId])
    const next = nextOwnMain(used)
    expect(canActivateCookieSkill(next, 'player-one', source.card.instanceId, 'activate')).toBe(false)
    expect(() => applyGameCommand(next, command)).toThrow()
    const departed = executeCardEffect(next, context, { kind: 'battle-to-break', target: { side: 'self', min: 1, max: 1 } }, [target.instanceId])
    const returned = executeCardEffect(departed, context, { kind: 'break-to-battle', amount: 1 }, [target.instanceId])
    expect(returned.players['player-one'].battleArea.find((entry) => entry.card.instanceId === target.instanceId)).toMatchObject({ enteredFrom: 'break', enteredTurn: next.turnNumber })
    expect(canActivateCookieSkill(returned, 'player-one', source.card.instanceId, 'activate')).toBe(true)
    const result = resolve(applyGameCommand(returned, command), [target.instanceId])
    expect(result.players['player-one'].battleArea.find((entry) => entry.card.instanceId === target.instanceId)?.hpCards).toHaveLength(target.hp + 1)
    expect(result.players['player-one'].battleArea.find((entry) => entry.card.instanceId === source.card.instanceId)?.hpCards).toEqual(source.hpCards)
  })

  it.each(['source', 'opponent', 'unknown', 'zero', 'duplicate'] as const)('rejects %s selection even when a valid own target exists', (selection) => {
    const { source, target, entered, command } = setup()
    const opponent = cookie('BS8-039', 'opponent')
    const prepared: GameState = { ...entered, players: { ...entered.players, 'player-two': { ...entered.players['player-two'], battleArea: [], breakArea: [opponent] } } }
    const opponentEntered = executeCardEffect(prepared, { sourcePlayerId: 'player-two', sourceInstanceId: opponent.instanceId }, { kind: 'break-to-battle', amount: 1 }, [opponent.instanceId])
    const paid = applyGameCommand(opponentEntered, command)
    const ids = { source: [source.card.instanceId], opponent: [opponent.instanceId], unknown: ['missing'], zero: [], duplicate: [target.instanceId, target.instanceId] }[selection]
    expect(() => resolve(paid, ids)).toThrow()
    expect(paid.players['player-one'].battleArea).toEqual(opponentEntered.players['player-one'].battleArea)
    expect(paid.players['player-two'].battleArea).toEqual(opponentEntered.players['player-two'].battleArea)
  })
})

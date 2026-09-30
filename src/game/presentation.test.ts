import { describe, expect, it } from 'vitest'
import { applyGameCommand, createDemoGame } from './index'
import { describeOpeningDeal, describePresentation, maskPresentation } from './presentation'

const owner = 'player-one' as const
const opponent = 'player-two' as const

describe('presentation receipts', () => {
  it('deals alternating opening hands using anonymous opponent slots', () => {
    const game = createDemoGame()
    const events = maskPresentation(describeOpeningDeal(game, 'opening'), owner)
    expect(events.slice(0,2).map(event => event.target?.playerId)).toEqual([owner,opponent])
    expect(events.filter(event => event.target?.playerId === opponent).every(event => event.card?.id === 'hidden' && event.target?.instanceId === undefined && event.target?.handSlot !== undefined)).toBe(true)
    expect(events.every(event => event.source?.zone === 'deck' && event.target?.zone === 'hand')).toBe(true)
  })
  it('records an accepted draw and masks private card identity and source deck position', () => {
    const previous = createDemoGame()
    const card = previous.players[owner].deck[0]
    const next = { ...previous, players: { ...previous.players, [owner]: { ...previous.players[owner], deck: previous.players[owner].deck.slice(1), hand: [...previous.players[owner].hand, card] } } }
    const events = describePresentation(previous, next)
    expect(events).toEqual(expect.arrayContaining([expect.objectContaining({kind:'move', target:expect.objectContaining({zone:'hand'})})]))
    const hidden = maskPresentation(events, opponent)[0]
    expect(hidden.card?.id).toBe('hidden')
    expect(hidden.source?.instanceId).toBeUndefined()
    expect(hidden.target?.instanceId).toBeUndefined()
    expect(JSON.stringify(hidden)).not.toContain(card.instanceId)
    expect(maskPresentation(events, owner)[0].card?.id).toBe(card.id)
  })
  it('does not call a voluntary move to break a faint', () => {
    const previous = createDemoGame()
    const cookie = previous.players[owner].battleArea[0]
    const next = { ...previous, players: {...previous.players, [owner]: {...previous.players[owner], battleArea:previous.players[owner].battleArea.slice(1), breakArea:[cookie.card]}} }
    expect(describePresentation(previous,next).some(event=>event.kind==='faint')).toBe(false)
  })
  it('does not expose face-down HP even to its owner', () => {
    const previous = createDemoGame()
    const cookie = previous.players[owner].battleArea[0]
    const card = previous.players[owner].deck[0]
    const next = { ...previous, players: {...previous.players,[owner]:{...previous.players[owner],deck:previous.players[owner].deck.slice(1),battleArea:[{...cookie,hpCards:[...cookie.hpCards,card]},...previous.players[owner].battleArea.slice(1)]}} }
    const events = maskPresentation(describePresentation(previous,next),owner)
    expect(events.find(event=>event.target?.zone==='hp')?.card?.id).toBe('hidden')
  })
  it('is deterministic, leaves input untouched and stores receipts on the accepted command', () => {
    const previous = {...createDemoGame(), phase:'draw' as const}
    const json = JSON.stringify(previous)
    const command = {kind:'advance-phase' as const,playerId:previous.activePlayerId}
    const a = applyGameCommand(previous,command)
    const b = applyGameCommand(previous,command)
    expect(a).toEqual(b)
    expect(JSON.stringify(previous)).toBe(json)
    expect(a.commandLog?.at(-1)?.presentation).toBeDefined()
  })
})
import { createBattleState, declareAttack } from './test-helpers/battle-helpers'
import { maskGameStateForViewer } from './masked-state'

describe('intermediate command receipts', () => {
  it('preserves all three HP reveals and the actual faint inside one automatic battle command', () => {
    const battle = declareAttack(createBattleState())
    const result = applyGameCommand(battle,{kind:'resolve-battle',playerId:'player-two'})
    const events = result.commandLog?.at(-1)?.presentation ?? []
    expect(events.filter(event=>event.kind==='reveal').map(event=>event.card?.instanceId)).toEqual(['defender-hp-c','defender-hp-b','defender-hp-a'])
    expect(events.filter(event=>event.kind==='faint')).toHaveLength(1)
    expect(result.presentationSteps).toBeUndefined()
    const masked=maskGameStateForViewer(result,'player-one')
    expect(masked.commandLog?.at(-1)?.presentation?.filter(event=>event.kind==='reveal')).toHaveLength(3)
  })
})

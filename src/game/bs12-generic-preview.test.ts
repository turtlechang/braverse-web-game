import { expect, it } from 'vitest'
import { getCardPoolEntry } from './card-pool'
import { getTrashToHandCandidates } from './effects'
import { createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import { assertBs12PhysicalFixture } from './bs12-physical-fixtures.test-helpers'

it.each(['BS12-032', 'BS12-032@1', 'BS12-080', 'BS12-101', 'BS12-102'])('generic localhost card preview loads promoted BS12 card %s', number => {
  expect(getCardPoolEntry(number)).toMatchObject({ cardNumber: number })
  if (number === 'BS12-080') {
    expect(parseTestStateConfig(`?test-state=card:${number}`, 'localhost')).toEqual({ kind: 'bs12-080', scenario: 'positive' })
  } else if(number==='BS12-101'||number==='BS12-102'){
    expect(parseTestStateConfig('?test-state=card:'+number, 'localhost')).toEqual({kind:number==='BS12-101'?'bs12-101':'bs12-102',scenario:'positive'})
    expect(parseTestStateConfig('?test-state=card-negative:'+number, 'localhost')).toEqual({kind:number==='BS12-101'?'bs12-101':'bs12-102',scenario:number==='BS12-101'?'non-arena':'split'})
    const positive=createCardCheckDemoState(number),negative=createCardNegativeDemoState(number)
    assertBs12PhysicalFixture(positive);assertBs12PhysicalFixture(negative)
    if(number==='BS12-101'){
      const source=positive.players['player-one'].battleArea.find(c=>c.card.id==='BS12-101')!
      expect(source.card).toMatchObject({type:'cookie',hp:2,attack:1,attackEnergyCost:{black:1}})
      expect(source.hpCards).toHaveLength(2)
      expect(positive.players['player-one'].hand.some(c=>c.type==='cookie'&&c.keywords?.includes('arena'))).toBe(true)
      expect(negative.players['player-one'].hand.some(c=>c.type==='cookie'&&c.keywords?.includes('arena'))).toBe(false)
    }else{
      const options={cookieOnly:true,keyword:'arena' as const,hasSpecialPlay:true}
      const context={sourcePlayerId:'player-one' as const,sourceInstanceId:'bs12-102-stage'}
      expect(getTrashToHandCandidates(positive,context,options).map(c=>c.instanceId)).toEqual(['bs12-102-target'])
      expect(getTrashToHandCandidates(negative,context,options)).toEqual([])
    }
  } else {
    expect(parseTestStateConfig('?test-state=card:'+number, 'localhost')).toMatchObject({ kind: number.startsWith('BS12-032') ? 'bs12-032' : 'card-check', cardNumber: number })
  }
  expect(parseTestStateConfig(`?test-state=card:${number}`, 'example.com')).toBeNull()
  const state = createCardCheckDemoState(number)
  if (number === 'BS12-080') {
    assertBs12PhysicalFixture(state)
    expect(state.pendingBattle?.revealedHpCard?.id).toBe('BS12-080')
    expect(state.commandLog?.map(entry => entry.commandKind)).toEqual(['declare-attack', 'skip-trap', 'resolve-next-damage'])
    expect(state.players['player-one'].hand).toHaveLength(1)
    expect(parseTestStateConfig(`?test-state=card-negative:${number}`, 'localhost')).toEqual({ kind: 'bs12-080', scenario: 'no-arena' })
    assertBs12PhysicalFixture(createCardNegativeDemoState(number))
  }
  const cards = Object.values(state.players).flatMap(player => [...player.hand, ...player.deck, ...player.discardPile, ...player.breakArea,
    ...player.battleArea.flatMap(entry => [entry.card, ...entry.hpCards]), ...player.supportArea.map(entry => entry.card), ...(player.stage ? [player.stage.card] : [])])
  if (state.pendingBattle?.revealedHpCard) cards.push(state.pendingBattle.revealedHpCard)
  expect(cards.some(card => card.id === number.split('@')[0] && card.imageUrl?.startsWith('https://cookierunbraverse.com/data/en_storage/'))).toBe(true)
  expect(() => createCardNegativeDemoState(number)).not.toThrow()
  expect(getCardPoolEntry(number)).toMatchObject({ cardNumber: number })
})
it('generic candidate preview rejects unknown numbers and keeps supported EXTRA in the EXTRA Deck before entry', () => {
  expect(() => createCardCheckDemoState('BS12-999')).toThrow(/找不到卡片編號/)
  const state = createCardCheckDemoState('BS12-018')
  expect(state.players['player-one'].extraDeck?.map(card => card.id)).toEqual(['BS12-018'])
  expect(state.players['player-one'].battleArea.some(entry => entry.card.id === 'BS12-018')).toBe(false)
  expect(state.players['player-one'].hand.map(card => card.id)).toEqual(['BS12-003'])
  expect(state.players['player-one'].breakArea.reduce((sum, card) => sum + (card.type === 'cookie' ? card.level : 0), 0)).toBe(4)
})

import { describe, expect, it } from 'vitest'
import { selectStarterSeriesCards } from './starter-series-candidates.mjs'

const seriesCards = series => Array.from({length:20},(_,index)=>({card_no:`ST${series}-${String(index+1).padStart(3,'0')}`}))
describe('ST6-ST10 candidate isolation',()=>{
  it.each([6,7,8,9,10])('selects the complete ST%s source without other series',series=>{
    const cards=seriesCards(series)
    expect(selectStarterSeriesCards([...cards,{card_no:'BS12-001'},{card_no:'ST1-001'}],series)).toEqual(cards)
  })
  it('rejects an incomplete set instead of writing a partial candidate',()=>{
    expect(()=>selectStarterSeriesCards(seriesCards(6).slice(1),6)).toThrow('Incomplete')
  })
  it('rejects duplicate printings even when the total count is 20',()=>{
    const cards=seriesCards(10);cards[19]=cards[0]
    expect(()=>selectStarterSeriesCards(cards,10)).toThrow('duplicate')
  })
  it('rejects unknown series and missing source arrays',()=>{
    expect(()=>selectStarterSeriesCards([],11)).toThrow('outside')
    expect(()=>selectStarterSeriesCards(null,6)).toThrow('cardList')
  })
})

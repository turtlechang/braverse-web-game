/** Require each expected base printing exactly once; never accept a partial set. */
export const selectStarterSeriesCards = (rawCards, series) => {
  if (!Array.isArray(rawCards)) throw new Error('Missing official cardList')
  if (![6, 7, 8, 9, 10].includes(series)) throw new Error('Series outside ST6-ST10')
  const selected = rawCards.filter(card => new RegExp(`^ST${series}-`).test(card.card_no))
  const expected = Array.from({length: 20}, (_, index) => `ST${series}-${String(index+1).padStart(3,'0')}`)
  const numbers = selected.map(card => card.card_no)
  if (numbers.length !== expected.length || expected.some(number => numbers.filter(value => value === number).length !== 1)) {
    throw new Error(`Incomplete or duplicate ST${series} printings`)
  }
  return selected
}

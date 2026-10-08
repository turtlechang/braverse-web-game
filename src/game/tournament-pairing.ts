interface OpponentHistory {
  deck: { id: string }
  points: number
  opponents: Set<string>
}

/** Repair greedy rematches with the least score-distance two-table exchange. */
export const avoidRepeatedPairings = <T extends OpponentHistory>(input: Array<[T, T]>): Array<[T, T]> => {
  const pairs = input.map(([left, right]): [T, T] => [left, right])
  const repeated = (left: T, right: T) => left.opponents.has(right.deck.id) || right.opponents.has(left.deck.id)
  for (let i = 0; i < pairs.length; i++) {
    const [left, right] = pairs[i]
    if (!repeated(left, right)) continue
    let best: { index: number; first: [T, T]; second: [T, T]; distance: number } | undefined
    for (let j = 0; j < pairs.length; j++) {
      if (i === j) continue
      const [a, b] = pairs[j]
      for (const [c, d] of [[a, b], [b, a]]) {
        if (repeated(left, c) || repeated(right, d)) continue
        const distance = Math.abs(left.points - c.points) + Math.abs(right.points - d.points)
        if (!best || distance < best.distance) best = { index: j, first: [left, c], second: [right, d], distance }
      }
    }
    if (!best) throw new Error('Cannot avoid a Swiss rematch with a two-table exchange; expand pairing search before continuing.')
    pairs[i] = best.first
    pairs[best.index] = best.second
  }
  return pairs
}

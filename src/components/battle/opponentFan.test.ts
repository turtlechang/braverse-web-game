import { describe, expect, it } from 'vitest'
import { computeOpponentFan } from './opponentFan'

describe('computeOpponentFan', () => {
  it('uses a shallow, centered overlap for opponent card backs', () => {
    const firstCard = computeOpponentFan(3, 0)
    const centerCard = computeOpponentFan(3, 1)
    const lastCard = computeOpponentFan(3, 2)

    expect(firstCard.arcSpan).toBe(8)
    expect(firstCard.opponentAngle).toBe(-4)
    expect(firstCard.opponentX).toBe(-96)
    expect(centerCard.opponentX).toBe(0)
    expect(lastCard.opponentAngle).toBe(4)
    expect(lastCard.opponentX).toBe(96)
  })
})

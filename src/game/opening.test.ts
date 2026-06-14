import { describe, expect, it } from 'vitest'
import { chooseRandomDeck } from '.'

describe('opening deck selection', () => {
  it.each([
    [0, 'red'],
    [0.34, 'yellow'],
    [0.99, 'green'],
  ] as const)('maps random value %s to %s deck', (randomValue, expected) => {
    expect(chooseRandomDeck(() => randomValue)).toBe(expected)
  })

  it('clamps an injected random value at the upper boundary', () => {
    expect(chooseRandomDeck(() => 1)).toBe('green')
  })
})

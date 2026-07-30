import { describe, expect, it } from 'vitest'
import { parseOfficialCardText } from './official-text-parser'

describe('official marker display labels', () => {
  it('recognizes Equip and Your Turn markers', () => {
    expect(parseOfficialCardText('{mou} {mt} Skill')).toMatchObject({
      markers: ['mou', 'mt'],
      displayText: '[Equip] [Your Turn] Skill',
    })
  })
})

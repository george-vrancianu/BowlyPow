import { describe, expect, it } from 'vitest'
import { modePicker } from './screens'

describe('mode picker', () => {
  it('marks only the chosen mode as pressed and picks on click', () => {
    const picked: string[] = []
    const row = modePicker('siege', (m) => picked.push(m))
    expect(row.map((b) => [b.label, b.pressed])).toEqual([['Siege', true], ['Rounds', false]])
    row[1]!.onClick()
    expect(picked).toEqual(['rounds'])
  })
})

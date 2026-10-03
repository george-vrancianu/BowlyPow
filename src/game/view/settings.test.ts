import { describe, expect, it } from 'vitest'
import { defaultSettings, modePicker, sliderRows } from './settings'

describe('mode picker', () => {
  it('marks only the chosen mode as pressed and picks on click', () => {
    const picked: string[] = []
    const row = modePicker('siege', (m) => picked.push(m))
    expect(row.map((b) => [b.label, b.pressed])).toEqual([['Siege', true], ['Rounds', false]])
    row[1]!.onClick()
    expect(picked).toEqual(['rounds'])
  })
})

describe('slider rows', () => {
  it('lists only the sliders the mode uses, with their current values', () => {
    const siege = sliderRows({ ...defaultSettings, mode: 'siege', shots: 2 })
    expect(siege.map((r) => r.key)).not.toContain('rounds')
    expect(siege.find((r) => r.key === 'shots')!.value).toBe(2)
    expect(sliderRows({ ...defaultSettings, mode: 'rounds' }).map((r) => r.key)).toContain('rounds')
  })
  it('names the Credits slider for Rounds and keeps wall points in Siege', () => {
    const label = (mode: 'rounds' | 'siege') => sliderRows({ ...defaultSettings, mode }).find((r) => r.key === 'credits')!.label
    expect(label('rounds')).toBe('Credits per round')
    expect(label('siege')).toBe('Wall points')
  })
})

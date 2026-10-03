import { expect, it } from 'vitest'

const sources = import.meta.glob<string>(['./**/*.{ts,tsx}', '!./**/*.test.*'], { query: '?raw', import: 'default', eager: true })

it('keeps src/ui independent of src/sim', () => {
  expect(Object.keys(sources).length).toBeGreaterThan(0)
  const offenders = Object.entries(sources).filter(([, src]) => /from\s+['"][^'"]*\/sim\//.test(src)).map(([file]) => file)
  expect(offenders).toEqual([])
})

import { describe, expect, it } from 'vitest'
import { decodeSignal, encodeSignal, wireChannel, type ChannelLike } from './peer'

function pair(): [ChannelLike, ChannelLike] {
  const mk = (): ChannelLike => ({ send() {}, close() {}, onopen: null, onclose: null, onmessage: null })
  const a = mk()
  const b = mk()
  a.send = (d) => b.onmessage?.({ data: d })
  b.send = (d) => a.onmessage?.({ data: d })
  return [a, b]
}

describe('signal string', () => {
  it('round-trips a session description', () => {
    const d = { type: 'offer' as const, sdp: 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n' }
    expect(decodeSignal(encodeSignal(d))).toEqual(d)
  })
  it('rejects garbage', () => {
    expect(() => decodeSignal('not a code')).toThrow()
  })
})

describe('wireChannel', () => {
  it('reports connected on open and disconnected on close', () => {
    const [a] = pair()
    const seen: string[] = []
    wireChannel(a, (s) => seen.push(s))
    a.onopen?.()
    a.onclose?.()
    expect(seen).toEqual(['connected', 'disconnected'])
  })

  it('round-trips a ping', async () => {
    const [a, b] = pair()
    const peerA = wireChannel(a, () => {})
    wireChannel(b, () => {})
    expect(await peerA.ping()).toBeGreaterThanOrEqual(0)
  })
})

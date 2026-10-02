export type Status = 'connected' | 'disconnected'

/** The slice of RTCDataChannel we use, so tests can fake it. */
export type ChannelLike = {
  send(data: string): void
  close(): void
  onopen: (() => void) | null
  onclose: (() => void) | null
  onmessage: ((e: { data: string }) => void) | null
}

export type Peer = { ping(): Promise<number>; close(): void }

type Desc = { type: 'offer' | 'answer'; sdp: string }

/** Connection string: the session description as base64 JSON, pasted between players. */
export const encodeSignal = (d: Desc) => btoa(JSON.stringify(d))

export function decodeSignal(s: string): Desc {
  const d = JSON.parse(atob(s.trim()))
  if ((d?.type !== 'offer' && d?.type !== 'answer') || typeof d.sdp !== 'string') throw new Error('bad connection string')
  return d
}

/** Answers pings, resolves our own with the round-trip ms, and reports open/close. */
export function wireChannel(ch: ChannelLike, onStatus: (s: Status) => void): Peer {
  const pending = new Map<number, (ms: number) => void>()
  let n = 0
  ch.onopen = () => onStatus('connected')
  ch.onclose = () => onStatus('disconnected')
  ch.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.type === 'ping') ch.send(JSON.stringify({ type: 'pong', id: m.id, t: m.t }))
    else if (m.type === 'pong') pending.get(m.id)?.(performance.now() - m.t)
  }
  return {
    ping: () =>
      new Promise((resolve) => {
        const id = n++
        pending.set(id, resolve)
        ch.send(JSON.stringify({ type: 'ping', id, t: performance.now() }))
      }),
    close: () => ch.close(),
  }
}

const wireRtc = (ch: RTCDataChannel, onStatus: (s: Status) => void) => {
  const peer = wireChannel(ch as unknown as ChannelLike, onStatus)
  if (ch.readyState === 'open') onStatus('connected')
  return peer
}

const newPc = () => new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })

/** Wait for ICE gathering so the description carries all candidates, then encode it. */
async function localCode(pc: RTCPeerConnection) {
  if (pc.iceGatheringState !== 'complete')
    await new Promise<void>((resolve) => {
      pc.onicegatheringstatechange = () => pc.iceGatheringState === 'complete' && resolve()
    })
  return encodeSignal(pc.localDescription as Desc)
}

/** Host: returns the offer string to share, and `accept(answer)` once the guest replies. */
export async function host(onStatus: (s: Status) => void) {
  const pc = newPc()
  const peer = wireRtc(pc.createDataChannel('game'), onStatus)
  await pc.setLocalDescription(await pc.createOffer())
  return {
    offer: await localCode(pc),
    peer,
    accept: (answer: string) => pc.setRemoteDescription(decodeSignal(answer)),
  }
}

/** Guest: takes the host's offer, returns the answer string to send back. */
export async function join(offer: string, onStatus: (s: Status) => void) {
  const pc = newPc()
  let peer: Peer | undefined
  pc.ondatachannel = (e) => (peer = wireRtc(e.channel, onStatus))
  await pc.setRemoteDescription(decodeSignal(offer))
  await pc.setLocalDescription(await pc.createAnswer())
  return { answer: await localCode(pc), getPeer: () => peer }
}

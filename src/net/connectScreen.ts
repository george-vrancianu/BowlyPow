import { host, join, type Peer, type Status } from './peer'

/** Overlay for the copy/paste flow: host shares an offer, guest returns an answer. */
export function showConnectScreen() {
  const el = document.createElement('div')
  el.style.cssText =
    'position:fixed;inset:0;display:flex;flex-direction:column;gap:8px;padding:16px;box-sizing:border-box;background:#0b0f1a;color:#fff;font:16px sans-serif;z-index:1'
  el.innerHTML = `
    <button id="host">Host a game</button>
    <button id="join">Join a game</button>
    <p id="msg">Host creates a code and sends it to the guest; the guest sends a reply code back.</p>
    <textarea id="code" rows="6" placeholder="Paste connection code here" style="width:100%"></textarea>
    <button id="go" hidden></button>
    <button id="ping" hidden>Ping</button>`
  document.body.append(el)
  const $ = <T extends HTMLElement>(id: string) => el.querySelector<T>('#' + id)!
  const msg = $('msg'), code = $<HTMLTextAreaElement>('code'), go = $('go'), pingBtn = $('ping')
  let getPeer: () => Peer | undefined = () => undefined

  const onStatus = (s: Status) => {
    msg.textContent = s
    pingBtn.hidden = s !== 'connected'
  }
  const fail = (e: unknown) => (msg.textContent = String(e))
  pingBtn.onclick = async () => (msg.textContent = `connected, ping ${Math.round(await getPeer()!.ping())} ms`)

  $('host').onclick = async () => {
    msg.textContent = 'Creating code...'
    try {
      const h = await host(onStatus)
      getPeer = () => h.peer
      code.value = h.offer
      msg.textContent = 'Send this code to the guest, then paste their reply below and press Connect.'
      go.hidden = false
      go.textContent = 'Connect'
      go.onclick = () => h.accept(code.value).catch(fail)
    } catch (e) {
      fail(e)
    }
  }
  $('join').onclick = () => {
    code.value = ''
    msg.textContent = 'Paste the host code, then press Join.'
    go.hidden = false
    go.textContent = 'Join'
    go.onclick = async () => {
      try {
        const g = await join(code.value, onStatus)
        getPeer = g.getPeer
        code.value = g.answer
        msg.textContent = 'Send this reply code back to the host.'
      } catch (e) {
        fail(e)
      }
    }
  }
}

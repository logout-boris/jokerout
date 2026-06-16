import QRCode from 'qrcode'
import './style.css'

const app = document.querySelector('#app')

const STORAGE = {
  profile: 'joqr.player.profile',
  leaderboard: 'joqr.local.leaderboard',
  claimed: 'joqr.player.claimedTokens',
  qrBaseUrl: 'joqr.kiosk.qrBaseUrl',
}

const DIFFICULTIES = {
  easy: { label: 'Easy', ttlMs: 7000, minMs: 1800, maxMs: 5000 },
  normal: { label: 'Normal', ttlMs: 5000, minMs: 1200, maxMs: 3500 },
  hard: { label: 'Hard', ttlMs: 3500, minMs: 800, maxMs: 2400 },
  insane: { label: 'Insane', ttlMs: 2200, minMs: 500, maxMs: 1400 },
}

const MESSAGES = [
  { text: 'Mega ulov', base: 50 },
  { text: 'Turbo combo', base: 70 },
  { text: 'Joker bonus', base: 85 },
  { text: 'Lucky shot', base: 45 },
  { text: 'Flash pick', base: 60 },
]

const GOOD_VIBES = [
  'Ujet v trenutek.',
  'Ne snemam. Dozivljam.',
  'Ta komad ostane v glavi, ne v storiju.',
  'Danes sem tukaj.',
  'IRL Fan Club.',
  'Koncertni nacin aktiviran.',
  'Notifications Off. Music On.',
]

const DWARVES = [
  '  /\\_/\\\n ( o.o )\n /|_|_\\\n  / \\',
  '  .-"""-.\n / 0 0  \\\n |  ^   |\n | \'-\'  |\n /|_|_|\\',
  '   __\n _|==|_\n(/ . . \\)\n \\  -  /\n /|___|\\',
]

let duelRunNonce = 0
let currentDuel = null
let soloRunNonce = 0
let currentSoloRound = null
let soloVisualState = { size: 260, hue: 0 }
let soloMoveTimer = null
let soloRoundExpiryTimer = null
let soloNextRoundTimer = null
let soloGameTicker = null
let soloSkinIndex = 0
let soloGameState = {
  active: false,
  durationMs: 30000,
  endsAt: 0,
  rounds: 0,
}

function parseRoute() {
  const hash = window.location.hash || '#/'
  const [pathPart, queryString = ''] = hash.slice(1).split('?')
  const path = pathPart || '/'
  const params = new URLSearchParams(queryString)
  return { path, params }
}

function navigate(path) {
  window.location.hash = path
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function getDefaultBaseUrl() {
  return `${window.location.origin}${window.location.pathname}`
}

function normalizeBaseUrl(raw) {
  if (!raw) return null
  try {
    const url = new URL(raw.trim())
    if (!/^https?:$/.test(url.protocol)) return null
    const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/$/, '') : url.pathname
    return `${url.origin}${pathname}`
  } catch {
    return null
  }
}

function getQrBaseUrl() {
  const saved = readJSON(STORAGE.qrBaseUrl, '')
  const normalized = normalizeBaseUrl(saved)
  return normalized || getDefaultBaseUrl()
}

function setQrBaseUrl(raw) {
  const normalized = normalizeBaseUrl(raw)
  if (!normalized) return false
  saveJSON(STORAGE.qrBaseUrl, normalized)
  return true
}

function clearSoloTimers() {
  stopSoloMovement()
  if (soloRoundExpiryTimer) {
    clearTimeout(soloRoundExpiryTimer)
    soloRoundExpiryTimer = null
  }
  if (soloNextRoundTimer) {
    clearTimeout(soloNextRoundTimer)
    soloNextRoundTimer = null
  }
  if (soloGameTicker) {
    clearInterval(soloGameTicker)
    soloGameTicker = null
  }
}

function updateSoloHud() {
  const timerEl = document.querySelector('#solo-timer')
  const roundsEl = document.querySelector('#solo-rounds')
  const remainMs = Math.max(0, soloGameState.endsAt - Date.now())
  if (timerEl) timerEl.textContent = `${(remainMs / 1000).toFixed(1)} s`
  if (roundsEl) roundsEl.textContent = `${soloGameState.rounds}`
}

function renderSoloGameOver() {
  const panel = document.querySelector('#solo-result')
  if (!panel) return
  panel.classList.remove('hidden')
  panel.innerHTML = `
    <h3>Game over</h3>
    <p>Zakljucene runde: <strong>${soloGameState.rounds}</strong></p>
    <p>Na telefonu vidis svoje osebne tocke in uspehe.</p>
  `
}

function finishSoloGame() {
  if (!soloGameState.active) return
  soloGameState.active = false
  currentSoloRound = null
  clearSoloTimers()
  updateSoloHud()
  const hint = document.querySelector('#hint')
  if (hint) hint.textContent = 'Runda je koncana. Klikni "Start game 30s" za novo igro.'
  renderSoloGameOver()
}

function startSoloGame() {
  clearSoloTimers()
  soloRunNonce += 1
  currentSoloRound = null
  soloVisualState = { size: 260, hue: 0 }
  soloGameState = {
    active: true,
    durationMs: 30000,
    endsAt: Date.now() + 30000,
    rounds: 0,
  }
  const result = document.querySelector('#solo-result')
  if (result) {
    result.classList.add('hidden')
    result.innerHTML = ''
  }
  updateSoloHud()
  soloGameTicker = setInterval(() => {
    if (!soloGameState.active) return
    updateSoloHud()
    if (Date.now() >= soloGameState.endsAt) {
      finishSoloGame()
    }
  }, 100)
  startSoloRound()
}

function hslToHex(h, s, l) {
  const sat = s / 100
  const light = l / 100
  const k = (n) => (n + h / 30) % 12
  const a = sat * Math.min(light, 1 - light)
  const f = (n) => {
    const color = light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function getPlayerProfile() {
  const existing = readJSON(STORAGE.profile, null)
  if (existing?.id) return existing
  const profile = {
    id: crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: '',
    createdAt: Date.now(),
  }
  saveJSON(STORAGE.profile, profile)
  return profile
}

function setPlayerName(name) {
  const profile = getPlayerProfile()
  profile.name = name.trim().slice(0, 24)
  saveJSON(STORAGE.profile, profile)
}

function getClaimedSet() {
  const values = readJSON(STORAGE.claimed, [])
  return new Set(Array.isArray(values) ? values : [])
}

function addClaimedToken(tokenId) {
  const set = getClaimedSet()
  set.add(tokenId)
  saveJSON(STORAGE.claimed, [...set].slice(-300))
}

function addScoreEntry(entry) {
  const board = readJSON(STORAGE.leaderboard, [])
  board.push(entry)
  board.sort((a, b) => b.points - a.points || a.reactionMs - b.reactionMs)
  saveJSON(STORAGE.leaderboard, board.slice(0, 20))
}

function getLeaderboardRows() {
  return readJSON(STORAGE.leaderboard, [])
}

function encodePayload(data) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))))
}

function decodePayload(payload) {
  return JSON.parse(decodeURIComponent(escape(atob(payload))))
}

function computePoints(payload, reactionMs) {
  const mode = DIFFICULTIES[payload.mode] || DIFFICULTIES.normal
  const clamped = Math.max(mode.minMs, Math.min(mode.maxMs, reactionMs))
  const ratio = 1 - (clamped - mode.minMs) / (mode.maxMs - mode.minMs)
  const speedBonus = Math.round(ratio * 75)
  return Math.max(1, payload.base + speedBonus)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function generateCode(seed, digits = 5) {
  let hash = 7
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 1000000007
  }
  const mod = 10 ** digits
  return String(Math.abs(hash) % mod).padStart(digits, '0')
}

function createDuel(mode) {
  const duelId = crypto.randomUUID ? crypto.randomUUID() : `duel-${Date.now()}`
  const slotAJoinToken = crypto.randomUUID ? crypto.randomUUID() : `a-${Date.now()}`
  const slotBJoinToken = crypto.randomUUID ? crypto.randomUUID() : `b-${Date.now()}`

  return {
    id: duelId,
    mode,
    slots: {
      A: {
        joinToken: slotAJoinToken,
        joinCode: generateCode(`${duelId}:A:${slotAJoinToken}`),
        present: false,
      },
      B: {
        joinToken: slotBJoinToken,
        joinCode: generateCode(`${duelId}:B:${slotBJoinToken}`),
        present: false,
      },
    },
  }
}

function renderHome() {
  const profile = getPlayerProfile()
  app.innerHTML = `
    <main class="page">
      <section class="card hero">
        <p class="tag">JokerOut QR Rush</p>
        <h1>Solo QR Rush (static hosting)</h1>
        <p>En igralec skenira gibajoco QR kodo. Po ulovu je koda manjsa in druge barve.</p>
        <div class="actions">
          <button id="go-kiosk" class="btn primary">Odpri solo kiosk</button>
          <button id="go-player" class="btn">Player profil</button>
        </div>
      </section>

      <section class="card">
        <h2>Tvoj telefon</h2>
        <p><strong>ID:</strong> <code>${profile.id}</code></p>
        <label class="inline-label">Ime igralca</label>
        <div class="inline-form">
          <input id="player-name" type="text" maxlength="24" placeholder="npr. Luka" value="${profile.name || ''}" />
          <button id="save-name" class="btn">Shrani</button>
        </div>
        <p class="muted">Brez backenda je ID lokalni (reset ob brisanju browser podatkov).</p>
      </section>
    </main>
  `

  document.querySelector('#go-kiosk')?.addEventListener('click', () => navigate('/solo-kiosk'))
  document.querySelector('#go-player')?.addEventListener('click', () => navigate('/player'))
  document.querySelector('#save-name')?.addEventListener('click', () => {
    const input = document.querySelector('#player-name')
    setPlayerName(input.value)
    render()
  })
}

async function renderSoloKiosk() {
  const baseUrl = getQrBaseUrl()
  app.innerHTML = `
    <main class="page">
      <section class="card">
        <div class="row-between">
          <h1>Solo kiosk</h1>
          <button id="go-home" class="btn">Domov</button>
        </div>
        <div class="inline-form">
          <label for="difficulty">Stopnja</label>
          <select id="difficulty">
            <option value="easy">Easy</option>
            <option value="normal" selected>Normal</option>
            <option value="hard">Hard</option>
            <option value="insane">Insane</option>
          </select>
          <button id="start-game" class="btn primary">Start game 30s</button>
          <button id="start-round" class="btn">Nova runda</button>
        </div>
        <div class="hud">
          <p>Cas: <strong id="solo-timer">0.0 s</strong></p>
          <p>Runde: <strong id="solo-rounds">0</strong></p>
        </div>
        <div class="inline-form">
          <label for="qr-base-url">QR Base URL</label>
          <input id="qr-base-url" value="${baseUrl}" placeholder="http://192.168.x.x:5173" />
          <button id="save-base-url" class="btn">Shrani URL</button>
        </div>
        <p class="small">Kiosk mora biti odprt na istem URL, ki je nastavljen tukaj.</p>
        <p class="muted" id="meta">Skeniraj gibajoco QR kodo. Brez tipkanja kod - samo ulovi in uzivaj.</p>
        <p class="countdown" id="countdown"></p>
        <pre id="ascii-dwarf" class="ascii-dwarf"></pre>
        <div id="solo-stage" class="solo-stage">
          <div id="solo-burst" class="solo-burst"></div>
          <div id="solo-qr-node" class="monster-frame hidden">
            <img id="solo-qr" alt="Solo round QR" />
          </div>
        </div>
        <p class="small" id="hint"></p>
        <section id="solo-result" class="card-sub hidden"></section>
      </section>
    </main>
  `

  document.querySelector('#go-home')?.addEventListener('click', () => navigate('/'))
  document.querySelector('#start-game')?.addEventListener('click', () => startSoloGame())
  document.querySelector('#start-round')?.addEventListener('click', () => startSoloRound())
  document.querySelector('#save-base-url')?.addEventListener('click', async () => {
    const input = document.querySelector('#qr-base-url')
    const ok = setQrBaseUrl(input?.value || '')
    const meta = document.querySelector('#meta')
    if (!ok) {
      if (meta) meta.textContent = 'Neveljaven URL. Primer: http://192.168.64.101:5173'
      return
    }
    if (meta) meta.textContent = 'QR Base URL shranjen.'
    await startSoloRound()
  })
  updateSoloHud()
}

function stopSoloMovement() {
  if (soloMoveTimer) {
    clearInterval(soloMoveTimer)
    soloMoveTimer = null
  }
}

function startSoloMovement() {
  stopSoloMovement()
  const stage = document.querySelector('#solo-stage')
  const qrNode = document.querySelector('#solo-qr-node')
  if (!stage || !qrNode) return

  let x = 20
  let y = 20
  let vx = 2.8
  let vy = 2.2

  soloMoveTimer = setInterval(() => {
    const stageRect = stage.getBoundingClientRect()
    const qrRect = qrNode.getBoundingClientRect()
    const maxX = Math.max(0, stageRect.width - qrRect.width)
    const maxY = Math.max(0, stageRect.height - qrRect.height)

    x += vx
    y += vy

    if (x <= 0 || x >= maxX) {
      vx *= -1
      x = Math.max(0, Math.min(x, maxX))
    }
    if (y <= 0 || y >= maxY) {
      vy *= -1
      y = Math.max(0, Math.min(y, maxY))
    }

    qrNode.style.left = `${Math.round(x)}px`
    qrNode.style.top = `${Math.round(y)}px`
  }, 20)
}

function applySoloQrVisual() {
  const qr = document.querySelector('#solo-qr')
  const qrNode = document.querySelector('#solo-qr-node')
  if (!qr) return
  qr.style.width = `${soloVisualState.size}px`
  qr.style.filter = `hue-rotate(${soloVisualState.hue}deg)`
  if (qrNode) {
    qrNode.setAttribute('data-skin', `${soloSkinIndex}`)
    qrNode.style.setProperty('--skin-hue', `${soloVisualState.hue}deg`)
  }
}

function triggerSoloBurst() {
  const burst = document.querySelector('#solo-burst')
  if (!burst) return
  burst.classList.remove('pulse')
  void burst.offsetWidth
  burst.classList.add('pulse')
}

async function startSoloRound() {
  if (soloGameState.active && Date.now() >= soloGameState.endsAt) {
    finishSoloGame()
    return
  }
  const runId = ++soloRunNonce
  const countEl = document.querySelector('#countdown')
  const asciiEl = document.querySelector('#ascii-dwarf')
  const qr = document.querySelector('#solo-qr')
  const qrNode = document.querySelector('#solo-qr-node')
  const hint = document.querySelector('#hint')
  if (qr) qr.removeAttribute('src')
  if (qrNode) qrNode.classList.add('hidden')
  stopSoloMovement()
  if (hint) hint.textContent = 'Pripravi telefon...'
  for (let left = 3; left >= 1; left -= 1) {
    if (runId !== soloRunNonce) return
    if (countEl) countEl.textContent = `Runda se zacne cez ${left} ...`
    if (asciiEl) asciiEl.textContent = DWARVES[Math.floor(Math.random() * DWARVES.length)]
    await sleep(1000)
  }
  if (runId !== soloRunNonce) return
  triggerSoloBurst()
  if (countEl) countEl.textContent = 'GO!'
  await generateSoloToken(runId)
}

async function generateSoloToken(runId) {
  if (runId !== soloRunNonce) return
  const select = document.querySelector('#difficulty')
  const mode = select?.value || 'normal'
  const config = DIFFICULTIES[mode] || DIFFICULTIES.normal
  const message = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]
  const now = Date.now()
  const tokenId = crypto.randomUUID ? crypto.randomUUID() : `token-${now}`
  const base = getQrBaseUrl()

  const payload = {
    type: 'solo-round',
    tokenId,
    text: message.text,
    base: message.base,
    mode,
    createdAt: now,
    expiresAt: now + config.ttlMs,
  }

  currentSoloRound = payload
  soloSkinIndex = (soloSkinIndex + 1) % 3
  const claimUrl = `${base}#/claim?payload=${encodeURIComponent(encodePayload(payload))}`
  const qrDataUrl = await QRCode.toDataURL(claimUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 420,
    color: {
      dark: hslToHex(soloVisualState.hue, 90, 35),
      light: '#ffffff',
    },
  })

  const qr = document.querySelector('#solo-qr')
  const qrNode = document.querySelector('#solo-qr-node')
  const meta = document.querySelector('#meta')
  const countEl = document.querySelector('#countdown')
  const asciiEl = document.querySelector('#ascii-dwarf')
  const hint = document.querySelector('#hint')
  if (qr) qr.src = qrDataUrl
  if (qrNode) qrNode.classList.remove('hidden')
  if (meta) meta.textContent = `${config.label} | ${message.text} | Veljavnost: ${Math.round(config.ttlMs / 1000)} s`
  if (hint) hint.textContent = 'Skeniraj QR in na telefonu prejmi zabavno sporocilo.'
  if (countEl) countEl.textContent = ''
  if (asciiEl) asciiEl.textContent = ''
  applySoloQrVisual()
  startSoloMovement()
  if (soloGameState.active) {
    soloGameState.rounds += 1
    updateSoloHud()
  }

  if (soloRoundExpiryTimer) clearTimeout(soloRoundExpiryTimer)
  soloRoundExpiryTimer = setTimeout(() => {
    if (!currentSoloRound || currentSoloRound.tokenId !== tokenId) return
    if (soloGameState.active && Date.now() >= soloGameState.endsAt) {
      finishSoloGame()
      return
    }
    const hintEl = document.querySelector('#hint')
    if (hintEl) hintEl.textContent = 'Menjava! Nova QR runda...'
    startSoloRound()
  }, config.ttlMs + 50)
}

async function renderDuelKiosk() {
  const baseUrl = getQrBaseUrl()
  app.innerHTML = `
    <main class="page">
      <section class="card">
        <div class="row-between">
          <h1>Duel kiosk</h1>
          <button id="go-home" class="btn">Domov</button>
        </div>
        <div class="inline-form">
          <label for="difficulty">Stopnja</label>
          <select id="difficulty">
            <option value="easy">Easy</option>
            <option value="normal" selected>Normal</option>
            <option value="hard">Hard</option>
            <option value="insane">Insane</option>
          </select>
          <button id="new-duel" class="btn">Nova prijava</button>
          <button id="start-round" class="btn primary" disabled>Zacni rundo</button>
        </div>
        <div class="inline-form">
          <label for="qr-base-url">QR Base URL</label>
          <input id="qr-base-url" value="${baseUrl}" placeholder="http://192.168.x.x:5173" />
          <button id="save-base-url" class="btn">Shrani URL</button>
        </div>
        <p class="small">Pomembno: odpri kiosk na istem URL, kot je nastavljen tukaj.</p>
        <p class="small">Duel: <code id="duel-id">-</code></p>
        <p class="muted" id="meta">1) Oba skenirata svoj JOIN QR. 2) Potrdita prisotnost. 3) Start round.</p>
        <div class="duel-columns">
          <div class="slot card-sub">
            <h3>Igralec A - JOIN</h3>
            <div class="qr-wrap mini"><img id="join-qr-a" alt="Join A" /></div>
            <div class="inline-form">
              <input id="presence-a" placeholder="Vnesi kodo A" maxlength="5" />
              <button id="verify-a" class="btn">Potrdi A</button>
            </div>
            <p class="small" id="status-a">Caka prijavo...</p>
          </div>
          <div class="slot card-sub">
            <h3>Igralec B - JOIN</h3>
            <div class="qr-wrap mini"><img id="join-qr-b" alt="Join B" /></div>
            <div class="inline-form">
              <input id="presence-b" placeholder="Vnesi kodo B" maxlength="5" />
              <button id="verify-b" class="btn">Potrdi B</button>
            </div>
            <p class="small" id="status-b">Caka prijavo...</p>
          </div>
        </div>
        <p class="countdown" id="countdown"></p>
        <pre id="ascii-dwarf" class="ascii-dwarf"></pre>
        <div class="duel-columns">
          <div class="slot card-sub">
            <h3>Igralec A - ROUND</h3>
            <div class="qr-wrap mini"><img id="round-qr-a" alt="Round A" /></div>
          </div>
          <div class="slot card-sub">
            <h3>Igralec B - ROUND</h3>
            <div class="qr-wrap mini"><img id="round-qr-b" alt="Round B" /></div>
          </div>
        </div>
        <p class="small" id="hint"></p>
      </section>
    </main>
  `

  document.querySelector('#go-home')?.addEventListener('click', () => navigate('/'))
  document.querySelector('#new-duel')?.addEventListener('click', () => createNewDuelSetup())
  document.querySelector('#verify-a')?.addEventListener('click', () => verifyPresence('A'))
  document.querySelector('#verify-b')?.addEventListener('click', () => verifyPresence('B'))
  document.querySelector('#start-round')?.addEventListener('click', () => startDuelRound())
  document.querySelector('#save-base-url')?.addEventListener('click', async () => {
    const input = document.querySelector('#qr-base-url')
    const ok = setQrBaseUrl(input?.value || '')
    const meta = document.querySelector('#meta')
    if (!ok) {
      if (meta) meta.textContent = 'Neveljaven URL. Uporabi npr. http://192.168.64.101:5173'
      return
    }
    if (meta) meta.textContent = 'QR Base URL shranjen. Generiram nove JOIN QR kode.'
    await renderJoinQrs()
  })
  await createNewDuelSetup()
}

async function createNewDuelSetup() {
  const select = document.querySelector('#difficulty')
  const mode = select?.value || 'normal'
  currentDuel = createDuel(mode)
  const duelLabel = document.querySelector('#duel-id')
  if (duelLabel) duelLabel.textContent = currentDuel.id
  const startBtn = document.querySelector('#start-round')
  if (startBtn) startBtn.disabled = true
  const hint = document.querySelector('#hint')
  if (hint) hint.textContent = 'Oba igralca naj skenirata JOIN QR. Nato vnesi potrditveni kodi.'
  const roundA = document.querySelector('#round-qr-a')
  const roundB = document.querySelector('#round-qr-b')
  if (roundA) roundA.removeAttribute('src')
  if (roundB) roundB.removeAttribute('src')
  const statusA = document.querySelector('#status-a')
  const statusB = document.querySelector('#status-b')
  if (statusA) statusA.textContent = 'Caka prijavo...'
  if (statusB) statusB.textContent = 'Caka prijavo...'
  await renderJoinQrs()
}

async function renderJoinQrs() {
  if (!currentDuel) return
  const base = getQrBaseUrl()
  const payloadA = encodePayload({
    type: 'join',
    duelId: currentDuel.id,
    slot: 'A',
    joinToken: currentDuel.slots.A.joinToken,
  })
  const payloadB = encodePayload({
    type: 'join',
    duelId: currentDuel.id,
    slot: 'B',
    joinToken: currentDuel.slots.B.joinToken,
  })
  const urlA = `${base}#/join?payload=${encodeURIComponent(payloadA)}`
  const urlB = `${base}#/join?payload=${encodeURIComponent(payloadB)}`
  const qrA = await QRCode.toDataURL(urlA, { width: 360, margin: 1 })
  const qrB = await QRCode.toDataURL(urlB, { width: 360, margin: 1 })
  const imgA = document.querySelector('#join-qr-a')
  const imgB = document.querySelector('#join-qr-b')
  if (imgA) imgA.src = qrA
  if (imgB) imgB.src = qrB
}

function verifyPresence(slot) {
  if (!currentDuel) return
  const input = document.querySelector(slot === 'A' ? '#presence-a' : '#presence-b')
  const status = document.querySelector(slot === 'A' ? '#status-a' : '#status-b')
  const entered = String(input?.value || '').trim()
  const expected = currentDuel.slots[slot].joinCode

  if (entered === expected) {
    currentDuel.slots[slot].present = true
    if (status) status.textContent = `Prisotnost potrjena (${entered})`
  } else {
    currentDuel.slots[slot].present = false
    if (status) status.textContent = 'Napačna koda, poskusi znova.'
  }

  const startBtn = document.querySelector('#start-round')
  if (startBtn) {
    startBtn.disabled = !(currentDuel.slots.A.present && currentDuel.slots.B.present)
  }
}

async function startDuelRound() {
  if (!currentDuel || !currentDuel.slots.A.present || !currentDuel.slots.B.present) return
  const runId = ++duelRunNonce
  const countEl = document.querySelector('#countdown')
  const asciiEl = document.querySelector('#ascii-dwarf')
  const qrA = document.querySelector('#round-qr-a')
  const qrB = document.querySelector('#round-qr-b')
  const hint = document.querySelector('#hint')
  if (qrA) qrA.removeAttribute('src')
  if (qrB) qrB.removeAttribute('src')
  if (hint) hint.textContent = 'Pripravi telefon...'
  for (let left = 3; left >= 1; left -= 1) {
    if (runId !== duelRunNonce) return
    if (countEl) countEl.textContent = `Runda se zacne cez ${left} ...`
    if (asciiEl) asciiEl.textContent = DWARVES[Math.floor(Math.random() * DWARVES.length)]
    await sleep(1000)
  }
  if (runId !== duelRunNonce) return
  if (countEl) countEl.textContent = 'GO!'
  await generateRoundTokens(runId)
}

async function generateRoundTokens(runId) {
  if (!currentDuel || runId !== duelRunNonce) return
  const select = document.querySelector('#difficulty')
  const mode = select.value
  const config = DIFFICULTIES[mode] || DIFFICULTIES.normal
  const message = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]
  const now = Date.now()
  const base = getQrBaseUrl()

  const payloadA = {
    type: 'round',
    duelId: currentDuel.id,
    slot: 'A',
    tokenId: crypto.randomUUID ? crypto.randomUUID() : `token-a-${now}`,
    text: message.text,
    base: message.base,
    mode,
    createdAt: now,
    expiresAt: now + config.ttlMs,
  }

  const payloadB = {
    type: 'round',
    duelId: currentDuel.id,
    slot: 'B',
    tokenId: crypto.randomUUID ? crypto.randomUUID() : `token-b-${now}`,
    text: message.text,
    base: message.base,
    mode,
    createdAt: now,
    expiresAt: now + config.ttlMs,
  }

  const claimA = `${base}#/claim?payload=${encodeURIComponent(encodePayload(payloadA))}`
  const claimB = `${base}#/claim?payload=${encodeURIComponent(encodePayload(payloadB))}`
  const qrDataUrlA = await QRCode.toDataURL(claimA, { errorCorrectionLevel: 'M', margin: 1, width: 420 })
  const qrDataUrlB = await QRCode.toDataURL(claimB, { errorCorrectionLevel: 'M', margin: 1, width: 420 })

  const imgA = document.querySelector('#round-qr-a')
  const imgB = document.querySelector('#round-qr-b')
  const meta = document.querySelector('#meta')
  const countEl = document.querySelector('#countdown')
  const asciiEl = document.querySelector('#ascii-dwarf')
  const hint = document.querySelector('#hint')
  if (imgA) imgA.src = qrDataUrlA
  if (imgB) imgB.src = qrDataUrlB
  meta.textContent = `${config.label} | ${message.text} | Veljavnost: ${Math.round(config.ttlMs / 1000)} s`
  hint.textContent = 'Oba igralca hkrati skenirata svoj ROUND QR.'
  if (countEl) countEl.textContent = ''
  if (asciiEl) asciiEl.textContent = ''
}

function renderPlayer() {
  const profile = getPlayerProfile()
  const rows = getLeaderboardRows()
  const myRows = rows.filter((row) => row.playerId === profile.id)

  app.innerHTML = `
    <main class="page">
      <section class="card">
        <div class="row-between">
          <h1>Player profil</h1>
          <button id="go-home" class="btn">Domov</button>
        </div>
        <p><strong>ID:</strong> <code>${profile.id}</code></p>
        <p><strong>Ime:</strong> ${profile.name || 'Anon'}</p>
        <p><strong>Poskusov:</strong> ${myRows.length}</p>
      </section>

      <section class="card">
        <h2>Lokalna lestvica (ta naprava)</h2>
        ${rows.length === 0 ? '<p class="muted">Ni rezultatov.</p>' : `
          <ol class="board">
            ${rows
              .map((row) => `<li><span>${row.name} (${row.slot || '-'})</span><strong>${row.points} pts</strong><em>${row.reactionMs} ms</em></li>`)
              .join('')}
          </ol>
        `}
      </section>
    </main>
  `

  document.querySelector('#go-home')?.addEventListener('click', () => navigate('/'))
}

function renderClaim(params) {
  const payloadRaw = params.get('payload')
  if (!payloadRaw) {
    app.innerHTML = `
      <main class="page"><section class="card"><h1>Claim napaka</h1><p>Manjka payload.</p><button id="go-home" class="btn">Domov</button></section></main>
    `
    document.querySelector('#go-home')?.addEventListener('click', () => navigate('/'))
    return
  }

  let payload
  try {
    payload = decodePayload(payloadRaw)
  } catch {
    app.innerHTML = `
      <main class="page"><section class="card"><h1>Claim napaka</h1><p>Payload ni veljaven.</p><button id="go-home" class="btn">Domov</button></section></main>
    `
    document.querySelector('#go-home')?.addEventListener('click', () => navigate('/'))
    return
  }

  const profile = getPlayerProfile()
  const now = Date.now()
  const claimed = getClaimedSet()
  const isExpired = now > payload.expiresAt
  const isDuplicate = claimed.has(payload.tokenId)

  let title = ''
  let status = ''
  let vibe = ''
  let points = 0

  if (isDuplicate) {
    title = 'Ta koda je ze ulovljena'
    status = 'Duplicate scan: 0 tock'
  } else if (isExpired) {
    title = 'Prepozno'
    status = 'QR je potekel: 0 tock'
  } else {
    const reactionMs = Math.max(0, now - payload.createdAt)
    points = computePoints(payload, reactionMs)
    addClaimedToken(payload.tokenId)
    addScoreEntry({
      tokenId: payload.tokenId,
      duelId: payload.duelId || 'unknown',
      slot: payload.slot || '-',
      name: profile.name || 'Anon',
      playerId: profile.id,
      points,
      reactionMs,
      text: payload.text,
      createdAt: now,
    })
    title = 'Ulov uspesen'
    status = `${points} tock | ${reactionMs} ms | ${payload.type === 'solo-round' ? 'Solo challenge' : `Slot ${payload.slot || '-'}`}`
    if (payload.type === 'solo-round') {
      vibe = GOOD_VIBES[Math.floor(Math.random() * GOOD_VIBES.length)]
      soloVisualState = {
        size: Math.max(110, soloVisualState.size - 24),
        hue: (soloVisualState.hue + 75) % 360,
      }
      triggerSoloBurst()
    }
  }

  app.innerHTML = `
    <main class="page">
      <section class="card">
        <h1>${title}</h1>
        <p>${status}</p>
        ${vibe ? `<p class="vibe">${vibe}</p>` : ''}
        <p class="muted">Sporocilo: ${payload.text || 'n/a'}</p>
        <div class="actions">
          <button id="go-player" class="btn primary">Moji rezultati</button>
          <button id="go-home" class="btn">Domov</button>
        </div>
      </section>
    </main>
  `

  document.querySelector('#go-home')?.addEventListener('click', () => navigate('/'))
  document.querySelector('#go-player')?.addEventListener('click', () => navigate('/player'))
}

function renderJoin(params) {
  const payloadRaw = params.get('payload')
  if (!payloadRaw) {
    app.innerHTML = `
      <main class="page"><section class="card"><h1>Join napaka</h1><p>Manjka payload.</p><button id="go-home" class="btn">Domov</button></section></main>
    `
    document.querySelector('#go-home')?.addEventListener('click', () => navigate('/'))
    return
  }

  let payload
  try {
    payload = decodePayload(payloadRaw)
  } catch {
    app.innerHTML = `
      <main class="page"><section class="card"><h1>Join napaka</h1><p>Payload ni veljaven.</p><button id="go-home" class="btn">Domov</button></section></main>
    `
    document.querySelector('#go-home')?.addEventListener('click', () => navigate('/'))
    return
  }

  const profile = getPlayerProfile()
  const code = generateCode(`${payload.duelId}:${payload.slot}:${payload.joinToken}`)
  app.innerHTML = `
    <main class="page">
      <section class="card">
        <h1>Join duel - Slot ${payload.slot || '-'}</h1>
        <p>Duel: <code>${payload.duelId || '-'}</code></p>
        <p>Igralec: <strong>${profile.name || 'Anon'}</strong></p>
        <p class="muted">Klikni potrditev in povej kodo organizatorju pri kiosku.</p>
        <div class="actions">
          <button id="confirm-join" class="btn primary">Potrdi prisotnost</button>
          <button id="go-home" class="btn">Domov</button>
        </div>
        <p id="join-code" class="join-code"></p>
      </section>
    </main>
  `
  document.querySelector('#go-home')?.addEventListener('click', () => navigate('/'))
  document.querySelector('#confirm-join')?.addEventListener('click', () => {
    const mount = document.querySelector('#join-code')
    if (mount) mount.textContent = `Potrditvena koda: ${code}`
  })
}

function render() {
  const { path, params } = parseRoute()
  if (path !== '/solo-kiosk') {
    clearSoloTimers()
    soloGameState.active = false
    currentSoloRound = null
  }
  if (path === '/solo-kiosk') {
    renderSoloKiosk()
    return
  }
  if (path === '/duel-kiosk') {
    renderDuelKiosk()
    return
  }
  if (path === '/join') {
    renderJoin(params)
    return
  }
  if (path === '/claim') {
    renderClaim(params)
    return
  }
  if (path === '/player') {
    renderPlayer()
    return
  }
  renderHome()
}

window.addEventListener('hashchange', render)
render()

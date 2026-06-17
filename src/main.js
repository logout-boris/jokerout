import QRCode from 'qrcode'
import { createClient } from '@supabase/supabase-js'
import './style.css'

const app = document.querySelector('#app')
const SUPABASE_URL = 'https://hezvtqurbxaxmvcrmuuu.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_QkiVaVk0SKwT4CrF0PF4aA_DjvdGbTi'
const ADMIN_RESET_PIN = '3030'
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

const STORAGE = {
  profile: 'joqr.player.profile',
  leaderboard: 'joqr.local.leaderboard',
  claimed: 'joqr.player.claimedTokens',
  qrBaseUrl: 'joqr.kiosk.qrBaseUrl',
  eventStats: 'joqr.kiosk.eventStats',
  eventTop20: 'joqr.kiosk.eventTop20',
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
let soloVisualState = { size: 190, hue: 0 }
let soloMoveTimer = null
let soloRoundExpiryTimer = null
let soloNextRoundTimer = null
let soloSkinIndex = 0
let kioskSessionId = ''
let kioskRealtimeChannel = null
let audioCtx = null
let audioUnlockBound = false
let soloGameState = {
  active: false,
  lives: 3,
  level: 1,
  catches: 0,
}

function getSoloRoundTtlMs(mode, roundIndex) {
  const config = DIFFICULTIES[mode] || DIFFICULTIES.normal
  const firstRoundMs = 15000
  const stepDownMs = 1200
  return Math.max(config.ttlMs, firstRoundMs - roundIndex * stepDownMs)
}

function getSoloMovementMultiplier(level, mode = 'normal') {
  const safeLevel = Math.max(1, Number(level) || 1)
  const curves = {
    easy: { step: 0.045, max: 1.42 },
    normal: { step: 0.065, max: 1.62 },
    hard: { step: 0.085, max: 1.82 },
    insane: { step: 0.1, max: 2.0 },
  }
  const curve = curves[mode] || curves.normal
  return Math.min(curve.max, 1 + (safeLevel - 1) * curve.step)
}

function isPhonePlayerDevice() {
  const ua = navigator.userAgent || ''
  const mobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)
  const touchNarrow = window.matchMedia('(max-width: 900px)').matches && navigator.maxTouchPoints > 0
  return mobileUa || touchNarrow
}

function createKioskSessionId() {
  return crypto.randomUUID ? crypto.randomUUID() : `kiosk-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function getSessionChannelName(sessionId) {
  return `kiosk-session-${sessionId}`
}

function ensureAudioContext() {
  if (audioCtx) return audioCtx
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  audioCtx = new Ctx()
  return audioCtx
}

async function unlockAudio() {
  const ctx = ensureAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      // Ignore and continue without sound.
    }
  }
}

function playBeep({ freq = 440, durationMs = 120, volume = 0.05, type = 'square' } = {}) {
  const ctx = ensureAudioContext()
  if (!ctx || ctx.state !== 'running') return
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, now)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + durationMs / 1000 + 0.02)
}

async function teardownKioskRealtime() {
  if (!kioskRealtimeChannel) return
  const current = kioskRealtimeChannel
  kioskRealtimeChannel = null
  try {
    await supabase.removeChannel(current)
  } catch {
    // Ignore teardown failures; next channel subscription can still proceed.
  }
}

async function waitForChannelSubscribed(channel, timeoutMs = 4000) {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Realtime subscribe timeout')), timeoutMs)
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout)
        resolve()
      }
      if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        clearTimeout(timeout)
        reject(new Error(`Realtime status: ${status}`))
      }
    })
  })
}

async function sendSessionEvent(sessionId, event, payload = {}) {
  if (!sessionId) return
  const channel = supabase.channel(getSessionChannelName(sessionId))
  try {
    await waitForChannelSubscribed(channel)
    await channel.send({
      type: 'broadcast',
      event,
      payload: {
        sessionId,
        ...payload,
        sentAt: Date.now(),
      },
    })
  } finally {
    await supabase.removeChannel(channel)
  }
}

async function setupKioskRealtime(sessionId) {
  await teardownKioskRealtime()
  const channel = supabase.channel(getSessionChannelName(sessionId))
  channel.on('broadcast', { event: 'start_game' }, ({ payload }) => {
    if (payload?.sessionId !== kioskSessionId) return
    addEventParticipant(payload?.playerId)
    renderKioskEventPanel()
    if (!soloGameState.active) {
      startSoloGame()
    }
  })
  channel.on('broadcast', { event: 'catch' }, ({ payload }) => {
    if (payload?.sessionId !== kioskSessionId) return
    addEventParticipant(payload?.playerId)
    if (typeof payload?.points === 'number' && typeof payload?.reactionMs === 'number') {
      pushEventTopEntry({
        playerId: payload.playerId || 'unknown',
        playerName: payload.playerName || 'Anon',
        points: payload.points,
        reactionMs: payload.reactionMs,
        capturedAt: payload.sentAt || Date.now(),
      })
    }
    renderKioskEventPanel()
    if (currentSoloRound?.tokenId !== payload?.tokenId) return
    confirmSoloCatch()
  })
  await waitForChannelSubscribed(channel)
  kioskRealtimeChannel = channel
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

function isFullscreenActive() {
  return Boolean(document.fullscreenElement)
}

async function toggleFullscreen() {
  if (isFullscreenActive()) {
    await document.exitFullscreen()
    return
  }
  const root = document.documentElement
  if (root.requestFullscreen) {
    await root.requestFullscreen()
  }
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
}

function updateSoloHud() {
  const livesEl = document.querySelector('#solo-lives')
  const levelEl = document.querySelector('#solo-level')
  const catchesEl = document.querySelector('#solo-catches')
  if (livesEl) {
    livesEl.innerHTML = Array.from({ length: 3 }, (_, idx) => {
      const alive = idx < soloGameState.lives
      return `<span class="life-dwarf ${alive ? 'alive' : 'lost'}">ᗢ</span>`
    }).join('')
  }
  if (levelEl) levelEl.textContent = `${soloGameState.level}`
  if (catchesEl) catchesEl.textContent = `${soloGameState.catches}`
}

function renderSoloGameOver() {
  const panel = document.querySelector('#solo-result')
  if (!panel) return
  panel.classList.remove('hidden')
  panel.innerHTML = `
    <h3>Game over</h3>
    <p>Uspesni ulovi: <strong>${soloGameState.catches}</strong></p>
    <p>Dosezen level: <strong>${Math.max(1, soloGameState.level - 1)}</strong></p>
  `
}

function finishSoloGame() {
  if (!soloGameState.active) return
  soloGameState.active = false
  currentSoloRound = null
  clearSoloTimers()
  updateSoloHud()
  playBeep({ freq: 180, durationMs: 300, volume: 0.07, type: 'sawtooth' })
  const hint = document.querySelector('#hint')
  if (hint) hint.textContent = 'GAME OVER. Za novo igro naj igralec skenira zacetni QR.'
  const starter = document.querySelector('#starter-card')
  if (starter) {
    starter.classList.remove('hidden')
    starter.classList.add('restart-highlight')
  }
  const gameOver = document.querySelector('#gameover-banner')
  if (gameOver) {
    gameOver.classList.remove('hidden')
    gameOver.classList.add('show')
  }
  renderSoloGameOver()
}

function startSoloGame() {
  clearSoloTimers()
  soloRunNonce += 1
  currentSoloRound = null
  soloVisualState = { size: 190, hue: 0 }
  incrementEventGamesPlayed()
  soloGameState = {
    active: true,
    lives: 3,
    level: 1,
    catches: 0,
  }
  const result = document.querySelector('#solo-result')
  if (result) {
    result.classList.add('hidden')
    result.innerHTML = ''
  }
  const starter = document.querySelector('#starter-card')
  if (starter) {
    starter.classList.add('hidden')
    starter.classList.remove('restart-highlight')
  }
  const gameOver = document.querySelector('#gameover-banner')
  if (gameOver) {
    gameOver.classList.add('hidden')
    gameOver.classList.remove('show')
  }
  updateSoloHud()
  renderKioskEventPanel()
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

function getEventStats() {
  const raw = readJSON(STORAGE.eventStats, null)
  if (!raw || typeof raw !== 'object') return { gamesPlayed: 0, participants: [] }
  const participants = Array.isArray(raw.participants) ? raw.participants.filter(Boolean) : []
  return {
    gamesPlayed: Number(raw.gamesPlayed) || 0,
    participants,
  }
}

function saveEventStats(stats) {
  saveJSON(STORAGE.eventStats, stats)
}

function addEventParticipant(playerId) {
  if (!playerId) return
  const stats = getEventStats()
  if (!stats.participants.includes(playerId)) {
    stats.participants.push(playerId)
    saveEventStats(stats)
  }
}

function incrementEventGamesPlayed() {
  const stats = getEventStats()
  stats.gamesPlayed += 1
  saveEventStats(stats)
}

function getEventTop20() {
  const rows = readJSON(STORAGE.eventTop20, [])
  return Array.isArray(rows) ? rows : []
}

function pushEventTopEntry(entry) {
  const rows = getEventTop20()
  rows.push(entry)
  rows.sort((a, b) => b.points - a.points || (b.capturedAt || 0) - (a.capturedAt || 0))
  saveJSON(STORAGE.eventTop20, rows.slice(0, 20))
}

function renderKioskEventPanel() {
  const gamesEl = document.querySelector('#event-games')
  const participantsEl = document.querySelector('#event-participants')
  const topEl = document.querySelector('#event-top20')
  if (!gamesEl || !participantsEl || !topEl) return
  const stats = getEventStats()
  gamesEl.textContent = `${stats.gamesPlayed}`
  participantsEl.textContent = `${stats.participants.length}`

  const rows = getEventTop20()
  if (!rows.length) {
    topEl.innerHTML = '<li><span class="muted">Se ni rezultatov.</span><strong>-</strong></li>'
    return
  }
  topEl.innerHTML = rows
    .map((row) => `<li><span>${row.playerName || 'Anon'}</span><strong>${row.points} pts</strong></li>`)
    .join('')
}

function resetEventData() {
  saveEventStats({ gamesPlayed: 0, participants: [] })
  saveJSON(STORAGE.eventTop20, [])
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

function formatReactionTime(ms) {
  const safe = Math.max(0, Math.floor(ms))
  const totalSeconds = Math.floor(safe / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const centiseconds = Math.floor((safe % 1000) / 10)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(centiseconds).padStart(2, '0')}`
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
  app.classList.add('kiosk-app')
  kioskSessionId = createKioskSessionId()
  const baseUrl = getQrBaseUrl()
  app.innerHTML = `
    <main class="page kiosk-page">
      <section class="card">
        <div class="row-between">
          <h1>Solo kiosk</h1>
          <div class="actions row-actions">
            <button id="toggle-fullscreen" class="btn primary">Fullscreen</button>
          </div>
        </div>
        <div class="inline-form">
          <label for="difficulty">Stopnja</label>
          <select id="difficulty">
            <option value="easy">Easy</option>
            <option value="normal" selected>Normal</option>
            <option value="hard">Hard</option>
            <option value="insane">Insane</option>
          </select>
        </div>
        <div class="hud">
          <p>Zivljenja: <strong id="solo-lives" class="lives-pixels"></strong></p>
          <p>Level: <strong id="solo-level" class="stat-level">1</strong></p>
          <p>Ulovi: <strong id="solo-catches" class="stat-catches">0</strong></p>
        </div>
        <section class="card-sub event-summary">
          <p>Iger odigranih: <strong id="event-games" class="stat-games">0</strong></p>
          <p>Razlicni udelezenci: <strong id="event-participants" class="stat-participants">0</strong></p>
        </section>
        <p class="muted retro-note" id="meta">Igralec skenira zacetni QR in sam sprozi igro. Brez admin klikov med igro.</p>
        <section id="starter-card" class="card-sub starter-card">
          <h3>Zacetni QR (start igre)</h3>
          <p class="small">Session: <code id="session-code">${kioskSessionId}</code></p>
          <div class="qr-wrap mini"><img id="starter-qr" alt="Start game QR" /></div>
        </section>
        <details class="card-sub settings-toggle">
          <summary>Nastavitve kioska</summary>
          <div class="inline-form">
            <label for="qr-base-url">QR Base URL</label>
            <input id="qr-base-url" value="${baseUrl}" placeholder="http://192.168.x.x:5173" />
            <button id="save-base-url" class="btn">Shrani URL</button>
          </div>
          <div class="inline-form reset-row">
            <label for="admin-pin">Reset PIN</label>
            <input id="admin-pin" type="password" inputmode="numeric" maxlength="8" placeholder="PIN" />
            <button id="reset-event" class="btn danger">Reset event</button>
          </div>
          <p class="small">Kiosk mora biti odprt na istem URL, ki je nastavljen tukaj.</p>
        </details>
        <p class="countdown" id="countdown"></p>
        <pre id="ascii-dwarf" class="ascii-dwarf"></pre>
        <div id="solo-stage" class="solo-stage">
          <div id="solo-burst" class="solo-burst"></div>
          <div id="gameover-banner" class="gameover-banner hidden">GAME OVER</div>
          <div id="catch-banner" class="catch-banner hidden">UJETO!</div>
          <div id="solo-qr-node" class="monster-frame hidden">
            <img id="solo-qr" alt="Solo round QR" />
          </div>
        </div>
        <section class="card-sub">
          <h3>Top 20</h3>
          <ol id="event-top20" class="board"></ol>
        </section>
        <p class="small" id="hint"></p>
        <section id="solo-result" class="card-sub hidden"></section>
      </section>
    </main>
  `

  const fullscreenBtn = document.querySelector('#toggle-fullscreen')
  const syncFullscreenLabel = () => {
    if (!fullscreenBtn) return
    fullscreenBtn.textContent = isFullscreenActive() ? 'Izhod fullscreen' : 'Fullscreen'
  }
  document.addEventListener('fullscreenchange', syncFullscreenLabel)
  fullscreenBtn?.addEventListener('click', async () => {
    await unlockAudio()
    try {
      await toggleFullscreen()
    } catch {
      const hint = document.querySelector('#hint')
      if (hint) hint.textContent = 'Fullscreen ni uspel. Poskusi ponovno.'
    }
    syncFullscreenLabel()
  })
  syncFullscreenLabel()
  if (!audioUnlockBound) {
    window.addEventListener('pointerdown', unlockAudio)
    audioUnlockBound = true
  }
  document.querySelector('#save-base-url')?.addEventListener('click', async () => {
    await unlockAudio()
    const input = document.querySelector('#qr-base-url')
    const ok = setQrBaseUrl(input?.value || '')
    const meta = document.querySelector('#meta')
    if (!ok) {
      if (meta) meta.textContent = 'Neveljaven URL. Primer: http://192.168.64.101:5173'
      return
    }
    if (meta) meta.textContent = 'QR Base URL shranjen.'
    await renderStarterQr()
  })
  document.querySelector('#reset-event')?.addEventListener('click', () => {
    const pinInput = document.querySelector('#admin-pin')
    const meta = document.querySelector('#meta')
    const pin = String(pinInput?.value || '').trim()
    if (pin !== ADMIN_RESET_PIN) {
      if (meta) meta.textContent = 'Napacen PIN za reset.'
      return
    }
    resetEventData()
    renderKioskEventPanel()
    if (pinInput) pinInput.value = ''
    if (meta) meta.textContent = 'Event statistika in Top 20 sta ponastavljena.'
  })
  await renderStarterQr()
  try {
    await setupKioskRealtime(kioskSessionId)
  } catch {
    const hint = document.querySelector('#hint')
    if (hint) hint.textContent = 'Realtime povezava ni uspela. Preveri Supabase nastavitve.'
  }
  updateSoloHud()
  renderKioskEventPanel()
}

async function renderStarterQr() {
  const target = document.querySelector('#starter-qr')
  if (!target || !kioskSessionId) return
  const startUrl = `${getQrBaseUrl()}#/start?session=${encodeURIComponent(kioskSessionId)}`
  const qr = await QRCode.toDataURL(startUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 360,
  })
  target.src = qr
}

function stopSoloMovement() {
  if (soloMoveTimer) {
    clearInterval(soloMoveTimer)
    soloMoveTimer = null
  }
}

function startSoloMovement(level = 1, mode = 'normal') {
  stopSoloMovement()
  const stage = document.querySelector('#solo-stage')
  const qrNode = document.querySelector('#solo-qr-node')
  if (!stage || !qrNode) return

  const speed = getSoloMovementMultiplier(level, mode)
  let x = 20
  let y = 20
  let vx = 2.8 * speed
  let vy = 2.2 * speed

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
    playBeep({ freq: 420 + (3 - left) * 60, durationMs: 110, volume: 0.05 })
    await sleep(1000)
  }
  if (runId !== soloRunNonce) return
  triggerSoloBurst()
  playBeep({ freq: 900, durationMs: 150, volume: 0.065, type: 'triangle' })
  if (countEl) countEl.textContent = 'GO!'
  await generateSoloToken(runId)
}

async function generateSoloToken(runId) {
  if (runId !== soloRunNonce) return
  const select = document.querySelector('#difficulty')
  const mode = select?.value || 'normal'
  const config = DIFFICULTIES[mode] || DIFFICULTIES.normal
  const ttlMs = soloGameState.active
    ? getSoloRoundTtlMs(mode, Math.max(0, soloGameState.level - 1))
    : config.ttlMs
  const message = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]
  const now = Date.now()
  const tokenId = crypto.randomUUID ? crypto.randomUUID() : `token-${now}`
  const base = getQrBaseUrl()

  const payload = {
    type: 'solo-round',
    sessionId: kioskSessionId || null,
    tokenId,
    text: message.text,
    base: message.base,
    mode,
    createdAt: now,
    expiresAt: now + ttlMs,
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
  if (meta) meta.textContent = `${config.label} | ${message.text} | Veljavnost: ${(ttlMs / 1000).toFixed(1)} s`
  if (hint) hint.textContent = 'Skeniraj QR in na telefonu prejmi zabavno sporocilo.'
  if (countEl) countEl.textContent = ''
  if (asciiEl) asciiEl.textContent = ''
  applySoloQrVisual()
  startSoloMovement(soloGameState.level, mode)
  updateSoloHud()

  if (soloRoundExpiryTimer) clearTimeout(soloRoundExpiryTimer)
  soloRoundExpiryTimer = setTimeout(() => {
    if (!currentSoloRound || currentSoloRound.tokenId !== tokenId) return
    if (soloGameState.active) {
      soloGameState.lives -= 1
      updateSoloHud()
      if (soloGameState.lives <= 0) {
        finishSoloGame()
        return
      }
    }
    const hintEl = document.querySelector('#hint')
    if (hintEl) hintEl.textContent = `Zgreseno! Izguba zivljenja. Ostala zivljenja: ${soloGameState.lives}.`
    startSoloRound()
  }, ttlMs + 50)
}

function confirmSoloCatch() {
  if (!soloGameState.active || !currentSoloRound) return
  if (soloRoundExpiryTimer) {
    clearTimeout(soloRoundExpiryTimer)
    soloRoundExpiryTimer = null
  }
  soloGameState.catches += 1
  soloGameState.level += 1
  soloVisualState = {
    size: Math.max(95, soloVisualState.size - 16),
    hue: (soloVisualState.hue + 75) % 360,
  }
  applySoloQrVisual()
  triggerSoloBurst()
  playBeep({ freq: 1120, durationMs: 130, volume: 0.07, type: 'square' })
  const banner = document.querySelector('#catch-banner')
  if (banner) {
    banner.classList.remove('hidden')
    banner.classList.remove('show')
    void banner.offsetWidth
    banner.classList.add('show')
  }
  updateSoloHud()
  currentSoloRound = null
  const hint = document.querySelector('#hint')
  if (hint) hint.textContent = 'Bravo, nova runda!'
  if (soloNextRoundTimer) clearTimeout(soloNextRoundTimer)
  soloNextRoundTimer = setTimeout(() => {
    if (banner) banner.classList.add('hidden')
    if (soloGameState.active) startSoloRound()
  }, 850)
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
  const myRows = rows
    .filter((row) => row.playerId === profile.id)
    .sort((a, b) => b.points - a.points || a.reactionMs - b.reactionMs)
  const best = myRows[0]

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
        <h2>Tvoj rekord</h2>
        ${best ? `
          <p class="record-badge">${best.points} pts</p>
          <p class="small">Najhitrejsi odziv: ${formatReactionTime(best.reactionMs)}</p>
          <p class="small">Izziv: ${best.text || 'Solo challenge'}</p>
        ` : '<p class="muted">Se ni rezultata. Ujemi prvo QR kodo.</p>'}
      </section>

      <section class="card">
        <h2>Moji rezultati</h2>
        ${myRows.length === 0 ? '<p class="muted">Ni rezultatov.</p>' : `
          <ol class="board">
            ${myRows
              .map((row) => `<li><span>${row.name} (${row.slot || '-'})</span><strong>${row.points} pts</strong><em>${formatReactionTime(row.reactionMs)}</em></li>`)
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
    status = `${points} tock | ${formatReactionTime(reactionMs)} | ${payload.type === 'solo-round' ? 'Solo challenge' : `Slot ${payload.slot || '-'}`}`
    if (payload.type === 'solo-round') {
      vibe = GOOD_VIBES[Math.floor(Math.random() * GOOD_VIBES.length)]
      soloVisualState = {
        size: Math.max(95, soloVisualState.size - 16),
        hue: (soloVisualState.hue + 75) % 360,
      }
      triggerSoloBurst()
    }
    if (payload.sessionId) {
      sendSessionEvent(payload.sessionId, 'catch', {
        tokenId: payload.tokenId,
        playerId: profile.id,
        playerName: profile.name || 'Anon',
        points,
        reactionMs,
      }).catch(() => {
        // Keep claim UX resilient even if realtime send fails.
      })
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

function renderStart(params) {
  const sessionId = params.get('session')
  const profile = getPlayerProfile()
  app.innerHTML = `
    <main class="page">
      <section class="card">
        <h1>Start signal</h1>
        <p>Igra se pripravlja na kiosku.</p>
        <p class="small">Session: <code>${sessionId || 'n/a'}</code></p>
        <p class="small">Igralec: <strong>${profile.name || 'Anon'}</strong></p>
        <div class="actions">
          <button id="go-player" class="btn primary">Moji rezultati</button>
        </div>
        <p id="start-status" class="muted"></p>
      </section>
    </main>
  `
  document.querySelector('#go-player')?.addEventListener('click', () => navigate('/player'))
  const status = document.querySelector('#start-status')
  if (!sessionId) {
    if (status) status.textContent = 'Start QR nima session parametra.'
    return
  }
  sendSessionEvent(sessionId, 'start_game', {
    playerId: profile.id,
    playerName: profile.name || 'Anon',
  })
    .then(() => {
      if (status) status.textContent = 'Signal poslan. Poglej kiosk zaslon.'
    })
    .catch(() => {
      if (status) status.textContent = 'Signal ni uspel. Poskusi skenirati znova.'
    })
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
  const blockKioskForPhone = isPhonePlayerDevice() && ['/', '/solo-kiosk', '/duel-kiosk'].includes(path)
  if (blockKioskForPhone) {
    navigate('/player')
    return
  }
  if (path !== '/solo-kiosk') {
    app.classList.remove('kiosk-app')
    teardownKioskRealtime()
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
  if (path === '/start') {
    renderStart(params)
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

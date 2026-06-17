import QRCode from 'qrcode'
import { createClient } from '@supabase/supabase-js'
import './style.css'

const app = document.querySelector('#app')
const SUPABASE_URL = 'https://hezvtqurbxaxmvcrmuuu.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_QkiVaVk0SKwT4CrF0PF4aA_DjvdGbTi'
const ADMIN_RESET_PIN = '3030'
const GLOBAL_CHANNEL_NAME = 'lovilec-pozornosti-global'
const LOGOUT_STAND_INVITE = 'Pridi na logout.org stojnico - cakamo te!'
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

const STORAGE = {
  profile: 'joqr.player.profile',
  leaderboard: 'joqr.local.leaderboard',
  claimed: 'joqr.player.claimedTokens',
  qrBaseUrl: 'joqr.kiosk.qrBaseUrl',
  eventStats: 'joqr.kiosk.eventStats',
  eventTop20: 'joqr.kiosk.eventTop20',
  messageTheme: 'joqr.kiosk.messageTheme',
  activeSessionId: 'joqr.player.activeSessionId',
  lastGameOverSummary: 'joqr.player.lastGameOverSummary',
  attentionThoughts: 'joqr.shared.attentionThoughts',
}

const DIFFICULTIES = {
  easy: { label: 'Easy', ttlMs: 7000, minMs: 1800, maxMs: 5000 },
  normal: { label: 'Normal', ttlMs: 5000, minMs: 1200, maxMs: 3500 },
  hard: { label: 'Hard', ttlMs: 3500, minMs: 800, maxMs: 2400 },
  insane: { label: 'Insane', ttlMs: 2200, minMs: 500, maxMs: 1400 },
}
const SOLO_LEVEL_CONFIGS = [
  { mode: 'easy', label: 'Level 1', ttlMs: 15000, qrSize: 210, speedMultiplier: 1.0 },
  { mode: 'normal', label: 'Level 2', ttlMs: 8500, qrSize: 185, speedMultiplier: 1.2 },
  { mode: 'hard', label: 'Level 3', ttlMs: 6500, qrSize: 160, speedMultiplier: 1.7 },
]
const SOLO_MAX_LEVELS = SOLO_LEVEL_CONFIGS.length

const MESSAGES = [
  { text: 'Mega ulov', base: 50 },
  { text: 'Turbo combo', base: 70 },
  { text: 'Joker bonus', base: 85 },
  { text: 'Lucky shot', base: 45 },
  { text: 'Flash pick', base: 60 },
]
const DIGITAL_RECIPES = [
  'Recept: vsak dan 30 minut brez telefona - samo glasba, pogovor ali sprehod.',
  'Recept: izklopi notifikacije za socialna omrezja vsaj med solo casom in koncerti.',
  'Recept: pred spanjem odlozi telefon 60 minut prej in umiri glavo brez scrolla.',
  'Recept: nastavi 3 konkretne termine za preverjanje appov, ne neprestano odpiranje.',
  'Recept: ko zacutis impulz za scroll, naredi 10 globokih vdihov in poglej okoli sebe.',
  'Recept: imej en obrok na dan brez ekrana - samo okus, ljudje in trenutek.',
]
const SCIENCE_INSIGHTS = [
  'Raziskave kazejo, da pogoste digitalne prekinitve zmanjsujejo globino osredotocenja.',
  'Mladi v povprecju tezje drzijo daljso pozornost, ko je okolje polno hitrih digitalnih drazlajev.',
  'Kratki odmiki brez zaslona dokazano pomagajo obnoviti fokus in mentalno energijo.',
  'Manj preklapljanja med vsebinami praviloma izboljsa delovni spomin in kakovost pozornosti.',
]

const MESSAGE_THEMES = {
  concert: {
    label: 'Koncert',
    vibes: [
      'Ujet v trenutek.',
      'Ne snemam. Dozivljam.',
      'Ta komad ostane v glavi, ne v storiju.',
      'Danes sem tukaj.',
      'IRL Fan Club.',
      'Koncertni nacin aktiviran.',
      'Notifications Off. Music On.',
    ],
    prevention: [
      'Odklopi obvestila. Priklopi se na koncert.',
      'Posnemi manj, dozivi vec.',
      'Telefon lahko pocaka - trenutek ne.',
      'Poglej na oder, ne na zaslon.',
      'Naj bo spomin v glavi, ne v feedu.',
    ],
  },
  anti_scroll: {
    label: 'Anti-scroll',
    vibes: [
      'Thumb stop. Heart start.',
      'Manj feeda, vec feelinga.',
      'Odlogiraj se iz drame in vklopi koncert.',
      'Dihaj. Poslusaj. Bodi prisoten.',
      'Ne swipe-aj trenutka stran.',
    ],
    prevention: [
      'Ce ni nujno, ni za zdaj.',
      'Samo en komad brez ekrana.',
      'Pozornost je valuta - porabi jo pametno.',
      'Ne lovi notifov. Ujemi refren.',
      'Offline trenutki imajo vecjo locljivost.',
    ],
  },
  connection: {
    label: 'Povezovanje',
    vibes: [
      'Poglej prijatelja, ne storija.',
      'Skupaj v ritmu, ne vsak v svojem feedu.',
      'Deli trenutek v zivo.',
      'Nasmeh > screenshot.',
      'Druzenje je najboljsi filter.',
    ],
    prevention: [
      'Vzpostavi stik, ne samo signala.',
      'En pogovor vec, en scroll manj.',
      'Ekran dol, energija gor.',
      'Najprej odnos, potem objava.',
      'Bodi z ljudmi, ne z algoritmom.',
    ],
  },
}

const DWARVES = [
  '  /\\_/\\\n ( o.o )\n /|_|_\\\n  / \\',
  '  .-"""-.\n / 0 0  \\\n |  ^   |\n | \'-\'  |\n /|_|_|\\',
  '   __\n _|==|_\n(/ . . \\)\n \\  -  /\n /|___|\\',
]
const OBSTACLE_DWARVES = [
  '  /\\_/\\\n ( o.o )\n /|_|_\\',
  '  .-^-.\n / o o \\\n |  ^  |\n /|___|\\',
  '  _^_\n (o o)\n /|_|\\',
]

let duelRunNonce = 0
let currentDuel = null
let soloRunNonce = 0
let currentSoloRound = null
let soloVisualState = { size: 190, hue: 0 }
let soloMoveTimer = null
let soloRoundExpiryTimer = null
let soloNextRoundTimer = null
let soloGameOverRevealTimer = null
let soloPostGameStarterTimer = null
let soloObstacleTimer = null
let soloSkinIndex = 0
let kioskSessionId = ''
let kioskRealtimeChannel = null
let globalRealtimeChannel = null
let audioCtx = null
let audioUnlockBound = false
let kioskLeaderboardTimer = null
let kioskStartDelayTimer = null
let kioskIdleIntroTimer = null
let kioskIntroRunning = false
let kioskIdleIntroCount = 0
let playerSessionRealtimeChannel = null
let activePlayerSessionId = ''
let soloGameState = {
  active: false,
  lives: 3,
  level: 1,
  catches: 0,
  currentScore: 0,
  currentPlayerId: '',
  currentPlayerName: '',
  gameStartedAt: 0,
  totalReactionMs: 0,
  reactionsCount: 0,
}

function getSoloLevelConfig(level = 1) {
  const index = Math.max(0, Math.min(SOLO_LEVEL_CONFIGS.length - 1, Number(level || 1) - 1))
  return SOLO_LEVEL_CONFIGS[index] || SOLO_LEVEL_CONFIGS[0]
}

function getSoloMovementMultiplier(level = 1) {
  const levelCfg = getSoloLevelConfig(level)
  return levelCfg.speedMultiplier || 1
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

async function sendGlobalEvent(event, payload = {}) {
  const channel = supabase.channel(GLOBAL_CHANNEL_NAME)
  try {
    await waitForChannelSubscribed(channel)
    await channel.send({
      type: 'broadcast',
      event,
      payload: {
        ...payload,
        sentAt: Date.now(),
      },
    })
  } finally {
    await supabase.removeChannel(channel)
  }
}

async function setupGlobalRealtime() {
  if (globalRealtimeChannel) return
  const channel = supabase.channel(GLOBAL_CHANNEL_NAME)
  channel.on('broadcast', { event: 'leaderboard_update' }, ({ payload }) => {
    const entry = payload?.entry
    if (!entry) return
    pushEventTopEntry(entry)
    const path = parseRoute().path
    if (path === '/solo-kiosk') renderKioskEventPanel()
    if (path === '/player') renderPlayer()
  })
  channel.on('broadcast', { event: 'attention_thought' }, ({ payload }) => {
    const thought = payload?.thought
    if (!thought?.id || !thought?.text) return
    pushAttentionThought(thought)
    if (parseRoute().path === '/solo-kiosk') renderAttentionTicker()
  })
  await waitForChannelSubscribed(channel)
  globalRealtimeChannel = channel
}

async function setupKioskRealtime(sessionId) {
  await teardownKioskRealtime()
  const channel = supabase.channel(getSessionChannelName(sessionId))
  channel.on('broadcast', { event: 'start_game' }, ({ payload }) => {
    if (payload?.sessionId !== kioskSessionId) return
    addEventParticipant(payload?.playerId)
    renderKioskEventPanel()
    if (!soloGameState.active) {
      const hint = document.querySelector('#hint')
      if (hint) hint.textContent = 'Igra se zacenja ...'
      if (kioskStartDelayTimer) clearTimeout(kioskStartDelayTimer)
      kioskStartDelayTimer = setTimeout(() => {
        startSoloGame({
          playerId: payload?.playerId || '',
          playerName: payload?.playerName || 'Anon',
        })
      }, 1200)
    }
  })
  channel.on('broadcast', { event: 'catch' }, ({ payload }) => {
    if (payload?.sessionId !== kioskSessionId) return
    addEventParticipant(payload?.playerId)
    if (soloGameState.active && payload?.playerId && payload.playerId === soloGameState.currentPlayerId && typeof payload?.points === 'number') {
      soloGameState.currentScore += payload.points
      if (typeof payload?.reactionMs === 'number' && payload.reactionMs >= 0) {
        soloGameState.totalReactionMs += payload.reactionMs
        soloGameState.reactionsCount += 1
      }
    }
    renderKioskEventPanel()
    if (currentSoloRound?.tokenId !== payload?.tokenId) return
    confirmSoloCatch()
  })
  await waitForChannelSubscribed(channel)
  kioskRealtimeChannel = channel
}

async function teardownPlayerSessionRealtime() {
  if (!playerSessionRealtimeChannel) return
  const current = playerSessionRealtimeChannel
  playerSessionRealtimeChannel = null
  activePlayerSessionId = ''
  try {
    await supabase.removeChannel(current)
  } catch {
    // Ignore teardown failures for player session channels.
  }
}

function getLastGameOverSummary() {
  const data = readJSON(STORAGE.lastGameOverSummary, null)
  if (!data || typeof data !== 'object') return null
  return data
}

function clearLastGameOverSummary() {
  localStorage.removeItem(STORAGE.lastGameOverSummary)
}

function saveLastGameOverSummary(summary) {
  saveJSON(STORAGE.lastGameOverSummary, summary)
}

async function setupPlayerSessionRealtime(sessionId) {
  if (!sessionId) return
  if (activePlayerSessionId === sessionId && playerSessionRealtimeChannel) return
  await teardownPlayerSessionRealtime()
  const channel = supabase.channel(getSessionChannelName(sessionId))
  channel.on('broadcast', { event: 'game_over' }, ({ payload }) => {
    const profile = getPlayerProfile()
    if (!payload?.playerId || payload.playerId !== profile.id) return
    saveLastGameOverSummary({
      playerId: profile.id,
      catches: Number(payload?.catches) || 0,
      motivation: payload?.motivation || 'logout.org: Ujemi trenutek, ne notifikacij.',
      invite: payload?.invite || LOGOUT_STAND_INVITE,
      recipe: payload?.recipe || randomDigitalRecipe(),
      scienceInsight: payload?.scienceInsight || randomScienceInsight(),
      avgReactionMs: Number(payload?.avgReactionMs) || 0,
      totalPlayMs: Number(payload?.totalPlayMs) || 0,
      surveyCompleted: false,
      raffleCode: '',
      survey: null,
      sessionId: payload?.sessionId || sessionId,
      reason: payload?.reason || 'gameover',
      completedAt: payload?.completedAt || Date.now(),
    })
    if (parseRoute().path === '/player') renderPlayer()
  })
  await waitForChannelSubscribed(channel)
  playerSessionRealtimeChannel = channel
  activePlayerSessionId = sessionId
  saveJSON(STORAGE.activeSessionId, sessionId)
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

function getActiveThemeKey() {
  const saved = readJSON(STORAGE.messageTheme, 'concert')
  return MESSAGE_THEMES[saved] ? saved : 'concert'
}

function setActiveThemeKey(themeKey) {
  if (!MESSAGE_THEMES[themeKey]) return false
  saveJSON(STORAGE.messageTheme, themeKey)
  return true
}

function randomThemeMessage(list, fallback = '') {
  if (!Array.isArray(list) || list.length === 0) return fallback
  return list[Math.floor(Math.random() * list.length)]
}

function randomDigitalRecipe() {
  return randomThemeMessage(DIGITAL_RECIPES, 'Recept: zavestno odlozi telefon in vrni fokus sebi.')
}

function randomScienceInsight() {
  return randomThemeMessage(SCIENCE_INSIGHTS, 'Pozornost je trenabilna - manj motenj, vec fokusa.')
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
  stopSoloObstacles()
  if (soloRoundExpiryTimer) {
    clearTimeout(soloRoundExpiryTimer)
    soloRoundExpiryTimer = null
  }
  if (soloNextRoundTimer) {
    clearTimeout(soloNextRoundTimer)
    soloNextRoundTimer = null
  }
  if (soloGameOverRevealTimer) {
    clearTimeout(soloGameOverRevealTimer)
    soloGameOverRevealTimer = null
  }
  if (soloPostGameStarterTimer) {
    clearTimeout(soloPostGameStarterTimer)
    soloPostGameStarterTimer = null
  }
  if (kioskStartDelayTimer) {
    clearTimeout(kioskStartDelayTimer)
    kioskStartDelayTimer = null
  }
  if (kioskLeaderboardTimer) {
    clearTimeout(kioskLeaderboardTimer)
    kioskLeaderboardTimer = null
  }
  if (kioskIdleIntroTimer) {
    clearInterval(kioskIdleIntroTimer)
    kioskIdleIntroTimer = null
  }
  kioskIntroRunning = false
  kioskIdleIntroCount = 0
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

function renderSoloGameOver(summary = null) {
  const panel = document.querySelector('#solo-result')
  if (!panel) return
  if (!summary) {
    panel.classList.add('hidden')
    panel.innerHTML = ''
    return
  }
  const avgLabel = summary.avgReactionMs > 0 ? formatReactionTime(summary.avgReactionMs) : 'n/a'
  const totalLabel = formatReactionTime(summary.totalPlayMs || 0)
  panel.innerHTML = `
    <h3>${summary.completedAllLevels ? 'Konec igre - odlicno!' : 'Game over'}</h3>
    <p>Ujel si <strong>${summary.catches}</strong> skratov.</p>
    <div class="focus-metrics kiosk-focus-metrics">
      <p><strong>Povprecni odziv:</strong> ${avgLabel}</p>
      <p><strong>Skupni cas igre:</strong> ${totalLabel}</p>
    </div>
    <p class="science-line"><strong>Znanstveni vpogled:</strong> ${escapeHtml(summary.scienceInsight || randomScienceInsight())}</p>
    <p class="small">Postani delilec pozornosti: skeniraj QR in dodaj lepo misel.</p>
    <div class="qr-wrap mini postgame-thought-qr-wrap"><img id="postgame-thought-qr" alt="QR za delilca pozornosti" /></div>
  `
  panel.classList.remove('hidden')
  const qrImg = panel.querySelector('#postgame-thought-qr')
  if (qrImg && summary.shareThoughtQr) qrImg.src = summary.shareThoughtQr
  const hint = document.querySelector('#hint')
  if (hint) {
    hint.textContent = 'Skeniraj poseben QR za lepo misel ali zacetni QR za novo igro.'
  }
}

function finishSoloGame(reason = 'gameover') {
  if (!soloGameState.active) return
  const completedAllLevels = reason === 'completed'
  const catches = soloGameState.catches
  const playerId = soloGameState.currentPlayerId || ''
  const playerName = soloGameState.currentPlayerName || 'Anon'
  const totalPlayMs = Math.max(0, Date.now() - (soloGameState.gameStartedAt || Date.now()))
  const avgReactionMs = soloGameState.reactionsCount > 0
    ? Math.round(soloGameState.totalReactionMs / soloGameState.reactionsCount)
    : 0
  const scienceInsight = randomScienceInsight()
  const theme = MESSAGE_THEMES[getActiveThemeKey()]
  const motivationCore = randomThemeMessage(theme.prevention, 'Odklopi obvestila in uzivaj koncert.')
  const recipe = randomDigitalRecipe()
  const motivation = `logout.org: Ujel si ${catches} skratov, ki jemljejo pozornost. ${motivationCore} ${LOGOUT_STAND_INVITE}`
  const shareThoughtUrl = `${getQrBaseUrl()}#/attention-share?session=${encodeURIComponent(kioskSessionId || '')}`
  soloGameState.active = false
  if (soloGameState.currentScore > 0) {
    pushEventTopEntry({
      entryId: `${playerId || 'anon'}-${Date.now()}`,
      playerId: playerId || 'unknown',
      playerName,
      points: soloGameState.currentScore,
      capturedAt: Date.now(),
    })
  }
  if (kioskSessionId && playerId) {
    sendSessionEvent(kioskSessionId, 'game_over', {
      playerId,
      playerName,
      catches,
      reason,
      motivation,
      invite: LOGOUT_STAND_INVITE,
      recipe,
      scienceInsight,
      avgReactionMs,
      totalPlayMs,
      completedAt: Date.now(),
    }).catch(() => {
      // Keep kiosk flow resilient even if game_over signal fails.
    })
  }
  currentSoloRound = null
  clearSoloTimers()
  updateSoloHud()
  renderKioskEventPanel()
  playBeep(completedAllLevels
    ? { freq: 740, durationMs: 260, volume: 0.075, type: 'triangle' }
    : { freq: 180, durationMs: 300, volume: 0.07, type: 'sawtooth' })
  const hint = document.querySelector('#hint')
  if (hint) hint.textContent = completedAllLevels ? 'KONEC IGRE' : 'GAME OVER'
  const qr = document.querySelector('#solo-qr')
  if (qr) qr.removeAttribute('src')
  const qrNode = document.querySelector('#solo-qr-node')
  if (qrNode) qrNode.classList.add('hidden')
  const banner = document.querySelector('#catch-banner')
  if (banner) banner.classList.add('hidden')
  const countEl = document.querySelector('#countdown')
  if (countEl) countEl.textContent = ''
  const asciiEl = document.querySelector('#ascii-dwarf')
  if (asciiEl) asciiEl.textContent = ''
  const starter = document.querySelector('#starter-card')
  if (starter) {
    starter.classList.add('hidden')
    starter.classList.add('restart-highlight')
  }
  const result = document.querySelector('#solo-result')
  if (result) result.classList.add('hidden')
  const gameOver = document.querySelector('#gameover-banner')
  if (gameOver) {
    gameOver.textContent = completedAllLevels ? 'KONEC IGRE' : 'GAME OVER'
    gameOver.classList.remove('hidden')
    gameOver.classList.add('show')
  }
  if (soloGameOverRevealTimer) clearTimeout(soloGameOverRevealTimer)
  soloGameOverRevealTimer = setTimeout(() => {
    const lateGameOver = document.querySelector('#gameover-banner')
    if (lateGameOver) {
      lateGameOver.classList.add('hidden')
      lateGameOver.classList.remove('show')
    }
    const lateStarter = document.querySelector('#starter-card')
    if (lateStarter) lateStarter.classList.add('hidden')
    renderSoloGameOver({
      catches,
      avgReactionMs,
      totalPlayMs,
      scienceInsight,
      completedAllLevels,
      shareThoughtQr: '',
    })
    QRCode.toDataURL(shareThoughtUrl, { errorCorrectionLevel: 'M', margin: 1, width: 260 })
      .then((qrData) => {
        const qrImg = document.querySelector('#postgame-thought-qr')
        if (qrImg) qrImg.src = qrData
      })
      .catch(() => {
        // Ignore QR generation errors for the optional thought flow.
      })
    const lateHint = document.querySelector('#hint')
    if (lateHint) lateHint.textContent = 'Konec igre ...'
    if (soloPostGameStarterTimer) clearTimeout(soloPostGameStarterTimer)
    soloPostGameStarterTimer = setTimeout(() => {
      const restartStarter = document.querySelector('#starter-card')
      if (restartStarter) restartStarter.classList.remove('hidden')
      const restartHint = document.querySelector('#hint')
      if (restartHint) restartHint.textContent = 'Za novo igro naj igralec skenira zacetni QR.'
    }, 3000)
  }, 1300)
}

function startSoloGame(player = null) {
  clearSoloTimers()
  soloRunNonce += 1
  currentSoloRound = null
  const levelConfig = getSoloLevelConfig(1)
  soloVisualState = { size: levelConfig.qrSize, hue: 0 }
  incrementEventGamesPlayed()
  soloGameState = {
    active: true,
    lives: 3,
    level: 1,
    catches: 0,
    currentScore: 0,
    currentPlayerId: player?.playerId || '',
    currentPlayerName: player?.playerName || 'Anon',
    gameStartedAt: Date.now(),
    totalReactionMs: 0,
    reactionsCount: 0,
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
  if (entry?.entryId && rows.some((row) => row.entryId === entry.entryId)) return
  rows.push(entry)
  rows.sort((a, b) => b.points - a.points || (b.capturedAt || 0) - (a.capturedAt || 0))
  saveJSON(STORAGE.eventTop20, rows.slice(0, 20))
}

function renderKioskEventPanel() {
  const gamesEl = document.querySelector('#event-games')
  const participantsEl = document.querySelector('#event-participants')
  if (!gamesEl || !participantsEl) return
  const stats = getEventStats()
  gamesEl.textContent = `${stats.gamesPlayed}`
  participantsEl.textContent = `${stats.participants.length}`
}

function escapeHtml(value = '') {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function normalizeThoughtText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 180)
}

function getAttentionThoughts() {
  const rows = readJSON(STORAGE.attentionThoughts, [])
  return Array.isArray(rows) ? rows : []
}

function pushAttentionThought(thought) {
  if (!thought?.id || !thought?.text) return
  const rows = getAttentionThoughts()
  if (rows.some((row) => row.id === thought.id)) return
  rows.push({
    id: String(thought.id),
    text: normalizeThoughtText(thought.text),
    author: String(thought.author || 'Anon').trim().slice(0, 24),
    createdAt: Number(thought.createdAt) || Date.now(),
  })
  rows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
  saveJSON(STORAGE.attentionThoughts, rows.slice(-24))
}

function renderAttentionTicker() {
  const mount = document.querySelector('#attention-thoughts-track')
  if (!mount) return
  const thoughts = getAttentionThoughts()
  const items = thoughts.length > 0
    ? thoughts.slice(-10).map((row) => `"${escapeHtml(row.text)}" - ${escapeHtml(row.author || 'Anon')}`)
    : ['Dodaj svojo lepo misel in postani delilec pozornosti.']
  const line = items.join('   |   ')
  mount.innerHTML = `<span>${line}</span><span>${line}</span>`
}

async function saveAttentionThought(thought) {
  pushAttentionThought(thought)
  sendGlobalEvent('attention_thought', { thought }).catch(() => {
    // Sharing thought should not fail because realtime send fails.
  })
  try {
    await supabase.from('attention_thoughts').insert({
      thought_id: thought.id,
      text: thought.text,
      author: thought.author,
      created_at: new Date(thought.createdAt).toISOString(),
    })
  } catch {
    // Optional DB persistence can fail (missing table/policy); realtime still shares it.
  }
}

function resetEventData() {
  saveEventStats({ gamesPlayed: 0, participants: [] })
  saveJSON(STORAGE.eventTop20, [])
  saveJSON(STORAGE.attentionThoughts, [])
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

function hashText(value = '') {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function getCaughtDwarf(tokenId = '') {
  return DWARVES[hashText(tokenId || `${Date.now()}`) % DWARVES.length]
}

function wrapCanvasText(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let current = ''
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  })
  if (current) lines.push(current)
  return lines
}

function createPostGameShareImage({
  playerName = 'Anon',
  catches = 0,
  motivation = '',
  recipe = '',
  avgReactionMs = 0,
  totalPlayMs = 0,
} = {}) {
  const canvas = document.createElement('canvas')
  const width = 1080
  const height = 1350
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const grad = ctx.createLinearGradient(0, 0, width, height)
  grad.addColorStop(0, '#0b1738')
  grad.addColorStop(0.6, '#09112b')
  grad.addColorStop(1, '#020617')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)'
  ctx.lineWidth = 4
  ctx.strokeRect(36, 36, width - 72, height - 72)

  ctx.fillStyle = '#5eead4'
  ctx.font = '700 42px Inter, sans-serif'
  ctx.fillText('logout.org', 78, 112)

  ctx.fillStyle = '#f8fafc'
  ctx.font = '800 88px Inter, sans-serif'
  ctx.fillText('Lovilec pozornosti', 78, 210)

  const dwarf = DWARVES[Math.abs(Number(catches) || 0) % DWARVES.length]
  ctx.fillStyle = '#d9f99d'
  ctx.font = '700 36px Consolas, Menlo, monospace'
  const dwarfLines = dwarf.split('\n')
  dwarfLines.forEach((line, idx) => {
    ctx.fillText(line, 82, 320 + idx * 42)
  })

  ctx.fillStyle = '#fde68a'
  ctx.font = '700 50px Inter, sans-serif'
  ctx.fillText(`${playerName} je ujel ${catches} skratov`, 78, 560)

  ctx.fillStyle = '#bfdbfe'
  ctx.font = '600 34px Inter, sans-serif'
  const messageLines = wrapCanvasText(ctx, motivation, width - 156)
  messageLines.slice(0, 6).forEach((line, idx) => {
    ctx.fillText(line, 78, 650 + idx * 48)
  })

  ctx.fillStyle = '#fef08a'
  ctx.font = '700 30px Inter, sans-serif'
  const recipeLines = wrapCanvasText(ctx, recipe, width - 156)
  recipeLines.slice(0, 4).forEach((line, idx) => {
    ctx.fillText(line, 78, 970 + idx * 42)
  })

  ctx.fillStyle = '#93c5fd'
  ctx.font = '600 30px Inter, sans-serif'
  ctx.fillText(`Povprecni odziv: ${avgReactionMs > 0 ? formatReactionTime(avgReactionMs) : 'n/a'}`, 78, 1146)
  ctx.fillText(`Skupni cas igre: ${totalPlayMs > 0 ? formatReactionTime(totalPlayMs) : '00:00:00'}`, 78, 1190)

  ctx.fillText(LOGOUT_STAND_INVITE, 78, height - 150)
  ctx.fillText('Ujemi trenutek. Ne notifikacij.', 78, height - 104)

  return canvas.toDataURL('image/png')
}

async function dataUrlToFile(dataUrl, filename = 'lovilec-pozornosti-share.png') {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  return new File([blob], filename, { type: blob.type || 'image/png' })
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
        <p class="tag">JokerOut Lovilec pozornosti</p>
        <h1>Solo Lovilec pozornosti (static hosting)</h1>
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
  const activeThemeKey = getActiveThemeKey()
  const introDwarvesHtml = DWARVES
    .map((art, idx) => `<pre class="intro-dwarf-card" style="--intro-delay:${idx * 0.16}s">${art}</pre>`)
    .join('')
  const themeOptions = Object.entries(MESSAGE_THEMES)
    .map(([key, theme]) => `<option value="${key}" ${key === activeThemeKey ? 'selected' : ''}>${theme.label}</option>`)
    .join('')
  app.innerHTML = `
    <main class="page kiosk-page">
      <section class="card kiosk-shell">
        <div class="row-between">
          <div class="brand-lockup kiosk-brand">
            <span class="logout-logo">logout.org</span>
            <h1>Lovilec pozornosti</h1>
          </div>
          <div class="actions row-actions">
            <button id="toggle-fullscreen" class="btn primary">Fullscreen</button>
          </div>
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
        <p class="muted retro-note" id="meta">Skeniraj zacetni QR za takojsnji start.</p>
        <div id="kiosk-main-stage" class="solo-stage kiosk-main-stage">
          <p class="countdown stage-countdown" id="countdown"></p>
          <pre id="ascii-dwarf" class="ascii-dwarf stage-dwarf"></pre>
          <section id="starter-card" class="card-sub starter-card stage-panel">
            <h3>Zacetni QR (start igre)</h3>
            <p class="small starter-sub">Prisloni telefon in ulovi ritem.</p>
            <p class="small session-line">Session: <code id="session-code">${kioskSessionId}</code></p>
            <div class="qr-wrap mini"><img id="starter-qr" alt="Start game QR" /></div>
          </section>
          <section id="solo-result" class="card-sub stage-panel hidden"></section>
          <div id="solo-burst" class="solo-burst"></div>
          <div id="gameover-banner" class="gameover-banner hidden">GAME OVER</div>
          <div id="catch-banner" class="catch-banner hidden">UJETO!</div>
          <div id="solo-qr-node" class="monster-frame hidden">
            <img id="solo-qr" alt="Solo round QR" />
          </div>
          <section id="kiosk-intro" class="kiosk-intro stage-panel">
            <p class="intro-title" id="intro-title">Ulovi kradljivce pozornosti in postani delilec pozornosti</p>
            <div class="intro-dwarves">${introDwarvesHtml}</div>
            <p class="small intro-sub" id="intro-sub">Skrati vabijo v igro. Pripravi telefon!</p>
            <p class="small intro-cta hidden" id="intro-cta">${LOGOUT_STAND_INVITE}</p>
          </section>
        </div>
        <details class="card-sub settings-toggle">
          <summary>Nastavitve kioska</summary>
          <div class="inline-form">
            <label for="message-theme">Tematski paket</label>
            <select id="message-theme">${themeOptions}</select>
          </div>
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
        <p id="prevention-message" class="prevention-message"></p>
        <p class="small" id="hint"></p>
        <section class="attention-ticker-wrap">
          <p class="small attention-ticker-title">Zadnje lepe misli delilcev pozornosti</p>
          <div class="attention-ticker">
            <div id="attention-thoughts-track" class="attention-thoughts-track"></div>
          </div>
        </section>
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
  document.querySelector('#message-theme')?.addEventListener('change', (event) => {
    const target = event.target
    if (!setActiveThemeKey(target.value)) return
    const prevention = document.querySelector('#prevention-message')
    if (prevention) {
      const theme = MESSAGE_THEMES[getActiveThemeKey()]
      prevention.textContent = randomThemeMessage(theme.prevention, 'Odklopi se in uzivaj koncert.')
      prevention.classList.remove('show')
      void prevention.offsetWidth
      prevention.classList.add('show')
    }
  })
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
    renderAttentionTicker()
    if (pinInput) pinInput.value = ''
    if (meta) meta.textContent = 'Event statistika je ponastavljena.'
  })
  await renderStarterQr()
  try {
    await setupKioskRealtime(kioskSessionId)
  } catch {
    const hint = document.querySelector('#hint')
    if (hint) hint.textContent = 'Realtime povezava ni uspela. Preveri Supabase nastavitve.'
  }
  try {
    await setupGlobalRealtime()
  } catch {
    // Keep kiosk usable even if global channel is unavailable.
  }
  updateSoloHud()
  renderKioskEventPanel()
  renderAttentionTicker()
  kioskIdleIntroCount = 0
  ensureKioskStarterVisible()
  await playKioskIntro()
  ensureKioskStarterVisible()
  startKioskIdleIntroLoop()
}

function ensureKioskStarterVisible() {
  if (soloGameState.active) return
  const starter = document.querySelector('#starter-card')
  if (!starter) return
  starter.classList.remove('hidden')
}

async function playKioskIntro({ extended = false } = {}) {
  if (kioskIntroRunning) return
  if (soloGameState.active) return
  const overlay = document.querySelector('#kiosk-intro')
  const starter = document.querySelector('#starter-card')
  const hint = document.querySelector('#hint')
  if (!overlay) {
    if (!soloGameState.active && starter) starter.classList.remove('hidden')
    return
  }
  kioskIntroRunning = true
  const introTitle = document.querySelector('#intro-title')
  const introSub = document.querySelector('#intro-sub')
  const introCta = document.querySelector('#intro-cta')
  try {
    overlay.classList.toggle('is-special', extended)
    if (introTitle) introTitle.textContent = 'Ulovi kradljivce pozornosti in postani delilec pozornosti'
    if (introSub) introSub.textContent = extended
      ? 'Skrati vabijo vse v igro in na logout.org stojnico!'
      : 'Skrati vabijo v igro. Pripravi telefon!'
    if (introCta) introCta.classList.toggle('hidden', !extended)
    overlay.classList.remove('hidden')
    if (starter) starter.classList.add('hidden')
    if (hint) hint.textContent = extended ? 'Vecerni intro: pridite do logout.org stojnice!' : 'Skrati prihajajo ...'
    await sleep(extended ? 4200 : 2400)
  } finally {
    if (parseRoute().path === '/solo-kiosk') {
      overlay.classList.add('hidden')
      if (!soloGameState.active && starter) starter.classList.remove('hidden')
      if (!soloGameState.active && hint) hint.textContent = 'Skeniraj zacetni QR za start igre.'
    }
    kioskIntroRunning = false
  }
}

function startKioskIdleIntroLoop() {
  if (kioskIdleIntroTimer) return
  kioskIdleIntroTimer = setInterval(() => {
    if (parseRoute().path !== '/solo-kiosk') return
    if (soloGameState.active) return
    ensureKioskStarterVisible()
    if (kioskIntroRunning) return
    kioskIdleIntroCount += 1
    const extended = kioskIdleIntroCount % 3 === 0
    playKioskIntro({ extended })
  }, 60000)
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

function stopSoloObstacles() {
  if (soloObstacleTimer) {
    clearInterval(soloObstacleTimer)
    soloObstacleTimer = null
  }
  document.querySelectorAll('.solo-dwarf-obstacle').forEach((node) => node.remove())
}

function startSoloMovement(level = 1) {
  stopSoloMovement()
  const stage = document.querySelector('#kiosk-main-stage') || document.querySelector('#solo-stage')
  const qrNode = document.querySelector('#solo-qr-node')
  if (!stage || !qrNode) return

  const speed = getSoloMovementMultiplier(level)
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

function startSoloObstacles(level = 1) {
  stopSoloObstacles()
  if (level < 3) return
  const stage = document.querySelector('#kiosk-main-stage') || document.querySelector('#solo-stage')
  if (!stage) return

  const dwarfCount = Math.max(1, Math.min(6, level - 1))
  const obstacles = Array.from({ length: dwarfCount }, (_, idx) => {
    const node = document.createElement('pre')
    node.className = 'solo-dwarf-obstacle'
    node.textContent = OBSTACLE_DWARVES[idx % OBSTACLE_DWARVES.length]
    stage.appendChild(node)
    const x = 40 + idx * 46
    const y = 30 + idx * 28
    const baseSpeed = 1.25 + level * 0.28
    const dirX = idx % 2 === 0 ? 1 : -1
    const dirY = idx % 3 === 0 ? -1 : 1
    return {
      node,
      x,
      y,
      vx: baseSpeed * dirX,
      vy: (baseSpeed * 0.85) * dirY,
    }
  })

  soloObstacleTimer = setInterval(() => {
    const stageRect = stage.getBoundingClientRect()
    obstacles.forEach((obstacle) => {
      const nodeRect = obstacle.node.getBoundingClientRect()
      const maxX = Math.max(0, stageRect.width - nodeRect.width)
      const maxY = Math.max(0, stageRect.height - nodeRect.height)
      obstacle.x += obstacle.vx
      obstacle.y += obstacle.vy
      if (obstacle.x <= 0 || obstacle.x >= maxX) {
        obstacle.vx *= -1
        obstacle.x = Math.max(0, Math.min(obstacle.x, maxX))
      }
      if (obstacle.y <= 0 || obstacle.y >= maxY) {
        obstacle.vy *= -1
        obstacle.y = Math.max(0, Math.min(obstacle.y, maxY))
      }
      obstacle.node.style.left = `${Math.round(obstacle.x)}px`
      obstacle.node.style.top = `${Math.round(obstacle.y)}px`
    })
  }, 26)
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
  stopSoloObstacles()
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
  const levelConfig = getSoloLevelConfig(soloGameState.level)
  const mode = levelConfig.mode
  const config = DIFFICULTIES[mode] || DIFFICULTIES.normal
  const ttlMs = soloGameState.active ? levelConfig.ttlMs : levelConfig.ttlMs
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
  if (meta) meta.textContent = `Stopnja ${soloGameState.level}/${SOLO_MAX_LEVELS} (${config.label}) | Hitrost x${levelConfig.speedMultiplier.toFixed(2)} | Veljavnost: ${(ttlMs / 1000).toFixed(1)} s`
  if (hint) hint.textContent = 'Skeniraj QR in na telefonu prejmi zabavno sporocilo.'
  if (countEl) countEl.textContent = ''
  if (asciiEl) asciiEl.textContent = ''
  applySoloQrVisual()
  startSoloMovement(soloGameState.level)
  startSoloObstacles(soloGameState.level)
  updateSoloHud()

  if (soloRoundExpiryTimer) clearTimeout(soloRoundExpiryTimer)
  soloRoundExpiryTimer = setTimeout(() => {
    if (!currentSoloRound || currentSoloRound.tokenId !== tokenId) return
    if (soloGameState.active) {
      soloGameState.lives -= 1
      updateSoloHud()
      if (soloGameState.lives <= 0) {
        finishSoloGame('gameover')
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
  stopSoloObstacles()
  soloGameState.catches += 1
  const completedAllLevels = soloGameState.level >= SOLO_MAX_LEVELS
  if (!completedAllLevels) {
    soloGameState.level += 1
    const nextConfig = getSoloLevelConfig(soloGameState.level)
    soloVisualState = {
      size: nextConfig.qrSize,
      hue: (soloVisualState.hue + 75) % 360,
    }
    applySoloQrVisual()
  }
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
  if (hint) hint.textContent = completedAllLevels ? 'Bravo! Zakljucil si vse stopnje.' : 'Bravo, nova runda!'
  const prevention = document.querySelector('#prevention-message')
  if (prevention) {
    const theme = MESSAGE_THEMES[getActiveThemeKey()]
    const msg = randomThemeMessage(theme.prevention, 'Odklopi obvestila in uzivaj koncert.')
    prevention.textContent = msg
    prevention.classList.remove('show')
    void prevention.offsetWidth
    prevention.classList.add('show')
  }
  if (soloNextRoundTimer) clearTimeout(soloNextRoundTimer)
  soloNextRoundTimer = setTimeout(() => {
    if (banner) banner.classList.add('hidden')
    if (!soloGameState.active) return
    if (completedAllLevels) {
      finishSoloGame('completed')
      return
    }
    startSoloRound()
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
  const postGame = getLastGameOverSummary()
  const canSharePostGame = postGame?.playerId === profile.id
  const surveyCompleted = canSharePostGame && postGame?.surveyCompleted
  const raffleCode = canSharePostGame ? (postGame?.raffleCode || '') : ''
  const postGameRecipe = canSharePostGame ? (postGame.recipe || randomDigitalRecipe()) : ''
  const postGameInsight = canSharePostGame ? (postGame.scienceInsight || randomScienceInsight()) : ''
  const postGameAvgReaction = canSharePostGame ? Math.max(0, Number(postGame.avgReactionMs) || 0) : 0
  const postGameTotalPlay = canSharePostGame ? Math.max(0, Number(postGame.totalPlayMs) || 0) : 0
  const postGameShareText = canSharePostGame
    ? `Ujel sem ${postGame.catches} skratov, ki nam jemljejo pozornost. Povprecni odziv: ${postGameAvgReaction > 0 ? formatReactionTime(postGameAvgReaction) : 'n/a'}. Skupni cas igre: ${formatReactionTime(postGameTotalPlay)}. ${postGameRecipe} ${postGame.motivation} ${postGame.invite || LOGOUT_STAND_INVITE}`
    : ''
  const postGameShareUrl = `${window.location.origin}${window.location.pathname}#/player`
  const postGameShareImage = canSharePostGame
    ? createPostGameShareImage({
      playerName: profile.name || 'Anon',
      catches: postGame.catches,
      motivation: postGame.motivation,
      recipe: postGameRecipe,
      avgReactionMs: postGameAvgReaction,
      totalPlayMs: postGameTotalPlay,
    })
    : ''
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

      ${canSharePostGame ? `
        <section class="card postgame-share-card">
          <h2>Game over povzetek</h2>
          <p>Ujel si <strong>${postGame.catches}</strong> skratov, ki jemljejo pozornost.</p>
          <div class="focus-metrics">
            <p><strong>Povprecni odziv:</strong> ${postGameAvgReaction > 0 ? formatReactionTime(postGameAvgReaction) : 'n/a'}</p>
            <p><strong>Skupni cas igre:</strong> ${formatReactionTime(postGameTotalPlay)}</p>
          </div>
          <p class="science-line"><strong>Znanstveni vpogled:</strong> ${postGameInsight}</p>
          <p class="recipe-line"><strong>Recept za fokus:</strong> ${postGameRecipe}</p>
          <p class="vibe">${postGame.motivation}</p>
          <p class="small invite-line">${postGame.invite || LOGOUT_STAND_INVITE}</p>
          ${postGameShareImage ? `<img class="postgame-share-preview" src="${postGameShareImage}" alt="Share povzetek" />` : ''}
          <div class="actions">
            <button id="share-postgame" class="btn primary">Deli z vsemi</button>
            <button id="share-postgame-image" class="btn primary">Deli sliko</button>
            <button id="save-postgame-image" class="btn">Shrani sliko</button>
            <a class="btn" href="https://wa.me/?text=${encodeURIComponent(`${postGameShareText} ${postGameShareUrl}`)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
            <button id="clear-postgame" class="btn">Skrij</button>
          </div>
          <section class="focus-survey-wrap">
            <h3>Kratka anketa za zrebanje Warewolf</h3>
            ${surveyCompleted ? `
              <p class="survey-success">Hvala! Izpolnil si pogoj za sodelovanje v zrebanju za namizno igro Warewolf.</p>
              <p class="survey-code">Tvoja zrebalna koda: <strong>${raffleCode}</strong></p>
            ` : `
              <form id="focus-survey" class="focus-survey">
                <label>Kaj te najpogosteje zmoti?
                  <select name="biggestDistractor" required>
                    <option value="">Izberi...</option>
                    <option value="notifikacije">Notifikacije</option>
                    <option value="social-scroll">Social scroll</option>
                    <option value="multitasking">Prevec taskov hkrati</option>
                    <option value="something-else">Nekaj drugega</option>
                  </select>
                </label>
                <label>Kolikokrat dnevno naredis zavesten odmik brez ekrana?
                  <select name="focusBreaks" required>
                    <option value="">Izberi...</option>
                    <option value="0">0x</option>
                    <option value="1-2">1-2x</option>
                    <option value="3-4">3-4x</option>
                    <option value="5+">5x ali vec</option>
                  </select>
                </label>
                <label>Kateri pristop bi rad najprej preizkusil?
                  <select name="nextStep" required>
                    <option value="">Izberi...</option>
                    <option value="silent-notifs">Utisanje notifikacij</option>
                    <option value="time-block">Casovni blok brez telefona</option>
                    <option value="sleep-cutoff">Brez ekrana pred spanjem</option>
                  </select>
                </label>
                <button type="submit" class="btn primary">Oddaj anketo in sodeluj v zrebanju</button>
                <p id="survey-status" class="small muted"></p>
              </form>
            `}
          </section>
        </section>
      ` : ''}

      <section class="card">
        <h2>Moji rezultati</h2>
        ${myRows.length === 0 ? '<p class="muted">Ni rezultatov.</p>' : `
          <ol class="board">
            ${myRows
              .map((row) => `<li><span>${row.dwarf ? 'ᗢ ' : ''}${row.name} (${row.slot || '-'})</span><strong>${row.points} pts</strong><em>${formatReactionTime(row.reactionMs)}</em></li>`)
              .join('')}
          </ol>
        `}
      </section>

    </main>
  `

  document.querySelector('#go-home')?.addEventListener('click', () => navigate('/'))
  document.querySelector('#clear-postgame')?.addEventListener('click', () => {
    clearLastGameOverSummary()
    renderPlayer()
  })
  document.querySelector('#share-postgame')?.addEventListener('click', async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Lovilec pozornosti x logout.org',
          text: postGameShareText,
          url: postGameShareUrl,
        })
        return
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${postGameShareText} ${postGameShareUrl}`)
      }
    } catch {
      // Ignore cancellation/errors from share dialogs.
    }
  })
  document.querySelector('#save-postgame-image')?.addEventListener('click', () => {
    if (!postGameShareImage) return
    const link = document.createElement('a')
    link.href = postGameShareImage
    link.download = `lovilec-pozornosti-${Date.now()}.png`
    link.click()
  })
  document.querySelector('#share-postgame-image')?.addEventListener('click', async () => {
    if (!postGameShareImage) return
    try {
      const file = await dataUrlToFile(postGameShareImage, `lovilec-pozornosti-${Date.now()}.png`)
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: 'Lovilec pozornosti x logout.org',
          text: postGameShareText,
          files: [file],
        })
        return
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(postGameShareUrl)
      }
    } catch {
      // Ignore cancellation/errors from share dialogs.
    }
  })
  document.querySelector('#focus-survey')?.addEventListener('submit', (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const statusEl = document.querySelector('#survey-status')
    const formData = new FormData(form)
    const biggestDistractor = String(formData.get('biggestDistractor') || '').trim()
    const focusBreaks = String(formData.get('focusBreaks') || '').trim()
    const nextStep = String(formData.get('nextStep') || '').trim()
    if (!biggestDistractor || !focusBreaks || !nextStep || !canSharePostGame) {
      if (statusEl) statusEl.textContent = 'Prosim, odgovori na vsa vprasanja.'
      return
    }
    const code = generateCode(`${profile.id}:${postGame?.completedAt || Date.now()}:${Date.now()}`, 6)
    saveLastGameOverSummary({
      ...postGame,
      surveyCompleted: true,
      raffleCode: code,
      surveyCompletedAt: Date.now(),
      survey: {
        biggestDistractor,
        focusBreaks,
        nextStep,
      },
    })
    renderPlayer()
  })
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
  if (payload?.sessionId) {
    setupPlayerSessionRealtime(payload.sessionId).catch(() => {
      // Claim still works even if session realtime listener fails.
    })
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
  let caughtDwarf = ''
  let reactionLabel = ''

  if (isDuplicate) {
    title = 'Ta koda je ze ulovljena'
    status = 'Duplicate scan: 0 tock'
  } else if (isExpired) {
    title = 'Prepozno'
    status = 'QR je potekel: 0 tock'
  } else {
    const reactionMs = Math.max(0, now - payload.createdAt)
    points = computePoints(payload, reactionMs)
    reactionLabel = formatReactionTime(reactionMs)
    caughtDwarf = getCaughtDwarf(payload.tokenId)
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
      dwarf: caughtDwarf,
      createdAt: now,
    })
    title = 'Ulov uspesen'
    status = `${points} tock | ${reactionLabel} | ${payload.type === 'solo-round' ? 'Solo challenge' : `Slot ${payload.slot || '-'}`}`
    if (payload.type === 'solo-round') {
      const theme = MESSAGE_THEMES[getActiveThemeKey()]
      vibe = randomThemeMessage(theme.vibes, 'Ujet v trenutek.')
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
    sendGlobalEvent('leaderboard_update', {
      entry: {
        entryId: `${profile.id}-${payload.tokenId}`,
        playerId: profile.id,
        playerName: profile.name || 'Anon',
        points,
        capturedAt: now,
      },
    }).catch(() => {
      // Global board update is best-effort.
    })
  }

  app.innerHTML = `
    <main class="page">
      <section class="card">
        <h1>${title}</h1>
        <p>${status}</p>
        ${vibe ? `<p class="vibe">${vibe}</p>` : ''}
        ${caughtDwarf ? `
          <section class="caught-dwarf-card">
            <p class="small">Ujel si skrata:</p>
            <pre class="caught-dwarf">${caughtDwarf}</pre>
          </section>
        ` : ''}
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
  if (sessionId) {
    saveJSON(STORAGE.activeSessionId, sessionId)
    clearLastGameOverSummary()
    setupPlayerSessionRealtime(sessionId).catch(() => {
      // Start page remains usable without listener.
    })
  }
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

function renderAttentionShare(params) {
  const profile = getPlayerProfile()
  const sessionId = String(params.get('session') || '').trim()
  app.innerHTML = `
    <main class="page">
      <section class="card">
        <h1>Postani delilec pozornosti</h1>
        <p class="small">Vnesi lepo misel, ki bo tekla po kiosku in navdihnila druge mlade.</p>
        <form id="attention-share-form" class="focus-survey">
          <label>Tvoje ime (neobvezno)
            <input id="attention-name" type="text" maxlength="24" value="${escapeHtml(profile.name || '')}" placeholder="npr. Maja" />
          </label>
          <label>Lepa misel (max 180 znakov)
            <textarea id="attention-text" maxlength="180" rows="4" placeholder="Primer: Najvecji flex je, da zivis trenutek in ne feeda." required></textarea>
          </label>
          <div class="actions">
            <button type="submit" class="btn primary">Objavi misel</button>
            <button id="attention-go-player" type="button" class="btn">Moji rezultati</button>
          </div>
          <p id="attention-status" class="small muted"></p>
          <p class="small muted">Session: <code>${escapeHtml(sessionId || 'n/a')}</code></p>
        </form>
      </section>
    </main>
  `
  document.querySelector('#attention-go-player')?.addEventListener('click', () => navigate('/player'))
  document.querySelector('#attention-share-form')?.addEventListener('submit', async (event) => {
    event.preventDefault()
    const status = document.querySelector('#attention-status')
    const nameInput = document.querySelector('#attention-name')
    const textInput = document.querySelector('#attention-text')
    const author = String(nameInput?.value || profile.name || 'Anon').trim().slice(0, 24)
    const text = normalizeThoughtText(textInput?.value || '')
    if (!text) {
      if (status) status.textContent = 'Prosim, vpisi misel.'
      return
    }
    const thought = {
      id: crypto.randomUUID ? crypto.randomUUID() : `thought-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
      text,
      author: author || 'Anon',
      playerId: profile.id,
      sessionId,
      createdAt: Date.now(),
    }
    if (status) status.textContent = 'Objavljam ...'
    await saveAttentionThought(thought)
    if (status) status.textContent = 'Hvala! Tvoja misel zdaj tece na kiosku.'
    setTimeout(() => navigate('/player'), 1100)
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
  if (!['/player', '/start', '/claim'].includes(path)) {
    teardownPlayerSessionRealtime()
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
    setupGlobalRealtime().catch(() => {
      // Player view still works with cached data if realtime isn't available.
    })
    const savedSessionId = readJSON(STORAGE.activeSessionId, '')
    if (savedSessionId) {
      setupPlayerSessionRealtime(savedSessionId).catch(() => {
        // Player view can still render with local summary if realtime reconnect fails.
      })
    }
    renderPlayer()
    return
  }
  if (path === '/attention-share') {
    setupGlobalRealtime().catch(() => {
      // Share page still works with local fallback.
    })
    renderAttentionShare(params)
    return
  }
  renderHome()
}

window.addEventListener('hashchange', render)
render()

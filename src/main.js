import './style.css'
import { FIXED_DT } from './game/constants.js'
import { createAudioManager } from './game/audio.js'
import { getBlessingCatalog } from './game/blessings.js'
import { createGameModel } from './game/engine.js'
import { createInput } from './game/input.js'
import { createRenderer } from './game/render.js'
import { formatNumber, formatTime } from './game/utils.js'

document.querySelector('#app').innerHTML = `
  <div class="game-shell">
    <header class="top-bar">
      <div class="hud-card hud-health-card">
        <span class="hud-label">Здоровье</span>
        <strong class="hud-value" id="hud-health">5 / 5</strong>
        <div class="health-bar">
          <div class="health-bar__fill" id="hud-health-fill"></div>
        </div>
      </div>
      <div class="hud-card">
        <span class="hud-label">Волна</span>
        <strong class="hud-value" id="hud-wave">0</strong>
      </div>
      <div class="hud-card">
        <span class="hud-label">Очки</span>
        <strong class="hud-value" id="hud-score">0</strong>
      </div>
      <div class="hud-card">
        <span class="hud-label">Время</span>
        <strong class="hud-value" id="hud-time">00:00</strong>
      </div>
      <div class="hud-card">
        <span class="hud-label">Рывок</span>
        <strong class="hud-value" id="hud-dash">Готов</strong>
      </div>
    </header>

    <main class="stage-shell">
      <section class="stage-frame" id="stage-frame">
        <canvas
          id="game-canvas"
          class="game-canvas"
          width="1600"
          height="900"
          aria-label="Игровая арена Осады Сигила"
        ></canvas>

        <div class="stage-corner stage-corner--left">
          <div class="chip chip--accent" id="status-chip">Ритуал спит</div>
          <div class="status-stack">
            <div class="status-item" id="status-text">Войди в зал и начни оборону печати.</div>
            <div class="status-item status-item--muted" id="meta-text">M звук, F полный экран</div>
          </div>
        </div>

        <div class="stage-corner stage-corner--right">
          <div class="blessing-strip" id="blessing-strip"></div>
        </div>

        <div class="overlay overlay--visible" id="title-overlay">
          <div class="overlay-card">
            <div class="eyebrow">Мистическая арена выживания</div>
            <h1>Осада Сигила</h1>
            <p class="overlay-copy">
              Удерживай рунный зал, переживай волны прорыва и выбирай новые благословения, пока пустота не поглотила печать.
            </p>
            <div class="feature-grid">
              <div class="feature-pill">Авто-атака</div>
              <div class="feature-pill">Рывок сквозь врагов</div>
              <div class="feature-pill">Нарастающие волны</div>
              <div class="feature-pill">Случайные благословения</div>
            </div>
            <div class="controls-panel">
              <div><span>Движение</span><strong>WASD</strong></div>
              <div><span>Рывок</span><strong>Пробел</strong></div>
              <div><span>Выбор дара</span><strong>1 / 2 / 3</strong></div>
              <div><span>Рестарт</span><strong>R</strong></div>
            </div>
            <button id="start-btn" class="action-button">Начать бой</button>
            <div class="overlay-foot" id="title-stats">Лучший счёт: 0</div>
          </div>
        </div>

        <div class="overlay" id="blessing-overlay">
          <div class="overlay-card overlay-card--wide">
            <div class="eyebrow">Волна отражена</div>
            <h2>Выбери благословение</h2>
            <p class="overlay-copy">Возьми один дар, и следующая волна начнётся сразу.</p>
            <div class="blessing-grid" id="blessing-options"></div>
          </div>
        </div>

        <div class="overlay" id="gameover-overlay">
          <div class="overlay-card">
            <div class="eyebrow">Печать пала</div>
            <h2>Забег окончен</h2>
            <p class="overlay-copy" id="gameover-summary">Ты дошёл до волны 0.</p>
            <button id="restart-btn" class="action-button action-button--secondary">Снова в бой</button>
            <div class="overlay-foot" id="gameover-best">Лучший счёт: 0</div>
          </div>
        </div>
      </section>
    </main>
  </div>
`

const elements = {
  canvas: document.querySelector('#game-canvas'),
  stageFrame: document.querySelector('#stage-frame'),
  health: document.querySelector('#hud-health'),
  healthFill: document.querySelector('#hud-health-fill'),
  wave: document.querySelector('#hud-wave'),
  score: document.querySelector('#hud-score'),
  time: document.querySelector('#hud-time'),
  dash: document.querySelector('#hud-dash'),
  statusChip: document.querySelector('#status-chip'),
  statusText: document.querySelector('#status-text'),
  metaText: document.querySelector('#meta-text'),
  blessingStrip: document.querySelector('#blessing-strip'),
  titleOverlay: document.querySelector('#title-overlay'),
  blessingOverlay: document.querySelector('#blessing-overlay'),
  gameoverOverlay: document.querySelector('#gameover-overlay'),
  titleStats: document.querySelector('#title-stats'),
  gameoverSummary: document.querySelector('#gameover-summary'),
  gameoverBest: document.querySelector('#gameover-best'),
  blessingOptions: document.querySelector('#blessing-options'),
  startButton: document.querySelector('#start-btn'),
  restartButton: document.querySelector('#restart-btn'),
}

const blessingCatalog = getBlessingCatalog()
const input = createInput(window)
const audio = createAudioManager()
const game = createGameModel()
const renderer = createRenderer(elements.canvas)

let manualTime = false
let accumulator = 0
let lastFrame = performance.now()
let lastChoiceKey = -1

const overlayClass = 'overlay--visible'

function beginRun() {
  audio.resume()
  manualTime = false
  accumulator = 0
  lastFrame = performance.now()
  game.startRun(audio)
  syncUi()
  renderer.render(game.getState())
}

function selectBlessing(index) {
  if (!game.chooseBlessing(index, audio)) {
    return
  }

  syncUi()
  renderer.render(game.getState())
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen()
    return
  }

  elements.stageFrame.requestFullscreen?.()
}

function blessingLabel(id, level) {
  if (level <= 0) {
    return null
  }

  const match = blessingCatalog.find((blessing) => blessing.id === id)
  if (!match) {
    return null
  }

  if (level === 1) {
    return match.name
  }

  return `${match.name} x${level}`
}

function syncBlessingChoices(state) {
  if (state.mode !== 'blessing') {
    elements.blessingOptions.innerHTML = ''
    lastChoiceKey = -1
    return
  }

  const choiceKey = state.currentChoices.map((choice) => choice.id).join('|')
  if (choiceKey === lastChoiceKey) {
    return
  }

  lastChoiceKey = choiceKey
  elements.blessingOptions.innerHTML = state.currentChoices
    .map(
      (choice, index) => `
        <button class="blessing-card" data-choice="${index}">
          <span class="blessing-index">${index + 1}</span>
          <strong>${choice.name}</strong>
          <span>${choice.description}</span>
        </button>
      `,
    )
    .join('')
}

function syncUi() {
  const state = game.getState()
  const player = state.player
  const healthRatio = player.maxHp > 0 ? player.hp / player.maxHp : 0
  const blessingSummary = Object.entries(state.blessings)
    .map(([id, level]) => blessingLabel(id, level))
    .filter(Boolean)
    .join(' • ')

  elements.health.textContent = `${player.hp} / ${player.maxHp}`
  elements.healthFill.style.width = `${Math.max(0, Math.min(100, healthRatio * 100))}%`
  elements.wave.textContent = `${state.wave}`
  elements.score.textContent = formatNumber(state.score)
  elements.time.textContent = formatTime(state.playTime)
  elements.dash.textContent = player.dashCooldown <= 0 ? 'Готов' : `${player.dashCooldown.toFixed(1)}с`
  elements.statusChip.textContent = state.modeLabel
  elements.statusText.textContent = state.statusText
  elements.metaText.textContent = `${audio.isMuted() ? 'Звук выкл' : 'Звук вкл'} • M звук • F полный экран`
  elements.titleStats.textContent = `Лучший счёт: ${formatNumber(state.bestScore)} • Лучшая волна: ${state.bestWave}`
  elements.gameoverSummary.textContent = `Волна ${state.wave} • Очки ${formatNumber(state.score)} • Время ${formatTime(state.playTime)}`
  elements.gameoverBest.textContent = `Лучший счёт: ${formatNumber(state.bestScore)} • Лучшая волна: ${state.bestWave}`
  elements.blessingStrip.textContent = blessingSummary || 'Благословений пока нет'

  elements.titleOverlay.classList.toggle(overlayClass, state.mode === 'title')
  elements.blessingOverlay.classList.toggle(overlayClass, state.mode === 'blessing')
  elements.gameoverOverlay.classList.toggle(overlayClass, state.mode === 'gameover')

  syncBlessingChoices(state)
}

function processUiHotkeys() {
  if (input.consumePressed('m')) {
    audio.toggleMute()
  }

  if (input.consumePressed('f')) {
    toggleFullscreen()
  }

  const state = game.getState()

  if (state.mode === 'title' && input.consumePressed('enter')) {
    beginRun()
    return
  }

  if (state.mode === 'gameover' && input.consumePressed('r')) {
    beginRun()
    return
  }

  if (state.mode === 'blessing') {
    const chosen = input.consumeDigitChoice()
    if (chosen !== null) {
      selectBlessing(chosen)
    }
  }
}

function stepFrame(dt) {
  processUiHotkeys()
  game.tick(dt, input, audio)
}

function renderLoop(now) {
  if (!manualTime) {
    const delta = Math.min(0.05, (now - lastFrame) / 1000)
    accumulator += delta

    while (accumulator >= FIXED_DT) {
      stepFrame(FIXED_DT)
      accumulator -= FIXED_DT
    }
  }

  lastFrame = now
  syncUi()
  renderer.render(game.getState())
  requestAnimationFrame(renderLoop)
}

elements.startButton.addEventListener('click', beginRun)
elements.restartButton.addEventListener('click', beginRun)
elements.blessingOptions.addEventListener('click', (event) => {
  const button = event.target.closest('[data-choice]')
  if (!button) {
    return
  }

  selectBlessing(Number(button.dataset.choice))
})

window.addEventListener('pointerdown', () => {
  audio.resume()
})

window.addEventListener('keydown', () => {
  audio.resume()
})

window.addEventListener('resize', () => {
  renderer.resize()
  renderer.render(game.getState())
})

window.addEventListener('fullscreenchange', () => {
  renderer.resize()
  renderer.render(game.getState())
})

renderer.resize()
syncUi()
renderer.render(game.getState())
requestAnimationFrame(renderLoop)

window.advanceTime = (ms) => {
  manualTime = true
  const steps = Math.max(1, Math.round(ms / (FIXED_DT * 1000)))

  for (let step = 0; step < steps; step += 1) {
    stepFrame(FIXED_DT)
  }

  syncUi()
  renderer.render(game.getState())
}

window.render_game_to_text = () => game.getTextSnapshot()

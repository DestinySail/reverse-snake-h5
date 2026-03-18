import './styles.css'
import { GAME_CONFIG, INSTRUCTION_ITEMS } from './game/config'
import { ReverseSnakeEngine } from './game/engine'
import { createGameStorage } from './game/storage'
import type { Direction, GamePhase, WorldSize } from './game/types'
import { GameRenderer } from './render/renderer'

const storage = createGameStorage()

const resolveWorldSize = (): WorldSize => {
  const width = Math.min(
    GAME_CONFIG.maxWorldWidth,
    Math.max(GAME_CONFIG.minWorldWidth, window.innerWidth - GAME_CONFIG.canvasPadding * 2),
  )
  const height = Math.min(
    GAME_CONFIG.maxWorldHeight,
    Math.max(GAME_CONFIG.minWorldHeight, window.innerHeight - GAME_CONFIG.canvasPadding * 3),
  )

  return { width, height }
}

const instructionsMarkup = INSTRUCTION_ITEMS.map((item) => `<li>${item}</li>`).join('')

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) {
  throw new Error('App root not found.')
}

app.innerHTML = `
  <div class="page-shell">
    <div class="ambient ambient-left"></div>
    <div class="ambient ambient-right"></div>
    <main class="game-frame">
      <section class="topbar">
        <div class="brand">
          <span class="brand-mark"></span>
          <div>
            <p class="eyebrow">BIO-LUMEN / REVERSE SNAKE</p>
            <h1>逆光蠕行</h1>
          </div>
        </div>
        <div class="quick-tip">WASD 移动 / Esc 暂停</div>
      </section>

      <section class="playfield">
        <canvas class="game-canvas"></canvas>

        <div class="hud">
          <div class="hud-pill">
            <span>分数</span>
            <strong data-field="score">0</strong>
          </div>
          <div class="hud-pill">
            <span>最高</span>
            <strong data-field="highScore">0</strong>
          </div>
          <div class="hud-pill">
            <span>长度</span>
            <strong data-field="length">0</strong>
          </div>
          <div class="hud-pill">
            <span>目标</span>
            <strong data-field="targetLength">0</strong>
          </div>
          <div class="hud-pill">
            <span>速度</span>
            <strong data-field="speed">0</strong>
          </div>
          <div class="hud-pill">
            <span>阶段</span>
            <strong data-field="stage">净化阶段</strong>
          </div>
          <div class="hud-pill">
            <span>护盾</span>
            <strong data-field="shield">无</strong>
          </div>
        </div>

        <div class="overlay" data-overlay="intro">
          <div class="panel">
            <p class="eyebrow">REVERSE SNAKE EXPERIMENT</p>
            <h2>让自己越吃越短</h2>
            <p class="lead">
              这不是传统贪食蛇。你一开始像一条塞满培养皿的生物链，必须吞掉荧光豆，让自己逐步净化、缩短、加速。
            </p>
            <div class="stats-row">
              <div class="stat-card">
                <span>最高分</span>
                <strong data-overlay-field="introHighScore">0</strong>
              </div>
              <div class="stat-card">
                <span>目标长度</span>
                <strong data-overlay-field="introTarget">0</strong>
              </div>
            </div>
            <div class="instructions">
              <h3>操作说明</h3>
              <ul>${instructionsMarkup}</ul>
            </div>
            <div class="button-row">
              <button type="button" class="action-button" data-action="start">按 Space 或点击开始</button>
            </div>
          </div>
        </div>

        <div class="overlay hidden" data-overlay="paused">
          <div class="panel panel-compact">
            <p class="eyebrow">PAUSED</p>
            <h2>神经链接已暂停</h2>
            <div class="instructions">
              <h3>操作说明</h3>
              <ul>${instructionsMarkup}</ul>
            </div>
            <div class="button-row">
              <button type="button" class="action-button" data-action="resume">继续蠕行</button>
            </div>
          </div>
        </div>

        <div class="overlay hidden" data-overlay="gameover">
          <div class="panel panel-compact">
            <p class="eyebrow">RUN COLLAPSED</p>
            <h2>生物链断裂</h2>
            <p class="lead" data-overlay-field="gameoverSummary"></p>
            <div class="stats-row">
              <div class="stat-card">
                <span>本局分数</span>
                <strong data-overlay-field="gameoverScore">0</strong>
              </div>
              <div class="stat-card">
                <span>最高分</span>
                <strong data-overlay-field="gameoverHighScore">0</strong>
              </div>
            </div>
            <div class="button-row">
              <button type="button" class="action-button" data-action="restart">重新开始</button>
            </div>
          </div>
        </div>
      </section>

      <section class="footer-note">
        <p data-field="tip">吃荧光豆让自己变短，缩到目标长度后进入过载。</p>
      </section>
    </main>
  </div>
`

const canvas = app.querySelector<HTMLCanvasElement>('.game-canvas')
if (!canvas) {
  throw new Error('Canvas not found.')
}

const engine = new ReverseSnakeEngine({
  world: resolveWorldSize(),
  persistence: {
    highScore: storage.getHighScore(),
    hasSeenIntro: storage.getHasSeenIntro(),
    setHighScore: (score) => storage.setHighScore(score),
    setHasSeenIntro: () => storage.setHasSeenIntro(),
  },
})
const renderer = new GameRenderer(canvas)

const hudFields = {
  score: app.querySelector<HTMLElement>('[data-field="score"]'),
  highScore: app.querySelector<HTMLElement>('[data-field="highScore"]'),
  length: app.querySelector<HTMLElement>('[data-field="length"]'),
  targetLength: app.querySelector<HTMLElement>('[data-field="targetLength"]'),
  speed: app.querySelector<HTMLElement>('[data-field="speed"]'),
  stage: app.querySelector<HTMLElement>('[data-field="stage"]'),
  shield: app.querySelector<HTMLElement>('[data-field="shield"]'),
  tip: app.querySelector<HTMLElement>('[data-field="tip"]'),
}

const overlayFields = {
  introHighScore: app.querySelector<HTMLElement>('[data-overlay-field="introHighScore"]'),
  introTarget: app.querySelector<HTMLElement>('[data-overlay-field="introTarget"]'),
  gameoverSummary: app.querySelector<HTMLElement>('[data-overlay-field="gameoverSummary"]'),
  gameoverScore: app.querySelector<HTMLElement>('[data-overlay-field="gameoverScore"]'),
  gameoverHighScore: app.querySelector<HTMLElement>('[data-overlay-field="gameoverHighScore"]'),
}

const overlays = {
  intro: app.querySelector<HTMLElement>('[data-overlay="intro"]'),
  paused: app.querySelector<HTMLElement>('[data-overlay="paused"]'),
  gameover: app.querySelector<HTMLElement>('[data-overlay="gameover"]'),
}

const setOverlay = (phase: GamePhase): void => {
  overlays.intro?.classList.toggle('hidden', phase !== 'intro')
  overlays.paused?.classList.toggle('hidden', phase !== 'paused')
  overlays.gameover?.classList.toggle('hidden', phase !== 'gameover')
}

const updateUi = (): void => {
  const hud = engine.hud
  if (hudFields.score) hudFields.score.textContent = String(hud.score)
  if (hudFields.highScore) hudFields.highScore.textContent = String(hud.highScore)
  if (hudFields.length) hudFields.length.textContent = String(hud.length)
  if (hudFields.targetLength) hudFields.targetLength.textContent = String(hud.targetLength)
  if (hudFields.speed) hudFields.speed.textContent = `${Math.round(hud.speed)} / ${hud.speedLabel}`
  if (hudFields.stage) hudFields.stage.textContent = hud.stageLabel
  if (hudFields.shield) hudFields.shield.textContent = hud.shield ? '已激活' : '无'
  if (hudFields.tip) hudFields.tip.textContent = hud.tip
  if (overlayFields.introHighScore) overlayFields.introHighScore.textContent = String(hud.highScore)
  if (overlayFields.introTarget) overlayFields.introTarget.textContent = String(hud.targetLength)
  if (overlayFields.gameoverScore) overlayFields.gameoverScore.textContent = String(hud.score)
  if (overlayFields.gameoverHighScore) overlayFields.gameoverHighScore.textContent = String(hud.highScore)
  if (overlayFields.gameoverSummary) {
    overlayFields.gameoverSummary.textContent =
      engine.state.runStage === 'overdrive'
        ? '你已经进入无尽过载，但在高速扭曲中撞毁了自己的生物链。'
        : '你还没把身体净化到目标长度，生物链就在压迫中断裂了。'
  }

  setOverlay(engine.state.phase)
}

const resize = (): void => {
  const world = resolveWorldSize()
  engine.resize(world)
  renderer.resize(world)
  updateUi()
}

resize()
updateUi()

let lastTime = performance.now()
const tick = (now: number): void => {
  const deltaSeconds = (now - lastTime) / 1000
  lastTime = now
  engine.step(deltaSeconds)
  renderer.render(engine.state, now / 1000)
  updateUi()
  window.requestAnimationFrame(tick)
}

window.requestAnimationFrame(tick)

const keyToDirection: Record<string, Direction> = {
  w: 'up',
  arrowup: 'up',
  s: 'down',
  arrowdown: 'down',
  a: 'left',
  arrowleft: 'left',
  d: 'right',
  arrowright: 'right',
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase()
  const direction = keyToDirection[key]

  if (direction) {
    event.preventDefault()
    engine.setDirection(direction)
    return
  }

  if (key === 'escape') {
    event.preventDefault()
    engine.togglePause()
    updateUi()
    return
  }

  if (key === ' ') {
    event.preventDefault()
    if (engine.state.phase === 'intro') {
      engine.start()
    } else if (engine.state.phase === 'paused') {
      engine.resume()
    } else if (engine.state.phase === 'gameover') {
      engine.restart()
    }
    updateUi()
  }
})

app.addEventListener('click', (event) => {
  const target = event.target as HTMLElement
  const action = target.dataset.action

  if (action === 'start') {
    engine.start()
    updateUi()
  }

  if (action === 'resume') {
    engine.resume()
    updateUi()
  }

  if (action === 'restart') {
    engine.restart()
    updateUi()
  }
})

window.addEventListener('resize', resize)

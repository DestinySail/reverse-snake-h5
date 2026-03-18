export interface Vector2 {
  x: number
  y: number
}

export type Direction = 'up' | 'down' | 'left' | 'right'

export interface SnakeSegment extends Vector2 {
  radius: number
  pulse: number
}

export type GamePhase = 'intro' | 'running' | 'paused' | 'gameover'

export type RunStage = 'purge' | 'overdrive'

export type CollectibleKind =
  | 'glow-bean'
  | 'slow-hourglass'
  | 'carapace-shield'
  | 'pulse-slicer'
  | 'parasite-mass'
  | 'sticky-spore'

export interface Collectible {
  id: string
  kind: CollectibleKind
  position: Vector2
  radius: number
  expiresAt: number | null
  spawnedAt: number
}

export type ActiveEffectKind = 'slow' | 'sticky-turn' | 'invulnerable'

export interface ActiveEffect {
  kind: ActiveEffectKind
  remaining: number
}

export interface GameEvent {
  id: number
  text: string
  color: string
  remaining: number
}

export interface HudState {
  score: number
  highScore: number
  length: number
  targetLength: number
  speed: number
  speedLabel: string
  stageLabel: string
  shield: boolean
  phase: GamePhase
  tip: string
}

export interface WorldSize {
  width: number
  height: number
}

export interface GameState {
  phase: GamePhase
  runStage: RunStage
  world: WorldSize
  elapsed: number
  score: number
  highScore: number
  survivalAccumulator: number
  scoreRemainder: number
  heading: Direction
  desiredHeading: Direction
  queuedHeading: Direction | null
  turnDelayRemaining: number
  speedMultiplier: number
  shieldCharges: number
  initialLength: number
  targetLength: number
  overdriveThreshold: number
  overdriveBoostAt: number
  history: Vector2[]
  segments: SnakeSegment[]
  collectibles: Collectible[]
  effects: ActiveEffect[]
  events: GameEvent[]
  lastBeanAt: number
  lastPositiveAt: number
  lastNegativeAt: number
  collisionFlash: number
  hasSeenIntro: boolean
}

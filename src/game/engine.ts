import {
  COLLECTIBLE_CONFIG,
  DIRECTION_VECTORS,
  GAME_CONFIG,
  NEGATIVE_KINDS,
  OPPOSITE_DIRECTION,
  PHASE_TITLES,
  POSITIVE_KINDS,
  SPEED_LABELS,
} from './config'
import type {
  ActiveEffect,
  Collectible,
  CollectibleKind,
  Direction,
  GameEvent,
  GameState,
  HudState,
  SnakeSegment,
  Vector2,
  WorldSize,
} from './types'

export interface EnginePersistence {
  highScore: number
  hasSeenIntro: boolean
  setHighScore(score: number): void
  setHasSeenIntro(): void
}

export interface EngineOptions {
  world: WorldSize
  persistence: EnginePersistence
  rng?: () => number
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount

const distanceBetween = (first: Vector2, second: Vector2): number =>
  Math.hypot(first.x - second.x, first.y - second.y)

const addEvent = (state: GameState, text: string, color: string): void => {
  const event: GameEvent = {
    id: state.events.length > 0 ? state.events[0].id + 1 : 1,
    text,
    color,
    remaining: 2.4,
  }

  state.events.unshift(event)
  state.events = state.events.slice(0, 4)
}

const hasEffect = (state: GameState, kind: ActiveEffect['kind']): boolean =>
  state.effects.some((effect) => effect.kind === kind && effect.remaining > 0)

const upsertEffect = (state: GameState, nextEffect: ActiveEffect): void => {
  const existing = state.effects.find((effect) => effect.kind === nextEffect.kind)
  if (existing) {
    existing.remaining = Math.max(existing.remaining, nextEffect.remaining)
    return
  }

  state.effects.push(nextEffect)
}

const weightedPick = <T extends CollectibleKind>(
  kinds: readonly T[],
  rng: () => number,
  state: GameState,
): T => {
  const available = kinds.filter((kind) => {
    if (kind === 'carapace-shield') {
      return state.shieldCharges === 0
    }

    return true
  })

  const total = available.reduce((sum, kind) => sum + COLLECTIBLE_CONFIG[kind].weight, 0)
  let cursor = rng() * total

  for (const kind of available) {
    cursor -= COLLECTIBLE_CONFIG[kind].weight
    if (cursor <= 0) {
      return kind
    }
  }

  return available[available.length - 1]
}

const sampleAlongPolyline = (waypoints: Vector2[], spacing: number): Vector2[] => {
  if (waypoints.length === 0) {
    return []
  }

  const samples: Vector2[] = [{ ...waypoints[0] }]
  let accumulated = 0
  let nextTarget = spacing

  for (let index = 1; index < waypoints.length; index += 1) {
    const start = waypoints[index - 1]
    const end = waypoints[index]
    const sectionLength = distanceBetween(start, end)

    if (sectionLength === 0) {
      continue
    }

    while (accumulated + sectionLength >= nextTarget) {
      const t = (nextTarget - accumulated) / sectionLength
      samples.push({
        x: lerp(start.x, end.x, t),
        y: lerp(start.y, end.y, t),
      })
      nextTarget += spacing
    }

    accumulated += sectionLength
  }

  const lastWaypoint = waypoints[waypoints.length - 1]
  const lastSample = samples[samples.length - 1]
  if (distanceBetween(lastWaypoint, lastSample) > spacing * 0.5) {
    samples.push({ ...lastWaypoint })
  }

  return samples
}

const createSerpentineHistory = (world: WorldSize): Vector2[] => {
  const margin = GAME_CONFIG.pathMargin
  const laneGap = GAME_CONFIG.pathLaneGap
  const top = margin + world.height * 0.08
  const fillHeight = world.height * 0.66
  const laneCount = Math.max(5, Math.floor(fillHeight / laneGap))
  const left = margin
  const right = world.width - margin
  const waypoints: Vector2[] = []

  for (let lane = 0; lane < laneCount; lane += 1) {
    const y = top + lane * laneGap
    if (lane % 2 === 0) {
      waypoints.push({ x: left, y }, { x: right, y })
    } else {
      waypoints.push({ x: right, y }, { x: left, y })
    }
  }

  const tailDrop = {
    x: waypoints[waypoints.length - 1].x,
    y: clamp(waypoints[waypoints.length - 1].y + laneGap * 0.8, top, world.height - margin),
  }
  waypoints.push(tailDrop)

  return sampleAlongPolyline(waypoints, GAME_CONFIG.segmentSpacing * 0.78)
}

const deriveHeadingFromHistory = (history: Vector2[]): Direction => {
  const latest = history[history.length - 1]
  const previous = history[history.length - 2]
  const delta = {
    x: latest.x - previous.x,
    y: latest.y - previous.y,
  }

  if (Math.abs(delta.x) >= Math.abs(delta.y)) {
    return delta.x >= 0 ? 'right' : 'left'
  }

  return delta.y >= 0 ? 'down' : 'up'
}

const buildSegmentsFromHistory = (
  history: Vector2[],
  count: number,
  radius: number,
  spacing: number,
): SnakeSegment[] => {
  const segments: SnakeSegment[] = []
  const head = history[history.length - 1]

  if (!head) {
    return segments
  }

  segments.push({ ...head, radius, pulse: 0 })

  let historyIndex = history.length - 1
  let travelled = 0
  let nextTarget = spacing

  while (segments.length < count && historyIndex > 0) {
    const newer = history[historyIndex]
    const older = history[historyIndex - 1]
    const sectionLength = distanceBetween(newer, older)

    if (sectionLength === 0) {
      historyIndex -= 1
      continue
    }

    while (travelled + sectionLength >= nextTarget && segments.length < count) {
      const t = (nextTarget - travelled) / sectionLength
      segments.push({
        x: lerp(newer.x, older.x, t),
        y: lerp(newer.y, older.y, t),
        radius,
        pulse: segments.length / Math.max(count, 1),
      })
      nextTarget += spacing
    }

    travelled += sectionLength
    historyIndex -= 1
  }

  const fallback = segments[segments.length - 1]
  while (segments.length < count) {
    segments.push({
      x: fallback.x,
      y: fallback.y,
      radius,
      pulse: segments.length / Math.max(count, 1),
    })
  }

  return segments
}

const trimHistory = (state: GameState): void => {
  const maxUsefulLength =
    (Math.max(state.initialLength + 36, state.targetLength + 36) * GAME_CONFIG.segmentSpacing) +
    GAME_CONFIG.segmentSpacing * 4
  let totalLength = 0
  let trimIndex = state.history.length - 1

  while (trimIndex > 0) {
    const current = state.history[trimIndex]
    const previous = state.history[trimIndex - 1]
    totalLength += distanceBetween(current, previous)
    if (totalLength >= maxUsefulLength) {
      break
    }
    trimIndex -= 1
  }

  const keepFrom = Math.max(0, trimIndex - 1)
  state.history = state.history.slice(keepFrom)
}

const createBaseState = (world: WorldSize, persistence: EnginePersistence): GameState => {
  const history = createSerpentineHistory(world)
  const initialLength = history.length
  const heading = deriveHeadingFromHistory(history)
  const targetLength = initialLength

  return {
    phase: 'intro',
    runStage: 'purge',
    world,
    elapsed: 0,
    score: 0,
    highScore: persistence.highScore,
    survivalAccumulator: 0,
    scoreRemainder: 0,
    heading,
    desiredHeading: heading,
    queuedHeading: null,
    turnDelayRemaining: 0,
    speedMultiplier: 1,
    shieldCharges: 0,
    initialLength,
    targetLength,
    overdriveThreshold: Math.max(GAME_CONFIG.minLength, Math.floor(initialLength * GAME_CONFIG.overdriveTargetRatio)),
    overdriveBoostAt: GAME_CONFIG.overdriveInterval,
    history,
    segments: buildSegmentsFromHistory(
      history,
      targetLength,
      GAME_CONFIG.bodyRadius,
      GAME_CONFIG.segmentSpacing,
    ),
    collectibles: [],
    effects: [],
    events: [],
    lastBeanAt: 0,
    lastPositiveAt: 0,
    lastNegativeAt: 0,
    collisionFlash: 0,
    hasSeenIntro: persistence.hasSeenIntro,
  }
}

const randomPoint = (world: WorldSize, rng: () => number): Vector2 => ({
  x: GAME_CONFIG.collectibleMargin + rng() * (world.width - GAME_CONFIG.collectibleMargin * 2),
  y: GAME_CONFIG.collectibleMargin + rng() * (world.height - GAME_CONFIG.collectibleMargin * 2),
})

const canPlaceCollectible = (
  state: GameState,
  point: Vector2,
  radius: number,
  skipBeanCheck: boolean,
): boolean => {
  const head = state.segments[0]
  if (distanceBetween(head, point) < GAME_CONFIG.spawnAvoidHead + radius) {
    return false
  }

  for (let index = 10; index < state.segments.length; index += 6) {
    if (distanceBetween(state.segments[index], point) < GAME_CONFIG.spawnAvoidBody + radius) {
      return false
    }
  }

  for (const collectible of state.collectibles) {
    if (skipBeanCheck && collectible.kind === 'glow-bean') {
      continue
    }
    if (distanceBetween(collectible.position, point) < GAME_CONFIG.spawnAvoidCollectible + radius) {
      return false
    }
  }

  return true
}

const createCollectible = (
  state: GameState,
  kind: CollectibleKind,
  rng: () => number,
): Collectible | null => {
  const config = COLLECTIBLE_CONFIG[kind]

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const position = randomPoint(state.world, rng)
    if (canPlaceCollectible(state, position, config.radius, kind === 'glow-bean')) {
      return {
        id: `${kind}-${Math.round((state.elapsed + attempt) * 1000)}`,
        kind,
        position,
        radius: config.radius,
        expiresAt: config.ttl === null ? null : state.elapsed + config.ttl,
        spawnedAt: state.elapsed,
      }
    }
  }

  return null
}

const ensurePrimaryCollectible = (state: GameState, rng: () => number): void => {
  const hasPrimary = state.collectibles.some((collectible) => collectible.kind === 'glow-bean')
  if (hasPrimary) {
    return
  }

  const bean = createCollectible(state, 'glow-bean', rng)
  if (bean) {
    state.collectibles.push(bean)
    state.lastBeanAt = state.elapsed
  }
}

const maybeSpawnSideCollectible = (
  state: GameState,
  rng: () => number,
  group: 'positive' | 'negative',
): void => {
  const existing = state.collectibles.some(
    (collectible) => COLLECTIBLE_CONFIG[collectible.kind].group === group,
  )

  if (existing) {
    return
  }

  const chance = group === 'positive' ? GAME_CONFIG.positiveSpawnChance : GAME_CONFIG.negativeSpawnChance
  const cooldown = group === 'positive' ? GAME_CONFIG.positiveSpawnCooldown : GAME_CONFIG.negativeSpawnCooldown
  const lastSeen = group === 'positive' ? state.lastPositiveAt : state.lastNegativeAt

  if (state.elapsed - lastSeen < cooldown) {
    return
  }

  const delta = Math.min(1, (state.elapsed - lastSeen - cooldown) / cooldown)
  if (rng() > chance * (0.35 + delta * 0.65)) {
    return
  }

  const kinds = group === 'positive' ? POSITIVE_KINDS : NEGATIVE_KINDS
  const selected = weightedPick(kinds, rng, state)
  const collectible = createCollectible(state, selected, rng)
  if (!collectible) {
    return
  }

  state.collectibles.push(collectible)
  if (group === 'positive') {
    state.lastPositiveAt = state.elapsed
  } else {
    state.lastNegativeAt = state.elapsed
  }
}

const applyScore = (state: GameState, amount: number): void => {
  state.score += amount
  if (state.score > state.highScore) {
    state.highScore = state.score
  }
}

const updateSurvivalScore = (state: GameState, dt: number): void => {
  state.scoreRemainder +=
    dt *
    (state.runStage === 'overdrive'
      ? GAME_CONFIG.survivalScorePerSecondOverdrive
      : GAME_CONFIG.survivalScorePerSecondPurge)

  while (state.scoreRemainder >= 1) {
    applyScore(state, 1)
    state.scoreRemainder -= 1
  }
}

const handleFatalCollision = (state: GameState): void => {
  state.collisionFlash = 0.45
  if (!hasEffect(state, 'invulnerable') && state.shieldCharges > 0) {
    state.shieldCharges -= 1
    upsertEffect(state, {
      kind: 'invulnerable',
      remaining: GAME_CONFIG.invulnerableDuration,
    })
    addEvent(state, '护盾吸收了一次撞击', '#c9ff7e')
    return
  }

  if (!hasEffect(state, 'invulnerable')) {
    state.phase = 'gameover'
  }
}

const clampHeadInsideWorld = (state: GameState): void => {
  const head = state.history[state.history.length - 1]
  state.history[state.history.length - 1] = {
    x: clamp(head.x, GAME_CONFIG.bodyRadius, state.world.width - GAME_CONFIG.bodyRadius),
    y: clamp(head.y, GAME_CONFIG.bodyRadius, state.world.height - GAME_CONFIG.bodyRadius),
  }
}

const applyCollectibleEffect = (state: GameState, kind: CollectibleKind): void => {
  switch (kind) {
    case 'glow-bean': {
      state.targetLength = Math.max(GAME_CONFIG.minLength, state.targetLength - GAME_CONFIG.beanShrink)
      state.speedMultiplier *= GAME_CONFIG.beanSpeedBoost
      applyScore(state, COLLECTIBLE_CONFIG[kind].score)
      addEvent(state, '净化成功，躯体缩短', '#65f8ff')
      return
    }
    case 'slow-hourglass': {
      upsertEffect(state, { kind: 'slow', remaining: GAME_CONFIG.slowDuration })
      applyScore(state, COLLECTIBLE_CONFIG[kind].score)
      addEvent(state, '流速放缓', '#9edbff')
      return
    }
    case 'carapace-shield': {
      state.shieldCharges = 1
      applyScore(state, COLLECTIBLE_CONFIG[kind].score)
      addEvent(state, '甲壳护盾已就位', '#d5ff84')
      return
    }
    case 'pulse-slicer': {
      state.targetLength = Math.max(GAME_CONFIG.minLength, state.targetLength - GAME_CONFIG.pulseShrink)
      state.speedMultiplier *= GAME_CONFIG.pulseSpeedBoost
      applyScore(state, COLLECTIBLE_CONFIG[kind].score)
      addEvent(state, '脉冲切片生效，速度上扬', '#7df3ff')
      return
    }
    case 'parasite-mass': {
      state.targetLength += GAME_CONFIG.parasiteGrowth
      addEvent(state, '寄生团块附着，长度回涨', '#ff8f6d')
      return
    }
    case 'sticky-spore': {
      state.targetLength += GAME_CONFIG.stickyGrowth
      upsertEffect(state, { kind: 'sticky-turn', remaining: GAME_CONFIG.stickyDuration })
      addEvent(state, '黏性孢子让转向变钝', '#ffd57f')
      return
    }
  }
}

const computeSpeed = (state: GameState): number => {
  let speed = GAME_CONFIG.baseSpeed * state.speedMultiplier
  if (hasEffect(state, 'slow')) {
    speed *= GAME_CONFIG.slowFactor
  }

  return clamp(speed, GAME_CONFIG.baseSpeed * 0.7, GAME_CONFIG.maxSpeed)
}

const computeSpeedLabel = (speed: number): string => {
  for (const entry of SPEED_LABELS) {
    if (speed <= entry.threshold) {
      return entry.label
    }
  }

  return SPEED_LABELS[SPEED_LABELS.length - 1].label
}

const queueDirection = (state: GameState, direction: Direction): void => {
  if (direction === state.heading || direction === state.desiredHeading) {
    return
  }
  if (OPPOSITE_DIRECTION[state.heading] === direction) {
    return
  }

  if (hasEffect(state, 'sticky-turn')) {
    state.queuedHeading = direction
    state.turnDelayRemaining = GAME_CONFIG.stickyTurnDelay
    return
  }

  state.desiredHeading = direction
}

export const stepGameState = (state: GameState, dt: number, rng: () => number): GameState => {
  if (state.phase !== 'running') {
    return state
  }

  const frame = Math.min(dt, 0.05)
  state.elapsed += frame
  state.collisionFlash = Math.max(0, state.collisionFlash - frame)

  if (state.turnDelayRemaining > 0) {
    state.turnDelayRemaining = Math.max(0, state.turnDelayRemaining - frame)
    if (state.turnDelayRemaining === 0 && state.queuedHeading) {
      state.desiredHeading = state.queuedHeading
      state.queuedHeading = null
    }
  }

  state.effects = state.effects
    .map((effect) => ({
      ...effect,
      remaining: Math.max(0, effect.remaining - frame),
    }))
    .filter((effect) => effect.remaining > 0)

  state.events = state.events
    .map((event) => ({
      ...event,
      remaining: Math.max(0, event.remaining - frame),
    }))
    .filter((event) => event.remaining > 0)

  state.collectibles = state.collectibles.filter(
    (collectible) => collectible.expiresAt === null || collectible.expiresAt > state.elapsed,
  )

  state.heading = state.desiredHeading
  const directionVector = DIRECTION_VECTORS[state.heading]
  const speed = computeSpeed(state)
  const head = state.history[state.history.length - 1]
  const nextHead = {
    x: head.x + directionVector.x * speed * frame,
    y: head.y + directionVector.y * speed * frame,
  }

  state.history.push(nextHead)
  trimHistory(state)
  state.segments = buildSegmentsFromHistory(
    state.history,
    state.targetLength,
    GAME_CONFIG.bodyRadius,
    GAME_CONFIG.segmentSpacing,
  )

  const newHead = state.segments[0]
  const wallHit =
    newHead.x <= GAME_CONFIG.bodyRadius ||
    newHead.x >= state.world.width - GAME_CONFIG.bodyRadius ||
    newHead.y <= GAME_CONFIG.bodyRadius ||
    newHead.y >= state.world.height - GAME_CONFIG.bodyRadius

  if (wallHit) {
    handleFatalCollision(state)
    clampHeadInsideWorld(state)
    state.segments = buildSegmentsFromHistory(
      state.history,
      state.targetLength,
      GAME_CONFIG.bodyRadius,
      GAME_CONFIG.segmentSpacing,
    )
  }

  const selfHit = state.segments.some((segment, index) => {
    if (index <= GAME_CONFIG.collisionGraceSegments) {
      return false
    }

    return distanceBetween(newHead, segment) < GAME_CONFIG.bodyRadius * 1.22
  })

  if (selfHit) {
    handleFatalCollision(state)
  }

  if (state.phase !== 'running') {
    return state
  }

  const collectedIds = new Set<string>()
  for (const collectible of state.collectibles) {
    if (distanceBetween(newHead, collectible.position) <= collectible.radius + GAME_CONFIG.bodyRadius * 0.9) {
      collectedIds.add(collectible.id)
      applyCollectibleEffect(state, collectible.kind)
    }
  }

  if (collectedIds.size > 0) {
    state.collectibles = state.collectibles.filter((collectible) => !collectedIds.has(collectible.id))
  }

  if (state.runStage === 'purge' && state.targetLength <= state.overdriveThreshold) {
    state.runStage = 'overdrive'
    state.overdriveBoostAt = state.elapsed + GAME_CONFIG.overdriveInterval
    applyScore(state, 120)
    addEvent(state, '进入过载阶段', '#7fffee')
  }

  if (state.runStage === 'overdrive' && state.elapsed >= state.overdriveBoostAt) {
    state.speedMultiplier *= GAME_CONFIG.overdriveSpeedBoost
    state.overdriveBoostAt += GAME_CONFIG.overdriveInterval
    addEvent(state, '过载上升，神经增压', '#7ffff1')
  }

  updateSurvivalScore(state, frame)
  ensurePrimaryCollectible(state, rng)
  maybeSpawnSideCollectible(state, rng, 'positive')
  maybeSpawnSideCollectible(state, rng, 'negative')

  state.segments = buildSegmentsFromHistory(
    state.history,
    state.targetLength,
    GAME_CONFIG.bodyRadius,
    GAME_CONFIG.segmentSpacing,
  )

  if (state.score > state.highScore) {
    state.highScore = state.score
  }

  return state
}

export const getHudState = (state: GameState): HudState => {
  const speed = computeSpeed(state)
  return {
    score: state.score,
    highScore: state.highScore,
    length: state.targetLength,
    targetLength: state.overdriveThreshold,
    speed,
    speedLabel: computeSpeedLabel(speed),
    stageLabel: PHASE_TITLES[state.runStage],
    shield: state.shieldCharges > 0,
    phase: state.phase,
    tip:
      state.runStage === 'purge'
        ? '吃荧光豆让自己变短，缩到目标长度后进入过载'
        : '无尽过载已开启，继续活下去并拉高分数',
  }
}

export class ReverseSnakeEngine {
  private readonly rng: () => number
  private readonly persistence: EnginePersistence
  private stateValue: GameState

  constructor(options: EngineOptions) {
    this.rng = options.rng ?? Math.random
    this.persistence = options.persistence
    this.stateValue = createBaseState(options.world, options.persistence)
    ensurePrimaryCollectible(this.stateValue, this.rng)
  }

  get state(): GameState {
    return this.stateValue
  }

  get hud(): HudState {
    return getHudState(this.stateValue)
  }

  start(): void {
    this.stateValue = createBaseState(this.stateValue.world, this.persistence)
    this.stateValue.phase = 'running'
    ensurePrimaryCollectible(this.stateValue, this.rng)
    this.persistence.setHasSeenIntro()
    this.persistence.hasSeenIntro = true
    this.stateValue.hasSeenIntro = true
  }

  restart(): void {
    this.start()
  }

  pause(): void {
    if (this.stateValue.phase === 'running') {
      this.stateValue.phase = 'paused'
    }
  }

  resume(): void {
    if (this.stateValue.phase === 'paused') {
      this.stateValue.phase = 'running'
    }
  }

  togglePause(): void {
    if (this.stateValue.phase === 'running') {
      this.pause()
      return
    }

    if (this.stateValue.phase === 'paused') {
      this.resume()
    }
  }

  setDirection(direction: Direction): void {
    if (this.stateValue.phase !== 'running') {
      return
    }

    queueDirection(this.stateValue, direction)
  }

  step(dt: number): void {
    const previousHighScore = this.stateValue.highScore
    stepGameState(this.stateValue, dt, this.rng)

    if (this.stateValue.highScore > previousHighScore) {
      this.persistence.setHighScore(this.stateValue.highScore)
      this.persistence.highScore = this.stateValue.highScore
    }
  }

  resize(world: WorldSize): void {
    const previous = this.stateValue.world
    const scaleX = world.width / previous.width
    const scaleY = world.height / previous.height

    this.stateValue.world = world
    this.stateValue.history = this.stateValue.history.map((point) => ({
      x: point.x * scaleX,
      y: point.y * scaleY,
    }))
    this.stateValue.collectibles = this.stateValue.collectibles.map((collectible) => ({
      ...collectible,
      position: {
        x: collectible.position.x * scaleX,
        y: collectible.position.y * scaleY,
      },
    }))
    this.stateValue.segments = buildSegmentsFromHistory(
      this.stateValue.history,
      this.stateValue.targetLength,
      GAME_CONFIG.bodyRadius,
      GAME_CONFIG.segmentSpacing,
    )
  }
}

export const createInitialStateForTests = (
  world: WorldSize,
  persistence: EnginePersistence,
): GameState => createBaseState(world, persistence)

export const applyCollectibleForTests = (state: GameState, kind: CollectibleKind): void => {
  applyCollectibleEffect(state, kind)
}

export const createPersistenceStub = (
  highScore = 0,
  hasSeenIntro = false,
): EnginePersistence => ({
  highScore,
  hasSeenIntro,
  setHighScore: () => undefined,
  setHasSeenIntro: () => undefined,
})

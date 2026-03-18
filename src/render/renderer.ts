import { COLLECTIBLE_CONFIG, GAME_CONFIG } from '../game/config'
import type { Collectible, GameState, SnakeSegment, Vector2, WorldSize } from '../game/types'

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const withAlpha = (hex: string, alpha: number): string => {
  const normalized = hex.replace('#', '')
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((segment) => segment + segment)
          .join('')
      : normalized

  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

const getNormal = (previous: Vector2, next: Vector2): Vector2 => {
  const dx = next.x - previous.x
  const dy = next.y - previous.y
  const length = Math.hypot(dx, dy) || 1
  return {
    x: -dy / length,
    y: dx / length,
  }
}

const buildWrigglePoints = (segments: SnakeSegment[], time: number): Vector2[] =>
  segments.map((segment, index) => {
    const previous = segments[Math.max(0, index - 1)]
    const next = segments[Math.min(segments.length - 1, index + 1)]
    const normal = getNormal(previous, next)
    const taper = 1 - index / Math.max(segments.length - 1, 1)
    const amplitude = (2.8 + segment.radius * 0.16) * Math.pow(taper, 0.55)
    const wobble = Math.sin(time * 4.6 + index * 0.3) * amplitude

    return {
      x: segment.x + normal.x * wobble,
      y: segment.y + normal.y * wobble,
    }
  })

const strokeCurve = (
  context: CanvasRenderingContext2D,
  points: Vector2[],
  lineWidth: number,
  strokeStyle: string,
): void => {
  if (points.length < 2) {
    return
  }

  context.beginPath()
  context.moveTo(points[0].x, points[0].y)

  for (let index = 1; index < points.length - 1; index += 1) {
    const midpoint = {
      x: (points[index].x + points[index + 1].x) * 0.5,
      y: (points[index].y + points[index + 1].y) * 0.5,
    }
    context.quadraticCurveTo(points[index].x, points[index].y, midpoint.x, midpoint.y)
  }

  const penultimate = points[points.length - 2]
  const last = points[points.length - 1]
  context.quadraticCurveTo(penultimate.x, penultimate.y, last.x, last.y)
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.lineWidth = lineWidth
  context.strokeStyle = strokeStyle
  context.stroke()
}

const normalizeHeadDirection = (points: Vector2[]): Vector2 => {
  const head = points[0]
  const next = points[1] ?? { x: head.x - 1, y: head.y }
  const direction = {
    x: head.x - next.x,
    y: head.y - next.y,
  }
  const length = Math.hypot(direction.x, direction.y) || 1
  return {
    x: direction.x / length,
    y: direction.y / length,
  }
}

const drawBackground = (
  context: CanvasRenderingContext2D,
  size: WorldSize,
  time: number,
  collisionFlash: number,
): void => {
  const baseGradient = context.createLinearGradient(0, 0, size.width, size.height)
  baseGradient.addColorStop(0, '#071218')
  baseGradient.addColorStop(0.45, '#0a1d21')
  baseGradient.addColorStop(1, '#05090d')
  context.fillStyle = baseGradient
  context.fillRect(0, 0, size.width, size.height)

  const bloom = context.createRadialGradient(
    size.width * 0.62,
    size.height * 0.38,
    10,
    size.width * 0.62,
    size.height * 0.38,
    size.width * 0.7,
  )
  bloom.addColorStop(0, withAlpha('#37f6cc', 0.18))
  bloom.addColorStop(1, withAlpha('#37f6cc', 0))
  context.fillStyle = bloom
  context.fillRect(0, 0, size.width, size.height)

  for (let index = 0; index < 24; index += 1) {
    const x = ((index * 91.7 + time * 22) % (size.width + 120)) - 60
    const y = (index * 47.3) % size.height
    const radius = 1.5 + (index % 3)
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fillStyle = withAlpha('#a8fff0', 0.06 + (index % 4) * 0.02)
    context.fill()
  }

  context.strokeStyle = withAlpha('#7dfbe1', 0.05)
  context.lineWidth = 1
  for (let x = 0; x <= size.width; x += 64) {
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, size.height)
    context.stroke()
  }
  for (let y = 0; y <= size.height; y += 64) {
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(size.width, y)
    context.stroke()
  }

  if (collisionFlash > 0) {
    context.fillStyle = withAlpha('#ff8066', collisionFlash * 0.28)
    context.fillRect(0, 0, size.width, size.height)
  }
}

const drawCollectible = (context: CanvasRenderingContext2D, collectible: Collectible, time: number): void => {
  const config = COLLECTIBLE_CONFIG[collectible.kind]
  const pulse = 0.92 + Math.sin(time * 5 + collectible.spawnedAt * 6) * 0.12
  const radius = collectible.radius * pulse

  context.save()
  context.translate(collectible.position.x, collectible.position.y)
  context.shadowBlur = 22
  context.shadowColor = config.glow

  context.beginPath()
  context.arc(0, 0, radius + 6, 0, Math.PI * 2)
  context.strokeStyle = withAlpha(config.glow, 0.2)
  context.lineWidth = 2
  context.stroke()

  context.beginPath()
  context.arc(0, 0, radius, 0, Math.PI * 2)
  const fill = context.createRadialGradient(-radius * 0.3, -radius * 0.3, 2, 0, 0, radius)
  fill.addColorStop(0, withAlpha('#ffffff', 0.82))
  fill.addColorStop(0.32, config.color)
  fill.addColorStop(1, withAlpha(config.glow, 0.55))
  context.fillStyle = fill
  context.fill()

  context.shadowBlur = 0
  context.fillStyle = withAlpha('#031417', 0.88)
  context.font = `600 ${Math.max(10, radius)}px "Segoe UI", sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(config.shortLabel, 0, 1)

  if (collectible.kind === 'parasite-mass') {
    context.strokeStyle = withAlpha('#ffd1aa', 0.45)
    context.lineWidth = 2
    for (let arm = 0; arm < 5; arm += 1) {
      const angle = (Math.PI * 2 * arm) / 5 + time * 0.2
      context.beginPath()
      context.moveTo(Math.cos(angle) * radius * 0.5, Math.sin(angle) * radius * 0.5)
      context.lineTo(Math.cos(angle) * radius * 1.45, Math.sin(angle) * radius * 1.45)
      context.stroke()
    }
  }

  if (collectible.kind === 'sticky-spore') {
    context.fillStyle = withAlpha('#fff2bc', 0.25)
    for (let dot = 0; dot < 4; dot += 1) {
      const angle = (Math.PI * 2 * dot) / 4 + time * 0.6
      context.beginPath()
      context.arc(Math.cos(angle) * radius * 0.65, Math.sin(angle) * radius * 0.65, 2.5, 0, Math.PI * 2)
      context.fill()
    }
  }

  context.restore()
}

const drawSnake = (context: CanvasRenderingContext2D, segments: SnakeSegment[], time: number): void => {
  if (segments.length === 0) {
    return
  }

  const wrigglePoints = buildWrigglePoints(segments, time)
  const glowWidth = GAME_CONFIG.bodyRadius * 2.25
  const bodyWidth = GAME_CONFIG.bodyRadius * 1.72

  strokeCurve(context, wrigglePoints, glowWidth, withAlpha('#37f6d9', 0.12))
  strokeCurve(context, wrigglePoints, glowWidth * 0.82, withAlpha('#64ffee', 0.18))

  context.save()
  context.shadowBlur = 18
  context.shadowColor = withAlpha('#47ffe4', 0.72)
  strokeCurve(context, wrigglePoints, bodyWidth, '#174f4c')
  strokeCurve(context, wrigglePoints, bodyWidth * 0.76, '#50f7c0')
  strokeCurve(context, wrigglePoints, bodyWidth * 0.3, withAlpha('#d3fff4', 0.95))
  context.restore()

  const head = wrigglePoints[0]
  const headDirection = normalizeHeadDirection(wrigglePoints)
  const eyeNormal = { x: -headDirection.y, y: headDirection.x }
  const jawOffset = GAME_CONFIG.bodyRadius * 0.58

  context.save()
  context.translate(head.x, head.y)
  context.shadowBlur = 20
  context.shadowColor = withAlpha('#7bfff2', 0.85)
  context.beginPath()
  context.ellipse(0, 0, GAME_CONFIG.bodyRadius * 1.15, GAME_CONFIG.bodyRadius * 0.96, 0, 0, Math.PI * 2)
  context.fillStyle = '#67ffd0'
  context.fill()

  context.fillStyle = '#082328'
  for (const eyeDirection of [-1, 1]) {
    context.beginPath()
    context.arc(
      headDirection.x * jawOffset + eyeNormal.x * eyeDirection * 5,
      headDirection.y * jawOffset + eyeNormal.y * eyeDirection * 5,
      2.6,
      0,
      Math.PI * 2,
    )
    context.fill()
  }
  context.restore()
}

const drawEventStack = (context: CanvasRenderingContext2D, state: GameState): void => {
  context.save()
  context.textAlign = 'left'
  context.textBaseline = 'top'
  context.font = '600 15px "Segoe UI", sans-serif'

  state.events.forEach((event, index) => {
    const alpha = clamp(event.remaining / 2.4, 0, 1)
    const y = 26 + index * 28
    context.fillStyle = withAlpha('#051416', 0.45 * alpha)
    context.fillRect(24, y - 4, 280, 22)
    context.fillStyle = withAlpha(event.color, alpha)
    context.fillText(event.text, 34, y)
  })

  context.restore()
}

export class GameRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly context: CanvasRenderingContext2D

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Canvas context is unavailable.')
    }

    this.canvas = canvas
    this.context = context
  }

  resize(size: WorldSize): void {
    const pixelRatio = window.devicePixelRatio || 1
    this.canvas.width = Math.floor(size.width * pixelRatio)
    this.canvas.height = Math.floor(size.height * pixelRatio)
    this.canvas.style.width = `${size.width}px`
    this.canvas.style.height = `${size.height}px`
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  }

  render(state: GameState, now: number): void {
    drawBackground(this.context, state.world, now, state.collisionFlash)
    for (const collectible of state.collectibles) {
      drawCollectible(this.context, collectible, now)
    }
    drawSnake(this.context, state.segments, now)
    drawEventStack(this.context, state)
  }
}

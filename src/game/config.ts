import type { CollectibleKind, Direction } from './types'

export const STORAGE_KEYS = {
  highScore: 'reverse-snake-h5:high-score',
  hasSeenIntro: 'reverse-snake-h5:has-seen-intro',
} as const

export const GAME_CONFIG = {
  minWorldWidth: 900,
  minWorldHeight: 560,
  maxWorldWidth: 1340,
  maxWorldHeight: 820,
  canvasPadding: 28,
  bodyRadius: 15,
  segmentSpacing: 20,
  pathLaneGap: 52,
  pathMargin: 56,
  baseSpeed: 110,
  maxSpeed: 260,
  beanSpeedBoost: 1.04,
  pulseSpeedBoost: 1.08,
  overdriveInterval: 12,
  overdriveSpeedBoost: 1.05,
  overdriveTargetRatio: 0.35,
  minLength: 16,
  invulnerableDuration: 1.2,
  slowDuration: 5,
  slowFactor: 0.8,
  stickyDuration: 2.5,
  stickyTurnDelay: 0.16,
  beanShrink: 2,
  pulseShrink: 6,
  parasiteGrowth: 4,
  stickyGrowth: 2,
  survivalScorePerSecondPurge: 1.4,
  survivalScorePerSecondOverdrive: 2.8,
  positiveSpawnCooldown: 8,
  negativeSpawnCooldown: 6.5,
  positiveSpawnChance: 0.55,
  negativeSpawnChance: 0.72,
  collectibleMargin: 78,
  spawnAvoidHead: 140,
  spawnAvoidCollectible: 84,
  spawnAvoidBody: 36,
  collisionGraceSegments: 8,
} as const

export const DIRECTION_VECTORS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

export const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}

export const COLLECTIBLE_CONFIG: Record<
  CollectibleKind,
  {
    label: string
    shortLabel: string
    color: string
    glow: string
    radius: number
    ttl: number | null
    score: number
    group: 'primary' | 'positive' | 'negative'
    weight: number
  }
> = {
  'glow-bean': {
    label: '荧光豆',
    shortLabel: '豆',
    color: '#71f5c2',
    glow: '#65f8ff',
    radius: 12,
    ttl: null,
    score: 10,
    group: 'primary',
    weight: 1,
  },
  'slow-hourglass': {
    label: '减速沙漏',
    shortLabel: '缓',
    color: '#8fd8ff',
    glow: '#c4eeff',
    radius: 15,
    ttl: 12,
    score: 18,
    group: 'positive',
    weight: 1,
  },
  'carapace-shield': {
    label: '甲壳护盾',
    shortLabel: '盾',
    color: '#9dfb8b',
    glow: '#ebff86',
    radius: 16,
    ttl: 11,
    score: 24,
    group: 'positive',
    weight: 0.92,
  },
  'pulse-slicer': {
    label: '脉冲切片',
    shortLabel: '切',
    color: '#8bfff6',
    glow: '#34d3ff',
    radius: 16,
    ttl: 10,
    score: 30,
    group: 'positive',
    weight: 0.84,
  },
  'parasite-mass': {
    label: '寄生团块',
    shortLabel: '腐',
    color: '#ff7685',
    glow: '#ffb17b',
    radius: 17,
    ttl: 10,
    score: 0,
    group: 'negative',
    weight: 1,
  },
  'sticky-spore': {
    label: '重黏孢子',
    shortLabel: '黏',
    color: '#ffb563',
    glow: '#f4ff7b',
    radius: 14,
    ttl: 9,
    score: 0,
    group: 'negative',
    weight: 1,
  },
}

export const POSITIVE_KINDS: CollectibleKind[] = [
  'slow-hourglass',
  'carapace-shield',
  'pulse-slicer',
]

export const NEGATIVE_KINDS: CollectibleKind[] = ['parasite-mass', 'sticky-spore']

export const PHASE_TITLES = {
  purge: '净化阶段',
  overdrive: '过载阶段',
} as const

export const SPEED_LABELS = [
  { threshold: 120, label: '潜伏' },
  { threshold: 155, label: '涌动' },
  { threshold: 195, label: '躁动' },
  { threshold: 999, label: '过载' },
] as const

export const INSTRUCTION_ITEMS = [
  '移动：W / A / S / D 或方向键',
  '暂停：Esc，开始或重开：Space',
  '目标：吃荧光豆让自己变短，缩到目标长度后进入无尽过载',
  '正向物：减速、护盾、切片，帮你稳住局面',
  '负面物：寄生团块和重黏孢子会让身体重新变长',
  '失败：撞墙或撞到自己会结束，除非当前持有护盾',
] as const

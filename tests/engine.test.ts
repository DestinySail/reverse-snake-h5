import { describe, expect, it, vi } from 'vitest'

import {
  applyCollectibleForTests,
  createInitialStateForTests,
  createPersistenceStub,
  stepGameState,
} from '../src/game/engine'
import { createGameStorage } from '../src/game/storage'

describe('reverse snake engine', () => {
  it('shrinks and speeds up after eating a glow bean', () => {
    const state = createInitialStateForTests({ width: 960, height: 640 }, createPersistenceStub())
    state.phase = 'running'
    const previousLength = state.targetLength
    const previousSpeed = state.speedMultiplier

    applyCollectibleForTests(state, 'glow-bean')

    expect(state.targetLength).toBe(previousLength - 2)
    expect(state.speedMultiplier).toBeGreaterThan(previousSpeed)
    expect(state.score).toBe(10)
  })

  it('enters overdrive when target length reaches the threshold', () => {
    const state = createInitialStateForTests({ width: 960, height: 640 }, createPersistenceStub())
    state.phase = 'running'
    state.targetLength = state.overdriveThreshold

    stepGameState(state, 0.016, () => 0.01)

    expect(state.runStage).toBe('overdrive')
    expect(state.score).toBeGreaterThanOrEqual(120)
  })

  it('consumes a shield instead of dying on collision', () => {
    const state = createInitialStateForTests({ width: 960, height: 640 }, createPersistenceStub())
    state.phase = 'running'
    state.shieldCharges = 1
    state.history = [{ x: 10, y: 10 }, { x: 4, y: 10 }]
    state.targetLength = 20
    state.segments = state.segments.slice(0, 20)

    stepGameState(state, 0.016, () => 0.01)

    expect(state.phase).toBe('running')
    expect(state.shieldCharges).toBe(0)
    expect(state.effects.some((effect) => effect.kind === 'invulnerable')).toBe(true)
  })

  it('applies negative growth and sticky turn effect', () => {
    const state = createInitialStateForTests({ width: 960, height: 640 }, createPersistenceStub())
    state.phase = 'running'
    const previousLength = state.targetLength

    applyCollectibleForTests(state, 'sticky-spore')

    expect(state.targetLength).toBe(previousLength + 2)
    expect(state.effects.some((effect) => effect.kind === 'sticky-turn')).toBe(true)
  })
})

describe('storage helpers', () => {
  it('writes the best score to the provided storage adapter', () => {
    const setItem = vi.fn()
    const storage = createGameStorage({
      getItem: () => null,
      setItem,
    })

    storage.setHighScore(246)

    expect(setItem).toHaveBeenCalledWith('reverse-snake-h5:high-score', '246')
  })
})

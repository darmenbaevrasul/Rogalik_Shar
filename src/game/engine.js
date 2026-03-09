import { applyBlessing, createBlessingState, drawBlessingChoices, getDerivedPlayerStats } from './blessings.js'
import { ENEMY_TYPES, PLAYER_BASE, WORLD_HEIGHT, WORLD_WIDTH } from './constants.js'
import { createRng } from './random.js'
import { angleBetween, clamp, distanceSquared, magnitude, normalize } from './utils.js'

const ARENA_MARGIN = 54

function createPlayer() {
  return {
    x: WORLD_WIDTH / 2,
    y: WORLD_HEIGHT / 2,
    vx: 0,
    vy: 0,
    facingX: 1,
    facingY: 0,
    radius: PLAYER_BASE.radius,
    hp: PLAYER_BASE.maxHp,
    maxHp: PLAYER_BASE.maxHp,
    dashCooldown: 0,
    dashTimer: 0,
    dashTrailTimer: 0,
    dashPulseTimer: 0,
    attackCooldown: 0.15,
    hitFlash: 0,
    iframes: 0,
  }
}

function createState(seed, bestScore, bestWave) {
  return {
    mode: 'title',
    modeLabel: 'Ритуал спит',
    statusText: 'Войди в зал и начни оборону печати.',
    runSeed: seed,
    rng: createRng(seed),
    time: 0,
    playTime: 0,
    wave: 0,
    score: 0,
    kills: 0,
    pickedShards: 0,
    nextId: 1,
    cameraShake: 0,
    bannerText: '',
    bannerTimer: 0,
    clearDelay: 0,
    player: createPlayer(),
    blessings: createBlessingState(),
    currentChoices: [],
    enemies: [],
    playerProjectiles: [],
    enemyProjectiles: [],
    pickups: [],
    particles: [],
    spawnEvents: [],
    bestScore,
    bestWave,
  }
}

function nextId(state) {
  const id = state.nextId
  state.nextId += 1
  return id
}

function spawnParticles(state, x, y, amount, color, speed = 140) {
  for (let index = 0; index < amount; index += 1) {
    const angle = state.rng.float(0, Math.PI * 2)
    const velocity = state.rng.float(speed * 0.35, speed)
    state.particles.push({
      id: nextId(state),
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      radius: state.rng.float(2, 5),
      life: state.rng.float(0.22, 0.65),
      maxLife: 0.65,
      color,
    })
  }
}

function addShake(state, amount) {
  state.cameraShake = Math.max(state.cameraShake, amount)
}

function makeSpawnPoint(rng) {
  const side = rng.int(0, 3)
  const offset = rng.float(0.16, 0.84)

  if (side === 0) {
    return { x: WORLD_WIDTH * offset, y: ARENA_MARGIN + 10 }
  }
  if (side === 1) {
    return { x: WORLD_WIDTH - ARENA_MARGIN - 10, y: WORLD_HEIGHT * offset }
  }
  if (side === 2) {
    return { x: WORLD_WIDTH * offset, y: WORLD_HEIGHT - ARENA_MARGIN - 10 }
  }
  return { x: ARENA_MARGIN + 10, y: WORLD_HEIGHT * offset }
}

function createSpawnEvent(state, type, delay) {
  const position = makeSpawnPoint(state.rng)
  return {
    id: nextId(state),
    type,
    x: position.x,
    y: position.y,
    delay,
    phase: 'hidden',
    timer: 0,
    telegraphDuration: type === 'sentinel' ? 1.35 : 0.95,
  }
}

function buildWaveEvents(state, wave) {
  const events = []
  let budget = 6 + wave * 3 + Math.floor(wave / 2)
  let delay = 0.65

  if (wave % 4 === 0) {
    delay += state.rng.float(2.1, 3.2)
    events.push(createSpawnEvent(state, 'sentinel', delay))
    budget -= ENEMY_TYPES.sentinel.budget
  }

  while (budget > 0) {
    const candidates = [
      { type: 'wisp', weight: 6 + wave * 0.4 },
      { type: 'charger', weight: wave >= 2 ? 3 + wave * 0.22 : 0 },
      { type: 'brute', weight: wave >= 3 ? 2 + wave * 0.15 : 0 },
    ].filter((entry) => entry.weight > 0 && ENEMY_TYPES[entry.type].budget <= budget)

    if (!candidates.length) {
      break
    }

    const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0)
    let roll = state.rng.float(0, totalWeight)
    let selected = candidates[0].type

    for (const candidate of candidates) {
      roll -= candidate.weight
      if (roll <= 0) {
        selected = candidate.type
        break
      }
    }

    delay += state.rng.float(0.34, 0.82)
    events.push(createSpawnEvent(state, selected, delay))
    budget -= ENEMY_TYPES[selected].budget
  }

  return events
}

function createEnemy(state, type, x, y) {
  const config = ENEMY_TYPES[type]

  return {
    id: nextId(state),
    type,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: config.radius,
    hp: config.hp,
    maxHp: config.hp,
    damage: config.damage,
    speed: config.speed,
    color: config.color,
    hitFlash: 0,
    dead: false,
    aiState: type === 'charger' ? 'approach' : 'march',
    timer: type === 'charger' ? state.rng.float(0.8, 1.2) : 0,
    attackTimer: type === 'sentinel' ? 3.2 : 0,
    lockedAngle: 0,
    pulse: state.rng.float(0, Math.PI * 2),
  }
}

function startWave(state, wave, audio) {
  state.wave = wave
  state.spawnEvents = buildWaveEvents(state, wave)
  state.currentChoices = []
  state.clearDelay = 0
  state.mode = 'playing'
  state.modeLabel = `Волна ${wave}`
  state.statusText = wave === 1 ? 'Закрой первый разлом и собери осколки.' : `Натиск усиливается. Выживи на волне ${wave}.`
  state.bannerText = wave === 1 ? 'Запечатай разлом' : `Волна ${wave}`
  state.bannerTimer = 1.5
  audio?.playWave()
}

function findNearestEnemy(state, x, y, range) {
  let best = null
  let bestDistance = range * range

  for (const enemy of state.enemies) {
    if (enemy.dead) {
      continue
    }

    const distance = distanceSquared({ x, y }, enemy)
    if (distance < bestDistance) {
      best = enemy
      bestDistance = distance
    }
  }

  return best
}

function dealDamageToPlayer(state, amount, audio, sourceX, sourceY) {
  const player = state.player
  if (player.iframes > 0 || state.mode !== 'playing') {
    return
  }

  player.hp = Math.max(0, player.hp - amount)
  player.iframes = 0.9
  player.hitFlash = 0.35
  addShake(state, 18 + amount * 4)
  spawnParticles(state, player.x, player.y, 12, '#f46d5e', 220)

  const knockback = normalize(player.x - sourceX, player.y - sourceY)
  player.x += knockback.x * 14
  player.y += knockback.y * 14
  player.x = clamp(player.x, ARENA_MARGIN + player.radius, WORLD_WIDTH - ARENA_MARGIN - player.radius)
  player.y = clamp(player.y, ARENA_MARGIN + player.radius, WORLD_HEIGHT - ARENA_MARGIN - player.radius)

  audio?.playPlayerHit()

  if (player.hp <= 0) {
    state.mode = 'gameover'
    state.modeLabel = 'Печать сломлена'
    state.statusText = 'Нажми R или кнопку, чтобы начать новый забег.'
    state.bannerText = 'Забег проигран'
    state.bannerTimer = 2.2
    state.bestScore = Math.max(state.bestScore, state.score)
    state.bestWave = Math.max(state.bestWave, state.wave)
    addShake(state, 28)
    audio?.playGameOver()
  }
}

function spawnScoreShards(state, enemy) {
  const config = ENEMY_TYPES[enemy.type]
  for (let index = 0; index < config.shardCount; index += 1) {
    const angle = state.rng.float(0, Math.PI * 2)
    const distance = state.rng.float(6, enemy.radius + 18)
    state.pickups.push({
      id: nextId(state),
      x: enemy.x + Math.cos(angle) * distance,
      y: enemy.y + Math.sin(angle) * distance,
      vx: Math.cos(angle) * state.rng.float(40, 100),
      vy: Math.sin(angle) * state.rng.float(40, 100),
      radius: 6,
      age: 0,
      value: config.shardValue,
      color: config.color,
      dead: false,
    })
  }
}

function triggerStarlash(state, x, y, audio) {
  const derived = getDerivedPlayerStats(state.blessings)
  if (!derived.starlashDamage) {
    return
  }

  const radiusSquared = derived.starlashRadius * derived.starlashRadius
  addShake(state, 8)

  for (const enemy of state.enemies) {
    if (enemy.dead || distanceSquared(enemy, { x, y }) > radiusSquared) {
      continue
    }

    enemy.hp -= derived.starlashDamage
    enemy.hitFlash = 0.22
    if (enemy.hp <= 0) {
      enemy.dead = true
      state.kills += 1
      spawnScoreShards(state, enemy)
      spawnParticles(state, enemy.x, enemy.y, 10, enemy.color, 220)
    }
  }

  spawnParticles(state, x, y, 18, '#f7d58f', 260)
  audio?.playKill()
}

function killEnemy(state, enemy, audio) {
  enemy.dead = true
  state.kills += 1
  spawnScoreShards(state, enemy)
  spawnParticles(state, enemy.x, enemy.y, enemy.type === 'sentinel' ? 28 : 16, enemy.color, enemy.type === 'sentinel' ? 280 : 210)
  addShake(state, enemy.type === 'sentinel' ? 24 : 10)
  audio?.playKill()
  triggerStarlash(state, enemy.x, enemy.y, audio)
}

function damageEnemy(state, enemy, amount, audio) {
  if (enemy.dead) {
    return
  }

  enemy.hp -= amount
  enemy.hitFlash = 0.18
  spawnParticles(state, enemy.x, enemy.y, amount > 18 ? 8 : 4, enemy.color, 140)
  audio?.playEnemyHit()

  if (enemy.hp <= 0) {
    killEnemy(state, enemy, audio)
  }
}

function firePlayerBolts(state, target, audio) {
  const player = state.player
  const derived = getDerivedPlayerStats(state.blessings)
  const baseAngle = angleBetween(player, target)
  const spreadAngles = [0]

  for (let stack = 0; stack < derived.extraProjectiles; stack += 1) {
    const spread = 0.18 + stack * 0.08
    spreadAngles.push(spread, -spread)
  }

  for (const angleOffset of spreadAngles) {
    const angle = baseAngle + angleOffset
    state.playerProjectiles.push({
      id: nextId(state),
      x: player.x + Math.cos(angle) * (player.radius + 8),
      y: player.y + Math.sin(angle) * (player.radius + 8),
      vx: Math.cos(angle) * PLAYER_BASE.projectileSpeed,
      vy: Math.sin(angle) * PLAYER_BASE.projectileSpeed,
      radius: PLAYER_BASE.projectileRadius,
      damage: PLAYER_BASE.projectileDamage,
      life: 1.15,
      remainingHits: 1 + derived.projectilePierce,
      hitIds: new Set(),
      color: '#7cf2e3',
      dead: false,
    })
  }

  player.attackCooldown = derived.attackInterval
  player.facingX = Math.cos(baseAngle)
  player.facingY = Math.sin(baseAngle)
  audio?.playShot()
}

function spawnEnemyShot(state, x, y, angle, speed, radius, damage) {
  state.enemyProjectiles.push({
    id: nextId(state),
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius,
    damage,
    life: 4.2,
    dead: false,
  })
}

function updateSpawns(state, dt) {
  for (const event of state.spawnEvents) {
    if (event.phase === 'hidden') {
      event.delay -= dt
      if (event.delay <= 0) {
        event.phase = 'telegraph'
        event.timer = event.telegraphDuration
        spawnParticles(state, event.x, event.y, 9, ENEMY_TYPES[event.type].color, 160)
      }
      continue
    }

    event.timer -= dt
    if (event.timer <= 0) {
      state.enemies.push(createEnemy(state, event.type, event.x, event.y))
      event.phase = 'done'
    }
  }

  state.spawnEvents = state.spawnEvents.filter((event) => event.phase !== 'done')
}

function getEnemySeparation(enemy, enemies) {
  let pushX = 0
  let pushY = 0

  for (const other of enemies) {
    if (other.id === enemy.id || other.dead) {
      continue
    }

    const dx = enemy.x - other.x
    const dy = enemy.y - other.y
    const distance = Math.hypot(dx, dy)
    const minDistance = enemy.radius + other.radius + 12

    if (!distance || distance >= minDistance) {
      continue
    }

    const force = (minDistance - distance) / minDistance
    pushX += (dx / distance) * force
    pushY += (dy / distance) * force
  }

  return normalize(pushX, pushY)
}

function updateEnemies(state, dt) {
  const player = state.player

  for (const enemy of state.enemies) {
    if (enemy.dead) {
      continue
    }

    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt * 2.4)
    enemy.pulse += dt * 3

    const toPlayer = normalize(player.x - enemy.x, player.y - enemy.y)
    const separation = getEnemySeparation(enemy, state.enemies)
    let direction = normalize(toPlayer.x + separation.x * 0.65, toPlayer.y + separation.y * 0.65)
    let speed = enemy.speed

    if (enemy.type === 'charger') {
      enemy.timer -= dt

      if (enemy.aiState === 'approach') {
        if (enemy.timer <= 0 && magnitude(player.x - enemy.x, player.y - enemy.y) < 340) {
          enemy.aiState = 'windup'
          enemy.timer = 0.58
          enemy.lockedAngle = angleBetween(enemy, player)
        }
      } else if (enemy.aiState === 'windup') {
        direction = { x: 0, y: 0 }
        speed = 0
        if (enemy.timer <= 0) {
          enemy.aiState = 'charge'
          enemy.timer = 0.5
          enemy.lockedAngle = angleBetween(enemy, player)
        }
      } else if (enemy.aiState === 'charge') {
        direction = { x: Math.cos(enemy.lockedAngle), y: Math.sin(enemy.lockedAngle) }
        speed = enemy.speed * 4.8
        if (enemy.timer <= 0) {
          enemy.aiState = 'recover'
          enemy.timer = 0.45
        }
      } else {
        direction = { x: 0, y: 0 }
        speed = 0
        if (enemy.timer <= 0) {
          enemy.aiState = 'approach'
          enemy.timer = state.rng.float(0.75, 1.3)
        }
      }
    }

    if (enemy.type === 'sentinel') {
      enemy.attackTimer -= dt
      if (enemy.aiState === 'march' && enemy.attackTimer <= 0) {
        enemy.aiState = 'telegraph'
        enemy.timer = 1.15
        enemy.lockedAngle = angleBetween(enemy, player)
      }

      if (enemy.aiState === 'telegraph') {
        direction = { x: 0, y: 0 }
        speed = 0
        enemy.timer -= dt
        if (enemy.timer <= 0) {
          for (let index = 0; index < 12; index += 1) {
            spawnEnemyShot(state, enemy.x, enemy.y, enemy.lockedAngle + (Math.PI * 2 * index) / 12, 220, 12, 1)
          }
          spawnEnemyShot(state, enemy.x, enemy.y, enemy.lockedAngle, 300, 14, 2)
          enemy.aiState = 'recover'
          enemy.timer = 0.6
          enemy.attackTimer = Math.max(2.35, 4.1 - state.wave * 0.08)
          addShake(state, 12)
        }
      } else if (enemy.aiState === 'recover') {
        direction = { x: 0, y: 0 }
        speed = 0
        enemy.timer -= dt
        if (enemy.timer <= 0) {
          enemy.aiState = 'march'
        }
      }
    }

    enemy.vx = direction.x * speed
    enemy.vy = direction.y * speed
    enemy.x += enemy.vx * dt
    enemy.y += enemy.vy * dt
    enemy.x = clamp(enemy.x, ARENA_MARGIN + enemy.radius, WORLD_WIDTH - ARENA_MARGIN - enemy.radius)
    enemy.y = clamp(enemy.y, ARENA_MARGIN + enemy.radius, WORLD_HEIGHT - ARENA_MARGIN - enemy.radius)
  }

  state.enemies = state.enemies.filter((enemy) => !enemy.dead)
}

function updateProjectiles(state, dt, audio) {
  for (const projectile of state.playerProjectiles) {
    projectile.x += projectile.vx * dt
    projectile.y += projectile.vy * dt
    projectile.life -= dt

    if (
      projectile.life <= 0 ||
      projectile.x < -40 ||
      projectile.y < -40 ||
      projectile.x > WORLD_WIDTH + 40 ||
      projectile.y > WORLD_HEIGHT + 40
    ) {
      projectile.dead = true
      continue
    }

    for (const enemy of state.enemies) {
      if (enemy.dead || projectile.hitIds.has(enemy.id)) {
        continue
      }

      const radius = projectile.radius + enemy.radius
      if (distanceSquared(projectile, enemy) > radius * radius) {
        continue
      }

      projectile.hitIds.add(enemy.id)
      projectile.remainingHits -= 1
      damageEnemy(state, enemy, projectile.damage, audio)

      if (projectile.remainingHits <= 0) {
        projectile.dead = true
      }
      break
    }
  }

  for (const projectile of state.enemyProjectiles) {
    projectile.x += projectile.vx * dt
    projectile.y += projectile.vy * dt
    projectile.life -= dt

    if (
      projectile.life <= 0 ||
      projectile.x < -50 ||
      projectile.y < -50 ||
      projectile.x > WORLD_WIDTH + 50 ||
      projectile.y > WORLD_HEIGHT + 50
    ) {
      projectile.dead = true
      continue
    }

    const collisionRadius = projectile.radius + state.player.radius
    if (distanceSquared(projectile, state.player) <= collisionRadius * collisionRadius) {
      projectile.dead = true
      dealDamageToPlayer(state, projectile.damage, audio, projectile.x, projectile.y)
    }
  }

  state.playerProjectiles = state.playerProjectiles.filter((projectile) => !projectile.dead)
  state.enemyProjectiles = state.enemyProjectiles.filter((projectile) => !projectile.dead)
}

function updatePickups(state, dt, audio) {
  const player = state.player

  for (const pickup of state.pickups) {
    pickup.age += dt

    if (pickup.age < 0.25) {
      pickup.x += pickup.vx * dt
      pickup.y += pickup.vy * dt
      pickup.vx *= 0.92
      pickup.vy *= 0.92
    } else {
      const direction = normalize(player.x - pickup.x, player.y - pickup.y)
      const speed = 120 + pickup.age * 180
      pickup.vx = direction.x * speed
      pickup.vy = direction.y * speed
      pickup.x += pickup.vx * dt
      pickup.y += pickup.vy * dt
    }

    const pickupRadius = pickup.radius + player.radius + 10
    if (distanceSquared(pickup, player) <= pickupRadius * pickupRadius) {
      pickup.dead = true
      state.score += pickup.value
      state.pickedShards += 1
      spawnParticles(state, pickup.x, pickup.y, 5, '#ffe38a', 120)
      audio?.playPickup()
    }
  }

  state.pickups = state.pickups.filter((pickup) => !pickup.dead)
}

function updateParticles(state, dt) {
  for (const particle of state.particles) {
    particle.life -= dt
    particle.x += particle.vx * dt
    particle.y += particle.vy * dt
    particle.vx *= 0.95
    particle.vy *= 0.95
  }

  state.particles = state.particles.filter((particle) => particle.life > 0)
}

function updatePlayer(state, dt, input, audio) {
  const player = state.player
  const derived = getDerivedPlayerStats(state.blessings)
  const movement = input.getMovementVector()

  player.attackCooldown = Math.max(0, player.attackCooldown - dt)
  player.dashCooldown = Math.max(0, player.dashCooldown - dt)
  player.dashTimer = Math.max(0, player.dashTimer - dt)
  player.dashTrailTimer = Math.max(0, player.dashTrailTimer - dt)
  player.dashPulseTimer = Math.max(0, player.dashPulseTimer - dt)
  player.iframes = Math.max(0, player.iframes - dt)
  player.hitFlash = Math.max(0, player.hitFlash - dt * 2.8)

  if (input.consumePressed('space') && player.dashCooldown <= 0) {
    const dashDirection = movement.x || movement.y ? movement : normalize(player.facingX || 1, player.facingY || 0)
    player.facingX = dashDirection.x
    player.facingY = dashDirection.y
    player.dashTimer = PLAYER_BASE.dashDuration
    player.dashCooldown = derived.dashCooldown
    player.iframes = PLAYER_BASE.dashDuration + 0.12
    player.dashTrailTimer = 0
    player.dashPulseTimer = 0
    addShake(state, 10)
    spawnParticles(state, player.x, player.y, 16, '#7cf2e3', 220)
    audio?.playDash()
  }

  let moveDirection = movement
  let moveSpeed = PLAYER_BASE.speed

  if (player.dashTimer > 0) {
    moveDirection = normalize(player.facingX || 1, player.facingY || 0)
    moveSpeed = PLAYER_BASE.dashSpeed
    if (player.dashTrailTimer <= 0) {
      player.dashTrailTimer = 0.03
      state.particles.push({
        id: nextId(state),
        x: player.x,
        y: player.y,
        vx: 0,
        vy: 0,
        radius: player.radius * 1.1,
        life: 0.16,
        maxLife: 0.16,
        color: 'rgba(124, 242, 227, 0.46)',
      })
    }

    if (derived.dashBurstDamage && player.dashPulseTimer <= 0) {
      player.dashPulseTimer = 0.06
      const dashRadiusSquared = derived.dashBurstRadius * derived.dashBurstRadius

      for (const enemy of state.enemies) {
        if (enemy.dead || distanceSquared(enemy, player) > dashRadiusSquared) {
          continue
        }
        damageEnemy(state, enemy, derived.dashBurstDamage, audio)
      }
    }
  }

  player.vx = moveDirection.x * moveSpeed
  player.vy = moveDirection.y * moveSpeed
  player.x += player.vx * dt
  player.y += player.vy * dt

  if (movement.x || movement.y) {
    player.facingX = movement.x
    player.facingY = movement.y
  }

  player.x = clamp(player.x, ARENA_MARGIN + player.radius, WORLD_WIDTH - ARENA_MARGIN - player.radius)
  player.y = clamp(player.y, ARENA_MARGIN + player.radius, WORLD_HEIGHT - ARENA_MARGIN - player.radius)

  const target = findNearestEnemy(state, player.x, player.y, PLAYER_BASE.attackRange)
  if (target && player.attackCooldown <= 0) {
    firePlayerBolts(state, target, audio)
  }
}

function resolvePlayerEnemyCollisions(state, audio) {
  const player = state.player

  for (const enemy of state.enemies) {
    const radius = enemy.radius + player.radius
    if (distanceSquared(enemy, player) <= radius * radius) {
      dealDamageToPlayer(state, enemy.damage, audio, enemy.x, enemy.y)
    }
  }
}

function checkWaveTransitions(state) {
  if (state.mode !== 'playing' || state.player.hp <= 0) {
    return
  }

  if (!state.spawnEvents.length && !state.enemies.length) {
    if (!state.clearDelay) {
      state.clearDelay = 0.7
      state.modeLabel = `Волна ${state.wave} отражена`
      state.statusText = 'Зал стабилизировался. Выбери благословение.'
      state.bannerText = 'Разлом закрыт'
      state.bannerTimer = 1.35
      spawnParticles(state, state.player.x, state.player.y, 18, '#f8d58f', 220)
      return
    }

    state.clearDelay -= 1 / 60
    if (state.clearDelay <= 0) {
      state.mode = 'blessing'
      state.modeLabel = 'Выбор дара'
      state.statusText = 'Выбери один дар. Следующая волна начнётся сразу.'
      state.currentChoices = drawBlessingChoices(state.rng, state.blessings)
      state.clearDelay = 0
    }
  }
}

export function createGameModel() {
  let bestScore = 0
  let bestWave = 0
  let state = createState(Math.floor(Math.random() * 1_000_000), bestScore, bestWave)

  function getState() {
    return state
  }

  function startRun(audio) {
    state = createState(Math.floor(Math.random() * 1_000_000), bestScore, bestWave)
    startWave(state, 1, audio)
  }

  function chooseBlessing(index, audio) {
    if (state.mode !== 'blessing') {
      return false
    }

    const choice = state.currentChoices[index]
    if (!choice) {
      return false
    }

    applyBlessing(state, choice.id)
    state.modeLabel = `${choice.name} получено`
    state.statusText = `${choice.name} наполняет печать силой. Готовься к новой волне.`
    startWave(state, state.wave + 1, audio)
    return true
  }

  function tick(dt, input, audio) {
    state.time += dt
    state.cameraShake = Math.max(0, state.cameraShake - dt * 42)
    state.bannerTimer = Math.max(0, state.bannerTimer - dt)
    updateParticles(state, dt)

    if (state.mode !== 'playing') {
      if (state.mode === 'gameover') {
        bestScore = Math.max(bestScore, state.bestScore, state.score)
        bestWave = Math.max(bestWave, state.bestWave, state.wave)
        state.bestScore = bestScore
        state.bestWave = bestWave
      }
      return
    }

    state.playTime += dt
    updatePlayer(state, dt, input, audio)
    updateSpawns(state, dt)
    updateProjectiles(state, dt, audio)
    updateEnemies(state, dt)
    updatePickups(state, dt, audio)
    resolvePlayerEnemyCollisions(state, audio)
    checkWaveTransitions(state)

    if (state.mode === 'gameover') {
      bestScore = Math.max(bestScore, state.score)
      bestWave = Math.max(bestWave, state.wave)
      state.bestScore = bestScore
      state.bestWave = bestWave
    }
  }

  function getTextSnapshot() {
    return JSON.stringify({
      coordinateSystem: 'origin top-left, x right, y down, arena 1600x900',
      mode: state.mode,
      wave: state.wave,
      score: state.score,
      time: Number(state.playTime.toFixed(1)),
      player: {
        x: Number(state.player.x.toFixed(1)),
        y: Number(state.player.y.toFixed(1)),
        hp: state.player.hp,
        maxHp: state.player.maxHp,
        dashCooldown: Number(state.player.dashCooldown.toFixed(2)),
        dashing: state.player.dashTimer > 0,
      },
      enemies: state.enemies.slice(0, 18).map((enemy) => ({
        type: enemy.type,
        x: Number(enemy.x.toFixed(1)),
        y: Number(enemy.y.toFixed(1)),
        hp: Number(enemy.hp.toFixed(1)),
      })),
      enemyShots: state.enemyProjectiles.slice(0, 12).map((shot) => ({
        x: Number(shot.x.toFixed(1)),
        y: Number(shot.y.toFixed(1)),
        r: shot.radius,
      })),
      pickups: state.pickups.slice(0, 12).map((pickup) => ({
        x: Number(pickup.x.toFixed(1)),
        y: Number(pickup.y.toFixed(1)),
        value: pickup.value,
      })),
      portals: state.spawnEvents
        .filter((event) => event.phase === 'telegraph')
        .map((event) => ({
          type: event.type,
          x: Number(event.x.toFixed(1)),
          y: Number(event.y.toFixed(1)),
          t: Number(event.timer.toFixed(2)),
        })),
      blessingChoices: state.mode === 'blessing' ? state.currentChoices.map((choice) => choice.name) : [],
    })
  }

  return {
    getState,
    startRun,
    chooseBlessing,
    tick,
    getTextSnapshot,
  }
}

import { ENEMY_TYPES, WORLD_HEIGHT, WORLD_WIDTH } from './constants.js'
import { clamp } from './utils.js'

function withAlpha(color, alpha) {
  if (color.startsWith('rgba')) {
    return color
  }

  const normalized = color.replace('#', '')
  const pairs = normalized.length === 3 ? normalized.split('').map((value) => value + value) : normalized.match(/.{1,2}/g)
  if (!pairs || pairs.length < 3) {
    return color
  }

  const [r, g, b] = pairs.map((pair) => Number.parseInt(pair, 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function drawBackground(ctx, state) {
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT)
  gradient.addColorStop(0, '#081621')
  gradient.addColorStop(0.55, '#09141c')
  gradient.addColorStop(1, '#04070b')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)

  const bloom = ctx.createRadialGradient(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 40, WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH * 0.45)
  bloom.addColorStop(0, 'rgba(124, 242, 227, 0.16)')
  bloom.addColorStop(0.55, 'rgba(52, 91, 105, 0.08)')
  bloom.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = bloom
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)

  ctx.save()
  ctx.strokeStyle = 'rgba(124, 242, 227, 0.08)'
  ctx.lineWidth = 1
  for (let x = 0; x <= WORLD_WIDTH; x += 120) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, WORLD_HEIGHT)
    ctx.stroke()
  }
  for (let y = 0; y <= WORLD_HEIGHT; y += 120) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(WORLD_WIDTH, y)
    ctx.stroke()
  }
  ctx.restore()

  ctx.save()
  ctx.translate(WORLD_WIDTH / 2, WORLD_HEIGHT / 2)
  ctx.strokeStyle = 'rgba(248, 183, 94, 0.12)'
  ctx.lineWidth = 4
  for (let ring = 0; ring < 3; ring += 1) {
    ctx.beginPath()
    ctx.arc(0, 0, 150 + ring * 115, state.time * 0.09 + ring, state.time * 0.09 + ring + Math.PI * 1.2)
    ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(124, 242, 227, 0.18)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(0, 0, 240 + Math.sin(state.time * 0.8) * 8, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = 'rgba(124, 242, 227, 0.22)'
  ctx.lineWidth = 3
  ctx.strokeRect(44, 44, WORLD_WIDTH - 88, WORLD_HEIGHT - 88)
  ctx.restore()
}

function drawBanner(ctx, state) {
  if (!state.bannerTimer || !state.bannerText) {
    return
  }

  const alpha = clamp(state.bannerTimer / 1.5, 0, 1)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = 'rgba(4, 10, 14, 0.62)'
  ctx.fillRect(WORLD_WIDTH / 2 - 180, 56, 360, 56)
  ctx.strokeStyle = 'rgba(248, 183, 94, 0.28)'
  ctx.strokeRect(WORLD_WIDTH / 2 - 180, 56, 360, 56)
  ctx.fillStyle = '#f7ecd2'
  ctx.font = '700 28px Georgia'
  ctx.textAlign = 'center'
  ctx.fillText(state.bannerText, WORLD_WIDTH / 2, 92)
  ctx.restore()
}

function drawPortals(ctx, state) {
  for (const event of state.spawnEvents) {
    if (event.phase !== 'telegraph') {
      continue
    }

    const color = ENEMY_TYPES[event.type].color
    const pulse = 1 - event.timer / event.telegraphDuration
    const radius = 26 + pulse * (event.type === 'sentinel' ? 46 : 28)

    ctx.save()
    ctx.translate(event.x, event.y)
    ctx.strokeStyle = withAlpha(color, 0.8)
    ctx.lineWidth = event.type === 'sentinel' ? 6 : 4
    ctx.beginPath()
    ctx.arc(0, 0, radius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(248, 183, 94, 0.35)'
    ctx.beginPath()
    ctx.arc(0, 0, radius * 0.65, state.time * 2, state.time * 2 + Math.PI * 1.55)
    ctx.stroke()
    ctx.restore()
  }
}

function drawProjectiles(ctx, projectiles, color, glow) {
  for (const projectile of projectiles) {
    ctx.save()
    ctx.fillStyle = color
    ctx.shadowColor = glow
    ctx.shadowBlur = 16
    ctx.beginPath()
    ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function drawPickups(ctx, pickups, time) {
  for (const pickup of pickups) {
    const pulse = 1 + Math.sin(time * 6 + pickup.id) * 0.16
    ctx.save()
    ctx.fillStyle = 'rgba(255, 227, 138, 0.92)'
    ctx.shadowColor = pickup.color
    ctx.shadowBlur = 18
    ctx.beginPath()
    ctx.arc(pickup.x, pickup.y, pickup.radius * pulse, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function drawParticles(ctx, particles) {
  for (const particle of particles) {
    const alpha = clamp(particle.life / particle.maxLife, 0, 1)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = particle.color
    ctx.beginPath()
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function drawEnemies(ctx, state) {
  for (const enemy of state.enemies) {
    ctx.save()
    ctx.translate(enemy.x, enemy.y)

    if (enemy.type === 'charger' && enemy.aiState === 'windup') {
      ctx.strokeStyle = 'rgba(248, 183, 94, 0.42)'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(0, 0, enemy.radius + 18 + Math.sin(state.time * 18) * 3, 0, Math.PI * 2)
      ctx.stroke()
    }

    if (enemy.type === 'sentinel' && enemy.aiState === 'telegraph') {
      ctx.strokeStyle = 'rgba(233, 111, 99, 0.55)'
      ctx.lineWidth = 8
      ctx.beginPath()
      ctx.arc(0, 0, 74 + (1 - enemy.timer / 1.15) * 48, 0, Math.PI * 2)
      ctx.stroke()
    }

    ctx.fillStyle = enemy.hitFlash > 0 ? '#fef0cb' : enemy.color
    ctx.shadowColor = enemy.color
    ctx.shadowBlur = enemy.type === 'sentinel' ? 30 : 18
    ctx.beginPath()
    ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = 'rgba(6, 12, 16, 0.36)'
    ctx.beginPath()
    ctx.arc(0, 0, enemy.radius * 0.55, 0, Math.PI * 2)
    ctx.fill()

    if (enemy.type === 'sentinel') {
      ctx.strokeStyle = 'rgba(217, 244, 255, 0.9)'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(0, 0, enemy.radius * 0.72, state.time * 0.8, state.time * 0.8 + Math.PI * 1.4)
      ctx.stroke()
    }

    const hpRatio = clamp(enemy.hp / enemy.maxHp, 0, 1)
    if (hpRatio < 0.995 || enemy.type === 'sentinel' || enemy.type === 'brute') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.38)'
      ctx.fillRect(-enemy.radius, -enemy.radius - 18, enemy.radius * 2, 6)
      ctx.fillStyle = enemy.type === 'sentinel' ? '#d9f4ff' : '#f8b75e'
      ctx.fillRect(-enemy.radius, -enemy.radius - 18, enemy.radius * 2 * hpRatio, 6)
    }

    ctx.restore()
  }
}

function drawPlayer(ctx, state) {
  const player = state.player
  const glowColor = player.hitFlash > 0 ? '#f46d5e' : '#7cf2e3'
  const ringRadius = player.radius + 9 + Math.sin(state.time * 8) * 2

  ctx.save()
  ctx.translate(player.x, player.y)
  ctx.shadowColor = glowColor
  ctx.shadowBlur = 24
  ctx.fillStyle = player.hitFlash > 0 ? '#ffe3c5' : '#dffef7'
  ctx.beginPath()
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = withAlpha(glowColor, player.iframes > 0 ? 0.9 : 0.5)
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(0, 0, ringRadius, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = '#0b1720'
  ctx.beginPath()
  ctx.arc(player.facingX * 6, player.facingY * 6, player.radius * 0.38, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d')

  function resize() {
    const ratio = Math.max(1, window.devicePixelRatio || 1)
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.round(rect.width * ratio)
    canvas.height = Math.round(rect.height * ratio)
  }

  function render(state) {
    const ctx = context
    const scaleX = canvas.width / WORLD_WIDTH
    const scaleY = canvas.height / WORLD_HEIGHT
    const shakeX = Math.sin(state.time * 40) * state.cameraShake
    const shakeY = Math.cos(state.time * 36) * state.cameraShake * 0.72

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0)
    ctx.save()
    ctx.translate(shakeX, shakeY)

    drawBackground(ctx, state)
    drawPortals(ctx, state)
    drawPickups(ctx, state.pickups, state.time)
    drawProjectiles(ctx, state.playerProjectiles, '#dffef7', '#7cf2e3')
    drawProjectiles(ctx, state.enemyProjectiles, '#f8b75e', '#e96f63')
    drawEnemies(ctx, state)
    drawPlayer(ctx, state)
    drawParticles(ctx, state.particles)
    drawBanner(ctx, state)

    ctx.restore()

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    const vignette = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      canvas.height * 0.18,
      canvas.width / 2,
      canvas.height / 2,
      canvas.width * 0.7,
    )
    vignette.addColorStop(0, 'rgba(0,0,0,0)')
    vignette.addColorStop(1, 'rgba(0,0,0,0.26)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  return {
    resize,
    render,
  }
}

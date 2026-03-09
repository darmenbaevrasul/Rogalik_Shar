export const WORLD_WIDTH = 1600
export const WORLD_HEIGHT = 900
export const FIXED_DT = 1 / 60

export const PLAYER_BASE = {
  radius: 20,
  speed: 290,
  dashSpeed: 760,
  dashDuration: 0.18,
  dashCooldown: 2.6,
  attackInterval: 0.48,
  projectileSpeed: 780,
  projectileDamage: 22,
  projectileRadius: 8,
  attackRange: 470,
  maxHp: 5,
}

export const ENEMY_TYPES = {
  wisp: {
    name: 'Wisp',
    radius: 18,
    speed: 128,
    hp: 22,
    damage: 1,
    budget: 1,
    shardValue: 7,
    shardCount: 2,
    color: '#7cf2e3',
  },
  charger: {
    name: 'Charger',
    radius: 22,
    speed: 108,
    hp: 44,
    damage: 1,
    budget: 2,
    shardValue: 10,
    shardCount: 3,
    color: '#f8b75e',
  },
  brute: {
    name: 'Brute',
    radius: 30,
    speed: 84,
    hp: 88,
    damage: 2,
    budget: 3,
    shardValue: 14,
    shardCount: 4,
    color: '#e96f63',
  },
  sentinel: {
    name: 'Sentinel',
    radius: 42,
    speed: 62,
    hp: 280,
    damage: 2,
    budget: 8,
    shardValue: 32,
    shardCount: 8,
    color: '#d9f4ff',
  },
}

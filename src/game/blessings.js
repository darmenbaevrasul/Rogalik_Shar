import { PLAYER_BASE } from './constants.js'

const blessingCatalog = [
  {
    id: 'rapidRite',
    name: 'Быстрый Ритуал',
    describe: (level) =>
      level === 0
        ? 'Снаряды вылетают чаще. Темп ритуала растёт сразу.'
        : `Скорость выстрелов ещё выше. Текущий уровень: ${level}.`,
  },
  {
    id: 'splitSigil',
    name: 'Расщеплённый Сигил',
    describe: (level) =>
      level === 0
        ? 'Каждый выстрел получает боковые снаряды и лучше чистит толпу.'
        : `Добавляет ещё одну пару боковых снарядов. Текущий уровень: ${level}.`,
  },
  {
    id: 'bloodWard',
    name: 'Кровавый Оберег',
    describe: (level) =>
      level === 0
        ? 'Даёт +1 к максимуму здоровья и сразу лечит на 2.'
        : `Снова повышает максимум здоровья и лечит ещё на 2. Текущий уровень: ${level}.`,
  },
  {
    id: 'blinkCoil',
    name: 'Катушка Скачка',
    describe: (level) =>
      level === 0
        ? 'Снижает перезарядку рывка, а сам рывок обжигает врагов рядом.'
        : `Рывок перезаряжается быстрее и бьёт сильнее. Текущий уровень: ${level}.`,
  },
  {
    id: 'phaseEdge',
    name: 'Фазовое Лезвие',
    describe: (level) =>
      level === 0
        ? 'Снаряды пробивают ещё одну цель перед исчезновением.'
        : `Снаряды пробивают больше врагов. Текущий уровень: ${level}.`,
  },
  {
    id: 'starlash',
    name: 'Звёздный Хлыст',
    describe: (level) =>
      level === 0
        ? 'Убийства создают вспышку, которая цепляет врагов поблизости.'
        : `Вспышки становятся сильнее и бьют дальше. Текущий уровень: ${level}.`,
  },
]

export function getBlessingCatalog() {
  return blessingCatalog
}

export function createBlessingState() {
  return blessingCatalog.reduce((accumulator, blessing) => {
    accumulator[blessing.id] = 0
    return accumulator
  }, {})
}

export function drawBlessingChoices(rng, blessings, count = 3) {
  const weighted = blessingCatalog.map((blessing) => ({
    blessing,
    weight: 1 / (1 + blessings[blessing.id] * 0.55),
  }))
  const pool = [...weighted]
  const chosen = []

  while (chosen.length < count && pool.length) {
    const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0)
    let roll = rng.float(0, totalWeight)
    let pickIndex = 0

    for (; pickIndex < pool.length; pickIndex += 1) {
      roll -= pool[pickIndex].weight
      if (roll <= 0) {
        break
      }
    }

    const [picked] = pool.splice(Math.min(pickIndex, pool.length - 1), 1)
    chosen.push({
      id: picked.blessing.id,
      name: picked.blessing.name,
      description: picked.blessing.describe(blessings[picked.blessing.id]),
    })
  }

  return chosen
}

export function applyBlessing(state, blessingId) {
  state.blessings[blessingId] += 1

  if (blessingId === 'bloodWard') {
    state.player.maxHp += 1
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 2)
  }
}

export function getDerivedPlayerStats(blessings) {
  return {
    attackInterval: Math.max(0.18, PLAYER_BASE.attackInterval * 0.86 ** blessings.rapidRite),
    extraProjectiles: blessings.splitSigil,
    projectilePierce: blessings.phaseEdge,
    dashCooldown: Math.max(0.85, PLAYER_BASE.dashCooldown - blessings.blinkCoil * 0.38),
    dashBurstDamage: blessings.blinkCoil > 0 ? 8 + blessings.blinkCoil * 6 : 0,
    dashBurstRadius: 56 + blessings.blinkCoil * 18,
    starlashDamage: blessings.starlash > 0 ? 10 + blessings.starlash * 5 : 0,
    starlashRadius: 84 + blessings.starlash * 24,
  }
}

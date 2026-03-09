export function createAudioManager() {
  let muted = false
  let context = null

  function ensureContext() {
    if (context || typeof window === 'undefined') {
      return context
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) {
      return null
    }

    context = new AudioContext()
    return context
  }

  function resume() {
    const audioContext = ensureContext()
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume()
    }
  }

  function playTone({
    frequency = 220,
    duration = 0.16,
    type = 'sine',
    gain = 0.04,
    frequencyEnd = frequency,
    attack = 0.01,
  }) {
    if (muted) {
      return
    }

    const audioContext = ensureContext()
    if (!audioContext || audioContext.state !== 'running') {
      return
    }

    const now = audioContext.currentTime
    const oscillator = audioContext.createOscillator()
    const envelope = audioContext.createGain()

    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, now)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, frequencyEnd), now + duration)

    envelope.gain.setValueAtTime(0.0001, now)
    envelope.gain.linearRampToValueAtTime(gain, now + attack)
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    oscillator.connect(envelope)
    envelope.connect(audioContext.destination)
    oscillator.start(now)
    oscillator.stop(now + duration + 0.02)
  }

  return {
    resume,
    toggleMute() {
      muted = !muted
    },
    isMuted() {
      return muted
    },
    playShot() {
      playTone({ frequency: 520, frequencyEnd: 340, duration: 0.09, gain: 0.028, type: 'triangle' })
    },
    playDash() {
      playTone({ frequency: 280, frequencyEnd: 130, duration: 0.2, gain: 0.05, type: 'sawtooth' })
    },
    playPlayerHit() {
      playTone({ frequency: 180, frequencyEnd: 80, duration: 0.24, gain: 0.06, type: 'square' })
    },
    playEnemyHit() {
      playTone({ frequency: 360, frequencyEnd: 250, duration: 0.08, gain: 0.018, type: 'square' })
    },
    playKill() {
      playTone({ frequency: 610, frequencyEnd: 280, duration: 0.12, gain: 0.03, type: 'triangle' })
    },
    playPickup() {
      playTone({ frequency: 740, frequencyEnd: 980, duration: 0.08, gain: 0.02, type: 'sine' })
    },
    playWave() {
      playTone({ frequency: 210, frequencyEnd: 320, duration: 0.32, gain: 0.04, type: 'triangle' })
      setTimeout(() => {
        playTone({ frequency: 320, frequencyEnd: 420, duration: 0.18, gain: 0.02, type: 'triangle' })
      }, 70)
    },
    playGameOver() {
      playTone({ frequency: 250, frequencyEnd: 90, duration: 0.42, gain: 0.06, type: 'sawtooth' })
    },
  }
}

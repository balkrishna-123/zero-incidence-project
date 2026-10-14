/* Forklift — Warehouse Shift | A-Frame game loop, physics, deliveries and UI. */
(() => {
  'use strict';
  const THREE = AFRAME.THREE;
  const $ = id => document.getElementById(id);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const approach = (value, target, amount) => value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);
  const two = n => String(n).padStart(2, '0');
  const timeText = seconds => `${two(Math.floor(seconds / 60))}:${two(Math.floor(seconds % 60))}`;
  const STORAGE_KEY = 'forklift-warehouse-shift-best-v1';
  const DRIVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyE']);

  class SoundEffects {
    constructor() { this.enabled = false; this.ctx = null; }
    toggle() {
      this.enabled = !this.enabled;
      if (this.enabled) {
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!AudioContext) throw new Error('Audio not supported');
          this.ctx ||= new AudioContext(); this.ctx.resume().catch(() => {}); this.play('on');
        } catch (_) { this.enabled = false; }
      }
      return this.enabled;
    }
    play(type) {
      if (!this.enabled || !this.ctx) return;
      const notes = {
        on: [[520, 0, .10]], pickup: [[440, 0, .09], [660, .10, .13]],
        delivery: [[523, 0, .12], [659, .12, .12], [784, .24, .23]],
        collision: [[140, 0, .12]], reverse: [[510, 0, .08]],
        complete: [[523, 0, .14], [659, .15, .14], [784, .30, .14], [1047, .45, .34]]
      }[type] || [];
      for (const [frequency, delay, duration] of notes) {
        const t = this.ctx.currentTime + delay, osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
        osc.type = type === 'collision' ? 'triangle' : 'sine'; osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(type === 'reverse' ? .035 : .065, t + .01);
        gain.gain.exponentialRampToValueAtTime(.001, t + duration);
        osc.connect(gain); gain.connect(this.ctx.destination); osc.start(t); osc.stop(t + duration + .03);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      }
    }
  }

  class ForkliftGame {
    constructor(scene) {
      this.scene = scene; this.stage = $('game-stage');
      this.world = $('warehouse').components['warehouse-world'];
      this.vehicle = $('forklift').object3D; this.model = $('forklift').components['forklift-model'];
      this.camera = $('game-camera').getObject3D('camera'); $('game-camera').object3D.position.set(0, 0, 0);
      this.keys = new Set(); this.touchKeys = new Map(); this.sound = new SoundEffects();
      this.map = $('minimap-canvas').getContext('2d'); this.cameraMode = 'orbit';
      this.orbitAngle = .48; this.orbitElevation = .88; this.orbitDistance = 35;
      this.cameraFocus = new THREE.Vector3(); this.cameraDesired = new THREE.Vector3(); this.projected = new THREE.Vector3();
      this.uiTime = 0; this.clock = 0; this.lastReverseBeep = -2; this.best = 0;
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      try { this.best = Number(localStorage.getItem(STORAGE_KEY)) || 0; } catch (_) { /* Storage is optional. */ }
      $('best-score').textContent = this.best ? this.best.toLocaleString() : '—';
      if (scene.renderer) {
        scene.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        scene.renderer.toneMappingExposure = 1.07;
        scene.renderer.shadowMap.enabled = true;
        scene.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        scene.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
      }
      this.bindUI(); this.bindKeyboard(); this.bindCamera(); this.reset(); this.resize();
      this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(this.stage);
      $('loading-screen').classList.add('loaded');
      setTimeout(() => { $('loading-screen').hidden = true; }, 550);
      this.stage.setAttribute('aria-label', 'Interactive 3D warehouse. Use W A S D or arrow keys to drive, Q and E for forks, and Space to pick up or deliver a pallet.');
    }

    reset() {
      clearTimeout(this.finishTimer); clearTimeout(this.toastTimer);
      document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
      this.clearInput(); this.status = 'ready'; this.paused = false; this.elapsed = 0; this.score = 0; this.bumps = 0;
      this.active = 0; this.carrying = null; this.speed = 0; this.steer = 0; this.yaw = 0;
      this.liftHeight = .12; this.liftTarget = .12; this.deliverySequence = null;
      this.lastCollision = -10; this.lastDeliveryTime = 0; this.lastDeliveryBumps = 0;
      this.vehicle.position.set(1, 0, 8.5); this.vehicle.rotation.set(0, 0, 0);
      this.model.liftGroup.position.y = this.liftHeight;
      for (const pallet of this.world.pallets) {
        this.world.root.add(pallet.group); pallet.group.position.set(pallet.start.x, 0, pallet.start.z);
        pallet.group.rotation.set(0, 0, 0); pallet.delivered = false;
      }
      for (const bay of this.world.bays) { bay.material.color.set('#cdddb9'); bay.material.emissive.set('#000000'); }
      this.cameraFocus.set(.68, .55, 1.8); this.updateCamera(1, true);
      $('toast').classList.remove('visible'); $('celebration').replaceChildren();
      $('floating-score').classList.remove('animate'); $('start-button').hidden = false; $('task-key-hint').hidden = true;
      $('action-button').disabled = false; $('target-marker').hidden = false;
      this.renderManifest(); this.renderHUD(); this.updateWayfinding(); this.updateMarker(); this.drawMap();
    }

    start() {
      if (this.status !== 'ready' || this.paused) return;
      this.status = 'playing'; $('start-button').hidden = true; $('task-key-hint').hidden = false;
      $('manifest-status').textContent = 'A good shift starts with one lift';
      this.renderHUD();
    }

    pressed(...codes) {
      return codes.some(code => this.keys.has(code) || [...this.touchKeys.values()].includes(code));
    }

    clearInput() {
      this.keys.clear(); this.touchKeys.clear();
      document.querySelectorAll('[data-key].pressed').forEach(el => el.classList.remove('pressed'));
    }

    bindUI() {
      $('start-button').addEventListener('click', e => { this.start(); e.currentTarget.blur(); });
      document.querySelectorAll('[data-delivery]').forEach(item => {
        item.addEventListener('click', () => {
          if (this.status === 'complete') return;
          const i = Number(item.dataset.delivery);
          if (i < this.active) { this.toast(`Pallet ${two(i + 1)} is already delivered — nice work.`, true); return; }
          if (i > this.active) { this.toast(`Pallet ${two(i + 1)} unlocks as soon as Pallet ${two(this.active + 1)} is delivered. The manifest runs in order.`, true); return; }
          if (this.carrying !== null) this.toast(`Carrying Pallet ${two(this.active + 1)} — follow the green marker to Bay ${two(this.active + 1)}.`);
          else { this.start(); this.toast(`Follow the amber marker to Pallet ${two(this.active + 1)}, then press Space at the forks.`); }
          this.pulseMarker();
        });
      });
      $('action-button').addEventListener('click', e => { this.act(); e.currentTarget.blur(); });
      $('camera-button').addEventListener('click', e => { this.switchCamera(); e.currentTarget.blur(); });
      $('sound-button').addEventListener('click', e => { this.toggleSound(); e.currentTarget.blur(); });
      $('pause-button').addEventListener('click', () => this.pause());
      $('fullscreen-button').addEventListener('click', e => { this.fullscreen(); e.currentTarget.blur(); });
      $('restart-button').addEventListener('click', () => this.askRestart());
      $('pause-restart').addEventListener('click', () => { $('pause-dialog').close(); this.askRestart(); });
      $('confirm-restart').addEventListener('click', () => this.reset());
      $('play-again').addEventListener('click', () => { this.reset(); this.start(); });
      document.querySelectorAll('[data-open-guide]').forEach(button => button.addEventListener('click', () => this.showDialog('guide-dialog')));
      document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
      document.querySelectorAll('dialog').forEach(dialog => {
        dialog.addEventListener('close', () => {
          this.paused = !!document.querySelector('dialog[open]'); this.clearInput(); this.renderHUD();
        });
        // Clicking the actual backdrop, not the dialog contents, closes non-final dialogs.
        dialog.addEventListener('click', event => {
          const rect = dialog.getBoundingClientRect();
          if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
        });
      });
      document.querySelectorAll('[data-key]').forEach(button => {
        button.addEventListener('pointerdown', event => {
          if (this.paused || this.status === 'complete') return;
          event.preventDefault(); this.start(); this.touchKeys.set(event.pointerId, button.dataset.key);
          button.classList.add('pressed'); button.setPointerCapture(event.pointerId);
        });
        const release = event => {
          this.touchKeys.delete(event.pointerId);
          if (![...this.touchKeys.values()].includes(button.dataset.key)) button.classList.remove('pressed');
        };
        button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
        // Keyboard access to the touch controls gives a short, deliberate nudge.
        button.addEventListener('click', event => {
          if (event.detail !== 0 || this.paused || this.status === 'complete') return;
          this.start(); const token = `button-${button.dataset.key}`; this.touchKeys.set(token, button.dataset.key);
          setTimeout(() => this.touchKeys.delete(token), 260);
        });
      });
      window.addEventListener('blur', () => { this.clearInput(); if (this.status === 'playing' && !this.paused) this.pause(); });
      document.addEventListener('visibilitychange', () => { if (document.hidden) { this.clearInput(); if (this.status === 'playing' && !this.paused) this.pause(); } });
      document.addEventListener('fullscreenchange', () => {
        $('fullscreen-button').setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'); this.resize();
      });
    }

    bindKeyboard() {
      window.addEventListener('keydown', event => {
        if (document.querySelector('dialog[open]')) return;
        if (event.ctrlKey || event.metaKey || event.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
        const code = event.code;
        if (DRIVE_KEYS.has(code)) {
          event.preventDefault(); if (this.status === 'complete') return;
          this.keys.add(code); this.start(); this.refreshKeys();
        } else if (code === 'Space') {
          // Preserve native keyboard activation when a non-game button has focus.
          if (event.target.closest('button') && event.target.id !== 'action-button') return;
          event.preventDefault(); if (!event.repeat) this.act();
        } else if (!event.repeat && code === 'KeyC') { event.preventDefault(); this.switchCamera(); }
        else if (!event.repeat && code === 'KeyR') { event.preventDefault(); this.askRestart(); }
        else if (!event.repeat && code === 'Escape') {
          event.preventDefault(); if (this.stage.classList.contains('expanded')) this.fullscreen(); else this.pause();
        }
      });
      window.addEventListener('keyup', event => { this.keys.delete(event.code); this.refreshKeys(); });
    }

    refreshKeys() {
      const aliases = { KeyW: 'ArrowUp', KeyS: 'ArrowDown', KeyA: 'ArrowLeft', KeyD: 'ArrowRight' };
      document.querySelectorAll('[data-key]').forEach(button => button.classList.toggle('pressed', this.pressed(button.dataset.key, aliases[button.dataset.key])));
    }

    bindCamera() {
      let drag = null;
      this.stage.addEventListener('pointerdown', event => {
        if (event.target.tagName !== 'CANVAS' || event.target.id === 'minimap-canvas' || this.cameraMode !== 'orbit') return;
        if (event.button !== 0 && event.button !== 2) return;
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
        event.target.setPointerCapture(event.pointerId); event.target.style.cursor = 'grabbing';
      });
      this.stage.addEventListener('pointermove', event => {
        if (!drag || drag.id !== event.pointerId) return;
        this.orbitAngle -= (event.clientX - drag.x) * .006;
        this.orbitElevation = clamp(this.orbitElevation + (event.clientY - drag.y) * .004, .48, 1.30);
        drag.x = event.clientX; drag.y = event.clientY;
      });
      const release = event => { if (drag?.id === event.pointerId) { drag = null; event.target.style.cursor = ''; } };
      this.stage.addEventListener('pointerup', release); this.stage.addEventListener('pointercancel', release);
      this.stage.addEventListener('contextmenu', event => { if (event.target.tagName === 'CANVAS') event.preventDefault(); });
      this.stage.addEventListener('wheel', event => {
        if (event.target.tagName !== 'CANVAS') return;
        event.preventDefault(); if (this.cameraMode === 'orbit') this.orbitDistance = clamp(this.orbitDistance + event.deltaY * .018, 22, 57);
      }, { passive: false });
    }

    resize() {
      const width = this.stage.clientWidth, height = this.stage.clientHeight;
      if (!width || !height) return;
      this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
      if (this.scene.resize) this.scene.resize();
      this.stageWidth = width; this.stageHeight = height;
    }

    showDialog(id) {
      this.paused = true; this.speed = 0; this.clearInput();
      const dialog = $(id); if (!dialog.open) dialog.showModal(); this.renderHUD();
    }
    pause() { if (!document.querySelector('dialog[open]')) this.showDialog('pause-dialog'); }
    askRestart() {
      if (this.status === 'ready') { this.reset(); this.toast('Fresh forks. Fresh start.'); return; }
      this.showDialog('restart-dialog');
    }
    toggleSound() {
      const on = this.sound.toggle(); $('sound-icon').setAttribute('href', on ? '#i-sound' : '#i-mute');
      $('sound-button').setAttribute('aria-pressed', String(on)); $('sound-button').setAttribute('aria-label', on ? 'Mute sound effects' : 'Enable sound effects');
      this.toast(on ? 'A little warehouse ambience. Sound is on.' : 'Quiet shift. Sound is off.');
    }
    switchCamera() {
      this.cameraMode = this.cameraMode === 'orbit' ? 'chase' : 'orbit';
      $('camera-label').textContent = this.cameraMode === 'orbit' ? 'Orbit view' : 'Chase view';
      $('camera-tip').textContent = this.cameraMode === 'orbit' ? 'Drag to look around · Scroll to zoom' : 'A closer look · Press C for orbit view';
      this.toast(this.cameraMode === 'orbit' ? 'Orbit view · Drag to look around, scroll to zoom.' : 'Chase view · Right behind you.');
    }
    async fullscreen() {
      if (document.fullscreenElement) { await document.exitFullscreen().catch(() => {}); return; }
      if (this.stage.classList.contains('expanded')) {
        this.stage.classList.remove('expanded'); document.body.classList.remove('expanded-game');
        $('fullscreen-button').setAttribute('aria-label', 'Enter fullscreen'); this.resize(); return;
      }
      try {
        if (!this.stage.requestFullscreen) throw new Error('Fullscreen unavailable');
        await this.stage.requestFullscreen();
      } catch (_) {
        // Works inside embedded previews even when browser fullscreen is disallowed.
        this.stage.classList.add('expanded'); document.body.classList.add('expanded-game');
        $('fullscreen-button').setAttribute('aria-label', 'Exit fullscreen'); this.resize();
      }
    }

    syncActive() {
      // Self-healing guard: the active delivery must always point at an
      // undelivered pallet, so the shift can never stall after a delivery.
      if (this.carrying === null && this.active < 3 && this.world.pallets[this.active]?.delivered) {
        const next = this.world.pallets.find((pallet) => !pallet.delivered);
        this.active = next ? next.id : 3;
        this.renderManifest(); this.updateWayfinding();
      }
    }
    pulseMarker() {
      const marker = $('target-marker');
      marker.classList.remove('pulse'); void marker.offsetWidth; marker.classList.add('pulse');
      setTimeout(() => marker.classList.remove('pulse'), 1200);
    }
    tick(time, delta) {
      if (!Number.isFinite(delta)) return;
      if (this.status === 'playing' && !this.paused) this.syncActive();
      const dt = Math.min(delta / 1000, .05); this.clock = time / 1000;
      if (this.status === 'playing' && !this.paused) {
        this.elapsed += dt;
        if (this.deliverySequence) this.updateDelivery(dt);
        else this.drive(dt);
        this.updateLift(dt);
        this.model.animate(this.speed * dt, this.steer, this.liftHeight, this.clock);
        if (this.speed < -.5 && this.clock - this.lastReverseBeep > 1.1) { this.sound.play('reverse'); this.lastReverseBeep = this.clock; }
      } else this.model.animate(0, this.steer, this.liftHeight, this.clock);
      this.updateCamera(dt); this.updateMarker();
      this.world.ring.scale.setScalar(this.reducedMotion ? 1 : 1 + Math.sin(this.clock * 2.8) * .027);
      this.uiTime += dt;
      if (this.uiTime > .09) { this.uiTime = 0; this.renderHUD(); this.updateWayfinding(); this.drawMap(); }
    }

    drive(dt) {
      const throttle = Number(this.pressed('KeyW', 'ArrowUp')) - Number(this.pressed('KeyS', 'ArrowDown'));
      const turn = Number(this.pressed('KeyA', 'ArrowLeft')) - Number(this.pressed('KeyD', 'ArrowRight'));
      const topSpeed = this.carrying !== null ? (this.liftHeight > 1.4 ? 2.15 : 3.25) : 4.2;
      const target = throttle > 0 ? topSpeed : throttle < 0 ? -2.45 : 0;
      const acceleration = throttle === 0 ? 4.0 : Math.sign(target) !== Math.sign(this.speed) ? 6.8 : 3.2;
      this.speed = approach(this.speed, target, dt * acceleration); this.steer = approach(this.steer, turn, dt * 5);
      const yaw = this.yaw + this.steer * this.speed * .39 / (1 + Math.abs(this.speed) * .045) * dt;
      const x = this.vehicle.position.x - Math.sin(yaw) * this.speed * dt;
      const z = this.vehicle.position.z - Math.cos(yaw) * this.speed * dt;
      if (Math.abs(this.speed) > .001 && this.collisionAt(x, z, yaw)) {
        if (Math.abs(this.speed) > 1.0 && this.clock - this.lastCollision > 1.35) {
          this.bumps++; this.score = Math.max(0, this.score - 75); this.lastCollision = this.clock;
          this.toast('A little too close. Easy on the corners. −75 points', true); this.sound.play('collision');
        }
        this.speed = 0;
      } else { this.vehicle.position.set(x, 0, z); this.yaw = yaw; this.vehicle.rotation.y = this.yaw; }
      if (Math.abs(this.speed) < .006) this.speed = 0;
    }

    collisionAt(x, z, yaw) {
      const sin = Math.sin(yaw), cos = Math.cos(yaw);
      const samples = [{ x: x + sin * .13, z: z + cos * .13, radius: .80 }, { x: x - sin * 2.2, z: z - cos * 2.2, radius: .22 }];
      if (this.carrying !== null) samples.push({ x: x - sin * 1.92, z: z - cos * 1.92, radius: .78 });
      for (const p of samples) {
        if (p.x - p.radius < -16.48 || p.x + p.radius > 16.45 || p.z - p.radius < -18.20 || p.z + p.radius > 17.95) return true;
        for (const obstacle of this.world.colliders) if (this.circleRect(p.x, p.z, p.radius, obstacle)) return true;
      }
      // The tines can enter an unloaded pallet; the chassis cannot drive through it.
      for (const pallet of this.world.pallets) {
        if (pallet.id === this.carrying) continue;
        const p = pallet.group.position;
        if (this.circleRect(samples[0].x, samples[0].z, .68, { x: p.x, z: p.z, hw: .74, hd: .56 })) return true;
      }
      return false;
    }
    circleRect(x, z, radius, obstacle) {
      const dx = x - clamp(x, obstacle.x - obstacle.hw, obstacle.x + obstacle.hw);
      const dz = z - clamp(z, obstacle.z - obstacle.hd, obstacle.z + obstacle.hd);
      return dx * dx + dz * dz < radius * radius;
    }

    updateLift(dt) {
      if (!this.deliverySequence) {
        const input = Number(this.pressed('KeyE')) - Number(this.pressed('KeyQ'));
        if (input) this.liftTarget = clamp(this.liftTarget + input * dt * 1.05, .10, 2.10);
      }
      this.liftHeight = approach(this.liftHeight, this.liftTarget, dt * .95);
    }
    loadCenter() {
      return { x: this.vehicle.position.x - Math.sin(this.yaw) * 1.92, z: this.vehicle.position.z - Math.cos(this.yaw) * 1.92 };
    }
    interaction() {
      if (this.active >= 3) return { near: false, ready: false, distance: 0 };
      const load = this.loadCenter();
      const target = this.carrying !== null ? this.world.bays[this.active] : this.world.pallets[this.active].group.position;
      const distance = Math.hypot(target.x - load.x, target.z - load.z);
      const near = this.carrying !== null ? Math.abs(load.x - target.x) < 1.60 && Math.abs(load.z - target.z) < 1.75 : distance < 1.13;
      const slow = Math.abs(this.speed) < .55;
      const low = this.carrying !== null || this.liftHeight < .39;
      return { near, slow, low, distance, ready: near && slow && low };
    }

    act() {
      if (this.paused || this.status === 'complete' || this.deliverySequence) return;
      this.start(); const info = this.interaction();
      if (!info.near) {
        this.toast(this.carrying !== null ? `Your load belongs in Bay ${two(this.active + 1)}. Follow the green marker.` : `Bring your forks up to pallet ${two(this.active + 1)}. Follow the amber marker.`, true); return;
      }
      if (!info.slow) { this.toast('Easy there. Come to a stop before handling a load.', true); return; }
      if (!info.low) { this.toast('Lower your forks with Q (or the down button), then lift.', true); return; }
      this.speed = 0;
      if (this.carrying === null) this.pickUp(); else this.beginDelivery();
    }
    pickUp() {
      const pallet = this.world.pallets[this.active];
      this.carrying = this.active;
      this.model.liftGroup.add(pallet.group); pallet.group.position.set(0, .082, -.84); pallet.group.rotation.set(0, 0, 0);
      this.liftTarget = .54;
      this.world.bays[this.active].material.color.set('#d6e8b2');
      this.world.bays[this.active].material.emissive.set('#25360f'); this.world.bays[this.active].material.emissiveIntensity = .13;
      this.sound.play('pickup'); this.toast(`Nice lift. Next stop: Bay ${two(this.active + 1)}.`);
      this.renderManifest(); this.renderHUD(); this.updateWayfinding();
    }
    beginDelivery() {
      this.deliverySequence = { time: 0, id: this.carrying }; this.liftTarget = .10; this.clearInput();
      this.toast('Setting it down. A little care goes a long way.');
    }
    updateDelivery(dt) {
      this.deliverySequence.time += dt;
      if (this.liftHeight <= .115 && this.deliverySequence.time > .6) this.finishDelivery();
    }
    finishDelivery() {
      const id = this.deliverySequence.id, pallet = this.world.pallets[id], bay = this.world.bays[id];
      this.world.root.add(pallet.group); pallet.group.position.set(bay.x, 0, bay.z); pallet.group.rotation.set(0, 0, 0); pallet.delivered = true;
      this.carrying = null; this.deliverySequence = null; this.liftTarget = .12;
      bay.material.color.set('#bbd29d'); bay.material.emissive.set('#000000');
      const careBonus = Math.max(0, 250 - (this.bumps - this.lastDeliveryBumps) * 75);
      const efficiencyBonus = Math.max(0, 250 - Math.floor((this.elapsed - this.lastDeliveryTime) * 2));
      const points = 1000 + careBonus + efficiencyBonus;
      this.score += points; this.lastDeliveryTime = this.elapsed; this.lastDeliveryBumps = this.bumps; this.active++;
      this.sound.play('delivery'); this.floatScore(points);
      if (this.active < 3) this.toast(`Right where it belongs. +${points.toLocaleString()} points. Pallet ${two(this.active + 1)} is unlocked — follow the amber marker.`);
      this.renderManifest(); this.renderHUD(); this.updateWayfinding();
      if (this.active === 3) this.complete();
    }
    complete() {
      this.status = 'complete'; this.speed = 0; this.clearInput();
      if (this.score > this.best) {
        this.best = this.score; try { localStorage.setItem(STORAGE_KEY, String(this.best)); } catch (_) {}
        $('best-score').textContent = this.best.toLocaleString();
      }
      $('final-score').textContent = this.score.toLocaleString(); $('final-time').textContent = timeText(this.elapsed);
      const stars = this.bumps === 0 ? 3 : this.bumps < 4 ? 2 : 1;
      $('completion-stars').innerHTML = Array.from({ length: 3 }, (_, i) => `<svg class="icon ${i < stars ? 'earned' : ''}" aria-label="${i < stars ? 'Earned' : 'Empty'} star"><use href="#i-star"/></svg>`).join('');
      $('completion-note').textContent = this.bumps === 0 ? 'Not a single bump. A smooth operator, indeed.' : `${this.bumps} ${this.bumps === 1 ? 'bump' : 'bumps'}, three happy pallets. Practice makes progress.`;
      this.confetti(); this.renderHUD(); this.toast('Manifest complete. That’s a very good shift.');
      this.finishTimer = setTimeout(() => { this.sound.play('complete'); this.showDialog('complete-dialog'); }, 1250);
    }

    updateCamera(dt, snap = false) {
      const p = this.vehicle.position, narrow = (this.stageWidth || this.stage.clientWidth) < 530;
      let focus;
      if (this.cameraMode === 'orbit') {
        focus = new THREE.Vector3(p.x * .80, .5, p.z - (narrow ? 4.5 : 6.7));
        if (snap) this.cameraFocus.copy(focus); else this.cameraFocus.lerp(focus, 1 - Math.exp(-dt * 2.8));
        const elevation = narrow ? Math.max(this.orbitElevation, 1.01) : this.orbitElevation;
        const distance = this.orbitDistance + (narrow ? 5 : 0);
        const horizontal = Math.cos(elevation) * distance;
        this.cameraDesired.set(this.cameraFocus.x + Math.sin(this.orbitAngle) * horizontal,
          this.cameraFocus.y + Math.sin(elevation) * distance,
          this.cameraFocus.z + Math.cos(this.orbitAngle) * horizontal);
      } else {
        const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
        focus = new THREE.Vector3(p.x - sin * 2.2, 1.0, p.z - cos * 2.2);
        if (snap) this.cameraFocus.copy(focus); else this.cameraFocus.lerp(focus, 1 - Math.exp(-dt * 4.8));
        this.cameraDesired.set(p.x + sin * 10.5 + cos * 2.8, 7.5, p.z + cos * 10.5 - sin * 2.8);
      }
      if (snap) this.camera.position.copy(this.cameraDesired);
      else this.camera.position.lerp(this.cameraDesired, 1 - Math.exp(-dt * 5));
      this.camera.lookAt(this.cameraFocus); this.camera.updateMatrixWorld();
    }
    updateWayfinding() {
      const done = this.active >= 3; this.world.ring.visible = !done;
      if (done) { this.world.path.forEach(dash => { dash.visible = false; }); return; }
      const target = this.carrying !== null ? this.world.bays[this.active] : this.world.pallets[this.active].group.position;
      this.world.ring.position.set(target.x, .046, target.z);
      const color = this.carrying !== null ? '#9eb96b' : '#e1ad47';
      this.world.ringMaterial.color.set(color); this.world.pathMaterial.color.set(color);
      const p = this.vehicle.position, dx = target.x - p.x, dz = target.z - p.z, distance = Math.hypot(dx, dz);
      this.world.path.forEach((dash, i) => {
        const d = 1.7 + i * .74; dash.visible = d < distance - 1.75;
        if (dash.visible) { dash.position.set(p.x + dx / distance * d, .035, p.z + dz / distance * d); dash.rotation.y = Math.atan2(dx, dz); }
      });
    }
    updateMarker() {
      const marker = $('target-marker');
      if (this.active >= 3) { marker.hidden = true; return; }
      const target = this.carrying !== null ? this.world.bays[this.active] : this.world.pallets[this.active].group.position;
      this.projected.set(target.x, this.carrying !== null ? .65 : 2.10, target.z).project(this.camera);
      const w = this.stageWidth || this.stage.clientWidth, h = this.stageHeight || this.stage.clientHeight;
      let x = (this.projected.x * .5 + .5) * w, y = (-this.projected.y * .5 + .5) * h;
      if (this.projected.z > 1) { x = this.projected.x > 0 ? 78 : w - 78; y = h - 143; }
      marker.style.left = `${clamp(x, 76, w - 76)}px`; marker.style.top = `${clamp(y, 92, h - 135)}px`;
      marker.hidden = false;
    }
    drawMap() {
      const ctx = this.map, w = 240, h = 258;
      const mx = x => 14 + (x + 17) / 34 * 212, mz = z => 12 + (z + 19) / 38 * 234;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#e9eddf'; ctx.fillRect(8, 5, 224, 248);
      ctx.strokeStyle = '#d8e0cb'; ctx.lineWidth = 2; ctx.strokeRect(8, 5, 224, 248);
      ctx.fillStyle = '#ccd5bf';
      for (const obstacle of this.world.colliders) {
        ctx.fillRect(mx(obstacle.x - obstacle.hw), mz(obstacle.z - obstacle.hd), obstacle.hw * 2 / 34 * 212, obstacle.hd * 2 / 38 * 234);
      }
      for (let i = 0; i < 3; i++) {
        const bay = this.world.bays[i]; ctx.fillStyle = i < this.active ? '#96b577' : '#c0d7a6';
        ctx.fillRect(mx(bay.x - 2.25), mz(bay.z - 2.45), 28, 30);
        ctx.font = '600 9px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = '#7c9860'; ctx.fillText(two(i + 1), mx(bay.x), mz(bay.z) + 3);
      }
      for (const pallet of this.world.pallets) {
        if (pallet.delivered || pallet.id === this.carrying) continue;
        const p = pallet.group.position; ctx.fillStyle = pallet.id === this.active ? '#d9ad54' : '#c8baa0';
        ctx.fillRect(mx(p.x) - 4, mz(p.z) - 4, 8, 8);
      }
      if (this.active < 3) {
        const goal = this.carrying !== null ? this.world.bays[this.active] : this.world.pallets[this.active].group.position;
        ctx.strokeStyle = this.carrying !== null ? '#8ea765' : '#c7ab6a'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.moveTo(mx(this.vehicle.position.x), mz(this.vehicle.position.z)); ctx.lineTo(mx(goal.x), mz(goal.z)); ctx.stroke(); ctx.setLineDash([]);
        ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(mx(goal.x), mz(goal.z), 9 + (this.reducedMotion ? 0 : Math.sin(this.clock * 3) * 1.3), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.save(); ctx.translate(mx(this.vehicle.position.x), mz(this.vehicle.position.z)); ctx.rotate(-this.yaw);
      ctx.fillStyle = '#405847'; ctx.strokeStyle = '#f4f7ea'; ctx.lineWidth = 1.7;
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    }

    renderManifest() {
      $('delivered-count').textContent = this.active;
      $('progress-fill').style.width = `${this.active / 3 * 100}%`;
      document.querySelectorAll('[data-delivery]').forEach((item, i) => {
        item.classList.toggle('active', i === this.active); item.classList.toggle('carried', i === this.carrying);
        item.classList.toggle('delivered', i < this.active); item.classList.toggle('locked', i > this.active);
        const status = item.querySelector('.item-status');
        if (status) status.textContent = i < this.active ? 'DELIVERED' : i === this.carrying ? 'ON BOARD' : i === this.active ? 'UP NEXT' : 'LOCKED';
        item.querySelector('.delivery-check').innerHTML = i < this.active ? '<svg class="icon"><use href="#i-check"/></svg>' : '';
        item.querySelector('p').innerHTML = i < this.active ? `Safely at Bay ${two(i + 1)}` : `Receiving <span>→</span> Bay ${two(i + 1)}`;
      });
      const onBoard = this.carrying !== null, done = this.active >= 3;
      $('task-icon').setAttribute('href', done ? '#i-check' : onBoard ? '#i-box' : '#i-target');
      $('task-title').textContent = done ? 'All in a day’s work.' : onBoard ? `Next stop: Bay ${two(this.active + 1)}.` : this.active === 0 ? 'Meet your first pallet.' : `On to pallet ${two(this.active + 1)}.`;
      $('task-description').textContent = done ? 'Three pallets, safely delivered. The floor looks good on you.' : onBoard ? 'Follow the green marker. Park your load inside its bay and gently set it down.' : 'Follow the amber marker. Line up your forks and get ready to lift.';
      $('task-key-label').textContent = done ? 'A job well done' : onBoard ? 'to place inside the bay' : 'to pick up when close';
      if (done) $('task-key-hint').hidden = true;
      $('manifest-status').textContent = done ? 'Everything in its place' : onBoard ? 'One pallet, coming right up' : this.status === 'ready' ? 'Ready when you are' : `${this.active} delivered. You’re doing great.`;
      $('marker-label').textContent = `${onBoard ? 'BAY' : 'PALLET'} ${two(this.active + 1)}`;
      $('marker-icon').setAttribute('href', onBoard ? '#i-target' : '#i-box');
      $('target-marker').classList.toggle('delivery', onBoard);
    }
    renderHUD() {
      $('shift-time').textContent = timeText(this.elapsed); $('shift-score').textContent = String(this.score).padStart(4, '0');
      $('speed-value').textContent = (Math.abs(this.speed) * 3.6).toFixed(1);
      $('timer-caption').textContent = this.paused ? 'Taking a breather' : this.status === 'complete' ? 'A shift well spent' : 'No time limit';
      $('score-caption').textContent = this.bumps ? `${this.bumps} ${this.bumps === 1 ? 'bump' : 'bumps'} · keep it steady` : 'Make it a clean run';
      $('game-status').textContent = this.paused ? 'SHIFT PAUSED' : this.status === 'playing' ? 'SHIFT IN PROGRESS' : this.status === 'complete' ? 'MANIFEST COMPLETE' : 'ALL SYSTEMS READY';
      const fraction = Math.abs(this.speed) / 4.2;
      document.querySelectorAll('.speed-meter i').forEach((bar, i) => { bar.classList.toggle('on', i < fraction * 10); bar.classList.toggle('fast', i >= 8 && i < fraction * 10); });
      const info = this.interaction(), carrying = this.carrying !== null;
      let hint;
      if (this.status === 'ready') hint = 'Good morning, operator. The floor is yours.';
      else if (this.status === 'complete') hint = 'Three pallets. Three perfect places. Nicely done.';
      else if (this.deliverySequence) hint = 'Gently does it. Setting your pallet down…';
      else if (info.near && !info.slow) hint = 'Easy now. Come to a stop, then press Space.';
      else if (info.near && !info.low) hint = 'Lower your forks with Q, then press Space.';
      else if (info.ready) hint = carrying ? 'Nice parking. Press Space to place your pallet.' : 'Perfect. Press Space to lift your pallet.';
      else if (carrying) hint = `One safe delivery, coming up. Head to green Bay ${two(this.active + 1)}.`;
      else hint = `Point your forks toward pallet ${two(this.active + 1)} and pull up close.`;
      $('context-hint').innerHTML = `<span class="hint-dot"></span>${hint}`;
      $('context-hint').classList.toggle('ready', info.ready && !this.deliverySequence && this.status !== 'ready');
      $('action-label').textContent = this.status === 'complete' ? 'All done' : this.deliverySequence ? 'Placing…' : carrying ? 'Place load' : 'Pick up';
      $('action-button').classList.toggle('ready', info.ready); $('action-button').classList.toggle('carrying', carrying);
      $('action-button').disabled = this.status === 'complete' || !!this.deliverySequence;
      if (this.active < 3) {
        const target = carrying ? this.world.bays[this.active] : this.world.pallets[this.active].group.position;
        const distance = Math.hypot(target.x - this.vehicle.position.x, target.z - this.vehicle.position.z);
        $('marker-distance').textContent = `${Math.round(distance)} m`;
      }
    }

    toast(message, warning = false) {
      clearTimeout(this.toastTimer); $('toast-message').textContent = message;
      $('toast').classList.toggle('warning', warning); $('toast').classList.add('visible');
      this.toastTimer = setTimeout(() => $('toast').classList.remove('visible'), warning ? 3500 : 3000);
    }
    floatScore(points) {
      const element = $('floating-score'); element.classList.remove('animate'); element.textContent = `+${points.toLocaleString()}`;
      void element.offsetWidth; element.classList.add('animate');
    }
    confetti() {
      if (this.reducedMotion) return;
      const colors = ['#b6d786', '#edc675', '#779b72', '#e5eacb', '#e0aa67'];
      for (let i = 0; i < 45; i++) {
        const piece = document.createElement('i'); piece.className = 'confetti';
        piece.style.left = `${Math.random() * 100}%`; piece.style.background = colors[i % colors.length];
        piece.style.animationDelay = `${Math.random() * .8}s`; piece.style.animationDuration = `${2.6 + Math.random() * 1.2}s`;
        piece.style.transform = `rotate(${Math.random() * 180}deg)`; $('celebration').appendChild(piece);
        piece.addEventListener('animationend', () => piece.remove(), { once: true });
      }
    }
  }

  AFRAME.registerComponent('game-loop', {
    tick(time, delta) { if (window.shiftGame) window.shiftGame.tick(time, delta); }
  });

  function init() {
    const scene = $('scene');
    const ready = () => {
      try { window.shiftGame = new ForkliftGame(scene); }
      catch (error) {
        console.error('Unable to start Forklift:', error);
        $('loading-screen').querySelector('h2').textContent = 'The forklift needs a hand.';
        $('loading-screen').querySelector('p').textContent = 'Please reload in a browser with WebGL enabled.';
      }
    };
    if (scene.hasLoaded) ready(); else scene.addEventListener('loaded', ready, { once: true });
    scene.addEventListener('render-target-loaded', () => { if (window.shiftGame) window.shiftGame.resize(); });
    setTimeout(() => {
      if (!window.shiftGame) {
        $('loading-screen').querySelector('h2').textContent = 'Still opening the warehouse…';
        $('loading-screen').querySelector('p').textContent = 'This game needs WebGL. Try an updated Chrome, Firefox, or Safari.';
      }
    }, 15000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();


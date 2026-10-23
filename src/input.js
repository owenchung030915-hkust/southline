export class Input {
  constructor(canvas, getMode) {
    this.canvas = canvas;
    this.getMode = getMode;
    this.keys = new Set();
    this.prev = new Set();
    this.mouse = new Set();
    this.mousePrev = new Set();
    this.lookX = 0;
    this.lookY = 0;
    this.wheel = 0;
    this._onKeyDown = (e) => this.onKeyDown(e);
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseDown = (e) => this.onMouseDown(e);
    this._onMouseUp = (e) => this.mouse.delete(e.button);
    this._onMove = (e) => this.onMove(e);
    this._onWheel = (e) => this.onWheel(e);
    this._onMenu = (e) => e.preventDefault();
    this._onBlur = () => {
      this.keys.clear();
      this.mouse.clear();
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMove);
    window.addEventListener('wheel', this._onWheel, { passive: false });
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('contextmenu', this._onMenu);
  }

  get playing() {
    return this.getMode() === 'play';
  }

  onKeyDown(e) {
    const swallow = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'F1'];
    if (swallow.includes(e.code)) e.preventDefault();
    this.keys.add(e.code);
  }

  onMouseDown(e) {
    if (!this.playing) return;
    if (e.button === 2) e.preventDefault();
    const locked = document.pointerLockElement === this.canvas;
    if (!locked) {
      if (e.target === this.canvas) this.canvas.requestPointerLock?.();
      return;
    }
    this.mouse.add(e.button);
  }

  onMove(e) {
    if (!this.playing || document.pointerLockElement !== this.canvas) return;
    this.lookX += e.movementX;
    this.lookY += e.movementY;
  }

  onWheel(e) {
    if (!this.playing) return;
    e.preventDefault();
    this.wheel += e.deltaY;
  }

  tick(dt) {
    if (!this.playing) return;
    const speed = 980 * dt;
    if (this.keys.has('ArrowLeft')) this.lookX -= speed;
    if (this.keys.has('ArrowRight')) this.lookX += speed;
    if (this.keys.has('ArrowUp')) this.lookY -= speed;
    if (this.keys.has('ArrowDown')) this.lookY += speed;
  }

  endFrame() {
    this.prev = new Set(this.keys);
    this.mousePrev = new Set(this.mouse);
  }

  held(code) {
    return this.keys.has(code);
  }

  just(code) {
    return this.keys.has(code) && !this.prev.has(code);
  }

  mouseHeld(button) {
    return this.mouse.has(button);
  }

  mouseJust(button) {
    return this.mouse.has(button) && !this.mousePrev.has(button);
  }

  get move() {
    let x = 0;
    let z = 0;
    if (this.held('KeyW')) z += 1;
    if (this.held('KeyS')) z -= 1;
    if (this.held('KeyD')) x += 1;
    if (this.held('KeyA')) x -= 1;
    const m = Math.hypot(x, z);
    if (m > 1) {
      x /= m;
      z /= m;
    }
    return { x, z };
  }

  consumeLook() {
    const v = { x: this.lookX, y: this.lookY };
    this.lookX = 0;
    this.lookY = 0;
    return v;
  }

  consumeWheel() {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }
}

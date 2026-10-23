import { SCHEMA, getPath } from './settings.js';

const TIPS = [
  'WASD moves. Click the street to capture the mouse. Arrow keys look as well.',
  'J or left click chains a jab, cross, and hook. K or Q throws the uppercut.',
  'Hold L or the right mouse button to block. X dodges through a swing.',
  'F takes the orange car in the lot. E uses the dock clinic. V locks a rival.',
];

function format(item, value) {
  if (item.type !== 'range') return '';
  if (item.step >= 1) return String(Math.round(Number(value)));
  const digits = item.step < 0.01 ? 3 : item.step < 0.1 ? 2 : 1;
  return Number(value).toFixed(digits);
}

export function createHUD(settings, handlers) {
  const hud = document.getElementById('hud');
  const screen = document.getElementById('screen');
  hud.innerHTML = `
    <div class="vignette"></div>
    <div class="hurt"></div>
    <div class="top-left">
      <div class="bars">
        <div class="bar health"><span></span><em>HEALTH</em></div>
        <div class="bar stamina"><span></span><em>STAMINA</em></div>
      </div>
      <div class="meta"></div>
    </div>
    <div class="top-right">
      <div class="heat"></div>
      <div class="heat-label">HEAT</div>
    </div>
    <div class="objective">
      <div class="wave"></div>
      <div class="sub"></div>
      <div class="score"></div>
    </div>
    <div class="combo"></div>
    <div class="banner"><strong></strong><span></span></div>
    <div class="feed"></div>
    <div class="prompt"></div>
    <div class="hint"></div>
    <div class="reticle"></div>
    <div class="lock-note">CLICK TO CAPTURE THE MOUSE</div>
    <canvas class="minimap" width="168" height="168"></canvas>
    <div class="wasted"><span>WASTED</span></div>
  `;
  const heat = hud.querySelector('.heat');
  for (let i = 0; i < 5; i++) {
    const pip = document.createElement('div');
    pip.className = 'pip';
    heat.appendChild(pip);
  }
  const ui = {
    health: hud.querySelector('.bar.health > span'),
    stamina: hud.querySelector('.bar.stamina > span'),
    meta: hud.querySelector('.meta'),
    pips: [...heat.querySelectorAll('.pip')],
    heatLabel: hud.querySelector('.heat-label'),
    wave: hud.querySelector('.wave'),
    sub: hud.querySelector('.sub'),
    score: hud.querySelector('.score'),
    combo: hud.querySelector('.combo'),
    banner: hud.querySelector('.banner'),
    bannerTitle: hud.querySelector('.banner strong'),
    bannerSub: hud.querySelector('.banner span'),
    feed: hud.querySelector('.feed'),
    prompt: hud.querySelector('.prompt'),
    hint: hud.querySelector('.hint'),
    hurt: hud.querySelector('.hurt'),
    wasted: hud.querySelector('.wasted'),
    vignette: hud.querySelector('.vignette'),
    minimap: hud.querySelector('.minimap'),
    map: hud.querySelector('.minimap').getContext('2d'),
  };

  screen.innerHTML = `
    <section class="sheet menu-card" data-screen="menu">
      <div class="kicker">DOCKSIDE DISTRICT</div>
      <h1>SOUTH<br>LINE</h1>
      <p class="lede">A crew has the south docks. Clear them wave after wave. Heat climbs when you fight and cools if you lay low. The clinic faces the water. The orange car waits in the lot.</p>
      <button class="btn primary" id="btn-play">PLAY</button>
      <div class="btn-row">
        <button class="btn" id="btn-settings">SETTINGS</button>
        <button class="btn" id="btn-controls">CONTROLS</button>
      </div>
      <div class="best" id="best"></div>
    </section>
    <section class="sheet pause-card hidden" data-screen="pause">
      <div class="kicker">PAUSED</div>
      <h2>SOUTHLINE</h2>
      <div class="btn-row" style="margin-top:18px">
        <button class="btn primary" id="btn-resume">RESUME</button>
        <button class="btn" id="btn-settings-2">SETTINGS</button>
        <button class="btn" id="btn-controls-2">CONTROLS</button>
        <button class="btn" id="btn-restart">RESTART</button>
        <button class="btn" id="btn-title">TITLE</button>
      </div>
    </section>
    <section class="sheet controls-card hidden" data-screen="controls">
      <div class="kicker">HANDS</div>
      <h2>CONTROLS</h2>
      <dl>
        <dt>Move</dt><dd>W A S D</dd>
        <dt>Look</dt><dd>Mouse after clicking the street, or the arrow keys</dd>
        <dt>Sprint / jump</dt><dd>Shift / Space</dd>
        <dt>Punch chain</dt><dd>Left click or J — jab, cross, hook</dd>
        <dt>Uppercut</dt><dd>K or Q</dd>
        <dt>Block</dt><dd>Hold right click or L</dd>
        <dt>Dodge</dt><dd>X or Ctrl</dd>
        <dt>Lock on</dt><dd>V</dd>
        <dt>Clinic</dt><dd>E, on the south dock</dd>
        <dt>Car</dt><dd>F to enter or leave. Drive with WASD. Space is the handbrake. H horns.</dd>
        <dt>Mute / pause</dt><dd>M / Esc. F1 opens this list.</dd>
      </dl>
      <p class="lede">Bruisers wear dark leather and keep swinging through light hits during a heavy attack. Heavy hits still stop them. Strikers in red jackets chain punches. Yellow skin on a rival means the swing has not landed yet.</p>
      <button class="btn" id="btn-back">BACK</button>
    </section>
    <section class="sheet settings-card hidden" data-screen="settings">
      <nav class="nav"></nav>
      <div class="settings-body">
        <h2></h2>
        <p class="blurb"></p>
        <div class="settings-grid"></div>
        <div class="settings-actions">
          <button class="btn" id="btn-reset">RESET DEFAULTS</button>
          <button class="btn" id="btn-back-2">BACK</button>
        </div>
      </div>
    </section>
  `;

  const nav = screen.querySelector('.nav');
  const grid = screen.querySelector('.settings-grid');
  const title = screen.querySelector('.settings-body h2');
  const blurb = screen.querySelector('.blurb');
  let groupId = 'gameplay';

  for (const group of SCHEMA) {
    const b = document.createElement('button');
    b.textContent = group.label.toUpperCase();
    b.dataset.group = group.id;
    b.addEventListener('click', () => {
      groupId = group.id;
      renderGroup();
    });
    nav.appendChild(b);
  }

  function renderGroup() {
    const group = SCHEMA.find((g) => g.id === groupId) || SCHEMA[0];
    title.textContent = group.label.toUpperCase();
    blurb.textContent = group.blurb;
    grid.innerHTML = '';
    for (const btn of nav.querySelectorAll('button')) btn.classList.toggle('on', btn.dataset.group === group.id);
    for (const item of group.items) {
      const field = document.createElement('div');
      field.className = 'field' + (item.wide ? ' wide' : '');
      const value = getPath(settings, item.path);
      if (item.type === 'range') {
        field.innerHTML = `<label><span>${item.label}</span><span class="val"></span></label>`;
        const input = document.createElement('input');
        input.type = 'range';
        input.min = item.min;
        input.max = item.max;
        input.step = item.step;
        input.value = value;
        input.dataset.path = item.path;
        input.addEventListener('input', () => handlers.onChange(item.path, Number(input.value)));
        field.appendChild(input);
      } else if (item.type === 'toggle') {
        const label = document.createElement('label');
        label.className = 'toggle';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!value;
        input.dataset.path = item.path;
        input.addEventListener('change', () => handlers.onChange(item.path, input.checked));
        label.append(input, document.createTextNode(item.label));
        field.appendChild(label);
      } else {
        field.innerHTML = `<label><span>${item.label}</span></label>`;
        const select = document.createElement('select');
        select.dataset.path = item.path;
        for (const opt of item.options) {
          const o = document.createElement('option');
          o.value = opt.id;
          o.textContent = opt.label;
          select.appendChild(o);
        }
        select.value = value;
        select.addEventListener('change', () => handlers.onChange(item.path, select.value));
        field.appendChild(select);
      }
      const help = document.createElement('small');
      help.textContent = item.help;
      field.appendChild(help);
      grid.appendChild(field);
    }
    sync();
  }

  function sync() {
    for (const input of grid.querySelectorAll('[data-path]')) {
      const item = SCHEMA.flatMap((g) => g.items).find((it) => it.path === input.dataset.path);
      const value = getPath(settings, input.dataset.path);
      if (input.type === 'checkbox') input.checked = !!value;
      else input.value = value;
      const out = input.parentElement.querySelector('.val') || input.closest('.field')?.querySelector('.val');
      if (out && item) out.textContent = format(item, value);
    }
    const best = Number(localStorage.getItem('southline.best') || 0);
    const bestEl = screen.querySelector('#best');
    bestEl.textContent = best > 0 ? `BEST ${best}` : '';
  }

  let from = 'menu';
  function show(name) {
    for (const el of screen.querySelectorAll('[data-screen]')) {
      el.classList.toggle('hidden', el.dataset.screen !== name);
    }
    screen.style.pointerEvents = name ? 'none' : 'none';
    if (name === 'settings') renderGroup();
  }

  screen.querySelector('#btn-play').addEventListener('click', () => handlers.onPlay());
  screen.querySelector('#btn-settings').addEventListener('click', () => { from = 'menu'; show('settings'); });
  screen.querySelector('#btn-controls').addEventListener('click', () => { from = 'menu'; show('controls'); });
  screen.querySelector('#btn-settings-2').addEventListener('click', () => { from = 'pause'; show('settings'); });
  screen.querySelector('#btn-controls-2').addEventListener('click', () => { from = 'pause'; show('controls'); });
  screen.querySelector('#btn-resume').addEventListener('click', () => handlers.onResume());
  screen.querySelector('#btn-restart').addEventListener('click', () => handlers.onRestart());
  screen.querySelector('#btn-title').addEventListener('click', () => handlers.onTitle());
  const back = () => show(from);
  screen.querySelector('#btn-back').addEventListener('click', back);
  screen.querySelector('#btn-back-2').addEventListener('click', back);
  screen.querySelector('#btn-reset').addEventListener('click', () => handlers.onReset());

  let comboShown = 0;
  let hurtAmt = 0;

  function update(state) {
    ui.health.style.transform = `scaleX(${Math.max(0, state.hp / state.maxHp)})`;
    ui.stamina.style.transform = `scaleX(${Math.max(0, state.stamina / 100)})`;
    ui.meta.textContent = state.driving ? 'IN THE CAR' : state.locked ? 'LOCKED' : '';
    const stars = state.heatEnabled ? state.heat : 0;
    ui.pips.forEach((pip, i) => pip.classList.toggle('on', stars >= i + 0.6));
    ui.heatLabel.style.opacity = state.heatEnabled ? 1 : 0.35;
    ui.heatLabel.textContent = state.heatEnabled ? 'HEAT' : 'HEAT OFF';
    ui.wave.textContent = state.waveText;
    ui.sub.textContent = state.subText;
    ui.score.textContent = `SCORE ${state.score}`;
    if (state.combo > 1) {
      ui.combo.textContent = `${state.combo} HITS`;
      ui.combo.style.opacity = '1';
      if (state.combo !== comboShown) {
        comboShown = state.combo;
        ui.combo.classList.remove('show');
        void ui.combo.offsetWidth;
        ui.combo.classList.add('show');
      }
    } else {
      ui.combo.style.opacity = '0';
      comboShown = 0;
    }
    ui.banner.classList.toggle('show', !!state.banner);
    ui.bannerTitle.textContent = state.banner || '';
    ui.bannerSub.textContent = state.bannerSub || '';
    ui.feed.textContent = state.feed || '';
    ui.prompt.textContent = state.prompt || '';
    ui.hint.textContent = state.hint || '';
    ui.wasted.classList.toggle('show', state.wasted);
    ui.vignette.style.display = state.vignette ? 'block' : 'none';
    ui.minimap.style.display = state.minimap ? 'block' : 'none';
    hurtAmt = Math.max(0, hurtAmt - 0.03);
    if (state.hp / state.maxHp < 0.28 && !state.wasted) ui.hurt.classList.add('low');
    else ui.hurt.classList.remove('low');
    ui.hurt.style.opacity = state.wasted ? 0 : String(Math.max(hurtAmt, ui.hurt.classList.contains('low') ? 0.2 : 0));
    document.body.classList.toggle('playing', state.mode === 'play');
    document.body.classList.toggle('unlocked', state.mode === 'play' && !state.lockedPointer);
    const hidePlayHud = state.mode !== 'play';
    hud.style.opacity = hidePlayHud ? '0' : '1';
  }

  show('menu');
  return {
    ui,
    show,
    sync,
    update,
    back,
    hurt() { hurtAmt = 0.7; },
    tip(index) { return TIPS[index] || ''; },
    setFrom(next) { from = next; },
  };
}

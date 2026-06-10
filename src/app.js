import './styles.css';
import { defineHex, Grid, rectangle, hexToPoint, Orientation } from 'honeycomb-grid';

const baseZones = {
  wild: { label: 'Wild Forest', icon: '🌲' },
  access: { label: 'Access Road', icon: '🛤️' },
  camp: { label: 'Camp Field', icon: '⛺' },
  utility: { label: 'Utility Yard', icon: '⚙️' },
  restricted: { label: 'Restricted', icon: '⚠️' },
  garden: { label: 'Garden', icon: '🥬' },
  rest: { label: 'Rest Area', icon: '🔥' }
};

const themes = {
  frontier: {
    label: 'Frontier',
    colors: { wild: '#315b38', access: '#8c6a42', camp: '#3e8f66', utility: '#3f76a8', restricted: '#7b3d37', garden: '#6d8c3f', rest: '#b28b45' }
  },
  civilization: {
    label: 'Civilization',
    colors: { wild: '#6f8b4d', access: '#c79755', camp: '#77a85c', utility: '#7890a8', restricted: '#9b5b4a', garden: '#9bae54', rest: '#d2a34d' }
  },
  clan: {
    label: 'Clan Builder',
    colors: { wild: '#4fa451', access: '#d99244', camp: '#49b87b', utility: '#4aa6d9', restricted: '#d65345', garden: '#96c93d', rest: '#f2b84b' }
  },
  blueprint: {
    label: 'Blueprint',
    colors: { wild: '#1c6c87', access: '#4d87a8', camp: '#2f9ba8', utility: '#79c7dd', restricted: '#8b5966', garden: '#58a9a0', rest: '#d0b15a' }
  },
  forest: {
    label: 'Forest Night',
    colors: { wild: '#1f4b35', access: '#60472e', camp: '#2f6c4e', utility: '#315b72', restricted: '#5a2c32', garden: '#4b6832', rest: '#8c7438' }
  }
};

let projectData;
let currentTheme = localStorage.getItem('noji-theme') || 'frontier';

function getZoneMeta() {
  const colors = themes[currentTheme]?.colors || themes.frontier.colors;
  return Object.fromEntries(Object.entries(baseZones).map(([key, value]) => [key, { ...value, color: colors[key] }]));
}

const statusTone = {
  available: 'good', owned: 'good', generated: 'good', active: 'good',
  locked: 'muted', needs_survey: 'warn', blocked: 'bad', invited_later: 'muted'
};

async function loadProject() {
  const res = await fetch('/data/project.json');
  projectData = await res.json();
  setupThemeSwitcher();
  applyTheme(currentTheme);
  render(projectData);
}

function setupThemeSwitcher() {
  document.querySelectorAll('[data-theme]').forEach(button => {
    button.addEventListener('click', () => {
      currentTheme = button.dataset.theme;
      localStorage.setItem('noji-theme', currentTheme);
      applyTheme(currentTheme);
      if (projectData) renderHexMap(projectData);
    });
  });
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  document.querySelectorAll('[data-theme]').forEach(button => {
    button.classList.toggle('active', button.dataset.theme === theme);
  });
}

function classifyTile(q, r, width, height) {
  const river = q > width - 5 || (q > width - 8 && r > height - 7);
  if (river) return 'restricted';
  if (r > height - 5 && q < width - 4) return 'access';
  if (q > 13 && r < 9) return 'camp';
  if (q > 16 && r >= 9 && r < 15) return 'utility';
  if (q > 7 && q < 14 && r > 8 && r < 17) return 'garden';
  if (q > 4 && q < 11 && r < 8) return 'rest';
  return 'wild';
}

function hexCorners(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = Math.PI / 180 * (60 * i);
    pts.push(`${(cx + size * Math.cos(angle)).toFixed(2)},${(cy + size * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(' ');
}

function render(data) {
  document.querySelector('#land-name').textContent = data.land.name;
  document.querySelector('#land-level').textContent = `Lv.${data.land.level} ${data.land.levelName}`;
  document.querySelector('#land-summary').textContent = `${data.land.address} · ${data.land.areaPyeongApprox}평 · ${data.land.nextLevelGoal}`;
  document.querySelector('#level-fill').style.width = `${Math.min(100, (data.land.level / 5) * 100)}%`;

  renderResourceBar(data.resources);
  renderHexMap(data);
  renderLevels(data.levels, data.land.level);
  renderActions(data.actions);
  renderQuests(data.quests);
  renderObjects(data.objects);
  renderPlayers(data.players);
}

function renderResourceBar(resources) {
  document.querySelector('#resource-bar').innerHTML = resources.map(r => `
    <div class="resource ${statusTone[r.status] || ''}">
      <b>${r.icon}</b><span>${r.name}</span><strong>${r.amount}</strong>
    </div>
  `).join('');
}

function renderHexMap(data) {
  const svg = document.querySelector('#hex-svg');
  const selected = document.querySelector('#selected-tile');
  const legend = document.querySelector('#zone-legend');
  const zoneMeta = getZoneMeta();
  const size = 18;
  const width = 24;
  const height = 23;
  const Tile = defineHex({ dimensions: size, orientation: Orientation.FLAT });
  const grid = new Grid(Tile, rectangle({ width, height }));
  const counts = {};
  const minX = -size, minY = -size, maxX = width * size * 1.55, maxY = height * size * 1.78;

  svg.setAttribute('viewBox', `${minX} ${minY} ${maxX} ${maxY}`);
  svg.innerHTML = `
    <defs>
      <filter id="tileGlow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="#e9c46a" flood-opacity="0.7"/>
      </filter>
      <linearGradient id="fog" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.12"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0.18"/>
      </linearGradient>
    </defs>
  `;

  for (const hex of grid) {
    const { x, y } = hexToPoint(hex);
    const q = hex.q;
    const r = hex.r;
    const zone = classifyTile(q, r, width, height);
    counts[zone] = (counts[zone] || 0) + 1;
    const meta = zoneMeta[zone];
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', hexCorners(x + 22, y + 22, size));
    poly.setAttribute('fill', meta.color);
    poly.setAttribute('class', `hex-tile zone-${zone}`);
    poly.dataset.q = q;
    poly.dataset.r = r;
    poly.dataset.zone = zone;
    poly.addEventListener('click', () => {
      document.querySelectorAll('.hex-tile.selected').forEach(el => el.classList.remove('selected'));
      poly.classList.add('selected');
      selected.innerHTML = `<strong>${meta.icon} ${meta.label}</strong><span>hex (${q}, ${r})</span><p>${zoneDescription(zone)}</p>`;
    });
    svg.appendChild(poly);
  }

  legend.innerHTML = Object.entries(zoneMeta).filter(([key]) => counts[key]).map(([key, meta]) => `
    <span class="legend-chip"><i style="background:${meta.color}"></i>${meta.icon} ${meta.label} <b>${counts[key]}</b></span>
  `).join('');

  document.querySelector('#reset-selection').onclick = () => {
    document.querySelectorAll('.hex-tile.selected').forEach(el => el.classList.remove('selected'));
    selected.textContent = '타일을 선택해봐.';
  };
}

function zoneDescription(zone) {
  return {
    wild: '아직 미개척. 보존하거나 나중에 용도 지정 가능.',
    access: '진입로, 작업동선, 임시 주차 후보.',
    camp: '텐트, 데크, 화로 같은 체류 오브젝트 후보.',
    utility: '물, 전기, 창고, 화장실 같은 기반시설 후보.',
    restricted: '하천/도로/규제 확인 전까지 잠긴 구역.',
    garden: '텃밭, 온실, 작물 실험 후보.',
    rest: '쉼터, 전망, 가족 모임 후보.'
  }[zone];
}

function renderLevels(levels, currentLevel) {
  document.querySelector('#levels').innerHTML = levels.map(level => `
    <article class="era ${level.level === currentLevel ? 'current' : level.level < currentLevel ? 'done' : 'locked'}">
      <b>Lv.${level.level}</b><div><strong>${level.name}</strong><p>${level.description}</p></div>
    </article>
  `).join('');
}

function renderActions(actions) {
  document.querySelector('#actions').innerHTML = actions.map(action => `
    <article class="action-card ${statusTone[action.status] || ''}">
      <small>${action.category} · Lv.${action.levelRequired}+</small>
      <h3>${action.name}</h3>
      <p>필요: ${action.requires.join(', ')}</p>
      <div>${action.outputs.map(x => `<span>+ ${x}</span>`).join('')}</div>
    </article>
  `).join('');
}

function renderQuests(quests) {
  document.querySelector('#quests').innerHTML = quests.map(q => `
    <article class="quest ${statusTone[q.status] || ''}">
      <span>QUEST</span><h3>${q.title}</h3><p>${q.notes}</p><b>담당: ${q.assignee}</b>
    </article>
  `).join('');
}

function renderObjects(objects) {
  document.querySelector('#objects').innerHTML = objects.map(obj => `
    <article class="object ${statusTone[obj.status] || ''}">
      <span>${obj.status === 'owned' ? '🎒' : '🔒'}</span>
      <strong>${obj.name}</strong>
      <small>${obj.kind} · Lv.${obj.unlockedAtLevel}+</small>
    </article>
  `).join('');
}

function renderPlayers(players) {
  document.querySelector('#players').innerHTML = players.map(p => `
    <article class="player ${statusTone[p.status] || ''}"><b>${p.name}</b><span>${p.role}</span></article>
  `).join('');
}

loadProject().catch(err => {
  document.body.innerHTML = `<pre>Failed to load project data: ${err.message}</pre>`;
});

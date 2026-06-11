import './styles.css';

const PYEONG_SQM = 3.305785;
const SQM_PER_TILE = 1;
const PYEONG_PER_TILE = SQM_PER_TILE / PYEONG_SQM;
const DEFAULT_MAP_WIDTH = 80;
const DEFAULT_MAP_HEIGHT = 80;
const TARGET_LAND_PYEONG = 550;
const TARGET_LAND_SQM = TARGET_LAND_PYEONG * PYEONG_SQM;
const SQUARE_SIZE_PX = 10;
const MAP_PADDING = SQUARE_SIZE_PX;
const ZOOM_MIN = 0.35;
const ZOOM_MAX = 4;

const baseZones = {
  wild: { label: 'Wild Forest', icon: '🌲' },
  access: { label: 'Access Road', icon: '🛤️' },
  parking: { label: 'Parking', icon: '🚙' },
  camp: { label: 'Camp Field', icon: '⛺' },
  utility: { label: 'Utility Yard', icon: '⚙️' },
  restricted: { label: 'Restricted', icon: '⚠️' },
  garden: { label: 'Garden', icon: '🥬' },
  rest: { label: 'Rest Area', icon: '🔥' }
};

const themes = {
  frontier: {
    label: 'Frontier',
    colors: { wild: '#315b38', access: '#8c6a42', parking: '#6f6557', camp: '#3e8f66', utility: '#3f76a8', restricted: '#7b3d37', garden: '#6d8c3f', rest: '#b28b45' }
  },
  civilization: {
    label: 'Civilization',
    colors: { wild: '#6f8b4d', access: '#c79755', parking: '#a89674', camp: '#77a85c', utility: '#7890a8', restricted: '#9b5b4a', garden: '#9bae54', rest: '#d2a34d' }
  },
  clan: {
    label: 'Clan Builder',
    colors: { wild: '#4fa451', access: '#d99244', parking: '#9e8e6a', camp: '#49b87b', utility: '#4aa6d9', restricted: '#d65345', garden: '#96c93d', rest: '#f2b84b' }
  },
  blueprint: {
    label: 'Blueprint',
    colors: { wild: '#1c6c87', access: '#4d87a8', parking: '#7993a5', camp: '#2f9ba8', utility: '#79c7dd', restricted: '#8b5966', garden: '#58a9a0', rest: '#d0b15a' }
  },
  forest: {
    label: 'Forest Night',
    colors: { wild: '#1f4b35', access: '#60472e', parking: '#6a6250', camp: '#2f6c4e', utility: '#315b72', restricted: '#5a2c32', garden: '#4b6832', rest: '#8c7438' }
  }
};

const statusTone = {
  available: 'good', owned: 'good', generated: 'good', active: 'good',
  locked: 'muted', needs_survey: 'warn', blocked: 'bad', invited_later: 'muted'
};

let projectData;
let currentTheme = localStorage.getItem('noji-theme') || 'forest';
let editorEnabled = false;
let editorTool = 'inspect';
let paintZone = 'wild';
let brushSize = 1;
let measurePoints = [];
let mapZoom = Number.parseFloat(localStorage.getItem('noji-map-zoom') || '0');
const DEFAULT_OVERLAY_SRC = '/overlays/hachunri-179-2-available-land.png';
let overlayState = loadOverlayState();
let mapSettings = { width: DEFAULT_MAP_WIDTH, height: DEFAULT_MAP_HEIGHT };
const tileState = new Map();
const rectByKey = new Map();
let fillTable = {};
let selectedTileKey = null;
let focusZone = null;
let panSuppressedClick = false;
const MAP_STORAGE_KEY = 'noji-square-map-v1';

const mapDom = {
  get svg() { return document.querySelector('#tile-svg'); },
  get frame() { return document.querySelector('#map-frame'); },
  get wrap() { return document.querySelector('#map-frame-wrap'); },
  get canvasLayer() { return document.querySelector('#map-canvas-layer'); },
  get tooltip() { return document.querySelector('#tile-tooltip'); },
  get legend() { return document.querySelector('#zone-legend'); },
  get editorContext() { return document.querySelector('#editor-context'); },
  get editorSettings() { return document.querySelector('#editor-settings'); },
  get overlayPanel() { return document.querySelector('#overlay-panel'); }
};

function getZoneMeta() {
  const colors = themes[currentTheme]?.colors || themes.frontier.colors;
  return Object.fromEntries(Object.entries(baseZones).map(([key, value]) => [key, { ...value, color: colors[key] }]));
}

function tileKey(q, r) { return `${q},${r}`; }

async function loadProject() {
  const res = await fetch('/data/project.json');
  projectData = await res.json();
  setupThemeSwitcher();
  setupMapInteractions();
  setupMapAugmentControls();
  setupInlineEditor();
  applyTheme(currentTheme);
  render(projectData);
}

function setupThemeSwitcher() {
  document.querySelectorAll('[data-theme]').forEach(button => {
    button.addEventListener('click', () => {
      currentTheme = button.dataset.theme;
      localStorage.setItem('noji-theme', currentTheme);
      applyTheme(currentTheme);
      repaintTiles();
      updateLegend();
      renderEditorContext();
    });
  });
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  document.querySelectorAll('[data-theme]').forEach(button => {
    button.classList.toggle('active', button.dataset.theme === theme);
  });
}

function clampMapSize(value) {
  return Math.max(8, Math.min(120, Number.parseInt(value, 10) || DEFAULT_MAP_WIDTH));
}

function classifyTile(q, r, width, height) {
  const river = q > width - 5 || (q > width - 8 && r > height - 7);
  if (river) return 'restricted';
  if (r > height - 5 && q < width - 4) return q < 7 ? 'parking' : 'access';
  if (q > 13 && r < 9) return 'camp';
  if (q > 16 && r >= 9 && r < 15) return 'utility';
  if (q > 7 && q < 14 && r > 8 && r < 17) return 'garden';
  if (q > 4 && q < 11 && r < 8) return 'rest';
  return 'wild';
}

function initTileState() {
  if (tileState.size) return;
  const saved = loadMapFromStorage();
  if (saved) return;
  resizeMap(DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT, { preserve: false, save: false });
}

function resizeMap(width, height, { preserve = true, save = true } = {}) {
  const next = { width: clampMapSize(width), height: clampMapSize(height) };
  const previous = new Map(tileState);
  tileState.clear();
  for (let r = 0; r < next.height; r += 1) {
    for (let q = 0; q < next.width; q += 1) {
      const k = tileKey(q, r);
      const prior = preserve ? previous.get(k) : null;
      tileState.set(k, prior ? { ...prior } : { q, r, zone: classifyTile(q, r, next.width, next.height) });
    }
  }
  mapSettings = next;
  syncMapSizeInputs();
  if (save) saveMapToStorage();
}

function syncMapSizeInputs() {
  const widthInput = document.querySelector('#map-width-input');
  const heightInput = document.querySelector('#map-height-input');
  if (widthInput) widthInput.value = mapSettings.width;
  if (heightInput) heightInput.value = mapSettings.height;
}

function tileCenterMeters(q, r) {
  return { x: q + 0.5, y: r + 0.5 };
}

function distanceMeters(a, b) {
  const am = tileCenterMeters(a.q, a.r);
  const bm = tileCenterMeters(b.q, b.r);
  return Math.hypot(am.x - bm.x, am.y - bm.y);
}

function tileRectPx(q, r) {
  return { x: MAP_PADDING + q * SQUARE_SIZE_PX, y: MAP_PADDING + r * SQUARE_SIZE_PX, size: SQUARE_SIZE_PX };
}

function tileCenterPx(q, r) {
  const { x, y, size } = tileRectPx(q, r);
  return { x: x + size / 2, y: y + size / 2 };
}

function viewSizePx() {
  return {
    w: mapSettings.width * SQUARE_SIZE_PX + MAP_PADDING * 2,
    h: mapSettings.height * SQUARE_SIZE_PX + MAP_PADDING * 2
  };
}

/* ---------- terrain fill: deterministic per-tile shade variation ---------- */

function shadeColor(hex, amount) {
  const num = Number.parseInt(hex.slice(1), 16);
  const channel = shift => Math.max(0, Math.min(255, shift + amount));
  const r = channel((num >> 16) & 255);
  const g = channel((num >> 8) & 255);
  const b = channel(num & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function rebuildFillTable() {
  const meta = getZoneMeta();
  fillTable = {};
  for (const [zone, value] of Object.entries(meta)) {
    fillTable[zone] = [
      value.color,
      shadeColor(value.color, 9),
      shadeColor(value.color, -8),
      shadeColor(value.color, 4)
    ];
  }
}

function fillFor(zone, q, r) {
  const shades = fillTable[zone] || fillTable.wild;
  const n = ((q * 73856093) ^ (r * 19349663)) >>> 0;
  return shades[n % 4];
}

/* ---------- main render ---------- */

function render(data) {
  document.querySelector('#land-name').textContent = data.land.name;
  document.querySelector('#land-level').textContent = `Lv.${data.land.level} ${data.land.levelName}`;
  document.querySelector('#land-summary').textContent = `${data.land.address} · ${data.land.areaPyeongApprox}평 · ${data.land.nextLevelGoal}`;
  document.querySelector('#level-fill').style.width = `${Math.min(100, (data.land.level / 5) * 100)}%`;

  renderResourceBar(data.resources);
  initTileState();
  buildMapDom();
  if (!mapZoom || Number.isNaN(mapZoom)) fitView();
  renderLevels(data.levels, data.land.level);
  renderActions(data.actions);
  renderQuests(data.quests);
  renderObjects(data.objects);
  renderPlayers(data.players);
}

function buildMapDom() {
  const svg = mapDom.svg;
  const { w, h } = viewSizePx();
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.innerHTML = `
    <defs>
      <filter id="tileGlow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="#e9c46a" flood-opacity="0.7"/>
      </filter>
    </defs>
    <g id="tile-layer"></g>
    <g id="line-layer"></g>
    <g id="measure-layer"></g>
    <rect id="hover-rect" class="hover-rect" visibility="hidden" />
    <rect id="select-rect" class="select-rect" visibility="hidden" />
  `;
  const tileLayer = svg.querySelector('#tile-layer');
  rectByKey.clear();
  rebuildFillTable();
  const frag = document.createDocumentFragment();
  for (let r = 0; r < mapSettings.height; r += 1) {
    for (let q = 0; q < mapSettings.width; q += 1) {
      const k = tileKey(q, r);
      let tile = tileState.get(k);
      if (!tile) {
        tile = { q, r, zone: classifyTile(q, r, mapSettings.width, mapSettings.height) };
        tileState.set(k, tile);
      }
      const { x, y, size } = tileRectPx(q, r);
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', size);
      rect.setAttribute('height', size);
      rect.setAttribute('fill', fillFor(tile.zone, q, r));
      rect.setAttribute('class', `square-tile zone-${tile.zone}`);
      rect.dataset.q = q;
      rect.dataset.r = r;
      frag.appendChild(rect);
      rectByKey.set(k, rect);
    }
  }
  tileLayer.appendChild(frag);
  selectedTileKey = null;
  applyFocusZone();
  updateBoundaries();
  updateMeasureLayer();
  updateLegend();
  applyZoom();
  renderInlineEditorStats();
}

function repaintTiles() {
  rebuildFillTable();
  for (const [k, rect] of rectByKey) {
    const tile = tileState.get(k);
    if (!tile) continue;
    rect.setAttribute('fill', fillFor(tile.zone, tile.q, tile.r));
    rect.setAttribute('class', `square-tile zone-${tile.zone}`);
  }
}

/* ---------- zone boundaries ---------- */

function squareCornersArray(x, y, size) {
  return [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size }
  ];
}

function edgeKey(a, b) {
  const aKey = `${a.x},${a.y}`;
  const bKey = `${b.x},${b.y}`;
  return aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
}

function collectSquareEdges(edgeMap, corners, zone) {
  for (let i = 0; i < 4; i += 1) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const key = edgeKey(a, b);
    if (!edgeMap.has(key)) edgeMap.set(key, { a, b, zones: [] });
    edgeMap.get(key).zones.push(zone);
  }
}

function updateBoundaries() {
  const layer = mapDom.svg.querySelector('#line-layer');
  if (!layer) return;
  const edgeMap = new Map();
  for (const tile of tileState.values()) {
    const { x, y, size } = tileRectPx(tile.q, tile.r);
    collectSquareEdges(edgeMap, squareCornersArray(x, y, size), tile.zone);
  }
  layer.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (const edge of edgeMap.values()) {
    const uniqueZones = new Set(edge.zones);
    const isOuterEdge = edge.zones.length === 1;
    const isZoneBoundary = uniqueZones.size > 1;
    if (!isOuterEdge && !isZoneBoundary) continue;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', edge.a.x);
    line.setAttribute('y1', edge.a.y);
    line.setAttribute('x2', edge.b.x);
    line.setAttribute('y2', edge.b.y);
    line.setAttribute('class', isOuterEdge ? 'zone-edge-boundary map-outer-boundary' : 'zone-edge-boundary');
    frag.appendChild(line);
  }
  layer.appendChild(frag);
}

/* ---------- zoom / pan ---------- */

function clampZoom(value) {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, value));
}

function applyZoom() {
  const { w, h } = viewSizePx();
  const zoom = mapZoom || 1;
  const rw = Math.round(w * zoom);
  const rh = Math.round(h * zoom);
  const svg = mapDom.svg;
  svg.style.width = `${rw}px`;
  svg.style.height = `${rh}px`;
  const canvasLayer = mapDom.canvasLayer;
  canvasLayer.style.width = `${rw}px`;
  canvasLayer.style.height = `${rh}px`;
  updateMapZoomLabel();
}

function setMapZoom(next, anchor) {
  const prev = mapZoom || 1;
  mapZoom = clampZoom(next);
  if (mapZoom === prev) return;
  const frame = mapDom.frame;
  const frameRect = frame.getBoundingClientRect();
  const ax = anchor ? anchor.x - frameRect.left : frame.clientWidth / 2;
  const ay = anchor ? anchor.y - frameRect.top : frame.clientHeight / 2;
  const contentX = (frame.scrollLeft + ax) / prev;
  const contentY = (frame.scrollTop + ay) / prev;
  applyZoom();
  frame.scrollLeft = contentX * mapZoom - ax;
  frame.scrollTop = contentY * mapZoom - ay;
  localStorage.setItem('noji-map-zoom', String(mapZoom));
}

function fitView() {
  const frame = mapDom.frame;
  const { w, h } = viewSizePx();
  const fit = Math.min((frame.clientWidth - 4) / w, (frame.clientHeight - 4) / h);
  mapZoom = clampZoom(fit);
  localStorage.setItem('noji-map-zoom', String(mapZoom));
  applyZoom();
  frame.scrollLeft = 0;
  frame.scrollTop = 0;
}

function updateMapZoomLabel() {
  const label = document.querySelector('#map-zoom-reset');
  if (label) label.textContent = `${Math.round((mapZoom || 1) * 100)}%`;
}

function setupMapInteractions() {
  const svg = mapDom.svg;
  const frame = mapDom.frame;
  if (!svg || svg.dataset.bound) return;
  svg.dataset.bound = 'true';

  svg.addEventListener('click', event => {
    if (panSuppressedClick) return;
    const rectEl = event.target.closest('.square-tile');
    if (!rectEl) return;
    const tile = tileState.get(tileKey(Number(rectEl.dataset.q), Number(rectEl.dataset.r)));
    if (tile) handleTileClick(tile, rectEl);
  });

  svg.addEventListener('pointermove', onTileHover);
  svg.addEventListener('pointerleave', hideHover);

  let panState = null;
  frame.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    panState = {
      x: event.clientX, y: event.clientY,
      left: frame.scrollLeft, top: frame.scrollTop,
      moved: false
    };
  });
  window.addEventListener('pointermove', event => {
    if (!panState) return;
    const dx = event.clientX - panState.x;
    const dy = event.clientY - panState.y;
    if (!panState.moved && Math.hypot(dx, dy) < 5) return;
    panState.moved = true;
    panSuppressedClick = true;
    frame.classList.add('panning');
    hideHover();
    frame.scrollLeft = panState.left - dx;
    frame.scrollTop = panState.top - dy;
  });
  window.addEventListener('pointerup', () => {
    if (!panState) return;
    const moved = panState.moved;
    panState = null;
    frame.classList.remove('panning');
    if (moved) {
      setTimeout(() => { panSuppressedClick = false; }, 0);
    } else {
      panSuppressedClick = false;
    }
  });

  frame.addEventListener('wheel', event => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    setMapZoom((mapZoom || 1) * factor, { x: event.clientX, y: event.clientY });
  }, { passive: false });

  document.querySelector('#map-zoom-in').addEventListener('click', () => setMapZoom((mapZoom || 1) * 1.2));
  document.querySelector('#map-zoom-out').addEventListener('click', () => setMapZoom((mapZoom || 1) / 1.2));
  document.querySelector('#map-zoom-reset').addEventListener('click', () => setMapZoom(1));
  document.querySelector('#map-fit').addEventListener('click', () => {
    clearSelection();
    measurePoints = [];
    updateMeasureLayer();
    fitView();
  });

  mapDom.legend.addEventListener('click', event => {
    const chip = event.target.closest('[data-zone]');
    if (!chip) return;
    focusZone = focusZone === chip.dataset.zone ? null : chip.dataset.zone;
    applyFocusZone();
    updateLegend();
  });
}

function applyFocusZone() {
  const svg = mapDom.svg;
  if (focusZone) svg.dataset.focusZone = focusZone;
  else delete svg.dataset.focusZone;
}

/* ---------- hover tooltip ---------- */

function onTileHover(event) {
  const rectEl = event.target.closest?.('.square-tile');
  if (!rectEl) { hideHover(); return; }
  const svg = mapDom.svg;
  const hover = svg.querySelector('#hover-rect');
  hover.setAttribute('x', rectEl.getAttribute('x'));
  hover.setAttribute('y', rectEl.getAttribute('y'));
  hover.setAttribute('width', rectEl.getAttribute('width'));
  hover.setAttribute('height', rectEl.getAttribute('height'));
  hover.setAttribute('visibility', 'visible');

  const tile = tileState.get(tileKey(Number(rectEl.dataset.q), Number(rectEl.dataset.r)));
  if (!tile) return;
  const meta = getZoneMeta()[tile.zone] || getZoneMeta().wild;
  const tooltip = mapDom.tooltip;
  tooltip.hidden = false;
  let hint = '';
  if (editorEnabled && (editorTool === 'paint' || editorTool === 'erase')) {
    const zoneIcon = getZoneMeta()[paintZone]?.icon || '';
    hint = `<em>${editorTool === 'paint' ? `🖌 ${zoneIcon} ${paintZone}` : '🧽 → wild'} · ${brushSize}m</em>`;
  } else if (editorEnabled && editorTool === 'measure') {
    hint = measurePoints.length === 1 ? '<em>📏 끝 타일 클릭</em>' : '<em>📏 시작 타일 클릭</em>';
  } else {
    hint = `<em class="desc">${zoneDescription(tile.zone) || ''}</em>`;
  }
  tooltip.innerHTML = `<b>${meta.icon} ${meta.label}</b><span>(${tile.q}, ${tile.r})</span>${hint}`;

  const wrapRect = mapDom.wrap.getBoundingClientRect();
  let tx = event.clientX - wrapRect.left + 16;
  let ty = event.clientY - wrapRect.top + 16;
  tx = Math.min(tx, wrapRect.width - tooltip.offsetWidth - 10);
  ty = Math.min(ty, wrapRect.height - tooltip.offsetHeight - 10);
  tooltip.style.transform = `translate(${Math.max(8, tx)}px, ${Math.max(8, ty)}px)`;
}

function hideHover() {
  const hover = mapDom.svg?.querySelector('#hover-rect');
  if (hover) hover.setAttribute('visibility', 'hidden');
  const tooltip = mapDom.tooltip;
  if (tooltip) tooltip.hidden = true;
}

/* ---------- selection / tile click ---------- */

function handleTileClick(tile, rectEl) {
  if (editorEnabled && ['paint', 'erase'].includes(editorTool)) {
    applyBrush(tile);
    return;
  }
  if (editorEnabled && editorTool === 'measure') {
    measurePoints.push({ q: tile.q, r: tile.r });
    if (measurePoints.length > 2) measurePoints = [measurePoints.at(-1)];
    updateMeasureLayer();
    renderInlineEditorStats();
    return;
  }
  selectTile(tile);
}

function selectTile(tile) {
  selectedTileKey = tileKey(tile.q, tile.r);
  const select = mapDom.svg.querySelector('#select-rect');
  const { x, y, size } = tileRectPx(tile.q, tile.r);
  select.setAttribute('x', x);
  select.setAttribute('y', y);
  select.setAttribute('width', size);
  select.setAttribute('height', size);
  select.setAttribute('visibility', 'visible');
}

function clearSelection() {
  selectedTileKey = null;
  const select = mapDom.svg?.querySelector('#select-rect');
  if (select) select.setAttribute('visibility', 'hidden');
}

/* ---------- brush ---------- */

function getBrushTiles(center) {
  const radius = brushSize === 5 ? 2 : brushSize === 3 ? 1 : 0;
  const result = [];
  for (let r = center.r - radius; r <= center.r + radius; r += 1) {
    for (let q = center.q - radius; q <= center.q + radius; q += 1) {
      const tile = tileState.get(tileKey(q, r));
      if (tile) result.push(tile);
    }
  }
  return result;
}

function applyBrush(center) {
  const nextZone = editorTool === 'erase' ? 'wild' : paintZone;
  for (const tile of getBrushTiles(center)) {
    if (tile.zone === nextZone) continue;
    tile.zone = nextZone;
    const rect = rectByKey.get(tileKey(tile.q, tile.r));
    if (rect) {
      rect.setAttribute('fill', fillFor(nextZone, tile.q, tile.r));
      rect.setAttribute('class', `square-tile zone-${nextZone}`);
    }
  }
  saveMapToStorage();
  updateBoundaries();
  updateLegend();
  renderInlineEditorStats();
}

/* ---------- measure overlay ---------- */

function updateMeasureLayer() {
  const layer = mapDom.svg.querySelector('#measure-layer');
  if (!layer) return;
  layer.innerHTML = '';
  if (measurePoints.length === 0) return;
  for (const p of measurePoints) {
    const pt = tileCenterPx(p.q, p.r);
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', pt.x);
    c.setAttribute('cy', pt.y);
    c.setAttribute('r', SQUARE_SIZE_PX * 0.36);
    c.setAttribute('class', 'inline-measure-point');
    layer.appendChild(c);
  }
  if (measurePoints.length !== 2) return;
  const a = tileCenterPx(measurePoints[0].q, measurePoints[0].r);
  const b = tileCenterPx(measurePoints[1].q, measurePoints[1].r);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', a.x);
  line.setAttribute('y1', a.y);
  line.setAttribute('x2', b.x);
  line.setAttribute('y2', b.y);
  line.setAttribute('class', 'inline-measure-line');
  layer.appendChild(line);
  const d = distanceMeters(measurePoints[0], measurePoints[1]);
  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', (a.x + b.x) / 2);
  label.setAttribute('y', (a.y + b.y) / 2 - SQUARE_SIZE_PX * 0.8);
  label.setAttribute('class', 'inline-measure-label');
  label.textContent = `${d.toFixed(2)}m`;
  layer.appendChild(label);
}

/* ---------- legend ---------- */

function updateLegend() {
  const legend = mapDom.legend;
  if (!legend) return;
  const zoneMeta = getZoneMeta();
  const counts = {};
  tileState.forEach(tile => { counts[tile.zone] = (counts[tile.zone] || 0) + 1; });
  legend.innerHTML = Object.entries(zoneMeta).filter(([key]) => counts[key]).map(([key, meta]) => `
    <button class="legend-chip ${focusZone === key ? 'active' : ''}" data-zone="${key}" title="클릭하면 이 구역만 강조">
      <i style="background:${meta.color}"></i>${meta.icon} ${meta.label} <b>${counts[key]}</b>
    </button>
  `).join('');
}

/* ---------- HUD / panels ---------- */

function renderResourceBar(resources) {
  document.querySelector('#resource-bar').innerHTML = resources.map(r => `
    <div class="resource ${statusTone[r.status] || ''}">
      <b>${r.icon}</b><span>${r.name}</span><strong>${r.amount}</strong>
    </div>
  `).join('');
}

function renderInlineEditorStats(extra = '') {
  const el = document.querySelector('#inline-editor-stats');
  if (!el) return;
  const counts = {};
  tileState.forEach(tile => { counts[tile.zone] = (counts[tile.zone] || 0) + 1; });
  const zoneMeta = getZoneMeta();
  const total = tileState.size;
  const totalSqm = total * SQM_PER_TILE;
  const totalPyeong = totalSqm / PYEONG_SQM;
  const deltaSqm = totalSqm - TARGET_LAND_SQM;
  const landFitText = Math.abs(deltaSqm) < 0.5 ? 'target 550평 exact' : `${Math.abs(deltaSqm).toFixed(0)}㎡ ${deltaSqm > 0 ? '여유' : '부족'}`;
  const measureText = measurePoints.length === 2 ? ` · 측정 ${distanceMeters(measurePoints[0], measurePoints[1]).toFixed(2)}m` : '';
  el.innerHTML = `
    <span>맵 ${mapSettings.width}m×${mapSettings.height}m = ${totalSqm.toFixed(0)}㎡ / ${totalPyeong.toFixed(1)}평</span>
    <span>실토지 약 ${TARGET_LAND_PYEONG}평(${TARGET_LAND_SQM.toFixed(0)}㎡) 기준 ${landFitText}</span>
    <span>tile 1m×1m${measureText}</span>
    <span>${Object.entries(counts).map(([zone, count]) => `${zoneMeta[zone]?.icon || ''} ${zone}: ${count}`).join(' · ')}</span>
    ${extra ? `<span class="good">${extra}</span>` : ''}
  `;
}

/* ---------- overlay (augment image) ---------- */

function loadOverlayState() {
  try {
    return {
      src: localStorage.getItem('noji-overlay-src') || DEFAULT_OVERLAY_SRC,
      opacity: Number.parseFloat(localStorage.getItem('noji-overlay-opacity') || '0.48'),
      scale: Number.parseFloat(localStorage.getItem('noji-overlay-scale') || '1'),
      scaleX: Number.parseFloat(localStorage.getItem('noji-overlay-scale-x') || '1'),
      scaleY: Number.parseFloat(localStorage.getItem('noji-overlay-scale-y') || '1'),
      offsetX: Number.parseFloat(localStorage.getItem('noji-overlay-offset-x') || '0'),
      offsetY: Number.parseFloat(localStorage.getItem('noji-overlay-offset-y') || '0')
    };
  } catch {
    return { src: DEFAULT_OVERLAY_SRC, opacity: 0.48, scale: 1, scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 };
  }
}

function saveOverlayState() {
  localStorage.setItem('noji-overlay-src', overlayState.src);
  localStorage.setItem('noji-overlay-opacity', String(overlayState.opacity));
  localStorage.setItem('noji-overlay-scale', String(overlayState.scale));
  localStorage.setItem('noji-overlay-scale-x', String(overlayState.scaleX));
  localStorage.setItem('noji-overlay-scale-y', String(overlayState.scaleY));
  localStorage.setItem('noji-overlay-offset-x', String(overlayState.offsetX));
  localStorage.setItem('noji-overlay-offset-y', String(overlayState.offsetY));
}

function setupMapAugmentControls() {
  const opacity = document.querySelector('#overlay-opacity');
  if (!opacity || opacity.dataset.bound) return;
  opacity.dataset.bound = 'true';
  const scale = document.querySelector('#overlay-scale');
  const scaleLabel = document.querySelector('#overlay-scale-label');
  const scaleX = document.querySelector('#overlay-scale-x');
  const scaleY = document.querySelector('#overlay-scale-y');
  const scaleXLabel = document.querySelector('#overlay-scale-x-label');
  const scaleYLabel = document.querySelector('#overlay-scale-y-label');
  const offsetX = document.querySelector('#overlay-offset-x');
  const offsetY = document.querySelector('#overlay-offset-y');
  const offsetXLabel = document.querySelector('#overlay-offset-x-label');
  const offsetYLabel = document.querySelector('#overlay-offset-y-label');
  const fileInput = document.querySelector('#overlay-image-file');
  const panelToggle = document.querySelector('#overlay-panel-toggle');
  const overlayPanel = document.querySelector('#overlay-panel');
  opacity.value = Math.round(overlayState.opacity * 100);
  scale.value = Math.round(overlayState.scale * 100);
  scaleX.value = Math.round(overlayState.scaleX * 100);
  scaleY.value = Math.round(overlayState.scaleY * 100);
  scaleLabel.textContent = `${Math.round(overlayState.scale * 100)}%`;
  scaleXLabel.textContent = `${Math.round(overlayState.scaleX * 100)}%`;
  scaleYLabel.textContent = `${Math.round(overlayState.scaleY * 100)}%`;
  offsetX.value = Math.round(overlayState.offsetX);
  offsetY.value = Math.round(overlayState.offsetY);
  offsetXLabel.textContent = `${Math.round(overlayState.offsetX)}%`;
  offsetYLabel.textContent = `${Math.round(overlayState.offsetY)}%`;
  applyOverlayState();
  panelToggle.addEventListener('click', () => {
    const willOpen = overlayPanel.hidden;
    overlayPanel.hidden = !willOpen;
    panelToggle.setAttribute('aria-expanded', String(willOpen));
    panelToggle.textContent = willOpen ? '▴' : '▾';
  });
  opacity.addEventListener('input', () => {
    overlayState.opacity = Number(opacity.value) / 100;
    saveOverlayState();
    applyOverlayState();
  });
  scale.addEventListener('input', () => {
    overlayState.scale = Number(scale.value) / 100;
    scaleLabel.textContent = `${Math.round(overlayState.scale * 100)}%`;
    saveOverlayState();
    applyOverlayState();
  });
  scaleX.addEventListener('input', () => {
    overlayState.scaleX = Number(scaleX.value) / 100;
    scaleXLabel.textContent = `${Math.round(overlayState.scaleX * 100)}%`;
    saveOverlayState();
    applyOverlayState();
  });
  scaleY.addEventListener('input', () => {
    overlayState.scaleY = Number(scaleY.value) / 100;
    scaleYLabel.textContent = `${Math.round(overlayState.scaleY * 100)}%`;
    saveOverlayState();
    applyOverlayState();
  });
  offsetX.addEventListener('input', () => {
    overlayState.offsetX = Number(offsetX.value);
    offsetXLabel.textContent = `${Math.round(overlayState.offsetX)}%`;
    saveOverlayState();
    applyOverlayState();
  });
  offsetY.addEventListener('input', () => {
    overlayState.offsetY = Number(offsetY.value);
    offsetYLabel.textContent = `${Math.round(overlayState.offsetY)}%`;
    saveOverlayState();
    applyOverlayState();
  });
  document.querySelector('#upload-overlay-image').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', importOverlayImage);
}

async function importOverlayImage(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    overlayState.src = String(reader.result);
    saveOverlayState();
    applyOverlayState();
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function applyOverlayState() {
  const img = document.querySelector('#parcel-overlay');
  if (!img) return;
  document.body.classList.toggle('map-augment-on', Boolean(overlayState.src));
  img.src = overlayState.src || '';
  img.style.setProperty('--overlay-opacity', String(overlayState.opacity));
  img.style.setProperty('--overlay-scale', String(overlayState.scale));
  img.style.setProperty('--overlay-scale-x', String(overlayState.scaleX));
  img.style.setProperty('--overlay-scale-y', String(overlayState.scaleY));
  img.style.setProperty('--overlay-offset-x', `${overlayState.offsetX}%`);
  img.style.setProperty('--overlay-offset-y', `${overlayState.offsetY}%`);
}

/* ---------- inline editor ---------- */

function setEditorEnabled(next) {
  editorEnabled = next;
  measurePoints = [];
  updateMeasureLayer();
  document.body.classList.toggle('editor-mode', editorEnabled);
  const toggle = document.querySelector('#toggle-map-editor');
  toggle.textContent = editorEnabled ? '✕ Close Editor' : '🛠 Map Editor';
  if (!editorEnabled) closeEditorSettings();
  clearSelection();
  renderEditorContext();
  renderInlineEditorStats();
}

function setEditorTool(tool) {
  editorTool = tool;
  measurePoints = [];
  updateMeasureLayer();
  document.querySelectorAll('[data-editor-tool]').forEach(b => b.classList.toggle('active', b.dataset.editorTool === editorTool));
  clearSelection();
  renderEditorContext();
  renderInlineEditorStats();
}

function renderEditorContext() {
  const panel = mapDom.editorContext;
  if (!panel) return;
  if (!editorEnabled || !['paint', 'erase'].includes(editorTool)) {
    panel.hidden = true;
    panel.innerHTML = '';
    return;
  }
  const zoneMeta = getZoneMeta();
  const paletteHtml = editorTool === 'paint' ? `
    <div class="context-section">
      <h4>구역</h4>
      <div class="zone-palette">
        ${Object.entries(zoneMeta).map(([key, meta]) => `
          <button class="zone-swatch ${paintZone === key ? 'active' : ''}" data-paint-zone="${key}" title="${meta.label}">
            <i style="background:${meta.color}"></i><span>${meta.icon}</span>
          </button>
        `).join('')}
      </div>
      <p class="zone-name">${zoneMeta[paintZone].icon} ${zoneMeta[paintZone].label}</p>
    </div>
  ` : '';
  panel.innerHTML = `
    ${paletteHtml}
    <div class="context-section">
      <h4>브러시</h4>
      <div class="brush-seg">
        ${[1, 3, 5].map(size => `<button class="${brushSize === size ? 'active' : ''}" data-brush="${size}">${size}m</button>`).join('')}
      </div>
    </div>
  `;
  panel.hidden = false;
}

function openEditorSettings() {
  const panel = mapDom.editorSettings;
  panel.hidden = false;
  document.querySelector('#editor-settings-toggle').classList.add('active');
  mapDom.editorContext.hidden = true;
}

function closeEditorSettings() {
  const panel = mapDom.editorSettings;
  if (!panel) return;
  panel.hidden = true;
  document.querySelector('#editor-settings-toggle')?.classList.remove('active');
  renderEditorContext();
}

function setupInlineEditor() {
  const toggle = document.querySelector('#toggle-map-editor');
  if (!toggle || toggle.dataset.bound) return;
  toggle.dataset.bound = 'true';
  toggle.addEventListener('click', () => setEditorEnabled(!editorEnabled));

  document.querySelectorAll('[data-editor-tool]').forEach(button => {
    button.addEventListener('click', () => {
      closeEditorSettings();
      setEditorTool(button.dataset.editorTool);
    });
  });

  mapDom.editorContext.addEventListener('click', event => {
    const swatch = event.target.closest('[data-paint-zone]');
    if (swatch) {
      paintZone = swatch.dataset.paintZone;
      renderEditorContext();
      return;
    }
    const brush = event.target.closest('[data-brush]');
    if (brush) {
      brushSize = Number.parseInt(brush.dataset.brush, 10) || 1;
      renderEditorContext();
      renderInlineEditorStats();
    }
  });

  document.querySelector('#editor-settings-toggle').addEventListener('click', () => {
    if (mapDom.editorSettings.hidden) openEditorSettings();
    else closeEditorSettings();
  });
  document.querySelector('#editor-settings-close').addEventListener('click', closeEditorSettings);

  document.querySelector('#apply-map-size').addEventListener('click', applyMapSizeFromInputs);
  syncMapSizeInputs();
  document.querySelector('#export-inline-map').addEventListener('click', exportInlineMap);
  document.querySelector('#save-inline-map').addEventListener('click', () => { saveMapToStorage(); renderInlineEditorStats('saved locally'); });
  document.querySelector('#load-inline-map').addEventListener('click', () => document.querySelector('#inline-map-file').click());
  document.querySelector('#inline-map-file').addEventListener('change', importInlineMap);

  window.addEventListener('keydown', event => {
    if (event.target instanceof Element && event.target.matches('input, select, textarea')) return;
    if (event.key === 'Escape') {
      if (mapDom.editorSettings && !mapDom.editorSettings.hidden) { closeEditorSettings(); return; }
      if (measurePoints.length) { measurePoints = []; updateMeasureLayer(); renderInlineEditorStats(); return; }
      if (selectedTileKey) { clearSelection(); return; }
      if (editorEnabled) setEditorEnabled(false);
      return;
    }
    if (!editorEnabled) return;
    const key = event.key.toLowerCase();
    const toolByKey = { v: 'inspect', b: 'paint', e: 'erase', m: 'measure' };
    if (toolByKey[key]) {
      closeEditorSettings();
      setEditorTool(toolByKey[key]);
    }
  });
}

/* ---------- persistence ---------- */

function buildMapPayload() {
  return {
    unit: {
      tileWidthMeters: 1,
      tileHeightMeters: 1,
      tileAreaSqm: SQM_PER_TILE,
      tileAreaPyeong: Number(PYEONG_PER_TILE.toFixed(6)),
      coordinateSystem: 'square row/column q,r; each tile is 1m x 1m; distance measurements use tile centers in meters'
    },
    grid: { width: mapSettings.width, height: mapSettings.height },
    tiles: [...tileState.values()]
  };
}

function exportInlineMap() {
  const payload = buildMapPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'noji-ingame-map.json';
  a.click();
  URL.revokeObjectURL(url);
}

function saveMapToStorage() {
  localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(buildMapPayload()));
}

function loadMapFromStorage() {
  try {
    const raw = localStorage.getItem(MAP_STORAGE_KEY);
    if (!raw) return false;
    return applyMapPayload(JSON.parse(raw));
  } catch {
    return false;
  }
}

function applyMapPayload(payload) {
  if (!payload?.tiles?.length) return false;
  tileState.clear();
  const width = clampMapSize(payload.grid?.width || DEFAULT_MAP_WIDTH);
  const height = clampMapSize(payload.grid?.height || DEFAULT_MAP_HEIGHT);
  resizeMap(width, height, { preserve: false, save: false });
  for (const tile of payload.tiles) {
    const k = tileKey(tile.q, tile.r);
    if (tileState.has(k) && baseZones[tile.zone]) tileState.get(k).zone = tile.zone;
  }
  syncMapSizeInputs();
  return true;
}

function applyMapSizeFromInputs() {
  const width = document.querySelector('#map-width-input').value;
  const height = document.querySelector('#map-height-input').value;
  resizeMap(width, height, { preserve: true, save: true });
  measurePoints = [];
  buildMapDom();
  renderInlineEditorStats('map resized');
}

async function importInlineMap(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (!applyMapPayload(payload)) throw new Error('invalid map json');
    saveMapToStorage();
    measurePoints = [];
    buildMapDom();
    renderInlineEditorStats('loaded json');
  } catch (error) {
    renderInlineEditorStats(`load failed: ${error.message}`);
  } finally {
    event.target.value = '';
  }
}

function zoneDescription(zone) {
  return {
    wild: '아직 미개척. 보존하거나 나중에 용도 지정 가능.',
    access: '진입로, 작업동선, 임시 주차 후보.',
    parking: '차량 진입/주차 후보. 캠핑·작업 동선의 시작점.',
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

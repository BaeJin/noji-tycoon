import './styles.css';
import { defineHex, Grid, rectangle, hexToPoint, Orientation } from 'honeycomb-grid';

const PYEONG_SQM = 3.305785;
const HEX_SIDE_M = Math.sqrt((2 * PYEONG_SQM) / (3 * Math.sqrt(3)));
const HEX_WIDTH_M = 2 * HEX_SIDE_M;
const HEX_HEIGHT_M = Math.sqrt(3) * HEX_SIDE_M;
const DEFAULT_MAP_WIDTH = 24;
const DEFAULT_MAP_HEIGHT = 23;
const TARGET_LAND_PYEONG = 550;
const HEX_SIZE_PX = 18;

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
let mapZoom = Number.parseFloat(localStorage.getItem('noji-map-zoom') || '1');
let augmentEnabled = localStorage.getItem('noji-map-augment') === 'true';
const DEFAULT_OVERLAY_SRC = '/overlays/hachunri-179-2-available-land.png';
let overlayState = loadOverlayState();
let mapSettings = { width: DEFAULT_MAP_WIDTH, height: DEFAULT_MAP_HEIGHT };
const tileState = new Map();
const MAP_STORAGE_KEY = 'noji-ingame-map-v1';

function getZoneMeta() {
  const colors = themes[currentTheme]?.colors || themes.frontier.colors;
  return Object.fromEntries(Object.entries(baseZones).map(([key, value]) => [key, { ...value, color: colors[key] }]));
}

function tileKey(q, r) { return `${q},${r}`; }

async function loadProject() {
  const res = await fetch('/data/project.json');
  projectData = await res.json();
  setupThemeSwitcher();
  setupMapZoomControls();
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

function clampMapSize(value) {
  return Math.max(8, Math.min(80, Number.parseInt(value, 10) || DEFAULT_MAP_WIDTH));
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

function axialToMeters(q, r) {
  return {
    x: HEX_SIDE_M * 1.5 * q,
    y: HEX_SIDE_M * Math.sqrt(3) * (r + q / 2)
  };
}

function distanceMeters(a, b) {
  const am = axialToMeters(a.q, a.r);
  const bm = axialToMeters(b.q, b.r);
  return Math.hypot(am.x - bm.x, am.y - bm.y);
}

function hexCornersArray(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = Math.PI / 180 * (60 * i);
    pts.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) });
  }
  return pts;
}

function hexCorners(cx, cy, size) {
  return hexCornersArray(cx, cy, size).map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

function edgeKey(a, b) {
  const aKey = `${a.x.toFixed(2)},${a.y.toFixed(2)}`;
  const bKey = `${b.x.toFixed(2)},${b.y.toFixed(2)}`;
  return [aKey, bKey].sort().join('|');
}

function collectHexEdges(edgeMap, corners, zone) {
  for (let i = 0; i < 6; i += 1) {
    const a = corners[i];
    const b = corners[(i + 1) % 6];
    const key = edgeKey(a, b);
    if (!edgeMap.has(key)) edgeMap.set(key, { a, b, zones: [] });
    edgeMap.get(key).zones.push(zone);
  }
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

function setupMapZoomControls() {
  const zoomOut = document.querySelector('#map-zoom-out');
  const zoomIn = document.querySelector('#map-zoom-in');
  const zoomReset = document.querySelector('#map-zoom-reset');
  if (!zoomOut || zoomOut.dataset.bound) return;
  zoomOut.dataset.bound = 'true';
  zoomOut.addEventListener('click', () => setMapZoom(mapZoom / 1.2));
  zoomIn.addEventListener('click', () => setMapZoom(mapZoom * 1.2));
  zoomReset.addEventListener('click', () => setMapZoom(1));
  updateMapZoomLabel();
}

function setMapZoom(next) {
  mapZoom = Math.max(0.5, Math.min(3, next));
  localStorage.setItem('noji-map-zoom', String(mapZoom));
  updateMapZoomLabel();
  renderHexMap(projectData);
}

function updateMapZoomLabel() {
  const label = document.querySelector('#map-zoom-reset');
  if (label) label.textContent = `${Math.round(mapZoom * 100)}%`;
}

function loadOverlayState() {
  try {
    return {
      src: localStorage.getItem('noji-overlay-src') || DEFAULT_OVERLAY_SRC,
      opacity: Number.parseFloat(localStorage.getItem('noji-overlay-opacity') || '0.48'),
      scale: Number.parseFloat(localStorage.getItem('noji-overlay-scale') || '1')
    };
  } catch {
    return { src: DEFAULT_OVERLAY_SRC, opacity: 0.48, scale: 1 };
  }
}

function saveOverlayState() {
  localStorage.setItem('noji-overlay-src', overlayState.src);
  localStorage.setItem('noji-overlay-opacity', String(overlayState.opacity));
  localStorage.setItem('noji-overlay-scale', String(overlayState.scale));
}

function setupMapAugmentControls() {
  const toggle = document.querySelector('#map-augment-toggle');
  if (!toggle || toggle.dataset.bound) return;
  toggle.dataset.bound = 'true';
  const opacity = document.querySelector('#overlay-opacity');
  const scale = document.querySelector('#overlay-scale');
  const scaleLabel = document.querySelector('#overlay-scale-label');
  const fileInput = document.querySelector('#overlay-image-file');
  toggle.checked = augmentEnabled;
  opacity.value = Math.round(overlayState.opacity * 100);
  scale.value = Math.round(overlayState.scale * 100);
  scaleLabel.textContent = `${Math.round(overlayState.scale * 100)}%`;
  applyOverlayState();
  toggle.addEventListener('change', () => {
    augmentEnabled = toggle.checked;
    localStorage.setItem('noji-map-augment', String(augmentEnabled));
    applyOverlayState();
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
  document.querySelector('#upload-overlay-image').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', importOverlayImage);
  document.querySelector('#reset-overlay-image').addEventListener('click', () => {
    overlayState.src = DEFAULT_OVERLAY_SRC;
    saveOverlayState();
    applyOverlayState();
  });
  document.querySelector('#delete-overlay-image').addEventListener('click', () => {
    overlayState.src = '';
    augmentEnabled = false;
    toggle.checked = false;
    localStorage.setItem('noji-map-augment', 'false');
    saveOverlayState();
    applyOverlayState();
  });
}

async function importOverlayImage(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    overlayState.src = String(reader.result);
    augmentEnabled = true;
    localStorage.setItem('noji-map-augment', 'true');
    saveOverlayState();
    document.querySelector('#map-augment-toggle').checked = true;
    applyOverlayState();
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function applyOverlayState() {
  const img = document.querySelector('#parcel-overlay');
  if (!img) return;
  document.body.classList.toggle('map-augment-on', augmentEnabled && Boolean(overlayState.src));
  img.src = overlayState.src || '';
  img.style.setProperty('--overlay-opacity', String(overlayState.opacity));
  img.style.setProperty('--overlay-scale', String(overlayState.scale));
}

function setupInlineEditor() {
  const toggle = document.querySelector('#toggle-map-editor');
  if (!toggle || toggle.dataset.bound) return;
  toggle.dataset.bound = 'true';
  toggle.addEventListener('click', () => {
    editorEnabled = !editorEnabled;
    measurePoints = [];
    document.body.classList.toggle('editor-mode', editorEnabled);
    document.querySelector('#inline-editor-panel').setAttribute('aria-hidden', String(!editorEnabled));
    toggle.textContent = editorEnabled ? 'Close Editor' : 'Map Editor';
    renderHexMap(projectData);
  });
  document.querySelectorAll('[data-editor-tool]').forEach(button => {
    button.addEventListener('click', () => {
      editorTool = button.dataset.editorTool;
      measurePoints = [];
      document.querySelectorAll('[data-editor-tool]').forEach(b => b.classList.toggle('active', b.dataset.editorTool === editorTool));
      renderHexMap(projectData);
    });
  });
  document.querySelector('#inline-zone-select').addEventListener('change', event => { paintZone = event.target.value; });
  document.querySelector('#brush-size-select').addEventListener('change', event => { brushSize = Number.parseInt(event.target.value, 10) || 1; renderInlineEditorStats(); });
  document.querySelector('#apply-map-size').addEventListener('click', applyMapSizeFromInputs);
  document.querySelector('#fit-map-view').addEventListener('click', () => { renderHexMap(projectData); renderInlineEditorStats('fit view'); });
  syncMapSizeInputs();
  document.querySelector('#export-inline-map').addEventListener('click', exportInlineMap);
  document.querySelector('#save-inline-map').addEventListener('click', () => { saveMapToStorage(); renderInlineEditorStats('saved locally'); });
  document.querySelector('#load-inline-map').addEventListener('click', () => document.querySelector('#inline-map-file').click());
  document.querySelector('#inline-map-file').addEventListener('change', importInlineMap);
}

function renderResourceBar(resources) {
  document.querySelector('#resource-bar').innerHTML = resources.map(r => `
    <div class="resource ${statusTone[r.status] || ''}">
      <b>${r.icon}</b><span>${r.name}</span><strong>${r.amount}</strong>
    </div>
  `).join('');
}

function renderHexMap(data) {
  initTileState();
  const svg = document.querySelector('#hex-svg');
  const selected = document.querySelector('#selected-tile');
  const legend = document.querySelector('#zone-legend');
  const zoneMeta = getZoneMeta();
  const Tile = defineHex({ dimensions: HEX_SIZE_PX, orientation: Orientation.FLAT });
  const grid = new Grid(Tile, rectangle({ width: mapSettings.width, height: mapSettings.height }));
  const counts = {};
  const minX = -HEX_SIZE_PX, minY = -HEX_SIZE_PX, maxX = mapSettings.width * HEX_SIZE_PX * 1.55, maxY = mapSettings.height * HEX_SIZE_PX * 1.78;
  const viewWidth = maxX - minX;
  const viewHeight = maxY - minY;

  svg.setAttribute('viewBox', `${minX} ${minY} ${viewWidth} ${viewHeight}`);
  const renderedWidth = viewWidth * mapZoom;
  const renderedHeight = viewHeight * mapZoom;
  svg.style.width = `${renderedWidth}px`;
  svg.style.height = `${renderedHeight}px`;
  const canvasLayer = document.querySelector('#map-canvas-layer');
  if (canvasLayer) {
    canvasLayer.style.width = `${renderedWidth}px`;
    canvasLayer.style.height = `${renderedHeight}px`;
  }
  updateMapZoomLabel();
  svg.innerHTML = `
    <defs>
      <filter id="tileGlow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="#e9c46a" flood-opacity="0.7"/>
      </filter>
    </defs>
  `;

  const pointByKey = new Map();
  const edgeMap = new Map();
  for (const hex of grid) {
    const { x, y } = hexToPoint(hex);
    const q = hex.q;
    const r = hex.r;
    const k = tileKey(q, r);
    let tile = tileState.get(k);
    if (!tile) {
      tile = { q, r, zone: classifyTile(q, r, mapSettings.width, mapSettings.height) };
      tileState.set(k, tile);
    }
    const zone = tile.zone;
    counts[zone] = (counts[zone] || 0) + 1;
    pointByKey.set(k, { x: x + 22, y: y + 22 });
    const meta = zoneMeta[zone] || zoneMeta.wild;
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const cx = x + 22;
    const cy = y + 22;
    const corners = hexCornersArray(cx, cy, HEX_SIZE_PX);
    const points = corners.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
    poly.setAttribute('points', points);
    poly.setAttribute('fill', meta.color);
    poly.setAttribute('class', `hex-tile zone-${zone}`);
    collectHexEdges(edgeMap, corners, zone);
    poly.dataset.q = q;
    poly.dataset.r = r;
    poly.dataset.zone = zone;
    poly.addEventListener('click', () => handleTileClick(tile, poly));
    svg.appendChild(poly);
  }

  renderZoneBoundaries(svg, edgeMap);
  renderMeasureOverlay(svg, pointByKey);
  renderLegend(legend, zoneMeta, counts);
  renderInlineEditorStats();

  document.querySelector('#reset-selection').onclick = () => {
    measurePoints = [];
    document.querySelectorAll('.hex-tile.selected').forEach(el => el.classList.remove('selected'));
    selected.textContent = editorEnabled ? editorHelpText() : '타일을 선택해봐.';
    renderHexMap(data);
  };
}

function getBrushTiles(center) {
  const radius = brushSize === 5 ? 2 : brushSize === 3 ? 1 : 0;
  const result = [];
  for (const tile of tileState.values()) {
    const dq = tile.q - center.q;
    const dr = tile.r - center.r;
    const ds = -dq - dr;
    const distance = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
    if (distance <= radius) result.push(tile);
  }
  return result;
}

function applyBrush(center) {
  const nextZone = editorTool === 'erase' ? 'wild' : paintZone;
  for (const tile of getBrushTiles(center)) tile.zone = nextZone;
  saveMapToStorage();
  renderHexMap(projectData);
  showTile(center, `${brushSize} hex brush`);
}

function handleTileClick(tile, poly) {
  const selected = document.querySelector('#selected-tile');
  const zoneMeta = getZoneMeta();
  if (editorEnabled && ['paint', 'erase'].includes(editorTool)) {
    applyBrush(tile);
    return;
  }
  if (editorEnabled && editorTool === 'measure') {
    measurePoints.push({ q: tile.q, r: tile.r });
    if (measurePoints.length > 2) measurePoints = [measurePoints.at(-1)];
    renderHexMap(projectData);
    if (measurePoints.length === 1) {
      selected.innerHTML = `<strong>📏 Measure</strong><span>start hex (${tile.q}, ${tile.r})</span><p>끝 hex를 선택해라.</p>`;
    } else {
      const d = distanceMeters(measurePoints[0], measurePoints[1]);
      selected.innerHTML = `<strong>📏 ${d.toFixed(2)}m</strong><span>center-to-center</span><p>hex (${measurePoints[0].q}, ${measurePoints[0].r}) → (${measurePoints[1].q}, ${measurePoints[1].r})</p>`;
    }
    return;
  }
  document.querySelectorAll('.hex-tile.selected').forEach(el => el.classList.remove('selected'));
  poly.classList.add('selected');
  const meta = zoneMeta[tile.zone];
  selected.innerHTML = `<strong>${meta.icon} ${meta.label}</strong><span>hex (${tile.q}, ${tile.r}) · 1평 · ${PYEONG_SQM.toFixed(3)}㎡</span><p>${zoneDescription(tile.zone)}</p>`;
}

function showTile(tile, suffix = 'edited') {
  const meta = getZoneMeta()[tile.zone];
  document.querySelector('#selected-tile').innerHTML = `<strong>${meta.icon} ${meta.label}</strong><span>hex (${tile.q}, ${tile.r}) · ${suffix}</span><p>${zoneDescription(tile.zone)}</p>`;
}

function renderZoneBoundaries(svg, edgeMap) {
  for (const edge of edgeMap.values()) {
    const uniqueZones = new Set(edge.zones);
    const isOuterEdge = edge.zones.length === 1;
    const isZoneBoundary = uniqueZones.size > 1;
    if (!isOuterEdge && !isZoneBoundary) continue;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', edge.a.x.toFixed(2));
    line.setAttribute('y1', edge.a.y.toFixed(2));
    line.setAttribute('x2', edge.b.x.toFixed(2));
    line.setAttribute('y2', edge.b.y.toFixed(2));
    line.setAttribute('class', isOuterEdge ? 'zone-edge-boundary map-outer-boundary' : 'zone-edge-boundary');
    svg.appendChild(line);
  }
}

function renderMeasureOverlay(svg, pointByKey) {
  if (measurePoints.length === 0) return;
  for (const p of measurePoints) {
    const pt = pointByKey.get(tileKey(p.q, p.r));
    if (!pt) continue;
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', pt.x);
    c.setAttribute('cy', pt.y);
    c.setAttribute('r', HEX_SIZE_PX * 0.34);
    c.setAttribute('class', 'inline-measure-point');
    svg.appendChild(c);
  }
  if (measurePoints.length !== 2) return;
  const a = pointByKey.get(tileKey(measurePoints[0].q, measurePoints[0].r));
  const b = pointByKey.get(tileKey(measurePoints[1].q, measurePoints[1].r));
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', a.x);
  line.setAttribute('y1', a.y);
  line.setAttribute('x2', b.x);
  line.setAttribute('y2', b.y);
  line.setAttribute('class', 'inline-measure-line');
  svg.appendChild(line);
}

function renderLegend(legend, zoneMeta, counts) {
  legend.innerHTML = Object.entries(zoneMeta).filter(([key]) => counts[key]).map(([key, meta]) => `
    <span class="legend-chip"><i style="background:${meta.color}"></i>${meta.icon} ${meta.label} <b>${counts[key]}</b></span>
  `).join('');
}

function renderInlineEditorStats(extra = '') {
  const el = document.querySelector('#inline-editor-stats');
  if (!el) return;
  const counts = {};
  tileState.forEach(tile => { counts[tile.zone] = (counts[tile.zone] || 0) + 1; });
  const zoneMeta = getZoneMeta();
  const total = tileState.size;
  const delta = total - TARGET_LAND_PYEONG;
  const landFitText = delta === 0 ? 'target 550평 exact' : `${Math.abs(delta)}평 ${delta > 0 ? '여유' : '부족'}`;
  const measureText = measurePoints.length === 2 ? ` · 측정 ${distanceMeters(measurePoints[0], measurePoints[1]).toFixed(2)}m` : '';
  el.innerHTML = `
    <span>맵 ${mapSettings.width}×${mapSettings.height} = ${total}평 / ${(total * PYEONG_SQM).toFixed(1)}㎡</span>
    <span>실토지 약 ${TARGET_LAND_PYEONG}평 기준 ${landFitText}</span>
    <span>brush ${brushSize} hex · side ${HEX_SIDE_M.toFixed(3)}m · width ${HEX_WIDTH_M.toFixed(3)}m · height ${HEX_HEIGHT_M.toFixed(3)}m${measureText}</span>
    <span>${Object.entries(counts).map(([zone, count]) => `${zoneMeta[zone]?.icon || ''} ${zone}: ${count}`).join(' · ')}</span>
    ${extra ? `<span class="good">${extra}</span>` : ''}
  `;
}

function editorHelpText() {
  if (editorTool === 'paint') return `Paint mode: ${paintZone} zone으로 칠하는 중.`;
  if (editorTool === 'erase') return 'Erase mode: 클릭한 타일을 wild로 되돌림.';
  if (editorTool === 'measure') return 'Measure mode: 두 hex를 선택하면 m 단위 거리를 표시.';
  return 'Inspect mode: 기존 맵 상태를 그대로 살펴보는 중.';
}

function buildMapPayload() {
  return {
    unit: {
      hexAreaSqm: PYEONG_SQM,
      hexAreaPyeong: 1,
      hexSideMeters: Number(HEX_SIDE_M.toFixed(6)),
      hexWidthMeters: Number(HEX_WIDTH_M.toFixed(6)),
      hexHeightMeters: Number(HEX_HEIGHT_M.toFixed(6)),
      coordinateSystem: 'flat-top axial q,r; distance measurements use center coordinates in meters'
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
  renderHexMap(projectData);
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
    renderHexMap(projectData);
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

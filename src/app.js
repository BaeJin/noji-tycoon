import './styles.css';

const PYEONG_SQM = 3.305785;
const SQM_PER_TILE = 1;
const PYEONG_PER_TILE = SQM_PER_TILE / PYEONG_SQM;
const DEFAULT_MAP_WIDTH = 80;
const DEFAULT_MAP_HEIGHT = 80;
const TARGET_LAND_PYEONG = 550;
const TARGET_LAND_SQM = TARGET_LAND_PYEONG * PYEONG_SQM;
const DEFAULT_OVERLAY_OPACITY = 0.48;
const SQUARE_SIZE_PX = 10;
const MAP_PADDING = SQUARE_SIZE_PX;
const ZOOM_MIN = 0.35;
const ZOOM_MAX = 4;
const TERRAIN_MIN = -10;
const TERRAIN_MAX = 30;
const CONTOUR_MAJOR_STEP = 5;
const PLAYER_NAME = '나';

/* ---------- seed content (first run only; afterwards editable in 관리 modal) ---------- */

const seedZones = {
  wild: { label: 'Wild Forest', icon: '🌲', color: null, unlockLevel: 0 },
  access: { label: 'Access Road', icon: '🛤️', color: null, unlockLevel: 0 },
  parking: { label: 'Parking', icon: '🚙', color: null, unlockLevel: 0 },
  camp: { label: 'Camp Field', icon: '⛺', color: null, unlockLevel: 0 },
  utility: { label: 'Utility Yard', icon: '⚙️', color: null, unlockLevel: 0 },
  restricted: { label: 'Restricted', icon: '⚠️', color: null, unlockLevel: 0 },
  garden: { label: 'Garden', icon: '🥬', color: null, unlockLevel: 0 },
  rest: { label: 'Rest Area', icon: '🔥', color: null, unlockLevel: 0 }
};

const seedItems = {
  tent: { label: '텐트', icon: '⛺', w: 10, h: 5, unlockLevel: 0, tint: '#3e8f66' },
  vehicle: { label: '차량', icon: '🚙', w: 5, h: 2, unlockLevel: 0, tint: '#7890a8' },
  toilet: { label: '간이화장실', icon: '🚻', w: 2, h: 2, unlockLevel: 0, tint: '#9b8456' },
  firepit: { label: '화로대', icon: '🔥', w: 1, h: 1, unlockLevel: 0, tint: '#d65345' }
};

const ITEM_TINTS = ['#3e8f66', '#7890a8', '#9b8456', '#d65345', '#6d8c3f', '#b28b45', '#5a7da8', '#a85a8f'];
const OBJECT_ROTATIONS = [0, 90, 180, 270];

const zoneSeedDescriptions = {
  wild: '아직 미개척. 보존하거나 나중에 용도 지정 가능.',
  access: '진입로, 작업동선, 임시 주차 후보.',
  parking: '차량 진입/주차 후보. 캠핑·작업 동선의 시작점.',
  camp: '텐트, 데크, 화로 같은 체류 오브젝트 후보.',
  utility: '물, 전기, 창고, 화장실 같은 기반시설 후보.',
  restricted: '하천/도로/규제 확인 전까지 잠긴 구역.',
  garden: '텃밭, 온실, 작물 실험 후보.',
  rest: '쉼터, 전망, 가족 모임 후보.'
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

/* ---------- state ---------- */

let projectData;
let gameState = null;
let defaultMapPayload = null;
let currentTheme = localStorage.getItem('noji-theme') || 'forest';
let editorEnabled = true;
let editorTool = 'inspect';
let paintZone = 'wild';
let brushSize = 1;
let terrainMode = 'raise';
let terrainLevel = 2;
let contoursVisible = localStorage.getItem('noji-contours') !== 'false';
let zoneBoundariesVisible = localStorage.getItem('noji-zone-boundaries') === 'true';
let placedObjects = [];
let placeType = 'tent';
let pendingPlaceInstanceId = null;
let placeRotation = 0;
let lastHoverTile = null;
let objectIdSeq = 1;
let measurePoints = [];
let mapZoom = Number.parseFloat(localStorage.getItem('noji-map-zoom') || '0');
const DEFAULT_OVERLAY_SRC = '/overlays/hachunri-179-2-available-land.png';
const DEFAULT_MAP_SRC = '/data/default-map.json';
let overlayState = loadOverlayState();
let mapSettings = { width: DEFAULT_MAP_WIDTH, height: DEFAULT_MAP_HEIGHT };
const tileState = new Map();
const rectByKey = new Map();
let fillTable = {};
let selectedTileKey = null;
let focusZone = null;
let panSuppressedClick = false;
let activeQuestTab = 'todo';
let pendingCompleteId = null;
let pendingCompleteTimer = null;
let adminTab = 'zones';
let toastTimer = null;
let selectedInventoryItem = null;
const MAP_STORAGE_KEY = 'noji-square-map-v1';
const GAME_STORAGE_KEY = 'noji-game-v1';

const mapDom = {
  get svg() { return document.querySelector('#tile-svg'); },
  get frame() { return document.querySelector('#map-frame'); },
  get wrap() { return document.querySelector('#map-frame-wrap'); },
  get canvasLayer() { return document.querySelector('#map-canvas-layer'); },
  get tooltip() { return document.querySelector('#tile-tooltip'); },
  get instancePicker() { return document.querySelector('#instance-picker'); },
  get legend() { return document.querySelector('#zone-legend'); },
  get editorContext() { return document.querySelector('#editor-context'); },
  get editorSettings() { return document.querySelector('#editor-settings'); },
  get overlayPanel() { return document.querySelector('#overlay-panel'); },
  get adminModal() { return document.querySelector('#admin-modal'); },
  get adminBody() { return document.querySelector('#admin-body'); }
};

/* ---------- game state: load / save / normalize ---------- */

function maxVillageLevel() {
  return (projectData?.levels?.length || 6) - 1;
}

function defaultGameState() {
  return {
    village: { level: projectData?.land?.level ?? 0 },
    zones: structuredClone(seedZones),
    items: structuredClone(seedItems),
    inventory: {},
    instances: [],
    players: (projectData?.players || []).map(p => ({
      id: p.id || makeId('player'),
      name: p.name || '나',
      role: p.role || '',
      status: p.status || 'active'
    })),
    quests: (projectData?.quests || []).map(q => ({
      id: q.id,
      title: q.title,
      desc: q.notes || '',
      method: '',
      unlockLevel: 0,
      prereq: null,
      materials: [],
      rewards: [],
      materialsGranted: false,
      status: 'todo',
      assignee: ''
    })),
    levelRequirements: {}
  };
}

function normalizeGameState(raw) {
  const base = defaultGameState();
  if (!raw || typeof raw !== 'object') return base;
  const state = {
    village: { level: Math.max(0, Math.min(maxVillageLevel(), Number.parseInt(raw.village?.level, 10) || 0)) },
    zones: {},
    items: {},
    inventory: {},
    instances: [],
    players: [],
    quests: [],
    levelRequirements: {}
  };
  const zonesSrc = raw.zones && typeof raw.zones === 'object' && Object.keys(raw.zones).length ? raw.zones : base.zones;
  for (const [key, z] of Object.entries(zonesSrc)) {
    if (!z || typeof z !== 'object') continue;
    state.zones[key] = {
      label: String(z.label || key),
      icon: String(z.icon || '🏷️'),
      color: typeof z.color === 'string' && z.color ? z.color : null,
      unlockLevel: Math.max(0, Math.min(maxVillageLevel(), Number.parseInt(z.unlockLevel, 10) || 0))
    };
  }
  if (!state.zones.wild) state.zones.wild = structuredClone(seedZones.wild);
  const itemsSrc = raw.items && typeof raw.items === 'object' && Object.keys(raw.items).length ? raw.items : base.items;
  for (const [key, it] of Object.entries(itemsSrc)) {
    if (!it || typeof it !== 'object') continue;
    state.items[key] = {
      label: String(it.label || key),
      icon: String(it.icon || '📦'),
      w: Math.max(1, Math.min(40, Number.parseInt(it.w, 10) || 1)),
      h: Math.max(1, Math.min(40, Number.parseInt(it.h, 10) || 1)),
      unlockLevel: Math.max(0, Math.min(maxVillageLevel(), Number.parseInt(it.unlockLevel, 10) || 0)),
      tint: typeof it.tint === 'string' ? it.tint : null
    };
  }
  if (raw.inventory && typeof raw.inventory === 'object') {
    for (const [key, count] of Object.entries(raw.inventory)) {
      if (state.items[key]) state.inventory[key] = Math.max(0, Number.parseInt(count, 10) || 0);
    }
  }
  if (Array.isArray(raw.instances)) {
    for (const inst of raw.instances) {
      if (!inst || !state.items[inst.type]) continue;
      state.instances.push({
        id: inst.id || makeId('inst'),
        type: inst.type,
        status: inst.status === 'owned' ? 'owned' : 'draft',
        label: String(inst.label || state.items[inst.type].label || '인스턴스'),
        owner: String(inst.owner || ''),
        files: normalizeAttachments(inst.files),
        images: normalizeAttachments(inst.images),
        createdAt: inst.createdAt || new Date().toISOString(),
        updatedAt: inst.updatedAt || inst.createdAt || new Date().toISOString()
      });
    }
  }
  const playersSrc = Array.isArray(raw.players) ? raw.players : base.players;
  state.players = playersSrc
    .filter(p => p && p.name)
    .map(p => ({
      id: p.id || makeId('player'),
      name: String(p.name),
      role: String(p.role || ''),
      status: String(p.status || 'active')
    }));
  if (!state.players.length) state.players.push({ id: 'me', name: PLAYER_NAME, role: '접속자', status: 'active' });
  const questsSrc = Array.isArray(raw.quests) ? raw.quests : base.quests;
  for (const q of questsSrc) {
    if (!q || !q.title) continue;
    state.quests.push({
      id: q.id || makeId('q'),
      title: String(q.title),
      desc: String(q.desc || ''),
      method: String(q.method || ''),
      unlockLevel: Math.max(0, Math.min(maxVillageLevel(), Number.parseInt(q.unlockLevel, 10) || 0)),
      prereq: q.prereq || null,
      materials: normalizeItemCounts(q.materials, state.items),
      rewards: (Array.isArray(q.rewards) ? q.rewards : [])
        .filter(rw => rw && state.items[rw.item])
        .map(rw => ({ item: rw.item, count: Math.max(1, Number.parseInt(rw.count, 10) || 1) })),
      materialsGranted: Boolean(q.materialsGranted),
      status: ['todo', 'doing', 'done'].includes(q.status) ? q.status : 'todo',
      assignee: String(q.assignee || '')
    });
  }
  if (raw.levelRequirements && typeof raw.levelRequirements === 'object') {
    for (const [lvl, reqs] of Object.entries(raw.levelRequirements)) {
      const level = Number.parseInt(lvl, 10);
      if (!Number.isInteger(level) || level < 1 || level > maxVillageLevel()) continue;
      state.levelRequirements[level] = (Array.isArray(reqs) ? reqs : [])
        .filter(rq => rq && state.items[rq.item])
        .map(rq => ({ item: rq.item, count: Math.max(1, Number.parseInt(rq.count, 10) || 1) }));
    }
  }
  return state;
}

function loadGameState() {
  try {
    const raw = localStorage.getItem(GAME_STORAGE_KEY);
    gameState = normalizeGameState(raw ? JSON.parse(raw) : null);
  } catch {
    gameState = defaultGameState();
  }
  if (!gameState.items[placeType]) placeType = Object.keys(gameState.items)[0] || 'tent';
  if (!selectedInventoryItem || !gameState.items[selectedInventoryItem]) selectedInventoryItem = placeType;
  if (!gameState.zones[paintZone]) paintZone = 'wild';
}

function saveGameState() {
  localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(gameState));
}

function normalizeAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(file => file && typeof file === 'object')
    .map(file => ({
      id: file.id || makeId('att'),
      name: String(file.name || 'attachment'),
      type: String(file.type || ''),
      size: Number.parseInt(file.size, 10) || 0,
      dataUrl: String(file.dataUrl || ''),
      addedAt: file.addedAt || new Date().toISOString()
    }))
    .filter(file => file.dataUrl);
}

function normalizeItemCounts(value, items = gameState?.items || {}) {
  return (Array.isArray(value) ? value : [])
    .filter(row => row && items[row.item])
    .map(row => ({ item: row.item, count: Math.max(1, Number.parseInt(row.count, 10) || 1) }));
}

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${objectIdSeq++}`;
}

/* ---------- item economy helpers ---------- */

function itemMeta(type) {
  return gameState?.items?.[type] || null;
}

function itemTint(type) {
  const meta = itemMeta(type);
  if (meta?.tint) return meta.tint;
  let hash = 0;
  for (const ch of type) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return ITEM_TINTS[hash % ITEM_TINTS.length];
}

function inventoryOf(type) { return gameState.inventory[type] || 0; }
function placedCountOf(type) { return placedObjects.filter(obj => obj.type === type).length; }
function ownedOf(type) { return inventoryOf(type) + placedCountOf(type); }
function instancesOf(type) { return gameState.instances.filter(inst => inst.type === type); }
function ownedInstancesOf(type) { return gameState.instances.filter(inst => inst.type === type && inst.status === 'owned'); }

function instanceById(id) {
  return gameState.instances.find(inst => inst.id === id) || null;
}

function availableInstancesForPlacement(type, currentObjectId = null) {
  const used = new Set(placedObjects
    .filter(obj => obj.instanceId && obj.id !== currentObjectId)
    .map(obj => obj.instanceId));
  return ownedInstancesOf(type).filter(inst => !used.has(inst.id));
}

function addInventory(type, delta) {
  if (!itemMeta(type)) return;
  gameState.inventory[type] = Math.max(0, inventoryOf(type) + delta);
  saveGameState();
}

function isZoneUnlocked(key) {
  return (gameState.zones[key]?.unlockLevel || 0) <= gameState.village.level;
}

function isItemUnlocked(key) {
  return (gameState.items[key]?.unlockLevel || 0) <= gameState.village.level;
}

/* ---------- zone meta ---------- */

function getZoneMeta() {
  const themeColors = themes[currentTheme]?.colors || themes.frontier.colors;
  return Object.fromEntries(Object.entries(gameState.zones).map(([key, zone]) => [key, {
    label: zone.label,
    icon: zone.icon || '🏷️',
    color: zone.color || themeColors[key] || '#5d7252',
    unlockLevel: zone.unlockLevel || 0
  }]));
}

function zoneDescription(zone) {
  return zoneSeedDescriptions[zone] || '';
}

function tileKey(q, r) { return `${q},${r}`; }
function tileH(tile) { return tile.h || 0; }
function clampTerrain(value) {
  return Math.max(TERRAIN_MIN, Math.min(TERRAIN_MAX, Math.round(Number(value) || 0)));
}

/* ---------- placed objects: geometry helpers ---------- */

function footprintOf(type, rot) {
  const meta = itemMeta(type) || { w: 1, h: 1 };
  return rot % 180 === 0 ? { w: meta.w, h: meta.h } : { w: meta.h, h: meta.w };
}

function objectFitsBounds(obj) {
  const { w, h } = footprintOf(obj.type, obj.rot);
  return obj.q >= 0 && obj.r >= 0 && obj.q + w <= mapSettings.width && obj.r + h <= mapSettings.height;
}

function objectsOverlap(a, b) {
  const fa = footprintOf(a.type, a.rot);
  const fb = footprintOf(b.type, b.rot);
  return a.q < b.q + fb.w && b.q < a.q + fa.w && a.r < b.r + fb.h && b.r < a.r + fa.h;
}

function objectAt(q, r) {
  return placedObjects.find(obj => {
    const { w, h } = footprintOf(obj.type, obj.rot);
    return q >= obj.q && q < obj.q + w && r >= obj.r && r < obj.r + h;
  }) || null;
}

function canPlaceObject(candidate, ignoreId = null) {
  if (!objectFitsBounds(candidate)) return false;
  return !placedObjects.some(obj => obj.id !== ignoreId && objectsOverlap(candidate, obj));
}

function placeAnchorFor(tile, type, rot) {
  const { w, h } = footprintOf(type, rot);
  const q = Math.max(0, Math.min(mapSettings.width - w, tile.q - Math.floor((w - 1) / 2)));
  const r = Math.max(0, Math.min(mapSettings.height - h, tile.r - Math.floor((h - 1) / 2)));
  return { q, r };
}

/* ---------- boot ---------- */

async function loadProject() {
  const [projectRes, defaultMapRes] = await Promise.all([
    fetch('/data/project.json'),
    fetch(DEFAULT_MAP_SRC).catch(() => null)
  ]);
  projectData = await projectRes.json();
  if (defaultMapRes?.ok) {
    try {
      defaultMapPayload = await defaultMapRes.json();
    } catch {
      defaultMapPayload = null;
    }
  }
  loadGameState();
  setupThemeSwitcher();
  setupMapInteractions();
  setupMapAugmentControls();
  setupInlineEditor();
  setupQuestBoard();
  setupInventory();
  setupAdmin();
  applyTheme(currentTheme);
  render(projectData);
}

function setupThemeSwitcher() {
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-theme]');
    if (!button) return;
    currentTheme = button.dataset.theme;
    localStorage.setItem('noji-theme', currentTheme);
    applyTheme(currentTheme);
    repaintTiles();
    updateLegend();
    renderEditorContext();
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
  if (defaultMapPayload && applyMapPayload(defaultMapPayload)) return;
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
      tileState.set(k, prior ? { ...prior } : { q, r, zone: classifyTile(q, r, next.width, next.height), h: 0 });
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

/* ---------- terrain fill ---------- */

function shadeColor(hex, amount) {
  const num = Number.parseInt(hex.slice(1), 16);
  const channel = shift => Math.max(0, Math.min(255, shift + amount));
  const r = channel((num >> 16) & 255);
  const g = channel((num >> 8) & 255);
  const b = channel(num & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const heightShadeCache = new Map();

function rebuildFillTable() {
  const meta = getZoneMeta();
  fillTable = {};
  heightShadeCache.clear();
  for (const [zone, value] of Object.entries(meta)) {
    fillTable[zone] = [
      value.color,
      shadeColor(value.color, 9),
      shadeColor(value.color, -8),
      shadeColor(value.color, 4)
    ];
  }
}

function fillFor(zone, q, r, h = 0) {
  const shades = fillTable[zone] || fillTable.wild;
  const n = ((q * 73856093) ^ (r * 19349663)) >>> 0;
  const base = shades[n % 4];
  if (!h) return base;
  const key = `${base}:${h}`;
  let shaded = heightShadeCache.get(key);
  if (!shaded) {
    shaded = shadeColor(base, Math.max(-30, Math.min(66, h * 5)));
    heightShadeCache.set(key, shaded);
  }
  return shaded;
}

/* ---------- main render ---------- */

function render(data) {
  initTileState();
  buildMapDom();
  editorEnabled = true;
  editorTool = 'inspect';
  document.body.classList.add('editor-mode');
  document.querySelectorAll('[data-editor-tool]').forEach(b => b.classList.toggle('active', b.dataset.editorTool === editorTool));
  if (!mapZoom || Number.isNaN(mapZoom)) fitView();
  renderGame();
  renderCurrentPlayer();
}

function renderGame() {
  renderVillagePanel();
  renderLevels();
  renderQuestBoard();
  renderInventory();
  renderInstancePanel();
  renderInlineEditorStats();
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
    <g id="contour-layer"></g>
    <g id="line-layer"></g>
    <g id="object-layer"></g>
    <g id="ghost-layer"></g>
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
        tile = { q, r, zone: classifyTile(q, r, mapSettings.width, mapSettings.height), h: 0 };
        tileState.set(k, tile);
      }
      const { x, y, size } = tileRectPx(q, r);
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', size);
      rect.setAttribute('height', size);
      rect.setAttribute('fill', fillFor(tile.zone, q, r, tileH(tile)));
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
  renderObjectsLayer();
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
    rect.setAttribute('fill', fillFor(tile.zone, tile.q, tile.r, tileH(tile)));
    rect.setAttribute('class', `square-tile zone-${tile.zone}${focusZone && tile.zone !== focusZone ? ' zone-dimmed' : ''}`);
  }
}

/* ---------- placed objects: rendering ---------- */

function renderObjectsLayer() {
  const layer = mapDom.svg.querySelector('#object-layer');
  if (!layer) return;
  layer.innerHTML = '';
  for (const obj of placedObjects) {
    const meta = itemMeta(obj.type);
    if (!meta) continue;
    const { w, h } = footprintOf(obj.type, obj.rot);
    const { x, y } = tileRectPx(obj.q, obj.r);
    const pw = w * SQUARE_SIZE_PX;
    const ph = h * SQUARE_SIZE_PX;
    const cx = x + pw / 2;
    const cy = y + ph / 2;
    const iconSize = Math.min(pw, ph) * 0.74;
    const arrowSpan = Math.min(pw, ph) * 0.22;
    const inst = instanceById(obj.instanceId);
    const label = inst?.label || '';
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'map-object');
    g.dataset.objectId = obj.id;
    g.innerHTML = `
      <rect class="map-object-rect" x="${x}" y="${y}" width="${pw}" height="${ph}" rx="${SQUARE_SIZE_PX * 0.3}" style="fill:${itemTint(obj.type)}" />
      <polygon class="map-object-arrow" points="${cx - arrowSpan},${y + ph * 0.16 + arrowSpan} ${cx + arrowSpan},${y + ph * 0.16 + arrowSpan} ${cx},${y + ph * 0.16}"
        transform="rotate(${obj.rot} ${cx} ${cy})" />
      <text class="map-object-icon" x="${cx}" y="${cy}" font-size="${iconSize}">${meta.icon}</text>
      ${label ? `<text class="map-object-label" x="${cx}" y="${y + ph - 4}">${label}</text>` : ''}
    `;
    layer.appendChild(g);
  }
}

function updateGhost(tile) {
  const layer = mapDom.svg?.querySelector('#ghost-layer');
  if (!layer) return;
  if (!tile || !editorEnabled || editorTool !== 'place' || !itemMeta(placeType)) {
    layer.innerHTML = '';
    return;
  }
  const anchor = placeAnchorFor(tile, placeType, placeRotation);
  const candidate = { type: placeType, q: anchor.q, r: anchor.r, rot: placeRotation };
  const hit = objectAt(tile.q, tile.r);
  const selectedInstance = instanceById(pendingPlaceInstanceId);
  const validInstance = selectedInstance?.type === placeType && selectedInstance.status === 'owned' && availableInstancesForPlacement(placeType).some(inst => inst.id === selectedInstance.id);
  const valid = !hit && canPlaceObject(candidate) && inventoryOf(placeType) > 0 && validInstance;
  const { w, h } = footprintOf(placeType, placeRotation);
  const { x, y } = tileRectPx(anchor.q, anchor.r);
  const pw = w * SQUARE_SIZE_PX;
  const ph = h * SQUARE_SIZE_PX;
  const meta = itemMeta(placeType);
  layer.innerHTML = hit ? `
    <rect class="object-ghost pickup" x="${tileRectPx(hit.q, hit.r).x}" y="${tileRectPx(hit.q, hit.r).y}"
      width="${footprintOf(hit.type, hit.rot).w * SQUARE_SIZE_PX}" height="${footprintOf(hit.type, hit.rot).h * SQUARE_SIZE_PX}" rx="${SQUARE_SIZE_PX * 0.3}" />
  ` : `
    <rect class="object-ghost ${valid ? 'valid' : 'invalid'}" x="${x}" y="${y}" width="${pw}" height="${ph}" rx="${SQUARE_SIZE_PX * 0.3}" />
    <text class="map-object-icon ghost-icon" x="${x + pw / 2}" y="${y + ph / 2}" font-size="${Math.min(pw, ph) * 0.74}">${meta.icon}</text>
  `;
}

/* ---------- zone boundaries + contours ---------- */

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

function collectSquareEdges(edgeMap, corners, zone, h) {
  for (let i = 0; i < 4; i += 1) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const key = edgeKey(a, b);
    if (!edgeMap.has(key)) edgeMap.set(key, { a, b, zones: [], hs: [] });
    const edge = edgeMap.get(key);
    edge.zones.push(zone);
    edge.hs.push(h);
  }
}

function makeEdgeLine(edge, className) {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', edge.a.x);
  line.setAttribute('y1', edge.a.y);
  line.setAttribute('x2', edge.b.x);
  line.setAttribute('y2', edge.b.y);
  line.setAttribute('class', className);
  return line;
}

function updateBoundaries() {
  const svg = mapDom.svg;
  const layer = svg.querySelector('#line-layer');
  const contourLayer = svg.querySelector('#contour-layer');
  if (!layer || !contourLayer) return;
  const edgeMap = new Map();
  for (const tile of tileState.values()) {
    const { x, y, size } = tileRectPx(tile.q, tile.r);
    collectSquareEdges(edgeMap, squareCornersArray(x, y, size), tile.zone, tileH(tile));
  }
  layer.innerHTML = '';
  contourLayer.innerHTML = '';
  const frag = document.createDocumentFragment();
  const contourFrag = document.createDocumentFragment();
  for (const edge of edgeMap.values()) {
    const uniqueZones = new Set(edge.zones);
    const isOuterEdge = edge.zones.length === 1;
    const isZoneBoundary = uniqueZones.size > 1;
    if (isOuterEdge || isZoneBoundary) {
      frag.appendChild(makeEdgeLine(edge, isOuterEdge ? 'zone-edge-boundary map-outer-boundary' : 'zone-edge-boundary'));
    }
    if (edge.hs.length === 2 && edge.hs[0] !== edge.hs[1]) {
      const lo = Math.min(edge.hs[0], edge.hs[1]);
      const hi = Math.max(edge.hs[0], edge.hs[1]);
      let major = false;
      for (let level = lo + 1; level <= hi; level += 1) {
        if (level % CONTOUR_MAJOR_STEP === 0) { major = true; break; }
      }
      contourFrag.appendChild(makeEdgeLine(edge, major ? 'contour-line contour-major' : 'contour-line'));
    }
  }
  layer.appendChild(frag);
  contourLayer.appendChild(contourFrag);
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

  const contourToggle = document.querySelector('#map-contour-toggle');
  const syncContourToggle = () => {
    document.body.classList.toggle('contours-off', !contoursVisible);
    contourToggle.classList.toggle('active', contoursVisible);
  };
  syncContourToggle();
  contourToggle.addEventListener('click', () => {
    contoursVisible = !contoursVisible;
    localStorage.setItem('noji-contours', String(contoursVisible));
    syncContourToggle();
  });

  const boundaryToggle = document.querySelector('#map-boundary-toggle');
  const syncBoundaryToggle = () => {
    document.body.classList.toggle('zone-boundaries-off', !zoneBoundariesVisible);
    boundaryToggle.classList.toggle('active', zoneBoundariesVisible);
  };
  syncBoundaryToggle();
  boundaryToggle.addEventListener('click', () => {
    zoneBoundariesVisible = !zoneBoundariesVisible;
    localStorage.setItem('noji-zone-boundaries', String(zoneBoundariesVisible));
    syncBoundaryToggle();
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
  for (const [k, rect] of rectByKey) {
    const tile = tileState.get(k);
    if (!tile) continue;
    rect.classList.toggle('zone-dimmed', Boolean(focusZone) && tile.zone !== focusZone);
  }
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
  lastHoverTile = tile;
  updateGhost(tile);
  const objectHere = objectAt(tile.q, tile.r);
  const zoneMeta = getZoneMeta();
  const meta = zoneMeta[tile.zone] || zoneMeta.wild;
  const tooltip = mapDom.tooltip;
  tooltip.hidden = false;
  let hint = '';
  if (editorEnabled && editorTool === 'place') {
    const placeMeta = itemMeta(placeType);
    const { w, h } = footprintOf(placeType, placeRotation);
    hint = objectHere
      ? `<em>📦 ${itemMeta(objectHere.type)?.icon || ''} ${itemMeta(objectHere.type)?.label || ''} — 클릭해서 집어 옮기기</em>`
      : `<em>📦 ${placeMeta?.icon || ''} ${placeMeta?.label || ''} ${w}×${h}m · 보유 ${inventoryOf(placeType)} · R 회전</em>`;
  } else if (editorEnabled && editorTool === 'erase' && objectHere) {
    hint = `<em>🧽 ${itemMeta(objectHere.type)?.icon || ''} ${itemMeta(objectHere.type)?.label || ''} 제거 (인벤토리 반환)</em>`;
  } else if (editorEnabled && (editorTool === 'paint' || editorTool === 'erase')) {
    const zoneIcon = zoneMeta[paintZone]?.icon || '';
    hint = `<em>${editorTool === 'paint' ? `🖌 ${zoneIcon} ${zoneMeta[paintZone]?.label || paintZone}` : '🧽 → wild'} · ${brushSize}m</em>`;
  } else if (editorEnabled && editorTool === 'terrain') {
    const modeText = terrainMode === 'raise' ? '▲ +1m' : terrainMode === 'lower' ? '▼ −1m' : `▦ ${terrainLevel}m 평탄화`;
    hint = `<em>⛰ ${modeText} · ${brushSize}m</em>`;
  } else if (editorEnabled && editorTool === 'measure') {
    hint = measurePoints.length === 1 ? '<em>📏 끝 타일 클릭</em>' : '<em>📏 시작 타일 클릭</em>';
  } else {
    hint = `<em class="desc">${zoneDescription(tile.zone) || ''}</em>`;
  }
  const objectLine = objectHere && !(editorEnabled && ['place', 'erase'].includes(editorTool))
    ? `<span>📦 ${itemMeta(objectHere.type)?.icon || ''} ${itemMeta(objectHere.type)?.label || ''}</span>` : '';
  tooltip.innerHTML = `<b>${meta.icon} ${meta.label}</b><span>(${tile.q}, ${tile.r}) · 고도 ${tileH(tile)}m</span>${objectLine}${hint}`;

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
  lastHoverTile = null;
  updateGhost(null);
}

/* ---------- selection / tile click ---------- */

function handleTileClick(tile, rectEl) {
  if (editorEnabled && editorTool === 'place') {
    handlePlaceClick(tile);
    return;
  }
  if (editorEnabled && editorTool === 'erase') {
    const hit = objectAt(tile.q, tile.r);
    if (hit) {
      removeObject(hit.id, { refund: true });
      return;
    }
  }
  if (editorEnabled && ['paint', 'erase'].includes(editorTool)) {
    applyBrush(tile);
    return;
  }
  if (editorEnabled && editorTool === 'terrain') {
    applyTerrainBrush(tile);
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
  if (!gameState.zones[nextZone] || (editorTool === 'paint' && !isZoneUnlocked(nextZone))) return;
  for (const tile of getBrushTiles(center)) {
    if (tile.zone === nextZone) continue;
    tile.zone = nextZone;
    const rect = rectByKey.get(tileKey(tile.q, tile.r));
    if (rect) {
      rect.setAttribute('fill', fillFor(nextZone, tile.q, tile.r, tileH(tile)));
      rect.setAttribute('class', `square-tile zone-${nextZone}${focusZone && nextZone !== focusZone ? ' zone-dimmed' : ''}`);
    }
  }
  saveMapToStorage();
  updateBoundaries();
  updateLegend();
  renderInlineEditorStats();
}

/* ---------- placed objects: editing ---------- */

function handlePlaceClick(tile) {
  const hit = objectAt(tile.q, tile.r);
  if (hit) {
    placedObjects = placedObjects.filter(obj => obj.id !== hit.id);
    addInventory(hit.type, 1);
    placeType = hit.type;
    pendingPlaceInstanceId = hit.instanceId || null;
    placeRotation = hit.rot;
    renderObjectsLayer();
    renderEditorContext();
    renderInventory();
    saveMapToStorage();
    renderInlineEditorStats(`${itemMeta(hit.type)?.label || ''} 집음 — 클릭해서 다시 설치`);
    updateGhost(tile);
    return;
  }
  if (inventoryOf(placeType) <= 0) {
    showToast(`📦 ${itemMeta(placeType)?.label || ''} 보유 없음 — 퀘스트 보상으로 획득하세요`);
    return;
  }
  const selectedInstance = instanceById(pendingPlaceInstanceId);
  if (!selectedInstance || selectedInstance.type !== placeType || selectedInstance.status !== 'owned') {
    showPlaceInstancePicker(placeType);
    showToast('설치할 인스턴스를 먼저 선택하세요');
    return;
  }
  if (!availableInstancesForPlacement(placeType).some(inst => inst.id === selectedInstance.id)) {
    pendingPlaceInstanceId = null;
    showPlaceInstancePicker(placeType);
    showToast('이미 배치된 인스턴스입니다. 다른 인스턴스를 선택하세요');
    return;
  }
  const anchor = placeAnchorFor(tile, placeType, placeRotation);
  const candidate = { id: makeId('obj'), type: placeType, q: anchor.q, r: anchor.r, rot: placeRotation, instanceId: selectedInstance.id };
  if (!canPlaceObject(candidate)) return;
  placedObjects.push(candidate);
  addInventory(placeType, -1);
  pendingPlaceInstanceId = null;
  renderObjectsLayer();
  renderEditorContext();
  renderInventory();
  saveMapToStorage();
  renderInlineEditorStats();
  hideInstancePicker();
  updateGhost(tile);
}

function hideInstancePicker() {
  const picker = mapDom.instancePicker;
  if (!picker) return;
  picker.hidden = true;
  picker.innerHTML = '';
}

function showInstancePicker(objectId) {
  const picker = mapDom.instancePicker;
  if (!picker) return;
  const obj = placedObjects.find(o => o.id === objectId);
  if (!obj) { hideInstancePicker(); return; }
  const item = itemMeta(obj.type);
  const instances = availableInstancesForPlacement(obj.type, objectId);
  picker.hidden = false;
  picker.dataset.objectId = objectId;
  picker.innerHTML = `
    <div class="instance-picker-head">
      <strong>${item?.icon || '📦'} ${item?.label || obj.type} 인스턴스 선택</strong>
      <button data-picker-act="close" title="나중에 선택">✕</button>
    </div>
    ${instances.length ? `
      <div class="instance-picker-list">
        ${instances.map(inst => `<button data-picker-instance="${inst.id}"><b>${inst.label}</b>${inst.owner ? `<span>${inst.owner}</span>` : ''}</button>`).join('')}
      </div>
    ` : '<p>선택 가능한 보유완료 인스턴스가 없습니다. 인스턴스를 완료한 뒤 다시 설치하세요.</p>'}
  `;
}

function showPlaceInstancePicker(type) {
  const picker = mapDom.instancePicker;
  if (!picker) return;
  const item = itemMeta(type);
  const instances = availableInstancesForPlacement(type);
  picker.hidden = false;
  picker.dataset.objectId = '';
  picker.dataset.placeType = type;
  picker.innerHTML = `
    <div class="instance-picker-head">
      <strong>${item?.icon || '📦'} ${item?.label || type} 설치 인스턴스 선택</strong>
      <button data-picker-act="close" title="닫기">✕</button>
    </div>
    ${instances.length ? `
      <div class="instance-picker-list">
        ${instances.map(inst => `<button data-picker-place-instance="${inst.id}" class="${pendingPlaceInstanceId === inst.id ? 'active' : ''}"><b>${inst.label}</b>${inst.owner ? `<span>${inst.owner}</span>` : ''}</button>`).join('')}
      </div>
    ` : '<p>설치 가능한 보유완료 인스턴스가 없습니다. 인스턴스를 완료한 뒤 선택하세요.</p>'}
  `;
}

function selectInstanceForPlacement(instanceId) {
  const inst = instanceById(instanceId);
  if (!inst || inst.status !== 'owned') return;
  if (!availableInstancesForPlacement(inst.type).some(candidate => candidate.id === inst.id)) return;
  placeType = inst.type;
  pendingPlaceInstanceId = inst.id;
  hideInstancePicker();
  renderEditorContext();
  if (lastHoverTile) updateGhost(lastHoverTile);
  showToast(`📦 ${inst.label} 선택됨 — 맵을 클릭해 설치하세요`);
}

function selectInstanceForObject(objectId, instanceId) {
  const obj = placedObjects.find(o => o.id === objectId);
  const inst = instanceById(instanceId);
  if (!obj || !inst || inst.type !== obj.type || inst.status !== 'owned') return;
  if (!availableInstancesForPlacement(obj.type, objectId).some(candidate => candidate.id === inst.id)) return;
  obj.instanceId = inst.id;
  saveMapToStorage();
  renderObjectsLayer();
  hideInstancePicker();
  showToast(`📍 ${inst.label} 배치 연결`);
}

function removeObject(id, { refund = true } = {}) {
  const obj = placedObjects.find(o => o.id === id);
  placedObjects = placedObjects.filter(o => o.id !== id);
  if (obj && refund) addInventory(obj.type, 1);
  renderObjectsLayer();
  renderInventory();
  saveMapToStorage();
  renderInlineEditorStats(obj ? `${itemMeta(obj.type)?.label || ''} 제거됨${refund ? ' (인벤토리 반환)' : ''}` : '');
  if (lastHoverTile) updateGhost(lastHoverTile);
}

function rotatePlaceObject() {
  placeRotation = OBJECT_ROTATIONS[(OBJECT_ROTATIONS.indexOf(placeRotation) + 1) % OBJECT_ROTATIONS.length];
  renderEditorContext();
  if (lastHoverTile) updateGhost(lastHoverTile);
}

function revalidatePlacedObjects() {
  const keep = [];
  let returned = 0;
  for (const obj of placedObjects) {
    if (itemMeta(obj.type) && objectFitsBounds(obj) && !keep.some(other => objectsOverlap(obj, other))) {
      keep.push(obj);
    } else {
      if (itemMeta(obj.type)) addInventory(obj.type, 1);
      returned += 1;
    }
  }
  if (returned > 0) {
    placedObjects = keep;
    renderObjectsLayer();
    saveMapToStorage();
    showToast(`📦 배치 불가능해진 오브젝트 ${returned}개를 인벤토리로 회수했습니다`);
  }
}

function applyTerrainBrush(center) {
  let changed = false;
  for (const tile of getBrushTiles(center)) {
    const current = tileH(tile);
    const next = clampTerrain(
      terrainMode === 'raise' ? current + 1
      : terrainMode === 'lower' ? current - 1
      : terrainLevel
    );
    if (next === current) continue;
    tile.h = next;
    changed = true;
    const rect = rectByKey.get(tileKey(tile.q, tile.r));
    if (rect) rect.setAttribute('fill', fillFor(tile.zone, tile.q, tile.r, next));
  }
  if (!changed) return;
  saveMapToStorage();
  updateBoundaries();
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
      <i style="background:${meta.color}"></i>${meta.icon} ${meta.label} <b>${zoneAreaText(counts[key])}</b>
    </button>
  `).join('');
}

function zoneAreaText(count) {
  const sqm = count * SQM_PER_TILE;
  const pyeong = sqm / PYEONG_SQM;
  return `${sqm.toFixed(0)}m2 / ${pyeong.toFixed(1)}평`;
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
  el.remove();
}

/* ---------- village panel (level + upgrade) ---------- */

function levelMetaOf(level) {
  return (projectData?.levels || []).find(l => l.level === level) || null;
}

function renderVillagePanel() {
  const level = gameState.village.level;
  const meta = levelMetaOf(level);
  const next = levelMetaOf(level + 1);
  document.querySelector('#land-name').textContent = 'Hachunri 179-2';
  document.querySelector('#land-level').textContent = `Lv.${level} ${meta?.name || ''}`;
  document.querySelector('#land-summary').textContent = projectData.land.address;
  document.querySelector('#level-fill').style.width = `${Math.min(100, (level / maxVillageLevel()) * 100)}%`;

  const box = document.querySelector('#upgrade-box');
  if (!box) return;
  if (!next) {
    box.innerHTML = '<p class="upgrade-note">🏆 최고 레벨 달성</p>';
    return;
  }
  const reqs = gameState.levelRequirements[level + 1] || [];
  if (reqs.length === 0) {
    box.innerHTML = `
      <p class="upgrade-target">다음: Lv.${level + 1} ${next.name}</p>
      <p class="upgrade-note">업그레이드 조건 미정의 — ⚙ 관리 → 레벨 조건에서 필요한 아이템을 정의하세요.</p>
      <button class="upgrade-button" disabled>⬆ 업그레이드</button>
    `;
    return;
  }
  const rows = reqs.map(rq => {
    const it = itemMeta(rq.item);
    const have = ownedOf(rq.item);
    const met = have >= rq.count;
    return `<div class="req-row ${met ? 'met' : ''}"><span>${it?.icon || '📦'} ${it?.label || rq.item}</span><b>${have} / ${rq.count}</b><i>${met ? '✓' : '✗'}</i></div>`;
  }).join('');
  const allMet = reqs.every(rq => ownedOf(rq.item) >= rq.count);
  box.innerHTML = `
    <p class="upgrade-target">다음: Lv.${level + 1} ${next.name}</p>
    <div class="req-list">${rows}</div>
    <button class="upgrade-button" id="village-upgrade" ${allMet ? '' : 'disabled'}>⬆ Lv.${level + 1}로 업그레이드</button>
  `;
  const btn = document.querySelector('#village-upgrade');
  if (btn && allMet) {
    btn.addEventListener('click', () => {
      gameState.village.level += 1;
      saveGameState();
      showToast(`🎉 마을 레벨 업! Lv.${gameState.village.level} ${levelMetaOf(gameState.village.level)?.name || ''}`);
      renderGame();
      renderEditorContext();
    });
  }
}

function renderLevels() {
  const currentLevel = gameState.village.level;
  document.querySelector('#levels').innerHTML = (projectData.levels || []).map(level => {
    const unlocks = Object.entries(gameState.items)
      .filter(([, it]) => (it.unlockLevel || 0) === level.level)
      .map(([key, it]) => `<span class="level-unlock" data-level-item="${key}">${it.icon || '📦'} ${it.label}</span>`)
      .join('');
    return `
    <article class="era ${level.level === currentLevel ? 'current' : level.level < currentLevel ? 'done' : 'locked'}">
      <b>Lv.${level.level}</b><div><strong>${level.name}</strong><p>${level.description}</p>${unlocks ? `<div class="level-unlocks">해금 아이템 ${unlocks}</div>` : ''}</div>
    </article>
  `;
  }).join('');
}

/* ---------- quest board ---------- */

function questById(id) {
  return gameState.quests.find(q => q.id === id) || null;
}

function isQuestVisible(q) {
  if ((q.unlockLevel || 0) > gameState.village.level) return false;
  if (q.prereq) {
    const pre = questById(q.prereq);
    if (pre && pre.status !== 'done') return false;
  }
  return true;
}

function rewardText(items) {
  if (!items?.length) return '';
  return items.map(rw => `${itemMeta(rw.item)?.icon || '📦'} ${itemMeta(rw.item)?.label || rw.item} ×${rw.count}`).join(' · ');
}

function renderQuestBoard() {
  const listEl = document.querySelector('#quests');
  if (!listEl) return;
  const groups = {
    todo: gameState.quests.filter(q => q.status === 'todo' && isQuestVisible(q)),
    doing: gameState.quests.filter(q => q.status === 'doing'),
    done: gameState.quests.filter(q => q.status === 'done')
  };
  document.querySelectorAll('[data-quest-tab]').forEach(btn => {
    const tab = btn.dataset.questTab;
    btn.classList.toggle('active', tab === activeQuestTab);
    btn.innerHTML = `${{ todo: '가능', doing: '진행', done: '완료' }[tab]} <b>${groups[tab].length}</b>`;
  });
  const quests = groups[activeQuestTab];
  if (!quests.length) {
    listEl.innerHTML = `<p class="quest-empty">${{
      todo: '수행 가능한 퀘스트가 없습니다. 레벨 업 또는 선행 퀘스트 완료로 해금됩니다.',
      doing: '진행 중인 퀘스트가 없습니다. 가능 탭에서 퀘스트를 시작하세요.',
      done: '완료한 퀘스트가 아직 없습니다.'
    }[activeQuestTab]}</p>`;
    return;
  }
  listEl.innerHTML = quests.map(q => {
    const rewards = rewardText(q.rewards);
    const materials = rewardText(q.materials);
    const confirming = pendingCompleteId === q.id;
    return `
    <article class="quest q-${q.status}" data-quest-id="${q.id}">
      <span>QUEST${q.unlockLevel ? ` · Lv.${q.unlockLevel}+` : ''}</span>
      <h3>${q.title}</h3>
      ${q.desc ? `<p>${q.desc}</p>` : ''}
      ${q.method ? `<p class="q-method">▶ ${q.method}</p>` : ''}
      ${materials ? `<div class="q-materials">🧰 재료 ${materials}${q.materialsGranted ? ' · 지급됨' : ''}</div>` : ''}
      ${rewards ? `<div class="q-rewards">🎁 ${rewards}</div>` : ''}
      ${q.status === 'todo' ? '<button class="q-action" data-quest-act="start">▶ 수행하기</button>' : ''}
      ${q.status === 'doing' ? `
        <div class="q-doing-row">
          <button class="q-action ${confirming ? 'confirm' : ''}" data-quest-act="complete">${confirming ? '✓ 한 번 더 클릭하면 완료' : '✅ 완료하기'}</button>
          <button class="q-cancel" data-quest-act="cancel" title="가능 목록으로 되돌리기">↩</button>
        </div>
        <b>담당: ${q.assignee || PLAYER_NAME}</b>` : ''}
      ${q.status === 'done' ? `<b class="q-done-badge">✓ 완료${q.assignee ? ` · ${q.assignee}` : ''}</b>` : ''}
    </article>
  `;
  }).join('');
}

function setupQuestBoard() {
  document.querySelectorAll('[data-quest-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeQuestTab = btn.dataset.questTab;
      clearPendingComplete();
      renderQuestBoard();
    });
  });
  document.querySelector('#quests').addEventListener('click', event => {
    const actBtn = event.target.closest('[data-quest-act]');
    if (!actBtn) return;
    const card = event.target.closest('[data-quest-id]');
    const quest = questById(card?.dataset.questId);
    if (!quest) return;
    const act = actBtn.dataset.questAct;
    if (act === 'start' && quest.status === 'todo') {
      quest.status = 'doing';
      quest.assignee = PLAYER_NAME;
      if (!quest.materialsGranted) {
        for (const mt of quest.materials || []) addInventory(mt.item, mt.count);
        quest.materialsGranted = true;
      }
      saveGameState();
      showToast(`▶ 퀘스트 시작: ${quest.title}${quest.materials?.length ? ' · 재료 지급' : ''}`);
      activeQuestTab = 'doing';
      renderQuestBoard();
      return;
    }
    if (act === 'cancel' && quest.status === 'doing') {
      quest.status = 'todo';
      quest.assignee = '';
      clearPendingComplete();
      saveGameState();
      renderQuestBoard();
      return;
    }
    if (act === 'complete' && quest.status === 'doing') {
      if (pendingCompleteId !== quest.id) {
        clearPendingComplete();
        pendingCompleteId = quest.id;
        pendingCompleteTimer = setTimeout(() => { clearPendingComplete(); renderQuestBoard(); }, 4000);
        renderQuestBoard();
        return;
      }
      clearPendingComplete();
      completeQuest(quest);
    }
  });
}

function clearPendingComplete() {
  pendingCompleteId = null;
  if (pendingCompleteTimer) { clearTimeout(pendingCompleteTimer); pendingCompleteTimer = null; }
}

function completeQuest(quest) {
  quest.status = 'done';
  for (const rw of quest.rewards || []) addInventory(rw.item, rw.count);
  saveGameState();
  const rewards = rewardText(quest.rewards);
  showToast(`✅ ${quest.title} 완료!${rewards ? ` 보상: ${rewards}` : ''}`);
  activeQuestTab = 'done';
  renderGame();
}

/* ---------- inventory + item instances ---------- */

function renderInventory() {
  const el = document.querySelector('#inventory');
  if (!el) return;
  const entries = Object.entries(gameState.items);
  if (!entries.length) {
    el.innerHTML = '<p class="quest-empty">아이템이 없습니다. ⚙ 관리 → 아이템에서 정의하세요.</p>';
    return;
  }
  el.innerHTML = entries.map(([key, it]) => {
    const locked = !isItemUnlocked(key);
    const stock = inventoryOf(key);
    const placed = placedCountOf(key);
    const instCount = instancesOf(key).length;
    const ownedInstCount = ownedInstancesOf(key).length;
    return `
    <button class="inv-card ${selectedInventoryItem === key ? 'selected' : ''} ${locked ? 'locked' : ''} ${!locked && stock === 0 ? 'empty' : ''}" data-inv-item="${key}"
      title="${locked ? `Lv.${it.unlockLevel}에 해금` : `${it.label} ${it.w}×${it.h}m — 클릭하면 인스턴스 목록`}">
      <span class="inv-icon">${locked ? '🔒' : it.icon}</span>
      <small>${it.label}</small>
      <i>${it.w}×${it.h}m${locked ? ` · Lv.${it.unlockLevel}` : ''}</i>
      ${!locked ? `<b class="inv-count">${stock}</b>` : ''}
      ${!locked ? `<em class="inv-made">보유 ${ownedInstCount} · 제작중 ${instCount - ownedInstCount}</em>` : ''}
      ${!locked && placed ? `<em class="inv-placed">설치 ${placed}</em>` : ''}
    </button>
  `;
  }).join('');
  renderVillagePanel();
}

function setupInventory() {
  document.querySelector('#inventory').addEventListener('click', event => {
    const card = event.target.closest('[data-inv-item]');
    if (!card) return;
    const key = card.dataset.invItem;
    if (!isItemUnlocked(key)) {
      showToast(`🔒 ${itemMeta(key)?.label || ''}은(는) 마을 Lv.${gameState.items[key].unlockLevel}에 해금됩니다`);
      return;
    }
    selectedInventoryItem = key;
    renderInventory();
    renderInstancePanel();
  });

  document.querySelector('#instance-panel')?.addEventListener('click', event => {
    const actBtn = event.target.closest('[data-instance-act]');
    if (!actBtn) return;
    const act = actBtn.dataset.instanceAct;
    const type = actBtn.closest('[data-instance-type]')?.dataset.instanceType || selectedInventoryItem;
    const item = itemMeta(type);
    if (!item) return;
    if (act === 'create') {
      createInstance(type);
      return;
    }
    const row = actBtn.closest('[data-instance-id]');
    const inst = row ? gameState.instances.find(x => x.id === row.dataset.instanceId) : null;
    if (!inst) return;
    if (act === 'complete') {
      inst.status = 'owned';
      inst.updatedAt = new Date().toISOString();
      addInventory(inst.type, 1);
      saveGameState();
      renderGame();
      showToast(`✅ ${inst.label} 보유 완료`);
      return;
    }
    if (act === 'edit') {
      inst.status = 'draft';
      inst.updatedAt = new Date().toISOString();
      if (inventoryOf(inst.type) > 0) addInventory(inst.type, -1);
      saveGameState();
      renderGame();
      showToast(`✏️ ${inst.label} 제작 상태로 전환`);
      return;
    }
    if (act === 'place-instance') {
      if (inst.status !== 'owned') {
        showToast('제작 완료된 인스턴스만 설치할 수 있습니다');
        return;
      }
      if (!editorEnabled) setEditorEnabled(true);
      setEditorTool('place');
      selectInstanceForPlacement(inst.id);
      document.querySelector('#map-frame-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (act === 'delete') {
      if (!armDanger(actBtn)) return;
      if (inst.status === 'owned' && inventoryOf(inst.type) > 0) addInventory(inst.type, -1);
      gameState.instances = gameState.instances.filter(x => x.id !== inst.id);
      saveGameState();
      renderGame();
      return;
    }
    if (act === 'del-file' || act === 'del-image') {
      if (inst.status === 'owned') return;
      const id = actBtn.dataset.attachmentId;
      if (act === 'del-file') inst.files = inst.files.filter(file => file.id !== id);
      else inst.images = inst.images.filter(file => file.id !== id);
      inst.updatedAt = new Date().toISOString();
      saveGameState();
      renderInstancePanel();
    }
  });

  document.querySelector('#instance-panel')?.addEventListener('input', event => {
    const field = event.target.dataset.instanceField;
    if (!field) return;
    const row = event.target.closest('[data-instance-id]');
    const inst = row ? gameState.instances.find(x => x.id === row.dataset.instanceId) : null;
    if (!inst) return;
    if (inst.status === 'owned') return;
    if (field === 'label') inst.label = event.target.value;
    if (field === 'owner') inst.owner = event.target.value;
    inst.updatedAt = new Date().toISOString();
    saveGameState();
    renderInventory();
  });

  document.querySelector('#instance-panel')?.addEventListener('change', async event => {
    const field = event.target.dataset.instanceField;
    if (field) {
      const row = event.target.closest('[data-instance-id]');
      const inst = row ? gameState.instances.find(x => x.id === row.dataset.instanceId) : null;
      if (!inst) return;
      if (inst.status === 'owned') return;
      if (field === 'owner') inst.owner = event.target.value;
      inst.updatedAt = new Date().toISOString();
      saveGameState();
      renderInventory();
      return;
    }
    const kind = event.target.dataset.attachmentInput;
    if (!kind) return;
    const row = event.target.closest('[data-instance-id]');
    const inst = row ? gameState.instances.find(x => x.id === row.dataset.instanceId) : null;
    if (!inst) return;
    if (inst.status === 'owned') return;
    try {
      const files = await filesToAttachments([...event.target.files]);
      if (kind === 'images') inst.images.push(...files.filter(file => file.type.startsWith('image/')));
      else inst.files.push(...files);
      inst.updatedAt = new Date().toISOString();
      saveGameState();
      renderInstancePanel();
      showToast(`첨부 ${files.length}개 저장`);
    } catch (error) {
      showToast(`첨부 실패: ${error.message}`);
    } finally {
      event.target.value = '';
    }
  });
}

function createInstance(type) {
  const item = itemMeta(type);
  if (!item) return;
  gameState.instances.unshift({
    id: makeId('inst'),
    type,
    status: 'draft',
    label: `${item.label} #${instancesOf(type).length + 1}`,
    owner: PLAYER_NAME,
    files: [],
    images: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  selectedInventoryItem = type;
  saveGameState();
  renderGame();
  showToast(`🛠️ ${item.label} 인스턴스 제작`);
}

function fileToAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: makeId('att'),
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      dataUrl: String(reader.result || ''),
      addedAt: new Date().toISOString()
    });
    reader.onerror = () => reject(new Error(`${file.name} 읽기 실패`));
    reader.readAsDataURL(file);
  });
}

async function filesToAttachments(files) {
  const maxBytes = 2.5 * 1024 * 1024;
  const tooLarge = files.find(file => file.size > maxBytes);
  if (tooLarge) throw new Error(`${tooLarge.name}이 너무 큼(2.5MB 이하 권장)`);
  return Promise.all(files.map(fileToAttachment));
}

function renderInstancePanel() {
  const panel = document.querySelector('#instance-panel');
  if (!panel) return;
  const type = selectedInventoryItem && gameState.items[selectedInventoryItem] ? selectedInventoryItem : Object.keys(gameState.items)[0];
  selectedInventoryItem = type || null;
  if (!type) {
    panel.innerHTML = '<p class="quest-empty">아이템을 먼저 정의하세요.</p>';
    return;
  }
  const item = itemMeta(type);
  const instances = instancesOf(type);
  const rows = instances.map(inst => {
    const owned = inst.status === 'owned';
    return `
    <article class="instance-card ${owned ? 'owned' : 'draft'}" data-instance-id="${inst.id}">
      <div class="instance-head">
        <strong>${item.icon || '📦'} ${item.label} <em>${owned ? '보유완료' : '제작중'}</em></strong>
        <div class="instance-card-actions">
          ${owned ? `<button data-instance-act="edit">수정</button><button data-instance-act="place-instance">설치</button>` : `<button data-instance-act="complete">완료</button>`}
          <button class="danger" data-instance-act="delete">삭제</button>
        </div>
      </div>
      <div class="instance-fields">
        <label>라벨 <input type="text" data-instance-field="label" value="${inst.label}" placeholder="예: 큰 텐트 A" ${owned ? 'disabled' : ''} /></label>
        <label>소유자 <select data-instance-field="owner" ${owned ? 'disabled' : ''}>${playerOptions(inst.owner)}</select></label>
      </div>
      ${owned ? '<p class="instance-lock-note">보유 상태입니다. 수정 버튼을 누르면 다시 제작 상태로 전환됩니다.</p>' : ''}
      <div class="attachment-row">
        <label class="attach-button ${owned ? 'disabled' : ''}">📎 파일 첨부<input type="file" data-attachment-input="files" multiple ${owned ? 'disabled' : ''} /></label>
        <label class="attach-button ${owned ? 'disabled' : ''}">🖼️ 이미지 첨부<input type="file" data-attachment-input="images" accept="image/*" multiple ${owned ? 'disabled' : ''} /></label>
      </div>
      ${renderAttachmentList(inst.files, 'file', owned)}
      ${renderImageList(inst.images, owned)}
    </article>
  `;
  }).join('');
  panel.innerHTML = `
    <div class="instance-toolbar" data-instance-type="${type}">
      <div><b>${item.icon || '📦'} ${item.label}</b><span> 보유 ${ownedInstancesOf(type).length} · 제작중 ${instances.length - ownedInstancesOf(type).length} · 설치 ${placedCountOf(type)}</span></div>
      <div class="instance-actions">
        <button data-instance-act="create">🛠️ 제작</button>
      </div>
    </div>
    <div class="instance-list">${rows || '<p class="quest-empty">아직 제작된 인스턴스가 없습니다. 제작 버튼으로 라벨/소유자/첨부를 가진 개체를 만드세요.</p>'}</div>
  `;
}

function renderAttachmentList(files, kind, locked = false) {
  if (!files?.length) return '';
  return `<div class="attachment-list">${files.map(file => `
    <a href="${file.dataUrl}" download="${file.name}" title="${file.type || ''}">📎 ${file.name}</a>
    ${locked ? '' : `<button data-instance-act="del-${kind}" data-attachment-id="${file.id}" title="첨부 삭제">✕</button>`}
  `).join('')}</div>`;
}

function renderImageList(images, locked = false) {
  if (!images?.length) return '';
  return `<div class="image-list">${images.map(file => `
    <figure><img src="${file.dataUrl}" alt="${file.name}" /><figcaption>${file.name} ${locked ? '' : `<button data-instance-act="del-image" data-attachment-id="${file.id}">✕</button>`}</figcaption></figure>
  `).join('')}</div>`;
}

/* ---------- toast ---------- */

function showToast(text) {
  const toast = document.querySelector('#toast');
  if (!toast) return;
  toast.textContent = text;
  toast.hidden = false;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    toastTimer = setTimeout(() => { toast.hidden = true; }, 250);
  }, 2800);
}

/* ---------- overlay (augment image) ---------- */

function loadOverlayState() {
  try {
    return {
      src: localStorage.getItem('noji-overlay-src') || DEFAULT_OVERLAY_SRC,
      opacity: Number.parseFloat(localStorage.getItem('noji-overlay-opacity') || String(DEFAULT_OVERLAY_OPACITY)),
      scale: Number.parseFloat(localStorage.getItem('noji-overlay-scale') || '1'),
      scaleX: Number.parseFloat(localStorage.getItem('noji-overlay-scale-x') || '1'),
      scaleY: Number.parseFloat(localStorage.getItem('noji-overlay-scale-y') || '1'),
      offsetX: Number.parseFloat(localStorage.getItem('noji-overlay-offset-x') || '0'),
      offsetY: Number.parseFloat(localStorage.getItem('noji-overlay-offset-y') || '0')
    };
  } catch {
    return { src: DEFAULT_OVERLAY_SRC, opacity: DEFAULT_OVERLAY_OPACITY, scale: 1, scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 };
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
  document.querySelector('#bake-overlay-image').addEventListener('click', bakeOverlayImage);
  fileInput.addEventListener('change', importOverlayImage);
}

function loadImageForCanvas(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 불러올 수 없습니다.'));
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.src = src;
  });
}

function resetOverlayGeometryControls() {
  overlayState.opacity = DEFAULT_OVERLAY_OPACITY;
  overlayState.scale = 1;
  overlayState.scaleX = 1;
  overlayState.scaleY = 1;
  overlayState.offsetX = 0;
  overlayState.offsetY = 0;
  const opacity = document.querySelector('#overlay-opacity');
  if (opacity) opacity.value = Math.round(DEFAULT_OVERLAY_OPACITY * 100);
  const pairs = [
    ['#overlay-scale', '#overlay-scale-label', 100],
    ['#overlay-scale-x', '#overlay-scale-x-label', 100],
    ['#overlay-scale-y', '#overlay-scale-y-label', 100],
    ['#overlay-offset-x', '#overlay-offset-x-label', 0],
    ['#overlay-offset-y', '#overlay-offset-y-label', 0]
  ];
  for (const [inputSel, labelSel, value] of pairs) {
    const input = document.querySelector(inputSel);
    const label = document.querySelector(labelSel);
    if (input) input.value = value;
    if (label) label.textContent = `${value}%`;
  }
}

async function bakeOverlayImage() {
  if (!overlayState.src) return;
  const button = document.querySelector('#bake-overlay-image');
  const previousText = button.textContent;
  button.textContent = '저장 중...';
  button.disabled = true;
  try {
    const source = await loadImageForCanvas(overlayState.src);
    const { w, h } = viewSizePx();
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w));
    canvas.height = Math.max(1, Math.round(h));
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const containScale = Math.min(canvas.width / source.naturalWidth, canvas.height / source.naturalHeight);
    const baseWidth = source.naturalWidth * containScale;
    const baseHeight = source.naturalHeight * containScale;
    const drawWidth = baseWidth * overlayState.scale * overlayState.scaleX;
    const drawHeight = baseHeight * overlayState.scale * overlayState.scaleY;
    const centerX = canvas.width / 2 + (overlayState.offsetX / 100) * canvas.width;
    const centerY = canvas.height / 2 + (overlayState.offsetY / 100) * canvas.height;

    ctx.drawImage(source, centerX - drawWidth / 2, centerY - drawHeight / 2, drawWidth, drawHeight);
    const bakedSrc = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = bakedSrc;
    a.download = 'noji-augment-image-zeroed.png';
    a.click();

    overlayState.src = bakedSrc;
    resetOverlayGeometryControls();
    saveOverlayState();
    applyOverlayState();
    button.textContent = '저장 완료';
    setTimeout(() => { button.textContent = previousText; }, 1200);
  } catch (error) {
    console.error(error);
    button.textContent = '저장 실패';
    setTimeout(() => { button.textContent = previousText; }, 1600);
  } finally {
    button.disabled = false;
  }
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
  updateGhost(null);
  document.body.classList.toggle('editor-mode', editorEnabled);
  const toggle = document.querySelector('#toggle-map-editor');
  if (toggle) toggle.textContent = editorEnabled ? '✕ Close Editor' : '🛠 Map Editor';
  if (!editorEnabled) closeEditorSettings();
  clearSelection();
  renderEditorContext();
}


function setEditorTool(tool) {
  editorTool = tool;
  measurePoints = [];
  updateMeasureLayer();
  updateGhost(lastHoverTile);
  document.querySelectorAll('[data-editor-tool]').forEach(b => b.classList.toggle('active', b.dataset.editorTool === editorTool));
  clearSelection();
  renderEditorContext();
  renderInlineEditorStats();
}

function renderEditorContext() {
  const panel = mapDom.editorContext;
  if (!panel) return;
  if (!editorEnabled || !['paint', 'erase', 'terrain', 'place'].includes(editorTool)) {
    panel.hidden = true;
    panel.innerHTML = '';
    return;
  }
  if (editorTool === 'place') {
    if (!itemMeta(placeType)) placeType = Object.keys(gameState.items)[0] || '';
    const { w, h } = footprintOf(placeType, placeRotation);
    const selectedInst = instanceById(pendingPlaceInstanceId);
    panel.innerHTML = `
      <div class="context-section">
        <h4>오브젝트</h4>
        <div class="object-palette">
          ${Object.entries(gameState.items).map(([key, meta]) => {
            const locked = !isItemUnlocked(key);
            const stock = inventoryOf(key);
            return `
            <button class="object-card ${placeType === key ? 'active' : ''} ${locked ? 'locked' : ''} ${!locked && stock === 0 ? 'empty' : ''}"
              data-place-type="${key}" ${locked ? 'data-locked="1"' : ''}
              title="${locked ? `Lv.${meta.unlockLevel}에 해금` : `${meta.label} ${meta.w}×${meta.h}m · 클릭해 인스턴스 선택`}">
              <span>${locked ? '🔒' : meta.icon}</span><small>${meta.label}</small><i>${locked ? `Lv.${meta.unlockLevel}` : `보유 ${stock}`}</i>
            </button>
          `;
          }).join('')}
        </div>
      </div>
      <div class="context-section">
        <h4>방향</h4>
        <div class="rotate-row">
          <button data-rotate title="90° 회전 (R)">↻ 회전</button>
          <span>${placeRotation}° · ${w}×${h}m</span>
        </div>
        <p class="zone-name">${selectedInst?.type === placeType ? `선택: ${selectedInst.label}` : '아이템 클릭 → 인스턴스 선택 → 맵 클릭'}</p>
      </div>
    `;
    panel.hidden = false;
    return;
  }
  const zoneMeta = getZoneMeta();
  const paletteHtml = editorTool === 'paint' ? `
    <div class="context-section">
      <h4>구역</h4>
      <div class="zone-palette">
        ${Object.entries(zoneMeta).map(([key, meta]) => {
          const locked = !isZoneUnlocked(key);
          return `
          <button class="zone-swatch ${paintZone === key ? 'active' : ''} ${locked ? 'locked' : ''}" data-paint-zone="${key}" ${locked ? 'data-locked="1"' : ''}
            title="${meta.label}${locked ? ` — Lv.${meta.unlockLevel}에 해금` : ''}">
            <i style="background:${meta.color}"></i><span>${locked ? '🔒' : meta.icon}</span>
          </button>
        `;
        }).join('')}
      </div>
      <p class="zone-name">${zoneMeta[paintZone]?.icon || ''} ${zoneMeta[paintZone]?.label || ''}</p>
    </div>
  ` : '';
  const terrainHtml = editorTool === 'terrain' ? `
    <div class="context-section">
      <h4>지형 (1m 단위)</h4>
      <div class="brush-seg terrain-modes">
        <button class="${terrainMode === 'raise' ? 'active' : ''}" data-terrain-mode="raise" title="클릭할 때마다 +1m">▲</button>
        <button class="${terrainMode === 'lower' ? 'active' : ''}" data-terrain-mode="lower" title="클릭할 때마다 −1m">▼</button>
        <button class="${terrainMode === 'level' ? 'active' : ''}" data-terrain-mode="level" title="지정 높이로 평탄화">▦</button>
      </div>
      ${terrainMode === 'level' ? `
      <div class="level-stepper">
        <button data-level-step="-1" title="−1m">−</button>
        <b>${terrainLevel}m</b>
        <button data-level-step="1" title="+1m">＋</button>
      </div>` : `<p class="zone-name">${terrainMode === 'raise' ? '▲ 클릭마다 1m 높이기' : '▼ 클릭마다 1m 낮추기'}</p>`}
    </div>
  ` : '';
  panel.innerHTML = `
    ${paletteHtml}
    ${terrainHtml}
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
  if (toggle && !toggle.dataset.bound) {
    toggle.dataset.bound = 'true';
    toggle.addEventListener('click', () => setEditorEnabled(!editorEnabled));
  }

  document.querySelectorAll('[data-editor-tool]').forEach(button => {
    button.addEventListener('click', () => {
      closeEditorSettings();
      setEditorTool(button.dataset.editorTool);
    });
  });

  mapDom.editorContext.addEventListener('click', event => {
    const swatch = event.target.closest('[data-paint-zone]');
    if (swatch) {
      if (swatch.dataset.locked) {
        showToast(`🔒 ${gameState.zones[swatch.dataset.paintZone]?.label || ''}은(는) 마을 Lv.${gameState.zones[swatch.dataset.paintZone]?.unlockLevel}에 해금됩니다`);
        return;
      }
      paintZone = swatch.dataset.paintZone;
      renderEditorContext();
      return;
    }
    const placeCard = event.target.closest('[data-place-type]');
    if (placeCard) {
      if (placeCard.dataset.locked) {
        showToast(`🔒 ${itemMeta(placeCard.dataset.placeType)?.label || ''}은(는) 마을 Lv.${gameState.items[placeCard.dataset.placeType]?.unlockLevel}에 해금됩니다`);
        return;
      }
      placeType = placeCard.dataset.placeType;
      pendingPlaceInstanceId = null;
      showPlaceInstancePicker(placeType);
      renderEditorContext();
      if (lastHoverTile) updateGhost(lastHoverTile);
      return;
    }
    if (event.target.closest('[data-rotate]')) {
      rotatePlaceObject();
      return;
    }
    const mode = event.target.closest('[data-terrain-mode]');
    if (mode) {
      terrainMode = mode.dataset.terrainMode;
      renderEditorContext();
      return;
    }
    const step = event.target.closest('[data-level-step]');
    if (step) {
      terrainLevel = clampTerrain(terrainLevel + Number.parseInt(step.dataset.levelStep, 10));
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

  mapDom.instancePicker?.addEventListener('click', event => {
    const close = event.target.closest('[data-picker-act="close"]');
    if (close) { hideInstancePicker(); return; }
    const placeButton = event.target.closest('[data-picker-place-instance]');
    if (placeButton) {
      selectInstanceForPlacement(placeButton.dataset.pickerPlaceInstance);
      return;
    }
    const button = event.target.closest('[data-picker-instance]');
    if (!button) return;
    selectInstanceForObject(mapDom.instancePicker.dataset.objectId, button.dataset.pickerInstance);
  });

  document.querySelector('#editor-settings-toggle').addEventListener('click', () => {
    if (mapDom.editorSettings.hidden) openEditorSettings();
    else closeEditorSettings();
  });
  document.querySelector('#editor-settings-close').addEventListener('click', closeEditorSettings);

  document.querySelector('#apply-map-size').addEventListener('click', applyMapSizeFromInputs);
  syncMapSizeInputs();
  document.querySelector('#export-inline-map').addEventListener('click', exportInlineMap);
  document.querySelector('#save-inline-map').addEventListener('click', () => { saveMapToStorage(); saveGameState(); renderInlineEditorStats('saved locally'); });
  document.querySelector('#load-inline-map').addEventListener('click', () => document.querySelector('#inline-map-file').click());
  document.querySelector('#inline-map-file').addEventListener('change', importInlineMap);

  window.addEventListener('keydown', event => {
    if (event.target instanceof Element && event.target.matches('input, select, textarea')) return;
    if (event.key === 'Escape') {
      if (mapDom.adminModal && !mapDom.adminModal.hidden) { closeAdmin(); return; }
      if (mapDom.editorSettings && !mapDom.editorSettings.hidden) { closeEditorSettings(); return; }
      if (measurePoints.length) { measurePoints = []; updateMeasureLayer(); renderInlineEditorStats(); return; }
      if (selectedTileKey) { clearSelection(); return; }
      if (editorEnabled) setEditorEnabled(false);
      return;
    }
    if (!editorEnabled) return;
    const key = event.key.toLowerCase();
    if (key === 'r' && editorTool === 'place') {
      rotatePlaceObject();
      return;
    }
    const toolByKey = { v: 'inspect', b: 'paint', m: 'measure', t: 'terrain', o: 'place' };
    if (toolByKey[key]) {
      closeEditorSettings();
      setEditorTool(toolByKey[key]);
    }
  });
}

/* ---------- admin modal ---------- */

function setupAdmin() {
  document.querySelector('#open-admin').addEventListener('click', openAdmin);
  document.querySelector('#close-admin').addEventListener('click', closeAdmin);
  mapDom.adminModal.addEventListener('click', event => {
    if (event.target === mapDom.adminModal) closeAdmin();
  });
  document.querySelectorAll('[data-admin-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      adminTab = btn.dataset.adminTab;
      document.querySelectorAll('[data-admin-tab]').forEach(b => b.classList.toggle('active', b.dataset.adminTab === adminTab));
      renderAdmin();
    });
  });
  mapDom.adminBody.addEventListener('input', onAdminInput);
  mapDom.adminBody.addEventListener('click', onAdminClick);
}

function openAdmin() {
  mapDom.adminModal.hidden = false;
  document.body.classList.add('modal-open');
  renderAdmin();
}

function closeAdmin() {
  mapDom.adminModal.hidden = true;
  document.body.classList.remove('modal-open');
}

function levelOptions(selected) {
  let html = '';
  for (let lvl = 0; lvl <= maxVillageLevel(); lvl += 1) {
    html += `<option value="${lvl}" ${lvl === selected ? 'selected' : ''}>Lv.${lvl}</option>`;
  }
  return html;
}

function itemOptions(selected) {
  return Object.entries(gameState.items)
    .map(([key, it]) => `<option value="${key}" ${key === selected ? 'selected' : ''}>${it.icon} ${it.label}</option>`)
    .join('');
}

function playerOptions(selected) {
  return (gameState.players || [])
    .map(p => `<option value="${p.name}" ${p.name === selected ? 'selected' : ''}>${p.name}${p.role ? ` · ${p.role}` : ''}</option>`)
    .join('');
}

function renderAdmin() {
  const body = mapDom.adminBody;
  if (adminTab === 'zones') { body.innerHTML = renderAdminZones(); return; }
  if (adminTab === 'items') { body.innerHTML = renderAdminItems(); return; }
  if (adminTab === 'quests') { body.innerHTML = renderAdminQuests(); return; }
  if (adminTab === 'levels') { body.innerHTML = renderAdminLevels(); return; }
  if (adminTab === 'themes') { body.innerHTML = renderAdminThemes(); return; }
  body.innerHTML = renderAdminPlayers();
}

function renderAdminThemes() {
  const labels = { frontier: 'Frontier', civilization: 'Civilization', clan: 'Clan Builder', blueprint: 'Blueprint', forest: 'Forest Night' };
  return `
    <p class="admin-help">대시보드 테마를 선택합니다. 선택값은 이 브라우저에 저장됩니다.</p>
    <div class="admin-theme-grid">
      ${Object.keys(themes).map(key => `<button data-theme="${key}" class="theme-choice ${currentTheme === key ? 'active' : ''}">${labels[key] || key}</button>`).join('')}
    </div>
  `;
}

function renderAdminPlayers() {
  const rows = (gameState.players || []).map(player => `
    <div class="admin-row" data-player-id="${player.id}">
      <input type="text" class="label-input" data-field="name" value="${player.name}" placeholder="플레이어 이름" />
      <input type="text" class="label-input" data-field="role" value="${player.role || ''}" placeholder="역할" />
      <select data-field="status">
        <option value="active" ${player.status === 'active' ? 'selected' : ''}>active</option>
        <option value="invited_later" ${player.status === 'invited_later' ? 'selected' : ''}>invited_later</option>
        <option value="inactive" ${player.status === 'inactive' ? 'selected' : ''}>inactive</option>
      </select>
      <button class="danger" data-act="delete-player">삭제</button>
    </div>
  `).join('');
  return `
    <p class="admin-help">등록된 플레이어를 관리합니다. 인스턴스 소유자는 이 목록에서 선택됩니다. 첫 번째 플레이어가 헤더 접속자 카드에 표시됩니다.</p>
    ${rows}
    <button class="admin-add" data-act="add-player">＋ 플레이어 추가</button>
  `;
}

function renderAdminZones() {
  const themeColors = themes[currentTheme]?.colors || {};
  const counts = {};
  tileState.forEach(tile => { counts[tile.zone] = (counts[tile.zone] || 0) + 1; });
  const rows = Object.entries(gameState.zones).map(([key, zone]) => `
    <div class="admin-row" data-zone-key="${key}">
      <input type="color" data-field="color" value="${zone.color || themeColors[key] || '#5d7252'}" title="구역 색상${zone.color ? '' : ' (현재 테마색)'}" />
      <input type="text" class="icon-input" data-field="icon" value="${zone.icon || ''}" maxlength="4" title="아이콘 (이모지)" />
      <input type="text" class="label-input" data-field="label" value="${zone.label}" placeholder="구역 이름" />
      <label class="dim">해금 <select data-field="unlockLevel">${levelOptions(zone.unlockLevel || 0)}</select></label>
      <span class="dim">${counts[key] || 0} 타일</span>
      ${zone.color ? '<button data-act="reset-zone-color" title="테마 색상으로 되돌리기">테마색</button>' : ''}
      ${key === 'wild' ? '<span class="dim">기본 구역</span>' : '<button class="danger" data-act="delete-zone">삭제</button>'}
    </div>
  `).join('');
  return `
    <p class="admin-help">구역(지형 타입)의 이름·색상·해금 레벨을 편집합니다. 색상을 바꾸면 테마와 무관하게 그 색이 사용됩니다. 구역을 삭제하면 해당 타일은 Wild로 되돌아갑니다.</p>
    ${rows}
    <button class="admin-add" data-act="add-zone">＋ 새 구역 추가</button>
  `;
}

function renderAdminItems() {
  const rows = Object.entries(gameState.items).map(([key, it]) => {
    const placed = placedCountOf(key);
    return `
    <div class="admin-row" data-item-key="${key}">
      <input type="text" class="icon-input" data-field="icon" value="${it.icon}" maxlength="4" title="아이콘 (이모지)" />
      <input type="text" class="label-input" data-field="label" value="${it.label}" placeholder="아이템 이름" />
      <label class="dim">크기 <input type="number" class="num-input" data-field="w" value="${it.w}" min="1" max="40" /> × <input type="number" class="num-input" data-field="h" value="${it.h}" min="1" max="40" /> m</label>
      <label class="dim">해금 <select data-field="unlockLevel">${levelOptions(it.unlockLevel || 0)}</select></label>
      <span class="inv-stepper"><button data-act="inv-minus" title="보유 −1">−</button><b title="보유 수량">${inventoryOf(key)}</b><button data-act="inv-plus" title="보유 +1">＋</button></span>
      <span class="dim">설치 ${placed}</span>
      <button class="danger" data-act="delete-item">삭제</button>
    </div>
  `;
  }).join('');
  return `
    <p class="admin-help">아이템의 이름·아이콘(이모지)·크기·해금 레벨을 편집합니다. 보유 수량(±)으로 인벤토리를 직접 조정할 수 있습니다. 크기를 바꾸면 배치가 불가능해진 설치물은 인벤토리로 회수됩니다.</p>
    ${rows}
    <button class="admin-add" data-act="add-item">＋ 새 아이템 추가</button>
  `;
}

function renderAdminQuests() {
  const blocks = gameState.quests.map(q => `
    <div class="admin-quest" data-quest-id="${q.id}">
      <div class="aq-row">
        <input type="text" class="label-input grow" data-field="title" value="${q.title}" placeholder="퀘스트명" />
        <select data-field="status" title="상태">
          <option value="todo" ${q.status === 'todo' ? 'selected' : ''}>가능</option>
          <option value="doing" ${q.status === 'doing' ? 'selected' : ''}>진행</option>
          <option value="done" ${q.status === 'done' ? 'selected' : ''}>완료</option>
        </select>
        <button class="danger" data-act="delete-quest">삭제</button>
      </div>
      <textarea data-field="desc" rows="2" placeholder="설명">${q.desc}</textarea>
      <textarea data-field="method" rows="2" placeholder="수행 방법">${q.method}</textarea>
      <div class="aq-row">
        <label class="dim">해금 <select data-field="unlockLevel">${levelOptions(q.unlockLevel || 0)}</select></label>
        <label class="dim">선행 퀘스트
          <select data-field="prereq">
            <option value="">(없음)</option>
            ${gameState.quests.filter(other => other.id !== q.id).map(other => `<option value="${other.id}" ${q.prereq === other.id ? 'selected' : ''}>${other.title}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="aq-rewards">
        <span class="dim">재료</span>
        ${(q.materials || []).map((mt, idx) => `
          <span class="reward-row" data-material-index="${idx}">
            <select data-field="material-item">${itemOptions(mt.item)}</select>
            <input type="number" class="num-input" data-field="material-count" value="${mt.count}" min="1" max="99" />
            <button data-act="del-material" title="재료 제거">✕</button>
          </span>
        `).join('')}
        <button data-act="add-material">＋ 재료</button>
      </div>
      <div class="aq-rewards">
        <span class="dim">보상</span>
        ${(q.rewards || []).map((rw, idx) => `
          <span class="reward-row" data-reward-index="${idx}">
            <select data-field="reward-item">${itemOptions(rw.item)}</select>
            <input type="number" class="num-input" data-field="reward-count" value="${rw.count}" min="1" max="99" />
            <button data-act="del-reward" title="보상 제거">✕</button>
          </span>
        `).join('')}
        <button data-act="add-reward">＋ 보상</button>
      </div>
    </div>
  `).join('');
  return `
    <p class="admin-help">퀘스트를 정의합니다. 재료는 퀘스트 시작 시 1회 지급되고, 보상은 완료 시 지급됩니다.</p>
    ${blocks}
    <button class="admin-add" data-act="add-quest">＋ 새 퀘스트 추가</button>
  `;
}

function renderAdminLevels() {
  if (!Object.keys(gameState.items).length) {
    return '<p class="admin-help">레벨 조건에 쓸 아이템이 없습니다. 먼저 아이템 탭에서 아이템을 정의하세요.</p>';
  }
  const blocks = [];
  for (let lvl = 1; lvl <= maxVillageLevel(); lvl += 1) {
    const meta = levelMetaOf(lvl);
    const reqs = gameState.levelRequirements[lvl] || [];
    blocks.push(`
      <div class="admin-level" data-level="${lvl}">
        <div class="aq-row"><strong>Lv.${lvl} ${meta?.name || ''}</strong><span class="dim">${meta?.description || ''}</span></div>
        <div class="aq-rewards">
          <span class="dim">필요 아이템</span>
          ${reqs.map((rq, idx) => `
            <span class="reward-row" data-req-index="${idx}">
              <select data-field="req-item">${itemOptions(rq.item)}</select>
              <input type="number" class="num-input" data-field="req-count" value="${rq.count}" min="1" max="99" />
              <button data-act="del-req" title="조건 제거">✕</button>
            </span>
          `).join('')}
          <button data-act="add-req">＋ 아이템</button>
        </div>
      </div>
    `);
  }
  return `
    <p class="admin-help">레벨별 업그레이드에 필요한 아이템을 정의합니다. 모두 수집(보유+설치)하면 마을 스탯 창의 업그레이드 버튼이 활성화됩니다.</p>
    ${blocks.join('')}
  `;
}

function onAdminInput(event) {
  const field = event.target.dataset.field;
  if (!field) return;
  const value = event.target.value;
  const zoneRow = event.target.closest('[data-zone-key]');
  if (zoneRow) {
    const zone = gameState.zones[zoneRow.dataset.zoneKey];
    if (!zone) return;
    if (field === 'color') zone.color = value;
    else if (field === 'icon') zone.icon = value;
    else if (field === 'label') zone.label = value;
    else if (field === 'unlockLevel') zone.unlockLevel = Number.parseInt(value, 10) || 0;
    saveGameState();
    repaintTiles();
    updateLegend();
    renderEditorContext();
    renderInlineEditorStats();
    return;
  }
  const itemRow = event.target.closest('[data-item-key]');
  if (itemRow) {
    const item = gameState.items[itemRow.dataset.itemKey];
    if (!item) return;
    if (field === 'icon') item.icon = value;
    else if (field === 'label') item.label = value;
    else if (field === 'w' || field === 'h') {
      item[field] = Math.max(1, Math.min(40, Number.parseInt(value, 10) || 1));
      revalidatePlacedObjects();
    } else if (field === 'unlockLevel') item.unlockLevel = Number.parseInt(value, 10) || 0;
    saveGameState();
    renderObjectsLayer();
    renderGame();
    renderEditorContext();
    return;
  }
  const questBlock = event.target.closest('[data-quest-id]');
  if (questBlock) {
    const quest = questById(questBlock.dataset.questId);
    if (!quest) return;
    const materialRow = event.target.closest('[data-material-index]');
    const rewardRow = event.target.closest('[data-reward-index]');
    if (materialRow) {
      const material = quest.materials[Number.parseInt(materialRow.dataset.materialIndex, 10)];
      if (!material) return;
      if (field === 'material-item') material.item = value;
      else if (field === 'material-count') material.count = Math.max(1, Number.parseInt(value, 10) || 1);
    } else if (rewardRow) {
      const reward = quest.rewards[Number.parseInt(rewardRow.dataset.rewardIndex, 10)];
      if (!reward) return;
      if (field === 'reward-item') reward.item = value;
      else if (field === 'reward-count') reward.count = Math.max(1, Number.parseInt(value, 10) || 1);
    } else if (field === 'title') quest.title = value;
    else if (field === 'desc') quest.desc = value;
    else if (field === 'method') quest.method = value;
    else if (field === 'unlockLevel') quest.unlockLevel = Number.parseInt(value, 10) || 0;
    else if (field === 'prereq') quest.prereq = value || null;
    else if (field === 'status') { quest.status = value; if (value === 'todo') quest.materialsGranted = false; clearPendingComplete(); }
    saveGameState();
    renderQuestBoard();
    return;
  }
  const levelBlock = event.target.closest('[data-level]');
  if (levelBlock) {
    const lvl = Number.parseInt(levelBlock.dataset.level, 10);
    const reqs = gameState.levelRequirements[lvl] || [];
    const reqRow = event.target.closest('[data-req-index]');
    if (!reqRow) return;
    const req = reqs[Number.parseInt(reqRow.dataset.reqIndex, 10)];
    if (!req) return;
    if (field === 'req-item') req.item = value;
    else if (field === 'req-count') req.count = Math.max(1, Number.parseInt(value, 10) || 1);
    saveGameState();
    renderVillagePanel();
    return;
  }
  const playerRow = event.target.closest('[data-player-id]');
  if (playerRow) {
    const player = gameState.players.find(p => p.id === playerRow.dataset.playerId);
    if (!player) return;
    if (field === 'name') {
      const oldName = player.name;
      player.name = value || PLAYER_NAME;
      for (const inst of gameState.instances) if (inst.owner === oldName) inst.owner = player.name;
    } else if (field === 'role') player.role = value;
    else if (field === 'status') player.status = value;
    saveGameState();
    renderCurrentPlayer();
    renderInstancePanel();
  }
}

function armDanger(button) {
  if (button.dataset.armed) {
    delete button.dataset.armed;
    return true;
  }
  button.dataset.armed = '1';
  const original = button.textContent;
  button.textContent = '확인?';
  setTimeout(() => {
    if (button.isConnected && button.dataset.armed) {
      delete button.dataset.armed;
      button.textContent = original;
    }
  }, 2500);
  return false;
}

function onAdminClick(event) {
  const actBtn = event.target.closest('[data-act]');
  if (!actBtn) return;
  const act = actBtn.dataset.act;

  if (act === 'add-zone') {
    const key = makeId('zone');
    gameState.zones[key] = { label: '새 구역', icon: '🏷️', color: '#5a8a5a', unlockLevel: 0 };
    saveGameState();
    renderAdmin();
    renderEditorContext();
    return;
  }
  if (act === 'add-item') {
    const key = makeId('item');
    gameState.items[key] = { label: '새 아이템', icon: '📦', w: 1, h: 1, unlockLevel: 0, tint: null };
    saveGameState();
    renderAdmin();
    renderGame();
    renderEditorContext();
    return;
  }
  if (act === 'add-quest') {
    gameState.quests.push({ id: makeId('q'), title: '새 퀘스트', desc: '', method: '', unlockLevel: 0, prereq: null, materials: [], rewards: [], materialsGranted: false, status: 'todo', assignee: '' });
    saveGameState();
    renderAdmin();
    renderQuestBoard();
    return;
  }
  if (act === 'add-player') {
    gameState.players.push({ id: makeId('player'), name: '새 플레이어', role: '', status: 'active' });
    saveGameState();
    renderAdmin();
    renderCurrentPlayer();
    renderInstancePanel();
    return;
  }

  const zoneRow = event.target.closest('[data-zone-key]');
  if (zoneRow) {
    const key = zoneRow.dataset.zoneKey;
    if (act === 'reset-zone-color') {
      gameState.zones[key].color = null;
      saveGameState();
      repaintTiles();
      updateLegend();
      renderAdmin();
      renderEditorContext();
      return;
    }
    if (act === 'delete-zone' && key !== 'wild') {
      if (!armDanger(actBtn)) return;
      delete gameState.zones[key];
      let changed = 0;
      tileState.forEach(tile => { if (tile.zone === key) { tile.zone = 'wild'; changed += 1; } });
      if (paintZone === key) paintZone = 'wild';
      if (focusZone === key) focusZone = null;
      saveGameState();
      saveMapToStorage();
      repaintTiles();
      updateBoundaries();
      updateLegend();
      renderAdmin();
      renderEditorContext();
      renderInlineEditorStats();
      showToast(`구역 삭제됨 — 타일 ${changed}개를 Wild로 되돌렸습니다`);
      return;
    }
  }

  const itemRow = event.target.closest('[data-item-key]');
  if (itemRow) {
    const key = itemRow.dataset.itemKey;
    if (act === 'inv-plus') { addInventory(key, 1); renderAdmin(); renderGame(); return; }
    if (act === 'inv-minus') { addInventory(key, -1); renderAdmin(); renderGame(); return; }
    if (act === 'delete-item') {
      if (!armDanger(actBtn)) return;
      const removedPlaced = placedObjects.filter(obj => obj.type === key).length;
      placedObjects = placedObjects.filter(obj => obj.type !== key);
      delete gameState.items[key];
      delete gameState.inventory[key];
      gameState.instances = gameState.instances.filter(inst => inst.type !== key);
      for (const quest of gameState.quests) {
        quest.materials = (quest.materials || []).filter(mt => mt.item !== key);
        quest.rewards = (quest.rewards || []).filter(rw => rw.item !== key);
      }
      for (const lvl of Object.keys(gameState.levelRequirements)) {
        gameState.levelRequirements[lvl] = gameState.levelRequirements[lvl].filter(rq => rq.item !== key);
      }
      if (placeType === key) placeType = Object.keys(gameState.items)[0] || '';
      saveGameState();
      saveMapToStorage();
      renderObjectsLayer();
      renderAdmin();
      renderGame();
      renderEditorContext();
      if (removedPlaced) showToast(`아이템 삭제됨 — 설치돼 있던 ${removedPlaced}개도 제거했습니다`);
      return;
    }
  }

  const questBlock = event.target.closest('[data-quest-id]');
  if (questBlock) {
    const quest = questById(questBlock.dataset.questId);
    if (!quest) return;
    if (act === 'add-material') {
      const firstItem = Object.keys(gameState.items)[0];
      if (!firstItem) { showToast('먼저 아이템을 정의하세요'); return; }
      quest.materials.push({ item: firstItem, count: 1 });
      quest.materialsGranted = quest.status !== 'todo' ? quest.materialsGranted : false;
      saveGameState();
      renderAdmin();
      renderQuestBoard();
      return;
    }
    if (act === 'del-material') {
      const idx = Number.parseInt(event.target.closest('[data-material-index]').dataset.materialIndex, 10);
      quest.materials.splice(idx, 1);
      saveGameState();
      renderAdmin();
      renderQuestBoard();
      return;
    }
    if (act === 'add-reward') {
      const firstItem = Object.keys(gameState.items)[0];
      if (!firstItem) { showToast('먼저 아이템을 정의하세요'); return; }
      quest.rewards.push({ item: firstItem, count: 1 });
      saveGameState();
      renderAdmin();
      renderQuestBoard();
      return;
    }
    if (act === 'del-reward') {
      const idx = Number.parseInt(event.target.closest('[data-reward-index]').dataset.rewardIndex, 10);
      quest.rewards.splice(idx, 1);
      saveGameState();
      renderAdmin();
      renderQuestBoard();
      return;
    }
    if (act === 'delete-quest') {
      if (!armDanger(actBtn)) return;
      gameState.quests = gameState.quests.filter(q => q.id !== quest.id);
      for (const other of gameState.quests) if (other.prereq === quest.id) other.prereq = null;
      saveGameState();
      renderAdmin();
      renderQuestBoard();
      return;
    }
  }

  const levelBlock = event.target.closest('[data-level]');
  if (levelBlock) {
    const lvl = Number.parseInt(levelBlock.dataset.level, 10);
    if (act === 'add-req') {
      const firstItem = Object.keys(gameState.items)[0];
      if (!firstItem) { showToast('먼저 아이템을 정의하세요'); return; }
      if (!gameState.levelRequirements[lvl]) gameState.levelRequirements[lvl] = [];
      gameState.levelRequirements[lvl].push({ item: firstItem, count: 1 });
      saveGameState();
      renderAdmin();
      renderVillagePanel();
      return;
    }
    if (act === 'del-req') {
      const idx = Number.parseInt(event.target.closest('[data-req-index]').dataset.reqIndex, 10);
      gameState.levelRequirements[lvl].splice(idx, 1);
      saveGameState();
      renderAdmin();
      renderVillagePanel();
    }
  }

  const playerRow = event.target.closest('[data-player-id]');
  if (playerRow) {
    const id = playerRow.dataset.playerId;
    if (act === 'delete-player') {
      if (!armDanger(actBtn)) return;
      const player = gameState.players.find(p => p.id === id);
      gameState.players = gameState.players.filter(p => p.id !== id);
      if (!gameState.players.length) gameState.players.push({ id: 'me', name: PLAYER_NAME, role: '접속자', status: 'active' });
      const fallback = gameState.players[0].name;
      if (player) for (const inst of gameState.instances) if (inst.owner === player.name) inst.owner = fallback;
      saveGameState();
      renderAdmin();
      renderCurrentPlayer();
      renderInstancePanel();
    }
  }
}

/* ---------- persistence ---------- */

function buildMapPayload(includeGame = false) {
  const payload = {
    unit: {
      tileWidthMeters: 1,
      tileHeightMeters: 1,
      tileAreaSqm: SQM_PER_TILE,
      tileAreaPyeong: Number(PYEONG_PER_TILE.toFixed(6)),
      coordinateSystem: 'square row/column q,r; each tile is 1m x 1m; distance measurements use tile centers in meters',
      heightSystem: `integer per-tile elevation h in meters (relative), range ${TERRAIN_MIN}..${TERRAIN_MAX}; contour lines drawn between tiles of different h, major line every ${CONTOUR_MAJOR_STEP}m`
    },
    grid: { width: mapSettings.width, height: mapSettings.height },
    tiles: [...tileState.values()],
    objects: placedObjects.map(obj => ({ ...obj }))
  };
  if (includeGame) payload.game = gameState;
  return payload;
}

function exportInlineMap() {
  const payload = buildMapPayload(true);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'noji-ingame-map.json';
  a.click();
  URL.revokeObjectURL(url);
}

function saveMapToStorage() {
  localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(buildMapPayload(false)));
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
  if (payload.game && typeof payload.game === 'object') {
    gameState = normalizeGameState(payload.game);
    saveGameState();
  }
  tileState.clear();
  const width = clampMapSize(payload.grid?.width || DEFAULT_MAP_WIDTH);
  const height = clampMapSize(payload.grid?.height || DEFAULT_MAP_HEIGHT);
  resizeMap(width, height, { preserve: false, save: false });
  for (const tile of payload.tiles) {
    const k = tileKey(tile.q, tile.r);
    const target = tileState.get(k);
    if (!target) continue;
    if (gameState.zones[tile.zone]) target.zone = tile.zone;
    if (Number.isFinite(tile.h)) target.h = clampTerrain(tile.h);
  }
  placedObjects = (Array.isArray(payload.objects) ? payload.objects : [])
    .filter(obj => gameState.items[obj.type] && Number.isInteger(obj.q) && Number.isInteger(obj.r))
    .map(obj => ({
      id: obj.id || makeId('obj'),
      type: obj.type,
      q: obj.q,
      r: obj.r,
      rot: OBJECT_ROTATIONS.includes(obj.rot) ? obj.rot : 0,
      instanceId: instanceById(obj.instanceId)?.type === obj.type ? obj.instanceId : null
    }))
    .filter(obj => objectFitsBounds(obj));
  syncMapSizeInputs();
  return true;
}

function applyMapSizeFromInputs() {
  const width = document.querySelector('#map-width-input').value;
  const height = document.querySelector('#map-height-input').value;
  resizeMap(width, height, { preserve: true, save: false });
  placedObjects = placedObjects.filter(obj => objectFitsBounds(obj));
  saveMapToStorage();
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
    renderGame();
    renderEditorContext();
    renderInlineEditorStats('loaded json');
  } catch (error) {
    renderInlineEditorStats(`load failed: ${error.message}`);
  } finally {
    event.target.value = '';
  }
}

/* ---------- misc panels ---------- */

function renderCurrentPlayer() {
  const el = document.querySelector('#current-player');
  if (!el) return;
  const player = (gameState.players || [])[0] || { name: PLAYER_NAME, role: '접속자', status: 'active' };
  el.innerHTML = `<span>접속자</span><b>👤 ${player.name}</b>${player.role ? `<small>${player.role}</small>` : ''}`;
}

loadProject().catch(err => {
  document.body.innerHTML = `<pre>Failed to load project data: ${err.message}</pre>`;
});

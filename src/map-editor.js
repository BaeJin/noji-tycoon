import './styles.css';

const PYEONG_SQM = 3.305785;
const HEX_SIDE_M = Math.sqrt((2 * PYEONG_SQM) / (3 * Math.sqrt(3)));
const HEX_WIDTH_M = 2 * HEX_SIDE_M;
const HEX_HEIGHT_M = Math.sqrt(3) * HEX_SIDE_M;
const PX_PER_M = 28;
const SIDE_PX = HEX_SIDE_M * PX_PER_M;
const GRID_WIDTH = 34;
const GRID_HEIGHT = 28;

const zoneColors = {
  wild: '#1f4b35',
  access: '#60472e',
  parking: '#7a6a53',
  camp: '#2f6c4e',
  utility: '#315b72',
  garden: '#4b6832',
  rest: '#8c7438',
  restricted: '#5a2c32',
  empty: '#142017'
};

const zoneLabels = {
  wild: '자연', access: '동선', parking: '주차', camp: '캠핑', utility: '기반시설', garden: '텃밭', rest: '쉼터', restricted: '제한', empty: '미지정'
};

let tool = 'paint';
let selectedZone = 'wild';
let zoom = 1;
let pan = { x: 24, y: 24 };
let isPanning = false;
let panStart = null;
let measurePoints = [];
const tiles = new Map();

const svg = document.querySelector('#editor-svg');
const wrap = document.querySelector('#editor-canvas-wrap');
const stats = document.querySelector('#editor-stats');
const readout = document.querySelector('#measure-readout');
const NS = 'http://www.w3.org/2000/svg';
const layer = document.createElementNS(NS, 'g');
const measureLayer = document.createElementNS(NS, 'g');
svg.append(layer, measureLayer);

function key(q, r) { return `${q},${r}`; }

function axialToMeters(q, r) {
  return {
    x: HEX_SIDE_M * 1.5 * q,
    y: HEX_SIDE_M * Math.sqrt(3) * (r + q / 2)
  };
}

function axialToPixels(q, r) {
  const m = axialToMeters(q, r);
  return { x: m.x * PX_PER_M, y: m.y * PX_PER_M };
}

function hexCorners(cx, cy) {
  const pts = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = Math.PI / 180 * (60 * i);
    pts.push(`${(cx + SIDE_PX * Math.cos(angle)).toFixed(2)},${(cy + SIDE_PX * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(' ');
}

function init() {
  document.querySelector('#fact-area').textContent = `${PYEONG_SQM.toFixed(6)}㎡ (1평)`;
  document.querySelector('#fact-side').textContent = `${HEX_SIDE_M.toFixed(3)}m`;
  document.querySelector('#fact-width').textContent = `${HEX_WIDTH_M.toFixed(3)}m`;
  document.querySelector('#fact-height').textContent = `${HEX_HEIGHT_M.toFixed(3)}m`;

  for (let r = 0; r < GRID_HEIGHT; r += 1) {
    for (let q = 0; q < GRID_WIDTH; q += 1) {
      const k = key(q, r);
      tiles.set(k, { q, r, zone: 'empty' });
    }
  }
  bindControls();
  render();
}

function bindControls() {
  document.querySelectorAll('[data-tool]').forEach(button => {
    button.addEventListener('click', () => {
      tool = button.dataset.tool;
      document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
      measurePoints = [];
      renderMeasure();
      updateStats();
    });
  });
  document.querySelector('#zone-select').addEventListener('change', e => { selectedZone = e.target.value; });
  document.querySelector('#clear-map').addEventListener('click', () => {
    tiles.forEach(tile => { tile.zone = 'empty'; });
    measurePoints = [];
    render();
  });
  document.querySelector('#export-map').addEventListener('click', exportMap);
  document.querySelector('#zoom-in').addEventListener('click', () => setZoom(zoom * 1.15));
  document.querySelector('#zoom-out').addEventListener('click', () => setZoom(zoom / 1.15));
  document.querySelector('#zoom-reset').addEventListener('click', () => { zoom = 1; pan = { x: 24, y: 24 }; applyTransform(); });
  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    setZoom(zoom * (e.deltaY < 0 ? 1.08 : 0.92));
  }, { passive: false });
  svg.addEventListener('pointerdown', e => {
    if (e.target.classList.contains('editor-hex')) return;
    isPanning = true;
    panStart = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', e => {
    if (!isPanning) return;
    pan = { x: e.clientX - panStart.x, y: e.clientY - panStart.y };
    applyTransform();
  });
  svg.addEventListener('pointerup', () => { isPanning = false; });
}

function setZoom(next) {
  zoom = Math.max(0.35, Math.min(3.5, next));
  applyTransform();
}

function applyTransform() {
  layer.setAttribute('transform', `translate(${pan.x} ${pan.y}) scale(${zoom})`);
  measureLayer.setAttribute('transform', `translate(${pan.x} ${pan.y}) scale(${zoom})`);
  document.querySelector('#zoom-reset').textContent = `${Math.round(zoom * 100)}%`;
}

function render() {
  layer.innerHTML = '';
  const max = axialToPixels(GRID_WIDTH + 1, GRID_HEIGHT + 1);
  svg.setAttribute('viewBox', `0 0 ${Math.max(900, max.x + 160)} ${Math.max(620, max.y + 160)}`);

  for (const tile of tiles.values()) {
    const { x, y } = axialToPixels(tile.q, tile.r);
    const poly = document.createElementNS(NS, 'polygon');
    poly.setAttribute('points', hexCorners(x, y));
    poly.setAttribute('fill', zoneColors[tile.zone]);
    poly.setAttribute('class', `editor-hex zone-${tile.zone}`);
    poly.dataset.key = key(tile.q, tile.r);
    poly.addEventListener('click', e => {
      e.stopPropagation();
      handleTile(tile);
    });
    layer.appendChild(poly);
  }
  applyTransform();
  renderMeasure();
  updateStats();
}

function handleTile(tile) {
  if (tool === 'paint') tile.zone = selectedZone;
  if (tool === 'erase') tile.zone = 'empty';
  if (tool === 'measure') {
    measurePoints.push({ q: tile.q, r: tile.r });
    if (measurePoints.length > 2) measurePoints = [measurePoints.at(-1)];
  }
  render();
}

function renderMeasure() {
  measureLayer.innerHTML = '';
  if (measurePoints.length === 0) {
    readout.textContent = '측정 모드에서 두 hex를 선택하면 거리가 표시됨.';
    return;
  }
  for (const point of measurePoints) {
    const { x, y } = axialToPixels(point.q, point.r);
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', x);
    c.setAttribute('cy', y);
    c.setAttribute('r', SIDE_PX * 0.35);
    c.setAttribute('class', 'measure-point');
    measureLayer.appendChild(c);
  }
  if (measurePoints.length === 1) {
    readout.textContent = `시작점 hex (${measurePoints[0].q}, ${measurePoints[0].r}) 선택됨. 끝점을 선택해라.`;
    return;
  }
  const a = axialToMeters(measurePoints[0].q, measurePoints[0].r);
  const b = axialToMeters(measurePoints[1].q, measurePoints[1].r);
  const ap = axialToPixels(measurePoints[0].q, measurePoints[0].r);
  const bp = axialToPixels(measurePoints[1].q, measurePoints[1].r);
  const distance = Math.hypot(a.x - b.x, a.y - b.y);
  const line = document.createElementNS(NS, 'line');
  line.setAttribute('x1', ap.x); line.setAttribute('y1', ap.y); line.setAttribute('x2', bp.x); line.setAttribute('y2', bp.y);
  line.setAttribute('class', 'measure-line');
  measureLayer.prepend(line);
  readout.innerHTML = `<strong>${distance.toFixed(2)}m</strong> · center-to-center · ${measurePoints[0].q},${measurePoints[0].r} → ${measurePoints[1].q},${measurePoints[1].r}`;
}

function updateStats() {
  const counts = {};
  let selected = 0;
  tiles.forEach(tile => {
    counts[tile.zone] = (counts[tile.zone] || 0) + 1;
    if (tile.zone !== 'empty') selected += 1;
  });
  stats.innerHTML = `
    <div class="big-stat"><b>${selected}</b><span>지정 hex</span></div>
    <div class="big-stat"><b>${selected.toLocaleString()}평</b><span>지정 면적</span></div>
    <div class="big-stat"><b>${(selected * PYEONG_SQM).toFixed(1)}㎡</b><span>지정 면적</span></div>
    <div class="zone-counts">
      ${Object.entries(counts).filter(([z, c]) => z !== 'empty' && c).map(([z, c]) => `<span><i style="background:${zoneColors[z]}"></i>${zoneLabels[z]} ${c}</span>`).join('') || '<em>아직 지정된 구역 없음</em>'}
    </div>
  `;
}

function exportMap() {
  const payload = {
    unit: {
      hexAreaSqm: PYEONG_SQM,
      hexAreaPyeong: 1,
      hexSideMeters: Number(HEX_SIDE_M.toFixed(6)),
      hexWidthMeters: Number(HEX_WIDTH_M.toFixed(6)),
      hexHeightMeters: Number(HEX_HEIGHT_M.toFixed(6)),
      coordinateSystem: 'flat-top axial q,r; distance measurements use center coordinates in meters'
    },
    grid: { width: GRID_WIDTH, height: GRID_HEIGHT },
    tiles: [...tiles.values()].filter(tile => tile.zone !== 'empty')
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'noji-hex-map.json';
  a.click();
  URL.revokeObjectURL(url);
}

init();

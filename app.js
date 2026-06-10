const zoneColors = {
  wild: 'zone-wild',
  access: 'zone-access',
  camp: 'zone-camp',
  utility: 'zone-utility',
  restricted: 'zone-restricted'
};

const statusClass = (status = '') => `status-${String(status).replaceAll('_', '-')}`;

async function loadProject() {
  const res = await fetch('./data/project.json');
  const data = await res.json();
  render(data);
}

function render(data) {
  document.querySelector('#land-summary').textContent = `${data.land.address} · ${data.land.areaSqm.toLocaleString()}㎡ · ${data.land.summary}`;
  document.querySelector('#land-level').textContent = `Lv.${data.land.level}`;
  document.querySelector('#land-level-name').textContent = data.land.levelName;
  renderHexMap(data.zones);
  renderLevels(data.levels, data.land.level);
  renderActions(data.actions);
  renderQuests(data.quests);
  renderObjects(data.objects);
  renderPlayers(data.players);
}

function renderHexMap(zones) {
  const map = document.querySelector('#hex-map');
  const legend = document.querySelector('#zone-legend');
  map.innerHTML = '';
  legend.innerHTML = '';
  zones.forEach(zone => {
    for (let i = 0; i < zone.hexCount; i++) {
      const hex = document.createElement('div');
      hex.className = `hex ${zoneColors[zone.type] || 'zone-wild'}`;
      hex.title = `${zone.name} · ${zone.status}`;
      map.appendChild(hex);
    }
    const item = document.createElement('span');
    item.className = 'legend-item';
    item.innerHTML = `<span class="${statusClass(zone.status)}">⬢</span> ${zone.name} (${zone.hexCount})`;
    legend.appendChild(item);
  });
}

function renderLevels(levels, currentLevel) {
  const el = document.querySelector('#levels');
  el.innerHTML = levels.map(level => `
    <article class="level ${level.level === currentLevel ? 'active' : ''}">
      <h3>Lv.${level.level} ${level.name}</h3>
      <p>${level.description}</p>
      <div class="meta">${level.unlocks.map(x => `<span class="badge">${x}</span>`).join('')}</div>
    </article>
  `).join('');
}

function renderActions(actions) {
  const el = document.querySelector('#actions');
  el.innerHTML = actions.map(action => `
    <article class="card">
      <h3>${action.name}</h3>
      <span class="${statusClass(action.status)}">${action.status}</span>
      <p>Requires: ${action.requires.join(', ')}</p>
      <div class="meta">
        <span class="badge">${action.category}</span>
        <span class="badge">Lv.${action.levelRequired}+</span>
        ${action.outputs.map(x => `<span class="badge">→ ${x}</span>`).join('')}
      </div>
    </article>
  `).join('');
}

function renderQuests(quests) {
  const el = document.querySelector('#quests');
  el.innerHTML = quests.map(q => `
    <article class="card">
      <h3>${q.title}</h3>
      <span class="${statusClass(q.status)}">${q.status}</span>
      <p>${q.notes}</p>
      <div class="meta"><span class="badge">담당: ${q.assignee}</span>${q.due ? `<span class="badge">Due: ${q.due}</span>` : ''}</div>
    </article>
  `).join('');
}

function renderObjects(objects) {
  const el = document.querySelector('#objects');
  el.innerHTML = objects.map(obj => `
    <article class="object">
      <strong>${obj.name}</strong><br />
      <span class="${statusClass(obj.status)}">${obj.status}</span>
      <div class="meta"><span class="badge">${obj.kind}</span><span class="badge">Lv.${obj.unlockedAtLevel}+</span></div>
    </article>
  `).join('');
}

function renderPlayers(players) {
  const el = document.querySelector('#players');
  el.innerHTML = players.map(p => `
    <article class="player">
      <strong>${p.name}</strong>
      <p>${p.role}</p>
      <span class="${statusClass(p.status)}">${p.status}</span>
    </article>
  `).join('');
}

loadProject().catch(err => {
  document.body.innerHTML = `<pre>Failed to load project data: ${err.message}</pre>`;
});

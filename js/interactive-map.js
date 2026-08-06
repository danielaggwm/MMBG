/* ============================================================
   Miami Beach Botanical Garden — Interactive Walk Map
   Tree Walk + Fragrance Walk with animated highlighted paths.
   Data comes from js/walk-data.js (generated from
   data/Tree&FragranceWalk.xlsx).
   ============================================================ */

mapboxgl.accessToken = 'pk.eyJ1IjoiZGFuaWVsYWdnd20iLCJhIjoiY21ybnFpODQ3MDF5MjJ5cHpyZW9zMmliOCJ9.jOt134jcOmOlPQ_APBm52A';

// ---------- Config ----------
const WALKS = {
  tree: {
    label: 'Tree Walk',
    color: '#81BA6E',
    duration: '45 min – 1 hr',
    description: 'Explore the Garden’s living collection, from sacred bamboo in the Japanese Garden to the Banyan on its namesake lawn. This longer route winds through every garden room, highlighting notable trees and palms along the way.'
  },
  fragrance: {
    label: 'Fragrance Walk',
    color: '#F1968C',
    duration: '15-20 min',
    description: 'A short, scent-led stroll. Twelve fragrant stops where the best advice is simply to slow down and breathe in.',
    disclaimer: 'scents are seasonal, so not every stop will be fragrant. Check each plant’s details for peak times.',
    note: {
      title: 'Look, Don’t Pick',
      text: 'Please leave every flower, fruit, and leaf on the plant - lean in close and enjoy the scent, then leave it for the next visitor to discover.'
    }
  },
  highlights: {
    label: 'Highlights Walk',
    color: '#9B87C4',
    duration: '20–35 min',
    description: 'A hand-picked route through 20 favorites. These are the things we love to share!'
  }
};

// Pollinator overlay — an independent on/off layer (not one of the walks).
// Each stop carries a stoplight color; the color tells you how much patience
// you'll need. Species text is a single shared blurb across every stop.
const POLLINATOR = {
  species: 'Depending on the season and time of day, you might spot butterflies and skippers, busy native bees and honeybees, hovering flower flies, day-flying moths, and nectar-seeking birds passing through.',
  levels: {
    red:    { name: 'Red',    title: 'Guaranteed',    meaning: 'Very active — stop by and take a look.' },
    yellow: { name: 'Yellow', title: 'Patience',      meaning: 'Stand still for a few minutes near their favorite plants.' },
    green:  { name: 'Green',  title: 'Super Patient', meaning: 'The ultimate challenge — wait a little longer and look closely at the canopy or the tiny flowers.' }
  }
};

// The full stoplight key, shown on every pollinator panel for context.
const POLL_KEY_HTML = `
  <div class="poll-key">
    <span class="poll-key-title">The stoplight key</span>
    <ul>
      <li><span class="poll-dot poll-dot-red"></span><span><b>Red · guaranteed.</b> Very active; stop by and take a look.</span></li>
      <li><span class="poll-dot poll-dot-yellow"></span><span><b>Yellow · patience.</b> Stand still a few minutes near their favorite plants.</span></li>
      <li><span class="poll-dot poll-dot-green"></span><span><b>Green · super patient.</b> Wait a little longer and look closely at the canopy or the tiny flowers.</span></li>
    </ul>
  </div>`;

// Placeholder shown until real tree photos are added to images/trees/
const PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="130" viewBox="0 0 240 130">
     <rect width="240" height="130" fill="#EDEAE0"/>
     <g transform="translate(120,58)" fill="none" stroke="#B9B29E" stroke-width="3" stroke-linecap="round">
       <path d="M0,28 L0,-8"/>
       <path d="M0,-8 C-20,-14 -24,-38 -2,-40 C22,-42 20,-16 0,-8" fill="#DDD7C4" stroke="#B9B29E"/>
       <path d="M0,4 L-9,-5 M0,12 L8,4"/>
     </g>
     <text x="120" y="112" text-anchor="middle" font-family="Poppins,sans-serif" font-size="10" fill="#A69F8A">Photo coming soon</text>
   </svg>`);

const isMobile = window.innerWidth <= 640;

// The map's default focus level (more zoomed in on desktop than mobile).
const DEFAULT_ZOOM = isMobile ? 16.2 : 16.6;

// Fixed orientation: north points right, so Convention Center Dr
// sits along the bottom and the garden fills the frame landscape.
const MAP_BEARING = -90;

// ---------- Map ----------
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/standard',
  center: [-80.1355, 25.7957],
  zoom: DEFAULT_ZOOM,
  pitch: 0,
  bearing: MAP_BEARING
});
map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

// Geolocate: shows the visitor's live position on the map. fitBoundsOptions
// caps the zoom so locating keeps the map at its default focus level instead of
// zooming out to Mapbox's default (maxZoom 15).
map.addControl(new mapboxgl.GeolocateControl({
  positionOptions: { enableHighAccuracy: true },
  fitBoundsOptions: { maxZoom: DEFAULT_ZOOM },
  trackUserLocation: true,
  showUserHeading: true
}), 'top-right');

// ---------- State ----------
let activeWalk = 'tree';
let markers = [];
let animId = null;
let is3D = false;

const infoPanel = document.getElementById('info-panel');
const infoContent = document.getElementById('info-content');

// Single reusable hover tooltip (real hover only — on touch screens the
// browser fires mouseenter on tap and never mouseleave, leaving it stuck)
const canHover = window.matchMedia('(hover: hover)').matches;
const hoverTip = new mapboxgl.Popup({
  closeButton: false,
  closeOnClick: false,
  offset: 16,
  className: 'hover-tip'
});

// Features of a walk, sorted in walking (legend) order
function walkFeatures(walk) {
  return WALK_DATA.features
    .filter(f => f.properties.walk === walk)
    .sort((a, b) => a.properties.num - b.properties.num);
}

// One shared view for both walks: bounds of every pin, so the
// camera never shifts when toggling between walks.
function gardenBounds() {
  const b = new mapboxgl.LngLatBounds();
  WALK_DATA.features.forEach(f => b.extend(f.geometry.coordinates));
  return b;
}

function goToGardenView(duration) {
  is3D = false;
  document.getElementById('view-toggle').textContent = '3D';
  map.fitBounds(gardenBounds(), {
    padding: isMobile
      ? { top: 90, bottom: 50, left: 40, right: 35 }
      : { top: 170, bottom: 140, left: 140, right: 140 },
    bearing: MAP_BEARING,
    pitch: 0,
    duration: duration,
    maxZoom: 19
  });
}

// ---------- Info panel ----------
// Desktop: always visible beside the map (welcome view by default).
// Mobile: full-screen overlay, opened by the menu button or a pin tap.

function setPanelWalkClass() {
  infoPanel.classList.remove('walk-tree', 'walk-fragrance', 'walk-highlights');
  infoPanel.classList.add(`walk-${activeWalk}`);
}

function renderWelcome() {
  const w = WALKS[activeWalk];
  const count = walkFeatures(activeWalk).length;
  setPanelWalkClass();
  infoPanel.classList.add('welcome');
  infoContent.innerHTML = `
    <div class="tp-body">
      <span class="tp-stop walk-${activeWalk}">Self-Guided Tour · ${count} stops</span>
      <span class="tp-stop tp-stop-sub walk-${activeWalk}">${w.duration}</span>
      <h4>${w.label}</h4>
      <p class="wp-desc">${w.description}</p>
      ${w.disclaimer ? `<p class="wp-disclaimer"><span class="wp-disclaimer-label">DISCLAIMER:</span> ${w.disclaimer}</p>` : ''}
      ${w.note ? `<div class="wp-note"><span class="wp-note-title">${w.note.title}</span><p>${w.note.text}</p></div>` : ''}
      <ol class="wp-steps">
        <li><span class="step-num">1</span>Pick a walk with the buttons above the map.</li>
        <li><span class="step-num">2</span>Follow the numbered pins in order - the highlighted path traces your route.</li>
        <li><span class="step-num">3</span>Tap any pin to meet the ${activeWalk === 'highlights' ? 'tree or activity' : 'tree or plant'} at that stop.</li>
        <li><span class="step-num">4</span>Use the locate button to see where you're standing in the Garden.</li>
      </ol>
    </div>`;
}

// Renders a description string as one or more <p> paragraphs. Line breaks (from
// the Excel cell) split paragraphs; **double asterisks** become bold. Angle
// brackets/ampersands are escaped so the text can't break the markup.
function formatDesc(text) {
  return String(text).split(/\n+/).map(function (para) {
    var t = para.trim();
    if (!t) return '';
    t = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return '<p class="tp-desc">' + t + '</p>';
  }).join('');
}

function showInfoPanel(props, total) {
  const w = WALKS[props.walk];
  setPanelWalkClass();
  infoPanel.classList.remove('welcome');
  const photos = (props.photos && props.photos.length) ? props.photos : [props.photo];
  const onerr = `this.onerror=null;this.src='${PLACEHOLDER_IMG}'`;
  const media = photos.length > 1
    ? `<div class="tp-gallery" data-idx="0">
         ${photos.map((src, i) => `<img src="${src}" alt="${props.common}" class="tp-slide${i === 0 ? ' active' : ''}" onerror="${onerr}">`).join('')}
         <div class="tp-dots">
           ${photos.map((_, i) => `<button type="button" class="tp-dot${i === 0 ? ' active' : ''}" data-i="${i}" aria-label="Photo ${i + 1} of ${photos.length}"></button>`).join('')}
         </div>
       </div>`
    : `<img src="${photos[0]}" alt="${props.common}" onerror="${onerr}">`;
  infoContent.innerHTML = `
    ${media}
    <div class="tp-body">
      <span class="tp-stop walk-${props.walk}">${w.label} · Stop ${props.num} of ${total}</span>
      <h4>${props.common}</h4>
      ${props.scientific ? `<p class="tp-sci">${props.scientific}</p>` : ''}
      ${props.section ? `<p class="tp-section">${props.section}</p>` : ''}
      ${props.description ? formatDesc(props.description) : ''}
      ${props.peak ? `<div class="tp-peak"><span class="tp-peak-label">At its peak</span><span class="tp-peak-value">${props.peak}</span></div>` : ''}
    </div>`;
  initGallery();
  infoPanel.hidden = false;
}

// Wires up the multi-photo slider (dots + swipe) if the panel has one.
function initGallery() {
  const gal = infoContent.querySelector('.tp-gallery');
  if (!gal) return;
  const slides = gal.querySelectorAll('.tp-slide');
  const dots = gal.querySelectorAll('.tp-dot');
  function go(i) {
    i = (i + slides.length) % slides.length;
    slides.forEach((s, k) => s.classList.toggle('active', k === i));
    dots.forEach((d, k) => d.classList.toggle('active', k === i));
    gal.dataset.idx = i;
  }
  dots.forEach(d => d.addEventListener('click', () => go(+d.dataset.i)));
  // Swipe on touch devices
  let x0 = null;
  gal.addEventListener('touchstart', e => { x0 = e.changedTouches[0].clientX; }, { passive: true });
  gal.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) go(+gal.dataset.idx + (dx < 0 ? 1 : -1));
    x0 = null;
  }, { passive: true });
}

function deselectPins() {
  document.querySelectorAll('.tree-pin.pin-selected')
    .forEach(p => p.classList.remove('pin-selected'));
}

// Mobile only: hide the overlay entirely. On desktop the panel stays,
// falling back to the welcome view.
function closePanel() {
  deselectPins();
  deselectPollinatorPins();
  if (isMobile) {
    infoPanel.hidden = true;
  } else {
    if (pollinatorOn && pollinatorMenuMode) renderPollinatorIntro(); else renderWelcome();
  }
}

// ---------- Markers ----------
function clearMarkers() {
  markers.forEach(m => m.remove());
  markers = [];
  hoverTip.remove();
  deselectPins();
  if (isMobile) infoPanel.hidden = true;
}

let markerByNum = {}; // legend number -> pin element (active walk)

function addMarkers(walk) {
  const feats = walkFeatures(walk);
  const total = feats[feats.length - 1].properties.num;
  markerByNum = {};

  feats.forEach(f => {
    const el = document.createElement('div');
    el.className = `tree-pin pin-${walk}`;
    el.textContent = f.properties.num;

    if (canHover) {
      el.addEventListener('mouseenter', () => {
        hoverTip.setLngLat(f.geometry.coordinates)
          .setText(f.properties.common)
          .addTo(map);
      });
      el.addEventListener('mouseleave', () => hoverTip.remove());
    }

    const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat(f.geometry.coordinates)
      .addTo(map);

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      hoverTip.remove();
      document.querySelectorAll('.tree-pin.pin-selected')
        .forEach(p => p.classList.remove('pin-selected'));
      deselectPollinatorPins();
      el.classList.add('pin-selected');
      showInfoPanel(f.properties, total); // map stays put — no re-centering
    });

    markers.push(marker);
    markerByNum[f.properties.num] = el;
  });
}

// ---------- Animated path ----------
function ensurePathLayers() {
  if (map.getSource('walk-path')) return;

  map.addSource('walk-path', {
    type: 'geojson',
    data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } }
  });

  // White casing underneath for a Google-Maps-style highlighted route
  map.addLayer({
    id: 'walk-path-casing',
    type: 'line',
    source: 'walk-path',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.9 }
  });
  map.addLayer({
    id: 'walk-path-line',
    type: 'line',
    source: 'walk-path',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': WALKS[activeWalk].color, 'line-width': 5, 'line-opacity': 0.95 }
  });
}

function animatePath(walk) {
  ensurePathLayers();
  map.setPaintProperty('walk-path-line', 'line-color', WALKS[walk].color);

  const coords = walkFeatures(walk).map(f => f.geometry.coordinates);
  const line = { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } };
  const duration = 2600;
  let start = null;

  if (animId) cancelAnimationFrame(animId);

  function frame(ts) {
    if (!start) start = ts;
    const p = Math.min((ts - start) / duration, 1);
    // ease-out so the path glides to a stop
    const eased = 1 - Math.pow(1 - p, 3);
    const n = Math.max(2, Math.round(eased * coords.length));
    line.geometry.coordinates = coords.slice(0, n);
    map.getSource('walk-path').setData(line);
    if (p < 1) animId = requestAnimationFrame(frame);
  }
  animId = requestAnimationFrame(frame);
}

// ---------- Walk switching ----------
function showWalk(walk) {
  activeWalk = walk;
  pollinatorMenuMode = false; // picking a walk hands the menu back to that walk

  document.querySelectorAll('.walk-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.walk === walk));

  clearMarkers();
  addMarkers(walk);
  animatePath(walk);

  clearSearch();
  renderWelcome(); // panel introduces the newly selected walk
  if (!isMobile) infoPanel.hidden = false;
  goToGardenView(1200);
}

// ---------- Pollinator overlay ----------
let pollinatorOn = false;
let pollinatorMarkers = [];
// True from the moment the toggle is switched on until the visitor picks a walk.
// While true (mobile), the menu button opens the pollinator tour instructions
// instead of the active walk's welcome panel.
let pollinatorMenuMode = false;

function pollinatorFeatures() {
  return WALK_DATA.features
    .filter(f => f.properties.walk === 'pollinator')
    .sort((a, b) => a.properties.num - b.properties.num);
}

function deselectPollinatorPins() {
  document.querySelectorAll('.poll-pin.poll-selected')
    .forEach(p => p.classList.remove('poll-selected'));
}

function addPollinatorMarkers() {
  pollinatorFeatures().forEach(f => {
    const p = f.properties;
    const el = document.createElement('div');
    el.className = `poll-pin poll-${p.color}`;

    const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat(f.geometry.coordinates)
      .addTo(map);

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      hoverTip.remove();
      deselectPollinatorPins();
      deselectPins();
      el.classList.add('poll-selected');
      showPollinatorPanel(p);
    });

    pollinatorMarkers.push(marker);
  });
}

function clearPollinatorMarkers() {
  pollinatorMarkers.forEach(m => m.remove());
  pollinatorMarkers = [];
}

// ---------- Species catalogue ----------
// Shown from a pollinator stop: the species recorded in that stop's garden
// sector, searchable and filterable by class (bird / insect).
let activePollSector = null;
let catState = { sector: null, cls: 'all', q: '' };

// Placeholder card art until real species photos are dropped into
// images/pollinators/ (filenames follow the scientific-name slug).
const SPECIES_PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">
     <rect width="200" height="150" fill="#EDEAE0"/>
     <g transform="translate(100,64)" fill="none" stroke="#B9B29E" stroke-width="3" stroke-linecap="round">
       <circle cx="0" cy="0" r="17" fill="#DDD7C4" stroke="#B9B29E"/>
       <path d="M-26,4 C-18,-16 18,-16 26,4" />
       <path d="M0,-17 L0,-30 M-9,-27 L0,-30 L9,-27"/>
     </g>
     <text x="100" y="128" text-anchor="middle" font-family="Poppins,sans-serif" font-size="10" fill="#A69F8A">Photo coming soon</text>
   </svg>`);

function speciesForSector(sector) {
  if (!sector || typeof POLLINATOR_SPECIES === 'undefined') return [];
  return POLLINATOR_SPECIES.filter(s => s.sectors.includes(sector));
}

function renderCatalogue() {
  const grid = document.getElementById('cat-grid');
  let list = speciesForSector(catState.sector);
  if (catState.cls !== 'all') list = list.filter(s => s.cls === catState.cls);
  const q = catState.q.trim().toLowerCase();
  if (q) list = list.filter(s =>
    s.common.toLowerCase().includes(q) ||
    (s.scientific && s.scientific.toLowerCase().includes(q)));

  document.querySelectorAll('.cat-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.cls === catState.cls));

  grid.innerHTML = list.length
    ? list.map(s => `
      <figure class="cat-card">
        <div class="cat-photo">
          <img src="${s.img}" alt="${s.common}" loading="lazy"
               onerror="this.onerror=null;this.src='${SPECIES_PLACEHOLDER}'">
          <span class="cat-tag cat-tag-${s.cls}">${s.cls === 'bird' ? 'Bird' : 'Insect'}</span>
        </div>
        <figcaption>
          <span class="cat-name">${s.common}</span>
          ${s.scientific ? `<span class="cat-sci">${s.scientific}</span>` : ''}
        </figcaption>
      </figure>`).join('')
    : '<p class="cat-empty">No species match your search.</p>';

  grid.scrollTop = 0; // always return to the top when the list changes (tab/search)
}

function openCatalogue(sector, cls) {
  catState = { sector: sector, cls: cls || 'all', q: '' };
  document.getElementById('cat-title').textContent = `${sector} pollinators`;
  document.getElementById('cat-search').value = '';
  renderCatalogue();
  document.getElementById('catalogue').hidden = false;
  document.body.classList.add('cat-open');
}

function closeCatalogue() {
  document.getElementById('catalogue').hidden = true;
  document.body.classList.remove('cat-open');
}

function showPollinatorPanel(props) {
  const lvl = POLLINATOR.levels[props.color];
  const total = pollinatorFeatures().length;
  activePollSector = props.sector || null;

  const inSector = props.sector ? speciesForSector(props.sector) : [];
  const nBird = inSector.filter(s => s.cls === 'bird').length;
  const nInsect = inSector.filter(s => s.cls === 'insect').length;

  const spotter = props.sector ? `
      <div class="poll-spotter">
        <span class="poll-note-title">Did you spot anything today?</span>
        <p class="poll-spotter-sub">A bird? An insect? These are the species seen most often in the ${props.sector}. Open the catalogue to find your match.</p>
        <div class="poll-spotter-btns">
          <button class="poll-cat-btn" data-cls="bird">Birds<span class="poll-count">${nBird}</span></button>
          <button class="poll-cat-btn" data-cls="insect">Insects<span class="poll-count">${nInsect}</span></button>
        </div>
      </div>` : '';

  infoPanel.classList.remove('welcome');
  infoContent.innerHTML = `
    <div class="tp-body">
      <span class="tp-stop poll-${props.color}">Pollinator Stop ${props.num} of ${total}</span>
      <div class="poll-head">
        <img class="poll-head-icon" src="images/stoplight/${props.color}.svg" alt="${lvl.name} stoplight">
        <div>
          <h4>${lvl.title}</h4>
          <p class="poll-tier-sub">${lvl.name} light</p>
        </div>
      </div>
      ${props.sector ? `<p class="tp-section poll-sector">${props.sector}</p>` : ''}
      <div class="poll-note poll-note-${props.color}">
        <span class="poll-note-title">What this means</span>
        <p>${lvl.meaning}</p>
      </div>
      <div class="poll-note">
        <span class="poll-note-title">Who you might spot</span>
        <p>${POLLINATOR.species}</p>
      </div>
      ${spotter}
    </div>`;
  infoPanel.hidden = false;
}

function renderPollinatorIntro() {
  deselectPins();
  infoPanel.classList.remove('walk-tree', 'walk-fragrance', 'walk-highlights');
  infoPanel.classList.add('welcome');
  infoContent.innerHTML = `
    <div class="tp-body">
      <span class="tp-stop poll-intro-chip">Pollinator Stops · ${pollinatorFeatures().length}</span>
      <h4>Follow the Stoplight</h4>
      <p class="wp-desc">Spots around the Garden where pollinators gather. The color of each stoplight tells you how much patience you'll need to catch them in action - tap any pin to learn more.</p>
      ${POLL_KEY_HTML}
    </div>`;
  infoPanel.hidden = false;
}

function setPollinator(on) {
  pollinatorOn = on;
  const btn = document.getElementById('pollinator-toggle');
  btn.classList.toggle('active', on);
  btn.setAttribute('aria-pressed', String(on));

  if (on) {
    pollinatorMenuMode = true;               // next menu tap shows the tour intro
    addPollinatorMarkers();
    if (!isMobile) renderPollinatorIntro();  // give immediate context on desktop
  } else {
    pollinatorMenuMode = false;
    deselectPollinatorPins();
    clearPollinatorMarkers();
    if (!isMobile) renderWelcome();          // fall back to the active walk
    else infoPanel.hidden = true;
  }
}

// ---------- Wire up ----------
// Desktop: the panel is part of the layout from the start (welcome view),
// so the map canvas never has to resize around it.
if (!isMobile) {
  renderWelcome();
  infoPanel.hidden = false;
  // The map measured its container BEFORE the panel joined the layout,
  // so its canvas is too wide — remeasure now that the panel is visible.
  map.resize();
}

map.on('load', () => {
  showWalk('tree');

  // Stop the geolocate button's attention animation once it's clicked
  const geoBtn = document.querySelector('.mapboxgl-ctrl-geolocate');
  if (geoBtn) {
    geoBtn.addEventListener('click', () => geoBtn.classList.add('geo-noticed'), { once: true });
  }
});

document.querySelectorAll('.walk-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.walk !== activeWalk) showWalk(btn.dataset.walk);
  });
});

// Pollinator overlay toggle — independent of the walk buttons
document.getElementById('pollinator-toggle').addEventListener('click', () => {
  setPollinator(!pollinatorOn);
});

// Catalogue: the "Birds"/"Insects" buttons live inside the (re-rendered) panel,
// so listen via delegation on the panel container.
infoContent.addEventListener('click', (e) => {
  const b = e.target.closest('.poll-cat-btn');
  if (b && activePollSector) openCatalogue(activePollSector, b.dataset.cls);
});

document.getElementById('cat-search').addEventListener('input', (e) => {
  catState.q = e.target.value;
  renderCatalogue();
});
document.querySelectorAll('.cat-tab').forEach(tab => {
  tab.addEventListener('click', () => { catState.cls = tab.dataset.cls; renderCatalogue(); });
});
document.querySelector('#catalogue .cat-close').addEventListener('click', closeCatalogue);
document.querySelector('#catalogue .cat-backdrop').addEventListener('click', closeCatalogue);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !document.getElementById('catalogue').hidden) closeCatalogue();
});

document.getElementById('reset-view').addEventListener('click', () => {
  goToGardenView(900);
});

// 2D / 3D toggle — tilts the camera, keeps the same orientation
document.getElementById('view-toggle').addEventListener('click', () => {
  is3D = !is3D;
  document.getElementById('view-toggle').textContent = is3D ? '2D' : '3D';
  map.easeTo({
    pitch: is3D ? 58 : 0,
    bearing: MAP_BEARING,
    duration: 1000
  });
});

// Close button on the info panel
document.getElementById('info-close').addEventListener('click', closePanel);

// Mobile menu button — opens the welcome panel (or the pollinator tour intro
// if the visitor just switched the pollinator overlay on)
document.getElementById('panel-menu').addEventListener('click', () => {
  deselectPins();
  deselectPollinatorPins();
  if (pollinatorOn && pollinatorMenuMode) renderPollinatorIntro();
  else renderWelcome();
  infoPanel.hidden = false;
});

// Hide the butterfly cursor-follower while the cursor is over the map
const mapWrap = document.getElementById('map-wrap');
mapWrap.addEventListener('mouseenter', () => document.body.classList.add('hide-butterfly'));
mapWrap.addEventListener('mouseleave', () => document.body.classList.remove('hide-butterfly'));

// ---------- Search ----------
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

const searchBox = document.getElementById('search-box');

function clearSearch() {
  searchInput.value = '';
  searchResults.innerHTML = '';
  searchResults.classList.remove('open');
  searchBox.classList.remove('has-text');
}

function highlightPin(num) {
  document.querySelectorAll('.tree-pin.pin-selected')
    .forEach(p => p.classList.remove('pin-selected'));
  const el = markerByNum[num];
  if (el) el.classList.add('pin-selected');
}

function renderSearch() {
  const q = searchInput.value.trim().toLowerCase();
  searchBox.classList.toggle('has-text', searchInput.value.length > 0);
  searchResults.innerHTML = '';

  // Empty query = show every stop on the active walk (browsable dropdown)
  const matches = walkFeatures(activeWalk).filter(f => {
    if (!q) return true;
    const p = f.properties;
    return p.common.toLowerCase().includes(q) ||
           (p.scientific && p.scientific.toLowerCase().includes(q));
  });

  if (matches.length === 0) {
    searchResults.innerHTML = '<div class="search-empty">No matches on this walk</div>';
  } else {
    const feats = walkFeatures(activeWalk);
    const total = feats[feats.length - 1].properties.num;
    matches.forEach(f => {
      const p = f.properties;
      const item = document.createElement('button');
      item.className = 'search-item';
      item.setAttribute('role', 'option');
      item.innerHTML = `
        <span class="si-num walk-${p.walk}">${p.num}</span>
        <span>${p.common}${p.scientific ? ` <span class="si-sci">${p.scientific}</span>` : ''}</span>`;
      item.addEventListener('click', () => {
        highlightPin(p.num);
        // Desktop: the always-open panel shows the plant right away.
        // Mobile: highlight the pin and zoom to it so the user can see
        // where it is — tapping the pin then opens the panel.
        if (!isMobile) {
          showInfoPanel(p, total);
        } else {
          map.easeTo({
            center: f.geometry.coordinates,
            zoom: 18.5,
            bearing: MAP_BEARING,
            duration: 900
          });
        }
        searchInput.value = p.common;
        searchBox.classList.add('has-text');
        searchResults.classList.remove('open');
      });
      searchResults.appendChild(item);
    });
  }
  searchResults.classList.add('open');
}

searchInput.addEventListener('input', renderSearch);
searchInput.addEventListener('focus', renderSearch); // open the full list on click

document.getElementById('search-clear').addEventListener('click', () => {
  clearSearch();
  deselectPins();
  renderWelcome(); // panel returns to the active walk's welcome view
  if (isMobile) {
    infoPanel.hidden = true;
    goToGardenView(900); // zoom back out to the full walk
  }
  searchInput.focus();
});

// Close the results list when clicking elsewhere
document.addEventListener('click', (e) => {
  if (!document.getElementById('search-box').contains(e.target)) {
    searchResults.classList.remove('open');
  }
});

// ---------- Fullscreen toggle ----------
const fsBtn = document.getElementById('fullscreen-toggle');

// The map lives inside a section with a CSS transform (fade-in animation),
// which traps position:fixed elements. While fullscreen, we move the map
// to <body> so it can truly cover the whole viewport, then put it back.
const mapWrapHome = { parent: mapWrap.parentNode, next: mapWrap.nextSibling };

function setFullscreen(on) {
  if (on) {
    document.body.appendChild(mapWrap);
  } else {
    mapWrapHome.parent.insertBefore(mapWrap, mapWrapHome.next);
  }
  mapWrap.classList.toggle('map-fullscreen', on);
  document.body.classList.toggle('no-scroll', on);
  fsBtn.textContent = on ? 'Exit ⛶' : 'Expand ⛶';
  map.resize();
  goToGardenView(0);
}

fsBtn.addEventListener('click', () => {
  setFullscreen(!mapWrap.classList.contains('map-fullscreen'));
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && mapWrap.classList.contains('map-fullscreen')) {
    setFullscreen(false);
  }
});


/* ============ Preload pollinator catalogue images ============
   The catalogue grid is built only when opened, and its <img>s use
   loading="lazy", so photos start downloading at open-time. This warms
   the browser cache in the background once the page is idle, so the
   catalogue shows every photo instantly. Kept polite: waits for idle,
   loads a few at a time, and bails on Data Saver / very slow links. */
(function preloadPollinatorImages() {
  if (typeof POLLINATOR_SPECIES === 'undefined') return;

  var conn = navigator.connection || {};
  if (conn.saveData) return;                                  // respect Data Saver
  if (/(^|-)2g$/.test(conn.effectiveType || '')) return;      // skip on 2g

  var urls = [];
  var seen = {};
  POLLINATOR_SPECIES.forEach(function (s) {
    if (s && s.img && !seen[s.img]) { seen[s.img] = 1; urls.push(s.img); }
  });

  var i = 0;
  var BATCH = 4; // how many to fetch at once
  function loadNext() {
    if (i >= urls.length) return;
    var img = new Image();
    img.onload = img.onerror = loadNext; // chain: start the next as each finishes
    img.src = urls[i++];
  }
  function start() { for (var n = 0; n < BATCH; n++) loadNext(); }

  if ('requestIdleCallback' in window) {
    requestIdleCallback(start, { timeout: 4000 });
  } else {
    window.addEventListener('load', function () { setTimeout(start, 1500); });
  }
})();


/* ============ Preload tree images (Tree Walk + Highlights Walk) ============
   The info panel builds its <img> only when a pin is tapped, so photos would
   otherwise download on click. This warms the browser cache in the background
   once the page is idle, so tree/highlights stop photos appear instantly.
   Same approach as the pollinator preload above: waits for idle, loads a few
   at a time, and bails on Data Saver / very slow links. */
(function preloadTreeImages() {
  if (typeof WALK_DATA === 'undefined' || !WALK_DATA.features) return;

  var conn = navigator.connection || {};
  if (conn.saveData) return;                                  // respect Data Saver
  if (/(^|-)2g$/.test(conn.effectiveType || '')) return;      // skip on 2g

  var urls = [];
  var seen = {};
  WALK_DATA.features.forEach(function (f) {
    var p = f && f.properties;
    if (!p) return;
    if (p.walk !== 'tree' && p.walk !== 'highlights') return; // both walks
    var list = (p.photos && p.photos.length) ? p.photos : (p.photo ? [p.photo] : []);
    list.forEach(function (src) { if (src && !seen[src]) { seen[src] = 1; urls.push(src); } });
  });

  var i = 0;
  var BATCH = 4; // how many to fetch at once
  function loadNext() {
    if (i >= urls.length) return;
    var img = new Image();
    img.onload = img.onerror = loadNext; // chain: start the next as each finishes
    img.src = urls[i++];
  }
  function start() { for (var n = 0; n < BATCH; n++) loadNext(); }

  if ('requestIdleCallback' in window) {
    requestIdleCallback(start, { timeout: 4000 });
  } else {
    window.addEventListener('load', function () { setTimeout(start, 1500); });
  }
})();

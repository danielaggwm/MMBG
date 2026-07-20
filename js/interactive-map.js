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
    description: 'Wander the Garden’s living collection, from sacred bamboo in the Japanese Garden to the Banyan on its namesake lawn. The route winds through every garden room - native, wetland, and edible gardens included - with a numbered stop at each notable tree and palm.'
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
  kathy: {
    label: 'Kathy’s Walk',
    color: '#9B87C4',
    duration: '30–45 min',
    description: 'A hand-picked route through twenty-five favorites.'
  }
};

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

// Fixed orientation: north points right, so Convention Center Dr
// sits along the bottom and the garden fills the frame landscape.
const MAP_BEARING = -90;

// ---------- Map ----------
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/standard',
  center: [-80.1355, 25.7957],
  zoom: isMobile ? 16.2 : 16.6,
  pitch: 0,
  bearing: MAP_BEARING
});
map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

// Geolocate: shows the visitor's live position on the map
map.addControl(new mapboxgl.GeolocateControl({
  positionOptions: { enableHighAccuracy: true },
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
  infoPanel.classList.remove('walk-tree', 'walk-fragrance', 'walk-kathy');
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
        <li><span class="step-num">3</span>Tap any pin to meet the tree or plant at that stop.</li>
        <li><span class="step-num">4</span>Use the locate button to see where you're standing in the Garden.</li>
      </ol>
    </div>`;
}

function showInfoPanel(props, total) {
  const w = WALKS[props.walk];
  setPanelWalkClass();
  infoPanel.classList.remove('welcome');
  infoContent.innerHTML = `
    <img src="${props.photo}" alt="${props.common}"
         onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
    <div class="tp-body">
      <span class="tp-stop walk-${props.walk}">${w.label} · Stop ${props.num} of ${total}</span>
      <h4>${props.common}</h4>
      ${props.scientific ? `<p class="tp-sci">${props.scientific}</p>` : ''}
      ${props.section ? `<p class="tp-section">${props.section}</p>` : ''}
      ${props.peak ? `<div class="tp-peak"><span class="tp-peak-label">At its peak</span><span class="tp-peak-value">${props.peak}</span></div>` : ''}
    </div>`;
  infoPanel.hidden = false;
}

function deselectPins() {
  document.querySelectorAll('.tree-pin.pin-selected')
    .forEach(p => p.classList.remove('pin-selected'));
}

// Mobile only: hide the overlay entirely. On desktop the panel stays,
// falling back to the welcome view.
function closePanel() {
  deselectPins();
  if (isMobile) {
    infoPanel.hidden = true;
  } else {
    renderWelcome();
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

// Mobile menu button — opens the welcome panel
document.getElementById('panel-menu').addEventListener('click', () => {
  deselectPins();
  renderWelcome();
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

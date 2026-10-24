/**
 * DRISHTI - AI Road Safety & Pothole Intelligence Platform
 * Frontend Interactive Controller
 */

// Global Application State
const state = {
  activePortal: 'public', // 'public' | 'authority'
  authorityRole: 'all',   // 'all' | 'municipality' | 'police' | 'roads_dev'
  potholes: [],
  analytics: null,
  map: null,
  markersLayer: null,
  heatmapLayer: null,
  routeDefaultLayer: null,
  routeSafeLayer: null,
  isHeatmapVisible: false,
  activeRouteMode: 'two_wheeler',
  webcamStream: null,
  latestDetection: null,
  severityChart: null,
  deptChart: null,
  mapConfig: {
    active_provider: 'esri_dark',
    mapbox_token: '',
    google_maps_key: '',
    openrouteservice_key: ''
  },
  currentTileLayer: null,
  currentTileLabelsLayer: null
};

// DOM Content Loaded Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  lucide.createIcons();

  // Setup Portal Navigation
  initPortalNavigation();

  // Setup Leaflet Map & API Key Settings
  initMapKeySettings();
  initMap();

  // Setup AI Vision & Studio Tabs
  initVisionStudio();

  // Setup Geolocation & Reporting Form
  initReportingForm();

  // Setup Routing Engine Controls
  initRoutingControls();

  // Setup Kanban & Modals
  initKanbanAndModals();

  // Setup Search
  initSearch();

  // Initial Data Fetch
  fetchPotholesAndRender();
  fetchAnalyticsAndRender();
});

/* -------------------------------------------------------------
 * 1. Portal & Role Navigation
 * ------------------------------------------------------------- */
function initPortalNavigation() {
  const btnPublic = document.getElementById('btn-portal-public');
  const btnAuthority = document.getElementById('btn-portal-authority');
  const viewPublic = document.getElementById('portal-public-view');
  const viewAuthority = document.getElementById('portal-authority-view');
  const roleContainer = document.getElementById('role-selector-container');
  const roleSelect = document.getElementById('authority-role-select');
  const activeDeptLabel = document.getElementById('active-dept-label');

  btnPublic.addEventListener('click', () => {
    state.activePortal = 'public';
    btnPublic.className = 'px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 bg-cyan-600 text-white shadow';
    btnAuthority.className = 'px-4 py-1.5 text-xs font-semibold rounded-lg text-slate-300 hover:text-white transition-all duration-200 flex items-center gap-2';
    viewPublic.classList.remove('hidden');
    viewAuthority.classList.add('hidden');
    roleContainer.classList.add('hidden');
    roleContainer.classList.remove('flex');
    
    // Invalidate map size so Leaflet renders properly
    setTimeout(() => {
      if (state.map) state.map.invalidateSize();
    }, 200);
  });

  btnAuthority.addEventListener('click', () => {
    state.activePortal = 'authority';
    btnAuthority.className = 'px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 bg-cyan-600 text-white shadow';
    btnPublic.className = 'px-4 py-1.5 text-xs font-semibold rounded-lg text-slate-300 hover:text-white transition-all duration-200 flex items-center gap-2';
    viewAuthority.classList.remove('hidden');
    viewPublic.classList.add('hidden');
    roleContainer.classList.remove('hidden');
    roleContainer.classList.add('flex');

    renderKanbanBoard();
    fetchAnalyticsAndRender();
  });

  roleSelect.addEventListener('change', (e) => {
    state.authorityRole = e.target.value;
    const deptNames = {
      all: 'All Municipal & PWD Divisions',
      municipality: 'Municipality / Civic Ward Operations',
      police: 'Traffic Police Road Safety & Hazard Diversions',
      roads_dev: 'Roads & Development Department (PWD Infrastructure)'
    };
    activeDeptLabel.innerText = `Department: ${deptNames[state.authorityRole] || state.authorityRole}`;
    renderKanbanBoard();
    showToast(`Authority view switched to: ${e.target.options[e.target.selectedIndex].text}`, 'info');
  });

  document.getElementById('btn-export-audit').addEventListener('click', () => {
    showToast('Exporting official road safety audit ledger...', 'success');
    window.open('/api/potholes', '_blank');
  });
}

/* -------------------------------------------------------------
 * 2. Leaflet Map & Spatial Visualization & API Key Integration
 * ------------------------------------------------------------- */
function applyMapProvider(providerKey) {
  if (!state.map) return;
  
  // Remove existing tile layers
  if (state.currentTileLayer) {
    state.map.removeLayer(state.currentTileLayer);
    state.currentTileLayer = null;
  }
  if (state.currentTileLabelsLayer) {
    state.map.removeLayer(state.currentTileLabelsLayer);
    state.currentTileLabelsLayer = null;
  }

  const mapboxToken = state.mapConfig.mapbox_token || localStorage.getItem('drishti_mapbox_token') || '';
  const googleKey = state.mapConfig.google_maps_key || localStorage.getItem('drishti_google_key') || '';

  let tileUrl = '';
  let options = { maxZoom: 19, attribution: 'DRISHTI Road Safety Intelligence' };

  if (providerKey === 'esri_satellite') {
    // 100% Free High-Res Aerial Satellite Imagery (Zero Key Required)
    tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    options.maxZoom = 18;
  } else if (providerKey === 'osm_dark') {
    // 100% Free OpenStreetMap with Tactical Cyber Dark Filter (Zero Key Required)
    tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    options.className = 'osm-dark-tiles';
    options.maxZoom = 19;
  } else if (providerKey === 'osm_streets') {
    // 100% Free OpenStreetMap Standard Streets (Zero Key Required)
    tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    options.maxZoom = 19;
  } else if (providerKey === 'mapbox_dark') {
    if (!mapboxToken) {
      showToast('Mapbox API Token not found. Click "Map API Keys" to enter your token.', 'warning');
      openMapKeysModal();
      // Fallback to Tactical Cyber Dark (No Key)
      tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      options.className = 'osm-dark-tiles';
    } else {
      tileUrl = `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`;
      options.tileSize = 512;
      options.zoomOffset = -1;
    }
  } else if (providerKey === 'mapbox_satellite') {
    if (!mapboxToken) {
      showToast('Mapbox API Token not found. Switching to Free High-Res Aerial Satellite.', 'info');
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      options.maxZoom = 18;
    } else {
      tileUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`;
      options.tileSize = 512;
      options.zoomOffset = -1;
    }
  } else if (providerKey === 'google_hybrid') {
    if (!googleKey) {
      showToast('Google Maps API Key not found. Click "Map API Keys" to add it. Showing Free Satellite.', 'info');
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      options.maxZoom = 18;
    } else {
      tileUrl = `https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&key=${googleKey}`;
    }
  } else {
    // Default: Esri World Dark Gray Base (100% Free, NO API KEY REQUIRED, NO WATERMARK)
    tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
    options.maxZoom = 16;
    
    // Add reference labels overlay on top for road names
    state.currentTileLabelsLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 16 }
    ).addTo(state.map);
  }

  state.currentTileLayer = L.tileLayer(tileUrl, options).addTo(state.map);
  
  if (state.currentTileLabelsLayer) {
    state.currentTileLabelsLayer.bringToFront();
  }
  if (state.markersLayer) {
    state.markersLayer.bringToFront();
  }
  if (state.routeDefaultLayer) {
    state.routeDefaultLayer.bringToFront();
  }
  if (state.routeSafeLayer) {
    state.routeSafeLayer.bringToFront();
  }
}

async function reverseGeocodeAndPopulate(lat, lon) {
  try {
    const res = await fetch(`/api/geocode/reverse?lat=${lat}&lon=${lon}`);
    if (res.ok) {
      const data = await res.json();
      if (data.road_name) {
        document.getElementById('input-road').value = data.road_name;
      }
      showToast(`Auto-detected road: ${data.road_name}`, 'success');
    }
  } catch (err) {
    console.warn('Geocoding notice:', err);
  }
}

function openMapKeysModal() {
  const modal = document.getElementById('modal-map-keys');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeMapKeysModal() {
  const modal = document.getElementById('modal-map-keys');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function updateKeyBadges() {
  const mapboxBadge = document.getElementById('badge-mapbox-status');
  const googleBadge = document.getElementById('badge-google-status');
  if (!mapboxBadge || !googleBadge) return;

  if (state.mapConfig.mapbox_token) {
    mapboxBadge.className = 'absolute right-2.5 top-2 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800';
    mapboxBadge.innerText = 'KEY ACTIVE';
  } else {
    mapboxBadge.className = 'absolute right-2.5 top-2 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-700 text-slate-300';
    mapboxBadge.innerText = 'Not Set';
  }

  if (state.mapConfig.google_maps_key) {
    googleBadge.className = 'absolute right-2.5 top-2 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800';
    googleBadge.innerText = 'KEY ACTIVE';
  } else {
    googleBadge.className = 'absolute right-2.5 top-2 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-700 text-slate-300';
    googleBadge.innerText = 'Not Set';
  }
}

async function initMapKeySettings() {
  const btnOpen = document.getElementById('btn-open-map-keys-modal');
  const btnClose = document.getElementById('btn-close-map-modal');
  const btnCancel = document.getElementById('btn-cancel-map-modal');
  const btnReset = document.getElementById('btn-reset-map-keys');
  const form = document.getElementById('form-map-keys');
  const styleSelect = document.getElementById('map-style-select');

  if (btnOpen) btnOpen.addEventListener('click', openMapKeysModal);
  if (btnClose) btnClose.addEventListener('click', closeMapKeysModal);
  if (btnCancel) btnCancel.addEventListener('click', closeMapKeysModal);

  // Load config from server & localStorage
  try {
    const res = await fetch('/api/config/maps');
    if (res.ok) {
      const cfg = await res.json();
      state.mapConfig = cfg;
      
      const localMapbox = localStorage.getItem('drishti_mapbox_token');
      const localGoogle = localStorage.getItem('drishti_google_key');
      const localOrs = localStorage.getItem('drishti_ors_key');
      
      if (localMapbox && !state.mapConfig.mapbox_token) state.mapConfig.mapbox_token = localMapbox;
      if (localGoogle && !state.mapConfig.google_maps_key) state.mapConfig.google_maps_key = localGoogle;
      if (localOrs && !state.mapConfig.openrouteservice_key) state.mapConfig.openrouteservice_key = localOrs;

      const inputMapbox = document.getElementById('input-mapbox-token');
      const inputGoogle = document.getElementById('input-google-key');
      const inputOrs = document.getElementById('input-ors-key');

      if (inputMapbox) inputMapbox.value = state.mapConfig.mapbox_token || '';
      if (inputGoogle) inputGoogle.value = state.mapConfig.google_maps_key || '';
      if (inputOrs) inputOrs.value = state.mapConfig.openrouteservice_key || '';

      updateKeyBadges();
      
      if (styleSelect && state.mapConfig.active_provider) {
        styleSelect.value = state.mapConfig.active_provider;
      }
    }
  } catch (err) {
    console.warn('Map config load error:', err);
  }

  if (styleSelect) {
    styleSelect.addEventListener('change', (e) => {
      state.mapConfig.active_provider = e.target.value;
      applyMapProvider(e.target.value);
      showToast(`Map layer switched to: ${e.target.options[e.target.selectedIndex].text}`, 'info');
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const mapboxToken = document.getElementById('input-mapbox-token').value.trim();
      const googleKey = document.getElementById('input-google-key').value.trim();
      const orsKey = document.getElementById('input-ors-key').value.trim();

      state.mapConfig.mapbox_token = mapboxToken;
      state.mapConfig.google_maps_key = googleKey;
      state.mapConfig.openrouteservice_key = orsKey;

      localStorage.setItem('drishti_mapbox_token', mapboxToken);
      localStorage.setItem('drishti_google_key', googleKey);
      localStorage.setItem('drishti_ors_key', orsKey);

      updateKeyBadges();

      try {
        await fetch('/api/config/maps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state.mapConfig)
        });
        showToast('Map API Keys saved and applied successfully!', 'success');
        closeMapKeysModal();
        if (styleSelect) applyMapProvider(styleSelect.value);
      } catch (err) {
        console.error(err);
        showToast('Saved keys locally in browser storage.', 'info');
        closeMapKeysModal();
        if (styleSelect) applyMapProvider(styleSelect.value);
      }
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', async () => {
      document.getElementById('input-mapbox-token').value = '';
      document.getElementById('input-google-key').value = '';
      document.getElementById('input-ors-key').value = '';
      localStorage.removeItem('drishti_mapbox_token');
      localStorage.removeItem('drishti_google_key');
      localStorage.removeItem('drishti_ors_key');
      state.mapConfig.mapbox_token = '';
      state.mapConfig.google_maps_key = '';
      state.mapConfig.openrouteservice_key = '';
      state.mapConfig.active_provider = 'carto_dark';
      if (styleSelect) styleSelect.value = 'carto_dark';
      updateKeyBadges();
      applyMapProvider('carto_dark');
      showToast('Map API keys cleared. Reset to default Tactical Dark.', 'info');
      closeMapKeysModal();
    });
  }
}

function initMap() {
  const mapCenter = [12.9716, 77.5946]; // Default City Coordinates
  state.map = L.map('drishti-map', {
    zoomControl: true,
    attributionControl: false
  }).setView(mapCenter, 13);

  // Apply default or configured provider
  const initialProvider = state.mapConfig?.active_provider || 'carto_dark';
  applyMapProvider(initialProvider);

  // Feature Layers
  state.markersLayer = L.layerGroup().addTo(state.map);

  // Map Click Listener to pick coordinates and reverse geocode
  state.map.on('click', async (e) => {
    const lat = e.latlng.lat.toFixed(6);
    const lon = e.latlng.lng.toFixed(6);
    document.getElementById('input-lat').value = lat;
    document.getElementById('input-lon').value = lon;
    showToast(`Picked coordinates: [${lat}, ${lon}]`, 'info');
    await reverseGeocodeAndPopulate(lat, lon);
  });

  // Toggle Heatmap Button
  const btnHeatmap = document.getElementById('btn-toggle-heatmap');
  btnHeatmap.addEventListener('click', () => {
    state.isHeatmapVisible = !state.isHeatmapVisible;
    if (state.isHeatmapVisible) {
      btnHeatmap.className = 'px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-600 text-white border border-amber-500 flex items-center gap-1.5 transition';
      renderHeatmap();
      showToast('Heatmap layer activated (Hazard density)', 'info');
    } else {
      btnHeatmap.className = 'px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition';
      if (state.heatmapLayer) {
        state.map.removeLayer(state.heatmapLayer);
        state.heatmapLayer = null;
      }
      showToast('Heatmap layer deactivated', 'info');
    }
  });

  // Severity Filter Dropdown
  document.getElementById('map-severity-filter').addEventListener('change', (e) => {
    renderMapMarkers(e.target.value);
  });
}

function renderMapMarkers(filterSeverity = 'all') {
  if (!state.markersLayer) return;
  state.markersLayer.clearLayers();

  let filtered = state.potholes;
  if (filterSeverity === 'completed') {
    filtered = filtered.filter(p => p.status === 'completed');
  } else if (filterSeverity !== 'all') {
    filtered = filtered.filter(p => p.severity.toLowerCase() === filterSeverity.toLowerCase());
  }

  filtered.forEach(p => {
    const isCompleted = p.status === 'completed';
    let pinColor = '#EF4444'; // Red for Critical
    if (isCompleted) pinColor = '#10B981'; // Green
    else if (p.severity === 'High') pinColor = '#F59E0B'; // Amber
    else if (p.severity === 'Medium') pinColor = '#EAB308'; // Yellow

    const customIcon = L.divIcon({
      className: 'custom-map-marker',
      html: `
        <div style="background-color: ${pinColor};" class="marker-pin"></div>
        <div style="
          position: absolute; 
          left: 50%; 
          top: -24px; 
          transform: translateX(-50%); 
          background: #0F172A; 
          color: ${pinColor}; 
          border: 1px solid ${pinColor}; 
          font-family: monospace; 
          font-size: 9px; 
          font-weight: bold; 
          padding: 1px 4px; 
          border-radius: 4px; 
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0,0,0,0.6);
        ">${p.id.replace('DRISHTI-2026-', '#')}</div>
      `,
      iconSize: [30, 42],
      iconAnchor: [15, 42]
    });

    const marker = L.marker([p.latitude, p.longitude], { icon: customIcon });

    // Popup Content
    const popupHtml = `
      <div class="p-2 space-y-2 min-w-[220px]">
        <div class="flex items-center justify-between border-b border-slate-700 pb-1.5">
          <span class="font-bold text-xs text-white font-mono">${p.id}</span>
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded" style="background:${pinColor}22; color:${pinColor}; border:1px solid ${pinColor}">
            ${isCompleted ? 'COMPLETED' : p.severity.toUpperCase()}
          </span>
        </div>
        <div class="text-xs text-slate-300 font-semibold">${p.road_name}</div>
        <div class="text-[11px] text-slate-400">Ward: ${p.ward}</div>
        <div class="text-[11px] text-slate-300">
          Depth: <b class="text-amber-400">${p.estimated_depth_cm}cm</b> · Risk: <b class="text-red-400">${p.risk_score}/100</b>
        </div>
        <div class="text-[10px] text-cyan-300">
          Dept: <b>${p.assigned_department ? p.assigned_department.toUpperCase() : 'MUNICIPALITY'}</b>
        </div>
        <div class="pt-1.5 flex gap-2">
          <a href="/api/reports/pdf/${p.id}" target="_blank" class="w-full py-1 text-center bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[11px] font-bold transition">
            Download PDF Report
          </a>
        </div>
      </div>
    `;

    marker.bindPopup(popupHtml);
    state.markersLayer.addLayer(marker);
  });
}

function renderHeatmap() {
  if (state.heatmapLayer) {
    state.map.removeLayer(state.heatmapLayer);
  }

  // Format: [lat, lon, intensity]
  const heatPoints = state.potholes.map(p => {
    let intensity = 0.5;
    if (p.severity === 'Critical') intensity = 1.0;
    else if (p.severity === 'High') intensity = 0.75;
    else if (p.severity === 'Medium') intensity = 0.45;
    return [p.latitude, p.longitude, intensity];
  });

  state.heatmapLayer = L.heatLayer(heatPoints, {
    radius: 35,
    blur: 22,
    maxZoom: 16,
    gradient: {
      0.2: '#06B6D4',
      0.5: '#EAB308',
      0.7: '#F59E0B',
      1.0: '#EF4444'
    }
  }).addTo(state.map);
}

/* -------------------------------------------------------------
 * 3. AI Computer Vision Studio & Input Modes
 * ------------------------------------------------------------- */
function initVisionStudio() {
  const tabCamera = document.getElementById('mode-tab-camera');
  const tabUpload = document.getElementById('mode-tab-upload');
  const tabSamples = document.getElementById('mode-tab-samples');

  const containerCam = document.getElementById('cam-feed-container');
  const containerUpload = document.getElementById('file-upload-container');
  const containerSamples = document.getElementById('samples-container');

  const fileInput = document.getElementById('image-file-input');
  const videoElem = document.getElementById('webcam-video');
  const btnStartCam = document.getElementById('btn-start-camera');
  const btnCaptureCam = document.getElementById('btn-capture-camera');
  const canvasElem = document.getElementById('snapshot-canvas');

  // Tab switching
  function switchTab(activeBtn, showContainer) {
    [tabCamera, tabUpload, tabSamples].forEach(t => {
      t.className = 'py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-all bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600';
    });
    activeBtn.className = 'py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-all bg-cyan-600/30 text-cyan-300 border border-cyan-500/50';

    containerCam.classList.add('hidden');
    containerUpload.classList.add('hidden');
    containerSamples.classList.add('hidden');
    showContainer.classList.remove('hidden');
  }

  tabCamera.addEventListener('click', () => switchTab(tabCamera, containerCam));
  tabUpload.addEventListener('click', () => switchTab(tabUpload, containerUpload));
  tabSamples.addEventListener('click', () => switchTab(tabSamples, containerSamples));

  // Webcam Setup
  btnStartCam.addEventListener('click', async () => {
    try {
      if (state.webcamStream) {
        state.webcamStream.getTracks().forEach(track => track.stop());
      }
      state.webcamStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      videoElem.srcObject = state.webcamStream;
      btnStartCam.innerHTML = `<i data-lucide="check" class="w-4 h-4 text-emerald-400"></i> Cam Active`;
      lucide.createIcons();
      showToast('Camera stream initialized with HD resolution', 'success');
    } catch (err) {
      console.warn('Webcam access error:', err);
      showToast('Could not access device camera. Please upload an image or choose a sample.', 'warning');
    }
  });

  // Capture & Run Detection
  btnCaptureCam.addEventListener('click', () => {
    if (!videoElem.videoWidth) {
      showToast('Please start the camera first, or select a sample image.', 'warning');
      return;
    }
    canvasElem.width = videoElem.videoWidth;
    canvasElem.height = videoElem.videoHeight;
    const ctx = canvasElem.getContext('2d');
    ctx.drawImage(videoElem, 0, 0, canvasElem.width, canvasElem.height);
    const b64 = canvasElem.toDataURL('image/jpeg', 0.85);

    runAIDetection({ image_base64: b64 });
  });

  // File Upload
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append('file', file);
      runAIDetection(formData, true);
    }
  });

  // Sample Preset Buttons
  document.querySelectorAll('.sample-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sampleFile = btn.getAttribute('data-sample');
      runAIDetection({ sample_name: sampleFile });
    });
  });
}

async function runAIDetection(payload, isFormData = false) {
  showToast('Running YOLOv11 Neural Vision Inspection...', 'info');

  try {
    let response;
    if (isFormData) {
      response = await fetch('/api/detect', {
        method: 'POST',
        body: payload
      });
    } else {
      const fd = new FormData();
      for (const key in payload) {
        fd.append(key, payload[key]);
      }
      response = await fetch('/api/detect', {
        method: 'POST',
        body: fd
      });
    }

    if (!response.ok) {
      throw new Error('Detection API returned an error.');
    }

    const data = await response.json();
    state.latestDetection = data;
    renderDetectionResult(data);
    showToast(`YOLOv11 Detection Complete: ${data.potholes_count} pothole(s) localized!`, 'success');

  } catch (err) {
    console.error('Detection failure:', err);
    showToast('Failed to run AI detection. Please verify network/backend status.', 'error');
  }
}

function renderDetectionResult(data) {
  const resultBox = document.getElementById('detection-result-box');
  const resultImg = document.getElementById('annotated-result-img');
  const badge = document.getElementById('detection-badge');
  const statCount = document.getElementById('stat-count');
  const statConf = document.getElementById('stat-conf');
  const statDepth = document.getElementById('stat-depth');
  const statRisk = document.getElementById('stat-risk');

  resultBox.classList.remove('hidden');
  resultImg.src = data.annotated_image;

  statCount.innerText = data.potholes_count;

  // Aggregate stats from detected potholes
  if (data.potholes && data.potholes.length > 0) {
    const top = data.potholes[0];
    statConf.innerText = `${Math.round(top.confidence * 100)}%`;
    statDepth.innerText = `${top.estimated_depth_cm} cm`;
    statRisk.innerText = `${top.risk_score}/100`;

    if (top.severity === 'Critical') {
      badge.className = 'px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-red-950 text-red-400 border border-red-800';
      badge.innerText = 'CRITICAL HAZARD';
    } else if (top.severity === 'High') {
      badge.className = 'px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-amber-950 text-amber-400 border border-amber-800';
      badge.innerText = 'HIGH RISK';
    } else {
      badge.className = 'px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-yellow-950 text-yellow-400 border border-yellow-800';
      badge.innerText = 'MODERATE DISTRESS';
    }

    // Auto-update the grievance form
    updateFormFromDetection(top);
  } else {
    statConf.innerText = '99%';
    statDepth.innerText = '0 cm';
    statRisk.innerText = '0/100';
    badge.className = 'px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800';
    badge.innerText = 'SURFACE CLEAR';
  }
}

function updateFormFromDetection(pothole) {
  const roadInput = document.getElementById('input-road');
  const priorityZone = document.getElementById('input-priority-zone').value;

  // Trigger automated department routing preview
  updateAutomatedDeptPreview(pothole.severity, priorityZone, roadInput.value);
}

function updateAutomatedDeptPreview(severity, priorityZone, roadName) {
  const previewDept = document.getElementById('preview-assigned-dept');
  let dept = 'MUNICIPALITY (CIVIC WARD)';
  
  if (priorityZone.includes('School') || priorityZone.includes('Hospital') || roadName.toLowerCase().includes('accident')) {
    dept = 'TRAFFIC POLICE (DIVERSION & SAFETY)';
  } else if (roadName.toLowerCase().includes('ring road') || roadName.toLowerCase().includes('highway') || roadName.toLowerCase().includes('flyover') || severity === 'Critical') {
    dept = 'ROADS & DEVELOPMENT (PWD INFRASTRUCTURE)';
  }

  previewDept.innerText = dept;
}

/* -------------------------------------------------------------
 * 4. Geolocation & Complaint Reporting Form
 * ------------------------------------------------------------- */
function initReportingForm() {
  const btnFetchGps = document.getElementById('btn-fetch-gps');
  const form = document.getElementById('pothole-report-form');
  const roadInput = document.getElementById('input-road');
  const zoneSelect = document.getElementById('input-priority-zone');

  // Dynamic router preview update on user typing
  roadInput.addEventListener('input', () => {
    const sev = state.latestDetection?.potholes?.[0]?.severity || 'High';
    updateAutomatedDeptPreview(sev, zoneSelect.value, roadInput.value);
  });

  zoneSelect.addEventListener('change', () => {
    const sev = state.latestDetection?.potholes?.[0]?.severity || 'High';
    updateAutomatedDeptPreview(sev, zoneSelect.value, roadInput.value);
  });

  // HTML5 Browser Geolocation
  btnFetchGps.addEventListener('click', () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.', 'warning');
      return;
    }

    btnFetchGps.innerHTML = `<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i> Locating...`;
    lucide.createIcons();

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lon = pos.coords.longitude.toFixed(6);
        document.getElementById('input-lat').value = lat;
        document.getElementById('input-lon').value = lon;
        btnFetchGps.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i> GPS Locked`;
        lucide.createIcons();

        // Pan map
        if (state.map) {
          state.map.setView([lat, lon], 14);
        }
        showToast(`GPS Position Locked: [${lat}, ${lon}]`, 'success');
        await reverseGeocodeAndPopulate(lat, lon);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        btnFetchGps.innerHTML = `<i data-lucide="crosshair" class="w-3.5 h-3.5"></i> Auto-Fetch GPS`;
        lucide.createIcons();
        showToast('Could not acquire GPS. Using manual coordinates.', 'info');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  });

  // Submit Grievance
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const topPothole = state.latestDetection?.potholes?.[0] || {};
    const severity = topPothole.severity || 'Critical';
    const risk_score = topPothole.risk_score || 88;
    const confidence = topPothole.confidence || 0.94;
    const estimated_depth_cm = topPothole.estimated_depth_cm || 12.0;
    const estimated_diameter_cm = topPothole.estimated_diameter_cm || 55.0;

    const payload = {
      road_name: document.getElementById('input-road').value,
      ward: document.getElementById('input-ward').value,
      latitude: parseFloat(document.getElementById('input-lat').value),
      longitude: parseFloat(document.getElementById('input-lon').value),
      severity: severity,
      risk_score: risk_score,
      confidence: confidence,
      estimated_depth_cm: estimated_depth_cm,
      estimated_diameter_cm: estimated_diameter_cm,
      reported_by: document.getElementById('input-reporter-name').value,
      reporter_contact: document.getElementById('input-reporter-phone').value,
      priority_zone: document.getElementById('input-priority-zone').value,
      description: document.getElementById('input-desc').value,
      photo_url: '/sample_images/sample_critical_arterial.jpg'
    };

    try {
      showToast('Submitting official grievance to municipal server...', 'info');
      const response = await fetch('/api/potholes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to create pothole record');

      const created = await response.json();
      showToast(`Grievance registered successfully! Ticket ID: ${created.id}`, 'success');

      // Refresh list & map
      await fetchPotholesAndRender();
      await fetchAnalyticsAndRender();

      // Pan map to new pothole
      if (state.map) {
        state.map.setView([created.latitude, created.longitude], 15);
      }

      // Offer immediate PDF download
      setTimeout(() => {
        if (confirm(`Grievance ${created.id} submitted! Would you like to download the Official PDF Incident Report now?`)) {
          window.open(`/api/reports/pdf/${created.id}`, '_blank');
        }
      }, 500);

    } catch (err) {
      console.error(err);
      showToast('Submission error. Please check server connection.', 'error');
    }
  });
}

/* -------------------------------------------------------------
 * 5. Safe Route Planning & Navigation Engine
 * ------------------------------------------------------------- */
function initRoutingControls() {
  const modeButtons = document.querySelectorAll('.route-mode-btn');
  const btnCompute = document.getElementById('btn-compute-route');

  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modeButtons.forEach(b => {
        b.className = 'route-mode-btn p-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition';
      });
      btn.className = 'route-mode-btn p-2 rounded-lg bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-2 transition';
      state.activeRouteMode = btn.getAttribute('data-mode');
      computeAndRenderRoute();
    });
  });

  btnCompute.addEventListener('click', () => {
    computeAndRenderRoute();
  });

  // Initial Route computation after map load
  setTimeout(computeAndRenderRoute, 800);
}

async function computeAndRenderRoute() {
  // Use representative origin & destination across the city corridor
  const origin = [12.9279, 77.6271];       // South Tech Hub Corridor
  const destination = [12.9784, 77.6408];  // East Indiranagar Civic

  try {
    const res = await fetch('/api/navigation/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: origin,
        destination: destination,
        mode: state.activeRouteMode
      })
    });

    if (!res.ok) throw new Error('Routing computation failed');
    const data = await res.json();
    renderRouteOnMap(data);

  } catch (err) {
    console.error('Routing error:', err);
  }
}

function renderRouteOnMap(data) {
  // Remove existing route polylines
  if (state.routeDefaultLayer) state.map.removeLayer(state.routeDefaultLayer);
  if (state.routeSafeLayer) state.map.removeLayer(state.routeSafeLayer);

  const defCoords = data.default_route.coordinates;
  const safeCoords = data.safe_route.coordinates;

  // 1. Draw Default Route (Hazardous Red Dashed Polyline)
  state.routeDefaultLayer = L.polyline(defCoords, {
    color: '#EF4444',
    weight: 4,
    dashArray: '8, 8',
    opacity: 0.8
  }).addTo(state.map);

  // 2. Draw DRISHTI AI Safe Route (Glowing Cyan Solid Polyline)
  state.routeSafeLayer = L.polyline(safeCoords, {
    color: '#06B6D4',
    weight: 6,
    opacity: 0.95
  }).addTo(state.map);

  // Update Route Metrics Card
  document.getElementById('route-def-hazard').innerText = `Hazard Score: ${data.default_route.hazard_score}/100`;
  document.getElementById('route-def-dist').innerText = `${data.default_route.distance_km} km`;
  document.getElementById('route-def-time').innerText = `${data.default_route.duration_minutes} mins`;
  document.getElementById('route-def-count').innerText = `${data.default_route.potholes_encountered_count} Severe Craters`;

  document.getElementById('route-safe-hazard').innerText = `Hazard Score: ${data.safe_route.hazard_score}/100 (${data.safe_route.safety_improvement_percent}% Safer)`;
  document.getElementById('route-safe-dist').innerText = `${data.safe_route.distance_km} km (+${(data.safe_route.distance_km - data.default_route.distance_km).toFixed(1)} km)`;
  document.getElementById('route-safe-time').innerText = `${data.safe_route.duration_minutes} mins (+${data.safe_route.time_difference_minutes} mins)`;

  document.getElementById('route-comparison-text').innerHTML = `
    <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
    <span><b>${data.mode_name}</b>: ${data.safety_recommendation}</span>
  `;
}

/* -------------------------------------------------------------
 * 6. Public Complaints Tracker & Search
 * ------------------------------------------------------------- */
function initSearch() {
  const searchInput = document.getElementById('public-search-input');
  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    renderPublicComplaintsList(term);
  });
}

function renderPublicComplaintsList(filterTerm = '') {
  const container = document.getElementById('public-potholes-list');
  container.innerHTML = '';

  let list = state.potholes;
  if (filterTerm) {
    list = list.filter(p => 
      p.id.toLowerCase().includes(filterTerm) ||
      p.road_name.toLowerCase().includes(filterTerm) ||
      p.ward.toLowerCase().includes(filterTerm)
    );
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-8 text-center text-slate-500 text-xs">
        No matching road complaints found in municipal registry.
      </div>
    `;
    return;
  }

  list.forEach(p => {
    const isCompleted = p.status === 'completed';
    let sevBadge = 'badge-critical';
    if (isCompleted) sevBadge = 'badge-completed';
    else if (p.severity === 'High') sevBadge = 'badge-high';
    else if (p.severity === 'Medium') sevBadge = 'badge-medium';

    const statusMap = {
      reported: { label: 'Reported', pct: 20, color: 'bg-slate-400' },
      inspection: { label: 'Inspection', pct: 40, color: 'bg-amber-400' },
      dispatched: { label: 'Crew Dispatched', pct: 60, color: 'bg-blue-400' },
      in_progress: { label: 'In-Progress', pct: 80, color: 'bg-cyan-400' },
      completed: { label: 'Repaired & Certified', pct: 100, color: 'bg-emerald-400' }
    };

    const st = statusMap[p.status] || statusMap['reported'];

    const card = document.createElement('div');
    card.className = 'glass-panel p-4 rounded-xl border border-slate-800 space-y-3 hover:border-slate-700 transition flex flex-col justify-between';
    card.innerHTML = `
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-mono font-bold text-cyan-400">${p.id}</span>
          <span class="text-[10px] font-semibold px-2 py-0.5 rounded ${sevBadge}">
            ${isCompleted ? 'CERTIFIED REPAIR' : p.severity.toUpperCase()}
          </span>
        </div>

        <div>
          <h4 class="text-sm font-bold text-white line-clamp-1">${p.road_name}</h4>
          <p class="text-xs text-slate-400">${p.ward}</p>
        </div>

        <!-- Telemetry Tags -->
        <div class="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/60 p-2 rounded-lg font-mono">
          <div>Depth: <b class="text-amber-400">${p.estimated_depth_cm}cm</b></div>
          <div>Risk: <b class="text-red-400">${p.risk_score}/100</b></div>
          <div class="col-span-2 text-cyan-300">Dept: <b>${(p.assigned_department || 'municipality').toUpperCase()}</b></div>
        </div>

        <!-- Progress Bar -->
        <div class="space-y-1">
          <div class="flex justify-between text-[10px] text-slate-400">
            <span>Status: <b class="text-white">${st.label}</b></span>
            <span>${st.pct}%</span>
          </div>
          <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div class="${st.color} h-full rounded-full transition-all duration-500" style="width: ${st.pct}%"></div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="pt-2 border-t border-slate-800 flex gap-2">
        <button onclick="zoomToPothole(${p.latitude}, ${p.longitude})" class="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-medium flex items-center justify-center gap-1 transition">
          <i data-lucide="crosshair" class="w-3.5 h-3.5 text-cyan-400"></i> Map View
        </button>
        <a href="/api/reports/pdf/${p.id}" target="_blank" class="flex-1 py-1.5 bg-cyan-600/80 hover:bg-cyan-600 text-white rounded text-xs font-bold flex items-center justify-center gap-1 transition">
          <i data-lucide="file-text" class="w-3.5 h-3.5"></i> PDF Report
        </a>
      </div>
    `;

    container.appendChild(card);
  });

  lucide.createIcons();
}

window.zoomToPothole = function(lat, lon) {
  if (state.map) {
    state.map.setView([lat, lon], 16);
    showToast(`Centered map on coordinates: [${lat}, ${lon}]`, 'info');
    // Scroll smoothly to map
    document.getElementById('drishti-map').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

/* -------------------------------------------------------------
 * 7. Work Orders Kanban & Repair Lifecycle (Module 5)
 * ------------------------------------------------------------- */
function initKanbanAndModals() {
  const modal = document.getElementById('modal-lifecycle');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelModal = document.getElementById('btn-cancel-modal');
  const formUpdate = document.getElementById('form-update-lifecycle');

  function closeModal() {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  btnCloseModal.addEventListener('click', closeModal);
  btnCancelModal.addEventListener('click', closeModal);

  formUpdate.addEventListener('submit', async (e) => {
    e.preventDefault();
    const potholeId = document.getElementById('modal-pothole-id').value;
    const newStatus = document.getElementById('modal-select-status').value;
    const newDept = document.getElementById('modal-select-dept').value;
    const contractor = document.getElementById('modal-contractor').value;
    const materials = document.getElementById('modal-materials').value;
    const notes = document.getElementById('modal-notes').value;

    try {
      // 1. Update status
      await fetch(`/api/potholes/${potholeId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          note: notes,
          contractor: contractor,
          materials: materials,
          after_photo_url: newStatus === 'completed' ? '/sample_images/sample_medium_suburban.jpg' : null
        })
      });

      // 2. Update department if changed
      await fetch(`/api/potholes/${potholeId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department: newDept, note: 'Department updated via Lifecycle Board' })
      });

      showToast(`Work order ${potholeId} successfully updated to: ${newStatus.toUpperCase()}`, 'success');
      closeModal();

      // Refresh data
      await fetchPotholesAndRender();
      await fetchAnalyticsAndRender();

    } catch (err) {
      console.error(err);
      showToast('Error updating work order.', 'error');
    }
  });
}

function renderKanbanBoard() {
  const columns = {
    reported: document.getElementById('kanban-col-reported'),
    inspection: document.getElementById('kanban-col-inspection'),
    dispatched: document.getElementById('kanban-col-dispatched'),
    in_progress: document.getElementById('kanban-col-in_progress'),
    completed: document.getElementById('kanban-col-completed')
  };

  const counts = {
    reported: document.getElementById('col-count-reported'),
    inspection: document.getElementById('col-count-inspection'),
    dispatched: document.getElementById('col-count-dispatched'),
    in_progress: document.getElementById('col-count-in_progress'),
    completed: document.getElementById('col-count-completed')
  };

  // Clear columns
  for (const k in columns) {
    if (columns[k]) columns[k].innerHTML = '';
  }

  // Filter based on active authority role
  let list = state.potholes;
  if (state.authorityRole !== 'all') {
    list = list.filter(p => p.assigned_department === state.authorityRole);
  }

  // Count tallies
  const tallies = { reported: 0, inspection: 0, dispatched: 0, in_progress: 0, completed: 0 };

  list.forEach(p => {
    const colKey = p.status || 'reported';
    if (tallies[colKey] !== undefined) tallies[colKey]++;

    const colElem = columns[colKey];
    if (!colElem) return;

    let sevBadge = 'badge-critical';
    if (p.severity === 'High') sevBadge = 'badge-high';
    else if (p.severity === 'Medium') sevBadge = 'badge-medium';
    if (p.status === 'completed') sevBadge = 'badge-completed';

    const card = document.createElement('div');
    card.className = 'p-3 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-cyan-500/60 transition cursor-pointer space-y-2';
    card.onclick = () => openLifecycleModal(p);

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-xs font-mono font-bold text-cyan-400">${p.id}</span>
        <span class="text-[9px] font-semibold px-1.5 py-0.5 rounded ${sevBadge}">${p.severity}</span>
      </div>
      <div class="text-xs font-semibold text-white line-clamp-2">${p.road_name}</div>
      <div class="text-[10px] text-slate-400 flex justify-between">
        <span>Ward: ${p.ward.split(' - ')[0]}</span>
        <span class="text-amber-400 font-mono">${p.estimated_depth_cm}cm depth</span>
      </div>
      <div class="text-[10px] text-slate-500 border-t border-slate-800 pt-1 flex items-center justify-between">
        <span class="text-cyan-300 font-mono">${(p.assigned_department || 'PWD').toUpperCase()}</span>
        <span class="hover:text-cyan-400 text-slate-400">Click to Edit →</span>
      </div>
    `;

    colElem.appendChild(card);
  });

  // Update counts
  for (const k in tallies) {
    if (counts[k]) counts[k].innerText = tallies[k];
  }
}

function openLifecycleModal(p) {
  const modal = document.getElementById('modal-lifecycle');
  document.getElementById('modal-pothole-id').value = p.id;
  document.getElementById('modal-ticket-id').innerText = `${p.id} · Lifecycle Management`;
  document.getElementById('modal-road-name').innerText = `${p.road_name} (${p.ward})`;
  document.getElementById('modal-select-status').value = p.status || 'reported';
  document.getElementById('modal-select-dept').value = p.assigned_department || 'municipality';
  document.getElementById('modal-contractor').value = p.contractor || '';
  document.getElementById('modal-materials').value = p.materials_used || '';
  document.getElementById('modal-notes').value = '';

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

/* -------------------------------------------------------------
 * 8. Strategic Analytics & Hotspots (Module 6)
 * ------------------------------------------------------------- */
async function fetchAnalyticsAndRender() {
  try {
    const res = await fetch('/api/analytics');
    if (!res.ok) throw new Error('Analytics fetch failed');
    const data = await res.json();
    state.analytics = data;

    // 1. KPI Counters
    document.getElementById('kpi-total').innerText = data.metrics.total_detected;
    document.getElementById('kpi-repaired').innerText = data.metrics.repaired;
    document.getElementById('kpi-progress').innerText = data.metrics.in_progress;
    document.getElementById('kpi-pending').innerText = data.metrics.pending;
    document.getElementById('kpi-rate').innerText = `${data.metrics.resolution_rate_percent}%`;

    // 2. Hotspots List
    renderHotspots(data.hotspots);

    // 3. Charts
    renderCharts(data);

  } catch (err) {
    console.error('Analytics error:', err);
  }
}

function renderHotspots(hotspots) {
  const container = document.getElementById('hotspots-list-container');
  if (!container) return;
  container.innerHTML = '';

  hotspots.forEach(h => {
    const item = document.createElement('div');
    item.className = 'p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5 hover:border-slate-700 transition';
    item.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-white">${h.name}</span>
        <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800 font-bold">
          ${h.risk_level} · ${h.recurring_count} RECURRENCES
        </span>
      </div>
      <div class="text-[11px] text-slate-400">${h.ward} · Last Audit: ${h.last_audited}</div>
      <div class="text-xs text-amber-300/90 font-medium bg-amber-950/20 p-2 rounded border border-amber-900/30">
        <b>Audit Recommendation:</b> ${h.recommendation}
      </div>
    `;
    container.appendChild(item);
  });
}

function renderCharts(data) {
  // Chart 1: Severity Donut Chart
  const ctxSev = document.getElementById('chart-severity');
  if (ctxSev) {
    if (state.severityChart) state.severityChart.destroy();
    state.severityChart = new Chart(ctxSev, {
      type: 'doughnut',
      data: {
        labels: ['Critical', 'High Risk', 'Medium Distress'],
        datasets: [{
          data: [
            data.severity_breakdown.Critical,
            data.severity_breakdown.High,
            data.severity_breakdown.Medium
          ],
          backgroundColor: ['#EF4444', '#F59E0B', '#EAB308'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#94A3B8', font: { size: 10 } }
          }
        }
      }
    });
  }

  // Chart 2: Department Workload Bar Chart
  const ctxDept = document.getElementById('chart-dept');
  if (ctxDept) {
    if (state.deptChart) state.deptChart.destroy();
    const depts = data.department_performance;
    state.deptChart = new Chart(ctxDept, {
      type: 'bar',
      data: {
        labels: ['Municipality', 'Police Dept', 'Roads & Dev (PWD)'],
        datasets: [
          {
            label: 'Total Assigned',
            data: [depts.municipality.total, depts.police.total, depts.roads_dev.total],
            backgroundColor: '#06B6D4'
          },
          {
            label: 'Certified Repaired',
            data: [depts.municipality.completed, depts.police.completed, depts.roads_dev.completed],
            backgroundColor: '#10B981'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: '#94A3B8', font: { size: 9 } }, grid: { display: false } },
          y: { ticks: { color: '#94A3B8', font: { size: 9 }, stepSize: 1 }, grid: { color: '#1E293B' } }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#94A3B8', font: { size: 10 } }
          }
        }
      }
    });
  }
}

/* -------------------------------------------------------------
 * 9. Master Data Fetch
 * ------------------------------------------------------------- */
async function fetchPotholesAndRender() {
  try {
    const res = await fetch('/api/potholes');
    if (!res.ok) throw new Error('Failed to fetch potholes');
    state.potholes = await res.json();

    renderMapMarkers();
    renderPublicComplaintsList();
    renderKanbanBoard();

  } catch (err) {
    console.error('Fetch error:', err);
  }
}

/* -------------------------------------------------------------
 * 10. Toast Notification Helper
 * ------------------------------------------------------------- */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const typeStyles = {
    info: 'bg-slate-900 border-cyan-500/60 text-cyan-200',
    success: 'bg-slate-900 border-emerald-500/60 text-emerald-200',
    warning: 'bg-slate-900 border-amber-500/60 text-amber-200',
    error: 'bg-slate-900 border-red-500/60 text-red-200'
  };

  toast.className = `p-3 rounded-xl border shadow-2xl text-xs flex items-center gap-2 max-w-sm transition-all duration-300 transform translate-y-2 opacity-0 pointer-events-auto ${typeStyles[type] || typeStyles.info}`;
  toast.innerHTML = `
    <span class="w-2 h-2 rounded-full ${type === 'success' ? 'bg-emerald-400' : (type === 'error' ? 'bg-red-400' : 'bg-cyan-400')} animate-pulse"></span>
    <span class="flex-1">${message}</span>
  `;

  container.appendChild(toast);

  // Animate in
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  // Remove after 4s
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-x-4');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

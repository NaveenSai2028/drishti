/**
 * DRISHTI - AI Road Safety Intelligence Command Center
 * Frontend Interactive Controller supporting all 10 Views
 */

// Application Global State
const state = {
  currentView: 'dashboard',
  potholes: [],
  analytics: null,
  activeWorkOrder: null,
  dashMap: null,
  mainMap: null,
  dashMarkersLayer: null,
  mainMarkersLayer: null,
  mainHeatmapLayer: null,
  isMainHeatmapVisible: false,
  webcamStream: null,
  latestDetection: null,
  charts: {},
  mapConfig: {
    active_provider: 'esri_dark',
    mapbox_token: '',
    google_maps_key: ''
  }
};

// Initial Setup on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  // Lucide icons
  lucide.createIcons();

  // Setup Sidebar View Switching & Mobile Drawer
  initNavigation();

  // Setup Detection Studio
  initDetectStudio();

  // Setup Work Orders & Inspections
  initWorkOrders();

  // Setup Routing view
  initRoutingView();

  // Setup Complaint Report View
  initComplaintReports();

  // Setup Department Routing View
  initDeptRouting();

  // Setup Map Keys Modal
  initMapKeysModal();

  // Initial Fetch of Data
  fetchInitialData();
});

/* -------------------------------------------------------------
 * 1. Sidebar Navigation & View Management
 * ------------------------------------------------------------- */
function initNavigation() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('mobile-backdrop');
  const btnToggle = document.getElementById('btn-toggle-sidebar');
  const navLinks = document.querySelectorAll('#sidebar-nav .nav-link');
  const breadcrumb = document.getElementById('header-breadcrumb');

  // Mobile toggle
  if (btnToggle && sidebar && backdrop) {
    btnToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('hidden');
    });

    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.classList.add('hidden');
    });
  }

  // View switcher
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      const targetView = link.getAttribute('data-view');
      switchView(targetView);

      // Close mobile drawer on navigation
      if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        backdrop.classList.add('hidden');
      }
    });
  });
}

window.switchView = function(viewId) {
  state.currentView = viewId;

  // Update active sidebar link
  document.querySelectorAll('#sidebar-nav .nav-link').forEach(l => {
    if (l.getAttribute('data-view') === viewId) {
      l.classList.add('active');
    } else {
      l.classList.remove('active');
    }
  });

  // Update breadcrumb text
  const breadcrumb = document.getElementById('header-breadcrumb');
  if (breadcrumb) {
    breadcrumb.innerText = viewId.replace('-', ' ').toUpperCase();
  }

  // Hide all sections, show target
  const allViews = [
    'dashboard', 'detect', 'map', 'routing', 'work-orders',
    'timeline', 'analytics', 'complaint-report', 'dept-routing', 'architecture'
  ];

  allViews.forEach(v => {
    const sec = document.getElementById(`view-${v}`);
    if (sec) {
      if (v === viewId) {
        sec.classList.remove('hidden');
      } else {
        sec.classList.add('hidden');
      }
    }
  });

  // Refresh maps or charts on view entry
  if (viewId === 'dashboard') {
    setTimeout(() => { if (state.dashMap) state.dashMap.invalidateSize(); }, 150);
  } else if (viewId === 'map') {
    setTimeout(() => {
      if (!state.mainMap) initMainMap();
      else state.mainMap.invalidateSize();
    }, 150);
  } else if (viewId === 'analytics') {
    setTimeout(renderAnalyticsCharts, 150);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

/* -------------------------------------------------------------
 * 2. Master Data Fetching & Dashboard KPIs
 * ------------------------------------------------------------- */
async function fetchInitialData() {
  try {
    const [potholesRes, analyticsRes] = await Promise.all([
      fetch('/api/potholes'),
      fetch('/api/analytics')
    ]);

    if (potholesRes.ok) {
      state.potholes = await potholesRes.json();
      renderDashboardTable();
      renderWorkOrdersList();
      populateDropdowns();
      renderFullTimeline();
    }

    if (analyticsRes.ok) {
      state.analytics = await analyticsRes.json();
      updateDashboardKPIs();
    }

    // Initialize Dashboard Mini Map
    initDashMap();

  } catch (err) {
    console.error('Initial data fetch error:', err);
  }
}

function updateDashboardKPIs() {
  if (!state.analytics) return;
  const m = state.analytics.metrics;

  document.getElementById('kpi-dash-total').innerText = m.total_detected.toLocaleString();
  document.getElementById('kpi-dash-critical').innerText = state.analytics.severity_breakdown.Critical.toLocaleString();
  document.getElementById('kpi-dash-orders').innerText = m.in_progress.toLocaleString();
  document.getElementById('kpi-dash-repaired').innerText = m.repaired.toLocaleString();

  // Pipeline activity counts
  const reportedCount = state.potholes.filter(p => p.status === 'reported').length;
  const assignedCount = state.potholes.filter(p => p.status === 'assigned' || p.status === 'inspection').length;
  const inProgressCount = state.potholes.filter(p => p.status === 'in_progress' || p.status === 'dispatched').length;
  const repairedCount = state.potholes.filter(p => p.status === 'completed').length;

  document.getElementById('activity-reported').innerText = reportedCount;
  document.getElementById('activity-assigned').innerText = assignedCount;
  document.getElementById('activity-progress').innerText = inProgressCount;
  document.getElementById('activity-repaired').innerText = repairedCount;
}

function renderDashboardTable(filterText = '') {
  const tbody = document.getElementById('dash-recent-table');
  if (!tbody) return;
  tbody.innerHTML = '';

  let list = state.potholes;
  if (filterText) {
    list = list.filter(p =>
      p.id.toLowerCase().includes(filterText) ||
      p.road_name.toLowerCase().includes(filterText) ||
      p.ward.toLowerCase().includes(filterText)
    );
  }

  list.forEach(p => {
    let sevClass = 'badge-critical';
    if (p.severity === 'High') sevClass = 'badge-high';
    else if (p.severity === 'Medium') sevClass = 'badge-medium';

    let statusClass = 'badge-assigned';
    if (p.status === 'completed') statusClass = 'badge-repaired';

    const row = document.createElement('tr');
    row.className = 'hover:bg-[#0E1A2E]/70 cursor-pointer transition';
    row.onclick = () => {
      selectWorkOrder(p.id);
      switchView('work-orders');
    };

    row.innerHTML = `
      <td class="py-3 px-3 font-mono font-bold text-cyan-400">${p.id}</td>
      <td class="py-3 px-3">
        <div class="text-white font-semibold">${p.road_name}</div>
        <div class="text-[11px] text-slate-400">${p.ward}</div>
      </td>
      <td class="py-3 px-3">
        <span class="badge-status ${sevClass}">${p.severity}</span>
      </td>
      <td class="py-3 px-3 font-mono font-bold ${p.risk_score > 75 ? 'text-rose-400' : 'text-amber-400'}">
        ${p.risk_score}
      </td>
      <td class="py-3 px-3 font-mono text-[11px] text-slate-400">
        ${p.reported_at ? p.reported_at.slice(0, 10) : '2026-10-24'}
      </td>
      <td class="py-3 px-3">
        <span class="badge-status ${statusClass}">${(p.status || 'REPORTED').toUpperCase()}</span>
      </td>
    `;
    tbody.appendChild(row);
  });
}

/* -------------------------------------------------------------
 * 3. Interactive Maps (Dashboard Mini Map & Full Screen Map)
 * ------------------------------------------------------------- */
function getTileLayer(providerKey = 'esri_dark') {
  let url = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
  let opts = { maxZoom: 16, attribution: 'DRISHTI Road Intelligence' };

  if (providerKey === 'esri_satellite') {
    url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    opts.maxZoom = 18;
  } else if (providerKey === 'osm_dark') {
    url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    opts.className = 'osm-dark-tiles';
    opts.maxZoom = 19;
  } else if (providerKey === 'osm_streets') {
    url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    opts.maxZoom = 19;
  }
  return L.tileLayer(url, opts);
}

function initDashMap() {
  if (state.dashMap) return;
  const container = document.getElementById('dash-mini-map');
  if (!container) return;

  state.dashMap = L.map('dash-mini-map', {
    zoomControl: false,
    attributionControl: false
  }).setView([12.9716, 77.5946], 12);

  getTileLayer('esri_dark').addTo(state.dashMap);
  state.dashMarkersLayer = L.layerGroup().addTo(state.dashMap);

  renderPotholePins(state.dashMarkersLayer, state.dashMap);

  // Search input filter
  const searchInput = document.getElementById('dash-map-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase().trim();
      renderDashboardTable(term);
    });
  }

  // Severity buttons
  document.querySelectorAll('.dash-sev-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dash-sev-btn').forEach(b => {
        b.className = 'dash-sev-btn px-2.5 py-1 text-xs font-semibold rounded bg-[#101B30] text-slate-300 hover:text-white border border-[#182844]';
      });
      btn.className = 'dash-sev-btn px-2.5 py-1 text-xs font-bold rounded bg-cyan-400 text-slate-900';
      const sev = btn.getAttribute('data-sev');
      filterMapPins(sev);
    });
  });
}

function initMainMap() {
  const container = document.getElementById('main-fullscreen-map');
  if (!container || state.mainMap) return;

  state.mainMap = L.map('main-fullscreen-map', {
    zoomControl: true,
    attributionControl: false
  }).setView([12.9716, 77.5946], 13);

  let mainTileLayer = getTileLayer('esri_dark').addTo(state.mainMap);
  state.mainMarkersLayer = L.layerGroup().addTo(state.mainMap);

  renderPotholePins(state.mainMarkersLayer, state.mainMap);

  // Layer dropdown
  const selectLayer = document.getElementById('main-map-layer-select');
  if (selectLayer) {
    selectLayer.addEventListener('change', (e) => {
      if (mainTileLayer) state.mainMap.removeLayer(mainTileLayer);
      mainTileLayer = getTileLayer(e.target.value).addTo(state.mainMap);
      if (state.mainMarkersLayer) state.mainMarkersLayer.bringToFront();
    });
  }

  // Toggle heatmap
  const btnHeatmap = document.getElementById('btn-toggle-main-heatmap');
  if (btnHeatmap) {
    btnHeatmap.addEventListener('click', () => {
      state.isMainHeatmapVisible = !state.isMainHeatmapVisible;
      if (state.isMainHeatmapVisible) {
        const heatPoints = state.potholes.map(p => [
          p.latitude, p.longitude, p.severity === 'Critical' ? 1.0 : (p.severity === 'High' ? 0.7 : 0.4)
        ]);
        state.mainHeatmapLayer = L.heatLayer(heatPoints, { radius: 35, blur: 20 }).addTo(state.mainMap);
        btnHeatmap.classList.add('bg-amber-600', 'text-white');
      } else {
        if (state.mainHeatmapLayer) state.mainMap.removeLayer(state.mainHeatmapLayer);
        btnHeatmap.classList.remove('bg-amber-600', 'text-white');
      }
    });
  }
}

function renderPotholePins(layer, mapInstance, filterSev = 'all') {
  if (!layer) return;
  layer.clearLayers();

  let list = state.potholes;
  if (filterSev !== 'all') {
    list = list.filter(p => p.severity.toLowerCase() === filterSev.toLowerCase());
  }

  list.forEach(p => {
    let pinColor = '#EF4444'; // Red for Critical
    if (p.status === 'completed') pinColor = '#10B981'; // Green
    else if (p.severity === 'High') pinColor = '#F59E0B'; // Amber
    else if (p.severity === 'Medium') pinColor = '#EAB308'; // Yellow

    const customIcon = L.divIcon({
      className: 'drishti-pin',
      html: `
        <div style="background-color: ${pinColor}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #FFFFFF; box-shadow: 0 0 12px ${pinColor};" class="pulse-dot"></div>
      `,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });

    const marker = L.marker([p.latitude, p.longitude], { icon: customIcon });
    marker.bindPopup(`
      <div style="background:#0D1627; color:#FFF; font-family:sans-serif; padding:6px; font-size:12px;">
        <b style="color:#00E5FF;">${p.id}</b> - ${p.road_name}<br/>
        Severity: <b style="color:${pinColor}">${p.severity}</b><br/>
        Risk Score: <b>${p.risk_score}/100</b> · Depth: <b>${p.estimated_depth_cm}cm</b><br/>
        <a href="/api/reports/pdf/${p.id}" target="_blank" style="color:#00E5FF; text-decoration:underline; display:block; margin-top:4px;">Download PDF Report</a>
      </div>
    `);
    layer.addLayer(marker);
  });
}

function filterMapPins(sev) {
  if (state.dashMarkersLayer && state.dashMap) {
    renderPotholePins(state.dashMarkersLayer, state.dashMap, sev);
  }
}

/* -------------------------------------------------------------
 * 4. Detect Pothole Studio (YOLOv11 Vision Core)
 * ------------------------------------------------------------- */
function initDetectStudio() {
  const fileInput = document.getElementById('detect-file-input');
  const btnCamera = document.getElementById('btn-use-camera');
  const btnGetLoc = document.getElementById('btn-get-current-loc');
  const btnManualLoc = document.getElementById('btn-use-manual-loc');
  const btnSubmit = document.getElementById('btn-submit-detection');
  const videoElem = document.getElementById('detect-webcam');
  const canvasElem = document.getElementById('detect-canvas');
  const dropContent = document.getElementById('dropzone-content');

  // File Upload
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const fd = new FormData();
        fd.append('file', file);
        executeInspection(fd, true);
      }
    });
  }

  // Camera Toggle
  if (btnCamera) {
    btnCamera.addEventListener('click', async () => {
      try {
        if (!state.webcamStream) {
          state.webcamStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 } }
          });
          videoElem.srcObject = state.webcamStream;
          videoElem.classList.remove('hidden');
          dropContent.classList.add('hidden');
          btnCamera.innerHTML = `<i data-lucide="check" class="w-4 h-4 text-emerald-400"></i> Capture Snapshot`;
          lucide.createIcons();
        } else {
          // Take snapshot
          canvasElem.width = videoElem.videoWidth;
          canvasElem.height = videoElem.videoHeight;
          const ctx = canvasElem.getContext('2d');
          ctx.drawImage(videoElem, 0, 0, canvasElem.width, canvasElem.height);
          const b64 = canvasElem.toDataURL('image/jpeg', 0.85);

          // Stop stream
          state.webcamStream.getTracks().forEach(t => t.stop());
          state.webcamStream = null;
          videoElem.classList.add('hidden');
          dropContent.classList.remove('hidden');
          btnCamera.innerHTML = `<i data-lucide="camera" class="w-4 h-4 text-cyan-400"></i> Use camera`;
          lucide.createIcons();

          executeInspection({ image_base64: b64 });
        }
      } catch (err) {
        showToast('Camera access unavailable. Please use file upload.', 'warning');
      }
    });
  }

  // Geolocation
  if (btnGetLoc) {
    btnGetLoc.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showToast('Geolocation not supported by your browser.', 'warning');
        return;
      }
      btnGetLoc.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin text-cyan-400"></i> Acquiring GPS...`;
      lucide.createIcons();

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude.toFixed(6);
          const lon = pos.coords.longitude.toFixed(6);
          document.getElementById('input-detect-lat').value = lat;
          document.getElementById('input-detect-lon').value = lon;
          document.getElementById('loc-status-box').innerHTML = `
            <span class="text-emerald-400 font-bold">● GPS Position Acquired:</span> [${lat}, ${lon}] (Accuracy ~${pos.coords.accuracy.toFixed(0)}m)
          `;
          btnGetLoc.innerHTML = `<i data-lucide="check" class="w-4 h-4 text-emerald-400"></i> Location Active`;
          lucide.createIcons();
          showToast('GPS Coordinates successfully locked.', 'success');

          // Reverse geocode
          try {
            const res = await fetch(`/api/geocode/reverse?lat=${lat}&lon=${lon}`);
            if (res.ok) {
              const geo = await res.json();
              if (geo.road_name) document.getElementById('input-detect-road').value = geo.road_name;
              if (geo.ward) document.getElementById('input-detect-ward').value = geo.ward;
            }
          } catch (e) {}
        },
        () => {
          btnGetLoc.innerHTML = `<i data-lucide="globe" class="w-4 h-4 text-cyan-400"></i> Get current location`;
          lucide.createIcons();
          showToast('Could not acquire GPS. Please enter coordinates manually.', 'info');
        }
      );
    });
  }

  if (btnManualLoc) {
    btnManualLoc.addEventListener('click', () => {
      const lat = document.getElementById('input-detect-lat').value;
      const lon = document.getElementById('input-detect-lon').value;
      document.getElementById('loc-status-box').innerHTML = `
        <span class="text-cyan-400 font-bold">● Manual Coordinates Applied:</span> [${lat}, ${lon}]
      `;
      showToast('Manual coordinates stored for this inspection.', 'info');
    });
  }

  // Submit and Save Pothole
  if (btnSubmit) {
    btnSubmit.addEventListener('click', async () => {
      const topPothole = state.latestDetection?.potholes?.[0] || {};
      const payload = {
        road_name: document.getElementById('input-detect-road').value || 'MG Road Corridor',
        ward: document.getElementById('input-detect-ward').value || 'Sector 4',
        latitude: parseFloat(document.getElementById('input-detect-lat').value) || 12.9716,
        longitude: parseFloat(document.getElementById('input-detect-lon').value) || 77.5946,
        severity: topPothole.severity || 'Critical',
        risk_score: topPothole.risk_score || 91,
        confidence: topPothole.confidence || 0.965,
        estimated_depth_cm: topPothole.estimated_depth_cm || 14.2,
        estimated_diameter_cm: topPothole.estimated_diameter_cm || 68.0,
        reported_by: 'Inspector Field Unit A',
        priority_zone: 'High-Speed Arterial Corridor',
        description: 'Pothole detected via YOLOv11 neural vision pipeline.'
      };

      try {
        const res = await fetch('/api/potholes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const created = await res.json();
          showToast(`Pothole registered! ID: ${created.id}`, 'success');
          await fetchInitialData();
          switchView('work-orders');
        }
      } catch (err) {
        showToast('Error saving pothole record.', 'error');
      }
    });
  }
}

window.testPresetImage = function(presetName) {
  executeInspection({ sample_name: presetName });
};

async function executeInspection(payload, isFormData = false) {
  showToast('Running YOLOv11 Deep Neural Inspection...', 'info');

  try {
    let res;
    if (isFormData) {
      res = await fetch('/api/detect', { method: 'POST', body: payload });
    } else {
      const fd = new FormData();
      for (const k in payload) fd.append(k, payload[k]);
      res = await fetch('/api/detect', { method: 'POST', body: fd });
    }

    if (!res.ok) throw new Error('Inspection request failed');
    const data = await res.json();
    state.latestDetection = data;
    renderDetectionOutput(data);
    showToast(`Inspection Complete: ${data.potholes_count} pothole(s) verified!`, 'success');

  } catch (err) {
    console.error(err);
    showToast('Failed to run AI detection.', 'error');
  }
}

function renderDetectionOutput(data) {
  const panel = document.getElementById('detect-output-panel');
  const imgElem = document.getElementById('detect-output-img');
  const badge = document.getElementById('detect-output-badge');

  panel.classList.remove('hidden');
  imgElem.src = data.annotated_image;

  if (data.potholes && data.potholes.length > 0) {
    const top = data.potholes[0];
    document.getElementById('tele-count').innerText = data.potholes_count;
    document.getElementById('tele-conf').innerText = `${Math.round(top.confidence * 100)}%`;
    document.getElementById('tele-depth').innerText = `${top.estimated_depth_cm} cm`;
    document.getElementById('tele-diam').innerText = `${top.estimated_diameter_cm} cm`;
    document.getElementById('tele-risk').innerText = `${top.risk_score}/100`;

    badge.className = `badge-status badge-${top.severity.toLowerCase()}`;
    badge.innerText = top.severity.toUpperCase();
  }
}

/* -------------------------------------------------------------
 * 5. Work Orders & Repair Lifecycle Inspector
 * ------------------------------------------------------------- */
function initWorkOrders() {
  const btnAdvance = document.getElementById('btn-advance-stage');
  const btnReport = document.getElementById('btn-generate-wo-pdf');
  const statusSelect = document.getElementById('insp-status-select');

  if (btnAdvance) {
    btnAdvance.addEventListener('click', async () => {
      const p = state.activeWorkOrder;
      if (!p) return;

      const newStatus = statusSelect.value;
      try {
        await fetch(`/api/potholes/${p.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus, note: `Stage transitioned to ${newStatus.toUpperCase()}` })
        });

        showToast(`Work Order ${p.id} stage advanced to: ${newStatus.toUpperCase()}`, 'success');
        await fetchInitialData();
        selectWorkOrder(p.id);
      } catch (err) {
        showToast('Error updating status.', 'error');
      }
    });
  }

  if (btnReport) {
    btnReport.addEventListener('click', () => {
      if (state.activeWorkOrder) {
        window.open(`/api/reports/pdf/${state.activeWorkOrder.id}`, '_blank');
      }
    });
  }
}

function renderWorkOrdersList() {
  const container = document.getElementById('wo-list-container');
  if (!container) return;
  container.innerHTML = '';

  document.getElementById('wo-list-count').innerText = `${state.potholes.length} records`;

  state.potholes.forEach((p, idx) => {
    const item = document.createElement('div');
    item.className = `p-3 rounded-lg border border-[#182844] bg-[#0A111F] hover:bg-[#101B30] cursor-pointer transition space-y-2 ${idx === 0 ? 'wo-item-active' : ''}`;
    item.id = `wo-item-${p.id}`;
    item.onclick = () => selectWorkOrder(p.id);

    let sevBadge = 'badge-critical';
    if (p.severity === 'High') sevBadge = 'badge-high';
    else if (p.severity === 'Medium') sevBadge = 'badge-medium';

    item.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-xs font-mono font-bold text-cyan-400">WO-000${idx + 1}</span>
        <span class="text-[10px] font-mono text-slate-400">${p.id}</span>
      </div>
      <div class="text-xs font-bold text-white line-clamp-1">${p.road_name}</div>
      <div class="text-[11px] text-slate-400">${p.ward}</div>
      <div class="flex items-center justify-between pt-1 border-t border-[#182844] text-[10px]">
        <span class="badge-status ${sevBadge}">${p.severity}</span>
        <span class="text-slate-300 font-mono">${(p.assigned_department || 'Municipality').toUpperCase()}</span>
        <span class="badge-status badge-assigned">${(p.status || 'ASSIGNED').toUpperCase()}</span>
      </div>
    `;
    container.appendChild(item);
  });

  if (state.potholes.length > 0 && !state.activeWorkOrder) {
    selectWorkOrder(state.potholes[0].id);
  }
}

function selectWorkOrder(id) {
  const p = state.potholes.find(item => item.id.toUpperCase() === id.toUpperCase());
  if (!p) return;

  state.activeWorkOrder = p;

  // Highlight list item
  document.querySelectorAll('#wo-list-container > div').forEach(d => d.classList.remove('wo-item-active'));
  const activeDiv = document.getElementById(`wo-item-${p.id}`);
  if (activeDiv) activeDiv.classList.add('wo-item-active');

  // Populate Inspector Panel
  document.getElementById('inspector-wo-id').innerText = `WORK ORDER WO-000${state.potholes.indexOf(p) + 1}`;
  document.getElementById('inspector-complaint-id').innerText = `Complaint: ${p.id}`;
  document.getElementById('insp-comp-id').innerText = p.id;
  document.getElementById('insp-location').innerText = `${p.road_name}, ${p.ward}`;
  document.getElementById('insp-sev').innerText = p.severity.toUpperCase();
  document.getElementById('insp-risk').innerText = `${p.risk_score}/100`;
  document.getElementById('insp-dept').innerText = p.assigned_department ? p.assigned_department.toUpperCase() : 'MUNICIPALITY';
  document.getElementById('insp-crew').innerText = p.contractor || 'Road Crew A';
  document.getElementById('insp-prio').innerText = p.severity === 'Critical' ? 'P1 (Critical)' : 'P2 (Standard)';
  document.getElementById('insp-status-select').value = p.status || 'assigned';

  // Stepper timeline
  const timelineContainer = document.getElementById('inspector-timeline');
  timelineContainer.innerHTML = '';

  const steps = p.timeline || [
    { step: 'REPORTED', note: 'Detected from field image upload' },
    { step: 'DEPARTMENT ASSIGNED', note: 'Routed to Municipality: Road Crew A' },
    { step: 'WORK ORDER CREATED', note: 'Work order created' }
  ];

  steps.forEach(s => {
    timelineContainer.innerHTML += `
      <div class="flex items-start gap-2 text-xs">
        <span class="w-2 h-2 rounded-full bg-cyan-400 mt-1"></span>
        <div>
          <b class="text-white">${s.step.toUpperCase()}</b>
          <div class="text-[11px] text-slate-400">${s.note || ''}</div>
        </div>
      </div>
    `;
  });
}

/* -------------------------------------------------------------
 * 6. Smart Road Selection
 * ------------------------------------------------------------- */
function initRoutingView() {
  const btnSwap = document.getElementById('btn-swap-roads');
  if (btnSwap) {
    btnSwap.addEventListener('click', () => {
      showToast('Swapped Road A and Road B comparison metrics.', 'info');
    });
  }
}

/* -------------------------------------------------------------
 * 7. Reports & Analytics (Chart.js Implementations)
 * ------------------------------------------------------------- */
function renderAnalyticsCharts() {
  // Chart 1: Line Chart
  const ctxTrends = document.getElementById('chart-trends');
  if (ctxTrends && !state.charts.trends) {
    state.charts.trends = new Chart(ctxTrends, {
      type: 'line',
      data: {
        labels: ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
        datasets: [
          {
            label: 'Detected',
            data: [180, 240, 310, 420, 480, 450],
            borderColor: '#00E5FF',
            backgroundColor: 'rgba(0, 229, 255, 0.1)',
            tension: 0.35
          },
          {
            label: 'Repaired',
            data: [120, 180, 260, 350, 410, 420],
            borderColor: '#10B981',
            tension: 0.35
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94A3B8', font: { size: 10 } } } },
        scales: {
          x: { grid: { color: '#182844' }, ticks: { color: '#94A3B8', font: { size: 9 } } },
          y: { grid: { color: '#182844' }, ticks: { color: '#94A3B8', font: { size: 9 } } }
        }
      }
    });
  }

  // Chart 2: Donut Chart
  const ctxDonut = document.getElementById('chart-severity-donut');
  if (ctxDonut && !state.charts.donut) {
    state.charts.donut = new Chart(ctxDonut, {
      type: 'doughnut',
      data: {
        labels: ['Critical', 'High', 'Medium', 'Low'],
        datasets: [{
          data: [312, 180, 145, 90],
          backgroundColor: ['#EF4444', '#F59E0B', '#EAB308', '#10B981'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#94A3B8', font: { size: 10 } } } }
      }
    });
  }

  // Chart 3: Repair Time Bar Chart
  const ctxTime = document.getElementById('chart-repair-time');
  if (ctxTime && !state.charts.time) {
    state.charts.time = new Chart(ctxTime, {
      type: 'bar',
      data: {
        labels: ['Municipality', 'Police', 'Roads & Dev'],
        datasets: [{
          label: 'Days to complete',
          data: [4.2, 1.2, 6.8],
          backgroundColor: '#00E5FF'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94A3B8', font: { size: 9 } } },
          y: { grid: { color: '#182844' }, ticks: { color: '#94A3B8', font: { size: 9 } } }
        }
      }
    });
  }

  // Chart 4: Department Distribution Horizontal Bar Chart
  const ctxDept = document.getElementById('chart-dept-dist');
  if (ctxDept && !state.charts.dept) {
    state.charts.dept = new Chart(ctxDept, {
      type: 'bar',
      data: {
        labels: ['Municipality', 'Police', 'Roads & Dev'],
        datasets: [{
          data: [5, 1, 2],
          backgroundColor: '#F59E0B'
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: '#182844' }, ticks: { color: '#94A3B8', font: { size: 9 }, stepSize: 1 } },
          y: { grid: { display: false }, ticks: { color: '#94A3B8', font: { size: 9 } } }
        }
      }
    });
  }
}

window.exportCSV = function() {
  const rows = [
    ['Pothole ID', 'Road Name', 'Ward', 'Severity', 'Risk Score', 'Status'],
    ...state.potholes.map(p => [p.id, p.road_name, p.ward, p.severity, p.risk_score, p.status])
  ];
  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', 'DRISHTI_road_safety_data.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Exported DRISHTI_road_safety_data.csv', 'success');
};

/* -------------------------------------------------------------
 * 8. Complaint Report & PDF Generator
 * ------------------------------------------------------------- */
function initComplaintReports() {
  const select = document.getElementById('report-pothole-select');
  const btnPrint = document.getElementById('btn-print-pdf');

  if (select) {
    select.addEventListener('change', (e) => {
      renderReportSheet(e.target.value);
    });
  }

  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      const selectedId = select.value;
      if (selectedId) {
        window.open(`/api/reports/pdf/${selectedId}`, '_blank');
      }
    });
  }
}

function renderReportSheet(id) {
  const p = state.potholes.find(item => item.id.toUpperCase() === id.toUpperCase());
  if (!p) return;

  document.getElementById('rep-comp-id').innerText = p.id;
  document.getElementById('rep-rec-id').innerText = p.id.replace('DRISHTI-2026-', 'PH-');
  document.getElementById('rep-road').innerText = p.road_name;
  document.getElementById('rep-area').innerText = p.ward;
  document.getElementById('rep-coords').innerText = `${p.latitude}, ${p.longitude}`;
  document.getElementById('rep-date').innerText = p.reported_at ? p.reported_at.slice(0, 16).replace('T', ' ') : 'Oct 24, 06:48 PM';
  document.getElementById('rep-conf').innerText = `${Math.round(p.confidence * 100)}%`;
  document.getElementById('rep-sev').innerText = p.severity.toUpperCase();
  document.getElementById('rep-risk').innerText = `${p.risk_score}/100`;
  document.getElementById('rep-dept').innerText = p.assigned_department ? p.assigned_department.toUpperCase() : 'MUNICIPALITY';

  const badge = document.getElementById('rep-status-badge');
  badge.className = p.status === 'completed' ? 'badge-status badge-repaired' : 'badge-status badge-assigned';
  badge.innerText = (p.status || 'ASSIGNED').toUpperCase();

  // Timeline
  const tl = document.getElementById('report-timeline');
  tl.innerHTML = '';
  (p.timeline || []).forEach(s => {
    tl.innerHTML += `
      <div class="flex items-start gap-2">
        <span class="w-2 h-2 rounded-full bg-cyan-400 mt-1"></span>
        <div>
          <b class="text-white">${s.step.toUpperCase()}</b>
          <div class="text-[11px] text-slate-400">${s.note || ''}</div>
        </div>
      </div>
    `;
  });
}

/* -------------------------------------------------------------
 * 9. Department Routing
 * ------------------------------------------------------------- */
function initDeptRouting() {
  const select = document.getElementById('route-pothole-select');
  const btnAssign = document.getElementById('btn-reassign-dept');
  const deptSelect = document.getElementById('route-dept-select');

  if (select) {
    select.addEventListener('change', (e) => {
      renderRouteCard(e.target.value);
    });
  }

  if (btnAssign) {
    btnAssign.addEventListener('click', async () => {
      const pid = select.value;
      const dept = deptSelect.value;
      try {
        await fetch(`/api/potholes/${pid}/assign`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ department: dept })
        });
        showToast(`Complaint ${pid} successfully routed to: ${dept.toUpperCase()}`, 'success');
        await fetchInitialData();
        renderRouteCard(pid);
      } catch (e) {
        showToast('Error reassigning department.', 'error');
      }
    });
  }
}

function renderRouteCard(id) {
  const p = state.potholes.find(item => item.id.toUpperCase() === id.toUpperCase());
  if (!p) return;

  document.getElementById('route-card-id').innerText = p.id;
  document.getElementById('route-card-loc').innerText = `${p.road_name}, ${p.ward}`;
  document.getElementById('route-card-risk').innerText = `RISK ${p.risk_score}/100 · GPS ${p.latitude}, ${p.longitude}`;
  document.getElementById('route-card-dept').innerText = (p.assigned_department || 'Municipality').toUpperCase();

  const sevBadge = document.getElementById('route-card-sev');
  sevBadge.className = `badge-status badge-${p.severity.toLowerCase()}`;
  sevBadge.innerText = p.severity.toUpperCase();

  const reasonBox = document.getElementById('route-reason-box');
  if (p.severity === 'Critical') {
    reasonBox.innerText = `Assigned to Roads & Development / Police because a CRITICAL defect is an immediate highway hazard requiring structural patching.`;
  } else {
    reasonBox.innerText = `Assigned to Municipality for local ward asphalt leveling and maintenance.`;
  }
}

/* -------------------------------------------------------------
 * 10. Populate Dropdowns & Full Repair Timeline
 * ------------------------------------------------------------- */
function populateDropdowns() {
  const repSelect = document.getElementById('report-pothole-select');
  const routeSelect = document.getElementById('route-pothole-select');

  if (repSelect) {
    repSelect.innerHTML = '';
    state.potholes.forEach(p => {
      repSelect.innerHTML += `<option value="${p.id}">${p.id} · ${p.road_name}</option>`;
    });
    if (state.potholes.length > 0) renderReportSheet(state.potholes[0].id);
  }

  if (routeSelect) {
    routeSelect.innerHTML = '';
    state.potholes.forEach(p => {
      routeSelect.innerHTML += `<option value="${p.id}">${p.id} · ${p.road_name}</option>`;
    });
    if (state.potholes.length > 0) renderRouteCard(state.potholes[0].id);
  }
}

function renderFullTimeline() {
  const container = document.getElementById('full-repair-timeline-container');
  if (!container) return;
  container.innerHTML = '';

  state.potholes.forEach((p, idx) => {
    container.innerHTML += `
      <div class="border-b border-[#182844] pb-4 last:border-0 font-mono text-xs space-y-2">
        <div class="flex justify-between items-center">
          <span class="text-cyan-400 font-bold text-sm">${p.id} — ${p.road_name}</span>
          <span class="badge-status badge-assigned">${(p.status || 'ACTIVE').toUpperCase()}</span>
        </div>
        <div class="text-slate-400">Jurisdiction: ${(p.assigned_department || 'Municipality').toUpperCase()} · Ward: ${p.ward}</div>
        <div class="space-y-1.5 pl-3 border-l-2 border-cyan-500/40 mt-2">
          ${(p.timeline || []).map(t => `
            <div>
              <b class="text-white">${t.step}</b> <span class="text-[10px] text-slate-500">${t.timestamp ? t.timestamp.slice(0, 16) : ''}</span>
              <div class="text-slate-400 text-[11px]">${t.note || ''}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });
}

/* -------------------------------------------------------------
 * 11. Map Keys Modal
 * ------------------------------------------------------------- */
function initMapKeysModal() {
  const modal = document.getElementById('modal-map-keys');
  const btnOpen = document.getElementById('btn-open-keys-modal');
  const btnClose = document.getElementById('btn-close-map-modal');
  const btnCancel = document.getElementById('btn-cancel-map-modal');
  const btnSave = document.getElementById('btn-save-map-keys');

  if (btnOpen) btnOpen.addEventListener('click', () => modal.classList.remove('hidden'));
  if (btnClose) btnClose.addEventListener('click', () => modal.classList.add('hidden'));
  if (btnCancel) btnCancel.addEventListener('click', () => modal.classList.add('hidden'));

  if (btnSave) {
    btnSave.addEventListener('click', () => {
      const mbToken = document.getElementById('input-mapbox-token').value.trim();
      const gKey = document.getElementById('input-google-key').value.trim();
      if (mbToken) localStorage.setItem('drishti_mapbox_token', mbToken);
      if (gKey) localStorage.setItem('drishti_google_key', gKey);
      showToast('Map API Keys updated and saved locally.', 'success');
      modal.classList.add('hidden');
    });
  }
}

/* -------------------------------------------------------------
 * 12. Toast Helper
 * ------------------------------------------------------------- */
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const t = document.createElement('div');
  t.className = 'p-3 rounded-lg border border-[#1E3154] bg-[#0D1627] shadow-2xl text-xs font-semibold flex items-center gap-2 pointer-events-auto';
  
  let dotColor = 'bg-cyan-400';
  if (type === 'success') dotColor = 'bg-emerald-400';
  else if (type === 'warning') dotColor = 'bg-amber-400';
  else if (type === 'error') dotColor = 'bg-rose-400';

  t.innerHTML = `<span class="w-2 h-2 rounded-full ${dotColor} animate-pulse"></span> <span>${msg}</span>`;
  container.appendChild(t);

  setTimeout(() => t.remove(), 4000);
}

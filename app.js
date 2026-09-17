// app.js — Логика интерактивной карты, маршрутов и совместных точек друзей

// Глобальные переменные карты и состояния
let map;
let routeLayers = [];
let markerLayers = [];
let communityMarkerLayers = [];
let currentActiveDay = 'all';
let selectedLatLngForNewPin = null;

// Хранилище точек друзей и инстанс Firebase Realtime DB
let communityPoints = [];
let firebaseDb = null;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
  checkAuthGate();
  initMap();
  await loadCommunityPoints();
  renderDaysNavigation();
  renderTimeline();
  setupEventListeners();
  renderCommunityList();
  updateStats();
});

// 1. Инициализация карты Leaflet
function initMap() {
  // Центр между Карагандой и Иссык-Кулем
  map = L.map('map', {
    zoomControl: false
  }).setView([45.5, 76.5], 6);

  // Контрол зума в правом верхнем углу
  L.control.zoom({ position: 'topright' }).addTo(map);

  // Красивые и четкие тайлы CartoDB Voyager
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  // Отрисовка всех дней маршрута
  renderAllRoutes();

  // Клик по карте для добавления пользовательской точки
  map.on('click', (e) => {
    if (isPlacementModeActive) {
      moveTempMarker(e.latlng);
    } else {
      startPinPlacementMode(e.latlng, true);
    }
  });
}

// 2. Отрисовка линий маршрутов и маркеров остановок
function renderAllRoutes() {
  clearMapLayers();

  const allBounds = L.latLngBounds();

  TRIP_DATA.days.forEach(day => {
    // Линия маршрута
    const polyline = L.polyline(day.route_points, {
      color: day.color,
      weight: 5,
      opacity: 0.85,
      lineJoin: 'round'
    }).addTo(map);

    polyline.bindTooltip(`<b>День ${day.day}</b>: ${day.title} (${day.distance_km} км)`, {
      sticky: true
    });

    polyline.on('click', (e) => {
      if (isPlacementModeActive) {
        moveTempMarker(e.latlng);
      } else {
        selectDay(day.day);
      }
    });

    routeLayers.push({ day: day.day, polyline: polyline, color: day.color });
    day.route_points.forEach(pt => allBounds.extend(pt));

    // Маркеры остановок
    day.stops.forEach(stop => {
      const icon = createMarkerIcon(stop.type, day.day);
      const marker = L.marker(stop.coord, { icon: icon }).addTo(map);

      const popupHtml = `
        <div class="p-1 max-w-xs font-sans text-slate-100">
          <div class="flex items-center space-x-1.5 mb-1.5">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase" style="background-color: ${day.color}">День ${day.day}</span>
            <span class="text-xs font-bold text-white">${escapeHtml(stop.name)}</span>
          </div>
          <p class="text-xs text-slate-300 mb-2 leading-relaxed">${escapeHtml(stop.note || '')}</p>
          <div class="flex items-center justify-between pt-1.5 border-t border-slate-800 text-[11px]">
            <span class="text-slate-400">${day.distance_km} км в пути</span>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${stop.coord[0]},${stop.coord[1]}" 
               target="_blank" class="text-blue-400 hover:text-blue-300 hover:underline font-semibold flex items-center space-x-1">
               <span>Навигатор</span>
               <span>➔</span>
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.coord = stop.coord;
      markerLayers.push({ day: day.day, marker: marker });
    });
  });

  // Отрисовка точек друзей
  renderCommunityMarkersOnMap();

  // Автоматический охват всего пути
  if (allBounds.isValid()) {
    map.fitBounds(allBounds, { padding: [40, 40] });
  }
}

// Создание стилизованных иконок Leaflet
function createMarkerIcon(type, dayNum) {
  let emoji = '📍';
  let bgClass = 'bg-blue-600';

  switch (type) {
    case 'start': emoji = '🏁'; bgClass = 'bg-emerald-600'; break;
    case 'finish': emoji = '🏆'; bgClass = 'bg-emerald-600'; break;
    case 'hotel': emoji = '🏨'; bgClass = 'bg-indigo-600'; break;
    case 'mountain': emoji = '🏔️'; bgClass = 'bg-sky-600'; break;
    case 'lake': emoji = '🌊'; bgClass = 'bg-cyan-600'; break;
    case 'canyon': emoji = '🏜️'; bgClass = 'bg-amber-600'; break;
    case 'border': emoji = '🛂'; bgClass = 'bg-rose-600'; break;
    case 'food': emoji = '🍽️'; bgClass = 'bg-orange-600'; break;
    case 'culture': emoji = '🏛️'; bgClass = 'bg-purple-600'; break;
    case 'waterfall': emoji = '💦'; bgClass = 'bg-teal-600'; break;
    case 'relax': emoji = '♨️'; bgClass = 'bg-pink-600'; break;
    case 'viewpoint': emoji = '📸'; bgClass = 'bg-amber-500'; break;
    default: emoji = '🚗'; bgClass = 'bg-blue-600';
  }

  return L.divIcon({
    className: 'custom-map-icon',
    html: `
      <div class="w-8 h-8 rounded-full ${bgClass} text-white shadow-lg flex items-center justify-center border-2 border-white transform hover:scale-125 transition-transform duration-200 cursor-pointer text-sm">
        ${emoji}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18]
  });
}

function createCommunityIcon(category, author) {
  let emoji = '💡';
  switch (category) {
    case 'food': emoji = '🍽️'; break;
    case 'photo': emoji = '📸'; break;
    case 'hotel': emoji = '🏕️'; break;
    case 'tip': emoji = '⚠️'; break;
    case 'spot': emoji = '🎯'; break;
  }

  return L.divIcon({
    className: 'community-pulse-icon',
    html: `
      <div class="relative flex items-center justify-center">
        <div class="absolute w-10 h-10 rounded-full bg-amber-400 opacity-40 animate-ping"></div>
        <div class="w-9 h-9 rounded-full bg-amber-500 text-white shadow-xl flex items-center justify-center border-2 border-white transform hover:scale-125 transition-transform duration-200 cursor-pointer text-base z-10">
          ${emoji}
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20]
  });
}

// 3. Выбор конкретного дня маршрута
function selectDay(dayId) {
  currentActiveDay = dayId;
  updateDayFilterButtons();

  if (dayId === 'all') {
    renderAllRoutes();
    document.querySelectorAll('.day-card').forEach(el => el.classList.remove('ring-2', 'ring-blue-500'));
    return;
  }

  const selectedDayData = TRIP_DATA.days.find(d => d.day === parseInt(dayId));
  if (!selectedDayData) return;

  const dayBounds = L.latLngBounds();

  // Подсветка треков
  routeLayers.forEach(rl => {
    if (rl.day === parseInt(dayId)) {
      rl.polyline.setStyle({ opacity: 1.0, weight: 7 });
      rl.polyline.bringToFront();
    } else {
      rl.polyline.setStyle({ opacity: 0.15, weight: 3 });
    }
  });

  // Подсветка маркеров
  markerLayers.forEach(ml => {
    if (ml.day === parseInt(dayId)) {
      ml.marker.setOpacity(1.0);
    } else {
      ml.marker.setOpacity(0.25);
    }
  });

  selectedDayData.route_points.forEach(pt => dayBounds.extend(pt));
  if (dayBounds.isValid()) {
    map.fitBounds(dayBounds, { padding: [50, 50] });
  }

  // Скролл карточки дня в боковой панели
  const targetCard = document.getElementById(`day-card-${dayId}`);
  if (targetCard) {
    document.querySelectorAll('.day-card').forEach(el => el.classList.remove('ring-2', 'ring-blue-500'));
    targetCard.classList.add('ring-2', 'ring-blue-500');
    targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// 4. Отрисовка навигации по дням
function renderDaysNavigation() {
  const container = document.getElementById('dayFilterChips');
  if (!container) return;

  let html = `
    <button onclick="selectDay('all')" id="btn-day-all" class="day-filter-btn px-3 py-1.5 text-xs font-semibold rounded-full bg-slate-800 text-white hover:bg-blue-600 transition whitespace-nowrap active-day">
      🌍 Весь маршрут
    </button>
  `;

  TRIP_DATA.days.forEach(d => {
    html += `
      <button onclick="selectDay(${d.day})" id="btn-day-${d.day}" class="day-filter-btn px-3 py-1.5 text-xs font-semibold rounded-full bg-slate-800 text-slate-300 hover:bg-blue-600 hover:text-white transition whitespace-nowrap">
        День ${d.day}
      </button>
    `;
  });

  container.innerHTML = html;
}

function updateDayFilterButtons() {
  document.querySelectorAll('.day-filter-btn').forEach(btn => {
    btn.classList.remove('bg-blue-600', 'text-white');
    btn.classList.add('bg-slate-800', 'text-slate-300');
  });

  const activeBtn = document.getElementById(`btn-day-${currentActiveDay}`);
  if (activeBtn) {
    activeBtn.classList.remove('bg-slate-800', 'text-slate-300');
    activeBtn.classList.add('bg-blue-600', 'text-white');
  }
}

// 5. Отрисовка таймлайна (карточек по дням)
function renderTimeline() {
  const container = document.getElementById('timelineCards');
  if (!container) return;

  let html = '';
  TRIP_DATA.days.forEach(d => {
    // Google Maps URL для навигации этого дня
    const startPt = d.start_coord.join(',');
    const endPt = d.end_coord.join(',');
    const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${startPt}&destination=${endPt}`;

    html += `
      <div id="day-card-${d.day}" class="day-card bg-slate-900/90 rounded-2xl border border-slate-800 p-4 transition-all duration-300 hover:border-slate-700 shadow-lg mb-4">
        
        <!-- Заголовок дня -->
        <div class="flex items-center justify-between mb-2 cursor-pointer" onclick="selectDay(${d.day})">
          <div class="flex items-center space-x-2">
            <span class="px-2.5 py-1 rounded-lg text-xs font-bold text-white font-mono" style="background-color: ${d.color}">
              День ${d.day}
            </span>
            <h3 class="text-sm font-bold text-white">${d.title}</h3>
          </div>
          <span class="text-xs font-medium text-slate-400">${d.distance_km} км</span>
        </div>

        <!-- Описание и состояние дороги -->
        <p class="text-xs text-slate-300 mb-2.5">${d.description}</p>

        <div class="bg-slate-950/60 rounded-xl p-2.5 mb-3 border border-slate-800/80 text-[11px] space-y-1">
          <div class="text-slate-400">⏱️ Время в пути: <span class="text-slate-200 font-medium">${d.drive_time}</span></div>
          <div class="text-slate-400">🛣️ Дорога: <span class="text-slate-300">${d.road_condition}</span></div>
          <div class="text-slate-400">💡 Совет: <span class="text-amber-300">${d.tips}</span></div>
        </div>

        <!-- Ключевые точки дня -->
        <div class="mb-3">
          <span class="text-[11px] font-semibold text-slate-400 block mb-1">Остановки и локации:</span>
          <div class="flex flex-wrap gap-1.5">
            ${d.stops.map(s => `
              <span onclick="focusPoint([${s.coord.join(',')}], '${s.name}')" class="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] cursor-pointer transition flex items-center space-x-1">
                <span>📍</span>
                <span>${s.name}</span>
              </span>
            `).join('')}
          </div>
        </div>

        <!-- Кнопки действий -->
        <div class="flex items-center justify-between pt-2 border-t border-slate-800/80">
          <button onclick="selectDay(${d.day})" class="text-xs font-semibold text-blue-400 hover:text-blue-300 transition">
            Показать на карте ➔
          </button>
          <a href="${gmapsUrl}" target="_blank" class="px-2.5 py-1 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white text-xs font-medium border border-blue-500/30 transition flex items-center space-x-1">
            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>
            <span>Google Карты</span>
          </a>
        </div>

      </div>
    `;
  });

  container.innerHTML = html;
}

// 6. Управление точками от друзей (Community POIs)
function initFirebaseIfAvailable() {
  if (typeof firebase !== 'undefined' && typeof isFirebaseConfigured === 'function' && isFirebaseConfigured()) {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      firebaseDb = firebase.database();
      console.log('✅ Firebase Realtime Database успешно подключен!');
      return true;
    } catch (e) {
      console.warn('⚠️ Ошибка инициализации Firebase:', e);
      return false;
    }
  }
  return false;
}

async function loadCommunityPoints() {
  // 1. Попытка подключения к облачной базе Firebase Realtime Database
  if (initFirebaseIfAvailable() && firebaseDb) {
    const pointsRef = firebaseDb.ref('community_points');

    // Подписка на живые обновления (WebSockets): мгновенное появление меток друзей на карте!
    pointsRef.on('value', (snapshot) => {
      const val = snapshot.val();
      if (val) {
        if (Array.isArray(val)) {
          communityPoints = val.filter(Boolean);
        } else {
          communityPoints = Object.values(val);
        }
      } else {
        communityPoints = [];
      }
      localStorage.setItem('tianshan_community_points', JSON.stringify(communityPoints));
      renderCommunityMarkersOnMap();
      renderCommunityList();
      updateStats();
    });
    return;
  }

  // 2. Попытка загрузить свежие точки с локального Python-сервера (server.py)
  try {
    const res = await fetch('/api/points', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        communityPoints = data;
        localStorage.setItem('tianshan_community_points', JSON.stringify(communityPoints));
        renderCommunityMarkersOnMap();
        renderCommunityList();
        updateStats();
        return;
      }
    }
  } catch (e) {
    // Сервер не запущен — штатный переход на локальное хранилище
  }

  // 3. Резервный источник: localStorage браузера
  const local = localStorage.getItem('tianshan_community_points');
  if (local) {
    try {
      communityPoints = JSON.parse(local);
    } catch (e) {
      communityPoints = [];
    }
  } else {
    communityPoints = [];
  }
  renderCommunityMarkersOnMap();
  renderCommunityList();
  updateStats();
}

async function saveCommunityPoints() {
  localStorage.setItem('tianshan_community_points', JSON.stringify(communityPoints));
  updateStats();
}

function renderCommunityMarkersOnMap() {
  communityMarkerLayers.forEach(l => map.removeLayer(l));
  communityMarkerLayers = [];

  communityPoints.forEach(p => {
    const icon = createCommunityIcon(p.category, p.author);
    const marker = L.marker([p.lat, p.lng], { icon: icon }).addTo(map);
    marker.pointId = p.id;

    const popupHtml = `
      <div class="p-1 max-w-xs font-sans text-slate-100">
        <div class="flex items-center space-x-1.5 mb-1.5">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold text-white bg-amber-500 uppercase">💡 Идея от ${escapeHtml(p.author || 'Друг')}</span>
          <span class="text-xs font-bold text-white">${escapeHtml(p.title)}</span>
        </div>
        <p class="text-xs text-slate-300 mb-2.5 leading-relaxed">${escapeHtml(p.note || '')}</p>
        <div class="flex items-center justify-between pt-1.5 border-t border-slate-800 text-xs">
          <button onclick="likePoint('${p.id}')" class="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold border border-amber-500/30 flex items-center space-x-1 transition">
            <span>👍 Хочу сюда!</span>
            <span id="like-count-${p.id}" class="font-bold ml-1">${p.likes || 0}</span>
          </button>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}" target="_blank" class="text-blue-400 hover:text-blue-300 hover:underline font-semibold text-[11px] flex items-center space-x-1">
            <span>Навигатор ➔</span>
          </a>
        </div>
      </div>
    `;

    marker.bindPopup(popupHtml);
    communityMarkerLayers.push(marker);
  });
}

function renderCommunityList() {
  const container = document.getElementById('communityPointsList');
  if (!container) return;

  if (communityPoints.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 text-slate-400 text-xs">
        <p class="mb-2.5">Пока нет предложений от друзей.</p>
        <button onclick="startPinPlacementMode()" class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition inline-flex items-center space-x-1.5">
          <span>💡</span>
          <span>Поставить точку на карте</span>
        </button>
      </div>
    `;
    return;
  }

  // Сортировка по количеству лайков
  const sorted = [...communityPoints].sort((a, b) => (b.likes || 0) - (a.likes || 0));

  let html = '';
  sorted.forEach(p => {
    let catBadge = '🎯 Место';
    if (p.category === 'food') catBadge = '🍽️ Еда/Кафе';
    else if (p.category === 'photo') catBadge = '📸 Смотровая';
    else if (p.category === 'hotel') catBadge = '🏕️ Ночлег';
    else if (p.category === 'tip') catBadge = '⚠️ Совет';
    else if (p.category === 'spot') catBadge = '📍 Локация';

    html += `
      <div class="bg-slate-900/90 rounded-2xl border border-amber-500/30 p-3.5 mb-3 shadow-lg hover:border-amber-500/60 transition">
        <div class="flex items-center justify-between mb-1.5">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold text-amber-300 bg-amber-950/80 border border-amber-500/40">
            ${catBadge}
          </span>
          <span class="text-[11px] text-slate-400">Предложил: <b class="text-slate-200">${escapeHtml(p.author || 'Друг')}</b></span>
        </div>
        <h4 class="text-xs font-bold text-white mb-1">${escapeHtml(p.title)}</h4>
        <p class="text-xs text-slate-300 mb-3 leading-relaxed">${escapeHtml(p.note || '')}</p>
        
        <div class="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
          <button onclick="focusPoint([${p.lat}, ${p.lng}], '${p.id}')" class="text-amber-400 hover:text-amber-300 font-medium flex items-center space-x-1">
            <span>📍 На карте</span>
          </button>
          <div class="flex items-center space-x-2">
            <button onclick="likePoint('${p.id}')" class="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold border border-amber-500/30 transition flex items-center space-x-1">
              <span>👍 Хочу сюда!</span>
              <span class="ml-1 font-bold">${p.likes || 0}</span>
            </button>
            <button onclick="deleteCommunityPoint('${p.id}')" class="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition" title="Удалить точку">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// Лайк точки
async function likePoint(pointId) {
  const p = communityPoints.find(item => item.id === pointId);
  if (p) {
    p.likes = (p.likes || 0) + 1;
    saveCommunityPoints();
    renderCommunityMarkersOnMap();
    renderCommunityList();
    showToast(`Вы проголосовали за «${p.title}»!`, 'success');

    // 1. Синхронизация с облачной базой Firebase Realtime Database
    if (firebaseDb) {
      try {
        firebaseDb.ref(`community_points/${pointId}/likes`).transaction(l => (l || 0) + 1);
        return;
      } catch (e) {
        console.warn('Firebase like error:', e);
      }
    }

    // 2. Синхронизация с локальным/удаленным сервером (если запущен)
    try {
      await fetch('/api/points/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pointId })
      });
    } catch (e) {
      // Offline fallback
    }
  }
}

// Удаление точки
async function deleteCommunityPoint(pointId) {
  const p = communityPoints.find(item => item.id === pointId);
  const title = p ? p.title : 'эту точку';
  if (!confirm(`Вы уверены, что хотите удалить метку «${title}»?`)) {
    return;
  }

  communityPoints = communityPoints.filter(item => item.id !== pointId);
  saveCommunityPoints();
  renderCommunityMarkersOnMap();
  renderCommunityList();
  showToast(`Метка «${title}» удалена`, 'info');

  // Удаление из Firebase
  if (firebaseDb) {
    try {
      firebaseDb.ref(`community_points/${pointId}`).remove();
    } catch (e) {
      console.warn('Firebase delete error:', e);
    }
  }

  // Удаление с локального сервера server.py
  try {
    await fetch(`/api/points?id=${pointId}`, { method: 'DELETE' });
  } catch (e) {}
}

// 7. Интерактивный выбор и добавление точки на карте
let isPlacementModeActive = false;
let tempPlacementMarker = null;

function createTempPinIcon() {
  return L.divIcon({
    className: 'temp-placement-icon',
    html: `
      <div class="relative flex flex-col items-center cursor-grab active:cursor-grabbing group">
        <div class="px-2.5 py-1 mb-1 bg-amber-400 text-slate-950 font-black text-[10px] rounded-full shadow-xl whitespace-nowrap animate-bounce border border-white">
          🎯 Перетащите меня!
        </div>
        <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 text-white shadow-2xl flex items-center justify-center border-2 border-white text-xl">
          📍
        </div>
        <div class="w-3 h-3 bg-amber-400 rounded-full blur-[2px] -mt-1"></div>
      </div>
    `,
    iconSize: [130, 68],
    iconAnchor: [65, 62],
    popupAnchor: [0, -62]
  });
}

function startPinPlacementMode(initialLatLng = null, openModalImmediately = false) {
  isPlacementModeActive = true;
  const modal = document.getElementById('addPointModal');
  if (modal) modal.classList.add('hidden');

  let raw = initialLatLng || selectedLatLngForNewPin || (map ? map.getCenter() : { lat: 43.238949, lng: 76.889709 });
  let lat = 43.2389, lng = 76.8897;
  if (raw) {
    if (typeof raw.lat === 'number' && typeof raw.lng === 'number') {
      lat = raw.lat;
      lng = raw.lng;
    } else if (Array.isArray(raw)) {
      lat = Number(raw[0]);
      lng = Number(raw[1]);
    } else if (raw.lat && typeof raw.lat === 'function') {
      lat = raw.lat();
      lng = raw.lng();
    }
  }
  selectedLatLngForNewPin = { lat, lng };

  if (map) {
    if (!tempPlacementMarker) {
      tempPlacementMarker = L.marker([lat, lng], {
        icon: createTempPinIcon(),
        draggable: true,
        zIndexOffset: 1000
      }).addTo(map);

      tempPlacementMarker.on('drag', (e) => {
        selectedLatLngForNewPin = { lat: e.latlng.lat, lng: e.latlng.lng };
        updatePlacementBannerText(selectedLatLngForNewPin);
      });

      tempPlacementMarker.on('dragend', (e) => {
        const p = e.target.getLatLng();
        selectedLatLngForNewPin = { lat: p.lat, lng: p.lng };
        updatePlacementBannerText(selectedLatLngForNewPin);
      });

      tempPlacementMarker.on('click', () => {
        confirmPinPlacement();
      });
    } else {
      tempPlacementMarker.setLatLng([lat, lng]);
      if (!map.hasLayer(tempPlacementMarker)) {
        tempPlacementMarker.addTo(map);
      }
    }
  }

  updatePlacementBannerText(selectedLatLngForNewPin);

  const banner = document.getElementById('placementBanner');
  if (banner) banner.classList.remove('hidden');

  // Если кликнули прямо на карту при обычном просмотре
  if (openModalImmediately) {
    confirmPinPlacement();
  } else {
    if (map) map.panTo([lat, lng], { animate: true });
    showToast('Кликните по карте или перетащите маркер в нужное место', 'info');
  }
}

function updatePlacementBannerText(latlng) {
  const textEl = document.getElementById('placementCoordText');
  if (textEl && latlng) {
    const lat = typeof latlng.lat === 'function' ? latlng.lat() : Number(latlng.lat || 0);
    const lng = typeof latlng.lng === 'function' ? latlng.lng() : Number(latlng.lng || 0);
    textEl.innerText = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

function moveTempMarker(latlng) {
  if (!latlng) return;
  const lat = typeof latlng.lat === 'function' ? latlng.lat() : Number(latlng.lat || 0);
  const lng = typeof latlng.lng === 'function' ? latlng.lng() : Number(latlng.lng || 0);
  selectedLatLngForNewPin = { lat, lng };
  if (tempPlacementMarker) {
    tempPlacementMarker.setLatLng([lat, lng]);
  } else {
    startPinPlacementMode([lat, lng], false);
  }
  updatePlacementBannerText(selectedLatLngForNewPin);
}

function confirmPinPlacement() {
  if (!selectedLatLngForNewPin && tempPlacementMarker) {
    const p = tempPlacementMarker.getLatLng();
    selectedLatLngForNewPin = { lat: p.lat, lng: p.lng };
  }
  if (!selectedLatLngForNewPin && map) {
    const c = map.getCenter();
    selectedLatLngForNewPin = { lat: c.lat, lng: c.lng };
  }

  isPlacementModeActive = false;

  const banner = document.getElementById('placementBanner');
  if (banner) banner.classList.add('hidden');

  openAddPointModal(selectedLatLngForNewPin);
}

function cancelPinPlacement() {
  isPlacementModeActive = false;
  if (tempPlacementMarker && map && map.hasLayer(tempPlacementMarker)) {
    map.removeLayer(tempPlacementMarker);
  }
  tempPlacementMarker = null;

  const banner = document.getElementById('placementBanner');
  if (banner) banner.classList.add('hidden');
}

function adjustPinOnMap() {
  const modal = document.getElementById('addPointModal');
  if (modal) modal.classList.add('hidden');
  startPinPlacementMode(selectedLatLngForNewPin, false);
}

function openAddPointModal(latlng = null) {
  try {
    let lat = 43.2389, lng = 76.8897;
    const raw = latlng || selectedLatLngForNewPin || (map ? map.getCenter() : null);
    if (raw) {
      if (typeof raw.lat === 'number' && typeof raw.lng === 'number') {
        lat = raw.lat;
        lng = raw.lng;
      } else if (Array.isArray(raw)) {
        lat = Number(raw[0]);
        lng = Number(raw[1]);
      } else if (raw.lat && typeof raw.lat === 'function') {
        lat = raw.lat();
        lng = raw.lng();
      }
    }
    selectedLatLngForNewPin = { lat, lng };

    // Держим маркер на карте, чтобы пользователь видел выбранную локацию
    if (map) {
      if (!tempPlacementMarker) {
        tempPlacementMarker = L.marker([lat, lng], {
          icon: createTempPinIcon(),
          draggable: true,
          zIndexOffset: 1000
        }).addTo(map);

        tempPlacementMarker.on('drag', (e) => {
          selectedLatLngForNewPin = { lat: e.latlng.lat, lng: e.latlng.lng };
          updatePlacementBannerText(selectedLatLngForNewPin);
        });
        tempPlacementMarker.on('dragend', (e) => {
          const p = e.target.getLatLng();
          selectedLatLngForNewPin = { lat: p.lat, lng: p.lng };
          updatePlacementBannerText(selectedLatLngForNewPin);
        });
        tempPlacementMarker.on('click', () => {
          confirmPinPlacement();
        });
      } else {
        tempPlacementMarker.setLatLng([lat, lng]);
        if (!map.hasLayer(tempPlacementMarker)) {
          tempPlacementMarker.addTo(map);
        }
      }
    }

    const modal = document.getElementById('addPointModal');
    const coordHint = document.getElementById('modalCoordHint');

    if (coordHint) {
      coordHint.innerText = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }

    if (modal) {
      modal.classList.remove('hidden');
    }

    setTimeout(() => {
      const input = document.getElementById('pinTitle');
      if (input) input.focus();
    }, 100);
  } catch (e) {
    console.error('Error opening add point modal:', e);
    const modal = document.getElementById('addPointModal');
    if (modal) modal.classList.remove('hidden');
  }
}

function closeAddPointModal() {
  const modal = document.getElementById('addPointModal');
  if (modal) modal.classList.add('hidden');
  cancelPinPlacement();
}

async function submitNewPoint(event) {
  event.preventDefault();

  const title = document.getElementById('pinTitle').value.trim();
  const author = document.getElementById('pinAuthor').value.trim() || 'Друг';
  const category = document.getElementById('pinCategory').value;
  const day = document.getElementById('pinDay').value;
  const note = document.getElementById('pinNote').value.trim();

  if (!title) {
    alert('Пожалуйста, введите название точки!');
    return;
  }

  let lat, lng;
  if (selectedLatLngForNewPin) {
    lat = selectedLatLngForNewPin.lat;
    lng = selectedLatLngForNewPin.lng;
  } else if (tempPlacementMarker) {
    const p = tempPlacementMarker.getLatLng();
    lat = p.lat;
    lng = p.lng;
  } else {
    const center = map.getCenter();
    lat = center.lat;
    lng = center.lng;
  }

  const newPoint = {
    id: 'poi_' + Date.now(),
    title: title,
    author: author,
    category: category,
    day: day,
    note: note,
    lat: lat,
    lng: lng,
    likes: 1,
    created_at: new Date().toISOString().split('T')[0]
  };

  communityPoints.push(newPoint);
  saveCommunityPoints();
  renderCommunityMarkersOnMap();
  renderCommunityList();

  // Убираем маркер размещения и модалку
  cancelPinPlacement();
  document.getElementById('addPointModal').classList.add('hidden');

  // Очистка полей
  document.getElementById('pinTitle').value = '';
  document.getElementById('pinNote').value = '';

  showToast(`Точка «${title}» успешно добавлена на карту! 🚀`, 'success');

  // Фокусировка на созданной точке
  focusPoint([lat, lng], newPoint.id);

  // 1. Синхронизация с облачной базой Firebase Realtime Database
  if (firebaseDb) {
    firebaseDb.ref(`community_points/${newPoint.id}`).set(newPoint).catch(e => {
      console.warn('Firebase submit error:', e);
    });
  }

  // 2. Синхронизация с локальным Python-сервером (server.py)
  try {
    fetch('/api/points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPoint)
    }).catch(() => {});
  } catch (e) {
    // Offline / static hosting fallback
  }
}

// 8. Вспомогательные функции интерфейса
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function focusPoint(coords, pointId) {
  map.setView(coords, 13, { animate: true });
  const target = communityMarkerLayers.find(m => m.pointId === pointId)
    || markerLayers.find(m => m.marker && Math.abs(m.marker.getLatLng().lat - coords[0]) < 0.005 && Math.abs(m.marker.getLatLng().lng - coords[1]) < 0.005);
  if (target) {
    const marker = target.marker || target;
    setTimeout(() => {
      marker.openPopup();
    }, 250);
  }
}

function clearMapLayers() {
  routeLayers.forEach(l => map.removeLayer(l.polyline));
  markerLayers.forEach(l => map.removeLayer(l.marker));
  routeLayers = [];
  markerLayers = [];
}

function updateStats() {
  const kmEl = document.getElementById('statTotalKm');
  const daysEl = document.getElementById('statTotalDays');
  const friendsEl = document.getElementById('statFriendsPins');
  const badgeEl = document.getElementById('badgeFriendsCount');

  if (kmEl) kmEl.innerText = `${TRIP_DATA.meta.total_km} км`;
  if (daysEl) daysEl.innerText = `${TRIP_DATA.meta.duration_days} дней`;
  if (friendsEl) friendsEl.innerText = `${communityPoints.length}`;
  if (badgeEl) badgeEl.innerText = `${communityPoints.length}`;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xl border backdrop-blur flex items-center space-x-2 transition-all duration-300 transform translate-y-2 opacity-0 bg-slate-900/95 text-white border-slate-700';
  toast.innerHTML = `<span>${type === 'success' ? '✅' : 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

async function shareTripLink() {
  const url = window.location.href;
  const shareData = {
    title: 'Пу-пу-путешествие 2026',
    text: 'Маршрут и народная карта нашей автоэкспедиции по Казахстану и Кыргызстану! (Пароль: пупупу)',
    url: url
  };

  // 1. Попытка нативного шеринга в мобильных браузерах (iOS/Android)
  if (navigator.share) {
    try {
      await navigator.share(shareData);
      showToast('Ссылка успешно отправлена! 🚀', 'success');
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  // 2. Современный Clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      showToast('Ссылка скопирована! Отправьте её друзьям в WhatsApp/Telegram 🚀', 'success');
      return;
    } catch (e) {}
  }

  // 3. Классический надежный execCommand copy
  try {
    const input = document.createElement('textarea');
    input.value = url;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.focus();
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    showToast('Ссылка скопирована в буфер обмена! 🚀', 'success');
  } catch (e) {
    prompt('Скопируйте ссылку на карту:', url);
  }
}

function downloadTripGPX() {
  downloadGPXFile(TRIP_DATA, communityPoints);
  showToast('GPX-трек сгенерирован и скачивается для Organic Maps / 2ГИС!', 'success');
}

function setupEventListeners() {
  // Закрытие модалок по ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAddPointModal();
      closeMemoModal();
      closeRouletteModal();
    }
  });
}

function openMemoModal() {
  const modal = document.getElementById('driverMemoModal');
  if (modal) modal.classList.remove('hidden');
}

function closeMemoModal() {
  const modal = document.getElementById('driverMemoModal');
  if (modal) modal.classList.add('hidden');
}

// 9. Авторизация по кодовому слову («пупупу»)
const VALID_PASSCODES = ['пупупу', 'pupupu', 'gegege'];

function checkAuthGate() {
  const isAuth = localStorage.getItem('pupupu_auth') === 'true';
  const modal = document.getElementById('authGateModal');
  if (!modal) return;

  if (isAuth) {
    modal.classList.add('hidden');
  } else {
    modal.classList.remove('hidden');
    setTimeout(() => {
      const input = document.getElementById('authCodeInput');
      if (input) input.focus();
    }, 150);
  }
}

function handleAuthSubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('authCodeInput');
  const err = document.getElementById('authErrorMessage');
  const val = (input ? input.value : '').trim().toLowerCase();

  if (VALID_PASSCODES.includes(val)) {
    localStorage.setItem('pupupu_auth', 'true');
    const modal = document.getElementById('authGateModal');
    if (modal) modal.classList.add('hidden');
    if (err) err.classList.add('hidden');
    showToast('Добро пожаловать в Пу-пу-путешествие! 🚗💨', 'success');
  } else {
    if (err) {
      err.textContent = 'Неверное слово! Спросите у Ромы 😉';
      err.classList.remove('hidden');
    }
    if (input) {
      input.classList.add('border-rose-500', 'ring-2', 'ring-rose-500/30');
      input.focus();
      input.select();
    }
  }
}

function lockApp() {
  localStorage.removeItem('pupupu_auth');
  const input = document.getElementById('authCodeInput');
  const err = document.getElementById('authErrorMessage');
  if (input) {
    input.value = '';
    input.classList.remove('border-rose-500', 'ring-2', 'ring-rose-500/30');
  }
  if (err) err.classList.add('hidden');
  checkAuthGate();
  showToast('Приложение заблокировано 🔒', 'info');
}

// 10. Шуточная рулетка: «Кто поедет без трусов?»
const ROULETTE_PARTICIPANTS = [
  { name: 'Полина', color: '#ec4899', textColor: '#ffffff', weight: 60, joke: 'Колеса судьбы неумолимы! Готовься ощутить горный бриз Тянь-Шаня во всей красе! 🌬️🩲' },
  { name: 'Влад', color: '#3b82f6', textColor: '#ffffff', weight: 8, joke: 'Аэродинамика +100 к скорости на перевале! Главное — не садись на горячую кожу! 🏎️💨' },
  { name: 'Илья', color: '#10b981', textColor: '#ffffff', weight: 8, joke: 'Максимальное единение с дикой природой Иссык-Куля разблокировано! 🏔️🦅' },
  { name: 'Лена', color: '#8b5cf6', textColor: '#ffffff', weight: 8, joke: 'Штраф за нарушение дресс-кода отменяется — это суверенное решение рулетки! ⚖️✨' },
  { name: 'Рома', color: '#f59e0b', textColor: '#ffffff', weight: 8, joke: 'Капитан корабля подает пример истинного бесстрашия всему экипажу! 🫡⛵' },
  { name: 'Карина', color: '#06b6d4', textColor: '#ffffff', weight: 8, joke: 'Экстремальная высокогорная вентиляция по спецпропуску! 🧊😎' }
];

let rouletteCurrentAngle = 0;
let isRouletteSpinning = false;
let rouletteAudioCtx = null;

function openRouletteModal() {
  const modal = document.getElementById('rouletteModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  drawRouletteWheel(rouletteCurrentAngle);
}

function closeRouletteModal() {
  const modal = document.getElementById('rouletteModal');
  if (modal) modal.classList.add('hidden');
}

function drawRouletteWheel(angle = 0) {
  const canvas = document.getElementById('rouletteCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = width / 2 - 10;
  const count = ROULETTE_PARTICIPANTS.length;
  const sliceAngle = (2 * Math.PI) / count;

  ctx.clearRect(0, 0, width, height);

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(angle);

  // Сектора
  for (let i = 0; i < count; i++) {
    const p = ROULETTE_PARTICIPANTS[i];
    const startAngle = i * sliceAngle;
    const endAngle = startAngle + sliceAngle;

    // Сектор
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = p.color;
    ctx.fill();

    // Границы
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();

    // Текст имени
    ctx.save();
    ctx.rotate(startAngle + sliceAngle / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = p.textColor;
    ctx.font = 'bold 14px sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    ctx.fillText(p.name, radius - 20, 5);
    ctx.restore();
  }

  // Декоративные точки по ободу
  const dotsCount = 24;
  for (let d = 0; d < dotsCount; d++) {
    const dotAngle = (d * 2 * Math.PI) / dotsCount;
    const dotX = (radius + 4) * Math.cos(dotAngle);
    const dotY = (radius + 4) * Math.sin(dotAngle);
    ctx.beginPath();
    ctx.arc(dotX, dotY, 2.5, 0, 2 * Math.PI);
    ctx.fillStyle = '#fef08a';
    ctx.fill();
  }

  ctx.restore();
}

function playRouletteTick() {
  try {
    if (!rouletteAudioCtx) {
      rouletteAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (rouletteAudioCtx.state === 'suspended') {
      rouletteAudioCtx.resume();
    }
    const osc = rouletteAudioCtx.createOscillator();
    const gain = rouletteAudioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, rouletteAudioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, rouletteAudioCtx.currentTime + 0.03);
    gain.gain.setValueAtTime(0.12, rouletteAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, rouletteAudioCtx.currentTime + 0.03);
    osc.connect(gain);
    gain.connect(rouletteAudioCtx.destination);
    osc.start();
    osc.stop(rouletteAudioCtx.currentTime + 0.035);
  } catch (e) {}
}

function playRouletteWinFanfare() {
  try {
    if (!rouletteAudioCtx) {
      rouletteAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (rouletteAudioCtx.state === 'suspended') {
      rouletteAudioCtx.resume();
    }
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      const osc = rouletteAudioCtx.createOscillator();
      const gain = rouletteAudioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, rouletteAudioCtx.currentTime + idx * 0.09);
      gain.gain.setValueAtTime(0.18, rouletteAudioCtx.currentTime + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, rouletteAudioCtx.currentTime + idx * 0.09 + 0.28);
      osc.connect(gain);
      gain.connect(rouletteAudioCtx.destination);
      osc.start(rouletteAudioCtx.currentTime + idx * 0.09);
      osc.stop(rouletteAudioCtx.currentTime + idx * 0.09 + 0.3);
    });
  } catch (e) {}
}

function launchConfetti() {
  const canvas = document.getElementById('rouletteCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const particles = [];
  const colors = ['#ec4899', '#f59e0b', '#3b82f6', '#10b981', '#a855f7', '#ffffff'];

  for (let i = 0; i < 45; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.5) * 12 - 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 6 + 3,
      alpha: 1
    });
  }

  let frame = 0;
  function animateConfetti() {
    frame++;
    drawRouletteWheel(rouletteCurrentAngle);

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2; // gravity
      p.alpha -= 0.02;

      if (p.alpha > 0) {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.restore();
      }
    });

    if (frame < 50) {
      requestAnimationFrame(animateConfetti);
    } else {
      drawRouletteWheel(rouletteCurrentAngle);
    }
  }

  animateConfetti();
}

function spinRoulette() {
  if (isRouletteSpinning) return;
  isRouletteSpinning = true;

  const spinBtn = document.getElementById('rouletteSpinBtn');
  const centerBtn = document.getElementById('rouletteCenterBtn');
  const titleEl = document.getElementById('rouletteResultTitle');
  const quoteEl = document.getElementById('rouletteResultQuote');

  if (spinBtn) {
    spinBtn.disabled = true;
    spinBtn.classList.add('opacity-50', 'cursor-not-allowed');
  }
  if (centerBtn) centerBtn.disabled = true;

  if (titleEl) titleEl.innerText = '🌀 Барабан судьбы раскручивается...';
  if (quoteEl) quoteEl.innerText = 'Кому же выпадет этот почётный жребий?';

  // Взвешенный выбор победителя (Полина: 60%, остальные: по 8%)
  const rand = Math.random() * 100;
  let cumulative = 0;
  let winnerIndex = 0;
  for (let i = 0; i < ROULETTE_PARTICIPANTS.length; i++) {
    cumulative += ROULETTE_PARTICIPANTS[i].weight;
    if (rand < cumulative) {
      winnerIndex = i;
      break;
    }
  }

  const winner = ROULETTE_PARTICIPANTS[winnerIndex];
  const count = ROULETTE_PARTICIPANTS.length;
  const sliceAngle = (2 * Math.PI) / count;

  // Расчет целевого угла:
  // Стрелка находится на 12 часов (угол 3*PI/2 = 270 deg)
  // Центр сектора i: (i + 0.5) * sliceAngle
  // targetAngle = 3*PI/2 - (i + 0.5) * sliceAngle
  // Добавляем небольшое случайное смещение внутри сектора (+- sliceAngle * 0.3)
  const jitter = (Math.random() - 0.5) * sliceAngle * 0.6;
  const targetSectorCenter = (3 * Math.PI / 2) - ((winnerIndex + 0.5) * sliceAngle) + jitter;

  // Нормализуем текущий угол
  const startAngle = rouletteCurrentAngle;
  const normalizedStart = startAngle % (2 * Math.PI);
  let delta = (targetSectorCenter - normalizedStart) % (2 * Math.PI);
  if (delta < 0) delta += 2 * Math.PI;

  // 6 до 8 полных оборотов
  const extraSpins = 6 + Math.floor(Math.random() * 3);
  const totalRotation = delta + extraSpins * (2 * Math.PI);
  const finalAngle = startAngle + totalRotation;

  const duration = 4800; // 4.8 секунды
  const startTime = performance.now();
  let lastSectorIndex = -1;

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function frame(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutCubic(progress);

    rouletteCurrentAngle = startAngle + totalRotation * eased;
    drawRouletteWheel(rouletteCurrentAngle);

    // Звуковой тик при прохождении сектора
    const currentSector = Math.floor((rouletteCurrentAngle / sliceAngle)) % count;
    if (currentSector !== lastSectorIndex) {
      lastSectorIndex = currentSector;
      playRouletteTick();
    }

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      rouletteCurrentAngle = finalAngle;
      drawRouletteWheel(rouletteCurrentAngle);
      isRouletteSpinning = false;

      if (spinBtn) {
        spinBtn.disabled = false;
        spinBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      }
      if (centerBtn) centerBtn.disabled = false;

      playRouletteWinFanfare();
      launchConfetti();

      if (titleEl) {
        titleEl.innerHTML = `<span class="text-pink-400 font-black text-sm uppercase">🎉 Победитель: ${winner.name}! 🩲</span>`;
      }
      if (quoteEl) {
        quoteEl.innerHTML = `<span class="text-slate-200 font-medium">${winner.joke}</span>`;
      }

      showToast(`Рулетка выбрала: ${winner.name}! 🩲`, 'info');
    }
  }

  requestAnimationFrame(frame);
}



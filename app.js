// app.js — Логика интерактивной карты, маршрутов и совместных точек друзей

// Глобальные переменные карты и состояния
let map;
let routeLayers = [];
let markerLayers = [];
let communityMarkerLayers = [];
let currentActiveDay = 'all';
let selectedLatLngForNewPin = null;

// Хранилище точек друзей
let communityPoints = [];

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
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
    openAddPointModal(e.latlng);
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

    polyline.on('click', () => {
      selectDay(day.day);
    });

    routeLayers.push({ day: day.day, polyline: polyline, color: day.color });
    day.route_points.forEach(pt => allBounds.extend(pt));

    // Маркеры остановок
    day.stops.forEach(stop => {
      const icon = createMarkerIcon(stop.type, day.day);
      const marker = L.marker(stop.coord, { icon: icon }).addTo(map);

      const popupHtml = `
        <div class="p-1 max-w-xs font-sans">
          <div class="flex items-center space-x-1.5 mb-1">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase" style="background-color: ${day.color}">День ${day.day}</span>
            <span class="text-xs font-semibold text-slate-800">${stop.name}</span>
          </div>
          <p class="text-xs text-slate-600 mb-2">${stop.note || ''}</p>
          <div class="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
            <span class="text-slate-400">${day.distance_km} км в пути</span>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${stop.coord[0]},${stop.coord[1]}" 
               target="_blank" class="text-blue-600 hover:underline font-medium">Маршрут в Google ➔</a>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
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
async function loadCommunityPoints() {
  // 1. Попытка загрузить свежие точки с локального/удаленного сервера
  try {
    const res = await fetch('/api/points', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        communityPoints = data;
        localStorage.setItem('tianshan_community_points', JSON.stringify(communityPoints));
        return;
      }
    }
  } catch (e) {
    // Сервер не запущен (статический хостинг) — штатный переход на localStorage
  }

  // 2. Резервный источник: localStorage браузера
  const local = localStorage.getItem('tianshan_community_points');
  if (local) {
    try {
      communityPoints = JSON.parse(local);
    } catch (e) {
      communityPoints = [];
    }
  }

  // 3. Если список пуст, добавляем пару красивых стартовых идей от друзей
  if (communityPoints.length === 0) {
    communityPoints = [
      {
        id: 'seed_1',
        title: 'Форелевое хозяйство с беседками над водой',
        category: 'food',
        author: 'Алексей',
        note: 'В Григорьевском ущелье. Вылавливают живую рыбу и жарят при вас на садже. Очень сочно!',
        lat: 42.742,
        lng: 77.468,
        day: 7,
        likes: 4,
        created_at: '2026-09-17'
      },
      {
        id: 'seed_2',
        title: 'Смотровая на закат над лабиринтом Сказки',
        category: 'photo',
        author: 'Алина',
        note: 'Если подняться на хребет чуть правее входа в каньон, видно и красные скалы, и бирюзовый Иссык-Куль!',
        lat: 42.161,
        lng: 77.362,
        day: 10,
        likes: 6,
        created_at: '2026-09-17'
      },
      {
        id: 'seed_3',
        title: 'Глэмпинг на диком южном берегу',
        category: 'hotel',
        author: 'Данияр',
        note: 'Теплые юрты со стеклянным куполом прямо на песчаном пляже возле Боконбаево. Видно звезды!',
        lat: 42.125,
        lng: 77.012,
        day: 10,
        likes: 5,
        created_at: '2026-09-17'
      }
    ];
    saveCommunityPoints();
  }
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

    const popupHtml = `
      <div class="p-1 max-w-xs font-sans">
        <div class="flex items-center space-x-1.5 mb-1">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold text-white bg-amber-500 uppercase">💡 Идея от ${p.author}</span>
          <span class="text-xs font-bold text-slate-800">${p.title}</span>
        </div>
        <p class="text-xs text-slate-600 mb-2">${p.note || ''}</p>
        <div class="flex items-center justify-between pt-1.5 border-t border-slate-100 text-xs">
          <button onclick="likePoint('${p.id}')" class="px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold flex items-center space-x-1 transition">
            <span>👍 Хочу сюда!</span>
            <span id="like-count-${p.id}" class="font-bold ml-1">${p.likes || 0}</span>
          </button>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}" target="_blank" class="text-blue-600 hover:underline text-[11px]">Навигатор ➔</a>
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
        Пока нет предложений от друзей. Нажмите «+ Добавить точку» или кликните в любое место на карте!
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

    html += `
      <div class="bg-slate-900/90 rounded-2xl border border-amber-500/30 p-3.5 mb-3 shadow-lg hover:border-amber-500/60 transition">
        <div class="flex items-center justify-between mb-1.5">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold text-amber-300 bg-amber-950/80 border border-amber-500/40">
            ${catBadge}
          </span>
          <span class="text-[11px] text-slate-400">Предложил: <b class="text-slate-200">${p.author || 'Друг'}</b></span>
        </div>
        <h4 class="text-xs font-bold text-white mb-1">${p.title}</h4>
        <p class="text-xs text-slate-300 mb-3">${p.note || ''}</p>
        
        <div class="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
          <button onclick="focusPoint([${p.lat}, ${p.lng}], '${p.title}')" class="text-amber-400 hover:text-amber-300 font-medium flex items-center space-x-1">
            <span>📍 Найти на карте</span>
          </button>
          <button onclick="likePoint('${p.id}')" class="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold border border-amber-500/30 transition flex items-center space-x-1">
            <span>👍 Хочу сюда!</span>
            <span class="ml-1 font-bold">${p.likes || 0}</span>
          </button>
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
    showToast(`Ваш голос учтен за точку «${p.title}»!`, 'success');

    // Синхронизация с локальным/удаленным сервером (если запущен)
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

// 7. Модальное окно добавления точки
function openAddPointModal(latlng = null) {
  selectedLatLngForNewPin = latlng;
  const modal = document.getElementById('addPointModal');
  const coordHint = document.getElementById('modalCoordHint');

  if (latlng) {
    coordHint.innerText = `Координаты с карты: ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
  } else {
    coordHint.innerText = `Подсказка: точка будет добавлена в текущий центр карты`;
  }

  modal.classList.remove('hidden');
}

function closeAddPointModal() {
  document.getElementById('addPointModal').classList.add('hidden');
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
  closeAddPointModal();

  // Очистка полей
  document.getElementById('pinTitle').value = '';
  document.getElementById('pinNote').value = '';

  showToast(`Точка «${title}» успешно добавлена на карту!`, 'success');

  // Фокусировка на созданной точке
  focusPoint([lat, lng], title);

  // Синхронизация с сервером
  try {
    await fetch('/api/points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPoint)
    });
  } catch (e) {
    // Offline / static hosting fallback
  }
}

// 8. Вспомогательные функции интерфейса
function focusPoint(coords, name) {
  map.setView(coords, 12, { animate: true });
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

  if (kmEl) kmEl.innerText = `${TRIP_DATA.meta.total_km} км`;
  if (daysEl) daysEl.innerText = `${TRIP_DATA.meta.duration_days} дней`;
  if (friendsEl) friendsEl.innerText = `${communityPoints.length}`;
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

function shareTripLink() {
  navigator.clipboard.writeText(window.location.href).then(() => {
    showToast('Ссылка на карту скопирована! Отправьте её друзьям в WhatsApp/Telegram 🚀', 'success');
  }).catch(() => {
    prompt('Скопируйте ссылку на карту:', window.location.href);
  });
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
    }
  });
}

function openMemoModal() {
  document.getElementById('driverMemoModal').classList.remove('hidden');
}

function closeMemoModal() {
  document.getElementById('driverMemoModal').classList.add('hidden');
}

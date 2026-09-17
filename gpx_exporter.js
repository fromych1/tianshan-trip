// gpx_exporter.js — Генератор стандартного GPX XML файла для оффлайн-навигаторов
function exportTripToGPX(tripData, communityPoints = [], customDays = null) {
  const daysToExport = customDays || tripData.days;
  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TianShan RoadTrip Planner" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(tripData.meta.title)}</name>
    <desc>${escapeXml(tripData.meta.subtitle)}</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
`;

  // Добавляем официальные точки маршрута
  daysToExport.forEach(d => {
    d.stops.forEach(s => {
      gpx += `  <wpt lat="${s.coord[0]}" lon="${s.coord[1]}">
    <name>${escapeXml(`[День ${d.day}] ${s.name}`)}</name>
    <desc>${escapeXml(s.note || '')}</desc>
    <type>${escapeXml(s.type)}</type>
  </wpt>\n`;
    });
  });

  // Добавляем точки друзей
  communityPoints.forEach(p => {
    gpx += `  <wpt lat="${p.lat}" lon="${p.lng}">
    <name>${escapeXml(`[💡 ${p.author || 'Друг'}] ${p.title}`)}</name>
    <desc>${escapeXml(`${p.note || ''} (Лайков: ${p.likes || 0})`)}</desc>
    <type>${escapeXml(p.category || 'poi')}</type>
  </wpt>\n`;
  });

  // Добавляем треки по дням
  daysToExport.forEach(d => {
    gpx += `  <trk>
    <name>${escapeXml(`День ${d.day}: ${d.title}`)}</name>
    <desc>${escapeXml(`${d.distance_km} км | ${d.drive_time}`)}</desc>
    <trkseg>\n`;
    d.route_points.forEach(pt => {
      gpx += `      <trkpt lat="${pt[0]}" lon="${pt[1]}"></trkpt>\n`;
    });
    gpx += `    </trkseg>
  </trk>\n`;
  });

  gpx += `</gpx>`;
  return gpx;
}

function escapeXml(unsafe) {
  return String(unsafe || '').replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

function downloadGPXFile(tripData, communityPoints, customDays = null) {
  const gpxContent = exportTripToGPX(tripData, communityPoints, customDays);
  const blob = new Blob([gpxContent], { type: 'application/gpx+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Pu_pu_puteshestvie_2026.gpx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

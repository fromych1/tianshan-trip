"""
server.py — Локальный веб-сервер и API синхронизации меток друзей для TianShan RoadTrip Planner
Работает на стандартной библиотеке Python 3 (без сторонних зависимостей pip).
"""

import json
import os
import sys
import socket
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 5050
DATA_FILE = Path(__file__).parent / "community_points.json"

DEFAULT_SEEDS = [
    {
        "id": "seed_1",
        "title": "Форелевое хозяйство с беседками над водой",
        "category": "food",
        "author": "Алексей",
        "note": "В Григорьевском ущелье. Вылавливают живую рыбу и жарят при вас на садже. Очень сочно!",
        "lat": 42.742,
        "lng": 77.468,
        "day": 7,
        "likes": 4,
        "created_at": "2026-09-17"
    },
    {
        "id": "seed_2",
        "title": "Смотровая на закат над лабиринтом Сказки",
        "category": "photo",
        "author": "Алина",
        "note": "Если подняться на хребет чуть правее входа в каньон, видно и красные скалы, и бирюзовый Иссык-Куль!",
        "lat": 42.161,
        "lng": 77.362,
        "day": 10,
        "likes": 6,
        "created_at": "2026-09-17"
    },
    {
        "id": "seed_3",
        "title": "Глэмпинг на диком южном берегу",
        "category": "hotel",
        "author": "Данияр",
        "note": "Теплые юрты со стеклянным куполом прямо на песчаном пляже возле Боконбаево. Видно звезды!",
        "lat": 42.125,
        "lng": 77.012,
        "day": 10,
        "likes": 5,
        "created_at": "2026-09-17"
    }
]

def load_points():
    if not DATA_FILE.exists():
        save_points(DEFAULT_SEEDS)
        return DEFAULT_SEEDS
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[WARN] Ошибка чтения {DATA_FILE}: {e}")
        return DEFAULT_SEEDS

def save_points(points):
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(points, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[ERR] Ошибка сохранения {DATA_FILE}: {e}")

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

class RoadTripHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).parent), **kwargs)

    def end_headers(self):
        # Разрешаем CORS для совместной работы
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/api/points"):
            points = load_points()
            data = json.dumps(points, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        # Отдавать статические файлы
        super().do_GET()

    def do_POST(self):
        if self.path == "/api/points":
            content_len = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_len).decode("utf-8")
            try:
                new_point = json.loads(body)
                points = load_points()

                # Проверка: обновление существующей или добавление новой
                existing_idx = next((i for i, p in enumerate(points) if p["id"] == new_point.get("id")), None)
                if existing_idx is not None:
                    points[existing_idx] = new_point
                else:
                    points.append(new_point)

                save_points(points)

                res = json.dumps({"status": "ok", "count": len(points)}, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
                print(f"[SYNC] Точка добавлена/обновлена: {new_point.get('title')} от {new_point.get('author')}")
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(str(e).encode("utf-8"))
            return

        elif self.path == "/api/points/like":
            content_len = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_len).decode("utf-8")
            try:
                req = json.loads(body)
                target_id = req.get("id")
                points = load_points()
                updated_likes = 0
                for p in points:
                    if p["id"] == target_id:
                        p["likes"] = p.get("likes", 0) + 1
                        updated_likes = p["likes"]
                        break
                save_points(points)

                res = json.dumps({"status": "ok", "likes": updated_likes}, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
                print(f"[LIKE] Голос за точку ID {target_id} (+1)")
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(str(e).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

def main():
    local_ip = get_local_ip()
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, RoadTripHandler)

    print("=" * 65)
    print(" 🚗  TIAN SHAN ROAD TRIP PLANNER — СЕРВЕР ЗАПУЩЕН")
    print("=" * 65)
    print(f" • Локально на ПК:      http://localhost:{PORT}")
    print(f" • Для друзей в Wi-Fi:  http://{local_ip}:{PORT}")
    print(" • Экспорт GPX:        доступен кнопкой в верхнем меню")
    print(" • Совместные точки:    синхронизируются в community_points.json")
    print("=" * 65)
    print(" Для остановки нажмите Ctrl+C\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nСервер остановлен.")
        httpd.server_close()

if __name__ == "__main__":
    main()

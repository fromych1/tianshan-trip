// firebase_config.js — Настройки бесплатной базы данных Firebase Realtime Database
// Инструкция по получению ключей за 2 минуты (бесплатно, навсегда):
// 1. Зайдите на https://console.firebase.google.com/ и нажмите «Добавить проект» (например, «tianshan-trip»).
// 2. В меню слева перейдите в «Build» ➔ «Realtime Database» ➔ «Создать базу данных» (выберите локацию Europe / Belgium).
// 3. Во вкладке «Правила» (Rules) установите:
//    {
//      "rules": {
//        ".read": true,
//        ".write": true
//      }
//    }
// 4. В настройках проекта (иконка шестеренки) ➔ «Общие» ➔ внизу добавьте веб-приложение (</>) и скопируйте объект конфигурации сюда:

const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  databaseURL: "", // Например: "https://tianshan-trip-default-rtdb.europe-west1.firebasedatabase.app"
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// Проверка: настроен ли Firebase
function isFirebaseConfigured() {
  return Boolean(FIREBASE_CONFIG && FIREBASE_CONFIG.databaseURL && FIREBASE_CONFIG.databaseURL.trim().length > 0);
}
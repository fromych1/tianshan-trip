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
  apiKey: "AIzaSyAzcCyTL_DzazKll08dLLCNDXe47NFjQIk",
  authDomain: "pupupu-d3289.firebaseapp.com",
  databaseURL: "https://pupupu-d3289-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "pupupu-d3289",
  storageBucket: "pupupu-d3289.firebasestorage.app",
  messagingSenderId: "1001166585980",
  appId: "1:1001166585980:web:53a6fa75e3eefb899789f9"
};

// Проверка: настроен ли Firebase
function isFirebaseConfigured() {
  return Boolean(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey.startsWith("AIzaSy"));
}
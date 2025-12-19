// firebase.js
// Firebase の初期化と Realtime Database のエクスポート

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import {
    getDatabase,
    ref,
    push,
    serverTimestamp,
    onValue,
    query,
    orderByChild,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Firebase 設定情報
const firebaseConfig = {
    apiKey: "XXXXX",
    authDomain: "XXXXX",
    projectId: "XXXXX",
    storageBucket: "XXXXX",
    messagingSenderId: "XXXXX",
    appId: "XXXXX",
    measurementId: "GXXXXX",
    databaseURL: "XXXXX",
};

export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);

console.log("✅ Firebase初期化完了");
console.log("📍 プロジェクトID:", firebaseConfig.projectId);

// Realtime Database インスタンス
export const db = getDatabase(app);
console.log("🔥 Realtime Database インスタンス:", db ? "OK" : "NG");

// Realtime Database 用の関数もここから export
export { ref, push, serverTimestamp, onValue, query, orderByChild };
// main.js  Realtime Database 版

import {
    db,
    ref,
    push,
    serverTimestamp,
    onValue,
    query,
    orderByChild,
} from "./firebase.js";

// DOM要素取得
const boardIdInput = document.getElementById("boardIdInput");
const themeInput = document.getElementById("themeInput");
const joinBoardBtn = document.getElementById("joinBoardBtn");
const currentBoardLabel = document.getElementById("currentBoardLabel");

const themeDisplay = document.getElementById("themeDisplay");
const themeTitle = document.getElementById("themeTitle");

const keywordInput = document.getElementById("keywordInput");
const birthGroupSelect = document.getElementById("birthGroupSelect");
const searchBtn = document.getElementById("searchBtn");
const searchStatus = document.getElementById("searchStatus");
const searchResults = document.getElementById("searchResults");

const playlistGrid = document.getElementById("playlistGrid");
const audioPlayer = document.getElementById("audioPlayer");

// 現在のボードID
let currentBoardId = null;
let currentTheme = null;

// 西暦から17歳時点の年号のみを取得（令和 REIWA・平成 HEISEI・昭和 SHOWA）
function getEraName(birthYear) {
    const age17Year = birthYear + 17;

    if (age17Year >= 2019) {
        return "令和 REIWA";
    } else if (age17Year >= 1989) {
        return "平成 HEISEI";
    } else if (age17Year >= 1926) {
        return "昭和 SHOWA";
    } else {
        return "大正 TAISHO";
    }
}

// 西暦から17歳時点の和暦（令和・平成・昭和）を計算
function calculateEra(birthYear) {
    const age17Year = birthYear + 17;

    if (age17Year >= 2019) {
        // 令和：2019年〜
        const reiwaYear = age17Year - 2019 + 1;
        return `令和${reiwaYear}年（${age17Year}年）`;
    } else if (age17Year >= 1989) {
        // 平成：1989年〜2019年
        const heiseiYear = age17Year - 1989 + 1;
        return `平成${heiseiYear}年（${age17Year}年）`;
    } else if (age17Year >= 1926) {
        // 昭和：1926年〜1989年
        const showaYear = age17Year - 1926 + 1;
        return `昭和${showaYear}年（${age17Year}年）`;
    } else {
        // それ以前
        return `${age17Year}年`;
    }
}

// 生まれ年の選択肢を生成（西暦入力）
function generateBirthYearGroups() {
    const currentYear = new Date().getFullYear();
    const startYear = 1950;

    birthGroupSelect.innerHTML = "";

    // プレースホルダーオプション
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "生まれた年を選択してください";
    placeholder.disabled = true;
    placeholder.selected = true;
    birthGroupSelect.appendChild(placeholder);

    // 1950年から現在まで5年刻みで生成（範囲表記）
    for (let year = currentYear; year >= startYear; year -= 5) {
        const option = document.createElement("option");
        option.value = year;

        // 5年範囲を計算
        const startRange = year - 4;
        const endRange = year;

        // その範囲の中間年（year-2）で17歳時の年号を計算
        const midYear = year - 2;
        const era17Full = calculateEra(midYear);
        // 括弧内の年数を削除（例：「令和5年（2023年）」→「令和5年」）
        const era17 = era17Full.replace(/（.+?）/, '');

        option.textContent = `${startRange}年-${endRange}年 (17歳は${era17})`;
        birthGroupSelect.appendChild(option);
    }
}

// ボードに参加 / 作成（Realtime Database）
function joinBoard() {
    const boardId = boardIdInput.value.trim();
    const theme = themeInput.value.trim();

    if (!boardId) {
        alert("ボードIDを入力してください。");
        return;
    }

    if (!theme) {
        alert("リストテーマを入力してください。");
        return;
    }

    console.log("🔵 ボード参加:", boardId);
    console.log("🎨 テーマ:", theme);

    currentBoardId = boardId;
    currentTheme = theme;
    currentBoardLabel.textContent = `現在のボード: ${boardId}`;

    // テーマを表示
    themeTitle.textContent = theme;
    themeDisplay.style.display = "block";

    searchResults.innerHTML = "";
    playlistGrid.innerHTML = "";

    // ボードにテーマを保存（初回のみ）
    const boardRef = ref(db, `boards/${boardId}/info`);
    push(boardRef, {
        theme: theme,
        createdAt: serverTimestamp(),
    });

    // boards/{boardId}/tracks
    const tracksRef = ref(db, `boards/${boardId}/tracks`);
    const tracksQuery = query(tracksRef, orderByChild("createdAt"));

    onValue(tracksQuery, (snapshot) => {
        console.log("📊 データ受信");
        const tracks = [];
        snapshot.forEach((child) => {
            const val = child.val();
            tracks.push({
                id: child.key,
                ...val,
            });
        });
        console.log(`✅ 曲数: ${tracks.length}`);
        renderPlaylist(tracks);
    });

    // ボードのテーマを読み込んで表示
    onValue(boardRef, (snapshot) => {
        let latestTheme = theme;
        snapshot.forEach((child) => {
            const val = child.val();
            if (val.theme) {
                latestTheme = val.theme;
            }
        });
        themeTitle.textContent = latestTheme;
        currentTheme = latestTheme;
    });
}

// iTunes Search API で検索
async function searchTracks() {
    const keyword = keywordInput.value.trim();
    if (!keyword) {
        alert("曲名またはアーティスト名を入力してください。");
        return;
    }

    searchStatus.textContent = "検索中…";
    searchBtn.disabled = true;
    searchResults.innerHTML = "";

    try {
        const url = `https://itunes.apple.com/search?lang=ja_JP&entry=music&media=music&country=JP&limit=10&term=${encodeURIComponent(
            keyword
        )}`;

        const res = await fetch(url);
        if (!res.ok) {
            throw new Error("iTunes API の呼び出しに失敗しました。");
        }
        const data = await res.json();

        if (!data.results || data.results.length === 0) {
            searchStatus.textContent = "該当する曲が見つかりませんでした。";
            return;
        }

        const themeHint = currentTheme ? `「${currentTheme}」のテーマに合った曲を選んでください！` : "";
        searchStatus.textContent = `${data.results.length} 件の候補が見つかりました。${themeHint}`;
        renderSearchResults(data.results);
    } catch (error) {
        console.error(error);
        searchStatus.textContent = "エラーが発生しました。時間をおいて再度お試しください。";
    } finally {
        searchBtn.disabled = false;
    }
}

// 検索結果をカード表示
function renderSearchResults(results) {
    searchResults.innerHTML = "";

    results.forEach((item) => {
        const card = document.createElement("div");
        card.className = "result-card";

        const artwork = document.createElement("img");
        artwork.className = "result-artwork";
        artwork.src = item.artworkUrl100 || "";
        artwork.alt = item.trackName || "Artwork";

        const main = document.createElement("div");
        main.className = "result-main";

        const title = document.createElement("div");
        title.className = "result-track";
        title.textContent = item.trackName || "(タイトル不明)";

        const artist = document.createElement("div");
        artist.className = "result-artist";
        artist.textContent = item.artistName || "(アーティスト不明)";

        const meta = document.createElement("div");
        meta.className = "result-meta";
        // リリース年を表示
        let metaText = item.collectionName || "";
        if (item.releaseDate) {
            const releaseYear = new Date(item.releaseDate).getFullYear();
            metaText += metaText ? ` (${releaseYear}年)` : `${releaseYear}年`;
        }
        meta.textContent = metaText;

        main.appendChild(title);
        main.appendChild(artist);
        main.appendChild(meta);

        const actions = document.createElement("div");
        actions.className = "result-actions";

        // イントロ再生ボタン
        const previewBtn = document.createElement("button");
        previewBtn.textContent = "♪ イントロ";
        previewBtn.disabled = !item.previewUrl;
        previewBtn.addEventListener("click", () => {
            if (item.previewUrl) {
                audioPlayer.src = item.previewUrl;
                audioPlayer.play();
            }
        });

        // プレイリストに追加ボタン
        const addBtn = document.createElement("button");
        addBtn.textContent = "プレイリスト追加";
        addBtn.disabled = !currentBoardId;
        addBtn.addEventListener("click", () => addTrackToBoard(item));

        actions.appendChild(previewBtn);
        actions.appendChild(addBtn);

        card.appendChild(artwork);
        card.appendChild(main);
        card.appendChild(actions);

        searchResults.appendChild(card);
    });
}

// Realtime Database に曲を追加
async function addTrackToBoard(item) {
    if (!currentBoardId) {
        alert("先にボードIDを設定してください。");
        return;
    }

    const birthYear = birthGroupSelect.value;
    if (!birthYear) {
        alert("生まれ年を選択してください。");
        return;
    }

    const era17 = calculateEra(parseInt(birthYear));

    const trackData = {
        trackName: item.trackName || "",
        artistName: item.artistName || "",
        collectionName: item.collectionName || "",
        artworkUrl100: item.artworkUrl100 || "",
        previewUrl: item.previewUrl || "",
        releaseDate: item.releaseDate || "", // リリース日を追加
        birthYear: parseInt(birthYear), // 西暦
        era17: era17, // 17歳時の和暦
        createdAt: serverTimestamp(),
    };

    try {
        const tracksRef = ref(db, `boards/${currentBoardId}/tracks`);
        await push(tracksRef, trackData);
        console.log("✅ 曲を追加しました:", trackData);
    } catch (error) {
        console.error("❌ 追加エラー:", error);
        alert(`プレイリストへの追加に失敗しました: ${error.message}`);
    }
}

// プレイリストを年代ごとにグルーピング＆描画
function renderPlaylist(tracks) {
    playlistGrid.innerHTML = "";

    if (!tracks || tracks.length === 0) {
        playlistGrid.textContent = "まだこのボードには曲が追加されていません。";
        return;
    }

    // birthYear ごとにグループ化
    const groups = {};
    tracks.forEach((t) => {
        const year = t.birthYear || "不明";
        if (!groups[year]) {
            groups[year] = [];
        }
        groups[year].push(t);
    });

    // birthYear をソート
    const sortedKeys = Object.keys(groups).sort((a, b) => {
        const aYear = parseInt(a, 10);
        const bYear = parseInt(b, 10);
        if (isNaN(aYear)) return 1;
        if (isNaN(bYear)) return -1;
        return aYear - bYear;
    });

    sortedKeys.forEach((birthYear) => {
        const col = document.createElement("div");
        col.className = "year-column";

        const header = document.createElement("div");
        header.className = "year-column-header";

        // 年号のみを大きく表示
        const eraName = getEraName(parseInt(birthYear));
        header.innerHTML = `<span style="font-size:1.8em;font-weight:bold;letter-spacing:0.05em;">${eraName}</span>`;
        col.appendChild(header);

        groups[birthYear].forEach((t) => {
            const card = document.createElement("div");
            card.className = "track-card";

            // アートワーク画像を追加
            const artwork = document.createElement("img");
            artwork.className = "track-artwork";
            artwork.src = t.artworkUrl100 || "";
            artwork.alt = t.trackName || "アートワーク";

            const info = document.createElement("div");
            info.className = "track-info";

            const title = document.createElement("div");
            title.className = "track-title";
            title.textContent = t.trackName || "(タイトル不明)";

            const artist = document.createElement("div");
            artist.className = "track-artist";
            artist.textContent = t.artistName || "(アーティスト不明)";

            const actions = document.createElement("div");
            actions.className = "track-actions";

            const previewBtn = document.createElement("button");
            previewBtn.textContent = "▶︎ 再生";
            previewBtn.disabled = !t.previewUrl;
            previewBtn.addEventListener("click", () => {
                if (t.previewUrl) {
                    audioPlayer.src = t.previewUrl;
                    audioPlayer.play();
                }
            });

            const addedAt = document.createElement("div");
            addedAt.className = "track-added-at";

            // リリース日を表示（iTunes APIのreleaseDate）
            if (t.releaseDate) {
                const releaseYear = new Date(t.releaseDate).getFullYear();
                addedAt.textContent = `リリース: ${releaseYear}年`;
            } else {
                addedAt.textContent = "";
            }

            actions.appendChild(previewBtn);
            actions.appendChild(addedAt);

            info.appendChild(title);
            info.appendChild(artist);
            info.appendChild(actions);

            card.appendChild(artwork);
            card.appendChild(info);

            col.appendChild(card);
        });

        playlistGrid.appendChild(col);
    });
}

// イベント登録
joinBoardBtn.addEventListener("click", joinBoard);
searchBtn.addEventListener("click", searchTracks);

boardIdInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") joinBoard();
});

keywordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchTracks();
});

// 初期処理
generateBirthYearGroups();
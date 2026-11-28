const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = 3001;

app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  res.header(
    "Access-Control-Allow-Origin",
    "http://localhost:5173"
  );

  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

/* =========================================================
 * SHARED RANDOMBUILD ROOMS + PLAYER STATISTICS
 * One room contains one team with up to 3 players.
 * All room members belong to team 1. The first player is the host.
 * ========================================================= */

const STATS_PORT = 3002;
const STATS_SERVER_BUILD_ID = "RB-LIFETIME-DELTA-20261128-01";

const STATS_FILE = path.join(__dirname, "randombuild-stats.json");
const MAX_ROOM_PLAYERS = 3;

const statsApp = express();
statsApp.use(express.json({ limit: "100kb" }));
statsApp.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && /^https?:\/\//i.test(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
  } else {
    res.header("Access-Control-Allow-Origin", "*");
  }
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Диагностический endpoint: позволяет точно проверить, что порт 3002
// обслуживает именно этот файл, а не старый оставшийся процесс Node.js.
statsApp.get("/api/stats/version", (req, res) => {
  return res.json({
    ok: true,
    build: STATS_SERVER_BUILD_ID,
    lifetimeDelta: true,
    lastBuildCost: true,
  });
});
// Текущая статистика уровня. lastBuildCost нужен только для отображения
// цены последнего сгенерированного билда в основном столбце.
function emptySharedStats() {
  return { kills: 0, money: 0, spent: 0, lastBuildCost: 0 };
}

function normaliseSharedStats(stats) {
  return {
    kills: Math.max(0, Math.floor(Number(stats?.kills) || 0)),
    money: Math.max(0, Math.floor(Number(stats?.money) || 0)),
    // spent — все расходы текущего уровня, участвующие в расчёте чистой прибыли.
    spent: Math.max(0, Math.floor(Number(stats?.spent) || 0)),
    // lastBuildCost — только последняя цена билда, которую видно в основном столбце.
    lastBuildCost: Math.max(0, Math.floor(Number(stats?.lastBuildCost) || 0)),
  };
}

// Накопительная статистика не содержит цену последнего билда:
// она хранит только полные суммы за всё прохождение.
function emptyLifetimeStats() {
  return { kills: 0, money: 0, spent: 0 };
}

function normaliseLifetimeStats(stats) {
  return {
    kills: Math.max(0, Math.floor(Number(stats?.kills) || 0)),
    money: Math.max(0, Math.floor(Number(stats?.money) || 0)),
    spent: Math.max(0, Math.floor(Number(stats?.spent) || 0)),
  };
}

// Для старых комнат без lifetimeStats используем текущие stats как стартовую базу.
function normalisePlayerLifetimeStats(player) {
  return normaliseLifetimeStats(player?.lifetimeStats ?? player?.stats);
}

function addSharedStats(baseStats, deltaStats) {
  const base = normaliseLifetimeStats(baseStats);
  const delta = normaliseLifetimeStats(deltaStats);
  return {
    kills: base.kills + delta.kills,
    money: base.money + delta.money,
    spent: base.spent + delta.spent,
  };
}

function normaliseNickname(value) {
  return String(value || "").trim().slice(0, 24);
}

function createEmptyRoomsState() {
  return { rooms: {} };
}

function loadSharedStats() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STATS_FILE, "utf8"));
    if (!parsed || typeof parsed !== "object") return createEmptyRoomsState();
    if (parsed.rooms && typeof parsed.rooms === "object") return parsed;

    // Старый формат автоматически переносим в отдельную комнату не делая его
    // доступным по ключу: это только страховка для существующего локального файла.
    return createEmptyRoomsState();
  } catch {
    return createEmptyRoomsState();
  }
}

let sharedStatsState = loadSharedStats();

function saveSharedStats() {
  const tempPath = `${STATS_FILE}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(sharedStatsState, null, 2), "utf8");
    fs.renameSync(tempPath, STATS_FILE);
  } catch (error) {
    console.error("Не удалось сохранить статистику RandomBuild:", error);
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
  }
}

function generateRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = "RB-";
    for (let i = 0; i < 5; i += 1) {
      code += alphabet[crypto.randomInt(0, alphabet.length)];
    }
  } while (sharedStatsState.rooms[code]);
  return code;
}

function publicRoom(room) {
  const players = {};
  for (const [slot, player] of Object.entries(room.players || {})) {
    if (!player) continue;
    players[slot] = {
      slot: Number(slot),
      team: Number(player.team),
      nickname: player.nickname,
      stats: normaliseSharedStats(player.stats),
      lifetimeStats: normalisePlayerLifetimeStats(player),
      lastSeen: Number(player.lastSeen) || 0,
    };
  }
  return {
    code: room.code,
    hostToken: room.hostToken,
    players,
    maxPlayers: MAX_ROOM_PLAYERS,
  };
}

function findPlayerByToken(token) {
  if (!token) return null;
  for (const room of Object.values(sharedStatsState.rooms)) {
    for (const [slot, player] of Object.entries(room.players || {})) {
      if (player && player.token === token) return { room, slot, player };
    }
  }
  return null;
}

function nicknameAlreadyUsed(room, nickname, exceptToken = "") {
  const normalized = normaliseNickname(nickname).toLocaleLowerCase();
  if (!normalized) return false;
  return Object.values(room.players || {}).some(
    (player) => player && player.token !== exceptToken && player.nickname.toLocaleLowerCase() === normalized
  );
}

function findRoom(code) {
  const normalized = String(code || "").trim().toUpperCase();
  return normalized ? sharedStatsState.rooms[normalized] || null : null;
}

function touchPlayer(found) {
  if (found?.player) found.player.lastSeen = Date.now();
}

statsApp.post("/api/room/create", (req, res) => {
  const nickname = normaliseNickname(req.body?.nickname);
  if (!nickname) return res.status(400).json({ error: "Ник не может быть пустым." });

  const roomCode = generateRoomCode();
  const token = crypto.randomBytes(24).toString("hex");
  const room = {
    code: roomCode,
    hostToken: token,
    createdAt: Date.now(),
    players: {},
  };

  room.players["1"] = {
    token,
    nickname,
    team: 1,
    stats: normaliseSharedStats(req.body?.legacyStats),
    lifetimeStats: normaliseLifetimeStats(req.body?.legacyLifetimeStats ?? req.body?.legacyStats),
    lastSeen: Date.now(),
  };

  sharedStatsState.rooms[roomCode] = room;
  saveSharedStats();

  return res.status(201).json({ token, player: publicRoom(room).players["1"], room: publicRoom(room) });
});

statsApp.post("/api/room/join", (req, res) => {
  const nickname = normaliseNickname(req.body?.nickname);
  const room = findRoom(req.body?.roomCode);
  const token = String(req.body?.token || "").trim();

  if (!nickname) return res.status(400).json({ error: "Ник не может быть пустым." });
  if (!room) return res.status(404).json({ error: "Комната с таким ключом не найдена." });

  // Повторное открытие браузера восстанавливает существующего игрока.
  if (token) {
    const existingSlot = Object.entries(room.players).find(([, player]) => player?.token === token);
    if (existingSlot) {
      const [slot, player] = existingSlot;
      player.lastSeen = Date.now();
      saveSharedStats();
      return res.json({ token: player.token, player: publicRoom(room).players[slot], room: publicRoom(room) });
    }
  }

  if (nicknameAlreadyUsed(room, nickname)) {
    return res.status(409).json({ error: "Игрок с таким ником уже находится в этой комнате." });
  }

  const freeSlot = Array.from({ length: MAX_ROOM_PLAYERS }, (_, i) => String(i + 1)).find(
    (slot) => !room.players[slot]
  );

  if (!freeSlot) return res.status(409).json({ error: "Команда уже заполнена. Максимум — 3 игрока." });

  const nextToken = crypto.randomBytes(24).toString("hex");
  const slotNumber = Number(freeSlot);
  room.players[freeSlot] = {
    token: nextToken,
    nickname,
    team: 1,
    stats: normaliseSharedStats(req.body?.legacyStats),
    lifetimeStats: normaliseLifetimeStats(req.body?.legacyLifetimeStats ?? req.body?.legacyStats),
    lastSeen: Date.now(),
  };

  saveSharedStats();
  return res.status(201).json({ token: nextToken, player: publicRoom(room).players[freeSlot], room: publicRoom(room) });
});

statsApp.post("/api/room/nickname", (req, res) => {
  const token = String(req.body?.token || "").trim();
  const nickname = normaliseNickname(req.body?.nickname);
  const found = findPlayerByToken(token);

  if (!nickname) return res.status(400).json({ error: "Ник не может быть пустым." });
  if (!found) return res.status(401).json({ error: "Сессия игрока не найдена." });
  if (nicknameAlreadyUsed(found.room, nickname, token)) {
    return res.status(409).json({ error: "Игрок с таким ником уже находится в этой комнате." });
  }

  found.player.nickname = nickname;
  touchPlayer(found);
  saveSharedStats();

  return res.json({
    player: publicRoom(found.room).players[found.slot],
    room: publicRoom(found.room),
  });
});

statsApp.get("/api/room", (req, res) => {
  const token = String(req.query?.token || "").trim();
  const found = findPlayerByToken(token);
  if (!found) return res.status(401).json({ error: "Сессия игрока не найдена." });
  touchPlayer(found);
  saveSharedStats();
  return res.json({ player: publicRoom(found.room).players[found.slot], room: publicRoom(found.room) });
});

statsApp.post("/api/room/leave", (req, res) => {
  const token = String(req.body?.token || "").trim();
  const found = findPlayerByToken(token);
  if (!found) return res.status(401).json({ error: "Сессия игрока не найдена." });

  const wasHost = found.player.token === found.room.hostToken;
  delete found.room.players[found.slot];

  // Выход организатора не должен выкидывать остальных участников.
  // Передаём право хоста следующему игроку по номеру слота.
  const remainingPlayers = Object.entries(found.room.players || {})
    .filter(([, player]) => Boolean(player))
    .sort(([slotA], [slotB]) => Number(slotA) - Number(slotB));

  if (remainingPlayers.length === 0) {
    delete sharedStatsState.rooms[found.room.code];
  } else if (wasHost) {
    found.room.hostToken = remainingPlayers[0][1].token;
  }

  saveSharedStats();
  return res.json({ ok: true });
});

statsApp.post("/api/stats/update", (req, res) => {
  const token = String(req.body?.token || "").trim();
  const found = findPlayerByToken(token);
  if (!found) return res.status(401).json({ error: "Сессия игрока не найдена." });

  if (!req.body?.stats || typeof req.body.stats !== "object") {
    return res.status(400).json({ error: "Некорректные данные статистики." });
  }

  // Сохраняем прежний накопительный итог до замены прогресса текущего уровня.
  // Приращения применяются на сервере и не могут быть затёрты сбросом уровня.
  const previousLifetime = normalisePlayerLifetimeStats(found.player);
  found.player.stats = normaliseSharedStats(req.body.stats);

  if (req.body.resetLifetime === true) {
    found.player.lifetimeStats = emptyLifetimeStats();
  } else if (req.body.lifetimeDelta && typeof req.body.lifetimeDelta === "object") {
    found.player.lifetimeStats = addSharedStats(previousLifetime, req.body.lifetimeDelta);
  } else {
    // Запрос, который меняет только показатели уровня, сохраняет накопительный итог.
    // Полные клиентские снимки не принимаем: они могли бы затереть более свежие суммы.
    found.player.lifetimeStats = previousLifetime;
  }
  touchPlayer(found);
  saveSharedStats();

  return res.json({ player: publicRoom(found.room).players[found.slot], room: publicRoom(found.room) });
});

statsApp.post("/api/stats/reset", (req, res) => {
  const token = String(req.body?.token || "").trim();
  const found = findPlayerByToken(token);
  if (!found) return res.status(401).json({ error: "Сессия игрока не найдена." });

  found.player.stats = emptySharedStats();
  found.player.lifetimeStats = emptyLifetimeStats();
  touchPlayer(found);
  saveSharedStats();

  return res.json({ player: publicRoom(found.room).players[found.slot], room: publicRoom(found.room) });
});

statsApp.listen(STATS_PORT, "0.0.0.0", () => {
  console.log(`RandomBuild Room Server запущен: http://0.0.0.0:${STATS_PORT} [${STATS_SERVER_BUILD_ID}]`);
});

/* =========================================================
 * HUNT LOCAL LOG AUTO-DISCOVERY
 * Uses Windows/Steam local metadata only. No third-party API.
 * ========================================================= */
const { execFileSync, spawn } = require("child_process");
const os = require("os");

const HUNT_STEAM_APP_ID = "594650";
const HUNT_GAME_FOLDER_NAMES = [
  "Hunt Showdown 1896",
  "Hunt Showdown",
];

function safeReadText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function readSteamRegistryPath(key, valueName) {
  if (process.platform !== "win32") return "";

  try {
    const output = execFileSync(
      "reg.exe",
      ["query", key, "/v", valueName],
      { encoding: "utf8", windowsHide: true, timeout: 3000 }
    );
    const match = output.match(new RegExp(`\\b${valueName}\\s+REG_SZ\\s+(.+)$`, "im"));
    return match ? match[1].trim() : "";
  } catch {
    return "";
  }
}

function normaliseSteamPath(value) {
  if (!value) return "";
  return path.win32.normalize(value.replace(/\\\\/g, "\\").replace(/\//g, "\\").trim());
}

function uniquePaths(paths) {
  const seen = new Set();
  const result = [];
  for (const value of paths) {
    if (!value) continue;
    const resolved = normaliseSteamPath(value);
    const key = resolved.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(resolved);
    }
  }
  return result;
}

function getRegisteredSteamRoots() {
  const roots = [
    readSteamRegistryPath("HKCU\\Software\\Valve\\Steam", "SteamPath"),
    readSteamRegistryPath("HKCU\\Software\\Valve\\Steam", "InstallPath"),
    readSteamRegistryPath("HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam", "InstallPath"),
    readSteamRegistryPath("HKLM\\SOFTWARE\\Valve\\Steam", "InstallPath"),
    process.env["ProgramFiles(x86)"] ? path.win32.join(process.env["ProgramFiles(x86)"], "Steam") : "",
    process.env.ProgramFiles ? path.win32.join(process.env.ProgramFiles, "Steam") : "",
    path.win32.join(os.homedir(), "AppData", "Local", "Programs", "Steam"),
  ];

  // A few conventional roots are checked on every mounted drive. This is a
  // bounded search: we do NOT recursively crawl the whole computer.
  if (process.platform === "win32") {
    for (let code = 67; code <= 90; code += 1) {
      const drive = `${String.fromCharCode(code)}:\\`;
      if (!fs.existsSync(drive)) continue;
      roots.push(
        path.win32.join(drive, "Steam"),
        path.win32.join(drive, "SteamLibrary"),
        path.win32.join(drive, "Games", "Steam"),
        path.win32.join(drive, "Games", "SteamLibrary"),
        path.win32.join(drive, "Program Files (x86)", "Steam"),
        path.win32.join(drive, "Program Files", "Steam")
      );
    }
  }

  return uniquePaths(roots).filter((root) => fs.existsSync(root));
}

function getSteamLibraries(steamRoots) {
  const libraries = [...steamRoots];
  const pathEntry = /"path"\s+"((?:\\.|[^"])*)"/g;

  for (const steamRoot of steamRoots) {
    const vdfPath = path.win32.join(steamRoot, "steamapps", "libraryfolders.vdf");
    const vdf = safeReadText(vdfPath);
    let match;
    while ((match = pathEntry.exec(vdf)) !== null) {
      const libraryPath = match[1].replace(/\\\\/g, "\\").replace(/\\"/g, '"');
      if (libraryPath) libraries.push(libraryPath);
    }
  }

  return uniquePaths(libraries);
}

function getInstallDirectoryFromManifest(libraryPath) {
  const manifestPath = path.win32.join(
    libraryPath,
    "steamapps",
    `appmanifest_${HUNT_STEAM_APP_ID}.acf`
  );
  const manifest = safeReadText(manifestPath);
  const match = manifest.match(/"installdir"\s+"([^"]+)"/i);
  return match ? match[1].trim() : "";
}

function discoverHuntGameLogs() {
  const steamRoots = getRegisteredSteamRoots();
  const libraries = getSteamLibraries(steamRoots);
  const candidates = [];

  for (const libraryPath of libraries) {
    const manifestInstallDir = getInstallDirectoryFromManifest(libraryPath);
    const folderNames = manifestInstallDir
      ? [manifestInstallDir, ...HUNT_GAME_FOLDER_NAMES]
      : HUNT_GAME_FOLDER_NAMES;

    for (const folderName of [...new Set(folderNames)]) {
      const gameDirectory = path.win32.join(
        libraryPath,
        "steamapps",
        "common",
        folderName
      );
      const userDirectory = path.win32.join(gameDirectory, "USER");
      const logPath = path.win32.join(userDirectory, "Game.log");
      const backupDirectory = path.win32.join(userDirectory, "LogBackups");
      const manifestExists = fs.existsSync(path.win32.join(
        libraryPath,
        "steamapps",
        `appmanifest_${HUNT_STEAM_APP_ID}.acf`
      ));

      const userDirectoryExists = fs.existsSync(userDirectory);
      if (!manifestExists && !userDirectoryExists) continue;
      if (manifestExists && folderName !== manifestInstallDir && !userDirectoryExists) continue;

      let modifiedAt = 0;
      let logExists = false;
      try {
        const stat = fs.statSync(logPath);
        logExists = stat.isFile();
        modifiedAt = stat.mtimeMs;
      } catch {
        // Game.log может отсутствовать после ротации, но резервные журналы
        // в USER\LogBackups всё ещё позволяют определить установку.
      }

      let newestBackupModifiedAt = 0;
      try {
        for (const entry of fs.readdirSync(backupDirectory, { withFileTypes: true })) {
          // LogBackups may contain .log or .txt files; Windows Explorer can hide
          // the extension. The directory itself is dedicated to log backups.
          if (!entry.isFile() || /\.(tmp|bak|old)$/i.test(entry.name)) continue;
          const backupStat = fs.statSync(path.win32.join(backupDirectory, entry.name));
          if (backupStat.isFile()) newestBackupModifiedAt = Math.max(newestBackupModifiedAt, backupStat.mtimeMs);
        }
      } catch {
        // Папка LogBackups может ещё не существовать на новой установке.
      }

      if (!modifiedAt) {
        try { modifiedAt = fs.statSync(userDirectory).mtimeMs; } catch { modifiedAt = 0; }
      }
      modifiedAt = Math.max(modifiedAt, newestBackupModifiedAt);

      candidates.push({
        libraryPath,
        gameDirectory,
        userDirectory,
        logPath,
        backupDirectory,
        logExists,
        modifiedAt,
        newestBackupModifiedAt,
        source: manifestExists ? "Steam app manifest + libraryfolders.vdf" : "Known Steam folder",
      });
    }
  }

  // Prefer an existing, recently written Game.log. If Hunt has never been
  // launched on this PC, return the detected install's expected log location
  // and wait for the game to create USER/Game.log.
  candidates.sort((a, b) => b.modifiedAt - a.modifiedAt);

  const deduped = [];
  const seenLogs = new Set();
  for (const candidate of candidates) {
    const key = candidate.logPath.toLowerCase();
    if (seenLogs.has(key)) continue;
    seenLogs.add(key);
    deduped.push(candidate);
  }
  return deduped;
}

const huntLogProbe = {
  timer: null,
  logPath: null,
  installDirectory: null,
  backupDirectory: null,
  discoverySource: null,
  discoveredCandidates: [],
  lastDiscoveryAt: null,
  logStartedAt: null,
  logIdentity: null,
  lastFileWriteAt: null,
  fileIdentity: null,
  offset: 0,
  partialLine: "",
  lineNumber: 0,
  initializedFile: false,
  expectingFirstLogCreation: false,
  baselinePending: false,
  error: null,
  status: "searching",
  gameProcessRunning: null,
  processCheckError: null,
  lastProcessCheckAt: 0,
  lastGameState: "unknown",
  lastLobbyId: null,
  lastMissionId: null,
  activeMatch: null,
  pendingSummary: null,
  sequence: 0,
  events: [],
  eventDedupeKeys: new Set(),
};

// Отдельный монитор резервных журналов. Game.log остаётся живым источником
// текущего состояния, а из LogBackups читается самый свежий файл по LastWriteTime.
// При появлении более свежего файла считыватель автоматически переключается.
const HUNT_BACKUP_LOG_LIMIT = 1;
const HUNT_BACKUP_RESCAN_MS = 5000;
const huntBackupProbe = {
  directory: null,
  lastScanAt: null,
  nextScanAt: 0,
  error: null,
  latestFiles: [],
  fileStates: new Map(),
};

// Проверяем наличие процесса Hunt. При открытой игре индикатор "Отдых"
// горит в меню/лобби, а "Охота" — только во время активной игровой сессии.
function refreshHuntProcessState(force = false) {
  const now = Date.now();
  if (!force && now - huntLogProbe.lastProcessCheckAt < 1500) return;
  huntLogProbe.lastProcessCheckAt = now;

  if (process.platform !== "win32") {
    huntLogProbe.gameProcessRunning = null;
    huntLogProbe.processCheckError = "Проверка процесса Hunt поддерживается на Windows.";
    return;
  }

  try {
    const output = execFileSync(
      "tasklist.exe",
      ["/FI", "IMAGENAME eq HuntGame.exe", "/FO", "CSV", "/NH"],
      { encoding: "utf8", windowsHide: true, timeout: 3000 }
    );
    huntLogProbe.gameProcessRunning = /^\s*"HuntGame\.exe"/im.test(output);
    huntLogProbe.processCheckError = null;
  } catch (error) {
    huntLogProbe.gameProcessRunning = null;
    huntLogProbe.processCheckError = error.message || String(error);
  }
}

function getHuntActivity() {
  refreshHuntProcessState();

  if (huntLogProbe.gameProcessRunning === false) return "offline";
  if (huntLogProbe.gameProcessRunning !== true) return "unknown";

  if (huntLogProbe.activeMatch && huntLogProbe.lastGameState === "Game") {
    return "hunt";
  }

  return "rest";
}

function emitHuntLogEvent(type, rawLine, logTime, match = null, replayed = false, source = {}) {
  const sourcePath = source.sourcePath || huntLogProbe.logPath;
  const lineNumber = Number.isInteger(source.lineNumber) ? source.lineNumber : huntLogProbe.lineNumber;
  const sourceIdentity = source.logIdentity || huntLogProbe.logIdentity || sourcePath || "unknown-log";
  // Один и тот же Game.log может позже появиться в LogBackups под другим именем.
  // Log Started at + номер строки + тип события позволяют распознать такую копию.
  const dedupeKey = `${sourceIdentity}|${lineNumber}|${type}`;
  if (huntLogProbe.eventDedupeKeys.has(dedupeKey)) return null;
  huntLogProbe.eventDedupeKeys.add(dedupeKey);
  if (huntLogProbe.eventDedupeKeys.size > 5000) {
    const keep = [...huntLogProbe.eventDedupeKeys].slice(-2500);
    huntLogProbe.eventDedupeKeys = new Set(keep);
  }

  const event = {
    seq: ++huntLogProbe.sequence,
    eventId: crypto.randomUUID(),
    type,
    source: sourcePath,
    sourceKind: source.sourceKind || "Game.log",
    sourceIdentity,
    lineNumber,
    logTime: logTime || null,
    observedAt: new Date().toISOString(),
    lobbyId: (match && match.lobbyId) || source.lobbyId || huntLogProbe.lastLobbyId,
    missionId: (match && match.missionId) || source.missionId || huntLogProbe.lastMissionId,
    matchId: (match && match.matchId) || null,
    replayed,
    rawLine: String(rawLine).trim().slice(0, 500),
  };
  huntLogProbe.events.push(event);
  if (huntLogProbe.events.length > 500) huntLogProbe.events.shift();
  console.log(`[HUNT ${source.sourceKind || "Game.log"} ${replayed ? "HISTORY" : "LIVE"}] ${type} lobby=${event.lobbyId || "-"}`);
  return event;
}

function processHuntLogLine(line, publishEvents) {
  huntLogProbe.lineNumber += 1;
  const startedAtMatch = line.match(/^Log Started at (.+?)\s*$/i);
  if (startedAtMatch) {
    huntLogProbe.logStartedAt = startedAtMatch[1].trim();
    huntLogProbe.logIdentity = huntLogProbe.logStartedAt;
  }
  const timeMatch = line.match(/<(\d{2}:\d{2}:\d{2})>/);
  const logTime = timeMatch ? timeMatch[1] : null;
  const lobbyMatch = line.match(/Lobby:\s*(\d+)/);
  const missionMatch = line.match(/\bmission=([0-9a-f-]{20,})/i);
  if (lobbyMatch) huntLogProbe.lastLobbyId = lobbyMatch[1];
  if (missionMatch) huntLogProbe.lastMissionId = missionMatch[1];

  const transition = line.match(/transition from state\(eLS_([A-Za-z]+)\)\s+to \(eLS_([A-Za-z]+)\)/);
  if (transition) {
    const fromState = transition[1];
    const toState = transition[2];
    huntLogProbe.lastGameState = toState;

    if (toState === "Game" && ["Loading", "ConnectToGame", "PreGame", "Lobby"].includes(fromState)) {
      huntLogProbe.activeMatch = {
        matchId: `${huntLogProbe.lastLobbyId || "unknown-lobby"}:${huntLogProbe.lineNumber}`,
        startLine: huntLogProbe.lineNumber,
        startTime: logTime,
        lobbyId: huntLogProbe.lastLobbyId,
        missionId: huntLogProbe.lastMissionId,
      };
      huntLogProbe.pendingSummary = null;
      if (publishEvents) emitHuntLogEvent("match_candidate_started", line, logTime, huntLogProbe.activeMatch, false);
    } else if (fromState === "Game" && toState === "Leaving" && huntLogProbe.activeMatch) {
      huntLogProbe.activeMatch.leaveLine = huntLogProbe.lineNumber;
      huntLogProbe.activeMatch.leaveTime = logTime;
      huntLogProbe.pendingSummary = huntLogProbe.activeMatch;
      if (publishEvents) emitHuntLogEvent("match_candidate_left_game", line, logTime, huntLogProbe.pendingSummary, false);
      huntLogProbe.activeMatch = null;
    }
  }

  const uiStart = line.match(/Starting UI state machine '([^']+)'\./);
  if (uiStart) {
    if (uiStart[1] === "post_match_summary/StateMachine") {
      if (huntLogProbe.pendingSummary) {
        if (publishEvents) emitHuntLogEvent("post_match_summary_opened", line, logTime, huntLogProbe.pendingSummary, false);
        huntLogProbe.pendingSummary = null;
      } else if (publishEvents) {
        emitHuntLogEvent("post_match_summary_unpaired", line, logTime, null, false);
      }
    } else if (uiStart[1] === "death/StateMachine") {
      if (publishEvents) emitHuntLogEvent("player_death_screen_opened", line, logTime, huntLogProbe.activeMatch, false);
    }
  }
}

function createBackupFileState(filePath, stat) {
  return {
    filePath,
    identity: `${stat.dev}:${stat.ino}:${stat.birthtimeMs}`,
    offset: 0,
    partialLine: "",
    lineNumber: 0,
    logStartedAt: null,
    lastWriteAt: stat.mtime.toISOString(),
    size: stat.size,
    summary: {
      matchStarts: 0,
      matchLeaves: 0,
      postMatchSummaries: 0,
      deathScreens: 0,
      logStartedAt: null,
    },
    lastLobbyId: null,
    lastMissionId: null,
    lastGameState: "unknown",
    activeMatch: null,
    pendingSummary: null,
  };
}

// Резервные файлы обрабатываются изолированно: они не могут перезаписать
// текущее состояние Hunt, восстановленное из живого Game.log.
function processHuntBackupLine(line, state) {
  state.lineNumber += 1;
  const startedAtMatch = line.match(/^Log Started at (.+?)\s*$/i);
  if (startedAtMatch) {
    state.logStartedAt = startedAtMatch[1].trim();
    state.summary.logStartedAt = state.logStartedAt;
  }

  const timeMatch = line.match(/<(\d{2}:\d{2}:\d{2})>/);
  const logTime = timeMatch ? timeMatch[1] : null;
  const lobbyMatch = line.match(/Lobby:\s*(\d+)/);
  const missionMatch = line.match(/\bmission=([0-9a-f-]{20,})/i);
  if (lobbyMatch) state.lastLobbyId = lobbyMatch[1];
  if (missionMatch) state.lastMissionId = missionMatch[1];

  const source = {
    sourcePath: state.filePath,
    sourceKind: "LogBackups",
    lineNumber: state.lineNumber,
    logIdentity: state.logStartedAt || state.filePath,
    lobbyId: state.lastLobbyId,
    missionId: state.lastMissionId,
  };

  const transition = line.match(/transition from state\(eLS_([A-Za-z]+)\)\s+to \(eLS_([A-Za-z]+)\)/);
  if (transition) {
    const fromState = transition[1];
    const toState = transition[2];
    state.lastGameState = toState;

    if (toState === "Game" && ["Loading", "ConnectToGame", "PreGame", "Lobby"].includes(fromState)) {
      state.summary.matchStarts += 1;
      state.activeMatch = {
        matchId: `${state.lastLobbyId || "unknown-lobby"}:backup:${state.lineNumber}`,
        startLine: state.lineNumber,
        startTime: logTime,
        lobbyId: state.lastLobbyId,
        missionId: state.lastMissionId,
      };
      state.pendingSummary = null;
      emitHuntLogEvent("match_candidate_started", line, logTime, state.activeMatch, true, source);
    } else if (fromState === "Game" && toState === "Leaving" && state.activeMatch) {
      state.summary.matchLeaves += 1;
      state.activeMatch.leaveLine = state.lineNumber;
      state.activeMatch.leaveTime = logTime;
      state.pendingSummary = state.activeMatch;
      emitHuntLogEvent("match_candidate_left_game", line, logTime, state.pendingSummary, true, source);
      state.activeMatch = null;
    }
  }

  const uiStart = line.match(/Starting UI state machine '([^']+)'\./);
  if (uiStart) {
    if (uiStart[1] === "post_match_summary/StateMachine") {
      state.summary.postMatchSummaries += 1;
      if (state.pendingSummary) {
        emitHuntLogEvent("post_match_summary_opened", line, logTime, state.pendingSummary, true, source);
        state.pendingSummary = null;
      } else {
        emitHuntLogEvent("post_match_summary_unpaired", line, logTime, null, true, source);
      }
    } else if (uiStart[1] === "death/StateMachine") {
      state.summary.deathScreens += 1;
      emitHuntLogEvent("player_death_screen_opened", line, logTime, state.activeMatch, true, source);
    }
  }
}

function readBackupLogIncrementally(filePath, stat) {
  const key = filePath.toLowerCase();
  const identity = `${stat.dev}:${stat.ino}:${stat.birthtimeMs}`;
  let state = huntBackupProbe.fileStates.get(key);

  if (!state || state.identity !== identity || stat.size < state.offset) {
    state = createBackupFileState(filePath, stat);
    huntBackupProbe.fileStates.set(key, state);
  }

  state.lastWriteAt = stat.mtime.toISOString();
  state.size = stat.size;
  const bytesToRead = stat.size - state.offset;
  if (bytesToRead > 0) {
    const fd = fs.openSync(filePath, "r");
    try {
      let remaining = bytesToRead;
      let position = state.offset;
      while (remaining > 0) {
        const chunk = Buffer.alloc(Math.min(remaining, 1024 * 1024));
        const bytesRead = fs.readSync(fd, chunk, 0, chunk.length, position);
        if (bytesRead <= 0) break;
        position += bytesRead;
        state.offset += bytesRead;
        remaining -= bytesRead;

        const text = state.partialLine + chunk.subarray(0, bytesRead).toString("utf8");
        const lines = text.split(/\n/);
        state.partialLine = lines.pop() || "";
        for (const rawLine of lines) {
          processHuntBackupLine(rawLine.replace(/\r$/, ""), state);
        }
      }
    } finally {
      fs.closeSync(fd);
    }
  }

  return state;
}

function pollHuntBackupLogs(force = false) {
  const now = Date.now();
  if (!force && now < huntBackupProbe.nextScanAt) return;
  huntBackupProbe.nextScanAt = now + HUNT_BACKUP_RESCAN_MS;
  huntBackupProbe.lastScanAt = new Date(now).toISOString();

  const directory = huntLogProbe.backupDirectory;
  huntBackupProbe.directory = directory || null;
  if (!directory) {
    huntBackupProbe.latestFiles = [];
    huntBackupProbe.error = "Путь USER\\LogBackups не определён: папка установки Hunt пока не найдена.";
    return;
  }

  let latest;
  try {
    latest = fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && !/\.(tmp|bak|old)$/i.test(entry.name))
      .map((entry) => {
        const filePath = path.join(directory, entry.name);
        const stat = fs.statSync(filePath);
        return { filePath, name: entry.name, stat };
      })
      .filter((entry) => entry.stat.isFile())
      // Не используем имя файла для определения свежести: только LastWriteTime.
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
      .slice(0, HUNT_BACKUP_LOG_LIMIT);
  } catch (error) {
    huntBackupProbe.latestFiles = [];
    huntBackupProbe.error = error.message || String(error);
    return;
  }

  const retainedKeys = new Set(latest.map((entry) => entry.filePath.toLowerCase()));
  for (const entry of latest) {
    try {
      const state = readBackupLogIncrementally(entry.filePath, entry.stat);
      entry.state = state;
    } catch (error) {
      entry.readError = error.message || String(error);
    }
  }

  // Состояние предыдущего резервного файла удаляется после переключения
  // на более свежий, чтобы Map не росла бесконечно.
  for (const key of huntBackupProbe.fileStates.keys()) {
    if (!retainedKeys.has(key)) huntBackupProbe.fileStates.delete(key);
  }

  huntBackupProbe.latestFiles = latest.map((entry, index) => ({
    name: entry.name,
    path: entry.filePath,
    lastWriteAt: entry.stat.mtime.toISOString(),
    sizeBytes: entry.stat.size,
    newest: index === 0,
    linesProcessed: entry.state ? entry.state.lineNumber : 0,
    logStartedAt: entry.state ? entry.state.logStartedAt : null,
    summary: entry.state ? entry.state.summary : null,
    error: entry.readError || null,
  }));
  huntBackupProbe.error = latest.some((entry) => entry.readError)
    ? "Не все резервные журналы удалось прочитать; подробности указаны в списке файлов."
    : null;
}

function attachToDiscoveredLog() {
  const discovered = discoverHuntGameLogs();
  huntLogProbe.discoveredCandidates = discovered.map((item) => ({
    logPath: item.logPath,
    backupDirectory: item.backupDirectory,
    logExists: item.logExists,
    newestBackupModifiedAt: item.newestBackupModifiedAt || 0,
    source: item.source,
  }));
  huntLogProbe.lastDiscoveryAt = new Date().toISOString();

  if (discovered.length === 0) {
    huntLogProbe.status = "hunt_not_found";
    huntLogProbe.error = "Hunt: Showdown не найден в зарегистрированных библиотеках Steam и стандартных папках дисков.";
    return;
  }

  const selected = discovered[0];
  if (huntLogProbe.logPath && huntLogProbe.logPath.toLowerCase() === selected.logPath.toLowerCase()) {
    return;
  }

  huntLogProbe.logPath = selected.logPath;
  huntLogProbe.installDirectory = selected.gameDirectory;
  huntLogProbe.backupDirectory = selected.backupDirectory;
  huntLogProbe.discoverySource = selected.source;
  huntBackupProbe.directory = selected.backupDirectory;
  huntBackupProbe.latestFiles = [];
  huntBackupProbe.fileStates.clear();
  huntBackupProbe.error = null;
  huntBackupProbe.nextScanAt = 0;
  huntLogProbe.logStartedAt = null;
  huntLogProbe.logIdentity = null;
  huntLogProbe.fileIdentity = null;
  huntLogProbe.offset = 0;
  huntLogProbe.partialLine = "";
  huntLogProbe.lineNumber = 0;
  huntLogProbe.initializedFile = false;
  // If Hunt has not created Game.log yet, treat its first lines as live.
  // This lets the watcher catch the very first session on a fresh install.
  huntLogProbe.expectingFirstLogCreation = !selected.logExists;
  huntLogProbe.activeMatch = null;
  huntLogProbe.pendingSummary = null;
  huntLogProbe.lastGameState = "unknown";
  huntLogProbe.status = selected.logExists ? "log_found" : "waiting_for_game_log";
  huntLogProbe.error = null;
}

function pollHuntGameLog() {
  try {
    refreshHuntProcessState();

    if (
      !huntLogProbe.lastDiscoveryAt ||
      Date.now() - Date.parse(huntLogProbe.lastDiscoveryAt) > 15000
    ) {
      // Re-check libraries occasionally in case the player added another drive/library.
      attachToDiscoveredLog();
    }

    // Параллельно читаем самый свежий резервный журнал независимо
    // от наличия/ротации текущего Game.log.
    pollHuntBackupLogs();

    if (!huntLogProbe.logPath) return;

    let stat;
    try {
      stat = fs.statSync(huntLogProbe.logPath);
    } catch {
      huntLogProbe.status = "waiting_for_game_log";
      huntLogProbe.error = "Game.log пока не создан. Ожидаю запуск Hunt.";
      huntLogProbe.initializedFile = false;
      return;
    }

    if (!stat.isFile()) return;
    huntLogProbe.lastFileWriteAt = stat.mtime.toISOString();
    const identity = `${stat.dev}:${stat.ino}:${stat.birthtimeMs}`;
    if (!huntLogProbe.initializedFile || huntLogProbe.fileIdentity !== identity || stat.size < huntLogProbe.offset) {
      const firstLogCreatedWhileWaiting =
        !huntLogProbe.initializedFile && huntLogProbe.expectingFirstLogCreation;
      // Existing log contents and rotated files are baseline history. If the
      // log is created after startup, its first records are live observations.
      huntLogProbe.baselinePending = !firstLogCreatedWhileWaiting;
      huntLogProbe.offset = 0;
      huntLogProbe.partialLine = "";
      huntLogProbe.lineNumber = 0;
      huntLogProbe.activeMatch = null;
      huntLogProbe.pendingSummary = null;
      huntLogProbe.lastGameState = "unknown";
      huntLogProbe.logStartedAt = null;
      huntLogProbe.logIdentity = null;
      huntLogProbe.fileIdentity = identity;
      huntLogProbe.initializedFile = true;
      huntLogProbe.expectingFirstLogCreation = false;
      // A newly created log is read as live only when we started waiting for
      // Hunt to create it. Existing logs and rotations are baselined.

    }

    const bytesToRead = stat.size - huntLogProbe.offset;
    if (bytesToRead <= 0) {
      if (huntLogProbe.baselinePending && huntLogProbe.offset >= stat.size) {
        huntLogProbe.baselinePending = false;
      }
      huntLogProbe.status = huntLogProbe.activeMatch ? "in_game_session" : "watching";
      huntLogProbe.error = null;
      return;
    }

    const fd = fs.openSync(huntLogProbe.logPath, "r");
    try {
      const chunk = Buffer.alloc(Math.min(bytesToRead, 1024 * 1024));
      const bytesRead = fs.readSync(fd, chunk, 0, chunk.length, huntLogProbe.offset);
      huntLogProbe.offset += bytesRead;
      const text = huntLogProbe.partialLine + chunk.subarray(0, bytesRead).toString("utf8");
      const lines = text.split(/\n/);
      huntLogProbe.partialLine = lines.pop() || "";

      for (const rawLine of lines) {
        processHuntLogLine(rawLine.replace(/\r$/, ""), !huntLogProbe.baselinePending);
      }
      if (huntLogProbe.baselinePending && huntLogProbe.offset >= stat.size) {
        huntLogProbe.baselinePending = false;
      }
    } finally {
      fs.closeSync(fd);
    }

    huntLogProbe.status = huntLogProbe.activeMatch ? "in_game_session" : "watching";
    huntLogProbe.error = null;
  } catch (error) {
    huntLogProbe.error = error.message || String(error);
    huntLogProbe.status = "error";
  }
}

function startHuntLogAutoDiscovery() {
  if (huntLogProbe.timer) return;
  pollHuntGameLog();
  huntLogProbe.timer = setInterval(pollHuntGameLog, 1000);
}

/* =========================================================
 * LOCAL SCREEN READER
 * Captures Hunt's visible UI through Windows PowerShell + Windows OCR.
 * No external services, APIs, or Python installation are used.
 * ========================================================= */
const HUNT_SCREEN_STATE_FILE = path.join(__dirname, "hunt-screen-state.json");

function readHuntScreenPersistence() {
  try {
    const saved = JSON.parse(fs.readFileSync(HUNT_SCREEN_STATE_FILE, "utf8"));
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

const savedHuntScreenState = readHuntScreenPersistence();
let huntScreenReaderShuttingDown = false;
const huntScreenReader = {
  process: null,
  running: false,
  error: null,
  lastStatus: "starting",
  lastCaptureAt: null,
  screenWidth: null,
  screenHeight: null,
  windowTitle: "",
  windowProcessId: null,
  windowX: null,
  windowY: null,
  windowCount: 0,
  captureMethod: "",
  scanArea: "unknown",
  virtualScreenX: null,
  virtualScreenY: null,
  virtualScreenWidth: null,
  virtualScreenHeight: null,
  monitorCount: 0,
  monitorsScanned: [],
  targetFound: false,
  balance: null,
  balanceText: "",
  moneyOcrText: "",
  screenMode: "unknown",
  headerOcrText: "",
  loadoutAnchorCount: 0,
  ocrLanguage: "",
  catalogLines: [],
  catalogCards: [],
  expectedLoadout: [],
  slotMatches: {},
  matchDetails: [],
  activeEquipmentSlot: null,
  equippedSelections: {},
  pendingCatalogClick: null,
  inputEventsProcessed: 0,
  lastInputEvent: null,
  candidateBalance: null,
  candidateBalanceCount: 0,
  stableBalance: savedHuntScreenState.matchBaseline !== null &&
    savedHuntScreenState.matchBaseline !== undefined &&
    Number.isFinite(Number(savedHuntScreenState.matchBaseline))
    ? Number(savedHuntScreenState.matchBaseline)
    : null,
  stableBalanceAt: 0,
  matchBaseline: savedHuntScreenState.matchBaseline !== null &&
    savedHuntScreenState.matchBaseline !== undefined &&
    Number.isFinite(Number(savedHuntScreenState.matchBaseline))
    ? Number(savedHuntScreenState.matchBaseline)
    : null,
  lastActivity: savedHuntScreenState.lastActivity || null,
  awaitingPostMatchBalance: false,
  returnedToLobbyAt: 0,
  activeMatchId: null,
  moneyEvent: savedHuntScreenState.moneyEvent || null,
  moneyEvents: Array.isArray(savedHuntScreenState.moneyEvents) ? savedHuntScreenState.moneyEvents : [],
  restartTimer: null,
  stdoutBuffer: "",
  lastEquipmentScanAt: null,
};

function saveHuntScreenPersistence() {
  const state = {
    lastActivity: huntScreenReader.lastActivity,
    matchBaseline: huntScreenReader.matchBaseline,
    moneyEvent: huntScreenReader.moneyEvent,
    moneyEvents: huntScreenReader.moneyEvents.slice(-50),
  };
  const temporaryPath = `${HUNT_SCREEN_STATE_FILE}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, JSON.stringify(state, null, 2), "utf8");
    fs.renameSync(temporaryPath, HUNT_SCREEN_STATE_FILE);
  } catch (error) {
    console.error("Не удалось сохранить состояние считывания Hunt:", error.message);
    try { fs.unlinkSync(temporaryPath); } catch {}
  }
}

function normalizeScreenText(value) {
  return String(value || "")
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zа-я0-9]/gi, "");
}

function getCatalogCardIndex(line, screenWidth, screenHeight) {
  const x = Number(line.x);
  const y = Number(line.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !screenWidth || !screenHeight) return null;

  // Geometry is normalized to the detected Hunt client area. The supplied
  // two-monitor screenshots place the 3 catalogue columns at roughly 35.5%,
  // 56.5% and 77.5%; visible rows advance by about 21% of client height.
  const nx = x / screenWidth;
  const ny = y / screenHeight;
  const column = Math.floor((nx - 0.35) / 0.21);
  const row = Math.floor((ny - 0.31) / 0.21);
  if (column < 0 || column > 2 || row < 0 || row > 3) return null;
  return `${row}:${column}`;
}

function getQuantityMarker(text) {
  const value = String(text || "").toLowerCase().replace(/х/g, "x").replace(/×/g, "x");
  const matches = [
    ...value.matchAll(/\bx\s*(\d{1,2})\b/g),
    ...value.matchAll(/\b(\d{1,2})\s*x\b/g),
  ];
  return matches.length ? Math.max(...matches.map((match) => Number(match[1]) || 0)) : 0;
}

function buildCatalogCards(lines, screenWidth, screenHeight) {
  const cards = new Map();
  for (const line of Array.isArray(lines) ? lines : []) {
    const cardId = getCatalogCardIndex(line, screenWidth, screenHeight);
    if (!cardId) continue;
    if (!cards.has(cardId)) cards.set(cardId, { id: cardId, text: "", lines: [] });
    const card = cards.get(cardId);
    const text = String(line.text || "").trim();
    card.text = `${card.text} ${text}`.trim();
    if (text) card.lines.push({ text, y: Number(line.y) || 0, x: Number(line.x) || 0 });
  }

  return [...cards.values()].map((card) => {
    const titleParts = [];
    const orderedLines = card.lines.sort((a, b) => a.y - b.y || a.x - b.x);
    for (const entry of orderedLines) {
      const line = entry.text;
      if (/^\d+\s*\/\s*\d+/.test(line) || /^[xх×]\s*\d+$/i.test(line)) break;
      const titleLine = line.replace(/\s+\d+\s*\/\s*\d+.*$/, "").trim();
      if (titleLine) titleParts.push(titleLine);
      if (titleParts.length >= 2) break;
    }
    // The first OCR line is the catalogue item's actual name. Subsequent
    // lines can be a skin subtitle or perk description, so they must not be
    // concatenated into the item identity.
    const titleRaw = (titleParts[0] || "").trim();
    return {
      id: card.id,
      text: card.text,
      titleRaw,
      title: normalizeScreenText(titleRaw),
      quantity: getQuantityMarker(card.text),
      lineCount: card.lines.length,
    };
  });
}

function getScreenTitleSimilarity(left, right) {
  const a = normalizeScreenText(left);
  const b = normalizeScreenText(right);
  if (!a || !b) return 0;
  if (a === b) return 1;

  // Accept a clear base-name/variant overlap (e.g. a catalogue card may show
  // the short base name while the build contains the full variant name).
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  if (shorter.length >= 5 && longer.includes(shorter) && shorter.length / longer.length >= 0.76) {
    return 0.92;
  }

  if (Math.min(a.length, b.length) < 6 || Math.abs(a.length - b.length) > 2) return 0;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}

function getEquipmentSlotAt(x, y, width, height) {
  if (!width || !height) return null;
  const nx = x / width;
  const ny = y / height;

  // Weapon rows on the left equipment column.
  if (nx >= 0.07 && nx <= 0.245 && ny >= 0.255 && ny <= 0.375) return "weapon-main";
  if (nx >= 0.07 && nx <= 0.245 && ny >= 0.385 && ny <= 0.505) return "weapon-second";

  // 4 x 2 grid: melee, medkit, two syringes, then four consumables.
  if (nx >= 0.07 && nx <= 0.285 && ny >= 0.505 && ny <= 0.69) {
    const column = Math.max(0, Math.min(3, Math.floor((nx - 0.07) / 0.0525)));
    const row = Math.max(0, Math.min(1, Math.floor((ny - 0.505) / 0.0925)));
    return `tool-${row * 4 + column}`;
  }

  // Perks occupy a 5 x 3 grid. Their physical positions are arbitrary;
  // the selected perk is compared with the four expected perk names.
  if (nx >= 0.07 && nx <= 0.31 && ny >= 0.69 && ny <= 0.97) {
    const column = Math.max(0, Math.min(4, Math.floor((nx - 0.07) / 0.048)));
    const row = Math.max(0, Math.min(2, Math.floor((ny - 0.69) / 0.093)));
    return `perk-${row * 5 + column}`;
  }
  return null;
}

function itemAliases(item) {
  return (Array.isArray(item.aliases) ? item.aliases : [])
    .concat(item.name || [])
    .map(normalizeScreenText)
    .filter((alias) => alias.length >= 4);
}

function bestExpectedItemMatch(observedName, expectedItem) {
  const aliases = itemAliases(expectedItem);
  return aliases.reduce((best, alias) => Math.max(best, getScreenTitleSimilarity(observedName, alias)), 0);
}

function recomputeEquipmentSlotMatches() {
  const expected = huntScreenReader.expectedLoadout;
  const selections = Object.entries(huntScreenReader.equippedSelections);
  const matches = Object.fromEntries(expected.map((item) => [item.id, false]));
  const details = [];

  // Weapons are checked against their actual weapon positions, not catalogue
  // inventory counts or a generic xN marker.
  for (const id of ["weapon-main", "weapon-second"]) {
    const item = expected.find((candidate) => candidate.id === id);
    if (!item) continue;
    const observed = huntScreenReader.equippedSelections[id];
    const score = observed ? bestExpectedItemMatch(observed.name, item) : 0;
    matches[id] = score >= 0.84;
    details.push({ id, expected: item.name, observed: observed?.name || null, matched: matches[id], score: Number(score.toFixed(3)), source: "confirmed_catalog_selection" });
  }

  // Tools/consumables can be placed in any of Hunt's eight equipment cells.
  // Match by item name and consume each observed cell once (important for two
  // identical syringes or consumables).
  const expectedTools = expected.filter((item) => ["melee", "medkit", "syringe", "consumable"].includes(item.type));
  const observedTools = selections.filter(([slot]) => slot.startsWith("tool-")).map(([slot, value]) => ({ slot, ...value }));
  const usedToolSlots = new Set();
  for (const item of expectedTools) {
    let best = null;
    for (const observed of observedTools) {
      if (usedToolSlots.has(observed.slot)) continue;
      const score = bestExpectedItemMatch(observed.name, item);
      if (!best || score > best.score) best = { ...observed, score };
    }
    const matched = Boolean(best && best.score >= 0.84);
    if (matched) usedToolSlots.add(best.slot);
    matches[item.id] = matched;
    details.push({ id: item.id, expected: item.name, observed: matched ? best.name : null, matched, score: Number((best?.score || 0).toFixed(3)), source: "confirmed_catalog_selection" });
  }

  // Perks can occupy any of the 15 game slots. Each observed perk can satisfy
  // only one expected perk, and the four RANDOMBUILD positions remain distinct.
  const expectedPerks = expected.filter((item) => item.type === "perk");
  const observedPerks = selections.filter(([slot]) => slot.startsWith("perk-")).map(([slot, value]) => ({ slot, ...value }));
  const usedPerkSlots = new Set();
  for (const item of expectedPerks) {
    let best = null;
    for (const observed of observedPerks) {
      if (usedPerkSlots.has(observed.slot)) continue;
      const score = bestExpectedItemMatch(observed.name, item);
      if (!best || score > best.score) best = { ...observed, score };
    }
    const matched = Boolean(best && best.score >= 0.84);
    if (matched) usedPerkSlots.add(best.slot);
    matches[item.id] = matched;
    details.push({ id: item.id, expected: item.name, observed: matched ? best.name : null, matched, score: Number((best?.score || 0).toFixed(3)), source: "confirmed_catalog_selection" });
  }

  huntScreenReader.slotMatches = matches;
  huntScreenReader.matchDetails = details;
}

function commitCatalogSelection(card, sourceEvent) {
  const slot = huntScreenReader.activeEquipmentSlot;
  if (!slot || !card || !card.titleRaw) return false;
  if (slot.startsWith("weapon-") && !["weapon-main", "weapon-second"].includes(slot)) return false;

  huntScreenReader.equippedSelections[slot] = {
    name: card.titleRaw,
    normalizedName: card.title,
    cardId: card.id,
    selectedAt: new Date().toISOString(),
    input: sourceEvent || "unknown",
  };
  huntScreenReader.pendingCatalogClick = null;
  huntScreenReader.activeEquipmentSlot = null;
  huntScreenReader.lastInputEvent = {
    action: "catalog_selection_confirmed",
    slot,
    item: card.titleRaw,
    at: new Date().toISOString(),
    input: sourceEvent || "unknown",
  };
  recomputeEquipmentSlotMatches();
  console.log(`[HUNT EQUIPMENT] ${slot} <- ${card.titleRaw}; matches=${Object.values(huntScreenReader.slotMatches).filter(Boolean).length}/${huntScreenReader.expectedLoadout.length}`);
  return true;
}

function processEquipmentInputEvents(snapshot, cards, allowCatalogSelection) {
  const inputEvents = Array.isArray(snapshot.inputEvents) ? snapshot.inputEvents : [];
  if (!inputEvents.length || snapshot.targetFound !== true) return;

  // Preserve the most recently OCR-recognized catalogue for a brief period.
  // A one-frame OCR miss must not discard a click/Space event that Windows
  // captured while the player was selecting an item.
  const cachedCards = Array.isArray(huntScreenReader.catalogCards)
    ? huntScreenReader.catalogCards.map((card) => ({
        id: card.id,
        titleRaw: card.titleRaw || card.title || "",
        title: card.normalizedTitle || card.title || "",
      }))
    : [];
  const cardMap = new Map(cachedCards.map((card) => [card.id, card]));
  for (const card of cards) cardMap.set(card.id, card);

  const width = Number(snapshot.screenWidth);
  const height = Number(snapshot.screenHeight);
  const originX = Number(snapshot.windowX);
  const originY = Number(snapshot.windowY);
  if (![width, height, originX, originY].every(Number.isFinite)) return;

  const catalogueFresh = allowCatalogSelection || (
    huntScreenReader.lastEquipmentScanAt &&
    Date.now() - Date.parse(huntScreenReader.lastEquipmentScanAt) <= 5000
  );

  for (const event of inputEvents) {
    const x = Number(event.x) - originX;
    const y = Number(event.y) - originY;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= width || y >= height) continue;
    huntScreenReader.inputEventsProcessed += 1;

    if (event.type === "mouse") {
      // Slot clicks are recognized even if Windows OCR misses the loadout
      // heading on this exact frame. This prevents dropping the first click.
      const equipmentSlot = getEquipmentSlotAt(x, y, width, height);
      if (equipmentSlot) {
        huntScreenReader.activeEquipmentSlot = equipmentSlot;
        huntScreenReader.pendingCatalogClick = null;
        huntScreenReader.lastInputEvent = { action: "equipment_slot_selected", slot: equipmentSlot, at: new Date().toISOString() };
        continue;
      }

      if (!catalogueFresh) continue;
      const cardId = getCatalogCardIndex({ x, y }, width, height);
      const card = cardId ? cardMap.get(cardId) : null;
      if (card && card.titleRaw) {
        const now = Date.now();
        const pending = huntScreenReader.pendingCatalogClick;
        if (pending && pending.cardId === cardId && now - pending.at <= 750) {
          commitCatalogSelection(card, "double_click");
        } else {
          huntScreenReader.pendingCatalogClick = { cardId, titleRaw: card.titleRaw, at: now };
          huntScreenReader.lastInputEvent = { action: "catalog_card_clicked_waiting_for_select", cardId, item: card.titleRaw, at: new Date().toISOString() };
        }
      } else {
        huntScreenReader.pendingCatalogClick = null;
      }
      continue;
    }

    if (event.type === "space" || event.type === "enter") {
      const pending = huntScreenReader.pendingCatalogClick;
      const pendingCard = pending && Date.now() - pending.at <= 5000 ? cardMap.get(pending.cardId) : null;
      const cardId = catalogueFresh ? getCatalogCardIndex({ x, y }, width, height) : null;
      const card = cardId ? cardMap.get(cardId) : null;
      commitCatalogSelection(card || pendingCard, event.type);
    }
  }
}

function updateEquipmentSlotMatches(snapshot) {
  if (snapshot.targetFound !== true) return;

  const isLoadout = snapshot.screenMode === "loadout";
  const cards = isLoadout
    ? buildCatalogCards(snapshot.catalogLines, Number(snapshot.screenWidth), Number(snapshot.screenHeight))
    : [];

  if (isLoadout) {
    huntScreenReader.catalogCards = cards.map((card) => ({
      id: card.id,
      title: card.titleRaw,
      titleRaw: card.titleRaw,
      normalizedTitle: card.title,
      text: card.text,
      inventoryQuantity: card.quantity,
    }));
    huntScreenReader.lastEquipmentScanAt = snapshot.capturedAt || new Date().toISOString();
  }

  // Slot state is derived only from an observed player selection: click a slot,
  // then click a catalogue card twice or click once and press Space/Enter.
  // Catalogue xN counts are diagnostic only and are never treated as equipped.
  // Input is consumed on every successful Hunt-window capture, not only when
  // the OCR classifier labels that single frame as `loadout`.
  processEquipmentInputEvents(snapshot, cards, isLoadout);
}

function updateMoneyBalance(snapshot) {
  if (snapshot.balance === null || snapshot.balance === undefined || snapshot.balance === "") return;
  const balance = Number(snapshot.balance);
  if (!Number.isSafeInteger(balance) || balance < 0 || balance > 10000000) return;

  if (huntScreenReader.candidateBalance === balance) {
    huntScreenReader.candidateBalanceCount += 1;
  } else {
    huntScreenReader.candidateBalance = balance;
    huntScreenReader.candidateBalanceCount = 1;
  }

  // Two consecutive identical reads are required before accepting a balance.
  if (huntScreenReader.candidateBalanceCount < 2) return;
  huntScreenReader.stableBalance = balance;
  huntScreenReader.stableBalanceAt = Date.now();

  const activity = getHuntActivity();
  if (activity !== "rest") return;

  if (huntScreenReader.awaitingPostMatchBalance) {
    if (Date.now() - huntScreenReader.returnedToLobbyAt < 900) return;

    const before = huntScreenReader.matchBaseline;
    const delta = Number.isFinite(before) ? balance - before : 0;
    if (delta > 0) {
      huntScreenReader.moneyEvent = {
        id: crypto.randomUUID(),
        money: delta,
        balanceBefore: before,
        balanceAfter: balance,
        matchId: huntScreenReader.activeMatchId,
        detectedAt: new Date().toISOString(),
      };
      huntScreenReader.moneyEvents.push(huntScreenReader.moneyEvent);
      if (huntScreenReader.moneyEvents.length > 50) {
        huntScreenReader.moneyEvents.splice(0, huntScreenReader.moneyEvents.length - 50);
      }
      console.log(`[HUNT MONEY] +${delta} (${before} -> ${balance})`);
    } else {
      console.log(`[HUNT MONEY] Баланс не вырос (${before} -> ${balance}); прирост не начислен.`);
    }

    huntScreenReader.awaitingPostMatchBalance = false;
    huntScreenReader.matchBaseline = balance;
    huntScreenReader.activeMatchId = null;
    saveHuntScreenPersistence();
    return;
  }

  // While in the lobby, keep the baseline fresh so purchases made before
  // the next match are included in the true pre-match balance.
  huntScreenReader.matchBaseline = balance;
}

function handleScreenSnapshot(snapshot) {
  const previousWindowSignature = [
    huntScreenReader.windowTitle,
    huntScreenReader.windowProcessId,
    huntScreenReader.screenWidth,
    huntScreenReader.screenHeight,
    huntScreenReader.windowX,
    huntScreenReader.windowY,
  ].join("|");
  huntScreenReader.lastStatus = snapshot.status || "unknown";
  huntScreenReader.lastCaptureAt = snapshot.capturedAt || new Date().toISOString();
  if (Number.isFinite(Number(snapshot.screenWidth))) huntScreenReader.screenWidth = Number(snapshot.screenWidth);
  if (Number.isFinite(Number(snapshot.screenHeight))) huntScreenReader.screenHeight = Number(snapshot.screenHeight);
  if (snapshot.windowTitle !== undefined) huntScreenReader.windowTitle = String(snapshot.windowTitle || "");
  if (Number.isFinite(Number(snapshot.processId))) huntScreenReader.windowProcessId = Number(snapshot.processId);
  if (Number.isFinite(Number(snapshot.windowX))) huntScreenReader.windowX = Number(snapshot.windowX);
  if (Number.isFinite(Number(snapshot.windowY))) huntScreenReader.windowY = Number(snapshot.windowY);
  if (Number.isFinite(Number(snapshot.visibleHuntWindows))) huntScreenReader.windowCount = Number(snapshot.visibleHuntWindows);
  if (snapshot.captureMethod !== undefined) huntScreenReader.captureMethod = String(snapshot.captureMethod || "");
  if (snapshot.scanArea !== undefined) huntScreenReader.scanArea = String(snapshot.scanArea || "unknown");
  if (Number.isFinite(Number(snapshot.virtualScreenX))) huntScreenReader.virtualScreenX = Number(snapshot.virtualScreenX);
  if (Number.isFinite(Number(snapshot.virtualScreenY))) huntScreenReader.virtualScreenY = Number(snapshot.virtualScreenY);
  if (Number.isFinite(Number(snapshot.virtualScreenWidth))) huntScreenReader.virtualScreenWidth = Number(snapshot.virtualScreenWidth);
  if (Number.isFinite(Number(snapshot.virtualScreenHeight))) huntScreenReader.virtualScreenHeight = Number(snapshot.virtualScreenHeight);
  if (Number.isFinite(Number(snapshot.monitorCount))) huntScreenReader.monitorCount = Number(snapshot.monitorCount);
  if (Array.isArray(snapshot.monitorsScanned)) huntScreenReader.monitorsScanned = snapshot.monitorsScanned.map(String);
  if (snapshot.targetFound !== undefined) huntScreenReader.targetFound = snapshot.targetFound === true;

  if (snapshot.status !== "ok") {
    if (snapshot.error) {
      const nextError = String(snapshot.error);
      if (huntScreenReader.error !== nextError) {
        console.warn(`[HUNT SCREEN] ${snapshot.status}: ${nextError}`);
      }
      huntScreenReader.error = nextError;
    }
    return;
  }

  const currentWindowSignature = [
    huntScreenReader.windowTitle,
    huntScreenReader.windowProcessId,
    huntScreenReader.screenWidth,
    huntScreenReader.screenHeight,
    huntScreenReader.windowX,
    huntScreenReader.windowY,
  ].join("|");
  if (previousWindowSignature !== currentWindowSignature) {
    console.log(
      `[HUNT SCREEN] Захват окна Hunt: ${snapshot.windowTitle || "без заголовка"}; PID=${snapshot.processId}; ${snapshot.screenWidth}x${snapshot.screenHeight}; координаты виртуального рабочего стола ${snapshot.windowX},${snapshot.windowY}.`
    );
  }

  huntScreenReader.error = null;
  huntScreenReader.balanceText = String(snapshot.balanceText || "");
  huntScreenReader.moneyOcrText = String(snapshot.moneyOcrText || "");
  huntScreenReader.screenMode = snapshot.screenMode || "other";
  huntScreenReader.headerOcrText = String(snapshot.headerOcrText || "");
  huntScreenReader.loadoutAnchorCount = Number(snapshot.loadoutAnchorCount) || 0;
  huntScreenReader.ocrLanguage = String(snapshot.ocrLanguage || "");
  huntScreenReader.catalogLines = Array.isArray(snapshot.catalogLines) ? snapshot.catalogLines : [];

  const activity = getHuntActivity();
  const previousActivity = huntScreenReader.lastActivity;

  if (previousActivity === "rest" && activity === "hunt") {
    huntScreenReader.matchBaseline = huntScreenReader.stableBalance;
    huntScreenReader.awaitingPostMatchBalance = false;
    huntScreenReader.activeMatchId = huntLogProbe.activeMatch?.matchId || `${Date.now()}`;
    saveHuntScreenPersistence();
  } else if (previousActivity === "hunt" && activity === "rest") {
    huntScreenReader.awaitingPostMatchBalance = true;
    huntScreenReader.returnedToLobbyAt = Date.now();
    huntScreenReader.candidateBalance = null;
    huntScreenReader.candidateBalanceCount = 0;
    huntScreenReader.stableBalanceAt = 0;
    saveHuntScreenPersistence();
  }

  huntScreenReader.lastActivity = activity;
  updateMoneyBalance(snapshot);
  updateEquipmentSlotMatches(snapshot);
}

function startHuntScreenReader() {
  if (process.platform !== "win32" || huntScreenReader.process) return;

  const scriptPath = path.join(__dirname, "hunt-screen-reader.ps1");
  if (!fs.existsSync(scriptPath)) {
    huntScreenReader.error = `Не найден файл локального считывателя: ${scriptPath}`;
    huntScreenReader.lastStatus = "script_missing";
    return;
  }

  try {
    const child = spawn(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
    );
    huntScreenReader.process = child;
    huntScreenReader.running = true;
    huntScreenReader.lastStatus = "starting";
    huntScreenReader.stdoutBuffer = "";

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      huntScreenReader.stdoutBuffer += chunk;
      if (huntScreenReader.stdoutBuffer.length > 2 * 1024 * 1024) {
        huntScreenReader.stdoutBuffer = huntScreenReader.stdoutBuffer.slice(-512 * 1024);
      }
      let newlineIndex;
      while ((newlineIndex = huntScreenReader.stdoutBuffer.indexOf("\n")) >= 0) {
        const line = huntScreenReader.stdoutBuffer.slice(0, newlineIndex).trim();
        huntScreenReader.stdoutBuffer = huntScreenReader.stdoutBuffer.slice(newlineIndex + 1);
        if (!line) continue;
        try {
          handleScreenSnapshot(JSON.parse(line));
        } catch (error) {
          console.warn("Не удалось разобрать ответ считывателя Hunt:", error.message);
        }
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      const message = String(chunk).trim();
      if (message) console.warn(`[HUNT SCREEN OCR] ${message.slice(0, 500)}`);
    });

    child.on("error", (error) => {
      huntScreenReader.error = error.message || String(error);
      huntScreenReader.lastStatus = "process_error";
    });

    child.on("exit", (code) => {
      huntScreenReader.process = null;
      huntScreenReader.running = false;
      if (code !== 0) {
        huntScreenReader.lastStatus = "process_exited";
        if (!huntScreenReader.error) huntScreenReader.error = `PowerShell OCR завершился с кодом ${code}.`;
      }
      if (huntScreenReader.restartTimer) clearTimeout(huntScreenReader.restartTimer);
      if (!huntScreenReaderShuttingDown) {
        huntScreenReader.restartTimer = setTimeout(startHuntScreenReader, 5000);
        huntScreenReader.restartTimer.unref?.();
      }
    });
  } catch (error) {
    huntScreenReader.running = false;
    huntScreenReader.error = error.message || String(error);
    huntScreenReader.lastStatus = "process_error";
  }
}

// Stop the child OCR process together with Node. Without this, a manual
// server restart could leave an orphan PowerShell screen-capture loop behind.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    huntScreenReaderShuttingDown = true;
    if (huntScreenReader.restartTimer) clearTimeout(huntScreenReader.restartTimer);
    if (huntScreenReader.process && !huntScreenReader.process.killed) {
      huntScreenReader.process.kill();
    }
    process.exit(0);
  });
}

app.post("/api/game/expected-loadout", (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length > 14) {
    return res.status(400).json({ success: false, message: "Разрешено не более 14 слотов." });
  }

  const allowedIds = /^(weapon-main|weapon-second|melee|medkit|syringe-[12]|consumable-[0-3]|perk-[0-3])$/;
  huntScreenReader.expectedLoadout = items
    .filter((item) => item && allowedIds.test(String(item.id || "")) && typeof item.name === "string")
    .map((item) => ({
      id: String(item.id),
      type: String(item.type || ""),
      name: String(item.name).slice(0, 120),
      aliases: Array.isArray(item.aliases)
        ? item.aliases.filter((value) => typeof value === "string").slice(0, 8).map((value) => value.slice(0, 120))
        : [],
    }));
  huntScreenReader.slotMatches = Object.fromEntries(
    huntScreenReader.expectedLoadout.map((item) => [item.id, false])
  );
  huntScreenReader.equippedSelections = {};
  huntScreenReader.activeEquipmentSlot = null;
  huntScreenReader.pendingCatalogClick = null;
  huntScreenReader.matchDetails = huntScreenReader.expectedLoadout.map((item) => ({
    id: item.id, expected: item.name, observed: null, matched: false, source: "waiting_for_player_selection",
  }));
  huntScreenReader.catalogCards = [];

  console.log(
    `[HUNT LOADOUT] Получено от RANDOMBUILD: ${huntScreenReader.expectedLoadout.length} предметов (${huntScreenReader.expectedLoadout.map((item) => item.id).join(", ") || "пустой билд"}).`
  );

  res.json({
    success: true,
    expectedItems: huntScreenReader.expectedLoadout.length,
    receivedAt: new Date().toISOString(),
  });
});

app.get("/api/game/screen-debug", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    status: huntScreenReader.lastStatus,
    running: huntScreenReader.running,
    error: huntScreenReader.error,
    lastCaptureAt: huntScreenReader.lastCaptureAt,
    screenWidth: huntScreenReader.screenWidth,
    screenHeight: huntScreenReader.screenHeight,
    windowTitle: huntScreenReader.windowTitle,
    windowProcessId: huntScreenReader.windowProcessId,
    windowX: huntScreenReader.windowX,
    windowY: huntScreenReader.windowY,
    windowCount: huntScreenReader.windowCount,
    captureMethod: huntScreenReader.captureMethod,
    scanArea: huntScreenReader.scanArea,
    virtualScreenX: huntScreenReader.virtualScreenX,
    virtualScreenY: huntScreenReader.virtualScreenY,
    virtualScreenWidth: huntScreenReader.virtualScreenWidth,
    virtualScreenHeight: huntScreenReader.virtualScreenHeight,
    monitorCount: huntScreenReader.monitorCount,
    monitorsScanned: huntScreenReader.monitorsScanned,
    targetFound: huntScreenReader.targetFound,
    balance: huntScreenReader.stableBalance,
    balanceText: huntScreenReader.balanceText,
    moneyOcrText: huntScreenReader.moneyOcrText,
    screenMode: huntScreenReader.screenMode,
    headerOcrText: huntScreenReader.headerOcrText,
    loadoutAnchorCount: huntScreenReader.loadoutAnchorCount,
    ocrLanguage: huntScreenReader.ocrLanguage,
    catalogCards: huntScreenReader.catalogCards,
    expectedLoadout: huntScreenReader.expectedLoadout,
    slotMatches: huntScreenReader.slotMatches,
    matchDetails: huntScreenReader.matchDetails,
    activeEquipmentSlot: huntScreenReader.activeEquipmentSlot,
    equippedSelections: huntScreenReader.equippedSelections,
    pendingCatalogClick: huntScreenReader.pendingCatalogClick,
    inputEventsProcessed: huntScreenReader.inputEventsProcessed,
    lastInputEvent: huntScreenReader.lastInputEvent,
    lastEquipmentScanAt: huntScreenReader.lastEquipmentScanAt,
    moneyEvent: huntScreenReader.moneyEvent,
    logSources: {
      gameLog: huntLogProbe.logPath,
      backupDirectory: huntLogProbe.backupDirectory,
      backupScanAt: huntBackupProbe.lastScanAt,
      backupError: huntBackupProbe.error,
      latestBackupFiles: huntBackupProbe.latestFiles,
    },
  });
});

app.get("/api/game/status", (req, res) => {
  const activity = getHuntActivity();

  res.set("Cache-Control", "no-store");
  res.json({
    activity,
    gameProcessRunning: huntLogProbe.gameProcessRunning,
    processCheckError: huntLogProbe.processCheckError,
    status: huntLogProbe.status,
    logPath: huntLogProbe.logPath,
    logStartedAt: huntLogProbe.logStartedAt,
    installDirectory: huntLogProbe.installDirectory,
    backupDirectory: huntLogProbe.backupDirectory,
    backupLogScanAt: huntBackupProbe.lastScanAt,
    backupLogError: huntBackupProbe.error,
    latestBackupLogs: huntBackupProbe.latestFiles,
    backupEventCount: huntLogProbe.events.filter((event) => event.sourceKind === "LogBackups").length,
    liveLogEventCount: huntLogProbe.events.filter((event) => event.sourceKind === "Game.log").length,
    discoverySource: huntLogProbe.discoverySource,
    discoveredCandidates: huntLogProbe.discoveredCandidates,
    lastDiscoveryAt: huntLogProbe.lastDiscoveryAt,
    lastFileWriteAt: huntLogProbe.lastFileWriteAt,
    error: huntLogProbe.error,
    activeMatch: huntLogProbe.activeMatch,
    pendingSummary: huntLogProbe.pendingSummary,
    lastGameState: huntLogProbe.lastGameState,
    linesProcessed: huntLogProbe.lineNumber,
    statisticsAvailableFromLog: false,
    statisticsNote: "Game.log и свежие файлы USER\\LogBackups используются совместно для событий жизненного цикла сессии. Эти журналы пока не содержат подтверждённых значений убийств и заработанных денег.",
    screenReader: {
      status: huntScreenReader.lastStatus,
      running: huntScreenReader.running,
      error: huntScreenReader.error,
      lastCaptureAt: huntScreenReader.lastCaptureAt,
      screenWidth: huntScreenReader.screenWidth,
      screenHeight: huntScreenReader.screenHeight,
      windowTitle: huntScreenReader.windowTitle,
      windowProcessId: huntScreenReader.windowProcessId,
      windowX: huntScreenReader.windowX,
      windowY: huntScreenReader.windowY,
      windowCount: huntScreenReader.windowCount,
      captureMethod: huntScreenReader.captureMethod,
      scanArea: huntScreenReader.scanArea,
      virtualScreenX: huntScreenReader.virtualScreenX,
      virtualScreenY: huntScreenReader.virtualScreenY,
      virtualScreenWidth: huntScreenReader.virtualScreenWidth,
      virtualScreenHeight: huntScreenReader.virtualScreenHeight,
      monitorCount: huntScreenReader.monitorCount,
      monitorsScanned: huntScreenReader.monitorsScanned,
      targetFound: huntScreenReader.targetFound,
      inputEventsProcessed: huntScreenReader.inputEventsProcessed,
      activeEquipmentSlot: huntScreenReader.activeEquipmentSlot,
      lastInputEvent: huntScreenReader.lastInputEvent,
      equipmentSelections: huntScreenReader.equippedSelections,
      balance: huntScreenReader.stableBalance,
      balanceText: huntScreenReader.balanceText,
      screenMode: huntScreenReader.screenMode,
      headerOcrText: huntScreenReader.headerOcrText,
      loadoutAnchorCount: huntScreenReader.loadoutAnchorCount,
      ocrLanguage: huntScreenReader.ocrLanguage,
      catalogCardCount: huntScreenReader.catalogCards.length,
      expectedLoadoutCount: huntScreenReader.expectedLoadout.length,
      matchedSlotCount: Object.values(huntScreenReader.slotMatches).filter(Boolean).length,
      lastEquipmentScanAt: huntScreenReader.lastEquipmentScanAt,
    },
    moneyEvent: huntScreenReader.moneyEvent,
    moneyEvents: huntScreenReader.moneyEvents,
    slotMatches: huntScreenReader.slotMatches,
    matchDetails: huntScreenReader.matchDetails,
  });
});

app.get("/api/game/events", (req, res) => {
  const after = Math.max(0, Number.parseInt(req.query.after || "0", 10) || 0);
  res.json({
    events: huntLogProbe.events.filter((event) => event.seq > after),
    nextAfter: huntLogProbe.sequence,
    totalInBuffer: huntLogProbe.events.length,
  });
});


app.listen(
  PORT,
  "127.0.0.1",
  () => {
    console.log(
      `RandomBuild Local Server запущен: http://localhost:${PORT}`
    );

    // Автоматический поиск Hunt и наблюдение за USER\\Game.log.
    startHuntLogAutoDiscovery();
    // Захват экрана и локальный OCR для баланса/экипировки.
    startHuntScreenReader();
  }
);
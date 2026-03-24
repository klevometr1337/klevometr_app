import { useState, useEffect, useRef, useMemo, useCallback } from "react";

// ═══════════════════════════════════════
//  KLEVOMETR v8 — Telegram Mini App
//  День/Ночь темы + Supabase + всё из v5
// ═══════════════════════════════════════

const OWM_API_KEY = "ae9e552e204ffd1a5534b385a0af66f8";
const SUPABASE_URL = "https://dzdivehecxxaolfohdhg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6ZGl2ZWhlY3h4YW9sZm9oZGhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjY0OTEsImV4cCI6MjA4OTYwMjQ5MX0.PwJofXpZb2BUHoqtOwmHLfAPJkuaGNB2yncyaPF1HKE";
const BOT_USERNAME = "klevometr_bot"; // @klevometr_bot
const MINI_APP_SHORT = "klevometr"; // короткое имя Mini App из BotFather (/newapp)
const APP_LINK = `https://t.me/${BOT_USERNAME}/${MINI_APP_SHORT}`;

const tg = window.Telegram?.WebApp;
const haptic = (type = "light") => { try { tg?.HapticFeedback?.impactOccurred(type); } catch (e) {} };
const hapticNotify = (type = "success") => { try { tg?.HapticFeedback?.notificationOccurred(type); } catch (e) {} };

// ── Supabase REST client (no npm) ──
const supabase = {
  headers: () => ({
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation",
  }),
  async select(table, query = "") {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: this.headers() });
      if (!res.ok) throw new Error(res.statusText);
      return await res.json();
    } catch (e) { console.warn("Supabase select error:", e); return []; }
  },
  async insert(table, data) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: "POST", headers: this.headers(), body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(res.statusText);
      return await res.json();
    } catch (e) { console.warn("Supabase insert error:", e); return null; }
  },
  async update(table, match, data) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${match}`, {
        method: "PATCH", headers: this.headers(), body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(res.statusText);
      return await res.json();
    } catch (e) { console.warn("Supabase update error:", e); return null; }
  },
  async delete(table, match) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${match}`, {
        method: "DELETE", headers: this.headers(),
      });
      return res.ok;
    } catch (e) { console.warn("Supabase delete error:", e); return false; }
  },
};

// ── Supabase user hook (Telegram auto-login) ──
function useSupabaseUser() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    const tgUser = tg?.initDataUnsafe?.user;
    if (!tgUser) return;
    const syncUser = async () => {
      try {
        const existing = await supabase.select("users", `telegram_id=eq.${tgUser.id}`);
        if (existing && existing.length > 0) {
          setUser(existing[0]);
          supabase.update("users", `telegram_id=eq.${tgUser.id}`, { last_seen: new Date().toISOString(), username: tgUser.username || "", first_name: tgUser.first_name || "" });
        } else {
          const newUser = await supabase.insert("users", {
            telegram_id: tgUser.id,
            username: tgUser.username || "",
            first_name: tgUser.first_name || "",
            avatar_emoji: "🎣",
            last_seen: new Date().toISOString(),
          });
          if (newUser?.[0]) setUser(newUser[0]);
        }
      } catch (e) { console.warn("User sync error:", e); }
    };
    syncUser();
  }, []);

  const updateProfile = useCallback(async (fields) => {
    const tgUser = tg?.initDataUnsafe?.user;
    if (!tgUser) return;
    const result = await supabase.update("users", `telegram_id=eq.${tgUser.id}`, fields);
    if (result?.[0]) setUser(result[0]);
    // Also persist locally
    if (fields.nickname) storage.set("profile_nickname", fields.nickname);
    if (fields.avatar_emoji) storage.set("profile_avatar", fields.avatar_emoji);
    if (fields.custom_lat != null) {
      storage.set("manualLocation", { lat: fields.custom_lat, lon: fields.custom_lng, city: fields.custom_city || "" });
    }
  }, []);

  const clearCustomLocation = useCallback(async () => {
    const tgUser = tg?.initDataUnsafe?.user;
    if (!tgUser) return;
    await supabase.update("users", `telegram_id=eq.${tgUser.id}`, { custom_lat: null, custom_lng: null, custom_city: null });
    storage.set("manualLocation", null);
    setUser(prev => prev ? { ...prev, custom_lat: null, custom_lng: null, custom_city: null } : prev);
  }, []);

  return { user, setUser, updateProfile, clearCustomLocation };
}

// ── Generate short invite code ──
function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── Cities for manual geo picker ──
const POPULAR_CITIES = [
  { name: "Москва", lat: 55.7558, lon: 37.6173 },
  { name: "Санкт-Петербург", lat: 59.9343, lon: 30.3351 },
  { name: "Казань", lat: 55.7887, lon: 49.1221 },
  { name: "Новосибирск", lat: 55.0084, lon: 82.9357 },
  { name: "Екатеринбург", lat: 56.8389, lon: 60.6057 },
  { name: "Нижний Новгород", lat: 56.2965, lon: 43.9361 },
  { name: "Самара", lat: 53.1959, lon: 50.1002 },
  { name: "Ростов-на-Дону", lat: 47.2357, lon: 39.7015 },
  { name: "Красноярск", lat: 56.0153, lon: 92.8932 },
  { name: "Воронеж", lat: 51.6720, lon: 39.1843 },
  { name: "Краснодар", lat: 45.0355, lon: 38.9753 },
  { name: "Тверь", lat: 56.8587, lon: 35.9176 },
  { name: "Астрахань", lat: 46.3497, lon: 48.0408 },
  { name: "Волгоград", lat: 48.7080, lon: 44.5133 },
];

// ── Dual sync hook (localStorage + Supabase) ──
function useSync(key, defaultVal, tableName = null) {
  const [data, setData] = useState(() => storage.get(key, defaultVal));
  
  const save = useCallback((updater) => {
    setData(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      storage.set(key, next);
      // Background Supabase sync (fire and forget)
      if (tableName) {
        const tgUser = tg?.initDataUnsafe?.user;
        if (tgUser) {
          // For arrays: sync the latest item
          if (Array.isArray(next) && next.length > 0 && next.length > (Array.isArray(prev) ? prev.length : 0)) {
            const item = next[0]; // newest
            supabase.insert(tableName, { ...item, telegram_id: tgUser.id }).catch(() => {});
          }
        }
      }
      return next;
    });
  }, [key, tableName]);

  return [data, save, setData];
}

// ── Sound Engine (Web Audio API) ──
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}
function createNoise(ctx, duration) {
  const sr = ctx.sampleRate;
  const buf = ctx.createBuffer(1, sr * duration, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function playCastSound() {
  try {
    const ctx = getAudioCtx(); const t = ctx.currentTime;
    const master = ctx.createGain(); master.gain.setValueAtTime(0.4, t); master.connect(ctx.destination);
    const noise = ctx.createBufferSource(); noise.buffer = createNoise(ctx, 0.25);
    const sf = ctx.createBiquadFilter(); sf.type = "bandpass"; sf.frequency.setValueAtTime(3000, t); sf.frequency.exponentialRampToValueAtTime(400, t + 0.2); sf.Q.setValueAtTime(2, t);
    const sg = ctx.createGain(); sg.gain.setValueAtTime(0.5, t); sg.gain.exponentialRampToValueAtTime(0.01, t + 0.22);
    noise.connect(sf); sf.connect(sg); sg.connect(master); noise.start(t); noise.stop(t + 0.25);
    const line = ctx.createOscillator(); line.type = "sawtooth"; line.frequency.setValueAtTime(1200, t + 0.02); line.frequency.exponentialRampToValueAtTime(150, t + 0.18);
    const lf = ctx.createBiquadFilter(); lf.type = "lowpass"; lf.frequency.setValueAtTime(2000, t); lf.frequency.exponentialRampToValueAtTime(300, t + 0.18);
    const lg = ctx.createGain(); lg.gain.setValueAtTime(0.15, t + 0.02); lg.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    line.connect(lf); lf.connect(lg); lg.connect(master); line.start(t + 0.02); line.stop(t + 0.22);
    const tick = ctx.createOscillator(); tick.type = "triangle"; tick.frequency.setValueAtTime(800, t + 0.16); tick.frequency.exponentialRampToValueAtTime(200, t + 0.22);
    const tg2 = ctx.createGain(); tg2.gain.setValueAtTime(0.12, t + 0.16); tg2.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
    tick.connect(tg2); tg2.connect(master); tick.start(t + 0.16); tick.stop(t + 0.25);
  } catch(e) {}
}

function playBiteSound() {
  try {
    const ctx = getAudioCtx(); const t = ctx.currentTime;
    const master = ctx.createGain(); master.gain.setValueAtTime(0.35, t); master.connect(ctx.destination);
    const partials = [
      { freq: 845, amp: 1.0, decay: 1.2 }, { freq: 1688, amp: 0.7, decay: 0.9 },
      { freq: 2510, amp: 0.4, decay: 0.7 }, { freq: 3365, amp: 0.25, decay: 0.5 },
      { freq: 4200, amp: 0.15, decay: 0.35 }, { freq: 5050, amp: 0.08, decay: 0.25 },
    ];
    [0, 0.18].forEach((offset, strike) => {
      partials.forEach(p => {
        const osc = ctx.createOscillator(); osc.type = "sine";
        osc.frequency.setValueAtTime(p.freq * (strike === 1 ? 1.003 : 1), t + offset);
        const gain = ctx.createGain(); const vol = p.amp * (strike === 0 ? 0.3 : 0.25);
        gain.gain.setValueAtTime(0, t + offset);
        gain.gain.linearRampToValueAtTime(vol, t + offset + 0.003);
        gain.gain.exponentialRampToValueAtTime(vol * 0.5, t + offset + p.decay * 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, t + offset + p.decay);
        osc.connect(gain); gain.connect(master); osc.start(t + offset); osc.stop(t + offset + p.decay + 0.05);
      });
    });
  } catch(e) {}
}

function playCaughtSound() {
  try {
    const ctx = getAudioCtx(); const t = ctx.currentTime;
    const master = ctx.createGain(); master.gain.setValueAtTime(0.35, t); master.connect(ctx.destination);
    const splash = ctx.createBufferSource(); splash.buffer = createNoise(ctx, 0.5);
    const sf = ctx.createBiquadFilter(); sf.type = "lowpass"; sf.frequency.setValueAtTime(1500, t); sf.frequency.exponentialRampToValueAtTime(200, t + 0.4);
    const sg = ctx.createGain(); sg.gain.setValueAtTime(0.35, t); sg.gain.linearRampToValueAtTime(0.4, t + 0.03); sg.gain.exponentialRampToValueAtTime(0.01, t + 0.45);
    splash.connect(sf); sf.connect(sg); sg.connect(master); splash.start(t); splash.stop(t + 0.5);
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator(); osc.type = "sine";
      const og = ctx.createGain(); const start = t + 0.15 + i * 0.12;
      osc.frequency.setValueAtTime(freq, start); og.gain.setValueAtTime(0, start);
      og.gain.linearRampToValueAtTime(0.2, start + 0.02);
      og.gain.exponentialRampToValueAtTime(0.01, start + 0.5);
      osc.connect(og); og.connect(master); osc.start(start); osc.stop(start + 0.55);
    });
  } catch(e) {}
}

// ── Theme system ──
const NIGHT = {
  name: "Полночь на воде",
  bg: "#080808",
  accent: "#b0c8e8",
  accentGrad: "linear-gradient(135deg,#7aa8d0,#b0c8e8)",
  accentSoft: "rgba(176,200,232,0.08)",
  accentBorder: "rgba(176,200,232,0.18)",
  text: "#d8e0ec",
  textSecondary: "#8898b8",
  textMuted: "#6878a0",
  textDim: "#3a4468",
  card: "rgba(12,14,24,0.65)",
  cardBorder: "rgba(176,200,232,0.06)",
  cardHover: "rgba(12,14,24,0.8)",
  glass: { background: "rgba(12,14,24,0.65)", border: "1px solid rgba(176,200,232,0.06)", backdropFilter: "blur(20px)", boxShadow: "0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)" },
  stats: ["#b0c8e8", "#a0b888", "#d0b878", "#c0a0b0"],
  scoreColors: { great: "#7dd3a0", good: "#d4c87a", weak: "#d4a06a", bad: "#d47a7a" },
  tabBg: "rgba(6,8,14,0.92)",
  tabBorder: "rgba(176,200,232,0.05)",
  tabActive: "#b0c8e8",
  tabInactive: "#3a4468",
  inputBg: "rgba(176,200,232,0.04)",
  inputBorder: "rgba(176,200,232,0.08)",
  btnPrimary: "linear-gradient(135deg,#6a98c0,#4878a0)",
  btnDanger: "rgba(200,100,100,0.08)",
  btnDangerBorder: "rgba(200,100,100,0.25)",
  btnDangerColor: "#d08080",
  toggleIcon: "☀️",
  isDark: true,
};

const DAY = {
  name: "Утро на воде",
  bg: "#e0e8f0",
  accent: "#2a6090",
  accentGrad: "linear-gradient(135deg,#2a6090,#3880b8)",
  accentSoft: "rgba(42,96,144,0.08)",
  accentBorder: "rgba(42,96,144,0.18)",
  text: "#1a2a3a",
  textSecondary: "#3a5470",
  textMuted: "#5a7088",
  textDim: "#8a9aaa",
  card: "rgba(255,255,255,0.55)",
  cardBorder: "rgba(42,96,144,0.08)",
  cardHover: "rgba(255,255,255,0.7)",
  glass: { background: "rgba(255,255,255,0.55)", border: "1px solid rgba(42,96,144,0.08)", backdropFilter: "blur(20px)", boxShadow: "0 4px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.6)" },
  stats: ["#2a6090", "#4a8848", "#b08830", "#8868a0"],
  scoreColors: { great: "#38a868", good: "#b0a030", weak: "#c08030", bad: "#c05050" },
  tabBg: "rgba(230,238,246,0.92)",
  tabBorder: "rgba(42,96,144,0.08)",
  tabActive: "#2a6090",
  tabInactive: "#8a9aaa",
  inputBg: "rgba(42,96,144,0.05)",
  inputBorder: "rgba(42,96,144,0.12)",
  btnPrimary: "linear-gradient(135deg,#2a6090,#3880b8)",
  btnDanger: "rgba(200,60,60,0.06)",
  btnDangerBorder: "rgba(200,60,60,0.2)",
  btnDangerColor: "#c05050",
  toggleIcon: "🌙",
  isDark: false,
};

// ── Theme context hook ──
function useTheme() {
  const [isNight, setIsNight] = useState(() => {
    try { return localStorage.getItem("klevometr_theme") === "night"; } catch { return false; }
  });
  const toggle = useCallback(() => {
    setIsNight(p => {
      const next = !p;
      try { localStorage.setItem("klevometr_theme", next ? "night" : "day"); } catch {}
      haptic("medium");
      return next;
    });
  }, []);
  return { isNight, toggle, v: isNight ? NIGHT : DAY };
}

// ── Weather & Moon ──
function getMoonPhase(date = new Date()) {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  let c = 0, jd = 0;
  if (m <= 2) { jd = 365.25 * (y + 4715 + Math.floor((m - 1 + 10) / 12)); c = Math.floor(30.6001 * (m + 13)); }
  else { jd = Math.floor(365.25 * (y + 4716)); c = Math.floor(30.6001 * (m + 1)); }
  const julian = jd + c + d - 1524.5;
  const phase = ((julian - 2451550.1) / 29.530588853) % 1;
  const p = phase < 0 ? phase + 1 : phase;
  const phases = [
    { name: "Новолуние", icon: "🌑", factor: 0.4 }, { name: "Растущий серп", icon: "🌒", factor: 0.6 },
    { name: "Первая четверть", icon: "🌓", factor: 0.75 }, { name: "Растущая луна", icon: "🌔", factor: 0.9 },
    { name: "Полнолуние", icon: "🌕", factor: 1.0 }, { name: "Убывающая луна", icon: "🌖", factor: 0.85 },
    { name: "Третья четверть", icon: "🌗", factor: 0.65 }, { name: "Убывающий серп", icon: "🌘", factor: 0.45 },
  ];
  return phases[Math.floor(p * 8) % 8];
}

function requestGeolocation() {
  return new Promise((resolve, reject) => {
    if (tg?.LocationManager) {
      tg.LocationManager.init(() => {
        if (tg.LocationManager.isLocationAvailable) {
          tg.LocationManager.getLocation((loc) => loc ? resolve({ lat: loc.latitude, lon: loc.longitude }) : browserGeo(resolve, reject));
        } else browserGeo(resolve, reject);
      });
    } else browserGeo(resolve, reject);
  });
}
function browserGeo(resolve, reject) {
  navigator.geolocation?.getCurrentPosition(
    (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
    () => reject("no geo"), { timeout: 10000, maximumAge: 300000 }
  );
}

async function fetchWeather(lat, lon) {
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=ru&appid=${OWM_API_KEY}`);
    const d = await res.json();
    return {
      temp: Math.round(d.main.temp), feelsLike: Math.round(d.main.feels_like),
      pressure: Math.round(d.main.pressure * 0.750062), humidity: d.main.humidity,
      wind: d.wind.speed.toFixed(1), windDeg: d.wind.deg,
      clouds: d.clouds.all, icon: d.weather[0]?.icon, description: d.weather[0]?.description,
      cityName: d.name,
      waterTemp: Math.max(0, Math.round(d.main.temp - 3 - Math.random() * 2)),
    };
  } catch (e) { return null; }
}

async function fetchForecast(lat, lon) {
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&lang=ru&appid=${OWM_API_KEY}`);
    const d = await res.json();
    return d.list || [];
  } catch (e) { return []; }
}

// ═══════════════════════════════════════
//  ADVANCED FORECAST ENGINE — 10+ метрик
// ═══════════════════════════════════════

// ── Региональная база рыб: какие виды водятся в каких водоёмах ──
// Каждый регион: центр (lat, lon), радиус (км), водоёмы, виды рыб
const REGIONAL_FISH = [
  {
    id: "don_lower", name: "Нижний Дон", region: "Ростовская обл.",
    waters: "Дон, Сев. Донец, Маныч, Цимлянское вдхр.",
    lat: 47.23, lon: 39.70, radius: 180,
    fish: ["Щука","Окунь","Судак","Карп","Карась","Лещ","Сом","Плотва","Жерех"],
    absent: ["Налим","Форель"], // важно: этих рыб тут НЕТ
    note: "Южный регион, тёплая вода. Налим и форель не обитают.",
  },
  {
    id: "don_middle", name: "Средний Дон", region: "Воронежская обл.",
    waters: "Дон, Воронеж, Хопёр, Битюг",
    lat: 51.67, lon: 39.18, radius: 150,
    fish: ["Щука","Окунь","Судак","Карп","Карась","Лещ","Сом","Плотва","Жерех","Налим"],
    absent: ["Форель"],
    note: "Средняя полоса. Налим встречается в верховьях притоков.",
  },
  {
    id: "volga_upper", name: "Верхняя Волга", region: "Тверская, Ярославская обл.",
    waters: "Волга, Рыбинское вдхр., Иваньковское вдхр.",
    lat: 56.86, lon: 35.92, radius: 200,
    fish: ["Щука","Окунь","Судак","Карп","Карась","Лещ","Сом","Плотва","Жерех","Налим"],
    absent: ["Форель"],
    note: "Крупные водохранилища, богатая ихтиофауна.",
  },
  {
    id: "volga_middle", name: "Средняя Волга", region: "Самарская, Саратовская обл.",
    waters: "Волга, Куйбышевское вдхр., Саратовское вдхр.",
    lat: 53.20, lon: 50.10, radius: 200,
    fish: ["Щука","Окунь","Судак","Карп","Карась","Лещ","Сом","Плотва","Жерех","Налим"],
    absent: ["Форель"],
    note: "Волжские водохранилища — судак, лещ, жерех в изобилии.",
  },
  {
    id: "moscow_region", name: "Подмосковье", region: "Москва, Московская обл.",
    waters: "Ока, Москва-река, Клязьма, Можайское вдхр.",
    lat: 55.76, lon: 37.62, radius: 150,
    fish: ["Щука","Окунь","Судак","Карп","Карась","Лещ","Сом","Плотва","Жерех","Налим"],
    absent: ["Форель"],
    note: "Все основные пресноводные виды. Налим есть в Оке и притоках.",
  },
  {
    id: "spb_region", name: "Ленинградская обл.", region: "СПб, Ленобласть",
    waters: "Нева, Ладога, Финский залив, Вуокса",
    lat: 59.93, lon: 30.34, radius: 200,
    fish: ["Щука","Окунь","Судак","Карп","Карась","Лещ","Сом","Плотва","Налим","Форель"],
    absent: ["Жерех"],
    note: "Холодные озёра — форель и налим активны. Жерех редок.",
  },
  {
    id: "kazan_region", name: "Татарстан", region: "Казань, Татарстан",
    waters: "Волга, Кама, Куйбышевское вдхр.",
    lat: 55.79, lon: 49.12, radius: 180,
    fish: ["Щука","Окунь","Судак","Карп","Карась","Лещ","Сом","Плотва","Жерех","Налим"],
    absent: ["Форель"],
    note: "Слияние Волги и Камы — одно из лучших мест для рыбалки в РФ.",
  },
  {
    id: "ural_region", name: "Урал", region: "Екатеринбург, Свердловская обл.",
    waters: "Исеть, Чусовая, Уфа, озёра Урала",
    lat: 56.84, lon: 60.61, radius: 200,
    fish: ["Щука","Окунь","Судак","Карп","Карась","Лещ","Плотва","Налим","Форель"],
    absent: ["Сом","Жерех"],
    note: "Горные реки — форель. Равнинные — щука, окунь. Сом и жерех редки.",
  },
  {
    id: "novosibirsk_region", name: "Новосибирская обл.", region: "Новосибирск",
    waters: "Обь, Новосибирское вдхр., Бердь",
    lat: 55.01, lon: 82.94, radius: 200,
    fish: ["Щука","Окунь","Судак","Карп","Карась","Лещ","Плотва","Налим"],
    absent: ["Сом","Жерех","Форель"],
    note: "Сибирские реки. Сом, жерех и форель не характерны для Оби.",
  },
  {
    id: "krasnoyarsk_region", name: "Красноярский край", region: "Красноярск",
    waters: "Енисей, Красноярское вдхр., Мана",
    lat: 56.02, lon: 92.89, radius: 250,
    fish: ["Щука","Окунь","Лещ","Карась","Плотва","Налим","Форель"],
    absent: ["Карп","Сом","Жерех","Судак"],
    note: "Холодный Енисей — форель, налим, хариус. Теплолюбивые виды отсутствуют.",
  },
  {
    id: "krasnodar_region", name: "Краснодарский край", region: "Краснодар, Кубань",
    waters: "Кубань, Краснодарское вдхр., лиманы",
    lat: 45.04, lon: 38.98, radius: 180,
    fish: ["Щука","Окунь","Судак","Карп","Карась","Лещ","Сом","Плотва","Жерех"],
    absent: ["Налим","Форель"],
    note: "Южный регион, тёплый климат. Налим и форель не водятся.",
  },
  {
    id: "volgograd_region", name: "Волгоградская обл.", region: "Волгоград",
    waters: "Волга, Волгоградское вдхр., Дон, Цимлянское вдхр.",
    lat: 48.71, lon: 44.51, radius: 180,
    fish: ["Щука","Окунь","Судак","Карп","Карась","Лещ","Сом","Плотва","Жерех"],
    absent: ["Налим","Форель"],
    note: "Нижняя Волга и Дон — рай для хищника. Слишком тепло для налима.",
  },
  {
    id: "astrakhan_region", name: "Астраханская обл.", region: "Астрахань",
    waters: "Волга (дельта), Ахтуба, ерики",
    lat: 46.35, lon: 48.04, radius: 150,
    fish: ["Щука","Окунь","Судак","Карп","Карась","Лещ","Сом","Плотва","Жерех"],
    absent: ["Налим","Форель"],
    note: "Дельта Волги — легендарное место. Трофейные сомы и сазаны.",
  },
  {
    id: "nn_region", name: "Нижегородская обл.", region: "Нижний Новгород",
    waters: "Волга, Ока, Горьковское вдхр.",
    lat: 56.30, lon: 43.94, radius: 150,
    fish: ["Щука","Окунь","Судак","Карп","Карась","Лещ","Сом","Плотва","Жерех","Налим"],
    absent: ["Форель"],
    note: "Слияние Волги и Оки — все основные виды включая налима.",
  },
];

// ── Определение региона по координатам ──
function getRegionByCoords(lat, lon) {
  if (!lat || !lon) return null;
  let bestRegion = null;
  let bestDist = Infinity;
  for (const region of REGIONAL_FISH) {
    const dlat = (region.lat - lat) * 111; // ~111 км/градус
    const dlon = (region.lon - lon) * 111 * Math.cos(lat * Math.PI / 180);
    const dist = Math.sqrt(dlat * dlat + dlon * dlon);
    if (dist < region.radius && dist < bestDist) {
      bestDist = dist;
      bestRegion = region;
    }
  }
  return bestRegion;
}

// ── Получить список доступных рыб для локации ──
function getLocalFish(lat, lon) {
  const region = getRegionByCoords(lat, lon);
  if (!region) return { fish: Object.keys(FISH_PROFILES), region: null, note: "Регион не определён — показаны все виды" };
  // Фильтруем только тех, кто есть в FISH_PROFILES и в региональном списке
  const available = region.fish.filter(f => FISH_PROFILES[f]);
  return { fish: available, region, note: region.note };
}

const FISH_PROFILES = {
  "Щука": {
    emoji: "🐟", type: "predator",
    waterTemp: { min: 4, active: 8, peakLow: 13, peakHigh: 16, decline: 20, max: 23 },
    pressure: { ideal: 748, range: 12, prefersLow: true, changeSensitivity: 0.9 },
    hourlyActivity: [.1,.05,.05,.1,.2,.5,.8,.9,.7,.5,.3,.2,.15,.15,.2,.3,.5,.7,.9,.85,.6,.4,.2,.15],
    seasonalActivity: [.3,.3,.5,.8,.95,.7,.5,.6,.8,1,.7,.4],
    prefersOvercast: true, prefersRain: true, windTolerance: 7,
    goodWindDirs: ["Ю","ЮЗ","З"], spawnMonth: 2, spawnWeeks: 3,
    tips: {
      great: "Щука на охоте! Крупные воблеры, джерки. У коряг и на бровках. Агрессивная проводка с паузами.",
      good: "Колебалки среднего размера. Заросли кувшинок и камыша. Утро и вечер.",
      weak: "Мелкие приманки, медленная проводка у дна. Силикон на джиг-головке.",
      bad: "Попробуй живца на жерлице — пассивная подача может сработать.",
    },
  },
  "Окунь": {
    emoji: "🐠", type: "predator",
    waterTemp: { min: 4, active: 8, peakLow: 12, peakHigh: 15, decline: 20, max: 21 },
    pressure: { ideal: 760, range: 8, prefersLow: false, changeSensitivity: 0.7 },
    hourlyActivity: [.05,.05,.05,.1,.3,.6,.9,.95,.8,.6,.4,.3,.25,.3,.35,.5,.7,.9,.85,.7,.4,.2,.1,.05],
    seasonalActivity: [.5,.5,.6,.8,.9,.8,.7,.75,.9,1,.6,.5],
    prefersOvercast: false, prefersRain: false, windTolerance: 5,
    goodWindDirs: ["Ю","ЮЗ","З","ЮВ"], spawnMonth: 3, spawnWeeks: 2,
    tips: {
      great: "Окунь в котлах! Вращалки, микроджиг, попперы. Где один — там десять.",
      good: "Мелкие блёсны 2-5г, отводной поводок. Прибрежная зона.",
      weak: "Микроджиг с пассивкой. У свалов на глубину.",
      bad: "Червь на поплавочку у дна. Или переключись на другую рыбу.",
    },
  },
  "Судак": {
    emoji: "🐟", type: "predator",
    waterTemp: { min: 4, active: 6, peakLow: 12, peakHigh: 18, decline: 22, max: 25 },
    pressure: { ideal: 760, range: 6, prefersLow: false, changeSensitivity: 0.85 },
    hourlyActivity: [.3,.2,.15,.2,.3,.5,.6,.5,.3,.2,.15,.1,.1,.1,.1,.15,.3,.5,.7,.9,1,.8,.5,.4],
    seasonalActivity: [.3,.3,.5,.8,.9,.8,.6,.7,.9,1,.6,.3],
    prefersOvercast: true, prefersRain: false, windTolerance: 6,
    goodWindDirs: ["Ю","ЮЗ"], spawnMonth: 4, spawnWeeks: 3,
    tips: {
      great: "Джиг на бровках и свалах! Виброхвост, твистер. Вечерний и ночной выходы.",
      good: "Поролонки, мандулы. Жёсткое дно — песок, камень.",
      weak: "Отводной поводок с мелкой пассивкой. Ночью может быть лучше.",
      bad: "Тяжёлый джиг по русловым ямам. Или подожди смены погоды.",
    },
  },
  "Карп": {
    emoji: "🐡", type: "peaceful",
    waterTemp: { min: 10, active: 14, peakLow: 18, peakHigh: 22, decline: 26, max: 30 },
    pressure: { ideal: 758, range: 14, prefersLow: false, changeSensitivity: 0.5 },
    hourlyActivity: [.3,.2,.15,.2,.3,.4,.5,.6,.5,.3,.2,.15,.1,.15,.2,.3,.5,.6,.7,.8,.9,1,.7,.5],
    seasonalActivity: [.05,.05,.1,.3,.6,.8,.9,1,.8,.5,.2,.05],
    prefersOvercast: false, prefersRain: false, windTolerance: 4,
    goodWindDirs: ["Ю","ЮЗ","ЮВ"], spawnMonth: 4, spawnWeeks: 4,
    tips: {
      great: "Бойлы, кукуруза, пеллетс! Прикорми точку. Ночь — лучшее время.",
      good: "Волосяная оснастка с бойлом. Заиленные участки с ракушечником.",
      weak: "Мелкие насадки, PVA-пакеты. Минимум шума, тонкие поводки.",
      bad: "Попробуй зиг-риг в толще воды или подожди потепления.",
    },
  },
  "Карась": {
    emoji: "🐠", type: "peaceful",
    waterTemp: { min: 8, active: 12, peakLow: 16, peakHigh: 22, decline: 26, max: 28 },
    pressure: { ideal: 758, range: 16, prefersLow: false, changeSensitivity: 0.4 },
    hourlyActivity: [.1,.05,.05,.1,.2,.5,.8,.9,.7,.5,.3,.2,.15,.15,.2,.4,.6,.8,.9,.8,.5,.3,.2,.15],
    seasonalActivity: [.05,.05,.1,.4,.7,.9,1,.9,.7,.4,.1,.05],
    prefersOvercast: false, prefersRain: false, windTolerance: 4,
    goodWindDirs: ["Ю","ЮЗ","ЮВ","В"], spawnMonth: 4, spawnWeeks: 3,
    tips: {
      great: "Червь, опарыш, манка, кукуруза! Поплавочка или фидер. Прикормка обязательна.",
      good: "Бутерброд червь+опарыш. У камыша на глубине 1-2м.",
      weak: "Мелкие крючки, тонкая леска. Тесто с чесноком, перловка.",
      bad: "Навозный червь на тонкой оснастке. Или смени водоём.",
    },
  },
  "Лещ": {
    emoji: "🐟", type: "peaceful",
    waterTemp: { min: 5, active: 10, peakLow: 15, peakHigh: 18, decline: 22, max: 23 },
    pressure: { ideal: 757, range: 8, prefersLow: false, changeSensitivity: 0.8 },
    hourlyActivity: [.15,.1,.1,.2,.4,.7,.9,.8,.5,.3,.2,.15,.1,.15,.3,.5,.7,.85,.9,1,.7,.4,.25,.2],
    seasonalActivity: [.1,.1,.2,.5,.8,.9,1,.9,.7,.5,.2,.1],
    prefersOvercast: true, prefersRain: false, windTolerance: 5,
    goodWindDirs: ["Ю","ЮЗ","ЮВ"], spawnMonth: 4, spawnWeeks: 3,
    tips: {
      great: "Фидер с мотылём! Опарыш, червь. Ямы и бровки.",
      good: "Кормушка 40-60г. Пучок мотыля. Дистанция 30-50м.",
      weak: "Тонкие поводки 0.10-0.12. Ночная ловля может быть лучше.",
      bad: "Попробуй подлещика на мелководье или плотву.",
    },
  },
  "Сом": {
    emoji: "🐟", type: "predator",
    waterTemp: { min: 12, active: 16, peakLow: 20, peakHigh: 25, decline: 28, max: 30 },
    pressure: { ideal: 755, range: 10, prefersLow: true, changeSensitivity: 0.6 },
    hourlyActivity: [.6,.5,.4,.3,.2,.15,.1,.1,.05,.05,.05,.05,.05,.05,.05,.1,.2,.4,.6,.8,.9,1,.9,.7],
    seasonalActivity: [.0,.0,.05,.2,.5,.8,.9,1,.8,.4,.1,.0],
    prefersOvercast: true, prefersRain: true, windTolerance: 6,
    goodWindDirs: ["Ю","ЮЗ"], spawnMonth: 5, spawnWeeks: 3,
    tips: {
      great: "Квок, живец, пучок выползков! Ямы с 20:00 до рассвета.",
      good: "Крупный живец, лягушка. Донка на русловых бровках.",
      weak: "Кусочки рыбы на донке в яме. Ночью шансы выше.",
      bad: "Рыба залегла. Подождите потепления и стабилизации давления.",
    },
  },
  "Плотва": {
    emoji: "🐟", type: "peaceful",
    waterTemp: { min: 4, active: 8, peakLow: 12, peakHigh: 18, decline: 22, max: 25 },
    pressure: { ideal: 758, range: 12, prefersLow: false, changeSensitivity: 0.6 },
    hourlyActivity: [.1,.05,.05,.1,.3,.6,.8,.9,.7,.5,.4,.3,.25,.3,.35,.5,.7,.85,.9,.7,.4,.2,.15,.1],
    seasonalActivity: [.3,.3,.5,.8,1,.8,.7,.7,.8,.7,.4,.3],
    prefersOvercast: false, prefersRain: false, windTolerance: 5,
    goodWindDirs: ["Ю","ЮЗ","З","ЮВ"], spawnMonth: 3, spawnWeeks: 2,
    tips: {
      great: "Опарыш, мотыль, перловка! Поплавок или лёгкий фидер.",
      good: "Мелкие крючки, тонкая леска 0.10-0.14. У травы, на течении.",
      weak: "Бутерброд мотыль+опарыш. Пробуй разные глубины.",
      bad: "Самая тонкая оснастка, мотыль. Подожди стабильной погоды.",
    },
  },
  "Жерех": {
    emoji: "🐟", type: "predator",
    waterTemp: { min: 10, active: 14, peakLow: 18, peakHigh: 24, decline: 26, max: 28 },
    pressure: { ideal: 762, range: 8, prefersLow: false, changeSensitivity: 0.7 },
    hourlyActivity: [.05,.05,.05,.1,.3,.7,.9,1,.7,.4,.3,.2,.15,.2,.3,.5,.7,.9,.8,.5,.2,.1,.05,.05],
    seasonalActivity: [.0,.0,.1,.3,.6,.8,.9,1,.9,.5,.1,.0],
    prefersOvercast: false, prefersRain: false, windTolerance: 5,
    goodWindDirs: ["Ю","ЮЗ","З"], spawnMonth: 3, spawnWeeks: 2,
    tips: {
      great: "Кастмастер, пилькер! Дальний заброс на перекаты. Утренний «бой»!",
      good: "Блёсны 15-25г, бомбарда + стример. Ищи буруны.",
      weak: "Длинные забросы, тонкий шнур, прозрачные приманки.",
      bad: "Жерех на глубине. Глубоководные воблеры или переключись на судака.",
    },
  },
  "Форель": {
    emoji: "🐟", type: "predator",
    waterTemp: { min: 3, active: 6, peakLow: 10, peakHigh: 14, decline: 18, max: 20 },
    pressure: { ideal: 758, range: 10, prefersLow: true, changeSensitivity: 0.8 },
    hourlyActivity: [.1,.05,.05,.15,.3,.6,.8,.9,.7,.5,.3,.2,.2,.25,.3,.5,.7,.9,.85,.6,.3,.2,.15,.1],
    seasonalActivity: [.5,.5,.6,.8,.9,.7,.4,.5,.8,1,.7,.5],
    prefersOvercast: true, prefersRain: true, windTolerance: 4,
    goodWindDirs: ["З","ЮЗ","С"], spawnMonth: 9, spawnWeeks: 4,
    tips: {
      great: "Мелкие вращалки, микроколебалки, нимфы! Прохладные ручьи, перекаты.",
      good: "Воблеры-крэнки до 5см, мушки. За камнями, на обратках.",
      weak: "Тонкая леска, натуральные приманки. Ранние утренние часы.",
      bad: "Вода слишком тёплая. Ищи холодные притоки и родники.",
    },
  },
  "Налим": {
    emoji: "🐟", type: "predator",
    waterTemp: { min: 1, active: 2, peakLow: 4, peakHigh: 10, decline: 14, max: 15 },
    pressure: { ideal: 755, range: 15, prefersLow: true, changeSensitivity: 0.3 },
    hourlyActivity: [.7,.6,.5,.4,.2,.1,.05,.05,.05,.05,.05,.05,.05,.05,.05,.1,.2,.4,.6,.8,.9,1,.9,.8],
    seasonalActivity: [1,.9,.6,.2,.05,.0,.0,.0,.1,.3,.7,.9],
    prefersOvercast: true, prefersRain: true, windTolerance: 10,
    goodWindDirs: ["С","СВ","СЗ"], spawnMonth: 0, spawnWeeks: 3,
    tips: {
      great: "Живец, нарезка рыбы, пучок червей! Донки на ночь, каменистое дно.",
      good: "Ловля 18:00 — рассвет. Выползки, куриная печень на донке.",
      weak: "Мелкий ёрш или пескарь. Только ночная ловля.",
      bad: "Слишком тепло для налима. Ждите похолодания ниже 12°С воды.",
    },
  },
};

function estimateWaterTemp(airTemp, month) {
  const lag = [5, 4, 3, 2, 1, 0, -1, 0, 1, 2, 3, 4][month] || 0;
  return Math.max(0, Math.min(35, airTemp - lag));
}

function getSeason(month) {
  if (month >= 2 && month <= 4) return 1;
  if (month >= 5 && month <= 7) return 2;
  if (month >= 8 && month <= 10) return 3;
  return 0;
}

function getSeasonName(month) { return ["Зима","Весна","Лето","Осень"][getSeason(month)]; }

function computeFishScore(fishName, weather, moon, hour, month) {
  const p = FISH_PROFILES[fishName];
  if (!p) return { score: 50, level: "good", tip: "", factors: {} };
  const airTemp = weather?.temp ?? 15;
  const waterTemp = weather?.waterTemp ?? estimateWaterTemp(airTemp, month);
  const tp = p.waterTemp;
  let tS = 0;
  if (waterTemp < tp.min || waterTemp > tp.max) tS = 0;
  else if (waterTemp >= tp.peakLow && waterTemp <= tp.peakHigh) tS = 1;
  else if (waterTemp >= tp.active && waterTemp < tp.peakLow) tS = .4 + .6 * ((waterTemp - tp.active) / (tp.peakLow - tp.active));
  else if (waterTemp > tp.peakHigh && waterTemp <= tp.decline) tS = .4 + .6 * ((tp.decline - waterTemp) / (tp.decline - tp.peakHigh));
  else if (waterTemp < tp.active) tS = .1 + .3 * ((waterTemp - tp.min) / Math.max(1, tp.active - tp.min));
  else tS = .1 + .3 * ((tp.max - waterTemp) / Math.max(1, tp.max - tp.decline));
  const pressure = weather?.pressure ?? 760;
  const pDiff = Math.abs(pressure - p.pressure.ideal);
  let pS = Math.max(0, 1 - pDiff / p.pressure.range);
  if (p.pressure.prefersLow && pressure < p.pressure.ideal) pS = Math.min(1, pS + .15);
  if (!p.pressure.prefersLow && pressure > p.pressure.ideal) pS = Math.min(1, pS + .1);
  const hS = p.hourlyActivity[Math.min(23, Math.max(0, hour))] || .3;
  let sS = p.seasonalActivity[month] || .3;
  const isSpawn = month === p.spawnMonth || (month === p.spawnMonth + 1 && p.spawnWeeks > 2);
  if (isSpawn) sS *= .4;
  const clouds = weather?.clouds ?? 50;
  const cS = p.prefersOvercast ? (clouds > 70 ? 1 : clouds > 40 ? .7 : .4) : (clouds < 30 ? .9 : clouds < 60 ? .7 : .5);
  const ws = parseFloat(weather?.wind) || 0;
  let wS = ws <= 1 ? .6 : ws <= 3 ? .8 : ws <= p.windTolerance ? .7 : ws <= p.windTolerance + 3 ? .3 : .1;
  let wdS = .5;
  const wdDeg = weather?.windDeg;
  if (wdDeg != null) {
    const dirs = ["С","СВ","В","ЮВ","Ю","ЮЗ","З","СЗ"];
    const dir = dirs[Math.round(wdDeg / 45) % 8];
    wdS = p.goodWindDirs.includes(dir) ? .9 : .4;
    if (["С","СВ","В"].includes(dir)) wdS = Math.min(wdS, .35);
  }
  const mF = moon?.factor || .5;
  let mS = p.type === "peaceful" ? Math.max(.2, 1.1 - mF) : Math.max(.2, mF);
  // Weighted sum: temp 25, pressure 20, stability 10, hour 15, season 12, clouds 5, wind 5, windDir 3, moon 5
  const raw = tS * 25 + pS * 20 + .7 * 10 + hS * 15 + sS * 12 + cS * 5 + wS * 5 + wdS * 3 + mS * 5;
  const score = Math.round(Math.max(5, Math.min(95, raw)));
  let level, tip;
  if (score >= 70) { level = "great"; tip = p.tips.great; }
  else if (score >= 45) { level = "good"; tip = p.tips.good; }
  else if (score >= 25) { level = "weak"; tip = p.tips.weak; }
  else { level = "bad"; tip = p.tips.bad; }
  return { score, level, tip, isSpawn, waterTemp: Math.round(waterTemp) };
}

function computeBiteScoreAdvanced(weather, moon, hour, lat, lon) {
  const month = new Date().getMonth();
  const local = getLocalFish(lat, lon);
  const fishList = local.fish;
  const all = fishList.map(f => ({ fish: f, emoji: FISH_PROFILES[f]?.emoji || "🐟", ...computeFishScore(f, weather, moon, hour, month) }));
  const top = [...all].sort((a, b) => b.score - a.score).slice(0, 3);
  const avg = all.length > 0 ? Math.round(all.reduce((a, s) => a + s.score, 0) / all.length) : 50;
  return { score: Math.max(5, Math.min(95, avg)), topFish: top, allScores: all, month, season: getSeasonName(month), region: local.region, regionNote: local.note };
}

function computeBiteScore(weather, moon, hour) {
  if (!weather) return simulatedScore(hour);
  return computeBiteScoreAdvanced(weather, moon, hour).score;
}
function simulatedScore(hour) {
  if ((hour >= 5 && hour <= 8) || (hour >= 18 && hour <= 21)) return 70;
  if (hour >= 12 && hour <= 14) return 35;
  return 50;
}
function getGeneralRecommendation(score, weather, month) {
  const s = getSeason(month);
  const base = ["Зимой рыба малоактивна. Лучшее время — оттепели. Мелкие приманки.", "Весна — преднерестовый жор! Натуральные наживки.", "Летом ловите на зорьках. Днём рыба на глубине.", "Осень — жор хищника! Крупные приманки, трофейный сезон."][s];
  let rec = base;
  if (weather) {
    if (weather.pressure < 745) rec += " ⚠️ Низкое давление — хищник активнее.";
    if (weather.pressure > 765) rec += " ⚠️ Высокое давление — лучше мирная рыба.";
    if (parseFloat(weather.wind) > 7) rec += " 💨 Сильный ветер — утяжели оснастку.";
  }
  return rec;
}

function getScoreColor(s, v) {
  const c = v?.scoreColors || NIGHT.scoreColors;
  return s >= 70 ? c.great : s >= 45 ? c.good : s >= 25 ? c.weak : c.bad;
}
function getScoreLabel(s) { return s >= 70 ? "Отличный" : s >= 45 ? "Хороший" : s >= 25 ? "Слабый" : "Плохой"; }
function weatherEmoji(icon) {
  if (!icon) return "🌤";
  if (icon.includes("01")) return "☀️"; if (icon.includes("02")) return "⛅"; if (icon.includes("03") || icon.includes("04")) return "☁️";
  if (icon.includes("09") || icon.includes("10")) return "🌧"; if (icon.includes("11")) return "⛈"; if (icon.includes("13")) return "🌨"; return "🌤";
}
function windDir(deg) {
  if (deg == null) return "";
  const dirs = ["С", "СВ", "В", "ЮВ", "Ю", "ЮЗ", "З", "СЗ"];
  return dirs[Math.round(deg / 45) % 8];
}

function useWeather() {
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locationName, setLocationName] = useState("");
  const [geoCoords, setGeoCoords] = useState(null);
  const [manualLocation, setManualLocation] = useState(() => storage.get("manualLocation", null));

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        let lat, lon;
        if (manualLocation) { lat = manualLocation.lat; lon = manualLocation.lon; }
        else {
          try { const pos = await requestGeolocation(); lat = pos.lat; lon = pos.lon; }
          catch { lat = 55.75; lon = 37.62; }
        }
        setGeoCoords({ lat, lon });
        const [w, f] = await Promise.all([fetchWeather(lat, lon), fetchForecast(lat, lon)]);
        if (w) { setWeather(w); setLocationName(w.cityName || ""); }
        if (f) setForecast(f);
      } catch(e) { console.warn("Weather error:", e); }
      setLoading(false);
    };
    load();
  }, [manualLocation]);

  return { weather, forecast, loading, locationName, setManualLocation, geoCoords };
}

// ── Constants ──
const SCREENS = {
  home: "home", sessionActive: "sessionActive",
  diary: "diary", addCatch: "addCatch", viewCatch: "viewCatch",
  forecast: "forecast", stats: "stats",
  gear: "gear", addGear: "addGear",
  social: "social", spots: "spots", addSpot: "addSpot",
  profile: "profile", tournaments: "tournaments", plan: "plan",
  map: "map", friends: "friends",
  editProfile: "editProfile", locationPicker: "locationPicker",
  tournamentView: "tournamentView", tournamentJoin: "tournamentJoin",
};
const FISH_LIST = ["Щука","Окунь","Судак","Карп","Карась","Лещ","Сом","Плотва","Жерех","Форель","Налим","Язь","Голавль","Красноперка","Густера"];
const BAITS_LIST = ["Воблер","Блесна вращ.","Блесна колебл.","Джиг","Твистер","Виброхвост","Червь","Опарыш","Мотыль","Кукуруза","Живец","Бойл","Пенопласт","Тесто","Хлеб"];
const GEAR_TYPES = ["Удилище","Катушка","Леска","Шнур","Приманка","Крючки","Поплавок","Грузило","Подсак","Эхолот","Прочее"];

const FISH_EMOJI = { "Щука": "🐟", "Окунь": "🐠", "Судак": "🐟", "Карп": "🐡", "Форель": "🐟", "Сом": "🐟", "Лещ": "🐟", "Карась": "🐠", "Плотва": "🐟", "Жерех": "🐟" };
const fishEmoji = (fish) => FISH_EMOJI[fish] || "🐟";

const storage = {
  get: (key, def = null) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

// ═══════════════════════════════════════
//  BACKGROUNDS
// ═══════════════════════════════════════
function NightBg() {
  const stars = useMemo(() => [...Array(60)].map((_, i) => ({
    x: (i * 37 + 13) % 100, y: (i * 53 + 7) % 50,
    s: i % 8 === 0 ? 2.5 : i % 5 === 0 ? 2 : i % 3 === 0 ? 1.5 : 1,
    dur: 3 + i % 4 * 2, del: i * 0.2, bright: i % 12 === 0,
  })), []);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#06080e 0%,#0a0e18 30%,#0e1220 55%,#101828 75%,#0c1020 100%)" }} />
      {stars.map((st, i) => (
        <div key={i} style={{
          position: "absolute", left: `${st.x}%`, top: `${st.y}%`,
          width: st.s, height: st.s, borderRadius: "50%",
          background: st.bright ? "#e8eeff" : "#c0c8e0",
          boxShadow: st.bright ? "0 0 4px rgba(200,210,255,.5)" : "none",
          animation: `${st.bright ? "twinkleBright" : "twinkle"} ${st.dur}s ${st.del}s ease-in-out infinite`,
        }} />
      ))}
      <div style={{ position: "absolute", top: "15%", left: "15%", width: 70, height: 1.5, background: "linear-gradient(90deg,rgba(200,215,255,.9),transparent)", borderRadius: 1, animation: "shootingStar 9s 2s linear infinite" }} />
      <div style={{ position: "absolute", top: "8%", left: "55%", width: 50, height: 1, background: "linear-gradient(90deg,rgba(200,215,255,.7),transparent)", borderRadius: 1, animation: "shootingStar 12s 7s linear infinite" }} />
      <div style={{ position: "absolute", top: "6%", right: "14%", width: 36, height: 36, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%,#e4ecf4,#b8c4d8)", animation: "moonGlow 5s ease-in-out infinite" }} />
      <div style={{ position: "absolute", bottom: "8%", right: "13%", width: 50, height: 200, background: "linear-gradient(180deg,transparent,rgba(180,195,230,.05),rgba(180,195,230,.1),rgba(180,195,230,.04),transparent)", animation: "moonReflect 4s ease-in-out infinite", filter: "blur(6px)" }} />
      {[0, 1, 2].map(i => (
        <div key={`fog${i}`} style={{
          position: "absolute", bottom: `${50 + i * 12}%`, left: "-10%",
          width: "120%", height: 30 + i * 15,
          background: "linear-gradient(90deg,transparent,rgba(140,155,185,.04),rgba(140,155,185,.07),rgba(140,155,185,.04),transparent)",
          animation: `fogDrift ${10 + i * 4}s ${i * 2.5}s ease-in-out infinite`, filter: "blur(8px)",
        }} />
      ))}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "28%", background: "linear-gradient(to top,rgba(10,16,30,.7),transparent)" }} />
      <div style={{ position: "absolute", inset: 0, opacity: .02, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize: "128px" }} />
    </div>
  );
}

function DayBg() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#88b8d8 0%,#a0cce0 20%,#b8d8e8 40%,#c8e0ec 55%,#d8e8f0 70%,#c0d4e0 100%)" }} />
      <div style={{ position: "absolute", top: "6%", right: "18%", width: 44, height: 44, borderRadius: "50%", background: "radial-gradient(circle at 45% 45%,#fff8e0,#ffd860,#ffb830)", animation: "sunGlow 4s ease-in-out infinite" }} />
      {[0, 1, 2, 3, 4, 5].map(i => (
        <div key={`ray${i}`} style={{
          position: "absolute", top: "8%", right: "20%", width: 3, height: 60 + i * 15,
          background: "linear-gradient(180deg,rgba(255,200,80,.15),transparent)",
          transformOrigin: "top center", transform: `rotate(${i * 60}deg)`, filter: "blur(3px)",
          animation: `sparkle ${3 + i}s ${i * 0.5}s ease-in-out infinite`,
        }} />
      ))}
      {[0, 1, 2].map(i => (
        <div key={`cloud${i}`} style={{
          position: "absolute", top: `${8 + i * 8}%`, left: `${5 + i * 30}%`,
          width: 100 + i * 40, height: 30 + i * 8, borderRadius: 20,
          background: "rgba(255,255,255,.35)", boxShadow: "inset 0 -4px 8px rgba(0,0,0,.02)",
          animation: `cloudDrift ${15 + i * 5}s ${i * 3}s ease-in-out infinite`, filter: "blur(2px)",
        }} />
      ))}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "35%", background: "linear-gradient(to top,rgba(80,140,180,.12),rgba(100,160,200,.06),transparent)" }} />
      <div style={{ position: "absolute", bottom: "5%", left: "10%", width: "80%", height: "20%", opacity: .06, background: "repeating-conic-gradient(from 0deg,transparent 0deg,rgba(80,160,200,.4) 4deg,transparent 8deg)", animation: "caustic 6s linear infinite", filter: "blur(12px)" }} />
      {[...Array(20)].map((_, i) => (
        <div key={`sp${i}`} style={{
          position: "absolute", left: `${5 + i * 4.5}%`, bottom: `${3 + i % 5 * 5}%`,
          width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,.5)",
          animation: `sparkle ${2 + i % 3}s ${i * 0.3}s ease-in-out infinite`,
        }} />
      ))}
      {[0, 1, 2].map(i => (
        <div key={`rip${i}`} style={{
          position: "absolute", bottom: `${10 + i * 6}%`, left: "5%", width: "90%", height: 1.5,
          background: "linear-gradient(90deg,transparent,rgba(255,255,255,.12),rgba(255,255,255,.06),transparent)",
          animation: `ripple ${4 + i * 2}s ${i}s ease-in-out infinite`,
        }} />
      ))}
      {[0, 1].map(i => (
        <div key={`mist${i}`} style={{
          position: "absolute", bottom: `${25 + i * 10}%`, left: "-5%", width: "110%", height: 40,
          background: "linear-gradient(90deg,transparent,rgba(255,255,255,.08),rgba(255,255,255,.12),rgba(255,255,255,.06),transparent)",
          animation: `mistFloat ${12 + i * 5}s ${i * 3}s ease-in-out infinite`, filter: "blur(6px)",
        }} />
      ))}
      <div style={{ position: "absolute", inset: 0, opacity: .015, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize: "128px" }} />
    </div>
  );
}

// ═══════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════
export default function Klevometr() {
  const { isNight, toggle: toggleTheme, v } = useTheme();
  const { user: sbUser, updateProfile, clearCustomLocation } = useSupabaseUser();

  const [screen, setScreen] = useState(SCREENS.home);
  const [history, setHistory] = useState([]);
  const [screenData, setScreenData] = useState(null);

  // Session state
  const [sessionState, setSessionState] = useState("idle");
  const [elapsed, setElapsed] = useState(0);
  const [casts, setCasts] = useState(0);
  const [bites, setBites] = useState(0);
  const [caught, setCaught] = useState(0);
  const [events, setEvents] = useState([]);
  const [distance, setDistance] = useState(25);
  const [castAnim, setCastAnim] = useState(false);
  const [biteAnim, setBiteAnim] = useState(false);
  const [caughtAnim, setCaughtAnim] = useState(false);
  const startRef = useRef(null);
  const timerRef = useRef(null);

  // Data with dual sync
  const [catches, setCatches] = useSync("catches", [], "catches");
  const [gearItems, setGearItems] = useSync("gear", [], "gear");
  const [spots, setSpots] = useSync("spots", [], null);
  const [sessions, setSessions] = useSync("sessions", [], "sessions");

  const { weather, forecast, loading: weatherLoading, locationName, setManualLocation, geoCoords } = useWeather();
  const moon = getMoonPhase();
  const currentHour = new Date().getHours();
  const biteScore = computeBiteScore(weather, moon, currentHour);

  const go = useCallback((s, data = null) => {
    setHistory(p => [...p, screen]);
    setScreenData(data);
    setScreen(s);
  }, [screen]);

  const back = useCallback(() => {
    if (history.length) { setScreen(history[history.length - 1]); setHistory(p => p.slice(0, -1)); }
    else setScreen(SCREENS.home);
  }, [history]);

  useEffect(() => {
    if (!tg) return;
    if (screen !== SCREENS.home) {
      tg.BackButton.show();
      const h = () => back();
      tg.BackButton.onClick(h);
      return () => tg.BackButton.offClick(h);
    } else { tg.BackButton.hide(); }
  }, [screen, back]);

  useEffect(() => {
    if (sessionState === "active") {
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    } else { clearInterval(timerRef.current); }
    return () => clearInterval(timerRef.current);
  }, [sessionState]);

  const startSession = () => {
    hapticNotify("success");
    startRef.current = Date.now();
    setElapsed(0); setCasts(0); setBites(0); setCaught(0); setEvents([]);
    setSessionState("active");
    go(SCREENS.sessionActive);
  };

  const stopSession = () => {
    hapticNotify("warning");
    setSessionState("idle");
    if (casts > 0 || bites > 0 || caught > 0) {
      const session = {
        id: Date.now(), date: new Date().toLocaleDateString("ru-RU"),
        duration: elapsed, casts, bites, caught,
        weather: weather ? `${weather.temp}°, ${weather.pressure}мм` : "—",
        location: locationName || "—",
      };
      setSessions(prev => [session, ...prev].slice(0, 50));
    }
  };

  const addEvent = (type, text) => setEvents(p => [{ type, text, t: elapsed }, ...p].slice(0, 50));
  const addTip = (tip) => addEvent("tip", tip);
  const checkRecommendations = (nc, nb, nca) => {
    if (nc === 5 && nb === 0) setTimeout(() => addTip("💡 5 забросов без поклёвки — попробуй сменить приманку или дистанцию"), 800);
    if (nc === 12 && nb === 0) setTimeout(() => addTip("💡 Клёва нет — смени точку. Поищи бровку или перепад глубины"), 800);
    if (nc === 20 && nb <= 1) setTimeout(() => addTip("💡 Слабая активность. Попробуй замедлить проводку"), 800);
    if (nb === 1 && nca === 0) setTimeout(() => addTip("💡 Есть контакт! Не торопись с подсечкой"), 600);
    if (nca === 1) setTimeout(() => addTip("🔥 Первая рыба! Запомни дистанцию и приманку"), 600);
    if (nca === 3) setTimeout(() => addTip("🔥 Серия! Ты нашёл рабочую точку"), 600);
    if (nca === 5) setTimeout(() => addTip("🏆 5 рыб — отличная сессия!"), 600);
    const hour = new Date().getHours();
    if (nc === 1 && hour >= 16 && hour <= 17) setTimeout(() => addTip("🌅 Вечерняя зорька — лучшее время!"), 500);
    if (nc === 1 && hour >= 5 && hour <= 6) setTimeout(() => addTip("🌅 Утренняя зорька — золотое время!"), 500);
  };

  const doCast = () => { haptic("medium"); playCastSound(); const nc = casts + 1; setCasts(nc); addEvent("cast", `Заброс #${nc} — ${distance}м`); setCastAnim(true); setTimeout(() => setCastAnim(false), 400); checkRecommendations(nc, bites, caught); };
  const doBite = () => { haptic("heavy"); playBiteSound(); const nb = bites + 1; setBites(nb); addEvent("bite", "Поклёвка!"); setBiteAnim(true); setTimeout(() => setBiteAnim(false), 400); checkRecommendations(casts, nb, caught); };
  const doCaught = () => { haptic("heavy"); hapticNotify("success"); playCaughtSound(); const nc2 = caught + 1; setCaught(nc2); addEvent("caught", "Рыба поймана! 🐟"); setCaughtAnim(true); setTimeout(() => setCaughtAnim(false), 400); checkRecommendations(casts, bites, nc2); };

  const fmt = (s) => `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const bph = elapsed > 0 ? (bites / (elapsed / 3600)).toFixed(1) : "0.0";
  const realiz = bites > 0 ? Math.round((caught / bites) * 100) : 0;
  const userName = sbUser?.nickname || tg?.initDataUnsafe?.user?.first_name || "рыбак";
  const userAvatar = sbUser?.avatar_emoji || storage.get("profile_avatar", "🎣");

  const saveCatch = (cd) => setCatches(prev => [{ id: Date.now(), ...cd }, ...prev]);
  const deleteCatch = (id) => setCatches(prev => prev.filter(c => c.id !== id));
  const saveGear = (item) => setGearItems(prev => [{ id: Date.now(), ...item }, ...prev]);
  const deleteGear = (id) => setGearItems(prev => prev.filter(g => g.id !== id));
  const saveSpot = (spot) => setSpots(prev => [{ id: Date.now(), ...spot }, ...prev]);
  const deleteSpot = (id) => setSpots(prev => prev.filter(s => s.id !== id));

  const wd = { weather, forecast, moon, biteScore, weatherLoading, locationName, currentHour, setManualLocation, geoCoords };
  const shared = { catches, gearItems, spots, sessions, saveCatch, deleteCatch, saveGear, deleteGear, saveSpot, deleteSpot };
  const profileProps = { sbUser, updateProfile, clearCustomLocation, userAvatar };

  // Check URL for tournament invite
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get("invite") || tg?.initDataUnsafe?.start_param;
    if (inviteCode && inviteCode.startsWith("t_")) {
      go(SCREENS.tournamentJoin, { invite_code: inviteCode.replace("t_", "") });
    }
  }, []);

  return (
    <div style={{ width: "100%", maxWidth: 480, minHeight: "100vh", margin: "0 auto", color: v.text, fontFamily: "'DM Sans',system-ui,sans-serif", position: "relative", overflow: "hidden", transition: "color .4s" }}>
      {isNight ? <NightBg /> : <DayBg />}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800;900&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes liveDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(0.8)}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(176,200,232,0.3)}70%{box-shadow:0 0 0 10px rgba(176,200,232,0)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes twinkle{0%,100%{opacity:.15;transform:scale(1)}50%{opacity:.9;transform:scale(1.4)}}
        @keyframes twinkleBright{0%,100%{opacity:.3;transform:scale(1)}30%{opacity:1;transform:scale(1.6)}60%{opacity:.5}}
        @keyframes moonGlow{0%,100%{box-shadow:0 0 30px rgba(200,215,240,.12),0 0 60px rgba(180,195,230,.04)}50%{box-shadow:0 0 50px rgba(200,215,240,.22),0 0 100px rgba(180,195,230,.08)}}
        @keyframes moonReflect{0%,100%{opacity:.08;transform:scaleX(1)}50%{opacity:.18;transform:scaleX(1.06)}}
        @keyframes fogDrift{0%,100%{transform:translateX(0);opacity:.05}50%{transform:translateX(25px);opacity:.1}}
        @keyframes shootingStar{0%{transform:translateX(0) translateY(0) rotate(-30deg);opacity:0}5%{opacity:1}18%{opacity:.5}22%{transform:translateX(140px) translateY(70px) rotate(-30deg);opacity:0}100%{opacity:0}}
        @keyframes sunGlow{0%,100%{box-shadow:0 0 40px rgba(255,200,80,.15),0 0 80px rgba(255,180,60,.06)}50%{box-shadow:0 0 60px rgba(255,200,80,.25),0 0 120px rgba(255,180,60,.12)}}
        @keyframes sparkle{0%,100%{opacity:0;transform:scale(0)}50%{opacity:.7;transform:scale(1)}}
        @keyframes caustic{0%{transform:translate(0,0) rotate(0deg)}33%{transform:translate(8px,-10px) rotate(1.5deg)}66%{transform:translate(-6px,8px) rotate(-1deg)}100%{transform:translate(0,0) rotate(0deg)}}
        @keyframes cloudDrift{0%,100%{transform:translateX(0)}50%{transform:translateX(30px)}}
        @keyframes ripple{0%,100%{transform:scaleX(1) translateX(0);opacity:.1}50%{transform:scaleX(1.02) translateX(-5px);opacity:.2}}
        @keyframes mistFloat{0%,100%{opacity:.08;transform:translateX(0)}50%{opacity:.15;transform:translateX(15px)}}
        .f0{animation:fadeUp .45s cubic-bezier(.16,1,.3,1) both}
        .f1{animation:fadeUp .45s cubic-bezier(.16,1,.3,1) .06s both}
        .f2{animation:fadeUp .45s cubic-bezier(.16,1,.3,1) .12s both}
        .f3{animation:fadeUp .45s cubic-bezier(.16,1,.3,1) .18s both}
        .f4{animation:fadeUp .45s cubic-bezier(.16,1,.3,1) .24s both}
        .f5{animation:fadeUp .45s cubic-bezier(.16,1,.3,1) .30s both}
        .btn:active{transform:scale(.94)!important;opacity:.8;transition:transform .1s,opacity .1s}
        .btn{transition:transform .2s,opacity .2s}
        ::-webkit-scrollbar{width:0}
        input,select,textarea{font-family:'DM Sans',sans-serif;font-size:14px}
        input::placeholder{color:${v.textDim}}
        select option{background:${v.isDark?"#0d1e35":"#f0f4f8"};color:${v.text}}
      `}</style>

      <div style={{ position: "relative", zIndex: 1, overflowY: "auto", paddingBottom: 72 }} key={screen}>
        {screen === SCREENS.home && <HomeScreen go={go} wd={wd} startSession={startSession} userName={userName} shared={shared} v={v} toggleTheme={toggleTheme} isNight={isNight} />}
        {screen === SCREENS.sessionActive && <ActiveSession {...{ elapsed, casts, bites, caught, events, distance, setDistance, doCast, doBite, doCaught, stopSession, fmt, bph, realiz, castAnim, biteAnim, caughtAnim, back, wd, v }} />}
        {screen === SCREENS.forecast && <ForecastScreen wd={wd} v={v} />}
        {screen === SCREENS.diary && <DiaryScreen go={go} shared={shared} v={v} />}
        {screen === SCREENS.addCatch && <AddCatchScreen back={back} saveCatch={saveCatch} weather={weather} locationName={locationName} v={v} />}
        {screen === SCREENS.viewCatch && <ViewCatchScreen back={back} catchItem={screenData} deleteCatch={deleteCatch} v={v} />}
        {screen === SCREENS.stats && <StatsScreen shared={shared} v={v} />}
        {screen === SCREENS.gear && <GearScreen go={go} shared={shared} v={v} />}
        {screen === SCREENS.addGear && <AddGearScreen back={back} saveGear={saveGear} v={v} />}
        {screen === SCREENS.social && <SocialScreen v={v} />}
        {screen === SCREENS.spots && <SpotsScreen go={go} shared={shared} v={v} />}
        {screen === SCREENS.addSpot && <AddSpotScreen back={back} saveSpot={saveSpot} locationName={locationName} v={v} />}
        {screen === SCREENS.profile && <ProfileScreen shared={shared} userName={userName} go={go} v={v} toggleTheme={toggleTheme} isNight={isNight} {...profileProps} />}
        {screen === SCREENS.tournaments && <TournamentsScreen v={v} go={go} />}
        {screen === SCREENS.tournamentView && <TournamentViewScreen back={back} tournament={screenData} v={v} saveCatch={saveCatch} />}
        {screen === SCREENS.tournamentJoin && <TournamentJoinScreen back={back} inviteData={screenData} v={v} go={go} />}
        {screen === SCREENS.plan && <PlanScreen wd={wd} v={v} />}
        {screen === SCREENS.map && <MapScreen shared={shared} go={go} v={v} />}
        {screen === SCREENS.friends && <FriendsScreen back={back} v={v} />}
        {screen === SCREENS.editProfile && <EditProfileScreen back={back} v={v} {...profileProps} />}
        {screen === SCREENS.locationPicker && <LocationPickerScreen back={back} v={v} updateProfile={updateProfile} clearCustomLocation={clearCustomLocation} setManualLocation={setManualLocation} sbUser={sbUser} />}
      </div>

      {screen !== SCREENS.sessionActive && screen !== SCREENS.map && screen !== SCREENS.tournamentView && (
        <div style={{
          position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: "100%", maxWidth: 480,
          background: v.tabBg, backdropFilter: "blur(24px)",
          borderTop: `1px solid ${v.tabBorder}`,
          display: "flex", justifyContent: "space-around",
          padding: "6px 0 calc(8px + env(safe-area-inset-bottom))", zIndex: 10,
          boxShadow: v.isDark ? "0 -8px 32px rgba(0,0,0,0.4)" : "0 -4px 20px rgba(0,0,0,0.06)",
          transition: "background .4s, border-color .4s",
        }}>
          {[
            { k: SCREENS.home, icon: "🏠", label: "Главная" },
            { k: SCREENS.diary, icon: "📖", label: "Дневник" },
            { k: SCREENS.forecast, icon: "🌤", label: "Прогноз" },
            { k: SCREENS.social, icon: "👥", label: "Лента" },
            { k: SCREENS.profile, icon: "👤", label: "Профиль" },
          ].map(t => (
            <button key={t.k} onClick={() => { haptic("light"); setHistory([]); setScreen(t.k); }} className="btn"
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                border: "none", background: "none", cursor: "pointer", padding: "4px 10px",
                fontFamily: "'DM Sans',sans-serif", transition: "color .2s",
                color: screen === t.k ? v.tabActive : v.tabInactive,
              }}>
              <span style={{ fontSize: 20, filter: screen === t.k ? `drop-shadow(0 0 6px ${v.accent}80)` : "none" }}>{t.icon}</span>
              <span style={{ fontSize: 9, fontWeight: screen === t.k ? 800 : 500, letterSpacing: 0.3 }}>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Themed helpers ──
function GlassCard({ v, children, style = {}, className = "" }) {
  return (
    <div className={className} style={{ ...v.glass, borderRadius: 18, padding: 18, marginBottom: 10, transition: "all .4s", ...style }}>
      {children}
    </div>
  );
}

function ThemedInput({ v, style = {}, ...props }) {
  return <input {...props} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, boxSizing: "border-box", background: v.inputBg, border: `1px solid ${v.inputBorder}`, color: v.text, outline: "none", fontSize: 14, fontWeight: 500, backdropFilter: "blur(10px)", transition: "all .3s", ...style }} />;
}

function ThemedSelect({ v, style = {}, children, ...props }) {
  return <select {...props} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, boxSizing: "border-box", background: v.inputBg, border: `1px solid ${v.inputBorder}`, color: v.text, outline: "none", fontSize: 14, fontWeight: 500, ...style }}>{children}</select>;
}

function Field({ label, v, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: v.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════
//  HOME SCREEN
// ═══════════════════════════════════════
function HomeScreen({ go, wd, startSession, userName, shared, v, toggleTheme, isNight }) {
  const { weather, moon, biteScore, weatherLoading, locationName } = wd;
  const { catches = [], sessions = [], gearItems = [], spots = [] } = shared || {};
  const now = new Date();
  const totalWeight = catches.reduce((a, c) => a + (parseFloat(c.weight) || 0), 0).toFixed(1);

  return (
    <div style={{ padding: "0 16px 16px" }}>
      {/* Header */}
      <div className="f0" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "20px 0 8px" }}>
        <div>
          <div style={{ fontSize: 11, color: v.textDim, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase" }}>
            {locationName ? `📍 ${locationName}` : "🎣 Клёвометр"}
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: v.text, marginTop: 4, letterSpacing: "-.03em" }}>
            Привет, {userName}!
          </div>
          <div style={{ fontSize: 13, color: v.textMuted, marginTop: 5 }}>
            {now.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
          </div>
        </div>
        <button onClick={toggleTheme} style={{
          width: 40, height: 40, borderRadius: 12,
          background: v.card, border: `1px solid ${v.cardBorder}`,
          backdropFilter: "blur(16px)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, transition: "all .3s",
        }}>{isNight ? "🌙" : "☀️"}</button>
      </div>

      {/* Start session CTA */}
      <button onClick={startSession} className="btn f1" style={{
        width: "100%", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 14,
        padding: "18px 20px", boxSizing: "border-box", marginBottom: 10, borderRadius: 20,
        ...v.glass, border: `1.5px solid ${v.accentBorder}`, background: v.accentSoft,
        animation: "pulse 3s ease-in-out infinite",
      }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: `${v.accent}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={v.accent} strokeWidth="2" strokeLinecap="round"><path d="M4 20L12 4" /><path d="M12 4c2 0 6 1 8 4" /><path d="M20 8c-1 3-3 5-5 7" /><circle cx="15" cy="15" r="1.5" fill={v.accent} /><path d="M15 16.5v4" /></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: v.accent }}>Начать рыбалку</div>
          <div style={{ fontSize: 12, color: v.textMuted, marginTop: 3 }}>Забросы · поклёвки · аналитика</div>
        </div>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={v.accent} strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
      </button>

      {/* Bite score */}
      <button onClick={() => go(SCREENS.forecast)} className="btn f2" style={{
        width: "100%", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 16,
        padding: "16px 20px", boxSizing: "border-box", marginBottom: 10, borderRadius: 20, ...v.glass,
      }}>
        <div style={{ position: "relative", width: 58, height: 58, flexShrink: 0 }}>
          <svg width={58} height={58} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={29} cy={29} r={24} fill="none" stroke={`${v.accent}12`} strokeWidth={4.5} />
            <circle cx={29} cy={29} r={24} fill="none" stroke={getScoreColor(biteScore, v)} strokeWidth={4.5} strokeDasharray={150.8} strokeDashoffset={150.8 * (1 - biteScore / 100)} strokeLinecap="round" />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, color: getScoreColor(biteScore, v) }}>
            {weatherLoading ? "…" : biteScore}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: v.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em" }}>Прогноз клёва</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: getScoreColor(biteScore, v), marginTop: 3, letterSpacing: "-.02em" }}>{getScoreLabel(biteScore)}</div>
          <div style={{ fontSize: 12, color: v.textMuted, marginTop: 4 }}>
            {weather ? `${weatherEmoji(weather.icon)} ${weather.temp}° · ${weather.pressure}мм · ${weather.wind}м/с` : `${moon.icon} ${moon.name}`}
          </div>
        </div>
      </button>

      {/* Quick stats */}
      <div className="f3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        {[
          { v2: catches.length, l: "уловов", c: v.stats[0], icon: "🐟" },
          { v2: `${totalWeight}кг`, l: "поймано", c: v.stats[1], icon: "⚖️" },
          { v2: sessions.length, l: "сессий", c: v.stats[2], icon: "📊" },
        ].map(s => (
          <GlassCard key={s.l} v={v} style={{ padding: "14px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 18 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.c, marginTop: 4 }}>{s.v2}</div>
            <div style={{ fontSize: 10, color: v.textDim, fontWeight: 600, marginTop: 2 }}>{s.l}</div>
          </GlassCard>
        ))}
      </div>

      {/* Grid nav */}
      <div className="f4" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[
          { icon: "📖", label: "Дневник", sub: `${catches.length} записей`, screen: SCREENS.diary, color: v.stats[0] },
          { icon: "📊", label: "Статистика", sub: "Аналитика", screen: SCREENS.stats, color: v.stats[1] },
          { icon: "🗺", label: "Карта", sub: `${spots.length} меток`, screen: SCREENS.map, color: v.stats[2] },
          { icon: "🎒", label: "Снаряжение", sub: `${gearItems.length} предм.`, screen: SCREENS.gear, color: v.stats[3] },
          { icon: "🏆", label: "Турниры", sub: "Соревнования", screen: SCREENS.tournaments, color: v.stats[1] },
          { icon: "📅", label: "Планирование", sub: "Календарь", screen: SCREENS.plan, color: v.stats[2] },
        ].map(item => (
          <button key={item.label} onClick={() => { haptic("light"); go(item.screen); }} className="btn"
            style={{ ...v.glass, padding: "14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left", boxSizing: "border-box", borderRadius: 16, transition: "all .3s" }}>
            <div style={{ fontSize: 22, width: 42, height: 42, borderRadius: 12, background: `${item.color}15`, border: `1px solid ${item.color}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{item.icon}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: v.text }}>{item.label}</div>
              <div style={{ fontSize: 11, color: v.textDim, marginTop: 2 }}>{item.sub}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Last catch */}
      {catches.length > 0 && (
        <GlassCard v={v} className="f5" style={{ marginTop: 10, padding: 16, borderRadius: 20 }}>
          <div style={{ fontSize: 11, color: v.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>{fishEmoji(catches[0].fish)} Последний улов</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${v.accent}10`, border: `1px solid ${v.accent}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{fishEmoji(catches[0].fish)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{catches[0].fish}</div>
              <div style={{ fontSize: 12, color: v.textMuted, marginTop: 2 }}>{catches[0].location || "—"} · {catches[0].bait || "—"}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 900, fontSize: 17, color: v.accent }}>{catches[0].weight}<span style={{ fontSize: 10, color: v.textDim }}> кг</span></div>
              <div style={{ fontSize: 10, color: v.textDim }}>{catches[0].date}</div>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
//  ACTIVE SESSION
// ═══════════════════════════════════════
function ActiveSession({ elapsed, casts, bites, caught, events, distance, setDistance, doCast, doBite, doCaught, stopSession, fmt, bph, realiz, castAnim, biteAnim, caughtAnim, back, wd, v }) {
  const { weather } = wd;
  const actionColors = [
    { c: v.stats[0], b: `${v.stats[0]}30` },
    { c: v.stats[2], b: `${v.stats[2]}30` },
    { c: v.stats[1], b: `${v.stats[1]}30` },
  ];
  return (
    <div style={{ padding: "0 16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0 8px" }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>Рыбалка</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, background: `${v.accent}12`, border: `1px solid ${v.accent}25` }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: v.accent, animation: "liveDot 1.2s infinite" }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: v.accent, letterSpacing: 1 }}>LIVE</span>
        </div>
      </div>

      {weather && (
        <div className="f0" style={{ display: "flex", justifyContent: "center", gap: 14, padding: "6px 0 10px", flexWrap: "wrap" }}>
          {[`${weatherEmoji(weather.icon)} ${weather.temp}°`, `🌡 ${weather.pressure}мм`, `💨 ${weather.wind}м/с ${windDir(weather.windDeg)}`, `💧 ${weather.humidity}%`].map(t =>
            <span key={t} style={{ fontSize: 11, color: v.textMuted, fontWeight: 500 }}>{t}</span>
          )}
        </div>
      )}

      {/* Timer */}
      <GlassCard v={v} className="f0" style={{ textAlign: "center", padding: "22px 16px", borderRadius: 24, border: `1px solid ${v.accentBorder}` }}>
        <div style={{ fontSize: 52, fontWeight: 900, fontFamily: "'Courier New',monospace", letterSpacing: 5, color: v.accent, textShadow: `0 0 30px ${v.accent}40` }}>{fmt(elapsed)}</div>
        <div style={{ display: "flex", gap: 28, justifyContent: "center", marginTop: 14 }}>
          {[
            { val: casts, l: "ЗАБРОСОВ", c: actionColors[0].c },
            { val: bites, l: "ПОКЛЁВОК", c: actionColors[1].c },
            { val: caught, l: "ПОЙМАНО", c: actionColors[2].c },
          ].map(s => (
            <div key={s.l}>
              <div style={{ fontSize: 26, fontWeight: 900, color: s.c }}>{s.val}</div>
              <div style={{ fontSize: 9, color: v.textDim, fontWeight: 700, letterSpacing: 1 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Distance */}
      <GlassCard v={v} className="f1" style={{ padding: "14px 16px", borderRadius: 16 }}>
        <div style={{ fontSize: 11, color: v.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Дистанция: <span style={{ color: v.accent }}>{distance}м</span></div>
        <input type="range" min={5} max={80} value={distance} onChange={e => setDistance(+e.target.value)} style={{ width: "100%", accentColor: v.accent, height: 5, cursor: "pointer" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: v.textDim, marginTop: 5 }}>
          <span>5м</span><span>Ближняя</span><span>Средняя</span><span>Дальняя</span><span>80м</span>
        </div>
      </GlassCard>

      {/* Action buttons */}
      <div className="f2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
        {[
          { fn: doCast, anim: castAnim, icon: "🎯", label: "Заброс", count: casts, ...actionColors[0] },
          { fn: doBite, anim: biteAnim, icon: "⚡", label: "Поклёвка", count: bites, ...actionColors[1] },
          { fn: doCaught, anim: caughtAnim, icon: "🐟", label: "Поймал", count: caught, ...actionColors[2] },
        ].map(bt => (
          <button key={bt.label} onClick={bt.fn} className="btn" style={{
            padding: "18px 8px", borderRadius: 18, border: `2px solid ${bt.b}`,
            background: `linear-gradient(180deg,${bt.c}12,transparent)`,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", flexDirection: "column", alignItems: "center",
            transform: bt.anim ? "scale(1.08)" : "scale(1)", transition: "transform .15s",
            boxShadow: bt.anim ? `0 0 20px ${bt.c}40` : "none",
          }}>
            <span style={{ fontSize: 30 }}>{bt.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: bt.c, marginTop: 6 }}>{bt.label}</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: bt.c, marginTop: 2 }}>{bt.count}</span>
          </button>
        ))}
      </div>

      {/* Analytics */}
      <div className="f3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        {[
          { l: "ПОКЛЁВКИ/ЧАС", val: bph, c: v.stats[2] },
          { l: "РЕАЛИЗАЦИЯ", val: `${realiz}%`, c: v.stats[1] },
          { l: "ЗАБРОСОВ/ЧАС", val: elapsed > 0 ? (casts / (elapsed / 3600)).toFixed(1) : "0.0", c: v.stats[0] },
          { l: "ПОДСЕЧКА", val: `${casts > 0 ? Math.round((bites / casts) * 100) : 0}%`, c: v.stats[3] },
        ].map(s => (
          <GlassCard key={s.l} v={v} style={{ padding: 12, borderRadius: 14, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: v.textDim, fontWeight: 700, letterSpacing: 1 }}>{s.l}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.c, marginTop: 4 }}>{s.val}</div>
          </GlassCard>
        ))}
      </div>

      {/* Event log */}
      {events.length > 0 && (
        <GlassCard v={v} className="f4" style={{ padding: 14, borderRadius: 16 }}>
          <div style={{ fontSize: 11, color: v.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>📋 Лента событий</div>
          <div style={{ maxHeight: 160, overflowY: "auto" }}>
            {events.slice(0, 10).map((ev, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < Math.min(events.length, 10) - 1 ? `1px solid ${v.cardBorder}` : "none", animation: i === 0 ? "slideDown .3s ease" : "none" }}>
                <span style={{ fontSize: 14 }}>{ev.type === "cast" ? "🎯" : ev.type === "bite" ? "⚡" : ev.type === "tip" ? "💡" : "🐟"}</span>
                <span style={{ flex: 1, fontSize: 12, color: ev.type === "tip" ? v.stats[3] : ev.type === "bite" ? v.stats[2] : ev.type === "caught" ? v.stats[1] : v.textMuted, fontWeight: ev.type === "tip" ? 500 : 600, fontStyle: ev.type === "tip" ? "italic" : "normal" }}>{ev.text}</span>
                <span style={{ fontSize: 10, color: v.textDim, fontFamily: "monospace" }}>{fmt(ev.t)}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <button onClick={() => { stopSession(); back(); }} className="btn" style={{ width: "100%", padding: 15, borderRadius: 16, border: `1.5px solid ${v.btnDangerBorder}`, background: v.btnDanger, color: v.btnDangerColor, fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
        ⏹ Завершить сессию
      </button>
    </div>
  );
}

// ═══════════════════════════════════════
//  DIARY SCREEN
// ═══════════════════════════════════════
function DiaryScreen({ go, shared, v }) {
  const { catches } = shared;
  const [filter, setFilter] = useState("all");
  const fishTypes = [...new Set(catches.map(c => c.fish))];
  const filtered = filter === "all" ? catches : catches.filter(c => c.fish === filter);
  const totalWeight = catches.reduce((a, c) => a + (parseFloat(c.weight) || 0), 0).toFixed(1);

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>Дневник улова</div>
        <div style={{ fontSize: 13, color: v.textMuted, marginTop: 2 }}>{catches.length} записей · {totalWeight} кг</div>
      </div>

      <button onClick={() => go(SCREENS.addCatch)} className="btn f1" style={{ width: "100%", padding: 14, borderRadius: 16, border: "none", background: v.btnPrimary, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}>
        + Добавить улов
      </button>

      {fishTypes.length > 1 && (
        <div className="f2" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 10 }}>
          {["all", ...fishTypes].map(f => (
            <button key={f} onClick={() => setFilter(f)} className="btn" style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${filter === f ? v.accent : v.cardBorder}`, background: filter === f ? `${v.accent}15` : "transparent", color: filter === f ? v.accent : v.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}>
              {f === "all" ? "Все" : f}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="f3" style={{ textAlign: "center", padding: "40px 0", color: v.textDim }}>
          <div style={{ fontSize: 40 }}>🎣</div>
          <div style={{ marginTop: 12, fontSize: 14 }}>Пока нет уловов</div>
        </div>
      ) : filtered.map((c, i) => (
        <button key={c.id} onClick={() => { haptic("light"); go(SCREENS.viewCatch, c); }} className="btn"
          style={{ ...v.glass, width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: 14, cursor: "pointer", boxSizing: "border-box", borderRadius: 16, marginBottom: 8, animation: `fadeUp .4s ease ${i * 0.05}s both` }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: `${v.accent}10`, border: `1px solid ${v.accent}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{fishEmoji(c.fish)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{c.fish}</div>
            <div style={{ fontSize: 11, color: v.textMuted, marginTop: 2 }}>{c.location || "—"} · {c.bait || "—"}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 900, fontSize: 17, color: v.accent }}>{c.weight}<span style={{ fontSize: 10, color: v.textDim }}> кг</span></div>
            <div style={{ fontSize: 10, color: v.textDim, marginTop: 2 }}>{c.date}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════
//  ADD CATCH
// ═══════════════════════════════════════
function AddCatchScreen({ back, saveCatch, weather, locationName, v }) {
  const [form, setForm] = useState({
    fish: "", weight: "", length: "", location: locationName || "",
    bait: "", gear: "", notes: "",
    date: new Date().toLocaleDateString("ru-RU"),
    weather: weather ? `${weather.temp}°C, ${weather.pressure}мм, ветер ${weather.wind}м/с` : "",
  });
  const set = (k, val) => setForm(p => ({ ...p, [k]: val }));
  const handleSave = () => { if (!form.fish) { hapticNotify("error"); return; } saveCatch(form); hapticNotify("success"); back(); };

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}><div style={{ fontSize: 22, fontWeight: 900 }}>Добавить улов</div></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Вид рыбы *" v={v}><ThemedSelect v={v} value={form.fish} onChange={e => set("fish", e.target.value)}><option value="">Выбери рыбу</option>{FISH_LIST.map(f => <option key={f} value={f}>{f}</option>)}</ThemedSelect></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Вес (кг)" v={v}><ThemedInput v={v} type="number" step="0.1" placeholder="0.0" value={form.weight} onChange={e => set("weight", e.target.value)} /></Field>
          <Field label="Длина (см)" v={v}><ThemedInput v={v} type="number" placeholder="0" value={form.length} onChange={e => set("length", e.target.value)} /></Field>
        </div>
        <Field label="Место" v={v}><ThemedInput v={v} placeholder="Название водоёма" value={form.location} onChange={e => set("location", e.target.value)} /></Field>
        <Field label="Приманка / наживка" v={v}><ThemedSelect v={v} value={form.bait} onChange={e => set("bait", e.target.value)}><option value="">Выбери приманку</option>{BAITS_LIST.map(b => <option key={b} value={b}>{b}</option>)}</ThemedSelect></Field>
        <Field label="Снасть" v={v}><ThemedInput v={v} placeholder="Спиннинг 2.4м" value={form.gear} onChange={e => set("gear", e.target.value)} /></Field>
        <Field label="Погода" v={v}><ThemedInput v={v} placeholder="Авто" value={form.weather} onChange={e => set("weather", e.target.value)} /></Field>
        <Field label="Заметки" v={v}><textarea placeholder="Поведение рыбы..." value={form.notes} onChange={e => set("notes", e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, boxSizing: "border-box", background: v.inputBg, border: `1px solid ${v.inputBorder}`, color: v.text, outline: "none", fontSize: 14, resize: "none", minHeight: 72, fontFamily: "inherit" }} /></Field>
      </div>
      <button onClick={handleSave} className="btn" style={{ width: "100%", padding: 15, borderRadius: 16, border: "none", background: v.btnPrimary, color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer", fontFamily: "inherit", marginTop: 14 }}>💾 Сохранить улов</button>
    </div>
  );
}

// ═══════════════════════════════════════
//  VIEW CATCH
// ═══════════════════════════════════════
function ViewCatchScreen({ back, catchItem, deleteCatch, v }) {
  if (!catchItem) return null;
  const handleDelete = () => { hapticNotify("warning"); deleteCatch(catchItem.id); back(); };
  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}><div style={{ fontSize: 22, fontWeight: 900 }}>Карточка улова</div></div>
      <GlassCard v={v} className="f1" style={{ borderRadius: 20, overflow: "hidden", padding: 0 }}>
        <div style={{ height: 140, background: `linear-gradient(135deg,${v.accent}15,${v.accent}08)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64 }}>{fishEmoji(catchItem.fish)}</div>
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{catchItem.fish}</div>
            <div style={{ padding: "4px 12px", borderRadius: 20, background: `${v.accent}12`, color: v.accent, fontSize: 13, fontWeight: 700 }}>🏆 Улов</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { l: "Вес", val: catchItem.weight ? `${catchItem.weight} кг` : "—", c: v.stats[2] },
              { l: "Длина", val: catchItem.length ? `${catchItem.length} см` : "—", c: v.stats[0] },
              { l: "Дата", val: catchItem.date, c: v.stats[3] },
              { l: "Место", val: catchItem.location || "—", c: v.stats[0] },
              { l: "Приманка", val: catchItem.bait || "—", c: v.stats[1] },
              { l: "Снасть", val: catchItem.gear || "—", c: v.stats[2] },
            ].map(s => (
              <div key={s.l} style={{ padding: "10px 12px", borderRadius: 12, background: `${v.accent}05`, border: `1px solid ${v.cardBorder}` }}>
                <div style={{ fontSize: 10, color: v.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.l}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: s.c, marginTop: 3 }}>{s.val}</div>
              </div>
            ))}
          </div>
          {catchItem.weather && (
            <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 12, background: `${v.accent}05`, border: `1px solid ${v.cardBorder}` }}>
              <div style={{ fontSize: 10, color: v.textDim, fontWeight: 600, textTransform: "uppercase" }}>Погода</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: v.textSecondary, marginTop: 3 }}>🌤 {catchItem.weather}</div>
            </div>
          )}
          {catchItem.notes && (
            <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 12, background: `${v.accent}05`, border: `1px solid ${v.cardBorder}` }}>
              <div style={{ fontSize: 10, color: v.textDim, fontWeight: 600, textTransform: "uppercase" }}>Заметки</div>
              <div style={{ fontSize: 13, color: v.textSecondary, marginTop: 3 }}>{catchItem.notes}</div>
            </div>
          )}
        </div>
      </GlassCard>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => {
          haptic("medium");
          const text = `🐟 ${catchItem.fish}${catchItem.weight ? ` ${catchItem.weight}кг` : ""}${catchItem.location ? `\n📍 ${catchItem.location}` : ""}\n\n🎣 Клёвометр`;
          if (tg) tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(APP_LINK)}&text=${encodeURIComponent(text)}`);
          else navigator.clipboard?.writeText(text);
        }} className="btn" style={{ flex: 1, padding: 14, borderRadius: 16, border: `1.5px solid ${v.accent}30`, background: `${v.accent}08`, color: v.accent, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>📤 Поделиться</button>
        <button onClick={handleDelete} className="btn" style={{ flex: 1, padding: 14, borderRadius: 16, border: `1.5px solid ${v.btnDangerBorder}`, background: v.btnDanger, color: v.btnDangerColor, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>🗑 Удалить</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
//  FORECAST
// ═══════════════════════════════════════
function ForecastScreen({ wd, v }) {
  const { weather, forecast, moon, biteScore, weatherLoading, locationName, currentHour, geoCoords } = wd;
  const [selectedFish, setSelectedFish] = useState(null);
  const month = new Date().getMonth();

  // Regional fish filtering
  const localInfo = useMemo(() => {
    if (!geoCoords) return { fish: Object.keys(FISH_PROFILES), region: null, note: "" };
    return getLocalFish(geoCoords.lat, geoCoords.lon);
  }, [geoCoords]);

  const advanced = useMemo(() => weather ? computeBiteScoreAdvanced(weather, moon, currentHour, geoCoords?.lat, geoCoords?.lon) : null, [weather, moon, currentHour, geoCoords]);

  // Hourly scores for selected fish or general
  const hourlyScores = useMemo(() => Array.from({ length: 20 }, (_, i) => {
    const h = i + 4;
    if (selectedFish && weather) {
      return { h, score: computeFishScore(selectedFish, weather, moon, h, month).score };
    }
    return { h, score: computeBiteScore(weather, moon, h) };
  }), [weather, moon, selectedFish, month]);
  const bestHour = hourlyScores.reduce((a, b) => a.score > b.score ? a : b, { h: 6, score: 0 });

  // Selected fish detailed score
  const fishDetail = useMemo(() => {
    if (!selectedFish || !weather) return null;
    return computeFishScore(selectedFish, weather, moon, currentHour, month);
  }, [selectedFish, weather, moon, currentHour, month]);

  const displayScore = fishDetail ? fishDetail.score : biteScore;

  const dailyForecast = useMemo(() => {
    if (!forecast) return null;
    const days = {};
    forecast.forEach(item => {
      const date = item.dt_txt.split(" ")[0];
      if (!days[date]) days[date] = { temps: [], pressures: [], winds: [], icons: [] };
      days[date].temps.push(item.main.temp);
      days[date].pressures.push(Math.round(item.main.pressure * 0.750062));
      days[date].winds.push(item.wind.speed);
      days[date].icons.push(item.weather[0]?.icon);
    });
    return Object.entries(days).slice(0, 5).map(([date, d], i) => {
      const avgTemp = Math.round(d.temps.reduce((a, b) => a + b, 0) / d.temps.length);
      const avgPressure = Math.round(d.pressures.reduce((a, b) => a + b, 0) / d.pressures.length);
      const avgWind = (d.winds.reduce((a, b) => a + b, 0) / d.winds.length).toFixed(1);
      const fakeW = { pressure: avgPressure, wind: avgWind, clouds: 50, temp: avgTemp };
      const dayMoon = getMoonPhase(new Date(date));
      const dayMonth = new Date(date).getMonth();
      const maxScore = selectedFish
        ? Math.max(computeFishScore(selectedFish, fakeW, dayMoon, 7, dayMonth).score, computeFishScore(selectedFish, fakeW, dayMoon, 19, dayMonth).score)
        : Math.max(computeBiteScore(fakeW, dayMoon, 7), computeBiteScore(fakeW, dayMoon, 19));
      const dt = new Date(date);
      return { label: i === 0 ? "Сегодня" : i === 1 ? "Завтра" : dt.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric" }), temp: avgTemp, pressure: avgPressure, wind: avgWind, maxScore, moon: dayMoon, icon: d.icons[Math.floor(d.icons.length / 2)] };
    });
  }, [forecast, selectedFish, month]);

  const fishList = localInfo.fish.map(name => [name, FISH_PROFILES[name]]).filter(([_, p]) => p);

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>Прогноз клёва</div>
        <div style={{ fontSize: 13, color: v.textMuted, marginTop: 2 }}>
          {weather ? `${weather.cityName} · ${getSeasonName(month)}` : weatherLoading ? "Загрузка..." : "Нет данных"}
        </div>
        {localInfo.region && (
          <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 12, background: `${v.accent}08`, border: `1px solid ${v.accent}15` }}>
            <span style={{ fontSize: 12 }}>🗺</span>
            <span style={{ fontSize: 11, color: v.accent, fontWeight: 600 }}>{localInfo.region.waters}</span>
          </div>
        )}
        {localInfo.region && (
          <div style={{ fontSize: 11, color: v.textDim, marginTop: 4 }}>📍 {localInfo.region.note}</div>
        )}
      </div>

      {/* ── Fish selector ── */}
      <div className="f1" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 10 }}>
        <button onClick={() => setSelectedFish(null)} className="btn" style={{
          padding: "7px 14px", borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0, cursor: "pointer", fontFamily: "inherit",
          background: !selectedFish ? `${v.accent}18` : "transparent",
          border: `1.5px solid ${!selectedFish ? v.accent : v.cardBorder}`,
          color: !selectedFish ? v.accent : v.textMuted, fontSize: 12, fontWeight: 700,
        }}>🎣 Все</button>
        {fishList.map(([name, prof]) => (
          <button key={name} onClick={() => { setSelectedFish(name); haptic("light"); }} className="btn" style={{
            padding: "7px 14px", borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0, cursor: "pointer", fontFamily: "inherit",
            background: selectedFish === name ? `${v.accent}18` : "transparent",
            border: `1.5px solid ${selectedFish === name ? v.accent : v.cardBorder}`,
            color: selectedFish === name ? v.accent : v.textMuted, fontSize: 12, fontWeight: 700,
          }}>{prof.emoji} {name}</button>
        ))}
      </div>

      {/* ── Main score ring ── */}
      <GlassCard v={v} className="f1" style={{ textAlign: "center", padding: "20px 20px 16px", borderRadius: 24 }}>
        {weatherLoading ? <div style={{ padding: 20, color: v.textMuted }}>⏳ Загрузка...</div> : <>
          <div style={{ position: "relative", width: 110, height: 110, margin: "0 auto 12px" }}>
            <svg width={110} height={110} style={{ transform: "rotate(-90deg)" }}>
              <circle cx={55} cy={55} r={46} fill="none" stroke={`${v.accent}10`} strokeWidth={7} />
              <circle cx={55} cy={55} r={46} fill="none" stroke={getScoreColor(displayScore, v)} strokeWidth={7} strokeDasharray={289} strokeDashoffset={289 * (1 - displayScore / 100)} strokeLinecap="round" />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 34, fontWeight: 900, color: getScoreColor(displayScore, v) }}>{displayScore}</span>
              <span style={{ fontSize: 10, color: v.textDim }}>%</span>
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: getScoreColor(displayScore, v) }}>
            {selectedFish ? `${selectedFish} — ${getScoreLabel(displayScore)}` : `${getScoreLabel(displayScore)} клёв`}
          </div>
          <div style={{ fontSize: 13, color: v.textMuted, marginTop: 4 }}>Лучшее время: <strong style={{ color: v.text }}>{bestHour.h}:00</strong> ({bestHour.score}%)</div>
          {fishDetail?.isSpawn && <div style={{ fontSize: 12, color: v.btnDangerColor, marginTop: 6, fontWeight: 700 }}>⚠️ Период нереста — клёв ослаблен</div>}
          {fishDetail && <div style={{ fontSize: 12, color: v.stats[0], marginTop: 4 }}>🌡 Вода ≈{fishDetail.waterTemp}°C</div>}
        </>}
      </GlassCard>

      {/* ── Top-3 fish (when no fish selected) ── */}
      {!selectedFish && advanced && (
        <GlassCard v={v} className="f2" style={{ padding: 14, borderRadius: 16 }}>
          <div style={{ fontSize: 11, color: v.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>🏆 Лучший клёв сейчас</div>
          {advanced.topFish.map((f, i) => (
            <button key={f.fish} onClick={() => { setSelectedFish(f.fish); haptic("light"); }} className="btn" style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 12, marginBottom: 4,
              background: i === 0 ? `${v.accent}08` : "transparent", border: `1px solid ${i === 0 ? `${v.accent}15` : "transparent"}`,
              cursor: "pointer", textAlign: "left", boxSizing: "border-box",
            }}>
              <span style={{ fontSize: 10, fontWeight: 900, color: v.textDim, width: 20 }}>{i + 1}</span>
              <span style={{ fontSize: 18 }}>{f.emoji}</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: v.text }}>{f.fish}</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: getScoreColor(f.score, v) }}>{f.score}%</span>
            </button>
          ))}
        </GlassCard>
      )}

      {/* ── Fish-specific tip ── */}
      {selectedFish && fishDetail && (
        <GlassCard v={v} style={{ padding: 14, borderRadius: 16, border: `1px solid ${v.accentBorder}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: v.accent, marginBottom: 6 }}>🎯 Рекомендация: {selectedFish}</div>
          <div style={{ fontSize: 13, color: v.textMuted, lineHeight: 1.7 }}>{fishDetail.tip}</div>
        </GlassCard>
      )}

      {/* ── Weather metrics ── */}
      <div className="f2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        {[
          { l: "Давление", val: weather?.pressure || "—", u: "мм", c: v.stats[0] },
          { l: "Воздух", val: weather?.temp || "—", u: "°C", c: v.stats[2] },
          { l: "Ветер", val: weather ? `${weather.wind} ${windDir(weather.windDeg)}` : "—", u: "м/с", c: v.textSecondary },
          { l: "Вода ≈", val: weather ? estimateWaterTemp(weather.temp, month) : "—", u: "°C", c: v.stats[0] },
          { l: "Облачность", val: weather?.clouds ?? "—", u: "%", c: v.stats[3] },
          { l: "Влажность", val: weather?.humidity ?? "—", u: "%", c: v.stats[1] },
        ].map(s => (
          <GlassCard key={s.l} v={v} style={{ padding: 10, borderRadius: 14, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: v.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.l}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: s.c, marginTop: 3 }}>{s.val}<span style={{ fontSize: 9, color: v.textDim, fontWeight: 400 }}> {s.u}</span></div>
          </GlassCard>
        ))}
      </div>

      {/* ── Moon ── */}
      <GlassCard v={v} className="f3" style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: 16 }}>
        <span style={{ fontSize: 34 }}>{moon.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: v.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Луна · {getSeasonName(month)}</div>
          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{moon.name}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: v.stats[2] }}>{Math.round(moon.factor * 100)}%</div>
          <div style={{ fontSize: 10, color: v.textDim }}>активность</div>
        </div>
      </GlassCard>

      {/* ── Hourly chart ── */}
      <GlassCard v={v} className="f4" style={{ padding: 16, borderRadius: 16 }}>
        <div style={{ fontSize: 11, color: v.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>
          По часам{selectedFish ? ` · ${selectedFish}` : ""}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 70 }}>
          {hourlyScores.map(h => {
            const isCur = h.h === currentHour;
            return (
              <div key={h.h} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ width: "100%", height: `${h.score * 0.62}px`, minHeight: 3, background: getScoreColor(h.score, v), borderRadius: 3, opacity: isCur ? 1 : 0.5, boxShadow: isCur ? `0 0 8px ${getScoreColor(h.score, v)}` : "none" }} />
                {(h.h % 4 === 0 || isCur) && <span style={{ fontSize: 8, color: isCur ? v.text : v.textDim, fontWeight: isCur ? 800 : 400 }}>{h.h}</span>}
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* ── 5-day forecast ── */}
      {dailyForecast && (
        <GlassCard v={v} className="f5" style={{ padding: 16, borderRadius: 16 }}>
          <div style={{ fontSize: 11, color: v.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>
            5 дней{selectedFish ? ` · ${selectedFish}` : ""}
          </div>
          {dailyForecast.map((d, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < dailyForecast.length - 1 ? `1px solid ${v.cardBorder}` : "none" }}>
              <span style={{ width: 56, fontSize: 13, fontWeight: i === 0 ? 800 : 500, color: i === 0 ? v.text : v.textMuted }}>{d.label}</span>
              <span style={{ fontSize: 15 }}>{weatherEmoji(d.icon)}</span>
              <span style={{ fontSize: 15 }}>{d.moon.icon}</span>
              <span style={{ flex: 1, fontSize: 12, color: v.textMuted }}>{d.temp}° · {d.wind}м/с</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: getScoreColor(d.maxScore, v) }}>{d.maxScore}%</span>
            </div>
          ))}
        </GlassCard>
      )}

      {/* ── All fish scores table ── */}
      {!selectedFish && advanced && (
        <GlassCard v={v} style={{ padding: 16, borderRadius: 16 }}>
          <div style={{ fontSize: 11, color: v.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>📊 Все виды рыб</div>
          {advanced.allScores.sort((a, b) => b.score - a.score).map((f, i) => (
            <button key={f.fish} onClick={() => { setSelectedFish(f.fish); haptic("light"); }} className="btn" style={{
              width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 0",
              borderBottom: i < advanced.allScores.length - 1 ? `1px solid ${v.cardBorder}` : "none",
              background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
            }}>
              <span style={{ fontSize: 16 }}>{f.emoji}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: v.text }}>{f.fish}</span>
              {f.isSpawn && <span style={{ fontSize: 9, color: v.btnDangerColor, fontWeight: 700, padding: "2px 6px", borderRadius: 6, background: `${v.btnDangerColor}10` }}>нерест</span>}
              <div style={{ width: 50, height: 4, borderRadius: 2, background: `${v.accent}10`, overflow: "hidden" }}>
                <div style={{ width: `${f.score}%`, height: "100%", background: getScoreColor(f.score, v), borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: getScoreColor(f.score, v), width: 36, textAlign: "right" }}>{f.score}%</span>
            </button>
          ))}
        </GlassCard>
      )}

      {/* ── General recommendation ── */}
      <GlassCard v={v} style={{ padding: 16, borderRadius: 16, border: `1px solid ${v.accentBorder}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: v.accent, marginBottom: 8 }}>💡 {selectedFish ? `Совет на ${selectedFish.toLowerCase()}` : "Общие рекомендации"}</div>
        <div style={{ fontSize: 13, color: v.textMuted, lineHeight: 1.7 }}>
          {selectedFish && fishDetail ? fishDetail.tip : getGeneralRecommendation(biteScore, weather, month)}
        </div>
      </GlassCard>
    </div>
  );
}

// ═══════════════════════════════════════
//  STATS
// ═══════════════════════════════════════
function StatsScreen({ shared, v }) {
  const { catches = [], sessions = [] } = shared || {};
  const totalWeight = catches.reduce((a, c) => a + (parseFloat(c.weight) || 0), 0).toFixed(1);
  const maxCatch = catches.reduce((a, c) => (parseFloat(c.weight) || 0) > (parseFloat(a.weight) || 0) ? c : a, {});
  const fishCounts = catches.reduce((a, c) => { a[c.fish] = (a[c.fish] || 0) + 1; return a; }, {});
  const topFish = Object.entries(fishCounts).sort((a, b) => b[1] - a[1]);
  const baitCounts = catches.reduce((a, c) => { if (c.bait) a[c.bait] = (a[c.bait] || 0) + 1; return a; }, {});
  const topBaits = Object.entries(baitCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const totalSessionTime = sessions.reduce((a, s) => a + (s.duration || 0), 0);
  const avgPerSession = sessions.length > 0 ? (catches.length / sessions.length).toFixed(1) : "0";

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}><div style={{ fontSize: 24, fontWeight: 900 }}>Статистика</div></div>
      <div className="f1" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        {[{ l: "Уловов", val: catches.length, c: v.stats[0] }, { l: "Общий вес", val: `${totalWeight}кг`, c: v.stats[2] }, { l: "Сессий", val: sessions.length, c: v.stats[1] }].map(s => (
          <GlassCard key={s.l} v={v} style={{ padding: 12, borderRadius: 14, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.c }}>{s.val}</div>
            <div style={{ fontSize: 9, color: v.textDim, fontWeight: 700, marginTop: 4, textTransform: "uppercase" }}>{s.l}</div>
          </GlassCard>
        ))}
      </div>
      {catches.length === 0 ? (
        <div className="f2" style={{ textAlign: "center", padding: "40px 0", color: v.textDim }}><div style={{ fontSize: 40 }}>📊</div><div style={{ marginTop: 12, fontSize: 14 }}>Нет данных</div></div>
      ) : (<>
        {maxCatch.fish && (
          <GlassCard v={v} className="f2" style={{ padding: 16, borderRadius: 16 }}>
            <div style={{ fontSize: 11, color: v.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>🏆 Рекордный улов</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 28 }}>{fishEmoji(maxCatch.fish)}</span>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 16 }}>{maxCatch.fish}</div><div style={{ fontSize: 12, color: v.textMuted }}>{maxCatch.location || "—"}</div></div>
              <div style={{ fontWeight: 900, fontSize: 22, color: v.stats[2] }}>{maxCatch.weight}<span style={{ fontSize: 11, color: v.textDim }}> кг</span></div>
            </div>
          </GlassCard>
        )}
        {topFish.length > 0 && (
          <GlassCard v={v} className="f3" style={{ padding: 16, borderRadius: 16 }}>
            <div style={{ fontSize: 11, color: v.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>По видам рыб</div>
            {topFish.slice(0, 5).map(([fish, count]) => (
              <div key={fish} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 13, fontWeight: 700 }}>{fish}</span><span style={{ fontSize: 12, color: v.textMuted }}>{count} шт</span></div>
                <div style={{ height: 5, background: `${v.accent}10`, borderRadius: 3 }}><div style={{ height: "100%", width: `${(count / topFish[0][1]) * 100}%`, background: v.accentGrad, borderRadius: 3 }} /></div>
              </div>
            ))}
          </GlassCard>
        )}
        {topBaits.length > 0 && (
          <GlassCard v={v} className="f4" style={{ padding: 16, borderRadius: 16 }}>
            <div style={{ fontSize: 11, color: v.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>🎣 Топ приманки</div>
            {topBaits.map(([bait, count], i) => (
              <div key={bait} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < topBaits.length - 1 ? `1px solid ${v.cardBorder}` : "none" }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, background: `${v.accent}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: v.accent }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{bait}</span>
                <span style={{ fontSize: 13, color: v.textMuted }}>{count} улов.</span>
              </div>
            ))}
          </GlassCard>
        )}
        <div className="f5" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <GlassCard v={v} style={{ padding: 12, borderRadius: 14, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: v.textDim, fontWeight: 700 }}>НА СЕССИЮ</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: v.stats[3], marginTop: 4 }}>{avgPerSession}</div>
            <div style={{ fontSize: 10, color: v.textDim }}>уловов/сессия</div>
          </GlassCard>
          <GlassCard v={v} style={{ padding: 12, borderRadius: 14, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: v.textDim, fontWeight: 700 }}>ВРЕМЯ НА ВОДЕ</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: v.stats[2], marginTop: 4 }}>{Math.round(totalSessionTime / 3600)}ч</div>
            <div style={{ fontSize: 10, color: v.textDim }}>всего</div>
          </GlassCard>
        </div>
      </>)}
    </div>
  );
}

// ═══════════════════════════════════════
//  GEAR
// ═══════════════════════════════════════
function GearScreen({ go, shared, v }) {
  const { gearItems, deleteGear } = shared;
  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}><div style={{ fontSize: 24, fontWeight: 900 }}>Снаряжение</div><div style={{ fontSize: 13, color: v.textMuted, marginTop: 2 }}>{gearItems.length} предметов</div></div>
      <button onClick={() => go(SCREENS.addGear)} className="btn f1" style={{ width: "100%", padding: 14, borderRadius: 16, border: "none", background: v.btnPrimary, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}>+ Добавить снаряжение</button>
      {gearItems.length === 0 ? (
        <div className="f2" style={{ textAlign: "center", padding: "40px 0", color: v.textDim }}><div style={{ fontSize: 40 }}>🎒</div><div style={{ marginTop: 12, fontSize: 14 }}>Инвентарь пуст</div></div>
      ) : gearItems.map((g, i) => (
        <div key={g.id} style={{ ...v.glass, display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, marginBottom: 8, animation: `fadeUp .4s ease ${i * 0.05}s both` }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: `${v.stats[3]}10`, border: `1px solid ${v.stats[3]}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
            {g.type === "Удилище" ? "🎋" : g.type === "Катушка" ? "🎡" : g.type === "Приманка" ? "🐛" : g.type === "Эхолот" ? "📡" : "🎒"}
          </div>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{g.name}</div><div style={{ fontSize: 11, color: v.textMuted, marginTop: 2 }}>{g.type}{g.brand ? ` · ${g.brand}` : ""}</div></div>
          <button onClick={() => { haptic("light"); deleteGear(g.id); }} className="btn" style={{ padding: "6px 10px", borderRadius: 10, border: `1px solid ${v.btnDangerBorder}`, background: "transparent", color: v.btnDangerColor, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
        </div>
      ))}
    </div>
  );
}

function AddGearScreen({ back, saveGear, v }) {
  const [form, setForm] = useState({ name: "", type: "", brand: "", notes: "" });
  const set = (k, val) => setForm(p => ({ ...p, [k]: val }));
  const handleSave = () => { if (!form.name) { hapticNotify("error"); return; } saveGear(form); hapticNotify("success"); back(); };
  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}><div style={{ fontSize: 22, fontWeight: 900 }}>Добавить снаряжение</div></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Название *" v={v}><ThemedInput v={v} placeholder="Shimano Stradic 2500" value={form.name} onChange={e => set("name", e.target.value)} /></Field>
        <Field label="Тип" v={v}><ThemedSelect v={v} value={form.type} onChange={e => set("type", e.target.value)}><option value="">Выбери тип</option>{GEAR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</ThemedSelect></Field>
        <Field label="Бренд" v={v}><ThemedInput v={v} placeholder="Shimano, Daiwa..." value={form.brand} onChange={e => set("brand", e.target.value)} /></Field>
        <Field label="Заметки" v={v}><textarea placeholder="Характеристики..." value={form.notes} onChange={e => set("notes", e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, boxSizing: "border-box", background: v.inputBg, border: `1px solid ${v.inputBorder}`, color: v.text, outline: "none", fontSize: 14, resize: "none", minHeight: 72, fontFamily: "inherit" }} /></Field>
      </div>
      <button onClick={handleSave} className="btn" style={{ width: "100%", padding: 15, borderRadius: 16, border: "none", background: v.btnPrimary, color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer", fontFamily: "inherit", marginTop: 14 }}>💾 Сохранить</button>
    </div>
  );
}

// ═══════════════════════════════════════
//  SPOTS
// ═══════════════════════════════════════
function SpotsScreen({ go, shared, v }) {
  const { spots = [], deleteSpot = () => {} } = shared || {};
  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}><div style={{ fontSize: 24, fontWeight: 900 }}>Мои места</div><div style={{ fontSize: 13, color: v.textMuted, marginTop: 2 }}>{spots.length} точек</div></div>
      <button onClick={() => go(SCREENS.addSpot)} className="btn f1" style={{ width: "100%", padding: 14, borderRadius: 16, border: "none", background: v.btnPrimary, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}>+ Добавить место</button>
      {spots.length === 0 ? (
        <div className="f2" style={{ textAlign: "center", padding: "40px 0", color: v.textDim }}><div style={{ fontSize: 40 }}>🗺</div><div style={{ marginTop: 12, fontSize: 14 }}>Мест пока нет</div></div>
      ) : spots.map((s, i) => (
        <div key={s.id} style={{ ...v.glass, display: "flex", gap: 12, padding: 14, borderRadius: 16, marginBottom: 8, animation: `fadeUp .4s ease ${i * 0.05}s both` }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: `${v.stats[0]}10`, border: `1px solid ${v.stats[0]}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>📍</div>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 15 }}>{s.name}</div><div style={{ fontSize: 11, color: v.textMuted, marginTop: 2 }}>{s.type || "—"}{s.fish ? ` · ${s.fish}` : ""}</div></div>
          <button onClick={() => { haptic("light"); deleteSpot(s.id); }} className="btn" style={{ padding: "6px 10px", borderRadius: 10, border: `1px solid ${v.btnDangerBorder}`, background: "transparent", color: v.btnDangerColor, fontSize: 14, cursor: "pointer", fontFamily: "inherit", alignSelf: "flex-start" }}>✕</button>
        </div>
      ))}
    </div>
  );
}

function AddSpotScreen({ back, saveSpot, locationName, v }) {
  const [form, setForm] = useState({ name: "", type: "", fish: "", notes: "" });
  const set = (k, val) => setForm(p => ({ ...p, [k]: val }));
  const handleSave = () => { if (!form.name) { hapticNotify("error"); return; } saveSpot(form); hapticNotify("success"); back(); };
  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}><div style={{ fontSize: 22, fontWeight: 900 }}>Добавить место</div></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Название *" v={v}><ThemedInput v={v} placeholder="Озеро Тихое, Река Ока..." value={form.name} onChange={e => set("name", e.target.value)} /></Field>
        <Field label="Тип водоёма" v={v}><ThemedSelect v={v} value={form.type} onChange={e => set("type", e.target.value)}><option value="">Выбери тип</option>{["Река","Озеро","Пруд","Водохранилище","Карьер","Море","Канал"].map(t => <option key={t} value={t}>{t}</option>)}</ThemedSelect></Field>
        <Field label="Какая рыба водится" v={v}><ThemedInput v={v} placeholder="Щука, окунь, карп..." value={form.fish} onChange={e => set("fish", e.target.value)} /></Field>
        <Field label="Заметки" v={v}><textarea placeholder="Особенности места..." value={form.notes} onChange={e => set("notes", e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, boxSizing: "border-box", background: v.inputBg, border: `1px solid ${v.inputBorder}`, color: v.text, outline: "none", fontSize: 14, resize: "none", minHeight: 72, fontFamily: "inherit" }} /></Field>
      </div>
      <button onClick={handleSave} className="btn" style={{ width: "100%", padding: 15, borderRadius: 16, border: "none", background: v.btnPrimary, color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer", fontFamily: "inherit", marginTop: 14 }}>💾 Сохранить место</button>
    </div>
  );
}

// ═══════════════════════════════════════
//  SOCIAL
// ═══════════════════════════════════════
function SocialScreen({ v }) {
  const catches = storage.get("catches", []);
  const privacy = storage.get("privacy", "public");
  const un = tg?.initDataUnsafe?.user?.first_name || "Я";

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>Лента</div>
        <div style={{ fontSize: 13, color: v.textMuted, marginTop: 2 }}>{catches.length > 0 ? `${catches.length} записей` : "Пока пусто"}</div>
      </div>
      {privacy === "ghost" && (
        <GlassCard v={v} style={{ padding: 14, borderRadius: 14, marginBottom: 12, borderColor: v.btnDangerBorder }}>
          <div style={{ fontSize: 13, color: v.btnDangerColor, fontWeight: 700 }}>👻 Режим «Невидимка» активен</div>
          <div style={{ fontSize: 12, color: v.textMuted, marginTop: 4 }}>Твои уловы не видны другим</div>
        </GlassCard>
      )}
      {catches.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 20px", color: v.textDim }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎣</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Лента пуста</div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>Когда ты или друзья добавят уловы, они появятся здесь</div>
        </div>
      ) : catches.slice(0, 20).map((c, i) => (
        <GlassCard key={c.id || i} v={v} style={{ padding: 16, borderRadius: 20, animation: `fadeUp .4s ease ${i * 0.05}s both` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: v.accentGrad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, border: `1.5px solid ${v.accentBorder}`, fontWeight: 800, color: "#fff" }}>{un.charAt(0)}</div>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{un}</div><div style={{ fontSize: 11, color: v.textDim }}>{c.date || "—"}</div></div>
          </div>
          <div style={{ padding: 14, borderRadius: 14, background: `${v.accent}05`, border: `1px solid ${v.cardBorder}`, marginBottom: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{fishEmoji(c.fish)} {c.fish || "—"} {c.weight ? `${c.weight} кг` : ""}</div>
            {c.location && <div style={{ fontSize: 12, color: v.textMuted, marginTop: 4 }}>📍 {c.location}</div>}
            {c.bait && <div style={{ fontSize: 12, color: v.textMuted, marginTop: 2 }}>🎣 {c.bait}</div>}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════
//  PROFILE
// ═══════════════════════════════════════
function ProfileScreen({ shared, userName, go, v, toggleTheme, isNight, sbUser, updateProfile, userAvatar }) {
  const { catches = [], sessions = [], gearItems = [], spots = [] } = shared || {};
  const totalWeight = catches.reduce((a, c) => a + (parseFloat(c.weight) || 0), 0).toFixed(1);
  const maxCatch = catches.reduce((a, c) => (parseFloat(c.weight) || 0) > (parseFloat(a.weight) || 0) ? c : a, { weight: 0 });
  const un = sbUser?.nickname || tg?.initDataUnsafe?.user?.first_name || userName || "FisherPro";
  const uh = tg?.initDataUnsafe?.user?.username || "fisherpro";
  const avatar = userAvatar || "🎣";
  const customCity = sbUser?.custom_city;

  const [privacy, setPrivacy] = useState(() => storage.get("privacy", "public"));
  const [friends, setFriends] = useState(() => storage.get("friends", []));

  const privacyModes = [
    { key: "public", icon: "🌍", label: "Общедоступный", desc: "Все видят уловы", color: v.stats[1] },
    { key: "private", icon: "🔒", label: "Приватный", desc: "Только друзья", color: v.stats[2] },
    { key: "ghost", icon: "👻", label: "Невидимка", desc: "Никто не видит", color: v.btnDangerColor },
  ];
  const setPrivacyMode = (mode) => { setPrivacy(mode); storage.set("privacy", mode); haptic("medium"); };

  const achievements = [
    { icon: "🐟", label: "Первый улов", earned: catches.length >= 1 },
    { icon: "🎯", label: "10 уловов", earned: catches.length >= 10 },
    { icon: "⚖️", label: "Трофей 3кг+", earned: parseFloat(maxCatch.weight) >= 3 },
    { icon: "📍", label: "5 мест", earned: spots.length >= 5 },
    { icon: "🎒", label: "Инвентарь", earned: gearItems.length >= 3 },
    { icon: "⏱", label: "10 сессий", earned: sessions.length >= 10 },
  ];

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ textAlign: "center", padding: "20px 0 16px" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: v.accentGrad, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, border: `3px solid ${v.accentBorder}`, boxShadow: `0 0 30px ${v.accent}20` }}>{avatar}</div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>{un}</div>
        <div style={{ fontSize: 13, color: v.textMuted, marginTop: 3 }}>@{uh}</div>
        {customCity && <div style={{ fontSize: 12, color: v.accent, marginTop: 4 }}>📍 {customCity}</div>}
        <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 14px", borderRadius: 20, background: `${privacyModes.find(m => m.key === privacy).color}15`, border: `1px solid ${privacyModes.find(m => m.key === privacy).color}30` }}>
          <span style={{ fontSize: 14 }}>{privacyModes.find(m => m.key === privacy).icon}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: privacyModes.find(m => m.key === privacy).color }}>{privacyModes.find(m => m.key === privacy).label}</span>
        </div>
      </div>

      {/* Edit profile + Location buttons */}
      <div className="f1" style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button onClick={() => go(SCREENS.editProfile)} className="btn" style={{ ...v.glass, flex: 1, padding: 14, borderRadius: 16, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left", boxSizing: "border-box" }}>
          <span style={{ fontSize: 20 }}>✏️</span>
          <div><div style={{ fontWeight: 700, fontSize: 14, color: v.text }}>Профиль</div><div style={{ fontSize: 11, color: v.textMuted, marginTop: 1 }}>Аватар и имя</div></div>
        </button>
        <button onClick={() => go(SCREENS.locationPicker)} className="btn" style={{ ...v.glass, flex: 1, padding: 14, borderRadius: 16, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left", boxSizing: "border-box" }}>
          <span style={{ fontSize: 20 }}>📍</span>
          <div><div style={{ fontWeight: 700, fontSize: 14, color: v.text }}>Геолокация</div><div style={{ fontSize: 11, color: v.textMuted, marginTop: 1 }}>{customCity || "Авто"}</div></div>
        </button>
      </div>

      {/* Theme toggle */}
      <GlassCard v={v} className="f1" style={{ padding: 14, borderRadius: 16, marginBottom: 10 }}>
        <button onClick={toggleTheme} className="btn" style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: 0, border: "none", background: "none", cursor: "pointer", textAlign: "left" }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${v.accent}10`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{isNight ? "🌙" : "☀️"}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: v.text }}>Тема: {isNight ? "Ночь" : "День"}</div>
            <div style={{ fontSize: 12, color: v.textMuted, marginTop: 2 }}>{v.name}</div>
          </div>
          <span style={{ color: v.textMuted, fontSize: 18 }}>{v.toggleIcon}</span>
        </button>
      </GlassCard>

      <div className="f2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        {[{ l: "Уловов", val: catches.length, c: v.stats[0] }, { l: "Общий вес", val: `${totalWeight}кг`, c: v.stats[2] }, { l: "Друзей", val: friends.length, c: v.stats[0] }].map(s => (
          <GlassCard key={s.l} v={v} style={{ padding: 12, borderRadius: 14, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.c }}>{s.val}</div>
            <div style={{ fontSize: 10, color: v.textDim, marginTop: 3, fontWeight: 600 }}>{s.l}</div>
          </GlassCard>
        ))}
      </div>

      <button onClick={() => go(SCREENS.friends)} className="btn f3" style={{ ...v.glass, width: "100%", padding: 16, borderRadius: 16, marginBottom: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 14, textAlign: "left", boxSizing: "border-box" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `${v.stats[0]}10`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>👥</div>
        <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 15 }}>Друзья</div><div style={{ fontSize: 12, color: v.textMuted, marginTop: 2 }}>{friends.length > 0 ? `${friends.length} друзей` : "Добавить по @username"}</div></div>
        <span style={{ color: v.textMuted, fontSize: 18 }}>›</span>
      </button>

      <GlassCard v={v} className="f4" style={{ padding: 16, borderRadius: 16 }}>
        <div style={{ fontSize: 11, color: v.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>🔐 Приватность</div>
        {privacyModes.map(m => (
          <button key={m.key} onClick={() => setPrivacyMode(m.key)} className="btn" style={{
            width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
            borderRadius: 12, marginBottom: 6, cursor: "pointer", textAlign: "left",
            background: privacy === m.key ? `${m.color}10` : `${v.accent}03`,
            border: `1.5px solid ${privacy === m.key ? `${m.color}40` : v.cardBorder}`, transition: "all .2s",
          }}>
            <span style={{ fontSize: 24 }}>{m.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: privacy === m.key ? m.color : v.text }}>{m.label}</div>
              <div style={{ fontSize: 11, color: v.textMuted, marginTop: 2 }}>{m.desc}</div>
            </div>
            <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${privacy === m.key ? m.color : v.textDim}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {privacy === m.key && <div style={{ width: 12, height: 12, borderRadius: "50%", background: m.color }} />}
            </div>
          </button>
        ))}
      </GlassCard>

      <GlassCard v={v} className="f5" style={{ padding: 16, borderRadius: 16 }}>
        <div style={{ fontSize: 11, color: v.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>🏅 Достижения</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {achievements.map(a => (
            <div key={a.label} style={{ textAlign: "center", padding: "10px 6px", borderRadius: 12, background: a.earned ? `${v.accent}10` : `${v.accent}03`, border: `1px solid ${a.earned ? `${v.accent}25` : v.cardBorder}`, opacity: a.earned ? 1 : 0.35 }}>
              <div style={{ fontSize: 22 }}>{a.icon}</div>
              <div style={{ fontSize: 10, color: a.earned ? v.accent : v.textDim, marginTop: 4, fontWeight: 600, lineHeight: 1.3 }}>{a.label}</div>
            </div>
          ))}
        </div>
      </GlassCard>

      {maxCatch.fish && (
        <GlassCard v={v} style={{ padding: 16, borderRadius: 16 }}>
          <div style={{ fontSize: 11, color: v.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>🏆 Лучший трофей</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 28 }}>{fishEmoji(maxCatch.fish)}</span>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 16 }}>{maxCatch.fish}</div><div style={{ fontSize: 12, color: v.textMuted }}>{maxCatch.location || "—"}</div></div>
            <div style={{ fontWeight: 900, fontSize: 22, color: v.stats[2] }}>{maxCatch.weight}<span style={{ fontSize: 11, color: v.textDim }}>кг</span></div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
//  FRIENDS
// ═══════════════════════════════════════
function FriendsScreen({ back, v }) {
  const [friends, setFriends] = useState(() => storage.get("friends", []));
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);

  const addFriend = () => {
    const username = input.trim().replace(/^@/, "");
    if (!username || friends.some(f => f.username === username)) return;
    hapticNotify("success");
    const updated = [...friends, { username, addedAt: Date.now(), displayName: username }];
    setFriends(updated); storage.set("friends", updated); setInput(""); setAdding(false);
  };
  const removeFriend = (username) => { haptic("medium"); const updated = friends.filter(f => f.username !== username); setFriends(updated); storage.set("friends", updated); };

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}><div style={{ fontSize: 24, fontWeight: 900 }}>Друзья</div><div style={{ fontSize: 13, color: v.textMuted, marginTop: 2 }}>{friends.length} друзей</div></div>
      {adding ? (
        <GlassCard v={v} className="f1" style={{ padding: 16, borderRadius: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: v.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Добавить по Telegram</div>
          <div style={{ display: "flex", gap: 8 }}>
            <ThemedInput v={v} value={input} onChange={e => setInput(e.target.value)} placeholder="@username" onKeyDown={e => e.key === "Enter" && addFriend()} style={{ flex: 1 }} />
            <button onClick={addFriend} className="btn" style={{ padding: "10px 18px", borderRadius: 12, background: v.btnPrimary, color: "#fff", fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>+</button>
          </div>
          <button onClick={() => setAdding(false)} className="btn" style={{ marginTop: 8, background: "none", border: "none", color: v.textMuted, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>Отмена</button>
        </GlassCard>
      ) : (
        <button onClick={() => setAdding(true)} className="btn f1" style={{ width: "100%", padding: 14, borderRadius: 14, background: `${v.accent}08`, border: `1.5px solid ${v.accent}25`, color: v.accent, fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}>+ Добавить друга</button>
      )}
      {friends.map((f, i) => (
        <div key={f.username} style={{ ...v.glass, padding: 14, borderRadius: 14, marginBottom: 8, display: "flex", alignItems: "center", gap: 12, animation: `fadeUp .4s ease ${i * 0.05}s both` }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: v.accentGrad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, color: "#fff" }}>{f.displayName.charAt(0).toUpperCase()}</div>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 15 }}>@{f.username}</div><div style={{ fontSize: 11, color: v.textMuted, marginTop: 2 }}>Добавлен {new Date(f.addedAt).toLocaleDateString("ru-RU")}</div></div>
          <button onClick={() => removeFriend(f.username)} className="btn" style={{ background: "none", border: "none", color: v.btnDangerColor, cursor: "pointer", fontSize: 18, padding: 4 }}>✕</button>
        </div>
      ))}
      {friends.length === 0 && !adding && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: v.textDim }}><div style={{ fontSize: 48, marginBottom: 12 }}>👥</div><div style={{ fontSize: 14, lineHeight: 1.6 }}>Добавь друзей по @username<br />чтобы видеть их уловы</div></div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
//  MAP (Leaflet + OSM + OWM)
// ═══════════════════════════════════════
function MapScreen({ shared, go, v }) {
  const { spots = [], saveSpot = () => {}, deleteSpot = () => {} } = shared || {};
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [weatherLayer, setWeatherLayer] = useState("none");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const markersRef = useRef([]);
  const weatherLayerRef = useRef(null);

  useEffect(() => {
    if (window.L) { setMapReady(true); return; }
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(css);
    const js = document.createElement("script"); js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; js.onload = () => setMapReady(true); document.head.appendChild(js);
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || mapInstance.current) return;
    const L = window.L;
    const map = L.map(mapRef.current, { center: [55.75, 37.62], zoom: 10, zoomControl: false, attributionControl: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    navigator.geolocation?.getCurrentPosition((pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 12), () => {}, { timeout: 5000 });
    map.on("click", (e) => {
      if (!window._klevometrAddMode) return;
      const name = prompt("Название метки:"); if (!name) return;
      const depth = prompt("Глубина (м):");
      const note = prompt("Тип (яма / коряжник / стоянка / бровка):");
      saveSpot({ name, lat: e.latlng.lat, lng: e.latlng.lng, depth: depth || "", note: note || "", date: new Date().toLocaleDateString("ru-RU") });
      window._klevometrAddMode = false; setAddMode(false);
    });
    mapInstance.current = map;
    return () => { map.remove(); mapInstance.current = null; };
  }, [mapReady]);

  useEffect(() => {
    if (!mapInstance.current || !window.L) return;
    const L = window.L; const map = mapInstance.current;
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
    spots.forEach(spot => {
      if (!spot.lat || !spot.lng) return;
      const markerColor = v.isDark ? "#b0c8e8" : "#2a6090";
      const icon = L.divIcon({ className: "", html: `<div style="width:30px;height:30px;border-radius:50%;background:${markerColor};display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 10px ${markerColor}80;border:2px solid rgba(255,255,255,.4)">📍</div>`, iconSize: [30, 30], iconAnchor: [15, 30] });
      const marker = L.marker([spot.lat, spot.lng], { icon }).addTo(map);
      marker.bindPopup(`<div style="font-family:sans-serif;min-width:130px"><b>${spot.name}</b>${spot.depth ? `<br>↓ ${spot.depth}м` : ""}${spot.note ? `<br>📝 ${spot.note}` : ""}<br><small>${spot.date || ""}</small></div>`);
      markersRef.current.push(marker);
    });
  }, [spots, mapReady, v]);

  const toggleAdd = () => { const next = !addMode; setAddMode(next); window._klevometrAddMode = next; if (next) hapticNotify("success"); };

  useEffect(() => {
    if (!mapInstance.current || !window.L) return;
    const L = window.L; const map = mapInstance.current;
    if (weatherLayerRef.current) { map.removeLayer(weatherLayerRef.current); weatherLayerRef.current = null; }
    if (weatherLayer !== "none" && OWM_API_KEY) {
      weatherLayerRef.current = L.tileLayer(`https://tile.openweathermap.org/map/${weatherLayer}/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`, { maxZoom: 18, opacity: 0.6 }).addTo(map);
    }
  }, [weatherLayer, mapReady]);

  const searchLocation = async () => {
    if (!searchQuery.trim() || !mapInstance.current) return;
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1&accept-language=ru`);
      const data = await res.json();
      if (data.length > 0) { mapInstance.current.setView([parseFloat(data[0].lat), parseFloat(data[0].lon)], 13); haptic("medium"); }
    } catch (e) { console.log("Search error:", e); }
    setSearching(false);
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 1000, padding: "10px 12px", background: v.isDark ? "linear-gradient(to bottom, rgba(6,8,14,0.92), rgba(6,8,14,0.5), transparent)" : "linear-gradient(to bottom, rgba(200,220,236,0.95), rgba(200,220,236,0.5), transparent)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: v.text }}>Карта</div>
            <div style={{ fontSize: 11, color: v.textDim }}>{spots.length} меток</div>
          </div>
          <button onClick={toggleAdd} className="btn" style={{ padding: "8px 14px", borderRadius: 10, fontFamily: "inherit", fontWeight: 800, fontSize: 12, cursor: "pointer", background: addMode ? v.btnDanger : v.btnPrimary, color: addMode ? v.btnDangerColor : "#fff", border: addMode ? `1px solid ${v.btnDangerBorder}` : "none" }}>
            {addMode ? "✕" : "+ Метка"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <ThemedInput v={v} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && searchLocation()} placeholder="Город, река, озеро..." style={{ flex: 1, padding: "8px 12px", fontSize: 13, borderRadius: 10, background: v.isDark ? "rgba(8,18,34,0.85)" : "rgba(255,255,255,0.85)" }} />
          <button onClick={searchLocation} className="btn" style={{ padding: "8px 14px", borderRadius: 10, background: `${v.accent}15`, border: `1px solid ${v.accent}30`, color: v.accent, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{searching ? "..." : "🔍"}</button>
        </div>
        <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
          {[
            { key: "none", label: "🗺 Карта" }, { key: "precipitation_new", label: "🌧 Осадки" },
            { key: "temp_new", label: "🌡 Темп." }, { key: "clouds_new", label: "☁️ Облачн." },
          ].map(m => (
            <button key={m.key} onClick={() => { setWeatherLayer(m.key); haptic("light"); }} className="btn" style={{
              flex: 1, padding: "6px 4px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              background: weatherLayer === m.key ? `${v.accent}15` : (v.isDark ? "rgba(8,18,34,0.8)" : "rgba(255,255,255,0.8)"),
              border: `1px solid ${weatherLayer === m.key ? `${v.accent}30` : v.cardBorder}`,
              color: weatherLayer === m.key ? v.accent : v.textMuted,
            }}>{m.label}</button>
          ))}
        </div>
      </div>

      {addMode && (
        <div style={{ position: "absolute", top: 130, left: "50%", transform: "translateX(-50%)", zIndex: 1000, padding: "8px 20px", borderRadius: 20, background: v.accent, color: v.isDark ? "#0a0e18" : "#fff", fontSize: 13, fontWeight: 700, boxShadow: `0 4px 16px ${v.accent}50` }}>
          👆 Нажми на карту
        </div>
      )}

      <div ref={mapRef} style={{ flex: 1, width: "100%", background: v.isDark ? "#0a1628" : "#c8dce8" }}>
        {!mapReady && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: v.textMuted }}>⏳ Загрузка...</div>}
      </div>

      {spots.length > 0 && (
        <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, zIndex: 1000, padding: "0 10px" }}>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6 }}>
            {spots.filter(s => s.lat).slice(0, 10).map(spot => (
              <button key={spot.id} onClick={() => { if (mapInstance.current && spot.lat) mapInstance.current.setView([spot.lat, spot.lng], 14); haptic("light"); }} className="btn" style={{ ...v.glass, padding: "10px 14px", borderRadius: 12, cursor: "pointer", minWidth: 120, flexShrink: 0, textAlign: "left" }}>
                <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", color: v.text }}>📍 {spot.name}</div>
                {spot.depth && <div style={{ fontSize: 11, color: v.stats[0], marginTop: 2 }}>↓ {spot.depth}м</div>}
                {spot.note && <div style={{ fontSize: 10, color: v.textMuted, marginTop: 2 }}>{spot.note}</div>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
//  TOURNAMENTS
// ═══════════════════════════════════════
// ═══════════════════════════════════════
//  TOURNAMENTS (MULTIPLAYER via Supabase)
// ═══════════════════════════════════════
function TournamentsScreen({ v, go }) {
  const [tournaments, setTournaments] = useState([]);
  const [myTournaments, setMyTournaments] = useState([]);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [form, setForm] = useState({ name: "", type: "private", rules: "", endDate: "", scoring: "count" });
  const tgId = tg?.initDataUnsafe?.user?.id;
  const tgName = tg?.initDataUnsafe?.user?.first_name || "Игрок";
  const tgUsername = tg?.initDataUnsafe?.user?.username || "";

  const loadTournaments = useCallback(async () => {
    if (!tgId) { setLoading(false); return; }
    try {
      // Get tournaments I'm participating in
      const parts = await supabase.select("tournament_participants", `user_id=eq.${tgId}&select=tournament_id`);
      const tIds = (parts || []).map(p => p.tournament_id);
      if (tIds.length > 0) {
        const ts = await supabase.select("tournaments", `id=in.(${tIds.join(",")})`);
        setMyTournaments(ts || []);
      }
      // Get public tournaments
      const pub = await supabase.select("tournaments", `type=eq.public&status=eq.active&order=created_at.desc&limit=10`);
      setTournaments(pub || []);
    } catch (e) { console.warn(e); }
    setLoading(false);
  }, [tgId]);

  useEffect(() => { loadTournaments(); }, [loadTournaments]);

  const createTournament = async () => {
    if (!form.name.trim() || !tgId) return;
    const invite_code = generateInviteCode();
    const result = await supabase.insert("tournaments", {
      creator_id: tgId, name: form.name, type: form.type,
      rules: form.rules, end_date: form.endDate || null,
      scoring: form.scoring, invite_code, status: "active",
    });
    if (result?.[0]) {
      // Add self as participant
      await supabase.insert("tournament_participants", {
        tournament_id: result[0].id, user_id: tgId,
        username: tgUsername, first_name: tgName,
      });
      hapticNotify("success");
      setCreating(false);
      setForm({ name: "", type: "private", rules: "", endDate: "", scoring: "count" });
      loadTournaments();
    }
  };

  const joinByCode = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code || !tgId) return;
    const ts = await supabase.select("tournaments", `invite_code=eq.${code}`);
    if (ts && ts.length > 0) {
      const t = ts[0];
      // Check if already joined
      const existing = await supabase.select("tournament_participants", `tournament_id=eq.${t.id}&user_id=eq.${tgId}`);
      if (!existing || existing.length === 0) {
        await supabase.insert("tournament_participants", {
          tournament_id: t.id, user_id: tgId,
          username: tgUsername, first_name: tgName,
        });
      }
      hapticNotify("success");
      setJoinCode("");
      go(SCREENS.tournamentView, t);
    } else {
      hapticNotify("error");
    }
  };

  const shareTournament = (t) => {
    haptic("medium");
    const link = `${APP_LINK}?startapp=t_${t.invite_code}`;
    const text = `🏆 Присоединяйся к турниру "${t.name}" в Клёвометре!\n\nКод: ${t.invite_code}\n`;
    if (tg) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
    } else {
      navigator.clipboard?.writeText(`${text}\n${link}`);
    }
  };

  const allTournaments = [...myTournaments, ...tournaments.filter(t => !myTournaments.some(m => m.id === t.id))];

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>Турниры</div>
        <div style={{ fontSize: 13, color: v.textMuted, marginTop: 2 }}>Мультиплеер · Supabase</div>
      </div>

      {/* Join by code */}
      <GlassCard v={v} className="f1" style={{ padding: 14, borderRadius: 16 }}>
        <div style={{ fontSize: 11, color: v.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Присоединиться по коду</div>
        <div style={{ display: "flex", gap: 8 }}>
          <ThemedInput v={v} value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="ABC123" onKeyDown={e => e.key === "Enter" && joinByCode()} style={{ flex: 1, textTransform: "uppercase", letterSpacing: 2, fontWeight: 800, textAlign: "center" }} maxLength={6} />
          <button onClick={joinByCode} className="btn" style={{ padding: "10px 18px", borderRadius: 12, background: v.btnPrimary, color: "#fff", fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>Войти</button>
        </div>
      </GlassCard>

      {creating ? (
        <GlassCard v={v} className="f2" style={{ padding: 16, borderRadius: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>Новый турнир</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Название" v={v}><ThemedInput v={v} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Щучий турнир" /></Field>
            <div>
              <div style={{ fontSize: 11, color: v.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Тип</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[{ k: "private", l: "🔒 Приватный" }, { k: "public", l: "🌍 Публичный" }].map(t => (
                  <button key={t.k} onClick={() => setForm(f => ({ ...f, type: t.k }))} className="btn" style={{
                    flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                    background: form.type === t.k ? `${v.accent}12` : `${v.accent}03`,
                    border: `1.5px solid ${form.type === t.k ? `${v.accent}30` : v.cardBorder}`,
                    color: form.type === t.k ? v.accent : v.textMuted, cursor: "pointer", fontFamily: "inherit",
                  }}>{t.l}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: v.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Подсчёт</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[{ k: "count", l: "🐟 Кол-во" }, { k: "weight", l: "⚖️ Вес" }, { k: "length", l: "📏 Длина" }].map(s => (
                  <button key={s.k} onClick={() => setForm(f => ({ ...f, scoring: s.k }))} className="btn" style={{
                    flex: 1, padding: "8px", borderRadius: 10, fontSize: 12, fontWeight: 700,
                    background: form.scoring === s.k ? `${v.accent}12` : `${v.accent}03`,
                    border: `1.5px solid ${form.scoring === s.k ? `${v.accent}30` : v.cardBorder}`,
                    color: form.scoring === s.k ? v.accent : v.textMuted, cursor: "pointer", fontFamily: "inherit",
                  }}>{s.l}</button>
                ))}
              </div>
            </div>
            <Field label="Правила (необязательно)" v={v}><ThemedInput v={v} value={form.rules} onChange={e => setForm(f => ({ ...f, rules: e.target.value }))} placeholder="Кто больше поймает за день" /></Field>
            <Field label="Дата окончания" v={v}><ThemedInput v={v} type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} /></Field>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={createTournament} className="btn" style={{ flex: 1, padding: 14, borderRadius: 14, background: v.btnPrimary, color: "#fff", fontWeight: 800, fontSize: 15, border: "none", cursor: "pointer", fontFamily: "inherit" }}>Создать</button>
              <button onClick={() => setCreating(false)} className="btn" style={{ padding: "14px 20px", borderRadius: 14, border: `1px solid ${v.cardBorder}`, background: "transparent", color: v.textMuted, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Отмена</button>
            </div>
          </div>
        </GlassCard>
      ) : (
        <button onClick={() => { setCreating(true); haptic("medium"); }} className="btn f2" style={{ width: "100%", padding: 14, borderRadius: 16, background: `${v.stats[2]}10`, border: `1.5px solid ${v.stats[2]}25`, color: v.stats[2], fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}>+ Создать турнир</button>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "30px 0", color: v.textMuted }}>⏳ Загрузка...</div>
      ) : allTournaments.length === 0 && !creating ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: v.textDim }}><div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div><div style={{ fontSize: 14, lineHeight: 1.6 }}>Создай турнир или присоединись по коду</div></div>
      ) : allTournaments.map((t, i) => {
        const isMine = myTournaments.some(m => m.id === t.id);
        return (
          <button key={t.id} onClick={() => { haptic("light"); go(SCREENS.tournamentView, t); }} className="btn"
            style={{ ...v.glass, width: "100%", textAlign: "left", padding: 16, borderRadius: 20, marginBottom: 10, cursor: "pointer", boxSizing: "border-box", animation: `fadeUp .4s ease ${i * 0.05}s both`, border: isMine ? `1.5px solid ${v.accent}25` : v.glass.border }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div><div style={{ fontSize: 17, fontWeight: 800 }}>🏆 {t.name}</div>{t.rules && <div style={{ fontSize: 12, color: v.textMuted, marginTop: 3 }}>{t.rules}</div>}</div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                {isMine && <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 8, background: `${v.accent}15`, color: v.accent, fontWeight: 700 }}>Участвую</span>}
                <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 8, background: `${v.accent}08`, color: v.textMuted, fontWeight: 700 }}>{t.type === "private" ? "🔒" : "🌍"}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 12, color: v.textMuted }}>
              {t.invite_code && <span>🔑 {t.invite_code}</span>}
              {t.end_date && <span>📅 до {t.end_date}</span>}
              <span>{t.scoring === "weight" ? "⚖️ По весу" : t.scoring === "length" ? "📏 По длине" : "🐟 По кол-ву"}</span>
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <button onClick={(e) => { e.stopPropagation(); shareTournament(t); }} className="btn" style={{ padding: "6px 14px", borderRadius: 10, background: `${v.accent}10`, border: `1px solid ${v.accent}20`, color: v.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>📤 Пригласить</button>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════
//  TOURNAMENT VIEW (leaderboard + add catch)
// ═══════════════════════════════════════
function TournamentViewScreen({ back, tournament: initialTournament, v, saveCatch }) {
  const [tournament, setTournament] = useState(initialTournament);
  const [participants, setParticipants] = useState([]);
  const [catches, setCatches] = useState([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", rules: "", endDate: "", scoring: "count" });
  const [form, setForm] = useState({ fish: "", weight: "", length: "" });
  const tgId = tg?.initDataUnsafe?.user?.id;
  const isCreator = tournament && tgId && tournament.creator_id === tgId;

  useEffect(() => {
    if (!tournament) return;
    const load = async () => {
      const [parts, tc] = await Promise.all([
        supabase.select("tournament_participants", `tournament_id=eq.${tournament.id}`),
        supabase.select("tournament_catches", `tournament_id=eq.${tournament.id}&order=created_at.desc`),
      ]);
      setParticipants(parts || []);
      setCatches(tc || []);
    };
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [tournament]);

  const addCatch = async () => {
    if (!form.fish || !tgId || !tournament) return;
    await supabase.insert("tournament_catches", {
      tournament_id: tournament.id, user_id: tgId,
      fish: form.fish, weight: parseFloat(form.weight) || 0, length: parseFloat(form.length) || 0,
    });
    const myCatches = catches.filter(c => c.user_id === tgId);
    const newCaught = myCatches.length + 1;
    const newWeight = myCatches.reduce((a, c) => a + (parseFloat(c.weight) || 0), 0) + (parseFloat(form.weight) || 0);
    await supabase.update("tournament_participants", `tournament_id=eq.${tournament.id}&user_id=eq.${tgId}`, { total_caught: newCaught, total_weight: newWeight });
    saveCatch({ fish: form.fish, weight: form.weight, length: form.length, date: new Date().toLocaleDateString("ru-RU"), notes: `Турнир: ${tournament.name}` });
    hapticNotify("success");
    setForm({ fish: "", weight: "", length: "" });
    setAdding(false);
    const [parts, tc] = await Promise.all([
      supabase.select("tournament_participants", `tournament_id=eq.${tournament.id}`),
      supabase.select("tournament_catches", `tournament_id=eq.${tournament.id}&order=created_at.desc`),
    ]);
    setParticipants(parts || []);
    setCatches(tc || []);
  };

  const shareTournament = () => {
    haptic("medium");
    const link = `${APP_LINK}?startapp=t_${tournament.invite_code}`;
    const text = `🏆 Присоединяйся к турниру "${tournament.name}" в Клёвометре!\nКод: ${tournament.invite_code}`;
    if (tg) tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
    else navigator.clipboard?.writeText(`${text}\n${link}`);
  };

  // ── Admin: Edit ──
  const startEdit = () => {
    setEditForm({ name: tournament.name, rules: tournament.rules || "", endDate: tournament.end_date || "", scoring: tournament.scoring || "count" });
    setEditing(true);
  };
  const saveEdit = async () => {
    if (!editForm.name.trim()) return;
    const result = await supabase.update("tournaments", `id=eq.${tournament.id}`, {
      name: editForm.name, rules: editForm.rules, end_date: editForm.endDate || null, scoring: editForm.scoring,
    });
    if (result?.[0]) setTournament(result[0]);
    hapticNotify("success");
    setEditing(false);
  };

  // ── Admin: Delete ──
  const deleteTournament = async () => {
    await supabase.delete("tournament_catches", `tournament_id=eq.${tournament.id}`);
    await supabase.delete("tournament_participants", `tournament_id=eq.${tournament.id}`);
    await supabase.delete("tournaments", `id=eq.${tournament.id}`);
    hapticNotify("warning");
    back();
  };

  // ── Admin: End tournament ──
  const endTournament = async () => {
    const result = await supabase.update("tournaments", `id=eq.${tournament.id}`, { status: "ended" });
    if (result?.[0]) setTournament(result[0]);
    hapticNotify("success");
  };

  if (!tournament) return null;

  const leaderboard = [...participants].sort((a, b) => {
    if (tournament.scoring === "weight") return (b.total_weight || 0) - (a.total_weight || 0);
    return (b.total_caught || 0) - (a.total_caught || 0);
  });
  const isEnded = tournament.status === "ended";

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 900, flex: 1 }}>🏆 {tournament.name}</div>
          {isEnded && <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, background: `${v.btnDangerColor}15`, color: v.btnDangerColor, fontWeight: 700 }}>Завершён</span>}
        </div>
        <div style={{ fontSize: 13, color: v.textMuted, marginTop: 2 }}>{tournament.rules || "Без ограничений"}</div>
      </div>

      {/* Admin panel (only for creator) */}
      {isCreator && (
        <GlassCard v={v} className="f1" style={{ padding: 12, borderRadius: 14, border: `1px solid ${v.stats[2]}25` }}>
          <div style={{ fontSize: 11, color: v.stats[2], fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>⚙️ Управление турниром</div>
          {editing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <ThemedInput v={v} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Название" />
              <ThemedInput v={v} value={editForm.rules} onChange={e => setEditForm(f => ({ ...f, rules: e.target.value }))} placeholder="Правила" />
              <ThemedInput v={v} type="date" value={editForm.endDate} onChange={e => setEditForm(f => ({ ...f, endDate: e.target.value }))} />
              <div style={{ display: "flex", gap: 4 }}>
                {[{ k: "count", l: "🐟 Кол-во" }, { k: "weight", l: "⚖️ Вес" }, { k: "length", l: "📏 Длина" }].map(s => (
                  <button key={s.k} onClick={() => setEditForm(f => ({ ...f, scoring: s.k }))} className="btn" style={{
                    flex: 1, padding: "6px", borderRadius: 8, fontSize: 11, fontWeight: 700,
                    background: editForm.scoring === s.k ? `${v.accent}12` : `${v.accent}03`,
                    border: `1px solid ${editForm.scoring === s.k ? `${v.accent}30` : v.cardBorder}`,
                    color: editForm.scoring === s.k ? v.accent : v.textMuted, cursor: "pointer", fontFamily: "inherit",
                  }}>{s.l}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={saveEdit} className="btn" style={{ flex: 1, padding: 10, borderRadius: 10, background: v.btnPrimary, color: "#fff", fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>💾 Сохранить</button>
                <button onClick={() => setEditing(false)} className="btn" style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${v.cardBorder}`, background: "transparent", color: v.textMuted, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>Отмена</button>
              </div>
            </div>
          ) : confirmDelete ? (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: v.btnDangerColor, marginBottom: 8 }}>Удалить турнир и все данные? Это необратимо.</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={deleteTournament} className="btn" style={{ flex: 1, padding: 10, borderRadius: 10, background: v.btnDanger, border: `1px solid ${v.btnDangerBorder}`, color: v.btnDangerColor, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>🗑 Да, удалить</button>
                <button onClick={() => setConfirmDelete(false)} className="btn" style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${v.cardBorder}`, background: "transparent", color: v.textMuted, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>Отмена</button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={startEdit} className="btn" style={{ flex: 1, padding: "8px 12px", borderRadius: 10, background: `${v.accent}08`, border: `1px solid ${v.accent}20`, color: v.accent, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>✏️ Изменить</button>
              {!isEnded && <button onClick={endTournament} className="btn" style={{ flex: 1, padding: "8px 12px", borderRadius: 10, background: `${v.stats[2]}08`, border: `1px solid ${v.stats[2]}20`, color: v.stats[2], fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>🏁 Завершить</button>}
              <button onClick={() => setConfirmDelete(true)} className="btn" style={{ padding: "8px 12px", borderRadius: 10, background: v.btnDanger, border: `1px solid ${v.btnDangerBorder}`, color: v.btnDangerColor, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>🗑</button>
            </div>
          )}
        </GlassCard>
      )}

      {/* Invite code banner */}
      <GlassCard v={v} className={isCreator ? "f2" : "f1"} style={{ padding: 14, borderRadius: 16, border: `1px solid ${v.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, color: v.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Код приглашения</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: v.accent, letterSpacing: 4, marginTop: 4 }}>{tournament.invite_code}</div>
        </div>
        <button onClick={shareTournament} className="btn" style={{ padding: "10px 16px", borderRadius: 12, background: v.btnPrimary, color: "#fff", fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>📤 Поделиться</button>
      </GlassCard>

      {/* Add catch (only if tournament active) */}
      {!isEnded && (adding ? (
        <GlassCard v={v} style={{ padding: 16, borderRadius: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Добавить улов в турнир</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <ThemedSelect v={v} value={form.fish} onChange={e => setForm(f => ({ ...f, fish: e.target.value }))}><option value="">Рыба</option>{FISH_LIST.map(f => <option key={f} value={f}>{f}</option>)}</ThemedSelect>
            <div style={{ display: "flex", gap: 8 }}>
              <ThemedInput v={v} type="number" step="0.1" placeholder="Вес (кг)" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} style={{ flex: 1 }} />
              <ThemedInput v={v} type="number" placeholder="Длина (см)" value={form.length} onChange={e => setForm(f => ({ ...f, length: e.target.value }))} style={{ flex: 1 }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={addCatch} className="btn" style={{ flex: 1, padding: 12, borderRadius: 12, background: v.btnPrimary, color: "#fff", fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "inherit" }}>Добавить</button>
              <button onClick={() => setAdding(false)} className="btn" style={{ padding: "12px 16px", borderRadius: 12, border: `1px solid ${v.cardBorder}`, background: "transparent", color: v.textMuted, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
            </div>
          </div>
        </GlassCard>
      ) : (
        <button onClick={() => setAdding(true)} className="btn" style={{ width: "100%", padding: 14, borderRadius: 16, background: `${v.accent}08`, border: `1.5px solid ${v.accent}25`, color: v.accent, fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", marginBottom: 10 }}>🐟 Записать улов</button>
      ))}

      {/* Leaderboard */}
      <GlassCard v={v} style={{ padding: 16, borderRadius: 16 }}>
        <div style={{ fontSize: 11, color: v.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>🏅 Лидерборд · {participants.length} участников</div>
        {leaderboard.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: v.textDim, fontSize: 13 }}>Пока нет участников</div>
        ) : leaderboard.map((p, i) => {
          const isMe = p.user_id === tgId;
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
          const val = tournament.scoring === "weight" ? `${(p.total_weight || 0).toFixed(1)} кг` : `${p.total_caught || 0} шт`;
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: isMe ? "10px 8px" : "10px 0", borderBottom: i < leaderboard.length - 1 ? `1px solid ${v.cardBorder}` : "none", background: isMe ? `${v.accent}08` : "transparent", margin: isMe ? "0 -8px" : 0, borderRadius: isMe ? 10 : 0 }}>
              <span style={{ fontSize: i < 3 ? 20 : 14, width: 28, textAlign: "center", fontWeight: 900, color: v.textMuted }}>{medal}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: isMe ? 800 : 600, fontSize: 14, color: isMe ? v.accent : v.text }}>{p.first_name || p.username || "—"}{isMe ? " (ты)" : ""}</div>
                {p.username && <div style={{ fontSize: 11, color: v.textDim }}>@{p.username}</div>}
              </div>
              <div style={{ fontWeight: 900, fontSize: 16, color: i === 0 ? v.accent : v.text }}>{val}</div>
            </div>
          );
        })}
      </GlassCard>

      {/* Recent catches */}
      {catches.length > 0 && (
        <GlassCard v={v} style={{ padding: 16, borderRadius: 16 }}>
          <div style={{ fontSize: 11, color: v.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Последние уловы</div>
          {catches.slice(0, 10).map((c, i) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < Math.min(catches.length, 10) - 1 ? `1px solid ${v.cardBorder}` : "none" }}>
              <span style={{ fontSize: 16 }}>{fishEmoji(c.fish)}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{c.fish}</span>
              {c.weight > 0 && <span style={{ fontSize: 12, color: v.stats[2] }}>{c.weight}кг</span>}
              {c.length > 0 && <span style={{ fontSize: 12, color: v.stats[0] }}>{c.length}см</span>}
            </div>
          ))}
        </GlassCard>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
//  TOURNAMENT JOIN (via deep link)
// ═══════════════════════════════════════
function TournamentJoinScreen({ back, inviteData, v, go }) {
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const tgId = tg?.initDataUnsafe?.user?.id;
  const tgName = tg?.initDataUnsafe?.user?.first_name || "Игрок";
  const tgUsername = tg?.initDataUnsafe?.user?.username || "";

  useEffect(() => {
    const load = async () => {
      if (!inviteData?.invite_code) { setLoading(false); return; }
      const ts = await supabase.select("tournaments", `invite_code=eq.${inviteData.invite_code}`);
      if (ts && ts.length > 0) setTournament(ts[0]);
      setLoading(false);
    };
    load();
  }, [inviteData]);

  const join = async () => {
    if (!tournament || !tgId) return;
    const existing = await supabase.select("tournament_participants", `tournament_id=eq.${tournament.id}&user_id=eq.${tgId}`);
    if (!existing || existing.length === 0) {
      await supabase.insert("tournament_participants", {
        tournament_id: tournament.id, user_id: tgId,
        username: tgUsername, first_name: tgName,
      });
    }
    hapticNotify("success");
    setJoined(true);
    setTimeout(() => go(SCREENS.tournamentView, tournament), 500);
  };

  if (loading) return <div style={{ padding: "60px 20px", textAlign: "center", color: v.textMuted }}>⏳ Загрузка турнира...</div>;
  if (!tournament) return (
    <div style={{ padding: "60px 20px", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: v.text }}>Турнир не найден</div>
      <div style={{ fontSize: 13, color: v.textMuted, marginTop: 8 }}>Код приглашения недействителен</div>
      <button onClick={back} className="btn" style={{ marginTop: 20, padding: "12px 30px", borderRadius: 14, background: v.btnPrimary, color: "#fff", fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "inherit" }}>Назад</button>
    </div>
  );

  return (
    <div style={{ padding: "40px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🏆</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: v.text }}>{tournament.name}</div>
      {tournament.rules && <div style={{ fontSize: 14, color: v.textMuted, marginTop: 8 }}>{tournament.rules}</div>}
      <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 16 }}>
        <div style={{ textAlign: "center" }}><div style={{ fontSize: 12, color: v.textDim }}>Подсчёт</div><div style={{ fontSize: 14, fontWeight: 700, color: v.accent, marginTop: 2 }}>{tournament.scoring === "weight" ? "По весу" : tournament.scoring === "length" ? "По длине" : "По кол-ву"}</div></div>
        {tournament.end_date && <div style={{ textAlign: "center" }}><div style={{ fontSize: 12, color: v.textDim }}>До</div><div style={{ fontSize: 14, fontWeight: 700, color: v.text, marginTop: 2 }}>{tournament.end_date}</div></div>}
      </div>
      <button onClick={join} disabled={joined} className="btn" style={{ marginTop: 30, padding: "16px 50px", borderRadius: 18, background: joined ? `${v.accent}30` : v.btnPrimary, color: "#fff", fontWeight: 900, fontSize: 18, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
        {joined ? "✅ Присоединился!" : "Присоединиться"}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════
//  EDIT PROFILE
// ═══════════════════════════════════════
function EditProfileScreen({ back, v, sbUser, updateProfile, userAvatar }) {
  const AVATAR_OPTIONS = ["🎣","🐟","🐠","🐡","🦈","🐊","🐢","🦀","🦑","🐙","🌊","⛵","🚤","🎯","🏆","👤","🧔","👨‍🦰","🧑‍🦱","👩","🐻","🦅","🐺","🦊"];
  const [nickname, setNickname] = useState(sbUser?.nickname || tg?.initDataUnsafe?.user?.first_name || "");
  const [avatar, setAvatar] = useState(userAvatar || "🎣");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await updateProfile({ nickname: nickname.trim() || null, avatar_emoji: avatar });
    hapticNotify("success");
    setSaving(false);
    back();
  };

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}><div style={{ fontSize: 22, fontWeight: 900 }}>Редактировать профиль</div></div>

      {/* Avatar picker */}
      <GlassCard v={v} className="f1" style={{ padding: 16, borderRadius: 16, textAlign: "center" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: v.accentGrad, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, border: `3px solid ${v.accentBorder}` }}>{avatar}</div>
        <div style={{ fontSize: 11, color: v.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Выбери аватар</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
          {AVATAR_OPTIONS.map(e => (
            <button key={e} onClick={() => { setAvatar(e); haptic("light"); }} className="btn" style={{
              width: 44, height: 44, borderRadius: 12, fontSize: 22,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: avatar === e ? `${v.accent}20` : `${v.accent}05`,
              border: `2px solid ${avatar === e ? v.accent : "transparent"}`,
              cursor: "pointer", transition: "all .2s",
            }}>{e}</button>
          ))}
        </div>
      </GlassCard>

      {/* Nickname */}
      <GlassCard v={v} className="f2" style={{ padding: 16, borderRadius: 16 }}>
        <Field label="Никнейм" v={v}>
          <ThemedInput v={v} value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Как тебя звать?" maxLength={30} />
        </Field>
        <div style={{ fontSize: 11, color: v.textDim, marginTop: 8 }}>Отображается в турнирах и ленте друзей</div>
      </GlassCard>

      <button onClick={handleSave} disabled={saving} className="btn" style={{ width: "100%", padding: 15, borderRadius: 16, border: "none", background: v.btnPrimary, color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer", fontFamily: "inherit", marginTop: 6, opacity: saving ? 0.6 : 1 }}>
        {saving ? "⏳ Сохранение..." : "💾 Сохранить"}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════
//  LOCATION PICKER
// ═══════════════════════════════════════
function LocationPickerScreen({ back, v, updateProfile, clearCustomLocation, setManualLocation, sbUser }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const currentCity = sbUser?.custom_city;

  const searchCity = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5&accept-language=ru`);
      const data = await res.json();
      setSearchResults(data.map(d => ({ name: d.display_name.split(",")[0], fullName: d.display_name, lat: parseFloat(d.lat), lon: parseFloat(d.lon) })));
    } catch (e) { console.warn(e); }
    setSearching(false);
  };

  const selectCity = async (city) => {
    await updateProfile({ custom_lat: city.lat, custom_lng: city.lon, custom_city: city.name });
    setManualLocation({ lat: city.lat, lon: city.lon, city: city.name });
    hapticNotify("success");
    back();
  };

  const resetToAuto = async () => {
    await clearCustomLocation();
    setManualLocation(null);
    hapticNotify("success");
    back();
  };

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Геолокация</div>
        <div style={{ fontSize: 13, color: v.textMuted, marginTop: 2 }}>Для прогноза погоды и клёва</div>
      </div>

      {currentCity && (
        <GlassCard v={v} className="f1" style={{ padding: 14, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div><div style={{ fontSize: 11, color: v.textDim, fontWeight: 700 }}>ТЕКУЩАЯ ЛОКАЦИЯ</div><div style={{ fontSize: 16, fontWeight: 800, color: v.accent, marginTop: 4 }}>📍 {currentCity}</div></div>
          <button onClick={resetToAuto} className="btn" style={{ padding: "8px 14px", borderRadius: 10, background: v.btnDanger, border: `1px solid ${v.btnDangerBorder}`, color: v.btnDangerColor, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Сбросить</button>
        </GlassCard>
      )}

      {/* Search */}
      <GlassCard v={v} className="f2" style={{ padding: 14, borderRadius: 16 }}>
        <div style={{ fontSize: 11, color: v.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Поиск города</div>
        <div style={{ display: "flex", gap: 8 }}>
          <ThemedInput v={v} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && searchCity()} placeholder="Москва, Казань..." style={{ flex: 1 }} />
          <button onClick={searchCity} className="btn" style={{ padding: "10px 16px", borderRadius: 12, background: v.btnPrimary, color: "#fff", fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "inherit" }}>{searching ? "..." : "🔍"}</button>
        </div>
        {searchResults.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {searchResults.map((r, i) => (
              <button key={i} onClick={() => selectCity(r)} className="btn" style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 10, marginBottom: 4, background: `${v.accent}05`, border: `1px solid ${v.cardBorder}`, cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: v.text }}>📍 {r.name}</div>
                <div style={{ fontSize: 11, color: v.textDim, marginTop: 2 }}>{r.fullName}</div>
              </button>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Popular cities */}
      <GlassCard v={v} className="f3" style={{ padding: 16, borderRadius: 16 }}>
        <div style={{ fontSize: 11, color: v.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Популярные города</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {POPULAR_CITIES.map(city => (
            <button key={city.name} onClick={() => selectCity(city)} className="btn" style={{
              padding: "8px 14px", borderRadius: 12,
              background: currentCity === city.name ? `${v.accent}15` : `${v.accent}05`,
              border: `1px solid ${currentCity === city.name ? v.accent : v.cardBorder}`,
              color: currentCity === city.name ? v.accent : v.text,
              fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>{city.name}</button>
          ))}
        </div>
      </GlassCard>

      {!currentCity && (
        <div style={{ textAlign: "center", padding: "16px 0", color: v.textDim, fontSize: 13 }}>
          Сейчас используется автоматическая геолокация
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
//  PLAN
// ═══════════════════════════════════════
function PlanScreen({ wd, v }) {
  const { weather, biteScore } = wd;
  const [plans, setPlans] = useState(() => storage.get("plans", []));
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ date: "", location: "", notes: "" });
  const friends = storage.get("friends", []);

  const addPlan = () => {
    if (!form.date) return;
    const p = { id: Date.now(), ...form, createdAt: new Date().toLocaleDateString("ru-RU") };
    const updated = [...plans, p].sort((a, b) => a.date.localeCompare(b.date));
    setPlans(updated); storage.set("plans", updated); setAdding(false); setForm({ date: "", location: "", notes: "" }); hapticNotify("success");
  };
  const deletePlan = (id) => { haptic("medium"); const updated = plans.filter(p => p.id !== id); setPlans(updated); storage.set("plans", updated); };

  const inviteToPlan = (plan) => {
    haptic("medium");
    const dateStr = new Date(plan.date).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
    const text = `🎣 Приглашаю на рыбалку!\n\n📅 ${dateStr}${plan.location ? `\n📍 ${plan.location}` : ""}${plan.notes ? `\n📝 ${plan.notes}` : ""}\n\nПрисоединяйся в Клёвометре!`;
    const link = APP_LINK;
    if (tg) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
    } else {
      navigator.clipboard?.writeText(`${text}\n${link}`);
    }
  };

  const inviteFriendDirectly = (plan, friend) => {
    haptic("medium");
    const dateStr = new Date(plan.date).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
    const text = `🎣 Привет! Приглашаю на рыбалку ${dateStr}${plan.location ? ` на ${plan.location}` : ""}! Присоединяйся!`;
    if (tg) {
      tg.openTelegramLink(`https://t.me/${friend.username}`);
    } else {
      navigator.clipboard?.writeText(text);
    }
  };

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}><div style={{ fontSize: 24, fontWeight: 900 }}>Планирование</div></div>

      {weather && (
        <GlassCard v={v} className="f1" style={{ padding: 16, borderRadius: 20, border: `1px solid ${v.accentBorder}` }}>
          <div style={{ fontSize: 11, color: v.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>💡 На сегодня</div>
          <div style={{ fontSize: 13, color: v.textMuted, lineHeight: 1.7 }}>
            {biteScore >= 70 ? `Отличный день! ${weather.temp}°, давление ${weather.pressure}мм — идеально.` : biteScore >= 45 ? `Неплохие условия. ${weather.temp}°, ветер ${weather.wind}м/с.` : `Клёв слабый. Давление ${weather.pressure}мм.`}
          </div>
        </GlassCard>
      )}

      {adding ? (
        <GlassCard v={v} className="f2" style={{ padding: 16, borderRadius: 20, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>Новый выезд</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Дата" v={v}><ThemedInput v={v} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></Field>
            <Field label="Место" v={v}><ThemedInput v={v} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Озеро, река..." /></Field>
            <Field label="Заметка" v={v}><ThemedInput v={v} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Что взять, кого позвать" /></Field>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={addPlan} className="btn" style={{ flex: 1, padding: 14, borderRadius: 14, background: v.btnPrimary, color: "#fff", fontWeight: 800, fontSize: 15, border: "none", cursor: "pointer", fontFamily: "inherit" }}>Сохранить</button>
              <button onClick={() => setAdding(false)} className="btn" style={{ padding: "14px 20px", borderRadius: 14, border: `1px solid ${v.cardBorder}`, background: "transparent", color: v.textMuted, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Отмена</button>
            </div>
          </div>
        </GlassCard>
      ) : (
        <button onClick={() => { setAdding(true); haptic("medium"); }} className="btn f2" style={{ width: "100%", padding: 14, borderRadius: 16, background: `${v.stats[3]}10`, border: `1.5px solid ${v.stats[3]}25`, color: v.stats[3], fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}>+ Запланировать выезд</button>
      )}

      {plans.map((p, i) => (
        <PlanCard key={p.id} plan={p} index={i} v={v} friends={friends} onDelete={deletePlan} onInvite={inviteToPlan} onInviteFriend={inviteFriendDirectly} />
      ))}

      {plans.length === 0 && !adding && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: v.textDim }}><div style={{ fontSize: 48, marginBottom: 12 }}>📅</div><div style={{ fontSize: 14, lineHeight: 1.6 }}>Запланируй следующую рыбалку</div></div>
      )}
    </div>
  );
}

// ── Plan card with invite functionality ──
function PlanCard({ plan, index, v, friends, onDelete, onInvite, onInviteFriend }) {
  const [showInvite, setShowInvite] = useState(false);
  const dateStr = new Date(plan.date).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" });
  const isPast = new Date(plan.date) < new Date(new Date().toDateString());

  return (
    <div style={{ ...v.glass, borderRadius: 16, marginBottom: 8, overflow: "hidden", animation: `fadeUp .4s ease ${index * 0.05}s both`, opacity: isPast ? 0.5 : 1 }}>
      <div style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>📅 {dateStr}</div>
          {plan.location && <div style={{ fontSize: 12, color: v.textMuted, marginTop: 2 }}>📍 {plan.location}</div>}
          {plan.notes && <div style={{ fontSize: 11, color: v.textDim, marginTop: 2 }}>{plan.notes}</div>}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {!isPast && (
            <button onClick={() => { setShowInvite(!showInvite); haptic("light"); }} className="btn" style={{ padding: "6px 10px", borderRadius: 10, background: `${v.accent}08`, border: `1px solid ${v.accent}20`, color: v.accent, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>👥</button>
          )}
          <button onClick={() => onDelete(plan.id)} className="btn" style={{ background: "none", border: "none", color: v.btnDangerColor, cursor: "pointer", fontSize: 16, padding: "6px 4px" }}>✕</button>
        </div>
      </div>

      {/* Invite panel */}
      {showInvite && (
        <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${v.cardBorder}` }}>
          <div style={{ fontSize: 11, color: v.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginTop: 10, marginBottom: 8 }}>Пригласить на рыбалку</div>

          {/* Share button (general) */}
          <button onClick={() => onInvite(plan)} className="btn" style={{
            width: "100%", padding: "10px 14px", borderRadius: 12, marginBottom: 8,
            background: v.btnPrimary, color: "#fff", fontWeight: 700, fontSize: 13,
            border: "none", cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>📤 Отправить приглашение в Telegram</button>

          {/* Friends quick invite */}
          {friends.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: v.textDim, marginBottom: 6 }}>Или напиши другу напрямую:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {friends.map(f => (
                  <button key={f.username} onClick={() => onInviteFriend(plan, f)} className="btn" style={{
                    padding: "6px 12px", borderRadius: 10,
                    background: `${v.accent}08`, border: `1px solid ${v.accent}15`,
                    color: v.accent, fontSize: 12, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <span style={{ fontSize: 14 }}>👤</span> @{f.username}
                  </button>
                ))}
              </div>
            </>
          )}

          {friends.length === 0 && (
            <div style={{ fontSize: 12, color: v.textDim, textAlign: "center", padding: "4px 0" }}>Добавь друзей в профиле для быстрого приглашения</div>
          )}
        </div>
      )}
    </div>
  );
}

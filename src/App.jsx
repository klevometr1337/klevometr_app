import { useState, useEffect, useRef, useMemo, useCallback } from "react";

// ═══════════════════════════════════════
//  KLEVOMETR — Telegram Mini App v2.0
//  Реальные данные + красивый визуал
// ═══════════════════════════════════════

const OWM_API_KEY = "ae9e552e204ffd1a5534b385a0af66f8"; // ← вставь свой ключ OpenWeatherMap

const tg = window.Telegram?.WebApp;
const haptic = (type = "light") => { try { tg?.HapticFeedback?.impactOccurred(type); } catch (e) {} };
const hapticNotify = (type = "success") => { try { tg?.HapticFeedback?.notificationOccurred(type); } catch (e) {} };

// ── Sound Engine (Web Audio API) ──
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playCastSound() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine"; osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start(); osc.stop(ctx.currentTime + 0.2);
  } catch(e) {}
}

function playBiteSound() {
  try {
    const ctx = getAudioCtx();
    // Bell sound — два тона колокольчика
    [1200, 1500, 1800].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.5);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.5);
    });
  } catch(e) {}
}

function playCaughtSound() {
  try {
    const ctx = getAudioCtx();
    // Victory fanfare — восходящие ноты
    const notes = [523, 659, 784, 1047]; // C5-E5-G5-C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = i === 3 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(i === 3 ? 0.4 : 0.25, ctx.currentTime + i * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.12 + (i === 3 ? 0.8 : 0.3));
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + (i === 3 ? 0.8 : 0.3));
    });
  } catch(e) {}
}

const SCREENS = {
  home: "home", sessionActive: "sessionActive",
  diary: "diary", addCatch: "addCatch", viewCatch: "viewCatch",
  trophy: "trophy", forecast: "forecast",
  stats: "stats", gear: "gear", addGear: "addGear",
  social: "social", spots: "spots", addSpot: "addSpot",
  profile: "profile", tournaments: "tournaments", plan: "plan",
  map: "map", friends: "friends",
};

const FISH_LIST = ["Щука","Окунь","Судак","Карп","Карась","Лещ","Сом","Плотва","Жерех","Форель","Налим","Язь","Голавль","Красноперка","Густера"];
const BAITS_LIST = ["Воблер","Блесна вращ.","Блесна колебл.","Джиг","Твистер","Виброхвост","Червь","Опарыш","Мотыль","Кукуруза","Живец","Бойл","Пенопласт","Тесто","Хлеб"];
const GEAR_TYPES = ["Удилище","Катушка","Леска","Шнур","Приманка","Крючки","Поплавок","Грузило","Подсак","Эхолот","Прочее"];

// ── Хранилище ──
const storage = {
  get: (key, def = null) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; }
  },
  set: (key, val) => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  },
};

// ── Лунная фаза ──
function getMoonPhase(date = new Date()) {
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  const day = date.getDate();
  let c = 0, e = 0, jd = 0, b = 0;
  if (month < 3) { year--; month += 12; }
  ++month;
  c = 365.25 * year;
  e = 30.6 * month;
  jd = c + e + day - 694039.09;
  jd /= 29.5305882;
  b = parseInt(jd);
  jd -= b;
  b = Math.round(jd * 8);
  if (b >= 8) b = 0;
  const phases = [
    { name: "Новолуние", icon: "🌑", factor: 0.6 },
    { name: "Растущий серп", icon: "🌒", factor: 0.7 },
    { name: "Первая четверть", icon: "🌓", factor: 0.8 },
    { name: "Растущая луна", icon: "🌔", factor: 0.9 },
    { name: "Полнолуние", icon: "🌕", factor: 1.0 },
    { name: "Убывающая луна", icon: "🌖", factor: 0.85 },
    { name: "Последняя четверть", icon: "🌗", factor: 0.75 },
    { name: "Убывающий серп", icon: "🌘", factor: 0.65 },
  ];
  return phases[b % 8];
}

// ── Геолокация ──
function requestGeolocation() {
  return new Promise((resolve, reject) => {
    browserGeo(resolve, reject);
  });
}
function browserGeo(resolve, reject) {
  if (!navigator.geolocation) { reject(new Error("Геолокация недоступна")); return; }
  navigator.geolocation.getCurrentPosition(
    (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
    (err) => reject(err),
    { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 }
  );
}

// ── Погода ──
async function fetchWeather(lat, lon) {
  if (!OWM_API_KEY || OWM_API_KEY === "YOUR_API_KEY_HERE") return null;
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&units=metric&lang=ru`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    return {
      temp: Math.round(d.main.temp),
      feelsLike: Math.round(d.main.feels_like),
      pressure: Math.round(d.main.pressure * 0.750062),
      humidity: d.main.humidity,
      wind: d.wind.speed.toFixed(1),
      windDeg: d.wind.deg,
      clouds: d.clouds.all,
      description: d.weather[0]?.description || "",
      icon: d.weather[0]?.icon || "01d",
      cityName: d.name || "—",
      sunrise: d.sys.sunrise,
      sunset: d.sys.sunset,
      waterTemp: Math.round(d.main.temp - 3),
    };
  } catch (e) { console.error("OWM:", e); return null; }
}

async function fetchForecast(lat, lon) {
  if (!OWM_API_KEY || OWM_API_KEY === "YOUR_API_KEY_HERE") return null;
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&units=metric&lang=ru`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    return d.list;
  } catch (e) { return null; }
}

// ── Прогноз клёва ──
function computeBiteScore(weather, moon, hour) {
  if (!weather) return simulatedScore(hour);
  let timeFactor = 0.3;
  if ((hour >= 5 && hour <= 9) || (hour >= 17 && hour <= 21)) timeFactor = 1.0;
  else if ((hour >= 10 && hour <= 16)) timeFactor = 0.6;
  const p = weather.pressure;
  let pressureFactor = p >= 748 && p <= 758 ? 1.0 : p >= 743 && p < 748 ? 0.8 : p > 758 && p <= 763 ? 0.8 : p >= 738 && p < 743 ? 0.6 : p > 763 && p <= 768 ? 0.6 : 0.4;
  const w = parseFloat(weather.wind);
  let windFactor = w >= 2 && w <= 5 ? 1.0 : w < 2 ? 0.8 : w <= 7 ? 0.7 : w <= 10 ? 0.4 : 0.2;
  const moonFactor = moon?.factor || 0.7;
  const cl = weather.clouds;
  let cloudFactor = cl >= 30 && cl <= 70 ? 1.0 : cl < 30 ? 0.8 : 0.6;
  return Math.min(100, Math.max(0, Math.round((timeFactor * 0.35 + pressureFactor * 0.25 + windFactor * 0.15 + moonFactor * 0.15 + cloudFactor * 0.10) * 100)));
}
function simulatedScore(hour) {
  let t = 0.3;
  if ((hour >= 5 && hour <= 9) || (hour >= 17 && hour <= 21)) t = 1.0;
  else if (hour >= 10 && hour <= 16) t = 0.6;
  return Math.min(100, Math.max(0, Math.round((t * 0.5 + 0.7 * 0.3 + 0.8 * 0.2) * 100)));
}
function getScoreColor(s) { return s >= 70 ? "#4ade80" : s >= 45 ? "#fbbf24" : s >= 25 ? "#f97316" : "#ef4444"; }
function getScoreLabel(s) { return s >= 70 ? "Отличный" : s >= 45 ? "Хороший" : s >= 25 ? "Слабый" : "Плохой"; }
function weatherEmoji(icon) {
  if (!icon) return "🌤";
  const map = {"01d":"☀️","01n":"🌙","02d":"⛅","02n":"☁️","03d":"☁️","03n":"☁️","04d":"☁️","04n":"☁️","09d":"🌧","09n":"🌧","10d":"🌦","10n":"🌧","11d":"⛈","11n":"⛈","13d":"🌨","13n":"🌨","50d":"🌫","50n":"🌫"};
  return map[icon] || "🌤";
}
function windDir(deg) {
  if (deg == null) return "";
  const dirs = ["С","ССВ","СВ","ВСВ","В","ВЮВ","ЮВ","ЮЮВ","Ю","ЮЮЗ","ЮЗ","ЗЮЗ","З","ЗСЗ","СЗ","ССЗ"];
  return dirs[Math.round(deg / 22.5) % 16];
}

// ── useWeather hook ──
function useWeather() {
  const [location, setLocation] = useState(null);
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locationName, setLocationName] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let loc = null;

      // 1. Пробуем геолокацию
      try {
        loc = await requestGeolocation();
      } catch (e) {
        console.log("Geo fallback to Moscow:", e.message);
      }

      // 2. Фоллбэк — Москва
      if (!loc) {
        loc = { lat: 55.7504, lon: 37.6175 };
      }

      if (cancelled) return;
      setLocation(loc);

      // 3. Запрашиваем погоду — всегда, даже с дефолтной локацией
      try {
        const w = await fetchWeather(loc.lat, loc.lon);
        if (cancelled) return;
        if (w) { setWeather(w); setLocationName(w.cityName); }
        const fc = await fetchForecast(loc.lat, loc.lon);
        if (cancelled) return;
        if (fc) setForecast(fc);
      } catch (e) { console.log("Weather error:", e.message); }

      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!location) return;
    const iv = setInterval(async () => {
      const w = await fetchWeather(location.lat, location.lon);
      if (w) setWeather(w);
    }, 600000);
    return () => clearInterval(iv);
  }, [location]);

  return { location, weather, forecast, loading, locationName };
}

// ══════════════════════════════════════════════════
//  ANIMATED BACKGROUND
// ══════════════════════════════════════════════════
function AnimatedBg() {
  return (
    <div style={{position:"fixed",inset:0,zIndex:0,overflow:"hidden",pointerEvents:"none"}}>
      <style>{`
        @keyframes aurora1 {
          0%,100%{transform:translate(0,0) scale(1);opacity:1}
          33%{transform:translate(40px,-30px) scale(1.15);opacity:0.8}
          66%{transform:translate(-30px,40px) scale(0.95);opacity:1}
        }
        @keyframes aurora2 {
          0%,100%{transform:translate(0,0) scale(1);opacity:0.9}
          33%{transform:translate(-50px,25px) scale(1.2);opacity:1}
          66%{transform:translate(35px,-35px) scale(0.9);opacity:0.7}
        }
        @keyframes aurora3 {
          0%,100%{transform:translate(0,0) scale(1)}
          50%{transform:translate(30px,50px) scale(1.15)}
        }
        @keyframes starTwinkle {
          0%,100%{opacity:0.15;transform:scale(1)}
          50%{opacity:0.8;transform:scale(1.5)}
        }
        @keyframes fishSwim {
          0%{transform:translateX(-20px) translateY(0);opacity:0}
          10%{opacity:0.15}
          50%{transform:translateX(50vw) translateY(-15px);opacity:0.12}
          90%{opacity:0.05}
          100%{transform:translateX(110vw) translateY(5px);opacity:0}
        }
        @keyframes wavePulse {
          0%,100%{opacity:0.25;transform:scaleX(1)}
          50%{opacity:0.4;transform:scaleX(1.02)}
        }
      `}</style>
      {/* Deep ocean background */}
      <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,#010a15 0%,#021a30 30%,#032845 55%,#01253e 75%,#021c30 100%)"}}/>
      {/* Aurora blobs — BRIGHTER */}
      <div style={{position:"absolute",top:"-5%",left:"10%",width:420,height:420,borderRadius:"50%",background:"radial-gradient(circle,rgba(16,255,150,0.18) 0%,rgba(0,200,120,0.06) 40%,transparent 70%)",animation:"aurora1 10s ease-in-out infinite",filter:"blur(30px)"}}/>
      <div style={{position:"absolute",top:"30%",right:"-5%",width:500,height:350,borderRadius:"50%",background:"radial-gradient(circle,rgba(0,130,255,0.15) 0%,rgba(0,80,200,0.05) 40%,transparent 70%)",animation:"aurora2 13s ease-in-out infinite",filter:"blur(40px)"}}/>
      <div style={{position:"absolute",bottom:"10%",left:"20%",width:350,height:350,borderRadius:"50%",background:"radial-gradient(circle,rgba(120,0,255,0.12) 0%,rgba(80,0,200,0.04) 40%,transparent 70%)",animation:"aurora3 16s ease-in-out infinite",filter:"blur(45px)"}}/>
      {/* Accent warm glow */}
      <div style={{position:"absolute",top:"60%",right:"30%",width:250,height:250,borderRadius:"50%",background:"radial-gradient(circle,rgba(255,180,0,0.06) 0%,transparent 70%)",animation:"aurora1 20s ease-in-out infinite reverse",filter:"blur(50px)"}}/>
      {/* Stars — twinkling */}
      {[...Array(50)].map((_,i)=>(
        <div key={i} style={{
          position:"absolute",
          left:`${(i*31+17)%100}%`,
          top:`${(i*47+11)%55}%`,
          width: i%7===0?3:i%3===0?2:1,
          height: i%7===0?3:i%3===0?2:1,
          borderRadius:"50%",
          background: i%10===0 ? "#4ade80" : i%7===0 ? "#60a5fa" : "#ffffff",
          animation:`starTwinkle ${3+i%5}s ${i*0.3}s ease-in-out infinite`,
        }}/>
      ))}
      {/* Swimming fish silhouettes */}
      {[0,1,2].map(i=>(
        <div key={`fish${i}`} style={{
          position:"absolute",
          bottom:`${15+i*12}%`,
          left:0,
          fontSize:i===1?16:12,
          opacity:0,
          animation:`fishSwim ${18+i*7}s ${i*6}s linear infinite`,
        }}>🐟</div>
      ))}
      {/* Water glow at bottom */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:150,background:"linear-gradient(to top,rgba(0,40,80,0.6),transparent)",animation:"wavePulse 4s ease-in-out infinite"}}/>
      {/* Subtle noise texture overlay */}
      <div style={{position:"absolute",inset:0,opacity:0.03,backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",backgroundSize:"128px 128px"}}/>
    </div>
  );
}

// ══════════════════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════════════════
export default function Klevometr() {
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

  // Real data from localStorage
  const [catches, setCatches] = useState(() => storage.get("catches", []));
  const [gearItems, setGearItems] = useState(() => storage.get("gear", []));
  const [spots, setSpots] = useState(() => storage.get("spots", []));
  const [sessions, setSessions] = useState(() => storage.get("sessions", []));

  const { weather, forecast, loading: weatherLoading, locationName } = useWeather();
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

  // Telegram BackButton
  useEffect(() => {
    if (!tg) return;
    if (screen !== SCREENS.home) {
      tg.BackButton.show();
      const h = () => back();
      tg.BackButton.onClick(h);
      return () => tg.BackButton.offClick(h);
    } else { tg.BackButton.hide(); }
  }, [screen, back]);

  // Timer
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
        id: Date.now(),
        date: new Date().toLocaleDateString("ru-RU"),
        duration: elapsed,
        casts, bites, caught,
        weather: weather ? `${weather.temp}°, ${weather.pressure}мм` : "—",
        location: locationName || "—",
      };
      const updated = [session, ...sessions].slice(0, 50);
      setSessions(updated);
      storage.set("sessions", updated);
    }
  };

  const addEvent = (type, text) => setEvents(p => [{ type, text, t: elapsed }, ...p].slice(0, 50));
  
  // Session recommendations engine
  const addTip = (tip) => addEvent("tip", tip);
  const checkRecommendations = (newCasts, newBites, newCaught) => {
    const castsSinceBite = newCasts - (newBites > 0 ? Math.floor(newCasts * newBites / Math.max(newCasts, 1)) : 0);
    // Tips based on session state
    if (newCasts === 5 && newBites === 0) setTimeout(() => addTip("💡 5 забросов без поклёвки — попробуй сменить приманку или дистанцию"), 800);
    if (newCasts === 12 && newBites === 0) setTimeout(() => addTip("💡 Клёва нет — смени точку. Поищи бровку или перепад глубины"), 800);
    if (newCasts === 20 && newBites <= 1) setTimeout(() => addTip("💡 Слабая активность. Попробуй замедлить проводку или уменьши размер приманки"), 800);
    if (newBites === 1 && newCaught === 0) setTimeout(() => addTip("💡 Есть контакт! Не торопись с подсечкой — дай рыбе заглотить"), 600);
    if (newCaught === 1) setTimeout(() => addTip("🔥 Первая рыба! Запомни дистанцию и приманку — продолжай в том же стиле"), 600);
    if (newCaught === 3) setTimeout(() => addTip("🔥 Серия! Ты нашёл рабочую точку. Не меняй ничего"), 600);
    if (newCaught === 5) setTimeout(() => addTip("🏆 5 рыб — отличная сессия! Можно попробовать на трофей — ставь крупнее"), 600);
    // Time-based
    const hour = new Date().getHours();
    if (newCasts === 1 && hour >= 16 && hour <= 17) setTimeout(() => addTip("🌅 Вечерняя зорька начинается — лучшее время для хищника!"), 500);
    if (newCasts === 1 && hour >= 5 && hour <= 6) setTimeout(() => addTip("🌅 Утренняя зорька — золотое время. Ставь активные приманки!"), 500);
  };

  const doCast = () => { haptic("medium"); playCastSound(); const nc = casts + 1; setCasts(nc); addEvent("cast", `Заброс #${nc} — ${distance}м`); setCastAnim(true); setTimeout(() => setCastAnim(false), 400); checkRecommendations(nc, bites, caught); };
  const doBite = () => { haptic("heavy"); playBiteSound(); const nb = bites + 1; setBites(nb); addEvent("bite", "Поклёвка!"); setBiteAnim(true); setTimeout(() => setBiteAnim(false), 400); checkRecommendations(casts, nb, caught); };
  const doCaught = () => { haptic("heavy"); hapticNotify("success"); playCaughtSound(); const nc2 = caught + 1; setCaught(nc2); addEvent("caught", "Рыба поймана! 🐟"); setCaughtAnim(true); setTimeout(() => setCaughtAnim(false), 400); checkRecommendations(casts, bites, nc2); };

  const fmt = (s) => `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const bph = elapsed > 0 ? (bites / (elapsed / 3600)).toFixed(1) : "0.0";
  const realiz = bites > 0 ? Math.round((caught / bites) * 100) : 0;
  const userName = tg?.initDataUnsafe?.user?.first_name || "рыбак";

  // Add catch
  const saveCatch = (catchData) => {
    const updated = [{ id: Date.now(), ...catchData }, ...catches];
    setCatches(updated);
    storage.set("catches", updated);
  };
  const deleteCatch = (id) => {
    const updated = catches.filter(c => c.id !== id);
    setCatches(updated);
    storage.set("catches", updated);
  };

  // Add gear
  const saveGear = (item) => {
    const updated = [{ id: Date.now(), ...item }, ...gearItems];
    setGearItems(updated);
    storage.set("gear", updated);
  };
  const deleteGear = (id) => {
    const updated = gearItems.filter(g => g.id !== id);
    setGearItems(updated);
    storage.set("gear", updated);
  };

  // Add spot
  const saveSpot = (spot) => {
    const updated = [{ id: Date.now(), ...spot }, ...spots];
    setSpots(updated);
    storage.set("spots", updated);
  };
  const deleteSpot = (id) => {
    const updated = spots.filter(s => s.id !== id);
    setSpots(updated);
    storage.set("spots", updated);
  };

  const wd = { weather, forecast, moon, biteScore, weatherLoading, locationName, currentHour };
  const shared = { catches, gearItems, spots, sessions, saveCatch, deleteCatch, saveGear, deleteGear, saveSpot, deleteSpot };

  return (
    <div style={S.root}>
      <AnimatedBg />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800;900&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes liveDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(0.8)}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,0.4)}70%{box-shadow:0 0 0 10px rgba(74,222,128,0)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        .f0{animation:fadeUp .45s cubic-bezier(.16,1,.3,1) both}
        .f1{animation:fadeUp .45s cubic-bezier(.16,1,.3,1) .06s both}
        .f2{animation:fadeUp .45s cubic-bezier(.16,1,.3,1) .12s both}
        .f3{animation:fadeUp .45s cubic-bezier(.16,1,.3,1) .18s both}
        .f4{animation:fadeUp .45s cubic-bezier(.16,1,.3,1) .24s both}
        .f5{animation:fadeUp .45s cubic-bezier(.16,1,.3,1) .30s both}
        .btn:active{transform:scale(.94)!important;opacity:.8;transition:transform .1s,opacity .1s}
        .btn{transition:transform .2s,opacity .2s}
        ::-webkit-scrollbar{width:0}
        input,select,textarea{font-family:'Manrope',sans-serif;font-size:14px}
        input::placeholder{color:#3a5470}
        select option{background:#0d1e35;color:#e2e8f0}
      `}</style>

      <div style={S.content} key={screen}>
        {screen === SCREENS.home && <HomeScreen go={go} wd={wd} startSession={startSession} userName={userName} shared={shared} />}
        {screen === SCREENS.sessionActive && <ActiveSession {...{ elapsed, casts, bites, caught, events, distance, setDistance, doCast, doBite, doCaught, stopSession, fmt, bph, realiz, castAnim, biteAnim, caughtAnim, back, wd }} />}
        {screen === SCREENS.forecast && <ForecastScreen wd={wd} />}
        {screen === SCREENS.diary && <DiaryScreen go={go} shared={shared} />}
        {screen === SCREENS.addCatch && <AddCatchScreen back={back} saveCatch={saveCatch} weather={weather} locationName={locationName} />}
        {screen === SCREENS.viewCatch && <ViewCatchScreen back={back} catchItem={screenData} deleteCatch={deleteCatch} />}
        {screen === SCREENS.stats && <StatsScreen shared={shared} />}
        {screen === SCREENS.gear && <GearScreen go={go} shared={shared} />}
        {screen === SCREENS.addGear && <AddGearScreen back={back} saveGear={saveGear} />}
        {screen === SCREENS.social && <SocialScreen />}
        {screen === SCREENS.spots && <SpotsScreen go={go} shared={shared} />}
        {screen === SCREENS.addSpot && <AddSpotScreen back={back} saveSpot={saveSpot} locationName={locationName} />}
        {screen === SCREENS.profile && <ProfileScreen shared={shared} userName={userName} go={go} />}
        {screen === SCREENS.tournaments && <TournamentsScreen />}
        {screen === SCREENS.plan && <PlanScreen wd={wd} />}
        {screen === SCREENS.map && <MapScreen shared={shared} go={go} />}
        {screen === SCREENS.friends && <FriendsScreen back={back} />}
      </div>

      {screen !== SCREENS.sessionActive && screen !== SCREENS.map && (
        <div style={S.tabBar}>
          {[
            { k: SCREENS.home, icon: "🏠", label: "Главная" },
            { k: SCREENS.diary, icon: "📖", label: "Дневник" },
            { k: SCREENS.forecast, icon: "🌤", label: "Прогноз" },
            { k: SCREENS.social, icon: "👥", label: "Лента" },
            { k: SCREENS.profile, icon: "👤", label: "Профиль" },
          ].map(t => (
            <button key={t.k} onClick={() => { haptic("light"); setHistory([]); setScreen(t.k); }} className="btn"
              style={{ ...S.tab, color: screen === t.k ? "#4ade80" : "#3a5470" }}>
              <span style={{ fontSize: 20, filter: screen === t.k ? "drop-shadow(0 0 6px rgba(74,222,128,.6))" : "none" }}>{t.icon}</span>
              <span style={{ fontSize: 9, fontWeight: screen === t.k ? 800 : 500, letterSpacing: 0.3 }}>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════
//  HOME SCREEN
// ══════════════════════════════════════════════════
function HomeScreen({ go, wd, startSession, userName, shared }) {
  const { weather, moon, biteScore, weatherLoading, locationName } = wd;
  const { catches = [], sessions = [], gearItems = [], spots = [] } = shared || {};
  const now = new Date();
  const totalWeight = catches.reduce((a, c) => a + (parseFloat(c.weight) || 0), 0).toFixed(1);

  return (
    <div style={{ padding: "0 16px 16px" }}>
      {/* Header */}
      <div className="f0" style={{ padding: "20px 0 8px" }}>
        <div style={{ fontSize: 11, color: "#3a8a6a", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>
          {locationName ? `📍 ${locationName}` : "🎣 Клёвометр"}
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.1 }}>
          <span style={{ background: "linear-gradient(135deg,#4ade80 0%,#22d3ee 50%,#818cf8 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Привет, {userName}!
          </span>
        </div>
        <div style={{ fontSize: 12, color: "#3a5470", marginTop: 4, fontWeight: 500 }}>
          {now.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
        </div>
      </div>

      {/* Start Session — hero button */}
      <button onClick={startSession} className="btn f1" style={{
        width: "100%", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 16,
        padding: "18px 20px", boxSizing: "border-box", marginBottom: 10, borderRadius: 20,
        background: "linear-gradient(135deg,rgba(74,222,128,0.15) 0%,rgba(34,211,238,0.08) 100%)",
        border: "1.5px solid rgba(74,222,128,0.3)", backdropFilter: "blur(20px)",
        boxShadow: "0 8px 32px rgba(74,222,128,0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
        animation: "pulse 3s ease-in-out infinite",
      }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg,#16a34a,#0891b2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0, boxShadow: "0 6px 20px rgba(22,163,74,0.4)" }}>🎣</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 18, color: "#4ade80", letterSpacing: -0.3 }}>Начать рыбалку</div>
          <div style={{ fontSize: 12, color: "#3a7a5a", marginTop: 3, fontWeight: 500 }}>Трекинг · забросы · аналитика</div>
        </div>
        <div style={{ fontSize: 24, color: "rgba(74,222,128,0.6)" }}>›</div>
      </button>

      {/* Bite Score + Weather */}
      <button onClick={() => go(SCREENS.forecast)} className="btn f2" style={{
        width: "100%", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 16,
        padding: "16px 20px", boxSizing: "border-box", marginBottom: 10, borderRadius: 20,
        background: "rgba(10,22,40,0.7)", border: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(20px)", boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
      }}>
        <div style={{ position: "relative", width: 60, height: 60, flexShrink: 0 }}>
          <svg width={60} height={60} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={30} cy={30} r={25} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
            <circle cx={30} cy={30} r={25} fill="none" stroke={getScoreColor(biteScore)} strokeWidth={5}
              strokeDasharray={157.1} strokeDashoffset={157.1 * (1 - biteScore / 100)} strokeLinecap="round" />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: getScoreColor(biteScore) }}>
            {weatherLoading ? "…" : biteScore}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "#3a5470", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5 }}>Прогноз клёва</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: getScoreColor(biteScore), marginTop: 2 }}>{getScoreLabel(biteScore)}</div>
          <div style={{ marginTop: 5, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {weather ? (
              <>
                <span style={{ fontSize: 11, color: "#3a5470" }}>{weatherEmoji(weather.icon)} {weather.temp}°C</span>
                <span style={{ fontSize: 11, color: "#3a5470" }}>💨 {weather.wind}м/с</span>
                <span style={{ fontSize: 11, color: "#3a5470" }}>🌡 {weather.pressure}мм</span>
              </>
            ) : (
              <span style={{ fontSize: 11, color: "#3a5470" }}>{moon.icon} {moon.name}</span>
            )}
          </div>
        </div>
        <div style={{ fontSize: 18, color: "#2a3f55" }}>›</div>
      </button>

      {/* Quick stats */}
      <div className="f3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        {[
          { v: catches.length, l: "уловов", c: "#4ade80", icon: "🐟" },
          { v: `${totalWeight}кг`, l: "поймано", c: "#fbbf24", icon: "⚖️" },
          { v: sessions.length, l: "сессий", c: "#60a5fa", icon: "📊" },
        ].map(s => (
          <div key={s.l} style={{ ...G.glass, padding: "14px 12px", textAlign: "center", borderRadius: 16 }}>
            <div style={{ fontSize: 18 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.c, marginTop: 4 }}>{s.v}</div>
            <div style={{ fontSize: 10, color: "#2a3f55", fontWeight: 600, marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Grid nav */}
      <div className="f4" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[
          { icon: "📖", label: "Дневник", sub: `${catches.length} записей`, screen: SCREENS.diary, color: "#60a5fa" },
          { icon: "📊", label: "Статистика", sub: "Аналитика", screen: SCREENS.stats, color: "#f59e0b" },
          { icon: "🗺", label: "Карта", sub: `${spots.length} меток`, screen: SCREENS.map, color: "#22d3ee" },
          { icon: "🎒", label: "Снаряжение", sub: `${gearItems.length} предметов`, screen: SCREENS.gear, color: "#a78bfa" },
          { icon: "🏆", label: "Турниры", sub: "Соревнования", screen: SCREENS.tournaments, color: "#f97316" },
          { icon: "📅", label: "Планирование", sub: "Календарь", screen: SCREENS.plan, color: "#ec4899" },
        ].map(item => (
          <button key={item.label} onClick={() => { haptic("light"); go(item.screen); }} className="btn"
            style={{ ...G.glass, padding: "14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left", boxSizing: "border-box", borderRadius: 16 }}>
            <div style={{ fontSize: 22, width: 42, height: 42, borderRadius: 12, background: `${item.color}15`, border: `1px solid ${item.color}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{item.icon}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#c8ddf0" }}>{item.label}</div>
              <div style={{ fontSize: 11, color: "#2a4060", marginTop: 2 }}>{item.sub}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Last catch */}
      {catches.length > 0 && (
        <div className="f5" style={{ ...G.glass, marginTop: 10, padding: 16, borderRadius: 20 }}>
          <div style={{ fontSize: 11, color: "#3a5470", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>🐟 Последний улов</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🐟</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{catches[0].fish}</div>
              <div style={{ fontSize: 12, color: "#3a5470", marginTop: 2 }}>{catches[0].location || "—"} · {catches[0].bait || "—"}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 900, fontSize: 17, color: "#4ade80" }}>{catches[0].weight}<span style={{ fontSize: 10, color: "#3a5470" }}> кг</span></div>
              <div style={{ fontSize: 10, color: "#2a3f55" }}>{catches[0].date}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════
//  ACTIVE SESSION
// ══════════════════════════════════════════════════
function ActiveSession({ elapsed, casts, bites, caught, events, distance, setDistance, doCast, doBite, doCaught, stopSession, fmt, bph, realiz, castAnim, biteAnim, caughtAnim, back, wd }) {
  const { weather } = wd;
  return (
    <div style={{ padding: "0 16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0 8px" }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>Рыбалка</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", animation: "liveDot 1.2s infinite" }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: "#4ade80", letterSpacing: 1 }}>LIVE</span>
        </div>
      </div>

      {weather && (
        <div className="f0" style={{ display: "flex", justifyContent: "center", gap: 14, padding: "6px 0 10px", flexWrap: "wrap" }}>
          {[
            `${weatherEmoji(weather.icon)} ${weather.temp}°`,
            `🌡 ${weather.pressure}мм`,
            `💨 ${weather.wind}м/с ${windDir(weather.windDeg)}`,
            `💧 ${weather.humidity}%`,
          ].map(t => <span key={t} style={{ fontSize: 11, color: "#3a5470", fontWeight: 500 }}>{t}</span>)}
        </div>
      )}

      {/* Timer */}
      <div className="f0" style={{ ...G.glass, textAlign: "center", padding: "22px 16px", borderRadius: 24, border: "1px solid rgba(74,222,128,0.2)", marginBottom: 10 }}>
        <div style={{ fontSize: 52, fontWeight: 900, fontFamily: "'Courier New',monospace", letterSpacing: 5, color: "#4ade80", textShadow: "0 0 30px rgba(74,222,128,0.3)" }}>{fmt(elapsed)}</div>
        <div style={{ display: "flex", gap: 28, justifyContent: "center", marginTop: 14 }}>
          {[
            { v: casts, l: "ЗАБРОСОВ", c: "#60a5fa" },
            { v: bites, l: "ПОКЛЁВОК", c: "#fbbf24" },
            { v: caught, l: "ПОЙМАНО", c: "#4ade80" },
          ].map(s => (
            <div key={s.l}>
              <div style={{ fontSize: 26, fontWeight: 900, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 9, color: "#2a3f55", fontWeight: 700, letterSpacing: 1 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Distance */}
      <div className="f1" style={{ ...G.glass, padding: "14px 16px", borderRadius: 16, marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: "#3a5470", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Дистанция: <span style={{ color: "#4ade80" }}>{distance}м</span></div>
        <input type="range" min={5} max={80} value={distance} onChange={e => setDistance(+e.target.value)} style={{ width: "100%", accentColor: "#4ade80", height: 5, cursor: "pointer" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#2a3f55", marginTop: 5 }}>
          <span>5м</span><span>Ближняя</span><span>Средняя</span><span>Дальняя</span><span>80м</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="f2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
        {[
          { fn: doCast, anim: castAnim, icon: "🎯", label: "Заброс", count: casts, color: "#60a5fa", border: "rgba(96,165,250,0.3)" },
          { fn: doBite, anim: biteAnim, icon: "⚡", label: "Поклёвка", count: bites, color: "#fbbf24", border: "rgba(251,191,36,0.3)" },
          { fn: doCaught, anim: caughtAnim, icon: "🐟", label: "Поймал", count: caught, color: "#4ade80", border: "rgba(74,222,128,0.3)" },
        ].map(b => (
          <button key={b.label} onClick={b.fn} className="btn" style={{
            padding: "18px 8px", borderRadius: 18, border: `2px solid ${b.border}`,
            background: `linear-gradient(180deg,${b.color}12,transparent)`,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", flexDirection: "column", alignItems: "center",
            transform: b.anim ? "scale(1.08)" : "scale(1)", transition: "transform .15s",
            boxShadow: b.anim ? `0 0 20px ${b.color}40` : "none",
          }}>
            <span style={{ fontSize: 30 }}>{b.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: b.color, marginTop: 6 }}>{b.label}</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: b.color, marginTop: 2 }}>{b.count}</span>
          </button>
        ))}
      </div>

      {/* Analytics */}
      <div className="f3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        {[
          { l: "ПОКЛЁВКИ/ЧАС", v: bph, c: "#fbbf24" },
          { l: "РЕАЛИЗАЦИЯ", v: `${realiz}%`, c: "#4ade80" },
          { l: "ЗАБРОСОВ/ЧАС", v: elapsed > 0 ? (casts / (elapsed / 3600)).toFixed(1) : "0.0", c: "#60a5fa" },
          { l: "ПОДСЕЧКА", v: `${casts > 0 ? Math.round((bites / casts) * 100) : 0}%`, c: "#f97316" },
        ].map(s => (
          <div key={s.l} style={{ ...G.glass, padding: 12, borderRadius: 14, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#2a3f55", fontWeight: 700, letterSpacing: 1 }}>{s.l}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.c, marginTop: 4 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Event log */}
      {events.length > 0 && (
        <div className="f4" style={{ ...G.glass, padding: 14, borderRadius: 16, marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "#3a5470", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>📋 Лента событий</div>
          <div style={{ maxHeight: 160, overflowY: "auto" }}>
            {events.slice(0, 10).map((ev, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < Math.min(events.length, 10) - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", animation: i === 0 ? "slideDown .3s ease" : "none" }}>
                <span style={{ fontSize: 14 }}>{ev.type === "cast" ? "🎯" : ev.type === "bite" ? "⚡" : ev.type === "tip" ? "💡" : "🐟"}</span>
                <span style={{ flex: 1, fontSize: 12, color: ev.type === "cast" ? "#3a5470" : ev.type === "bite" ? "#fbbf24" : ev.type === "tip" ? "#a78bfa" : "#4ade80", fontWeight: ev.type === "tip" ? 500 : 600, fontStyle: ev.type === "tip" ? "italic" : "normal" }}>{ev.text}</span>
                <span style={{ fontSize: 10, color: "#1a2f45", fontFamily: "monospace" }}>{fmt(ev.t)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={() => { stopSession(); back(); }} className="btn" style={{ width: "100%", padding: 15, borderRadius: 16, border: "1.5px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#ef4444", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
        ⏹ Завершить сессию
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════
//  DIARY SCREEN
// ══════════════════════════════════════════════════
function DiaryScreen({ go, shared }) {
  const { catches } = shared;
  const [filter, setFilter] = useState("all");
  const fishTypes = [...new Set(catches.map(c => c.fish))];
  const filtered = filter === "all" ? catches : catches.filter(c => c.fish === filter);
  const totalWeight = catches.reduce((a, c) => a + (parseFloat(c.weight) || 0), 0).toFixed(1);

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>Дневник улова</div>
        <div style={{ fontSize: 13, color: "#3a5470", marginTop: 2 }}>{catches.length} записей · {totalWeight} кг</div>
      </div>

      <button onClick={() => go(SCREENS.addCatch)} className="btn f1" style={{ width: "100%", padding: 14, borderRadius: 16, border: "none", background: "linear-gradient(135deg,#16a34a,#0891b2)", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", marginBottom: 12, boxShadow: "0 4px 20px rgba(22,163,74,0.3)" }}>
        + Добавить улов
      </button>

      {fishTypes.length > 1 && (
        <div className="f2" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 10 }}>
          {["all", ...fishTypes].map(f => (
            <button key={f} onClick={() => setFilter(f)} className="btn" style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${filter === f ? "#4ade80" : "rgba(255,255,255,0.08)"}`, background: filter === f ? "rgba(74,222,128,0.15)" : "transparent", color: filter === f ? "#4ade80" : "#3a5470", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}>
              {f === "all" ? "Все" : f}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="f3" style={{ textAlign: "center", padding: "40px 0", color: "#2a3f55" }}>
          <div style={{ fontSize: 40 }}>🎣</div>
          <div style={{ marginTop: 12, fontSize: 14 }}>Пока нет уловов</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Добавь первый!</div>
        </div>
      ) : (
        filtered.map((c, i) => (
          <button key={c.id} onClick={() => { haptic("light"); go(SCREENS.viewCatch, c); }} className="btn"
            style={{ ...G.glass, width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: 14, cursor: "pointer", boxSizing: "border-box", borderRadius: 16, marginBottom: 8, animation: `fadeUp .4s ease ${i * 0.05}s both` }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🐟</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{c.fish}</div>
              <div style={{ fontSize: 11, color: "#3a5470", marginTop: 2 }}>{c.location || "—"} · {c.bait || "—"}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 900, fontSize: 17, color: "#4ade80" }}>{c.weight}<span style={{ fontSize: 10, color: "#3a5470" }}> кг</span></div>
              <div style={{ fontSize: 10, color: "#2a3f55", marginTop: 2 }}>{c.date}</div>
            </div>
          </button>
        ))
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════
//  ADD CATCH SCREEN
// ══════════════════════════════════════════════════
function AddCatchScreen({ back, saveCatch, weather, locationName }) {
  const [form, setForm] = useState({
    fish: "", weight: "", length: "", location: locationName || "",
    bait: "", gear: "", notes: "",
    date: new Date().toLocaleDateString("ru-RU"),
    weather: weather ? `${weather.temp}°C, ${weather.pressure}мм, ветер ${weather.wind}м/с` : "",
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.fish) { hapticNotify("error"); return; }
    saveCatch(form);
    hapticNotify("success");
    back();
  };

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Добавить улов</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Вид рыбы *">
          <select value={form.fish} onChange={e => set("fish", e.target.value)} style={S.input}>
            <option value="">Выбери рыбу</option>
            {FISH_LIST.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Вес (кг)">
            <input type="number" step="0.1" placeholder="0.0" value={form.weight} onChange={e => set("weight", e.target.value)} style={S.input} />
          </Field>
          <Field label="Длина (см)">
            <input type="number" placeholder="0" value={form.length} onChange={e => set("length", e.target.value)} style={S.input} />
          </Field>
        </div>

        <Field label="Место">
          <input type="text" placeholder="Название водоёма" value={form.location} onChange={e => set("location", e.target.value)} style={S.input} />
        </Field>

        <Field label="Приманка / наживка">
          <select value={form.bait} onChange={e => set("bait", e.target.value)} style={S.input}>
            <option value="">Выбери приманку</option>
            {BAITS_LIST.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </Field>

        <Field label="Снасть">
          <input type="text" placeholder="Например: спиннинг 2.4м" value={form.gear} onChange={e => set("gear", e.target.value)} style={S.input} />
        </Field>

        <Field label="Погода">
          <input type="text" placeholder="Авто или введи вручную" value={form.weather} onChange={e => set("weather", e.target.value)} style={S.input} />
        </Field>

        <Field label="Заметки">
          <textarea placeholder="Поведение рыбы, особенности..." value={form.notes} onChange={e => set("notes", e.target.value)}
            style={{ ...S.input, resize: "none", minHeight: 72 }} />
        </Field>
      </div>

      <button onClick={handleSave} className="btn" style={{ width: "100%", padding: 15, borderRadius: 16, border: "none", background: "linear-gradient(135deg,#16a34a,#0891b2)", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer", fontFamily: "inherit", marginTop: 14, boxShadow: "0 4px 20px rgba(22,163,74,0.3)" }}>
        💾 Сохранить улов
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════
//  VIEW CATCH SCREEN
// ══════════════════════════════════════════════════
function ViewCatchScreen({ back, catchItem, deleteCatch }) {
  if (!catchItem) return null;
  const handleDelete = () => {
    hapticNotify("warning");
    deleteCatch(catchItem.id);
    back();
  };
  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Карточка улова</div>
      </div>
      <div className="f1" style={{ ...G.glass, borderRadius: 20, overflow: "hidden", marginBottom: 10 }}>
        <div style={{ height: 140, background: "linear-gradient(135deg,rgba(22,163,74,0.15),rgba(8,145,178,0.1))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64 }}>🐟</div>
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{catchItem.fish}</div>
            <div style={{ padding: "4px 12px", borderRadius: 20, background: "rgba(74,222,128,0.12)", color: "#4ade80", fontSize: 13, fontWeight: 700 }}>🏆 Улов</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { l: "Вес", v: catchItem.weight ? `${catchItem.weight} кг` : "—", c: "#fbbf24" },
              { l: "Длина", v: catchItem.length ? `${catchItem.length} см` : "—", c: "#22d3ee" },
              { l: "Дата", v: catchItem.date, c: "#a78bfa" },
              { l: "Место", v: catchItem.location || "—", c: "#60a5fa" },
              { l: "Приманка", v: catchItem.bait || "—", c: "#4ade80" },
              { l: "Снасть", v: catchItem.gear || "—", c: "#f97316" },
            ].map(s => (
              <div key={s.l} style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: 10, color: "#2a3f55", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.l}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: s.c, marginTop: 3 }}>{s.v}</div>
              </div>
            ))}
          </div>
          {catchItem.weather && (
            <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 10, color: "#2a3f55", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Погода</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#6b8aad", marginTop: 3 }}>🌤 {catchItem.weather}</div>
            </div>
          )}
          {catchItem.notes && (
            <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 10, color: "#2a3f55", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Заметки</div>
              <div style={{ fontSize: 13, color: "#6b8aad", marginTop: 3 }}>{catchItem.notes}</div>
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => {
          haptic("medium");
          const text = `🐟 ${catchItem.fish}${catchItem.weight ? ` ${catchItem.weight}кг` : ""}${catchItem.location ? `\n📍 ${catchItem.location}` : ""}${catchItem.bait ? `\n🎣 ${catchItem.bait}` : ""}\n\n🎣 Клёвометр`;
          if (tg) {
            tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent("https://t.me/KlevometrBot/app")}&text=${encodeURIComponent(text)}`);
          } else {
            navigator.clipboard?.writeText(text);
          }
        }} className="btn" style={{ flex: 1, padding: 14, borderRadius: 16, border: "1.5px solid rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.07)", color: "#60a5fa", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
          📤 Поделиться
        </button>
        <button onClick={handleDelete} className="btn" style={{ flex: 1, padding: 14, borderRadius: 16, border: "1.5px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.07)", color: "#ef4444", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
          🗑 Удалить
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
//  FORECAST SCREEN
// ══════════════════════════════════════════════════
function ForecastScreen({ wd }) {
  const { weather, forecast, moon, biteScore, weatherLoading, locationName, currentHour } = wd;
  const hourlyScores = useMemo(() => Array.from({ length: 20 }, (_, i) => {
    const h = i + 4;
    return { h, score: computeBiteScore(weather, moon, h) };
  }), [weather, moon]);
  const bestHour = hourlyScores.reduce((a, b) => a.score > b.score ? a : b, { h: 6, score: 0 });

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
      const fakeW = { pressure: avgPressure, wind: avgWind, clouds: 50 };
      const dayMoon = getMoonPhase(new Date(date));
      const maxScore = Math.max(computeBiteScore(fakeW, dayMoon, 7), computeBiteScore(fakeW, dayMoon, 19));
      const dt = new Date(date);
      return {
        label: i === 0 ? "Сегодня" : i === 1 ? "Завтра" : dt.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric" }),
        temp: avgTemp, pressure: avgPressure, wind: avgWind, maxScore, moon: dayMoon, icon: d.icons[Math.floor(d.icons.length / 2)],
      };
    });
  }, [forecast]);

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>Прогноз клёва</div>
        <div style={{ fontSize: 13, color: "#3a5470", marginTop: 2 }}>
          {weather ? `${weather.cityName} · реальные данные` : weatherLoading ? "Загрузка..." : "Нет данных"}
        </div>
      </div>

      {/* Main score */}
      <div className="f1" style={{ ...G.glass, textAlign: "center", padding: "24px 20px", borderRadius: 24, marginBottom: 10 }}>
        {weatherLoading ? (
          <div style={{ padding: 20, color: "#3a5470" }}>⏳ Загрузка...</div>
        ) : (
          <>
            <div style={{ position: "relative", width: 110, height: 110, margin: "0 auto 14px" }}>
              <svg width={110} height={110} style={{ transform: "rotate(-90deg)" }}>
                <circle cx={55} cy={55} r={46} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={7} />
                <circle cx={55} cy={55} r={46} fill="none" stroke={getScoreColor(biteScore)} strokeWidth={7}
                  strokeDasharray={289.0} strokeDashoffset={289.0 * (1 - biteScore / 100)} strokeLinecap="round" />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 34, fontWeight: 900, color: getScoreColor(biteScore) }}>{biteScore}</span>
                <span style={{ fontSize: 10, color: "#3a5470" }}>%</span>
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: getScoreColor(biteScore) }}>{getScoreLabel(biteScore)} клёв</div>
            <div style={{ fontSize: 13, color: "#3a5470", marginTop: 6 }}>Лучшее время: <strong style={{ color: "#e2e8f0" }}>{bestHour.h}:00</strong> ({bestHour.score}%)</div>
            {weather && <div style={{ fontSize: 12, color: "#2a3f55", marginTop: 6 }}>{weatherEmoji(weather.icon)} {weather.description}</div>}
          </>
        )}
      </div>

      {/* Conditions grid */}
      <div className="f2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        {[
          { l: "Давление", v: weather?.pressure || "—", u: "мм рт.ст.", c: "#60a5fa" },
          { l: "Температура", v: weather?.temp || "—", u: "°C", c: "#f97316" },
          { l: "Ветер", v: weather ? `${weather.wind} ${windDir(weather.windDeg)}` : "—", u: "м/с", c: "#6b8aad" },
          { l: "Темп. воды ≈", v: weather?.waterTemp || "—", u: "°C", c: "#22d3ee" },
        ].map(s => (
          <div key={s.l} style={{ ...G.glass, padding: 12, borderRadius: 14, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#2a3f55", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>{s.l}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.c, marginTop: 4 }}>{s.v}<span style={{ fontSize: 10, color: "#2a3f55", fontWeight: 400 }}> {s.u}</span></div>
          </div>
        ))}
      </div>

      {/* Moon */}
      <div className="f3" style={{ ...G.glass, display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, marginBottom: 10 }}>
        <span style={{ fontSize: 38 }}>{moon.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: "#2a3f55", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Лунная фаза</div>
          <div style={{ fontSize: 17, fontWeight: 800, marginTop: 3 }}>{moon.name}</div>
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#fbbf24" }}>{Math.round(moon.factor * 100)}%</div>
      </div>

      {/* Hourly */}
      <div className="f4" style={{ ...G.glass, padding: 16, borderRadius: 16, marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: "#2a3f55", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>По часам</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 70 }}>
          {hourlyScores.map(h => {
            const isCur = h.h === currentHour;
            return (
              <div key={h.h} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ width: "100%", height: `${h.score * 0.62}px`, minHeight: 3, background: getForecastColor(h.score), borderRadius: 3, opacity: isCur ? 1 : 0.5, boxShadow: isCur ? `0 0 8px ${getForecastColor(h.score)}` : "none" }} />
                {(h.h % 4 === 0 || isCur) && <span style={{ fontSize: 8, color: isCur ? "#e2e8f0" : "#2a3f55", fontWeight: isCur ? 800 : 400 }}>{h.h}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5-day */}
      {dailyForecast && (
        <div className="f5" style={{ ...G.glass, padding: 16, borderRadius: 16, marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "#2a3f55", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>5 дней</div>
          {dailyForecast.map((d, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < dailyForecast.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <span style={{ width: 60, fontSize: 13, fontWeight: i === 0 ? 800 : 500, color: i === 0 ? "#e2e8f0" : "#3a5470" }}>{d.label}</span>
              <span style={{ fontSize: 15 }}>{weatherEmoji(d.icon)}</span>
              <span style={{ fontSize: 15 }}>{d.moon.icon}</span>
              <span style={{ flex: 1, fontSize: 12, color: "#3a5470" }}>{d.temp}° · {d.wind}м/с</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: getScoreColor(d.maxScore) }}>{d.maxScore}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Tips */}
      <div style={{ ...G.glass, padding: 16, borderRadius: 16, border: "1px solid rgba(74,222,128,0.15)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#4ade80", marginBottom: 8 }}>💡 Рекомендации</div>
        <div style={{ fontSize: 13, color: "#3a5470", lineHeight: 1.7 }}>
          {biteScore >= 70 ? "Отличные условия! Активные приманки — воблеры, блёсны. Хищник активен утром и вечером."
            : biteScore >= 45 ? "Умеренный клёв. Натуральные наживки, медленная проводка. Перепады глубин."
              : "Слабая активность. Мелкие приманки, деликатная оснастка. Глубина и укрытия."}
        </div>
      </div>
    </div>
  );
}

// helper for forecast color (same logic)
function getForecastColor(s) { return s >= 70 ? "#4ade80" : s >= 45 ? "#fbbf24" : s >= 25 ? "#f97316" : "#ef4444"; }

// ══════════════════════════════════════════════════
//  STATS SCREEN
// ══════════════════════════════════════════════════
function StatsScreen({ shared }) {
  const { catches = [], sessions = [], gearItems = [], spots = [] } = shared || {};
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
      <div className="f0" style={{ padding: "16px 0" }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>Статистика</div>
      </div>

      <div className="f1" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        {[
          { l: "Уловов", v: catches.length, c: "#60a5fa" },
          { l: "Общий вес", v: `${totalWeight}кг`, c: "#fbbf24" },
          { l: "Сессий", v: sessions.length, c: "#4ade80" },
        ].map(s => (
          <div key={s.l} style={{ ...G.glass, padding: 12, borderRadius: 14, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: 9, color: "#2a3f55", fontWeight: 700, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {catches.length === 0 ? (
        <div className="f2" style={{ textAlign: "center", padding: "40px 0", color: "#2a3f55" }}>
          <div style={{ fontSize: 40 }}>📊</div>
          <div style={{ marginTop: 12, fontSize: 14 }}>Нет данных пока</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Добавь улов в дневнике</div>
        </div>
      ) : (
        <>
          {maxCatch.fish && (
            <div className="f2" style={{ ...G.glass, padding: 16, borderRadius: 16, marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "#2a3f55", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>🏆 Рекордный улов</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 28 }}>🐟</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{maxCatch.fish}</div>
                  <div style={{ fontSize: 12, color: "#3a5470" }}>{maxCatch.location || "—"} · {maxCatch.date}</div>
                </div>
                <div style={{ fontWeight: 900, fontSize: 22, color: "#fbbf24" }}>{maxCatch.weight}<span style={{ fontSize: 11, color: "#3a5470" }}> кг</span></div>
              </div>
            </div>
          )}

          {topFish.length > 0 && (
            <div className="f3" style={{ ...G.glass, padding: 16, borderRadius: 16, marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "#2a3f55", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>По видам рыб</div>
              {topFish.slice(0, 5).map(([fish, count]) => (
                <div key={fish} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{fish}</span>
                    <span style={{ fontSize: 12, color: "#3a5470" }}>{count} шт</span>
                  </div>
                  <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 3 }}>
                    <div style={{ height: "100%", width: `${(count / topFish[0][1]) * 100}%`, background: "linear-gradient(90deg,#4ade80,#22d3ee)", borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {topBaits.length > 0 && (
            <div className="f4" style={{ ...G.glass, padding: 16, borderRadius: 16, marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "#2a3f55", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>🎣 Топ приманки</div>
              {topBaits.map(([bait, count], i) => (
                <div key={bait} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < topBaits.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(74,222,128,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: "#4ade80" }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{bait}</span>
                  <span style={{ fontSize: 13, color: "#3a5470" }}>{count} улов.</span>
                </div>
              ))}
            </div>
          )}

          <div className="f5" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ ...G.glass, padding: 12, borderRadius: 14, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#2a3f55", fontWeight: 700 }}>НА СЕССИЮ</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#a78bfa", marginTop: 4 }}>{avgPerSession}</div>
              <div style={{ fontSize: 10, color: "#2a3f55" }}>уловов/сессия</div>
            </div>
            <div style={{ ...G.glass, padding: 12, borderRadius: 14, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#2a3f55", fontWeight: 700 }}>ВРЕМЯ НА ВОДЕ</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#f97316", marginTop: 4 }}>{Math.round(totalSessionTime / 3600)}ч</div>
              <div style={{ fontSize: 10, color: "#2a3f55" }}>всего</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════
//  GEAR SCREEN
// ══════════════════════════════════════════════════
function GearScreen({ go, shared }) {
  const { gearItems, deleteGear } = shared;

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>Снаряжение</div>
        <div style={{ fontSize: 13, color: "#3a5470", marginTop: 2 }}>{gearItems.length} предметов</div>
      </div>

      <button onClick={() => go(SCREENS.addGear)} className="btn f1" style={{ width: "100%", padding: 14, borderRadius: 16, border: "none", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", marginBottom: 12, boxShadow: "0 4px 20px rgba(124,58,237,0.3)" }}>
        + Добавить снаряжение
      </button>

      {gearItems.length === 0 ? (
        <div className="f2" style={{ textAlign: "center", padding: "40px 0", color: "#2a3f55" }}>
          <div style={{ fontSize: 40 }}>🎒</div>
          <div style={{ marginTop: 12, fontSize: 14 }}>Инвентарь пуст</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Добавь первый предмет!</div>
        </div>
      ) : (
        gearItems.map((g, i) => (
          <div key={g.id} style={{ ...G.glass, display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, marginBottom: 8, animation: `fadeUp .4s ease ${i * 0.05}s both` }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
              {g.type === "Удилище" ? "🎋" : g.type === "Катушка" ? "🎡" : g.type === "Приманка" ? "🐛" : g.type === "Эхолот" ? "📡" : "🎒"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{g.name}</div>
              <div style={{ fontSize: 11, color: "#3a5470", marginTop: 2 }}>{g.type}{g.brand ? ` · ${g.brand}` : ""}</div>
            </div>
            <button onClick={() => { haptic("light"); deleteGear(g.id); }} className="btn" style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.2)", background: "transparent", color: "#ef4444", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
          </div>
        ))
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════
//  ADD GEAR SCREEN
// ══════════════════════════════════════════════════
function AddGearScreen({ back, saveGear }) {
  const [form, setForm] = useState({ name: "", type: "", brand: "", notes: "" });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const handleSave = () => {
    if (!form.name) { hapticNotify("error"); return; }
    saveGear(form);
    hapticNotify("success");
    back();
  };
  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Добавить снаряжение</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Название *">
          <input type="text" placeholder="Например: Shimano Stradic 2500" value={form.name} onChange={e => set("name", e.target.value)} style={S.input} />
        </Field>
        <Field label="Тип">
          <select value={form.type} onChange={e => set("type", e.target.value)} style={S.input}>
            <option value="">Выбери тип</option>
            {GEAR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Бренд">
          <input type="text" placeholder="Shimano, Daiwa, Abu Garcia..." value={form.brand} onChange={e => set("brand", e.target.value)} style={S.input} />
        </Field>
        <Field label="Заметки">
          <textarea placeholder="Характеристики, особенности..." value={form.notes} onChange={e => set("notes", e.target.value)} style={{ ...S.input, resize: "none", minHeight: 72 }} />
        </Field>
      </div>
      <button onClick={handleSave} className="btn" style={{ width: "100%", padding: 15, borderRadius: 16, border: "none", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer", fontFamily: "inherit", marginTop: 14, boxShadow: "0 4px 20px rgba(124,58,237,0.3)" }}>
        💾 Сохранить
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════
//  SPOTS SCREEN
// ══════════════════════════════════════════════════
function SpotsScreen({ go, shared }) {
  const { spots = [], deleteSpot = ()=>{} } = shared || {};
  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>Мои места</div>
        <div style={{ fontSize: 13, color: "#3a5470", marginTop: 2 }}>{spots.length} точек</div>
      </div>
      <button onClick={() => go(SCREENS.addSpot)} className="btn f1" style={{ width: "100%", padding: 14, borderRadius: 16, border: "none", background: "linear-gradient(135deg,#0891b2,#0e7490)", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", marginBottom: 12, boxShadow: "0 4px 20px rgba(8,145,178,0.3)" }}>
        + Добавить место
      </button>
      {spots.length === 0 ? (
        <div className="f2" style={{ textAlign: "center", padding: "40px 0", color: "#2a3f55" }}>
          <div style={{ fontSize: 40 }}>🗺</div>
          <div style={{ marginTop: 12, fontSize: 14 }}>Мест пока нет</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Добавь первую точку!</div>
        </div>
      ) : (
        spots.map((s, i) => (
          <div key={s.id} style={{ ...G.glass, display: "flex", gap: 12, padding: 14, borderRadius: 16, marginBottom: 8, animation: `fadeUp .4s ease ${i * 0.05}s both` }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
              {s.type === "Река" ? "🌊" : s.type === "Озеро" ? "🏞️" : s.type === "Пруд" ? "🏕️" : s.type === "Водохранилище" ? "💧" : "📍"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{s.name}</div>
              <div style={{ fontSize: 11, color: "#3a5470", marginTop: 2 }}>{s.type || "—"}{s.fish ? ` · ${s.fish}` : ""}</div>
              {s.notes && <div style={{ fontSize: 11, color: "#2a3f55", marginTop: 3 }}>{s.notes}</div>}
            </div>
            <button onClick={() => { haptic("light"); deleteSpot(s.id); }} className="btn" style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.2)", background: "transparent", color: "#ef4444", fontSize: 14, cursor: "pointer", fontFamily: "inherit", alignSelf: "flex-start" }}>✕</button>
          </div>
        ))
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════
//  ADD SPOT SCREEN
// ══════════════════════════════════════════════════
function AddSpotScreen({ back, saveSpot, locationName }) {
  const [form, setForm] = useState({ name: "", type: "", fish: "", notes: "" });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const handleSave = () => {
    if (!form.name) { hapticNotify("error"); return; }
    saveSpot(form);
    hapticNotify("success");
    back();
  };
  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Добавить место</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Field label="Название *">
          <input type="text" placeholder="Озеро Тихое, Река Ока..." value={form.name} onChange={e => set("name", e.target.value)} style={S.input} />
        </Field>
        <Field label="Тип водоёма">
          <select value={form.type} onChange={e => set("type", e.target.value)} style={S.input}>
            <option value="">Выбери тип</option>
            {["Река","Озеро","Пруд","Водохранилище","Карьер","Море","Канал"].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Какая рыба водится">
          <input type="text" placeholder="Щука, окунь, карп..." value={form.fish} onChange={e => set("fish", e.target.value)} style={S.input} />
        </Field>
        <Field label="Заметки">
          <textarea placeholder="Особенности места, секреты..." value={form.notes} onChange={e => set("notes", e.target.value)} style={{ ...S.input, resize: "none", minHeight: 72 }} />
        </Field>
      </div>
      <button onClick={handleSave} className="btn" style={{ width: "100%", padding: 15, borderRadius: 16, border: "none", background: "linear-gradient(135deg,#0891b2,#0e7490)", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer", fontFamily: "inherit", marginTop: 14, boxShadow: "0 4px 20px rgba(8,145,178,0.3)" }}>
        💾 Сохранить место
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════
//  SOCIAL SCREEN
// ══════════════════════════════════════════════════
function SocialScreen() {
  const catches = storage.get("catches", []);
  const friends = storage.get("friends", []);
  const privacy = storage.get("privacy", "public");
  const un = tg?.initDataUnsafe?.user?.first_name || "Я";

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>Лента</div>
        <div style={{ fontSize: 13, color: "#3a5470", marginTop: 2 }}>
          {catches.length > 0 ? `${catches.length} записей` : "Пока пусто — добавь первый улов"}
        </div>
      </div>

      {privacy === "ghost" && (
        <div style={{ ...G.glass, padding: 14, borderRadius: 14, marginBottom: 12, borderColor: "rgba(239,68,68,0.2)" }}>
          <div style={{ fontSize: 13, color: "#ef4444", fontWeight: 700 }}>👻 Режим «Невидимка» активен</div>
          <div style={{ fontSize: 12, color: "#3a5470", marginTop: 4 }}>Твои уловы не видны другим пользователям</div>
        </div>
      )}

      {catches.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 20px", color: "#2a3f55" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎣</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Лента пуста</div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>Когда ты или твои друзья добавят уловы, они появятся здесь</div>
        </div>
      ) : (
        catches.slice(0, 20).map((c, i) => (
          <div key={c.id || i} style={{ ...G.glass, padding: 16, borderRadius: 20, marginBottom: 10, animation: `fadeUp .4s ease ${i * 0.05}s both` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#16a34a,#0891b2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, border: "1.5px solid rgba(74,222,128,0.3)", fontWeight: 800, color: "#fff" }}>
                {un.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{un}</div>
                <div style={{ fontSize: 11, color: "#2a3f55" }}>{c.date || "—"} {c.time || ""}</div>
              </div>
            </div>
            <div style={{ padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", marginBottom: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>🐟 {c.fish || "—"} {c.weight ? `${c.weight} кг` : ""}</div>
              {c.location && <div style={{ fontSize: 12, color: "#3a5470", marginTop: 4 }}>📍 {c.location}</div>}
              {c.bait && <div style={{ fontSize: 12, color: "#3a5470", marginTop: 2 }}>🎣 {c.bait}</div>}
              {c.weather && <div style={{ fontSize: 12, color: "#3a5470", marginTop: 2 }}>{c.weather}</div>}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════
//  PROFILE SCREEN
// ══════════════════════════════════════════════════
function ProfileScreen({ shared, userName, go }) {
  const { catches = [], sessions = [], gearItems = [], spots = [] } = shared || {};
  const totalWeight = catches.reduce((a, c) => a + (parseFloat(c.weight) || 0), 0).toFixed(1);
  const maxCatch = catches.reduce((a, c) => (parseFloat(c.weight) || 0) > (parseFloat(a.weight) || 0) ? c : a, { weight: 0 });
  const un = tg?.initDataUnsafe?.user?.first_name || userName || "FisherPro";
  const uh = tg?.initDataUnsafe?.user?.username || "fisherpro";

  const [privacy, setPrivacy] = useState(() => storage.get("privacy", "public"));
  const [friends, setFriends] = useState(() => storage.get("friends", []));

  const privacyModes = [
    { key: "public", icon: "🌍", label: "Общедоступный", desc: "Все видят уловы и геолокацию", color: "#4ade80" },
    { key: "private", icon: "🔒", label: "Приватный", desc: "Только друзья видят", color: "#fbbf24" },
    { key: "ghost", icon: "👻", label: "Невидимка", desc: "Никто не видит, я вижу всех", color: "#ef4444" },
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
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg,#16a34a,#0891b2)", margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, border: "3px solid rgba(74,222,128,0.4)", boxShadow: "0 0 30px rgba(74,222,128,0.2)" }}>🎣</div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>{un}</div>
        <div style={{ fontSize: 13, color: "#3a5470", marginTop: 3 }}>@{uh}</div>
        <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 14px", borderRadius: 20, background: `${privacyModes.find(m => m.key === privacy).color}15`, border: `1px solid ${privacyModes.find(m => m.key === privacy).color}30` }}>
          <span style={{ fontSize: 14 }}>{privacyModes.find(m => m.key === privacy).icon}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: privacyModes.find(m => m.key === privacy).color }}>{privacyModes.find(m => m.key === privacy).label}</span>
        </div>
      </div>

      <div className="f1" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        {[
          { l: "Уловов", v: catches.length, c: "#4ade80" },
          { l: "Общий вес", v: `${totalWeight}кг`, c: "#fbbf24" },
          { l: "Друзей", v: friends.length, c: "#60a5fa" },
        ].map(s => (
          <div key={s.l} style={{ ...G.glass, padding: 12, borderRadius: 14, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: 10, color: "#2a3f55", marginTop: 3, fontWeight: 600 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Friends button */}
      <button onClick={() => go(SCREENS.friends)} className="btn f2" style={{ ...G.glass, width: "100%", padding: 16, borderRadius: 16, marginBottom: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 14, textAlign: "left", boxSizing: "border-box" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(96,165,250,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>👥</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Друзья</div>
          <div style={{ fontSize: 12, color: "#3a5470", marginTop: 2 }}>{friends.length > 0 ? `${friends.length} друзей` : "Добавить по @username"}</div>
        </div>
        <span style={{ color: "#3a5470", fontSize: 18 }}>›</span>
      </button>

      {/* Privacy settings */}
      <div className="f3" style={{ ...G.glass, padding: 16, borderRadius: 16, marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: "#2a3f55", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>🔐 Приватность</div>
        {privacyModes.map(m => (
          <button key={m.key} onClick={() => setPrivacyMode(m.key)} className="btn" style={{
            width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
            borderRadius: 12, marginBottom: 6, cursor: "pointer", textAlign: "left",
            background: privacy === m.key ? `${m.color}10` : "rgba(255,255,255,0.02)",
            border: `1.5px solid ${privacy === m.key ? `${m.color}40` : "rgba(255,255,255,0.04)"}`,
            transition: "all .2s",
          }}>
            <span style={{ fontSize: 24 }}>{m.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: privacy === m.key ? m.color : "#d8eaf8" }}>{m.label}</div>
              <div style={{ fontSize: 11, color: "#3a5470", marginTop: 2 }}>{m.desc}</div>
            </div>
            <div style={{
              width: 22, height: 22, borderRadius: "50%",
              border: `2px solid ${privacy === m.key ? m.color : "#2a3f55"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {privacy === m.key && <div style={{ width: 12, height: 12, borderRadius: "50%", background: m.color }} />}
            </div>
          </button>
        ))}
      </div>

      {/* Achievements */}
      <div className="f4" style={{ ...G.glass, padding: 16, borderRadius: 16, marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: "#2a3f55", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>🏅 Достижения</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {achievements.map(a => (
            <div key={a.label} style={{ textAlign: "center", padding: "10px 6px", borderRadius: 12, background: a.earned ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${a.earned ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.04)"}`, opacity: a.earned ? 1 : 0.35 }}>
              <div style={{ fontSize: 22 }}>{a.icon}</div>
              <div style={{ fontSize: 10, color: a.earned ? "#4ade80" : "#2a3f55", marginTop: 4, fontWeight: 600, lineHeight: 1.3 }}>{a.label}</div>
            </div>
          ))}
        </div>
      </div>

      {maxCatch.fish && (
        <div className="f5" style={{ ...G.glass, padding: 16, borderRadius: 16 }}>
          <div style={{ fontSize: 11, color: "#2a3f55", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>🏆 Лучший трофей</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 28 }}>🐟</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{maxCatch.fish}</div>
              <div style={{ fontSize: 12, color: "#3a5470" }}>{maxCatch.location || "—"}</div>
            </div>
            <div style={{ fontWeight: 900, fontSize: 22, color: "#fbbf24" }}>{maxCatch.weight}<span style={{ fontSize: 11, color: "#3a5470" }}>кг</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════
//  FRIENDS SCREEN
// ══════════════════════════════════════════════════
function FriendsScreen({ back }) {
  const [friends, setFriends] = useState(() => storage.get("friends", []));
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);

  const addFriend = () => {
    const username = input.trim().replace(/^@/, "");
    if (!username || friends.some(f => f.username === username)) return;
    hapticNotify("success");
    const updated = [...friends, { username, addedAt: Date.now(), displayName: username }];
    setFriends(updated);
    storage.set("friends", updated);
    setInput("");
    setAdding(false);
  };

  const removeFriend = (username) => {
    haptic("medium");
    const updated = friends.filter(f => f.username !== username);
    setFriends(updated);
    storage.set("friends", updated);
  };

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>Друзья</div>
        <div style={{ fontSize: 13, color: "#3a5470", marginTop: 2 }}>{friends.length} друзей</div>
      </div>

      {/* Add friend */}
      {adding ? (
        <div className="f1" style={{ ...G.glass, padding: 16, borderRadius: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "#2a3f55", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Добавить по Telegram</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="@username"
              onKeyDown={e => e.key === "Enter" && addFriend()}
              style={{ ...S.input, flex: 1 }} autoFocus />
            <button onClick={addFriend} className="btn" style={{ padding: "10px 18px", borderRadius: 12, background: "linear-gradient(135deg,#4ade80,#22c55e)", color: "#fff", fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>+</button>
          </div>
          <button onClick={() => setAdding(false)} className="btn" style={{ marginTop: 8, background: "none", border: "none", color: "#3a5470", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>Отмена</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="btn f1" style={{ width: "100%", padding: 14, borderRadius: 14, background: "linear-gradient(135deg,rgba(96,165,250,0.1),rgba(96,165,250,0.03))", border: "1.5px solid rgba(96,165,250,0.2)", color: "#60a5fa", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}>
          + Добавить друга
        </button>
      )}

      {/* Friends list */}
      {friends.map((f, i) => (
        <div key={f.username} className={`f${Math.min(i + 2, 5)}`} style={{ ...G.glass, padding: 14, borderRadius: 14, marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#1e3a5f,#0d2240)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
            {f.displayName.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>@{f.username}</div>
            <div style={{ fontSize: 11, color: "#3a5470", marginTop: 2 }}>Добавлен {new Date(f.addedAt).toLocaleDateString("ru-RU")}</div>
          </div>
          <button onClick={() => removeFriend(f.username)} className="btn" style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18, padding: 4 }}>✕</button>
        </div>
      ))}

      {friends.length === 0 && !adding && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#2a3f55" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>Добавь друзей по @username<br/>чтобы видеть их уловы и соревноваться</div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════
//  MAP SCREEN (Leaflet + OpenStreetMap + свои метки)
// ══════════════════════════════════════════════════
function MapScreen({ shared, go }) {
  const { spots = [], saveSpot = ()=>{}, deleteSpot = ()=>{} } = shared || {};
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [weatherLayer, setWeatherLayer] = useState("none"); // none | precipitation | temp | clouds
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const markersRef = useRef([]);
  const weatherLayerRef = useRef(null);

  // Load Leaflet
  useEffect(() => {
    if (window.L) { setMapReady(true); return; }
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    js.onload = () => setMapReady(true);
    document.head.appendChild(js);
  }, []);

  // Init map
  useEffect(() => {
    if (!mapReady || !mapRef.current || mapInstance.current) return;
    const L = window.L;
    const map = L.map(mapRef.current, { center: [55.75, 37.62], zoom: 10, zoomControl: false, attributionControl: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    navigator.geolocation?.getCurrentPosition(
      (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 12), () => {}, { timeout: 5000 }
    );
    map.on("click", (e) => {
      if (!window._klevometrAddMode) return;
      const name = prompt("Название метки:");
      if (!name) return;
      const depth = prompt("Глубина (м):");
      const note = prompt("Тип (яма / коряжник / стоянка / бровка):");
      saveSpot({ name, lat: e.latlng.lat, lng: e.latlng.lng, depth: depth || "", note: note || "", date: new Date().toLocaleDateString("ru-RU") });
      window._klevometrAddMode = false;
      setAddMode(false);
    });
    mapInstance.current = map;
    return () => { map.remove(); mapInstance.current = null; };
  }, [mapReady]);

  // Sync markers
  useEffect(() => {
    if (!mapInstance.current || !window.L) return;
    const L = window.L; const map = mapInstance.current;
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
    spots.forEach(spot => {
      if (!spot.lat || !spot.lng) return;
      const icon = L.divIcon({ className: "", html: `<div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#4ade80,#22c55e);display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 10px rgba(34,197,94,.5);border:2px solid rgba(255,255,255,.4)">📍</div>`, iconSize: [30, 30], iconAnchor: [15, 30] });
      const marker = L.marker([spot.lat, spot.lng], { icon }).addTo(map);
      marker.bindPopup(`<div style="font-family:sans-serif;min-width:130px"><b>${spot.name}</b>${spot.depth ? `<br>↓ ${spot.depth}м` : ""}${spot.note ? `<br>📝 ${spot.note}` : ""}<br><small>${spot.date || ""}</small></div>`);
      markersRef.current.push(marker);
    });
  }, [spots, mapReady]);

  const toggleAdd = () => { const next = !addMode; setAddMode(next); window._klevometrAddMode = next; if (next) hapticNotify("success"); };

  // OWM weather tile layer
  useEffect(() => {
    if (!mapInstance.current || !window.L) return;
    const L = window.L; const map = mapInstance.current;
    // Remove old weather layer
    if (weatherLayerRef.current) { map.removeLayer(weatherLayerRef.current); weatherLayerRef.current = null; }
    // Add new weather layer if selected
    if (weatherLayer !== "none" && OWM_API_KEY && OWM_API_KEY !== "YOUR_API_KEY_HERE") {
      weatherLayerRef.current = L.tileLayer(
        `https://tile.openweathermap.org/map/${weatherLayer}/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`,
        { maxZoom: 18, opacity: 0.6 }
      ).addTo(map);
    }
  }, [weatherLayer, mapReady]);

  // Search location via Nominatim (free geocoding)
  const searchLocation = async () => {
    if (!searchQuery.trim() || !mapInstance.current) return;
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1&accept-language=ru`);
      const data = await res.json();
      if (data.length > 0) {
        mapInstance.current.setView([parseFloat(data[0].lat), parseFloat(data[0].lon)], 13);
        haptic("medium");
      }
    } catch(e) { console.log("Search error:", e); }
    setSearching(false);
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
      {/* Header */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 1000, padding: "10px 12px", background: "linear-gradient(to bottom, rgba(2,10,24,0.92), rgba(2,10,24,0.5), transparent)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>Карта</div>
            <div style={{ fontSize: 11, color: "#3a5470" }}>{spots.length} меток</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={toggleAdd} className="btn" style={{ padding: "8px 14px", borderRadius: 10, fontFamily: "inherit", fontWeight: 800, fontSize: 12, cursor: "pointer", background: addMode ? "linear-gradient(135deg,#ef4444,#dc2626)" : "linear-gradient(135deg,#4ade80,#22c55e)", color: "#fff", border: "none" }}>
              {addMode ? "✕" : "+ Метка"}
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ display: "flex", gap: 6 }}>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && searchLocation()}
            placeholder="Город, река, озеро..." style={{ ...S.input, flex: 1, padding: "8px 12px", fontSize: 13, borderRadius: 10, background: "rgba(8,18,34,0.85)" }} />
          <button onClick={searchLocation} className="btn" style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.3)", color: "#60a5fa", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            {searching ? "..." : "🔍"}
          </button>
        </div>

        {/* Weather layers toggle */}
        <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
          {[
            { key: "none", label: "🗺 Карта" },
            { key: "precipitation_new", label: "🌧 Осадки" },
            { key: "temp_new", label: "🌡 Темп." },
            { key: "clouds_new", label: "☁️ Облачн." },
          ].map(m => (
            <button key={m.key} onClick={() => { setWeatherLayer(m.key); haptic("light"); }} className="btn" style={{
              flex: 1, padding: "6px 4px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              background: weatherLayer === m.key ? "rgba(74,222,128,0.15)" : "rgba(8,18,34,0.8)",
              border: `1px solid ${weatherLayer === m.key ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.06)"}`,
              color: weatherLayer === m.key ? "#4ade80" : "#3a5470",
            }}>{m.label}</button>
          ))}
        </div>
      </div>

      {addMode && (
        <div style={{ position: "absolute", top: 130, left: "50%", transform: "translateX(-50%)", zIndex: 1000, padding: "8px 20px", borderRadius: 20, background: "rgba(74,222,128,0.92)", color: "#000", fontSize: 13, fontWeight: 700, boxShadow: "0 4px 16px rgba(0,0,0,.3)" }}>
          👆 Нажми на карту
        </div>
      )}

      {/* Map */}
      <div ref={mapRef} style={{ flex: 1, width: "100%", background: "#0a1628" }}>
        {!mapReady && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#3a5470" }}>⏳ Загрузка...</div>}
      </div>

      {/* Spots carousel */}
      {spots.length > 0 && (
        <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, zIndex: 1000, padding: "0 10px" }}>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6 }}>
            {spots.slice(0, 10).map(spot => (
              <button key={spot.id} onClick={() => { if (mapInstance.current && spot.lat) mapInstance.current.setView([spot.lat, spot.lng], 14); haptic("light"); }} className="btn" style={{ ...G.glass, padding: "10px 14px", borderRadius: 12, cursor: "pointer", minWidth: 120, flexShrink: 0, textAlign: "left" }}>
                <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>📍 {spot.name}</div>
                {spot.depth && <div style={{ fontSize: 11, color: "#22d3ee", marginTop: 2 }}>↓ {spot.depth}м</div>}
                {spot.note && <div style={{ fontSize: 10, color: "#3a5470", marginTop: 2 }}>{spot.note}</div>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════
//  TOURNAMENTS SCREEN (localStorage)
// ══════════════════════════════════════════════════
function TournamentsScreen() {
  const [tournaments, setTournaments] = useState(() => storage.get("tournaments", []));
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", type: "Приватный", rules: "", endDate: "" });

  const createTournament = () => {
    if (!form.name.trim()) return;
    const t = {
      id: Date.now(),
      name: form.name,
      type: form.type,
      rules: form.rules,
      endDate: form.endDate || "—",
      participants: [tg?.initDataUnsafe?.user?.username || "я"],
      catches: [],
      createdAt: new Date().toLocaleDateString("ru-RU"),
      status: "active",
    };
    const updated = [t, ...tournaments];
    setTournaments(updated);
    storage.set("tournaments", updated);
    setCreating(false);
    setForm({ name: "", type: "Приватный", rules: "", endDate: "" });
    hapticNotify("success");
  };

  const deleteTournament = (id) => {
    haptic("medium");
    const updated = tournaments.filter(t => t.id !== id);
    setTournaments(updated);
    storage.set("tournaments", updated);
  };

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>Турниры</div>
        <div style={{ fontSize: 13, color: "#3a5470", marginTop: 2 }}>{tournaments.length > 0 ? `${tournaments.length} турниров` : "Создай первый турнир"}</div>
      </div>

      {/* Info banner */}
      <div className="f1" style={{ ...G.glass, padding: 12, borderRadius: 12, marginBottom: 12, borderColor: "rgba(96,165,250,0.15)" }}>
        <div style={{ fontSize: 12, color: "#60a5fa", fontWeight: 600 }}>ℹ️ Турниры пока работают локально. Мультиплеер — в следующем обновлении</div>
      </div>

      {creating ? (
        <div className="f1" style={{ ...G.glass, padding: 16, borderRadius: 20, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>Новый турнир</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "#3a5470", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Название</div>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Щучий турнир" style={S.input} autoFocus />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#3a5470", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Тип</div>
              <div style={{ display: "flex", gap: 6 }}>
                {["Приватный", "Публичный"].map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))} className="btn" style={{
                    flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                    background: form.type === t ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.03)",
                    border: `1.5px solid ${form.type === t ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.06)"}`,
                    color: form.type === t ? "#4ade80" : "#3a5470", cursor: "pointer", fontFamily: "inherit",
                  }}>{t === "Приватный" ? "🔒" : "🌍"} {t}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#3a5470", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Правила (необязательно)</div>
              <input value={form.rules} onChange={e => setForm(f => ({ ...f, rules: e.target.value }))} placeholder="Кто больше поймает за день" style={S.input} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#3a5470", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Дата окончания</div>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} style={S.input} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={createTournament} className="btn" style={{ flex: 1, padding: 14, borderRadius: 14, background: "linear-gradient(135deg,#4ade80,#22c55e)", color: "#fff", fontWeight: 800, fontSize: 15, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                Создать
              </button>
              <button onClick={() => setCreating(false)} className="btn" style={{ padding: "14px 20px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#3a5470", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => { setCreating(true); haptic("medium"); }} className="btn f1" style={{ width: "100%", padding: 14, borderRadius: 16, background: "linear-gradient(135deg,rgba(249,115,22,0.12),rgba(249,115,22,0.04))", border: "1.5px solid rgba(249,115,22,0.25)", color: "#f97316", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}>
          + Создать турнир
        </button>
      )}

      {/* Tournament list */}
      {tournaments.map((t, i) => (
        <div key={t.id} className={`f${Math.min(i + 2, 5)}`} style={{ ...G.glass, padding: 16, borderRadius: 20, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>🏆 {t.name}</div>
              {t.rules && <div style={{ fontSize: 12, color: "#3a5470", marginTop: 3 }}>{t.rules}</div>}
            </div>
            <span style={{ fontSize: 10, padding: "4px 10px", borderRadius: 10, background: "rgba(74,222,128,0.12)", color: "#4ade80", fontWeight: 700, whiteSpace: "nowrap" }}>
              {t.type === "Приватный" ? "🔒" : "🌍"} {t.type}
            </span>
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#3a5470", marginBottom: 12 }}>
            <span>👥 {t.participants?.length || 1}</span>
            <span>📅 до {t.endDate}</span>
            <span>📝 {t.createdAt}</span>
          </div>
          <button onClick={() => deleteTournament(t.id)} className="btn" style={{ background: "none", border: "none", color: "#ef4444", fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: "4px 0" }}>
            Удалить турнир
          </button>
        </div>
      ))}

      {tournaments.length === 0 && !creating && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#2a3f55" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>Создай турнир и соревнуйся<br/>с друзьями по количеству или весу уловов</div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════
//  PLAN SCREEN (localStorage)
// ══════════════════════════════════════════════════
function PlanScreen({ wd }) {
  const { weather, biteScore } = wd;
  const [plans, setPlans] = useState(() => storage.get("plans", []));
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ date: "", location: "", notes: "" });

  const addPlan = () => {
    if (!form.date) return;
    const p = { id: Date.now(), ...form, createdAt: new Date().toLocaleDateString("ru-RU") };
    const updated = [...plans, p].sort((a, b) => a.date.localeCompare(b.date));
    setPlans(updated);
    storage.set("plans", updated);
    setAdding(false);
    setForm({ date: "", location: "", notes: "" });
    hapticNotify("success");
  };

  const deletePlan = (id) => {
    haptic("medium");
    const updated = plans.filter(p => p.id !== id);
    setPlans(updated);
    storage.set("plans", updated);
  };

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>Планирование</div>
      </div>

      {weather && (
        <div className="f1" style={{ ...G.glass, padding: 16, borderRadius: 20, marginBottom: 10, border: "1px solid rgba(74,222,128,0.15)" }}>
          <div style={{ fontSize: 11, color: "#2a3f55", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>💡 На сегодня</div>
          <div style={{ fontSize: 13, color: "#3a5470", lineHeight: 1.7 }}>
            {biteScore >= 70 ? `Отличный день! ${weather.temp}°, давление ${weather.pressure}мм — идеальные условия.`
              : biteScore >= 45 ? `Неплохие условия. ${weather.temp}°, ветер ${weather.wind}м/с. Пробуй зорьки.`
                : `Клёв слабый. Давление ${weather.pressure}мм. Лучше подождать.`}
          </div>
        </div>
      )}

      {adding ? (
        <div className="f2" style={{ ...G.glass, padding: 16, borderRadius: 20, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>Новый выезд</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "#3a5470", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Дата</div>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={S.input} autoFocus />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#3a5470", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Место</div>
              <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Озеро, река..." style={S.input} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#3a5470", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Заметка</div>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Что взять, кого позвать" style={S.input} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={addPlan} className="btn" style={{ flex: 1, padding: 14, borderRadius: 14, background: "linear-gradient(135deg,#ec4899,#db2777)", color: "#fff", fontWeight: 800, fontSize: 15, border: "none", cursor: "pointer", fontFamily: "inherit" }}>Сохранить</button>
              <button onClick={() => setAdding(false)} className="btn" style={{ padding: "14px 20px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#3a5470", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Отмена</button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => { setAdding(true); haptic("medium"); }} className="btn f2" style={{ width: "100%", padding: 14, borderRadius: 16, background: "linear-gradient(135deg,rgba(236,72,153,0.12),rgba(236,72,153,0.04))", border: "1.5px solid rgba(236,72,153,0.25)", color: "#ec4899", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}>
          + Запланировать выезд
        </button>
      )}

      {plans.map((p, i) => (
        <div key={p.id} className={`f${Math.min(i + 3, 5)}`} style={{ ...G.glass, padding: 14, borderRadius: 16, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>📅 {new Date(p.date).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })}</div>
            {p.location && <div style={{ fontSize: 12, color: "#3a5470", marginTop: 2 }}>📍 {p.location}</div>}
            {p.notes && <div style={{ fontSize: 11, color: "#2a3f55", marginTop: 2 }}>{p.notes}</div>}
          </div>
          <button onClick={() => deletePlan(p.id)} className="btn" style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, padding: 4 }}>✕</button>
        </div>
      ))}

      {plans.length === 0 && !adding && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#2a3f55" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>Запланируй следующую рыбалку</div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════
function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#3a5470", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

// ── Styles ──
const G = {
  glass: {
    background: "rgba(8,18,34,0.75)",
    border: "1px solid rgba(255,255,255,0.06)",
    backdropFilter: "blur(20px)",
    boxShadow: "0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)",
  },
};

const S = {
  root: {
    width: "100%", maxWidth: 480, minHeight: "100vh", margin: "0 auto",
    color: "#d8eaf8", fontFamily: "'Manrope',system-ui,sans-serif",
    position: "relative", overflow: "hidden",
  },
  content: {
    position: "relative", zIndex: 1, overflowY: "auto", paddingBottom: 72,
  },
  tabBar: {
    position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
    width: "100%", maxWidth: 480,
    background: "rgba(4,10,22,0.92)", backdropFilter: "blur(24px)",
    borderTop: "1px solid rgba(255,255,255,0.05)",
    display: "flex", justifyContent: "space-around",
    padding: "6px 0 calc(8px + env(safe-area-inset-bottom))", zIndex: 10,
    boxShadow: "0 -8px 32px rgba(0,0,0,0.4)",
  },
  tab: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
    border: "none", background: "none", cursor: "pointer", padding: "4px 10px",
    fontFamily: "'Manrope',system-ui,sans-serif", transition: "color .2s",
  },
  input: {
    width: "100%", padding: "12px 14px", borderRadius: 12, boxSizing: "border-box",
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    color: "#d8eaf8", outline: "none", fontSize: 14, fontWeight: 500,
    backdropFilter: "blur(10px)",
  },
};

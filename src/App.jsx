import { useState, useEffect, useRef, useMemo, useCallback } from "react";

// ═══════════════════════════════════════
//  KLEVOMETR — Telegram Mini App v2.0
//  Реальные данные + красивый визуал
// ═══════════════════════════════════════

const OWM_API_KEY = "ae9e552e204ffd1a5534b385a0af66f8"; // ← вставь свой ключ OpenWeatherMap

const tg = window.Telegram?.WebApp;
const haptic = (type = "light") => { try { tg?.HapticFeedback?.impactOccurred(type); } catch (e) {} };
const hapticNotify = (type = "success") => { try { tg?.HapticFeedback?.notificationOccurred(type); } catch (e) {} };

const SCREENS = {
  home: "home", sessionActive: "sessionActive",
  diary: "diary", addCatch: "addCatch", viewCatch: "viewCatch",
  trophy: "trophy", forecast: "forecast",
  stats: "stats", gear: "gear", addGear: "addGear",
  social: "social", spots: "spots", addSpot: "addSpot",
  profile: "profile", tournaments: "tournaments", plan: "plan",
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
    if (tg?.LocationManager) {
      tg.LocationManager.getLocation((loc) => {
        if (loc) resolve({ lat: loc.latitude, lon: loc.longitude });
        else browserGeo(resolve, reject);
      });
    } else { browserGeo(resolve, reject); }
  });
}
function browserGeo(resolve, reject) {
  if (!navigator.geolocation) { reject(new Error("Геолокация недоступна")); return; }
  navigator.geolocation.getCurrentPosition(
    (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
    (err) => reject(err),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
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
      try {
        const loc = await requestGeolocation();
        if (cancelled) return;
        setLocation(loc);
        const w = await fetchWeather(loc.lat, loc.lon);
        if (cancelled) return;
        if (w) { setWeather(w); setLocationName(w.cityName); }
        const fc = await fetchForecast(loc.lat, loc.lon);
        if (cancelled) return;
        if (fc) setForecast(fc);
      } catch (e) { console.log("Geo error:", e.message); }
      finally { if (!cancelled) setLoading(false); }
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
          0%,100%{transform:translate(0,0) scale(1)}
          33%{transform:translate(30px,-20px) scale(1.05)}
          66%{transform:translate(-20px,30px) scale(0.97)}
        }
        @keyframes aurora2 {
          0%,100%{transform:translate(0,0) scale(1)}
          33%{transform:translate(-40px,20px) scale(1.08)}
          66%{transform:translate(25px,-30px) scale(0.95)}
        }
        @keyframes aurora3 {
          0%,100%{transform:translate(0,0) scale(1)}
          50%{transform:translate(20px,40px) scale(1.1)}
        }
        @keyframes ripple {
          0%{transform:scale(0.8);opacity:0.6}
          100%{transform:scale(2.5);opacity:0}
        }
        @keyframes floatUp {
          0%{transform:translateY(100vh) translateX(0);opacity:0}
          10%{opacity:0.4}
          90%{opacity:0.1}
          100%{transform:translateY(-10vh) translateX(30px);opacity:0}
        }
      `}</style>
      {/* Deep background */}
      <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,#020c18 0%,#041525 40%,#061e35 70%,#040f20 100%)"}}/>
      {/* Aurora blobs */}
      <div style={{position:"absolute",top:"10%",left:"20%",width:350,height:350,borderRadius:"50%",background:"radial-gradient(circle,rgba(0,200,120,0.12) 0%,transparent 70%)",animation:"aurora1 12s ease-in-out infinite",filter:"blur(40px)"}}/>
      <div style={{position:"absolute",top:"40%",right:"10%",width:400,height:300,borderRadius:"50%",background:"radial-gradient(circle,rgba(0,100,200,0.10) 0%,transparent 70%)",animation:"aurora2 15s ease-in-out infinite",filter:"blur(50px)"}}/>
      <div style={{position:"absolute",bottom:"20%",left:"30%",width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,rgba(80,0,200,0.07) 0%,transparent 70%)",animation:"aurora3 18s ease-in-out infinite",filter:"blur(60px)"}}/>
      {/* Stars */}
      {[...Array(40)].map((_,i)=>(
        <div key={i} style={{
          position:"absolute",
          left:`${(i*37+13)%100}%`,
          top:`${(i*53+7)%60}%`,
          width: i%5===0?2:1,
          height: i%5===0?2:1,
          borderRadius:"50%",
          background:"white",
          opacity: 0.1 + (i%4)*0.1,
          animation:`floatUp ${15+i%10}s ${i*0.4}s linear infinite`,
        }}/>
      ))}
      {/* Water ripple at bottom */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:120,background:"linear-gradient(to top,rgba(0,30,60,0.8),transparent)"}}/>
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
  const doCast = () => { haptic("medium"); setCasts(p => p + 1); addEvent("cast", `Заброс #${casts + 1} — ${distance}м`); setCastAnim(true); setTimeout(() => setCastAnim(false), 400); };
  const doBite = () => { haptic("heavy"); setBites(p => p + 1); addEvent("bite", "Поклёвка!"); setBiteAnim(true); setTimeout(() => setBiteAnim(false), 400); };
  const doCaught = () => { haptic("heavy"); hapticNotify("success"); setCaught(p => p + 1); addEvent("caught", "Рыба поймана! 🐟"); setCaughtAnim(true); setTimeout(() => setCaughtAnim(false), 400); };

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
        {screen === SCREENS.profile && <ProfileScreen shared={shared} userName={userName} />}
        {screen === SCREENS.tournaments && <TournamentsScreen />}
        {screen === SCREENS.plan && <PlanScreen wd={wd} />}
      </div>

      {screen !== SCREENS.sessionActive && (
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
  const { catches, sessions } = shared;
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
          { icon: "🗺", label: "Мои места", sub: `${spots.length} точек`, screen: SCREENS.spots, color: "#22d3ee" },
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
                <span style={{ fontSize: 14 }}>{ev.type === "cast" ? "🎯" : ev.type === "bite" ? "⚡" : "🐟"}</span>
                <span style={{ flex: 1, fontSize: 12, color: ev.type === "cast" ? "#3a5470" : ev.type === "bite" ? "#fbbf24" : "#4ade80", fontWeight: 600 }}>{ev.text}</span>
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
      <button onClick={handleDelete} className="btn" style={{ width: "100%", padding: 14, borderRadius: 16, border: "1.5px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.07)", color: "#ef4444", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
        🗑 Удалить запись
      </button>
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
          {weather ? `${weather.cityName} · реальные данные` : "Симуляция без API ключа"}
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
  const { catches, sessions } = shared;
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
  const { spots, deleteSpot } = shared;
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
  const posts = [
    { user: "Алексей", av: "🧔", fish: "Щука 4.8 кг", loc: "Волга, Самара", time: "2ч", likes: 14, bait: "Воблер Rapala" },
    { user: "Марина", av: "👩", fish: "Форель 1.2 кг", loc: "Озеро Светлое", time: "5ч", likes: 8, bait: "Блесна" },
    { user: "Дмитрий", av: "👨‍🦱", fish: "Судак 3.1 кг", loc: "Волгоград", time: "8ч", likes: 22, bait: "Джиг 20г" },
    { user: "Сергей", av: "🧑", fish: "Карп 6.3 кг", loc: "Пруд Зеркальный", time: "1д", likes: 31, bait: "Бойл" },
  ];
  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>Лента</div>
        <div style={{ fontSize: 13, color: "#3a5470", marginTop: 2 }}>Уловы сообщества</div>
      </div>
      {posts.map((p, i) => (
        <div key={i} style={{ ...G.glass, padding: 16, borderRadius: 20, marginBottom: 10, animation: `fadeUp .4s ease ${i * 0.07}s both` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#264170,#1e3454)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, border: "1.5px solid rgba(255,255,255,0.08)" }}>{p.av}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{p.user}</div>
              <div style={{ fontSize: 11, color: "#2a3f55" }}>{p.time} назад</div>
            </div>
          </div>
          <div style={{ padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", marginBottom: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>🐟 {p.fish}</div>
            <div style={{ fontSize: 12, color: "#3a5470", marginTop: 4 }}>📍 {p.loc}</div>
            <div style={{ fontSize: 12, color: "#3a5470", marginTop: 2 }}>🎣 {p.bait}</div>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <button className="btn" onClick={() => haptic("light")} style={{ background: "none", border: "none", color: "#ef4444", fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
              ❤️ {p.likes}
            </button>
            <button className="btn" onClick={() => haptic("light")} style={{ background: "none", border: "none", color: "#3a5470", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              💬 Комментарий
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════
//  PROFILE SCREEN
// ══════════════════════════════════════════════════
function ProfileScreen({ shared, userName }) {
  const { catches, sessions, gearItems, spots } = shared;
  const totalWeight = catches.reduce((a, c) => a + (parseFloat(c.weight) || 0), 0).toFixed(1);
  const maxCatch = catches.reduce((a, c) => (parseFloat(c.weight) || 0) > (parseFloat(a.weight) || 0) ? c : a, { weight: 0 });
  const un = tg?.initDataUnsafe?.user?.first_name || userName || "FisherPro";
  const uh = tg?.initDataUnsafe?.user?.username || "fisherpro";

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
      </div>

      <div className="f1" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        {[
          { l: "Уловов", v: catches.length, c: "#4ade80" },
          { l: "Общий вес", v: `${totalWeight}кг`, c: "#fbbf24" },
          { l: "Мест", v: spots.length, c: "#22d3ee" },
        ].map(s => (
          <div key={s.l} style={{ ...G.glass, padding: 12, borderRadius: 14, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: 10, color: "#2a3f55", marginTop: 3, fontWeight: 600 }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div className="f2" style={{ ...G.glass, padding: 16, borderRadius: 16, marginBottom: 10 }}>
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
        <div className="f3" style={{ ...G.glass, padding: 16, borderRadius: 16 }}>
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
//  TOURNAMENTS SCREEN
// ══════════════════════════════════════════════════
function TournamentsScreen() {
  const tournaments = [
    { n: "Щучий март", type: "Публичный", p: 32, end: "31 мар", prize: "🏆", status: "active", desc: "Самая крупная щука побеждает" },
    { n: "Друзья на Волге", type: "Приватный", p: 5, end: "25 мар", prize: "🎖", status: "active", desc: "Приватный между друзьями" },
    { n: "Весенний карп", type: "Публичный", p: 18, end: "15 апр", prize: "🥇", status: "upcoming", desc: "Карп · фидер · 48 часов" },
  ];
  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>Турниры</div>
      </div>
      {tournaments.map((t, i) => (
        <div key={i} style={{ ...G.glass, padding: 16, borderRadius: 20, marginBottom: 10, animation: `fadeUp .4s ease ${i * 0.07}s both` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{t.prize} {t.n}</div>
              <div style={{ fontSize: 12, color: "#3a5470", marginTop: 3 }}>{t.desc}</div>
            </div>
            <span style={{ fontSize: 10, padding: "4px 10px", borderRadius: 10, background: t.status === "active" ? "rgba(74,222,128,0.12)" : "rgba(251,191,36,0.12)", color: t.status === "active" ? "#4ade80" : "#fbbf24", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>
              {t.status === "active" ? "Активен" : "Скоро"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#3a5470", marginBottom: 12 }}>
            <span>👥 {t.p} участников</span>
            <span>📅 до {t.end}</span>
            <span>🔒 {t.type}</span>
          </div>
          <button className="btn" onClick={() => haptic("medium")} style={{ width: "100%", padding: "10px", borderRadius: 12, border: "1px solid rgba(74,222,128,0.25)", background: "rgba(74,222,128,0.06)", color: "#4ade80", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            Участвовать
          </button>
        </div>
      ))}
      <button className="btn" onClick={() => haptic("medium")} style={{ width: "100%", padding: 14, borderRadius: 16, border: "1.5px dashed rgba(255,255,255,0.1)", background: "transparent", color: "#3a5470", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
        + Создать турнир
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════
//  PLAN SCREEN
// ══════════════════════════════════════════════════
function PlanScreen({ wd }) {
  const { weather, biteScore } = wd;
  const plans = [
    { d: "22 мар, Сб", loc: "Озеро Тихое", fc: 78, friends: 2 },
    { d: "29 мар, Сб", loc: "Река Ока", fc: 65, friends: 0 },
    { d: "5 апр, Сб", loc: "Волга", fc: 52, friends: 4 },
  ];
  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="f0" style={{ padding: "16px 0" }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>Планирование</div>
      </div>

      <div className="f1" style={{ ...G.glass, padding: 16, borderRadius: 20, marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: "#2a3f55", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>📅 Запланированные выезды</div>
        {plans.map((p, i) => (
          <div key={i} style={{ padding: "12px 0", borderBottom: i < plans.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.d}</div>
                <div style={{ fontSize: 12, color: "#3a5470", marginTop: 2 }}>📍 {p.loc}{p.friends > 0 ? ` · 👥 +${p.friends}` : ""}</div>
              </div>
              <div style={{ padding: "4px 12px", borderRadius: 10, background: p.fc >= 70 ? "rgba(74,222,128,0.12)" : "rgba(251,191,36,0.12)", color: p.fc >= 70 ? "#4ade80" : "#fbbf24", fontSize: 13, fontWeight: 800 }}>{p.fc}%</div>
            </div>
          </div>
        ))}
      </div>

      {weather && (
        <div className="f2" style={{ ...G.glass, padding: 16, borderRadius: 20, marginBottom: 10, border: "1px solid rgba(74,222,128,0.15)" }}>
          <div style={{ fontSize: 11, color: "#2a3f55", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>💡 На сегодня</div>
          <div style={{ fontSize: 13, color: "#3a5470", lineHeight: 1.7 }}>
            {biteScore >= 70 ? `Отличный день для рыбалки! ${weather.temp}°, давление ${weather.pressure}мм — идеальные условия.`
              : biteScore >= 45 ? `Неплохие условия. ${weather.temp}°, ветер ${weather.wind}м/с. Пробуй утренние и вечерние зорьки.`
                : `Сегодня клёв слабый. Давление ${weather.pressure}мм. Лучше подождать стабилизации погоды.`}
          </div>
        </div>
      )}

      <button className="btn f3" onClick={() => haptic("medium")} style={{ width: "100%", padding: 14, borderRadius: 16, border: "1.5px dashed rgba(255,255,255,0.1)", background: "transparent", color: "#3a5470", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
        + Запланировать выезд
      </button>
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

import { useState, useEffect, useRef, useMemo, useCallback } from "react";

// ═══════════════════════════════════════
//  KLEVOMETR — Telegram Mini App
//  с реальной погодой и геолокацией
// ═══════════════════════════════════════

// ── OpenWeatherMap ──
// 1. Зарегистрируйся: https://openweathermap.org/api
// 2. Скопируй API Key (бесплатный план — 1000 запросов/день)
// 3. Вставь сюда:
const OWM_API_KEY = "ae9e552e204ffd1a5534b385a0af66f8";

// ── Telegram ──
const tg = window.Telegram?.WebApp;
const haptic = (type = 'light') => { try { tg?.HapticFeedback?.impactOccurred(type); } catch(e) {} };
const hapticNotify = (type = 'success') => { try { tg?.HapticFeedback?.notificationOccurred(type); } catch(e) {} };

// ── Screens ──
const SCREENS = {
  home: "home", sessionActive: "sessionActive",
  diary: "diary", trophy: "trophy", forecast: "forecast",
  stats: "stats", gear: "gear", social: "social", spots: "spots",
  profile: "profile", tournaments: "tournaments", plan: "plan",
};

const FISH = ["Щука","Окунь","Судак","Карп","Карась","Лещ","Сом","Плотва","Жерех","Форель"];
const BAITS = ["Воблер","Блесна","Джиг","Твистер","Червь","Опарыш","Мотыль","Кукуруза","Живец","Бойл"];

// ═══════════════════════════════════════
//  WEATHER & GEO ENGINE
// ═══════════════════════════════════════

// Точная лунная фаза по астрономической формуле
function getMoonPhase(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
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

// Запрос геолокации
function requestGeolocation() {
  return new Promise((resolve, reject) => {
    // Сначала пробуем Telegram LocationManager
    if (tg?.LocationManager) {
      tg.LocationManager.getLocation((loc) => {
        if (loc) {
          resolve({ lat: loc.latitude, lon: loc.longitude, source: "telegram" });
        } else {
          // Fallback на браузерный API
          browserGeo(resolve, reject);
        }
      });
    } else {
      browserGeo(resolve, reject);
    }
  });
}

function browserGeo(resolve, reject) {
  if (!navigator.geolocation) {
    reject(new Error("Геолокация недоступна"));
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, source: "browser" }),
    (err) => reject(err),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
  );
}

// Запрос погоды из OpenWeatherMap
async function fetchWeather(lat, lon) {
  if (!OWM_API_KEY || OWM_API_KEY === "YOUR_API_KEY_HERE") {
    return null; // Нет ключа — используем симуляцию
  }
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&units=metric&lang=ru`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      temp: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      pressure: Math.round(data.main.pressure * 0.750062), // hPa → мм рт.ст.
      humidity: data.main.humidity,
      wind: data.wind.speed.toFixed(1),
      windDeg: data.wind.deg,
      clouds: data.clouds.all,
      description: data.weather[0]?.description || "",
      icon: data.weather[0]?.icon || "01d",
      cityName: data.name || "—",
      sunrise: data.sys.sunrise,
      sunset: data.sys.sunset,
      waterTemp: Math.round(data.main.temp - 3), // Приблизительная Т воды
    };
  } catch (e) {
    console.error("OWM error:", e);
    return null;
  }
}

// Запрос прогноза на 5 дней (3-часовые интервалы)
async function fetchForecast(lat, lon) {
  if (!OWM_API_KEY || OWM_API_KEY === "YOUR_API_KEY_HERE") return null;
  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&units=metric&lang=ru`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.list; // Массив 3-часовых прогнозов
  } catch (e) {
    console.error("OWM forecast error:", e);
    return null;
  }
}

// Алгоритм расчёта клёва на основе РЕАЛЬНЫХ данных
function computeBiteScore(weather, moon, hour) {
  if (!weather) return simulatedScore(hour);

  // 1. Время суток (35%)
  let timeFactor = 0.3;
  if ((hour >= 5 && hour <= 9) || (hour >= 17 && hour <= 21)) timeFactor = 1.0;
  else if ((hour >= 10 && hour <= 12) || (hour >= 14 && hour <= 16)) timeFactor = 0.6;
  else if (hour >= 13 && hour < 14) timeFactor = 0.4;

  // 2. Давление (25%) — оптимум 745-760 мм
  const p = weather.pressure;
  let pressureFactor = 1.0;
  if (p >= 748 && p <= 758) pressureFactor = 1.0;
  else if (p >= 743 && p < 748) pressureFactor = 0.8;
  else if (p > 758 && p <= 763) pressureFactor = 0.8;
  else if (p >= 738 && p < 743) pressureFactor = 0.6;
  else if (p > 763 && p <= 768) pressureFactor = 0.6;
  else pressureFactor = 0.4;

  // 3. Ветер (15%) — оптимум 2-5 м/с
  const w = parseFloat(weather.wind);
  let windFactor = 0.5;
  if (w >= 2 && w <= 5) windFactor = 1.0;
  else if (w < 2) windFactor = 0.8;
  else if (w <= 7) windFactor = 0.7;
  else if (w <= 10) windFactor = 0.4;
  else windFactor = 0.2;

  // 4. Луна (15%)
  const moonFactor = moon?.factor || 0.7;

  // 5. Облачность (10%) — лёгкая облачность лучше
  const cl = weather.clouds;
  let cloudFactor = 0.7;
  if (cl >= 30 && cl <= 70) cloudFactor = 1.0;
  else if (cl < 30) cloudFactor = 0.8;
  else cloudFactor = 0.6;

  const score = Math.min(100, Math.max(0,
    Math.round(
      (timeFactor * 0.35 +
       pressureFactor * 0.25 +
       windFactor * 0.15 +
       moonFactor * 0.15 +
       cloudFactor * 0.10) * 100
    )
  ));
  return score;
}

// Фоллбэк — симулированный скор без погоды
function simulatedScore(hour) {
  let t = 0.3;
  if ((hour >= 5 && hour <= 9) || (hour >= 17 && hour <= 21)) t = 1.0;
  else if ((hour >= 10 && hour <= 16)) t = 0.6;
  return Math.min(100, Math.max(0, Math.round((t * 0.5 + 0.7 * 0.3 + 0.8 * 0.2) * 100)));
}

function getForecastColor(s) { if(s>=70) return "#4ade80"; if(s>=45) return "#fbbf24"; if(s>=25) return "#f97316"; return "#ef4444"; }
function getForecastLabel(s) { if(s>=70) return "Отличный"; if(s>=45) return "Хороший"; if(s>=25) return "Слабый"; return "Плохой"; }

// Иконка погоды OWM → emoji
function weatherEmoji(icon) {
  if (!icon) return "🌤";
  const map = {"01d":"☀️","01n":"🌙","02d":"⛅","02n":"☁️","03d":"☁️","03n":"☁️","04d":"☁️","04n":"☁️","09d":"🌧","09n":"🌧","10d":"🌦","10n":"🌧","11d":"⛈","11n":"⛈","13d":"🌨","13n":"🌨","50d":"🌫","50n":"🌫"};
  return map[icon] || "🌤";
}

// Направление ветра
function windDir(deg) {
  if (deg == null) return "";
  const dirs = ["С","ССВ","СВ","ВСВ","В","ВЮВ","ЮВ","ЮЮВ","Ю","ЮЮЗ","ЮЗ","ЗЮЗ","З","ЗСЗ","СЗ","ССЗ"];
  return dirs[Math.round(deg / 22.5) % 16];
}

// ═══════════════════════════════════════
//  CUSTOM HOOK: useWeather
// ═══════════════════════════════════════
function useWeather() {
  const [location, setLocation] = useState(null);
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [locationName, setLocationName] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Получаем геолокацию
        const loc = await requestGeolocation();
        if (cancelled) return;
        setLocation(loc);

        // 2. Запрашиваем текущую погоду
        const w = await fetchWeather(loc.lat, loc.lon);
        if (cancelled) return;
        if (w) {
          setWeather(w);
          setLocationName(w.cityName);
        }

        // 3. Запрашиваем прогноз
        const fc = await fetchForecast(loc.lat, loc.lon);
        if (cancelled) return;
        if (fc) setForecast(fc);

      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Обновление погоды каждые 10 минут
  useEffect(() => {
    if (!location) return;
    const iv = setInterval(async () => {
      const w = await fetchWeather(location.lat, location.lon);
      if (w) setWeather(w);
    }, 600000);
    return () => clearInterval(iv);
  }, [location]);

  return { location, weather, forecast, loading, error, locationName };
}


// ═══════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════
export default function Klevometr() {
  const [screen, setScreen] = useState(SCREENS.home);
  const [history, setHistory] = useState([]);
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

  // ── Погода и геолокация ──
  const { weather, forecast, loading: weatherLoading, error: weatherError, locationName } = useWeather();
  const moon = getMoonPhase();

  // Прогноз клёва — на основе реальных данных
  const currentHour = new Date().getHours();
  const biteScore = computeBiteScore(weather, moon, currentHour);

  const go = useCallback((s) => { setHistory(p => [...p, screen]); setScreen(s); }, [screen]);
  const back = useCallback(() => {
    if (history.length) { setScreen(history[history.length-1]); setHistory(p => p.slice(0,-1)); }
    else setScreen(SCREENS.home);
  }, [history]);

  // Telegram BackButton
  useEffect(() => {
    if (!tg) return;
    if (screen !== SCREENS.home) {
      tg.BackButton.show();
      const handler = () => back();
      tg.BackButton.onClick(handler);
      return () => tg.BackButton.offClick(handler);
    } else { tg.BackButton.hide(); }
  }, [screen, back]);

  // Timer
  useEffect(() => {
    if (sessionState === "active") {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 1000);
    } else { clearInterval(timerRef.current); }
    return () => clearInterval(timerRef.current);
  }, [sessionState]);

  const startSession = () => { hapticNotify('success'); startRef.current = Date.now(); setElapsed(0); setCasts(0); setBites(0); setCaught(0); setEvents([]); setSessionState("active"); go(SCREENS.sessionActive); };
  const stopSession = () => { hapticNotify('warning'); setSessionState("idle"); };
  const addEvent = (type, text) => { setEvents(p => [{ type, text, t: elapsed }, ...p].slice(0, 50)); };
  const doCast = () => { haptic('medium'); setCasts(p=>p+1); addEvent("cast",`Заброс #${casts+1} — ${distance}м`); setCastAnim(true); setTimeout(()=>setCastAnim(false),400); };
  const doBite = () => { haptic('heavy'); setBites(p=>p+1); addEvent("bite","Поклёвка!"); setBiteAnim(true); setTimeout(()=>setBiteAnim(false),400); };
  const doCaught = () => { haptic('heavy'); hapticNotify('success'); setCaught(p=>p+1); addEvent("caught","Рыба поймана! 🐟"); setCaughtAnim(true); setTimeout(()=>setCaughtAnim(false),400); };

  const fmt = (s) => `${String(Math.floor(s/3600)).padStart(2,"0")}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const bph = elapsed > 0 ? (bites/(elapsed/3600)).toFixed(1) : "0.0";
  const realiz = bites > 0 ? Math.round(caught/bites*100) : 0;
  const userName = tg?.initDataUnsafe?.user?.first_name || "рыбак";

  // Собираем weatherData объект для передачи в экраны
  const wd = { weather, forecast, moon, biteScore, weatherLoading, weatherError, locationName, currentHour };

  return (
    <div style={S.phone}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes liveDot{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
        .f0{animation:fadeUp .4s ease both}.f1{animation:fadeUp .4s ease .05s both}.f2{animation:fadeUp .4s ease .1s both}.f3{animation:fadeUp .4s ease .15s both}.f4{animation:fadeUp .4s ease .2s both}.f5{animation:fadeUp .4s ease .25s both}
        .btn:active{transform:scale(.96)!important;opacity:.85}
        ::-webkit-scrollbar{width:0}
      `}</style>

      <div style={S.content} key={screen}>
        {screen===SCREENS.home && <HomeScreen go={go} wd={wd} startSession={startSession} userName={userName} />}
        {screen===SCREENS.sessionActive && <ActiveSession {...{elapsed,casts,bites,caught,events,distance,setDistance,doCast,doBite,doCaught,stopSession,fmt,bph,realiz,castAnim,biteAnim,caughtAnim,back,wd}} />}
        {screen===SCREENS.forecast && <ForecastScreen wd={wd} />}
        {screen===SCREENS.diary && <DiaryScreen go={go} />}
        {screen===SCREENS.trophy && <TrophyScreen />}
        {screen===SCREENS.stats && <StatsScreen />}
        {screen===SCREENS.gear && <GearScreen />}
        {screen===SCREENS.social && <SocialScreen />}
        {screen===SCREENS.spots && <SpotsScreen />}
        {screen===SCREENS.profile && <ProfileScreen />}
        {screen===SCREENS.tournaments && <TournamentsScreen />}
        {screen===SCREENS.plan && <PlanScreen wd={wd} />}
      </div>

      {screen !== SCREENS.sessionActive && (
        <div style={S.tabBar}>
          {[{k:SCREENS.home,icon:"🏠",label:"Главная"},{k:SCREENS.diary,icon:"📖",label:"Дневник"},{k:SCREENS.forecast,icon:"🌤",label:"Прогноз"},{k:SCREENS.social,icon:"👥",label:"Лента"},{k:SCREENS.profile,icon:"👤",label:"Профиль"}].map(t=>(
            <button key={t.k} onClick={()=>{haptic('light');setHistory([]);setScreen(t.k)}} className="btn"
              style={{...S.tab,color:screen===t.k?"#4ade80":"#6b7f99"}}>
              <span style={{fontSize:20}}>{t.icon}</span>
              <span style={{fontSize:9,fontWeight:screen===t.k?700:500}}>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════
//  WEATHER BADGE (shared mini component)
// ═══════════════════════════════════════
function WeatherBadge({ weather, small }) {
  if (!weather) return <span style={{fontSize:12,color:"#5a7a9b"}}>📍 Определяем...</span>;
  const sz = small ? 11 : 12;
  return (
    <div style={{display:"flex",gap:small?8:12,flexWrap:"wrap",alignItems:"center"}}>
      <span style={{fontSize:sz,color:"#5a7a9b"}}>{weatherEmoji(weather.icon)} {weather.temp}°</span>
      <span style={{fontSize:sz,color:"#5a7a9b"}}>💨 {weather.wind} м/с {windDir(weather.windDeg)}</span>
      <span style={{fontSize:sz,color:"#5a7a9b"}}>🌡 {weather.pressure} мм</span>
    </div>
  );
}

// ═══════════ HOME ═══════════
function HomeScreen({ go, wd, startSession, userName }) {
  const { weather, moon, biteScore, weatherLoading, locationName } = wd;
  const now = new Date();
  return (
    <div style={{padding:"0 20px 16px"}}>
      <div className="f0" style={{padding:"16px 0 4px"}}>
        <div style={{fontSize:11,color:"#6b8aad",fontWeight:700,letterSpacing:2,textTransform:"uppercase"}}>
          Клёвометр{locationName ? ` · ${locationName}` : ""}
        </div>
        <div style={{fontSize:26,fontWeight:900,marginTop:4,background:"linear-gradient(135deg,#4ade80,#22d3ee)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Привет, {userName}! 🎣</div>
        <div style={{fontSize:13,color:"#5a7a9b",marginTop:2}}>{now.toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long"})}</div>
      </div>

      {/* Start session */}
      <button onClick={startSession} className="btn f1" style={{...S.card,width:"100%",textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:14,border:"1.5px solid rgba(74,222,128,.3)",background:"linear-gradient(135deg,rgba(74,222,128,.08),rgba(17,29,51,.9))",padding:16,boxSizing:"border-box"}}>
        <div style={{width:52,height:52,borderRadius:14,background:"linear-gradient(135deg,#22c55e,#16a34a)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0,boxShadow:"0 4px 16px rgba(34,197,94,.3)"}}>🎣</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:800,fontSize:16,color:"#4ade80"}}>Начать рыбалку</div>
          <div style={{fontSize:12,color:"#6b8aad",marginTop:2}}>Забросы, поклёвки и аналитика</div>
        </div>
        <span style={{color:"#4ade80",fontSize:22}}>›</span>
      </button>

      {/* Forecast with REAL data */}
      <button onClick={()=>go(SCREENS.forecast)} className="btn f2" style={{...S.card,width:"100%",textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:14,padding:16,boxSizing:"border-box"}}>
        <div style={{position:"relative",width:56,height:56,flexShrink:0}}>
          <svg width={56} height={56} style={{transform:"rotate(-90deg)"}}><circle cx={28} cy={28} r={24} fill="none" stroke="#1e3454" strokeWidth={5}/><circle cx={28} cy={28} r={24} fill="none" stroke={getForecastColor(biteScore)} strokeWidth={5} strokeDasharray={150.8} strokeDashoffset={150.8*(1-biteScore/100)} strokeLinecap="round"/></svg>
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:900,color:getForecastColor(biteScore)}}>
            {weatherLoading ? "..." : biteScore}
          </div>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:12,color:"#6b8aad",fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Прогноз клёва</div>
          <div style={{fontSize:18,fontWeight:800,color:getForecastColor(biteScore),marginTop:2}}>{getForecastLabel(biteScore)}</div>
          <div style={{marginTop:4}}>
            {weather
              ? <WeatherBadge weather={weather} small />
              : <span style={{fontSize:11,color:"#3d5a80"}}>{moon.icon} {moon.name}</span>
            }
          </div>
        </div>
        <span style={{color:"#6b8aad",fontSize:18}}>›</span>
      </button>

      {/* Grid */}
      <div className="f3" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:2}}>
        {[
          {icon:"📖",label:"Дневник",sub:"24 улова",screen:SCREENS.diary,color:"#60a5fa"},
          {icon:"📊",label:"Статистика",sub:"Аналитика",screen:SCREENS.stats,color:"#f59e0b"},
          {icon:"🗺",label:"Мои места",sub:"8 точек",screen:SCREENS.spots,color:"#22d3ee"},
          {icon:"🎒",label:"Снаряжение",sub:"Инвентарь",screen:SCREENS.gear,color:"#a78bfa"},
          {icon:"🏆",label:"Турниры",sub:"2 активных",screen:SCREENS.tournaments,color:"#f97316"},
          {icon:"📅",label:"Планирование",sub:"Календарь",screen:SCREENS.plan,color:"#ec4899"},
        ].map((item,i)=>(
          <button key={item.label} onClick={()=>{haptic('light');go(item.screen)}} className="btn"
            style={{...S.card,padding:16,cursor:"pointer",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxSizing:"border-box"}}>
            <div style={{fontSize:24,width:40,height:40,borderRadius:10,background:`${item.color}15`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{item.icon}</div>
            <div><div style={{fontWeight:700,fontSize:14,color:"#e2e8f0"}}>{item.label}</div><div style={{fontSize:11,color:"#5a7a9b",marginTop:1}}>{item.sub}</div></div>
          </button>
        ))}
      </div>

      {/* Current conditions card */}
      {weather && (
        <div className="f4" style={{...S.card,marginTop:2}}>
          <div style={{fontSize:12,color:"#6b8aad",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>
            {weatherEmoji(weather.icon)} Сейчас · {weather.cityName}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {[
              {l:"Темп.",v:`${weather.temp}°`,c:"#f97316"},
              {l:"Давление",v:`${weather.pressure}`,c:"#60a5fa"},
              {l:"Ветер",v:`${weather.wind}`,c:"#6b8aad"},
            ].map(s=>(
              <div key={s.l} style={{textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:900,color:s.c}}>{s.v}</div>
                <div style={{fontSize:10,color:"#5a7a9b",marginTop:2}}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:12,color:"#5a7a9b",marginTop:8,textAlign:"center"}}>{weather.description}</div>
        </div>
      )}
    </div>
  );
}


// ═══════════ ACTIVE SESSION ═══════════
function ActiveSession({ elapsed,casts,bites,caught,events,distance,setDistance,doCast,doBite,doCaught,stopSession,fmt,bph,realiz,castAnim,biteAnim,caughtAnim,back,wd }) {
  const { weather } = wd;
  return (
    <div style={{padding:"0 16px 16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0"}}>
        <div style={{fontSize:18,fontWeight:900}}>Рыбалка</div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:"#4ade80",animation:"liveDot 1.5s infinite"}}/>
          <span style={{fontSize:12,fontWeight:800,color:"#4ade80"}}>LIVE</span>
        </div>
      </div>

      {/* Weather strip on session */}
      {weather && (
        <div className="f0" style={{display:"flex",justifyContent:"center",gap:16,padding:"8px 0 4px",marginBottom:4}}>
          <span style={{fontSize:11,color:"#5a7a9b"}}>{weatherEmoji(weather.icon)} {weather.temp}°</span>
          <span style={{fontSize:11,color:"#5a7a9b"}}>🌡 {weather.pressure} мм</span>
          <span style={{fontSize:11,color:"#5a7a9b"}}>💨 {weather.wind} м/с {windDir(weather.windDeg)}</span>
          <span style={{fontSize:11,color:"#5a7a9b"}}>💧 {weather.humidity}%</span>
        </div>
      )}

      {/* Timer */}
      <div className="f0" style={{...S.card,textAlign:"center",padding:"20px 16px",background:"linear-gradient(135deg,#111d33,#0c2a1e)",border:"1.5px solid rgba(74,222,128,.25)"}}>
        <div style={{fontSize:48,fontWeight:900,fontFamily:"'Courier New',monospace",letterSpacing:4,color:"#4ade80",textShadow:"0 0 40px rgba(74,222,128,.2)"}}>{fmt(elapsed)}</div>
        <div style={{display:"flex",gap:24,justifyContent:"center",marginTop:12}}>
          <div><div style={{fontSize:24,fontWeight:900,color:"#60a5fa"}}>{casts}</div><div style={{fontSize:10,color:"#5a7a9b",fontWeight:600}}>ЗАБРОСОВ</div></div>
          <div><div style={{fontSize:24,fontWeight:900,color:"#fbbf24"}}>{bites}</div><div style={{fontSize:10,color:"#5a7a9b",fontWeight:600}}>ПОКЛЁВОК</div></div>
          <div><div style={{fontSize:24,fontWeight:900,color:"#4ade80"}}>{caught}</div><div style={{fontSize:10,color:"#5a7a9b",fontWeight:600}}>ПОЙМАНО</div></div>
        </div>
      </div>

      {/* Distance */}
      <div className="f1" style={{...S.card,padding:14}}>
        <div style={{fontSize:11,color:"#6b8aad",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Дистанция: {distance}м</div>
        <input type="range" min={5} max={80} value={distance} onChange={e=>setDistance(+e.target.value)} style={{width:"100%",accentColor:"#4ade80",height:6}}/>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#5a7a9b",marginTop:4}}><span>5м</span><span>Ближняя</span><span>Средняя</span><span>Дальняя</span><span>80м</span></div>
      </div>

      {/* Action buttons */}
      <div className="f2" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
        <button onClick={doCast} className="btn" style={{...S.actionBtn,borderColor:"rgba(96,165,250,.3)",background:"linear-gradient(180deg,rgba(96,165,250,.1),transparent)",color:"#60a5fa",transform:castAnim?"scale(1.1)":"scale(1)",transition:"transform .15s"}}><span style={{fontSize:32}}>🎯</span><span style={{fontSize:14,fontWeight:800,marginTop:4}}>Заброс</span><span style={{fontSize:24,fontWeight:900,marginTop:2}}>{casts}</span></button>
        <button onClick={doBite} className="btn" style={{...S.actionBtn,borderColor:"rgba(251,191,36,.3)",background:"linear-gradient(180deg,rgba(251,191,36,.1),transparent)",color:"#fbbf24",transform:biteAnim?"scale(1.1)":"scale(1)",transition:"transform .15s"}}><span style={{fontSize:32}}>⚡</span><span style={{fontSize:14,fontWeight:800,marginTop:4}}>Поклёвка</span><span style={{fontSize:24,fontWeight:900,marginTop:2}}>{bites}</span></button>
        <button onClick={doCaught} className="btn" style={{...S.actionBtn,borderColor:"rgba(74,222,128,.3)",background:"linear-gradient(180deg,rgba(74,222,128,.1),transparent)",color:"#4ade80",transform:caughtAnim?"scale(1.1)":"scale(1)",transition:"transform .15s"}}><span style={{fontSize:32}}>🐟</span><span style={{fontSize:14,fontWeight:800,marginTop:4}}>Поймал</span><span style={{fontSize:24,fontWeight:900,marginTop:2}}>{caught}</span></button>
      </div>

      {/* Live analytics */}
      <div className="f3" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
        <div style={{...S.miniCard,borderColor:"rgba(251,191,36,.12)"}}><div style={{fontSize:10,color:"#5a7a9b",fontWeight:700}}>ПОКЛЁВКИ/ЧАС</div><div style={{fontSize:22,fontWeight:900,color:"#fbbf24"}}>{bph}</div></div>
        <div style={{...S.miniCard,borderColor:"rgba(74,222,128,.12)"}}><div style={{fontSize:10,color:"#5a7a9b",fontWeight:700}}>РЕАЛИЗАЦИЯ</div><div style={{fontSize:22,fontWeight:900,color:"#4ade80"}}>{realiz}%</div></div>
        <div style={{...S.miniCard,borderColor:"rgba(96,165,250,.12)"}}><div style={{fontSize:10,color:"#5a7a9b",fontWeight:700}}>ЗАБРОС/ЧАС</div><div style={{fontSize:22,fontWeight:900,color:"#60a5fa"}}>{elapsed>0?((casts/(elapsed/3600))).toFixed(1):"0.0"}</div></div>
        <div style={{...S.miniCard,borderColor:"rgba(249,115,22,.12)"}}><div style={{fontSize:10,color:"#5a7a9b",fontWeight:700}}>ПОДСЕЧКА</div><div style={{fontSize:22,fontWeight:900,color:"#f97316"}}>{casts>0?Math.round(bites/casts*100):0}%</div></div>
      </div>

      {/* Event log */}
      {events.length>0&&(<div className="f4" style={{...S.card,marginTop:12,padding:14}}>
        <div style={{fontSize:11,color:"#6b8aad",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>📋 Лента</div>
        <div style={{maxHeight:180,overflowY:"auto"}}>
          {events.slice(0,12).map((ev,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:i<Math.min(events.length,12)-1?"1px solid #1e3454":"none",animation:i===0?"slideDown .3s ease":"none"}}>
              <span style={{fontSize:14}}>{ev.type==="cast"?"🎯":ev.type==="bite"?"⚡":"🐟"}</span>
              <span style={{flex:1,fontSize:12,color:ev.type==="cast"?"#6b8aad":ev.type==="bite"?"#fbbf24":"#4ade80",fontWeight:600}}>{ev.text}</span>
              <span style={{fontSize:10,color:"#3d5a80",fontFamily:"monospace"}}>{fmt(ev.t)}</span>
            </div>
          ))}
        </div>
      </div>)}

      <button onClick={()=>{stopSession();back()}} className="btn" style={{width:"100%",marginTop:14,padding:14,borderRadius:14,border:"1.5px solid rgba(239,68,68,.3)",background:"rgba(239,68,68,.08)",color:"#ef4444",fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"inherit"}}>⏹ Завершить сессию</button>
    </div>
  );
}


// ═══════════ FORECAST ═══════════
function ForecastScreen({ wd }) {
  const { weather, forecast, moon, biteScore, weatherLoading, locationName, currentHour } = wd;

  // Почасовые скоры
  const hourlyScores = useMemo(() => {
    return Array.from({length:18},(_,i) => {
      const h = i + 5;
      return { h, score: computeBiteScore(weather, moon, h) };
    });
  }, [weather, moon]);

  const bestHour = hourlyScores.reduce((a,b) => a.score > b.score ? a : b, {h:6,score:0});

  // 5-дневный прогноз из OWM forecast
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
      const avgTemp = Math.round(d.temps.reduce((a,b)=>a+b,0)/d.temps.length);
      const avgPressure = Math.round(d.pressures.reduce((a,b)=>a+b,0)/d.pressures.length);
      const avgWind = (d.winds.reduce((a,b)=>a+b,0)/d.winds.length).toFixed(1);
      const fakeWeather = { pressure: avgPressure, wind: avgWind, clouds: 50 };
      const dayMoon = getMoonPhase(new Date(date));
      const morningScore = computeBiteScore(fakeWeather, dayMoon, 7);
      const eveningScore = computeBiteScore(fakeWeather, dayMoon, 19);
      const maxScore = Math.max(morningScore, eveningScore);
      const dt = new Date(date);
      return {
        label: i===0 ? "Сегодня" : i===1 ? "Завтра" : dt.toLocaleDateString("ru-RU",{weekday:"short",day:"numeric"}),
        temp: avgTemp, pressure: avgPressure, wind: avgWind,
        maxScore, moon: dayMoon, icon: d.icons[Math.floor(d.icons.length/2)]
      };
    });
  }, [forecast]);

  return (
    <div style={{padding:"0 20px 16px"}}>
      <div className="f0" style={{padding:"16px 0"}}>
        <div style={{fontSize:24,fontWeight:900}}>Прогноз клёва</div>
        <div style={{fontSize:13,color:"#5a7a9b",marginTop:2}}>
          {weather ? `${weather.cityName} · реальные данные` : "На основе алгоритма"}
        </div>
      </div>

      {/* Main score */}
      <div className="f1" style={{...S.card,textAlign:"center",background:"linear-gradient(135deg,#111d33,#0f2847)",border:"1.5px solid #264170",padding:24}}>
        {weatherLoading ? (
          <div style={{padding:20,color:"#5a7a9b"}}>⏳ Загрузка погоды...</div>
        ) : (<>
          <div style={{position:"relative",width:100,height:100,margin:"0 auto 12px"}}>
            <svg width={100} height={100} style={{transform:"rotate(-90deg)"}}><circle cx={50} cy={50} r={42} fill="none" stroke="#1e3454" strokeWidth={7}/><circle cx={50} cy={50} r={42} fill="none" stroke={getForecastColor(biteScore)} strokeWidth={7} strokeDasharray={263.9} strokeDashoffset={263.9*(1-biteScore/100)} strokeLinecap="round"/></svg>
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:32,fontWeight:900,color:getForecastColor(biteScore)}}>{biteScore}</span><span style={{fontSize:10,color:"#6b8aad"}}>%</span></div>
          </div>
          <div style={{fontSize:20,fontWeight:800,color:getForecastColor(biteScore)}}>{getForecastLabel(biteScore)} клёв</div>
          <div style={{fontSize:13,color:"#5a7a9b",marginTop:4}}>Лучшее время: <strong style={{color:"#e2e8f0"}}>{bestHour.h}:00</strong> ({bestHour.score}%)</div>
          {weather && <div style={{fontSize:12,color:"#3d5a80",marginTop:6}}>{weatherEmoji(weather.icon)} {weather.description}</div>}
        </>)}
      </div>

      {/* Real conditions */}
      <div className="f2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:2}}>
        {[
          {l:"Давление",v:weather?.pressure||"—",u:"мм",c:"#60a5fa"},
          {l:"Температура",v:weather?.temp||"—",u:"°C",c:"#f97316"},
          {l:"Ветер",v:weather?`${weather.wind} ${windDir(weather.windDeg)}`:"—",u:"м/с",c:"#6b8aad"},
          {l:"Вода ≈",v:weather?.waterTemp||"—",u:"°C",c:"#22d3ee"},
        ].map((s,i)=>(
          <div key={i} style={S.miniCard}><div style={{fontSize:10,color:"#5a7a9b",fontWeight:700}}>{s.l}</div><div style={{fontSize:18,fontWeight:900,color:s.c}}>{s.v}<span style={{fontSize:10,fontWeight:500,color:"#5a7a9b"}}> {s.u}</span></div></div>
        ))}
      </div>

      {/* Moon */}
      <div className="f3" style={{...S.card,display:"flex",alignItems:"center",gap:14,marginTop:2}}>
        <span style={{fontSize:36}}>{moon.icon}</span>
        <div style={{flex:1}}><div style={{fontSize:11,color:"#6b8aad",fontWeight:600,textTransform:"uppercase"}}>Лунная фаза</div><div style={{fontSize:16,fontWeight:800,marginTop:2}}>{moon.name}</div></div>
        <div style={{fontSize:14,fontWeight:800,color:"#fbbf24"}}>{Math.round(moon.factor*100)}%</div>
      </div>

      {/* Hourly */}
      <div className="f4" style={S.card}>
        <div style={{fontSize:12,color:"#6b8aad",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>По часам</div>
        <div style={{display:"flex",alignItems:"flex-end",gap:2,height:70}}>
          {hourlyScores.map(h=>{const isCur=h.h===currentHour;return(
            <div key={h.h} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
              <div style={{width:"100%",height:`${h.score*.65}px`,minHeight:3,background:getForecastColor(h.score),borderRadius:2,opacity:isCur?1:.6,border:isCur?`1.5px solid ${getForecastColor(h.score)}`:"none"}}/>
              {(h.h%3===0||isCur)&&<span style={{fontSize:8,color:isCur?"#e2e8f0":"#3d5a80",fontWeight:isCur?800:400}}>{h.h}</span>}
            </div>
          );})}
        </div>
      </div>

      {/* 5-day (only with real data) */}
      {dailyForecast && (
        <div className="f5" style={S.card}>
          <div style={{fontSize:12,color:"#6b8aad",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Прогноз на 5 дней</div>
          {dailyForecast.map((d,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:i<dailyForecast.length-1?"1px solid #1e3454":"none"}}>
              <span style={{width:65,fontSize:13,fontWeight:i===0?800:500,color:i===0?"#e2e8f0":"#5a7a9b"}}>{d.label}</span>
              <span style={{fontSize:16}}>{weatherEmoji(d.icon)}</span>
              <span style={{fontSize:16}}>{d.moon.icon}</span>
              <span style={{flex:1,fontSize:12,color:"#5a7a9b"}}>{d.temp}° · {d.wind}м/с</span>
              <div style={{fontSize:14,fontWeight:800,color:getForecastColor(d.maxScore)}}>{d.maxScore}%</div>
            </div>
          ))}
        </div>
      )}

      {/* Tips */}
      <div style={{...S.card,background:"linear-gradient(135deg,rgba(74,222,128,.06),#111d33)",border:"1px solid rgba(74,222,128,.2)"}}>
        <div style={{fontSize:13,fontWeight:700,color:"#4ade80",marginBottom:6}}>💡 Рекомендации</div>
        <div style={{fontSize:13,color:"#6b8aad",lineHeight:1.6}}>
          {biteScore>=70?"Отличные условия! Активные приманки — воблеры, блёсны. Хищник активен утром и вечером."
          :biteScore>=45?"Умеренный клёв. Натуральные наживки, медленная проводка. Перепады глубин."
          :"Слабая активность. Мелкие приманки, деликатная оснастка. Глубина, укрытия."}
        </div>
      </div>
    </div>
  );
}


// ═══════════ SIMPLE SCREENS ═══════════
// (Diary, Trophy, Stats, Gear, Spots, Social, Profile, Tournaments, Plan)
// Те же что в прототипе — без изменений

function DiaryScreen({go}){
  const items=[{sp:"Щука",w:3.2,loc:"Озеро Тихое",b:"Воблер",d:"19 мар"},{sp:"Окунь",w:0.8,loc:"Река Ока",b:"Блесна",d:"15 мар"},{sp:"Судак",w:2.1,loc:"Водохранилище",b:"Джиг",d:"12 мар"},{sp:"Карп",w:5.4,loc:"Пруд Заречный",b:"Бойл",d:"8 мар"},{sp:"Лещ",w:1.3,loc:"Река Волга",b:"Червь",d:"5 мар"}];
  return(<div style={{padding:"0 20px 16px"}}>
    <div className="f0" style={{padding:"16px 0"}}><div style={{fontSize:24,fontWeight:900}}>Дневник улова</div><div style={{fontSize:13,color:"#5a7a9b",marginTop:2}}>24 записи · 38.7 кг</div></div>
    <button onClick={()=>go(SCREENS.trophy)} className="btn f1" style={{width:"100%",padding:14,borderRadius:14,border:"none",background:"linear-gradient(135deg,#3b82f6,#2563eb)",color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"inherit",marginBottom:12,boxShadow:"0 4px 20px rgba(59,130,246,.3)"}}>+ Добавить улов</button>
    {items.map((c,i)=>(<button key={i} onClick={()=>{haptic('light');go(SCREENS.trophy)}} className="btn" style={{...S.card,width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:12,padding:14,cursor:"pointer",boxSizing:"border-box"}}>
      <div style={{width:44,height:44,borderRadius:11,background:"linear-gradient(135deg,rgba(14,165,233,.1),rgba(59,130,246,.06))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🐟</div>
      <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>{c.sp}</div><div style={{fontSize:11,color:"#5a7a9b",marginTop:1}}>{c.loc} · {c.b}</div></div>
      <div style={{textAlign:"right"}}><div style={{fontWeight:900,fontSize:18}}>{c.w}<span style={{fontSize:10,color:"#5a7a9b"}}> кг</span></div><div style={{fontSize:10,color:"#3d5a80"}}>{c.d}</div></div>
    </button>))}
  </div>);
}

function TrophyScreen(){return(<div style={{padding:"0 20px 16px"}}><div className="f0" style={{padding:"16px 0"}}><div style={{fontSize:20,fontWeight:900}}>Карточка трофея</div></div><div className="f1" style={{...S.card,padding:0,overflow:"hidden"}}><div style={{height:180,background:"linear-gradient(135deg,#0c2a3e,#162440)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:64}}>🐟</div><div style={{padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:22,fontWeight:900}}>Щука</div><div style={{padding:"4px 12px",borderRadius:20,background:"rgba(234,179,8,.12)",color:"#fbbf24",fontSize:12,fontWeight:700}}>🏆 Трофей</div></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:14}}>{[{l:"Вес",v:"3.2 кг",c:"#f59e0b"},{l:"Длина",v:"58 см",c:"#22d3ee"},{l:"Дата",v:"19 мар",c:"#6b8aad"}].map(s=>(<div key={s.l} style={{textAlign:"center",padding:10,borderRadius:10,background:"rgba(30,52,84,.5)"}}><div style={{fontSize:18,fontWeight:900,color:s.c}}>{s.v}</div><div style={{fontSize:10,color:"#5a7a9b",marginTop:2}}>{s.l}</div></div>))}</div><div style={{marginTop:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{[{l:"Место",v:"📍 Озеро Тихое"},{l:"Приманка",v:"🎣 Воблер Rapala"},{l:"Снасть",v:"🎋 Maximus 2.4м"},{l:"Погода",v:"🌤 18°, 752мм"}].map(s=>(<div key={s.l} style={{padding:"8px 10px",borderRadius:8,background:"rgba(30,52,84,.3)"}}><div style={{fontSize:10,color:"#5a7a9b",fontWeight:600}}>{s.l}</div><div style={{fontSize:13,fontWeight:600,marginTop:2}}>{s.v}</div></div>))}</div></div></div></div>);}

function StatsScreen(){const sp=[{n:"Щука",c:8,cl:"#4ade80"},{n:"Окунь",c:6,cl:"#60a5fa"},{n:"Судак",c:4,cl:"#fbbf24"},{n:"Карп",c:3,cl:"#f97316"},{n:"Лещ",c:3,cl:"#22d3ee"}];return(<div style={{padding:"0 20px 16px"}}><div className="f0" style={{padding:"16px 0"}}><div style={{fontSize:24,fontWeight:900}}>Статистика</div></div><div className="f1" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>{[{l:"Уловов",v:"24",c:"#60a5fa"},{l:"Видов",v:"8",c:"#4ade80"},{l:"Вес",v:"38.7кг",c:"#fbbf24"}].map(s=>(<div key={s.l} style={S.miniCard}><div style={{fontSize:22,fontWeight:900,color:s.c}}>{s.v}</div><div style={{fontSize:10,color:"#5a7a9b",fontWeight:600,marginTop:2}}>{s.l}</div></div>))}</div><div className="f2" style={S.card}><div style={{fontSize:12,color:"#6b8aad",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>По видам рыб</div>{sp.map(s=>(<div key={s.n} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:13,fontWeight:700}}>{s.n}</span><span style={{fontSize:12,color:"#5a7a9b"}}>{s.c} шт</span></div><div style={{height:5,background:"#1e3454",borderRadius:3}}><div style={{height:"100%",width:`${s.c/8*100}%`,background:s.cl,borderRadius:3}}/></div></div>))}</div></div>);}

function GearScreen(){return(<div style={{padding:"0 20px 16px"}}><div className="f0" style={{padding:"16px 0"}}><div style={{fontSize:24,fontWeight:900}}>Снаряжение</div></div>{[{icon:"🎋",n:"Maximus BW 2.4м",sub:"Спиннинг · 5-25г",st:"12 улов."},{icon:"🎡",n:"Shimano Stradic 2500",sub:"Катушка · 5.0:1",st:"9 улов."},{icon:"🐛",n:"Rapala X-Rap 10",sub:"Воблер · 10см",st:"8 улов."}].map((g,i)=>(<div key={i} style={{...S.card,display:"flex",alignItems:"center",gap:12,padding:14}}><div style={{fontSize:28,width:48,height:48,borderRadius:12,background:"rgba(168,139,250,.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{g.icon}</div><div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>{g.n}</div><div style={{fontSize:11,color:"#5a7a9b",marginTop:1}}>{g.sub}</div></div><div style={{fontSize:12,color:"#a78bfa",fontWeight:700}}>{g.st}</div></div>))}<button className="btn" style={{width:"100%",padding:14,borderRadius:14,border:"1.5px dashed #264170",background:"transparent",color:"#6b8aad",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit",marginTop:4}}>+ Добавить</button></div>);}

function SpotsScreen(){return(<div style={{padding:"0 20px 16px"}}><div className="f0" style={{padding:"16px 0"}}><div style={{fontSize:24,fontWeight:900}}>Мои места</div></div>{[{n:"Озеро Тихое",c:8,w:12.4,icon:"🏞️",top:true},{n:"Река Ока",c:5,w:8.1,icon:"🌊"},{n:"Пруд Заречный",c:4,w:9.8,icon:"🏕️"}].map((s,i)=>(<div key={i} style={{...S.card,display:"flex",gap:12,padding:14}}><div style={{width:48,height:48,borderRadius:12,background:"linear-gradient(135deg,rgba(14,165,233,.08),rgba(59,130,246,.05))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>{s.icon}</div><div style={{flex:1}}><div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{fontWeight:800,fontSize:15}}>{s.n}</span>{s.top&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:"rgba(234,179,8,.12)",color:"#fbbf24",fontWeight:700}}>⭐</span>}</div><div style={{display:"flex",gap:14,marginTop:6}}><div><span style={{fontWeight:900,color:"#60a5fa"}}>{s.c}</span><span style={{fontSize:10,color:"#5a7a9b"}}> улов.</span></div><div><span style={{fontWeight:900,color:"#4ade80"}}>{s.w}</span><span style={{fontSize:10,color:"#5a7a9b"}}> кг</span></div></div></div></div>))}</div>);}

function SocialScreen(){return(<div style={{padding:"0 20px 16px"}}><div className="f0" style={{padding:"16px 0"}}><div style={{fontSize:24,fontWeight:900}}>Лента</div></div>{[{user:"Алексей",av:"🧔",fish:"Щука 4.8 кг",loc:"Волга",time:"2ч",likes:14},{user:"Марина",av:"👩",fish:"Форель 1.2 кг",loc:"Озеро Светлое",time:"5ч",likes:8}].map((p,i)=>(<div key={i} style={S.card}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#264170,#1e3454)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{p.av}</div><div><div style={{fontWeight:700,fontSize:14}}>{p.user}</div><div style={{fontSize:11,color:"#3d5a80"}}>{p.time} назад</div></div></div><div style={{padding:14,borderRadius:12,background:"rgba(30,52,84,.3)",marginBottom:10}}><div style={{fontSize:16,fontWeight:800}}>🐟 {p.fish}</div><div style={{fontSize:12,color:"#5a7a9b",marginTop:4}}>📍 {p.loc}</div></div><div style={{display:"flex",gap:16}}><span style={{fontSize:13,color:"#6b8aad"}}>❤️ {p.likes}</span><span style={{fontSize:13,color:"#6b8aad"}}>💬</span></div></div>))}</div>);}

function ProfileScreen(){const un=tg?.initDataUnsafe?.user?.first_name||"FisherPro";const uh=tg?.initDataUnsafe?.user?.username||"fisherpro";return(<div style={{padding:"0 20px 16px"}}><div className="f0" style={{textAlign:"center",padding:"20px 0"}}><div style={{width:80,height:80,borderRadius:"50%",background:"linear-gradient(135deg,#264170,#1e3454)",margin:"0 auto 12px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,border:"3px solid #4ade80"}}>🎣</div><div style={{fontSize:22,fontWeight:900}}>{un}</div><div style={{fontSize:13,color:"#5a7a9b",marginTop:2}}>@{uh}</div></div><div className="f1" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>{[{l:"Уловов",v:"124"},{l:"Вес",v:"187 кг"},{l:"Трофеев",v:"8"}].map(s=>(<div key={s.l} style={{...S.miniCard,textAlign:"center"}}><div style={{fontSize:20,fontWeight:900,color:"#4ade80"}}>{s.v}</div><div style={{fontSize:10,color:"#5a7a9b",marginTop:2}}>{s.l}</div></div>))}</div><div className="f2" style={S.card}><div style={{fontSize:12,color:"#6b8aad",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>🏅 Достижения</div><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{["🐟 Первый улов","🏆 Трофейная щука","💯 100 поклёвок","🎯 500 забросов"].map(a=>(<span key={a} style={{padding:"6px 12px",borderRadius:20,background:"rgba(74,222,128,.08)",border:"1px solid rgba(74,222,128,.2)",fontSize:12,fontWeight:600,color:"#4ade80"}}>{a}</span>))}</div></div></div>);}

function TournamentsScreen(){return(<div style={{padding:"0 20px 16px"}}><div className="f0" style={{padding:"16px 0"}}><div style={{fontSize:24,fontWeight:900}}>Турниры</div></div>{[{n:"Щучий март",type:"Публичный",p:"32 уч.",end:"31 мар",prize:"🏆"},{n:"Друзья на Волге",type:"Приватный",p:"5 друзей",end:"25 мар",prize:"🎖"}].map((t,i)=>(<div key={i} style={{...S.card,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={{fontSize:17,fontWeight:800}}>{t.prize} {t.n}</div><span style={{fontSize:10,padding:"3px 10px",borderRadius:10,background:"rgba(74,222,128,.12)",color:"#4ade80",fontWeight:700}}>{t.type}</span></div><div style={{display:"flex",gap:16,fontSize:12,color:"#5a7a9b"}}><span>👥 {t.p}</span><span>📅 до {t.end}</span></div></div>))}</div>);}

function PlanScreen({wd}){const{weather}=wd;return(<div style={{padding:"0 20px 16px"}}><div className="f0" style={{padding:"16px 0"}}><div style={{fontSize:24,fontWeight:900}}>Планирование</div></div><div className="f1" style={S.card}><div style={{fontSize:12,color:"#6b8aad",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>📅 Ближайшие выезды</div>{[{d:"22 мар, Сб",loc:"Озеро Тихое",fc:78,fr:2},{d:"29 мар, Сб",loc:"Река Ока",fc:65,fr:0}].map((p,i)=>(<div key={i} style={{padding:"12px 0",borderBottom:i===0?"1px solid #1e3454":"none",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontWeight:700,fontSize:14}}>{p.d}</div><div style={{fontSize:12,color:"#5a7a9b",marginTop:2}}>📍 {p.loc}{p.fr>0?` · 👥 +${p.fr}`:""}</div></div><div style={{padding:"4px 10px",borderRadius:10,background:p.fc>=70?"rgba(74,222,128,.12)":"rgba(234,179,8,.12)",color:p.fc>=70?"#4ade80":"#fbbf24",fontSize:12,fontWeight:800}}>{p.fc}%</div></div>))}</div><button className="btn f2" style={{width:"100%",padding:14,borderRadius:14,border:"1.5px dashed #264170",background:"transparent",color:"#6b8aad",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>+ Запланировать</button></div>);}


// ═══════════ STYLES ═══════════
const S = {
  phone:{width:"100%",maxWidth:480,minHeight:"100vh",margin:"0 auto",background:"linear-gradient(180deg,#0a1628 0%,#0d1e35 50%,#0f2340 100%)",color:"#e2e8f0",fontFamily:"'Outfit',system-ui,sans-serif",position:"relative",overflow:"hidden"},
  content:{overflowY:"auto",paddingBottom:70},
  tabBar:{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"rgba(10,22,40,.95)",backdropFilter:"blur(20px)",borderTop:"1px solid #1e3454",display:"flex",justifyContent:"space-around",padding:"6px 0 calc(10px + env(safe-area-inset-bottom))",zIndex:10},
  tab:{display:"flex",flexDirection:"column",alignItems:"center",gap:2,border:"none",background:"none",cursor:"pointer",padding:"4px 8px",fontFamily:"'Outfit',system-ui,sans-serif"},
  card:{background:"#111d33",border:"1px solid #1e3454",borderRadius:16,padding:16,marginBottom:10},
  miniCard:{background:"#111d33",border:"1px solid #1e3454",borderRadius:12,padding:12,textAlign:"center"},
  actionBtn:{padding:"18px 8px",borderRadius:16,border:"2px solid",cursor:"pointer",fontFamily:"'Outfit',system-ui,sans-serif",display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center"},
};

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
// KLEVOMETR v10
const OWM_API_KEY = "ae9e552e204ffd1a5534b385a0af66f8";
const SUPABASE_URL = "https://dzdivehecxxaolfohdhg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6ZGl2ZWhlY3h4YW9sZm9oZGhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjY0OTEsImV4cCI6MjA4OTYwMjQ5MX0.PwJofXpZb2BUHoqtOwmHLfAPJkuaGNB2yncyaPF1HKE";
const BOT_USERNAME="klevometr_bot";
const APP_LINK=`https://t.me/${BOT_USERNAME}/klevometr`;
const tg=window.Telegram?.WebApp;
const haptic=(t="light")=>{try{tg?.HapticFeedback?.impactOccurred(t)}catch{}};
const hapticN=(t="success")=>{try{tg?.HapticFeedback?.notificationOccurred(t)}catch{}};
const S={get:(k,d=null)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch{return d}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
const sb={
  h:()=>({apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`,"Content-Type":"application/json",Prefer:"return=representation"}),
  async sel(t,q=""){try{const r=await fetch(`${SUPABASE_URL}/rest/v1/${t}?${q}`,{headers:this.h()});return r.ok?await r.json():[]}catch{return[]}},
  async ins(t,d){try{const r=await fetch(`${SUPABASE_URL}/rest/v1/${t}`,{method:"POST",headers:this.h(),body:JSON.stringify(d)});return r.ok?await r.json():null}catch{return null}},
  async upd(t,m,d){try{const r=await fetch(`${SUPABASE_URL}/rest/v1/${t}?${m}`,{method:"PATCH",headers:this.h(),body:JSON.stringify(d)});return r.ok?await r.json():null}catch{return null}},
  async del(t,m){try{const r=await fetch(`${SUPABASE_URL}/rest/v1/${t}?${m}`,{method:"DELETE",headers:this.h()});return r.ok}catch{return false}},
};
function useSbUser(){const[u,setU]=useState(null);useEffect(()=>{const tu=tg?.initDataUnsafe?.user;if(!tu)return;(async()=>{try{const e=await sb.sel("users",`telegram_id=eq.${tu.id}`);if(e?.length){setU(e[0]);sb.upd("users",`telegram_id=eq.${tu.id}`,{last_seen:new Date().toISOString(),username:tu.username||"",first_name:tu.first_name||""})}else{const n=await sb.ins("users",{telegram_id:tu.id,username:tu.username||"",first_name:tu.first_name||"",avatar_emoji:"🎣",last_seen:new Date().toISOString()});if(n?.[0])setU(n[0])}}catch{}})()},[]);
const up=useCallback(async(f)=>{const tu=tg?.initDataUnsafe?.user;if(!tu)return;
const r=await sb.upd("users",`telegram_id=eq.${tu.id}`,f);if(r?.[0])setU(r[0]);if(f.nickname)S.set("pn",f.nickname);if(f.avatar_emoji)S.set("pa",f.avatar_emoji);if(f.custom_lat!=null)S.set("ml",{lat:f.custom_lat,lon:f.custom_lng,city:f.custom_city||""})},[]);
const cl=useCallback(async()=>{const tu=tg?.initDataUnsafe?.user;if(!tu)return;await sb.upd("users",`telegram_id=eq.${tu.id}`,{custom_lat:null,custom_lng:null,custom_city:null});S.set("ml",null);setU(p=>p?{...p,custom_lat:null,custom_lng:null,custom_city:null}:p)},[]);return{user:u,setUser:setU,updateProfile:up,clearLoc:cl}}
function genCode(){const c="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let r="";for(let i=0;i<6;i++)r+=c[Math.floor(Math.random()*c.length)];return r}
const CITIES=[{n:"Москва",lat:55.7558,lon:37.6173},{n:"Санкт-Петербург",lat:59.9343,lon:30.3351},{n:"Казань",lat:55.7887,lon:49.1221},{n:"Новосибирск",lat:55.0084,lon:82.9357},{n:"Екатеринбург",lat:56.8389,lon:60.6057},{n:"Н.Новгород",lat:56.2965,lon:43.9361},{n:"Ростов-на-Дону",lat:47.2357,lon:39.7015},{n:"Красноярск",lat:56.0153,lon:92.8932},{n:"Воронеж",lat:51.672,lon:39.1843},{n:"Краснодар",lat:45.0355,lon:38.9753},{n:"Астрахань",lat:46.3497,lon:48.0408},{n:"Волгоград",lat:48.708,lon:44.5133}];
function useSync(key,def,table=null){const[data,setData]=useState(()=>S.get(key,def));
const save=useCallback(u=>{setData(p=>{const n=typeof u==="function"?u(p):u;S.set(key,n);if(table){const tu=tg?.initDataUnsafe?.user;if(tu&&Array.isArray(n)&&n.length>(Array.isArray(p)?p.length:0))sb.ins(table,{...n[0],telegram_id:tu.id}).catch(()=>{})}return n})},[key,table]);return[data,save,setData]}
let ac=null;
function gAC(){if(!ac)ac=new(window.AudioContext||window.webkitAudioContext)();if(ac.state==="suspended")ac.resume();return ac}
function mkN(c,d){const b=c.createBuffer(1,c.sampleRate*d,c.sampleRate);
const a=b.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;return b}
function pCast(){try{const c=gAC(),t=c.currentTime,m=c.createGain();m.gain.setValueAtTime(.4,t);m.connect(c.destination);
const n=c.createBufferSource();n.buffer=mkN(c,.25);
const f=c.createBiquadFilter();f.type="bandpass";f.frequency.setValueAtTime(3000,t);f.frequency.exponentialRampToValueAtTime(400,t+.2);
const g=c.createGain();g.gain.setValueAtTime(.5,t);g.gain.exponentialRampToValueAtTime(.01,t+.22);n.connect(f);f.connect(g);g.connect(m);n.start(t);n.stop(t+.25)}catch{}}
function pBite(){try{const c=gAC(),t=c.currentTime,m=c.createGain();m.gain.setValueAtTime(.35,t);m.connect(c.destination);[845,1688].forEach(freq=>{[0,.18].forEach(off=>{const o=c.createOscillator();o.type="sine";o.frequency.setValueAtTime(freq,t+off);
const g=c.createGain();g.gain.setValueAtTime(0,t+off);g.gain.linearRampToValueAtTime(.2,t+off+.003);g.gain.exponentialRampToValueAtTime(.001,t+off+.8);o.connect(g);g.connect(m);o.start(t+off);o.stop(t+off+.85)})})}catch{}}
function pCaught(){try{const c=gAC(),t=c.currentTime,m=c.createGain();m.gain.setValueAtTime(.35,t);m.connect(c.destination);[523.25,659.25,783.99].forEach((f,i)=>{const o=c.createOscillator();o.type="sine";
const g=c.createGain();
const s=t+.15+i*.12;o.frequency.setValueAtTime(f,s);g.gain.setValueAtTime(0,s);g.gain.linearRampToValueAtTime(.2,s+.02);g.gain.exponentialRampToValueAtTime(.01,s+.5);o.connect(g);g.connect(m);o.start(s);o.stop(s+.55)})}catch{}}
const N={name:"Полночь на воде",bg:"#080808",accent:"#b0c8e8",accentGrad:"linear-gradient(135deg,#7aa8d0,#b0c8e8)",accentSoft:"rgba(176,200,232,0.08)",accentBorder:"rgba(176,200,232,0.18)",text:"#d8e0ec",textSecondary:"#8898b8",textMuted:"#6878a0",textDim:"#3a4468",card:"rgba(12,14,24,0.65)",cardBorder:"rgba(176,200,232,0.06)",glass:{background:"rgba(12,14,24,0.65)",border:"1px solid rgba(176,200,232,0.06)",backdropFilter:"blur(20px)",boxShadow:"0 4px 24px rgba(0,0,0,0.25),inset 0 1px 0 rgba(255,255,255,0.03)"},stats:["#b0c8e8","#a0b888","#d0b878","#c0a0b0"],scoreColors:{great:"#7dd3a0",good:"#d4c87a",weak:"#d4a06a",bad:"#d47a7a"},tabBg:"rgba(6,8,14,0.92)",tabBorder:"rgba(176,200,232,0.05)",tabActive:"#b0c8e8",tabInactive:"#3a4468",inputBg:"rgba(176,200,232,0.04)",inputBorder:"rgba(176,200,232,0.08)",btnPrimary:"linear-gradient(135deg,#6a98c0,#4878a0)",btnDanger:"rgba(200,100,100,0.08)",btnDangerBorder:"rgba(200,100,100,0.25)",btnDangerColor:"#d08080",isDark:true};
const D={name:"Утро на воде",bg:"#e0e8f0",accent:"#2a6090",accentGrad:"linear-gradient(135deg,#2a6090,#3880b8)",accentSoft:"rgba(42,96,144,0.08)",accentBorder:"rgba(42,96,144,0.18)",text:"#1a2a3a",textSecondary:"#3a5470",textMuted:"#5a7088",textDim:"#8a9aaa",card:"rgba(255,255,255,0.55)",cardBorder:"rgba(42,96,144,0.08)",glass:{background:"rgba(255,255,255,0.55)",border:"1px solid rgba(42,96,144,0.08)",backdropFilter:"blur(20px)",boxShadow:"0 4px 24px rgba(0,0,0,0.06),inset 0 1px 0 rgba(255,255,255,0.6)"},stats:["#2a6090","#4a8848","#b08830","#8868a0"],scoreColors:{great:"#38a868",good:"#b0a030",weak:"#c08030",bad:"#c05050"},tabBg:"rgba(230,238,246,0.92)",tabBorder:"rgba(42,96,144,0.08)",tabActive:"#2a6090",tabInactive:"#8a9aaa",inputBg:"rgba(42,96,144,0.05)",inputBorder:"rgba(42,96,144,0.12)",btnPrimary:"linear-gradient(135deg,#2a6090,#3880b8)",btnDanger:"rgba(200,60,60,0.06)",btnDangerBorder:"rgba(200,60,60,0.2)",btnDangerColor:"#c05050",isDark:false};
function useTheme(){const[n,setN]=useState(()=>{try{return localStorage.getItem("klevometr_theme")==="night"}catch{return false}});
const toggle=useCallback(()=>{setN(p=>{const x=!p;try{localStorage.setItem("klevometr_theme",x?"night":"day")}catch{}haptic("medium");return x})},[]);return{isNight:n,toggle,v:n?N:D}}
function getDayLen(lat,doy){const d=23.45*Math.sin((2*Math.PI*(284+doy))/365);
const dr=d*Math.PI/180;
const lr=lat*Math.PI/180;
const c=-Math.tan(lr)*Math.tan(dr);if(c<=-1)return 24;if(c>=1)return 0;return (2*Math.acos(c)*24)/(2*Math.PI)}
function estO2(wt){const T=wt+273.15;return Math.max(0,Math.min(20,Math.exp(-173.4292+(249.6339*100/T)+143.3483*Math.log(T/100)-21.8492*(T/100))))}
function pTrend(fc,td){if(!fc||fc.length<2)return{trend:0,label:"стабильно",factor:.7,icon:"→"};
const ds=td.toISOString().split("T")[0];let it=fc.filter(f=>f.dt_txt.startsWith(ds));if(it.length<2)it=[...fc].sort((a,b)=>Math.abs(new Date(a.dt_txt)-td)-Math.abs(new Date(b.dt_txt)-td)).slice(0,3);if(it.length<2)return{trend:0,label:"стабильно",factor:.7,icon:"→"};
const ps=it.map(f=>f.main.pressure*.750062);
const delta=ps[ps.length-1]-ps[0];
const abs=Math.abs(delta);if(abs<2)return{trend:delta,label:"стабильно",factor:.85,icon:"→"};if(delta>0&&abs<5)return{trend:delta,label:"растёт",factor:.7,icon:"↗"};if(delta>0)return{trend:delta,label:"резко растёт",factor:.4,icon:"⬆"};if(delta<0&&abs<5)return{trend:delta,label:"падает",factor:.75,icon:"↘"};return{trend:delta,label:"резко падает",factor:.35,icon:"⬇"}}
function getMoon(date=new Date()){const y=date.getFullYear(),m=date.getMonth()+1,d=date.getDate();let c=0,jd=0;if(m<=2){jd=365.25*(y+4715+Math.floor((m-1+10)/12));c=Math.floor(30.6001*(m+13))}else{jd=Math.floor(365.25*(y+4716));c=Math.floor(30.6001*(m+1))}
const j=jd+c+d-1524.5;
const ph=((j-2451550.1)/29.530588853)%1;
const p=ph<0?ph+1:ph;
const phases=[{name:"Новолуние",icon:"🌑",factor:.4},{name:"Растущий серп",icon:"🌒",factor:.6},{name:"Первая четверть",icon:"🌓",factor:.75},{name:"Растущая луна",icon:"🌔",factor:.9},{name:"Полнолуние",icon:"🌕",factor:1},{name:"Убывающая луна",icon:"🌖",factor:.85},{name:"Третья четверть",icon:"🌗",factor:.65},{name:"Убывающий серп",icon:"🌘",factor:.45}];return phases[Math.floor(p*8)%8]}
function reqGeo(){return new Promise((res,rej)=>{if(tg?.LocationManager){tg.LocationManager.init(()=>{if(tg.LocationManager.isLocationAvailable)tg.LocationManager.getLocation(l=>l?res({lat:l.latitude,lon:l.longitude}):bGeo(res,rej));else bGeo(res,rej)})}else bGeo(res,rej)})}
function bGeo(res,rej){navigator.geolocation?.getCurrentPosition(p=>res({lat:p.coords.latitude,lon:p.coords.longitude}),()=>rej("no"),{timeout:10000,maximumAge:300000})}
async function fetchW(lat,lon){try{const r=await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=ru&appid=${OWM_API_KEY}`);
const d=await r.json();return{temp:Math.round(d.main.temp),pressure:Math.round(d.main.pressure*.750062),humidity:d.main.humidity,wind:d.wind.speed.toFixed(1),windDeg:d.wind.deg,clouds:d.clouds.all,icon:d.weather[0]?.icon,cityName:d.name,waterTemp:Math.max(0,Math.round(d.main.temp-3-Math.random()*2))}}catch{return null}}
async function fetchFC(lat,lon){try{const r=await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&lang=ru&appid=${OWM_API_KEY}`);
const d=await r.json();return d.list||[]}catch{return[]}}
const REGIONS=[{lat:47.23,lon:39.70,r:180,fish:["Щука","Окунь","Судак","Карп","Карась","Лещ","Сом","Плотва","Жерех"],note:"Нижний Дон"},{lat:55.76,lon:37.62,r:150,fish:["Щука","Окунь","Судак","Карп","Карась","Лещ","Сом","Плотва","Жерех","Налим"],note:"Подмосковье"},{lat:59.93,lon:30.34,r:200,fish:["Щука","Окунь","Судак","Карп","Карась","Лещ","Сом","Плотва","Налим","Форель"],note:"Ленобласть"},{lat:55.79,lon:49.12,r:180,fish:["Щука","Окунь","Судак","Карп","Карась","Лещ","Сом","Плотва","Жерех","Налим"],note:"Татарстан"},{lat:56.84,lon:60.61,r:200,fish:["Щука","Окунь","Судак","Карп","Карась","Лещ","Плотва","Налим","Форель"],note:"Урал"},{lat:55.01,lon:82.94,r:200,fish:["Щука","Окунь","Судак","Карп","Карась","Лещ","Плотва","Налим"],note:"Новосибирск"},{lat:45.04,lon:38.98,r:180,fish:["Щука","Окунь","Судак","Карп","Карась","Лещ","Сом","Плотва","Жерех"],note:"Краснодар"},{lat:46.35,lon:48.04,r:150,fish:["Щука","Окунь","Судак","Карп","Карась","Лещ","Сом","Плотва","Жерех"],note:"Астрахань"},{lat:56.02,lon:92.89,r:250,fish:["Щука","Окунь","Лещ","Карась","Плотва","Налим","Форель"],note:"Красноярск"}];
function getRegion(lat,lon){if(!lat||!lon)return null;let best=null,bd=Infinity;for(const r of REGIONS){const dl=(r.lat-lat)*111,dn=(r.lon-lon)*111*Math.cos(lat*Math.PI/180),d=Math.sqrt(dl*dl+dn*dn);if(d<r.r&&d<bd){bd=d;best=r}}return best}
function getLocalFish(lat,lon){const r=getRegion(lat,lon);if(!r)return{fish:Object.keys(FP),region:null,note:"Все виды"};return{fish:r.fish.filter(f=>FP[f]),region:r,note:r.note}}
const FP={
"Щука":{emoji:"🐟",type:"predator",latin:"Esox lucius",wt:{min:4,act:8,pL:12,pH:19,dec:23,max:26},pr:{ideal:748,range:12,low:true,tw:.8},o2:{min:3,opt:6},ha:[.1,.05,.05,.1,.2,.5,.8,.9,.7,.5,.3,.2,.15,.15,.2,.3,.5,.7,.9,.85,.6,.4,.2,.15],sa:[.3,.3,.5,.8,.95,.7,.5,.6,.8,1,.7,.4],oc:true,wTol:7,gwd:["Ю","ЮЗ","З"],sp:2,pp:"long",ss:.6,desc:"Засадный хищник. Охотится из укрытий — коряги, трава, кувшинки. Атакует стремительным броском.",habitat:"Заросли, коряжник, бровки, свалы. Мелководье весной и осенью, глубина летом.",technique:"Спиннинг: воблеры, джерки, колебалки, силикон. Живцовая: жерлицы зимой, кружки летом.",tips:{g:"Крупные воблеры, джерки! У коряг. Агрессивная проводка с паузами.",ok:"Колебалки. Кувшинки и камыш. Утро и вечер.",w:"Мелкие приманки, медленная проводка у дна.",b:"Живец на жерлице."}},
"Окунь":{emoji:"🐠",type:"predator",latin:"Perca fluviatilis",wt:{min:4,act:8,pL:16,pH:22,dec:25,max:28},pr:{ideal:760,range:8,low:false,tw:.5},o2:{min:3,opt:7},ha:[.05,.05,.05,.1,.3,.6,.9,.95,.8,.6,.4,.3,.25,.3,.35,.5,.7,.9,.85,.7,.4,.2,.1,.05],sa:[.5,.5,.6,.8,.9,.8,.7,.75,.9,1,.6,.5],oc:false,wTol:5,gwd:["Ю","ЮЗ","З","ЮВ"],sp:3,pp:"any",ss:.4,desc:"Стайный хищник. Охотится загоном, образуя «котлы». Любопытен.",habitat:"Свалы, бровки, заросли. Мелкий — у берега. Горбач — на глубине.",technique:"Лёгкий спиннинг: вращалки 2-7г, микроджиг, попперы, отводной.",tips:{g:"Котлы! Вращалки, микроджиг, попперы.",ok:"Мелкие блёсны, отводной поводок.",w:"Микроджиг с пассивкой.",b:"Червь на поплавок."}},
"Судак":{emoji:"🐟",type:"predator",latin:"Sander lucioperca",wt:{min:4,act:6,pL:16,pH:22,dec:26,max:28},pr:{ideal:760,range:6,low:false,tw:.7},o2:{min:4,opt:8},ha:[.3,.2,.15,.2,.3,.5,.6,.5,.3,.2,.15,.1,.1,.1,.1,.15,.3,.5,.7,.9,1,.8,.5,.4],sa:[.3,.3,.5,.8,.9,.8,.6,.7,.9,1,.6,.3],oc:true,wTol:6,gwd:["Ю","ЮЗ"],sp:4,pp:"short",ss:.8,desc:"Глубинный ночной хищник. Предпочитает жёсткое дно — песок, камень, ракушечник.",habitat:"Русловые бровки, ямы, свалы с жёстким дном. Ночью — мелководье.",technique:"Джиг: силикон, поролон, мандулы. Отводной. Ночная ловля на воблеры.",tips:{g:"Джиг на бровках! Вечер и ночь.",ok:"Поролонки, мандулы. Жёсткое дно.",w:"Отводной с пассивкой. Ночь.",b:"Тяжёлый джиг по ямам."}},
"Карп":{emoji:"🐡",type:"peaceful",latin:"Cyprinus carpio",wt:{min:8,act:14,pL:20,pH:28,dec:30,max:32},pr:{ideal:758,range:14,low:false,tw:.3},o2:{min:2,opt:5},ha:[.3,.2,.15,.2,.3,.4,.5,.6,.5,.3,.2,.15,.1,.15,.2,.3,.5,.6,.7,.8,.9,1,.7,.5],sa:[.05,.05,.1,.3,.6,.8,.9,1,.8,.5,.2,.05],oc:false,wTol:4,gwd:["Ю","ЮЗ","ЮВ"],sp:4,pp:"long",ss:.3,desc:"Мощная мирная рыба. Осторожен. Растёт до 30+ кг.",habitat:"Заиленные участки, ракушечник. Тёплые заливы весной.",technique:"Карпфишинг: бойлы, пеллетс, кукуруза. Волосяная оснастка. Фидер.",tips:{g:"Бойлы, кукуруза, пеллетс! Ночь.",ok:"Волосяная оснастка.",w:"PVA-пакеты. Тонкие поводки.",b:"Зиг-риг в толще воды."}},
"Карась":{emoji:"🐠",type:"peaceful",latin:"Carassius carassius",wt:{min:6,act:12,pL:18,pH:25,dec:28,max:30},pr:{ideal:758,range:16,low:false,tw:.2},o2:{min:1,opt:4},ha:[.1,.05,.05,.1,.2,.5,.8,.9,.7,.5,.3,.2,.15,.15,.2,.4,.6,.8,.9,.8,.5,.3,.2,.15],sa:[.05,.05,.1,.4,.7,.9,1,.9,.7,.4,.1,.05],oc:false,wTol:4,gwd:["Ю","ЮЗ","ЮВ","В"],sp:4,pp:"long",ss:.2,desc:"Самая живучая рыба. Выживает при минимальном кислороде.",habitat:"Пруды, заросшие озёра, карьеры. Илистое дно, камыш.",technique:"Поплавок, лёгкий фидер. Червь, опарыш, манка, кукуруза.",tips:{g:"Червь, опарыш, манка! Прикормка.",ok:"Бутерброд у камыша.",w:"Тесто с чесноком.",b:"Навозный червь."}},
"Лещ":{emoji:"🐟",type:"peaceful",latin:"Abramis brama",wt:{min:5,act:10,pL:15,pH:20,dec:23,max:25},pr:{ideal:757,range:8,low:false,tw:.7},o2:{min:3,opt:7},ha:[.15,.1,.1,.2,.4,.7,.9,.8,.5,.3,.2,.15,.1,.15,.3,.5,.7,.85,.9,1,.7,.4,.25,.2],sa:[.1,.1,.2,.5,.8,.9,1,.9,.7,.5,.2,.1],oc:true,wTol:5,gwd:["Ю","ЮЗ","ЮВ"],sp:4,pp:"any",ss:.5,desc:"Стайная донная рыба. Роется в грунте. Чувствителен к давлению.",habitat:"Ямы, бровки, свалы. Глинистое и песчаное дно. 4-8м.",technique:"Фидер. Мотыль, опарыш, червь. Прикормка обязательна.",tips:{g:"Фидер с мотылём! Бровки.",ok:"Кормушка 40-60г. Пучок мотыля.",w:"Тонкие поводки. Ночь.",b:"Подлещик на мелководье."}},
"Сом":{emoji:"🐟",type:"predator",latin:"Silurus glanis",wt:{min:10,act:16,pL:22,pH:28,dec:30,max:32},pr:{ideal:755,range:10,low:true,tw:.5},o2:{min:2,opt:5},ha:[.6,.5,.4,.3,.2,.15,.1,.1,.05,.05,.05,.05,.05,.05,.05,.1,.2,.4,.6,.8,.9,1,.9,.7],sa:[0,0,.05,.2,.5,.8,.9,1,.8,.4,.1,0],oc:true,wTol:6,gwd:["Ю","ЮЗ"],sp:5,pp:"short",ss:.7,desc:"Крупнейший пресноводный хищник Европы. Ночной. До 100+ кг.",habitat:"Русловые ямы, омуты, затопленные деревья. 5-20м.",technique:"Квок, донка с живцом. Ночная ловля 20:00 — рассвет.",tips:{g:"Квок, живец, выползки! Ямы ночью.",ok:"Крупный живец.",w:"Кусочки рыбы на донке.",b:"Ждите потепления."}},
"Плотва":{emoji:"🐟",type:"peaceful",latin:"Rutilus rutilus",wt:{min:4,act:8,pL:15,pH:20,dec:24,max:26},pr:{ideal:758,range:12,low:false,tw:.4},o2:{min:3,opt:6},ha:[.1,.05,.05,.1,.3,.6,.8,.9,.7,.5,.4,.3,.25,.3,.35,.5,.7,.85,.9,.7,.4,.2,.15,.1],sa:[.3,.3,.5,.8,1,.8,.7,.7,.8,.7,.4,.3],oc:false,wTol:5,gwd:["Ю","ЮЗ","З","ЮВ"],sp:3,pp:"any",ss:.3,desc:"Массовый вид. Всеядна. Индикатор — где плотва, там хищник.",habitat:"У травы, на течении, свалы. Зимой — ямы.",technique:"Поплавок, лёгкий фидер. Мотыль, опарыш, перловка.",tips:{g:"Опарыш, мотыль, перловка!",ok:"Мелкие крючки, тонкая леска.",w:"Бутерброд мотыль+опарыш.",b:"Тонкая оснастка, мотыль."}},
"Жерех":{emoji:"🐟",type:"predator",latin:"Leuciscus aspius",wt:{min:8,act:14,pL:20,pH:26,dec:28,max:30},pr:{ideal:762,range:8,low:false,tw:.5},o2:{min:5,opt:9},ha:[.05,.05,.05,.1,.3,.7,.9,1,.7,.4,.3,.2,.15,.2,.3,.5,.7,.9,.8,.5,.2,.1,.05,.05],sa:[0,0,.1,.3,.6,.8,.9,1,.9,.5,.1,0],oc:false,wTol:5,gwd:["Ю","ЮЗ","З"],sp:3,pp:"long",ss:.4,desc:"Единственный хищник карповых. Бьёт малька хвостом — «бой».",habitat:"Перекаты, косы, мосты, быстрины.",technique:"Кастмастер, пилькер, бомбарда + стример. Дальний заброс.",tips:{g:"Кастмастер! Дальний заброс на перекаты.",ok:"Блёсны 15-25г, бомбарда.",w:"Тонкий шнур, прозрачные приманки.",b:"Глубоководные воблеры."}},
"Форель":{emoji:"🐟",type:"predator",latin:"Salmo trutta",wt:{min:2,act:5,pL:10,pH:16,dec:19,max:22},pr:{ideal:758,range:10,low:true,tw:.6},o2:{min:6,opt:10},ha:[.1,.05,.05,.15,.3,.6,.8,.9,.7,.5,.3,.2,.2,.25,.3,.5,.7,.9,.85,.6,.3,.2,.15,.1],sa:[.5,.5,.6,.8,.9,.7,.4,.5,.8,1,.7,.5],oc:true,wTol:4,gwd:["З","ЮЗ","С"],sp:9,pp:"short",ss:.5,desc:"Лососевые. Требует холодную чистую воду. Стресс >20°C.",habitat:"Горные реки, ручьи, холодные озёра. За камнями.",technique:"Ультралайт: вращалки, микроколебалки, крэнки. Нахлыст.",tips:{g:"Вращалки, микроколебалки, нимфы!",ok:"Крэнки до 5см, мушки.",w:"Тонкая леска, натуральные приманки.",b:"Ищи холодные притоки."}},
"Налим":{emoji:"🐟",type:"predator",latin:"Lota lota",wt:{min:0,act:1,pL:1,pH:6,dec:12,max:16},pr:{ideal:755,range:15,low:true,tw:.2},o2:{min:4,opt:10},ha:[.7,.6,.5,.4,.2,.1,.05,.05,.05,.05,.05,.05,.05,.05,.05,.1,.2,.4,.6,.8,.9,1,.9,.8],sa:[1,.9,.6,.2,.05,0,0,0,.1,.3,.7,.9],oc:true,wTol:10,gwd:["С","СВ","СЗ"],sp:0,pp:"short",ss:.2,desc:"Единственный пресноводный тресковый. Ночной. Нерест зимой.",habitat:"Каменистое дно, коряги. Холодные реки севера.",technique:"Донка: живец, нарезка рыбы, пучок червей. Только ночь.",tips:{g:"Живец, нарезка, выползки! Ночью.",ok:"Куриная печень.",w:"Мелкий ёрш. Только ночь.",b:"Слишком тепло. Ждите <12°С."}},
};
function estWT(at,m){const l=[5,4,3,2,1,0,-1,0,1,2,3,4][m]||0;return Math.max(0,Math.min(35,at-l))}
function getSeason(m){return m>=2&&m<=4?1:m>=5&&m<=7?2:m>=8&&m<=10?3:0}
function getSeasonName(m){return["Зима","Весна","Лето","Осень"][getSeason(m)]}
function cFS(fn,w,moon,h,m,lat,fc,td){const p=FP[fn];if(!p)return{score:50,level:"ok",tip:""};
const wt=w?.waterTemp??estWT(w?.temp??15,m);
const tp=p.wt;let tS=0;if(wt<tp.min||wt>tp.max)tS=0;else if(wt>=tp.pL&&wt<=tp.pH)tS=1;else if(wt>=tp.act&&wt<tp.pL)tS=.4+.6*((wt-tp.act)/Math.max(1,tp.pL-tp.act));else if(wt>tp.pH&&wt<=tp.dec)tS=.4+.6*((tp.dec-wt)/Math.max(1,tp.dec-tp.pH));else if(wt<tp.act)tS=.1+.3*((wt-tp.min)/Math.max(1,tp.act-tp.min));else tS=.1+.3*((tp.max-wt)/Math.max(1,tp.max-tp.dec));
const pr=w?.pressure??760;let pS=Math.max(0,1-Math.abs(pr-p.pr.ideal)/p.pr.range);if(p.pr.low&&pr<p.pr.ideal)pS=Math.min(1,pS+.15);
const pt=pTrend(fc,td||new Date());let trS=pt.factor*(p.pr.tw||.5);if(p.type==="predator"&&pt.trend<-2)trS=Math.min(1,trS+.3);
const o2=estO2(wt);let o2S=p.o2?(o2<p.o2.min?.1:o2>=p.o2.opt?1:.3+.7*((o2-p.o2.min)/Math.max(1,p.o2.opt-p.o2.min))):.5;
const hS=p.ha[Math.min(23,Math.max(0,h))]||.3;let sS=p.sa[m]||.3;
const isSpawn=m===p.sp||(m===p.sp+1);if(isSpawn)sS*=.4;
const cS=p.oc?((w?.clouds??50)>70?1:.5):((w?.clouds??50)<30?.9:.6);
const ws=parseFloat(w?.wind)||0;
const wS=ws<=1?.6:ws<=3?.8:ws<=p.wTol?.7:.2;let wdS=.5;if(w?.windDeg!=null){const d=["С","СВ","В","ЮВ","Ю","ЮЗ","З","СЗ"][Math.round(w.windDeg/45)%8];wdS=p.gwd.includes(d)?.9:.35}
const doy=Math.floor(((td||new Date())-new Date((td||new Date()).getFullYear(),0,0))/86400000)||1;
const dl=getDayLen(lat||55.75,doy);let phS=.6;if(p.pp==="long")phS=Math.min(1,dl/16);else if(p.pp==="short")phS=Math.min(1,(24-dl)/16);
const raw=tS*22+pS*10+trS*15+o2S*8+hS*13+sS*10+cS*5+wS*5+wdS*3+phS*4+(p.ss||.5)*(moon?.factor||.5)*5;
const score=Math.round(Math.max(5,Math.min(95,raw)));let level,tip;if(score>=70){level="g";tip=p.tips.g}else if(score>=45){level="ok";tip=p.tips.ok}else if(score>=25){level="w";tip=p.tips.w}else{level="b";tip=p.tips.b}return{score,level,tip,isSpawn,waterTemp:Math.round(wt),o2:o2.toFixed(1),pTrend:pt,dayLength:dl.toFixed(1),factors:{temp:Math.round(tS*100),pressure:Math.round(pS*100),trend:Math.round(trS*100),o2:Math.round(o2S*100),hour:Math.round(hS*100),season:Math.round(sS*100)}}}
function compAdv(w,moon,h,lat,lon,fc,td){const m=(td||new Date()).getMonth();
const lf=getLocalFish(lat,lon);
const all=lf.fish.map(f=>({fish:f,emoji:FP[f]?.emoji||"🐟",...cFS(f,w,moon,h,m,lat,fc,td)}));
const top=[...all].sort((a,b)=>b.score-a.score).slice(0,3);
const avg=all.length?Math.round(all.reduce((a,s)=>a+s.score,0)/all.length):50;return{score:Math.max(5,Math.min(95,avg)),topFish:top,allScores:all,month:m,season:getSeasonName(m),region:lf.region,regionNote:lf.note}}
function simScore(h){return (h>=5&&h<=8)||(h>=18&&h<=21)?70:h>=12&&h<=14?35:50}
function getBS(w,moon,h){return w?compAdv(w,moon,h).score:simScore(h)}
function gSC(s,v){const c=v?.scoreColors||N.scoreColors;return s>=70?c.great:s>=45?c.good:s>=25?c.weak:c.bad}
function gSL(s){return s>=70?"Отличный":s>=45?"Хороший":s>=25?"Слабый":"Плохой"}
function wE(i){if(!i)return"🌤";if(i.includes("01"))return"☀️";if(i.includes("02"))return"⛅";if(i.includes("03")||i.includes("04"))return"☁️";if(i.includes("09")||i.includes("10"))return"🌧";return"🌤"}
function wD(d){return d==null?"":["С","СВ","В","ЮВ","Ю","ЮЗ","З","СЗ"][Math.round(d/45)%8]}
function useWeather(){const[w,setW]=useState(null);const[fc,setFC]=useState(null);const[ld,setLd]=useState(true);const[ln,setLN]=useState("");const[gc,setGC]=useState(null);const[ml,setML]=useState(()=>S.get("ml",null));useEffect(()=>{(async()=>{setLd(true);try{let lat,lon;if(ml){lat=ml.lat;lon=ml.lon}else{try{const p=await reqGeo();lat=p.lat;lon=p.lon}catch{lat=55.75;lon=37.62}}setGC({lat,lon});const[we,f]=await Promise.all([fetchW(lat,lon),fetchFC(lat,lon)]);if(we){setW(we);setLN(we.cityName||"")}if(f)setFC(f)}catch{}setLd(false)})()},[ml]);return{weather:w,forecast:fc,loading:ld,locationName:ln,setManualLocation:setML,geoCoords:gc}}
const SC={home:"home",session:"session",diary:"diary",addCatch:"addCatch",viewCatch:"viewCatch",forecast:"forecast",stats:"stats",guide:"guide",guideFish:"guideFish",guideFishD:"guideFishD",guideKnots:"guideKnots",guideKnotD:"guideKnotD",guideRigs:"guideRigs",guideTactics:"guideTactics",gear:"gear",addGear:"addGear",social:"social",spots:"spots",addSpot:"addSpot",profile:"profile",tournaments:"tournaments",plan:"plan",map:"map",friends:"friends",editProfile:"editProfile",locPicker:"locPicker",tView:"tView",tJoin:"tJoin"};
const FISH_LIST=["Щука","Окунь","Судак","Карп","Карась","Лещ","Сом","Плотва","Жерех","Форель","Налим","Язь","Голавль"];
const BAITS=["Воблер","Блесна вращ.","Блесна колебл.","Джиг","Твистер","Виброхвост","Червь","Опарыш","Мотыль","Кукуруза","Живец","Бойл","Тесто"];
const GEAR_T=["Удилище","Катушка","Леска","Шнур","Приманка","Крючки","Поплавок","Грузило","Подсак","Эхолот","Прочее"];
const FE={"Щука":"🐟","Окунь":"🐠","Судак":"🐟","Карп":"🐡","Форель":"🐟","Сом":"🐟","Лещ":"🐟","Карась":"🐠","Плотва":"🐟","Жерех":"🐟"};
const fE=f=>FE[f]||"🐟";
const PP_TEXT=`ПОЛИТИКА ОБРАБОТКИ ПЕРСОНАЛЬНЫХ ДАННЫХ\nДата: 27.03.2026 · ФЗ №152\n\nСобираемые данные: Telegram ID, имя, username, геолокация, данные об уловах.\nЦели: функционирование приложения, прогноз клёва, турниры.\nХранение: Supabase, шифрование.\nТретьи лица: данные не передаются (кроме публичного профиля).\nПрава: просмотр, изменение, удаление, режим «Невидимка».\nИспользование = согласие.\nКонтакт: @${BOT_USERNAME}`;
const KNOTS=[
{id:"palomar",name:"Паломар",cat:"К крючку",diff:1,str:95,desc:"Самый надёжный. Для плетёнки и монолески.",steps:["Сложи леску пополам (15-20 см)","Продень петлю в ушко","Завяжи простой узел петлёй","Накинь петлю на крючок","Смочи и затяни"],color:"#4a90c0"},
{id:"clinch",name:"Улучш. клинч",cat:"К крючку",diff:1,str:90,desc:"Классический. Прост, надёжен для моно.",steps:["Продень в ушко (10-15 см)","5-7 оборотов вокруг основной","Продень в петлю у ушка","Продень в большую петлю","Смочи и затяни"],color:"#48a868"},
{id:"rapala",name:"Рапала",cat:"К приманке",diff:2,str:85,desc:"Петлевой — свобода движения приманки.",steps:["Простой узел на леске","Конец через ушко приманки","Обратно через простой узел","3-4 оборота вокруг основной","Обратно через узел, затяни"],color:"#c08030"},
{id:"albright",name:"Олбрайт",cat:"Соединение",diff:2,str:88,desc:"Для лесок разного диаметра.",steps:["Толстую сложи петлёй","Тонкую через петлю","10-12 оборотов","Обратно через петлю","Затяни оба конца"],color:"#8868a0"},
{id:"morkovka",name:"Морковка",cat:"Соединение",diff:3,str:92,desc:"Лучший для шнур+флюр. Компактный.",steps:["Простой узел на флюорокарбоне","Шнур через узел (30 см)","8-10 оборотов вперёд","8-10 оборотов назад","Обратно через узел, затяни"],color:"#c05050"},
{id:"fig8",name:"Восьмёрка",cat:"Петлевой",diff:1,str:80,desc:"Простая петля. «Петля в петлю».",steps:["Сложи пополам (10-15 см)","Один оборот петлёй","Продень через образовавшуюся петлю","Смочи и затяни","Фигура «8»"],color:"#4a8848"},
{id:"uni",name:"Юни/Гриннер",cat:"Универсальный",diff:2,str:90,desc:"Работает для всего. Отлично на плетёнке.",steps:["Продень в ушко, сложи петлю","5-6 оборотов через петлю","Затяни, подтяни к ушку","Обрежь кончик","Для соединения — два навстречу"],color:"#2a6090"},
{id:"snell",name:"Безузловая",cat:"К крючку",diff:2,str:95,desc:"Витки без узла. Макс. прочность.",steps:["Леску через ушко","Прижми к цевью","6-8 оборотов вокруг","Конец через ушко","Затяни, проверь"],color:"#b08830"},
];
const RIGS=[
{id:"otv",name:"Отводной поводок",tgt:"Окунь, судак",desc:"Грузило на конце, поводок выше 20-30 см. Волочение по дну.",comp:"Грузило 10-30г, поводок 0.8-1.2м флюр, офсетник, силикон",dg:"v"},
{id:"ds",name:"Дроп-шот",tgt:"Окунь, судак",desc:"Грузило снизу, крючок посередине. Игра на месте.",comp:"Грузило 5-20г, крючок, силикон 5-7 см",dg:"v"},
{id:"car",name:"Каролина",tgt:"Окунь, щука",desc:"Скользящее грузило, поводок 50-100 см. Проходит коряжник.",comp:"Грузило-пуля 7-21г, бусинка, вертлюг, поводок, офсетник",dg:"h"},
{id:"tex",name:"Техас",tgt:"Щука, окунь",desc:"Грузило-пуля перед крючком. Незацепляемость.",comp:"Грузило-пуля 5-15г, офсетник, силикон",dg:"h"},
{id:"feed",name:"Патерностер",tgt:"Лещ, плотва, карась",desc:"Кормушка на отводе. Поводок ниже. Самоподсечка.",comp:"Кормушка 20-80г, поводок 30-80 см моно, крючок №10-16",dg:"v"},
{id:"hair",name:"Волосяная",tgt:"Карп",desc:"Бойл на «волосе» ниже крючка. Стандарт карпфишинга.",comp:"Крючок карповый №4-8, волос, стопор, бойл",dg:"k"},
];
const TACTICS=[
{season:"Весна",icon:"🌱",title:"Преднерестовый жор",tips:["Рыба активно питается перед нерестом","Мелководье у прогретых участков","Натуральные наживки эффективнее","Медленная проводка","Щука активна до +15°C"]},
{season:"Лето",icon:"☀️",title:"Ловля на зорьках",tips:["Днём рыба на глубине","Лучшее время: 4-8 и 19-22","Термоклин — рыба на границе слоёв","Ночная ловля сома и судака","Карп и карась — всю ночь"]},
{season:"Осень",icon:"🍂",title:"Жор хищника",tips:["Хищник нагуливает жир","Крупные приманки","Глубинная ловля","Пасмурные дни — щучья погода","Налим при <10°C"]},
{season:"Зима",icon:"❄️",title:"Подлёдная ловля",tips:["Первый и последний лёд","Мелкие приманки","Мормышка с мотылём","Жерлицы на щуку","Налим — ночью на донки"]},
{season:"Давление",icon:"📊",title:"Как читать давление",tips:["Стабильное ±2мм — лучшие условия","Падающее — хищник активен","Растущее — мирная рыба","Скачки >5мм — клёв прекращается","Тренд важнее абсолютного значения"]},
{season:"Ветер",icon:"💨",title:"Влияние ветра",tips:["Южный/юго-западный — лучший","Северный/восточный — пассивный клёв","2-4 м/с оптимально","Прибойный берег — хищник в мути","Штиль — тонкие снасти"]},
];
function NightBg(){const st=useMemo(()=>[...Array(35)].map((_,i)=>({x:(i*37+13)%100,y:(i*53+7)%50,s:i%5===0?2:1,dur:3+i%4*2,del:i*.2})),[]);return (<div style={{position:"fixed",inset:0,zIndex:0,overflow:"hidden",pointerEvents:"none"}}><div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,#06080e 0%,#0a0e18 30%,#0e1220 55%,#101828 100%)"}} />{st.map((s,i)=><div key={i} style={{position:"absolute",left:`${s.x}%`,top:`${s.y}%`,width:s.s,height:s.s,borderRadius:"50%",background:"#c0c8e0",animation:`twinkle ${s.dur}s ${s.del}s ease-in-out infinite`}} />)}<div style={{position:"absolute",top:"6%",right:"14%",width:36,height:36,borderRadius:"50%",background:"radial-gradient(circle at 35% 35%,#e4ecf4,#b8c4d8)"}} /></div>)}
function DayBg(){return (<div style={{position:"fixed",inset:0,zIndex:0,overflow:"hidden",pointerEvents:"none"}}><div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,#88b8d8 0%,#b8d8e8 40%,#d8e8f0 70%,#c0d4e0 100%)"}} /><div style={{position:"absolute",top:"6%",right:"18%",width:44,height:44,borderRadius:"50%",background:"radial-gradient(circle at 45% 45%,#fff8e0,#ffd860)"}} /></div>)}
function GC({v,children,style={},className=""}){return <div className={className} style={{...v.glass,borderRadius:18,padding:18,marginBottom:10,...style}}>{children}</div>}
function TI({v,style={},...props}){return <input {...props} style={{width:"100%",padding:"12px 14px",borderRadius:12,boxSizing:"border-box",background:v.inputBg,border:`1px solid ${v.inputBorder}`,color:v.text,outline:"none",fontSize:14,fontWeight:500,...style}} />}
function TS({v,style={},children,...props}){return <select {...props} style={{width:"100%",padding:"12px 14px",borderRadius:12,boxSizing:"border-box",background:v.inputBg,border:`1px solid ${v.inputBorder}`,color:v.text,outline:"none",fontSize:14,...style}}>{children}</select>}
function Fl({label,v,children}){return <div><div style={{fontSize:11,color:v.textDim,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{label}</div>{children}</div>}
export default function Klevometr(){
const{isNight,toggle:tglTheme,v}=useTheme();const{user:sbU,updateProfile:upP,clearLoc:clL}=useSbUser();
const[screen,setScr]=useState(SC.home);const[hist,setHist]=useState([]);const[scrData,setScrData]=useState(null);const[showPP,setShowPP]=useState(false);
const[sessState,setSessState]=useState("idle");const[elapsed,setElapsed]=useState(0);
const[casts,setCasts]=useState(0);const[bites,setBites]=useState(0);const[caught,setCaught]=useState(0);
const[events,setEvents]=useState([]);const[dist,setDist]=useState(25);
const[castA,setCastA]=useState(false);const[biteA,setBiteA]=useState(false);const[caughtA,setCaughtA]=useState(false);
const startRef=useRef(null);
const timerRef=useRef(null);
const[catches,setCatches]=useSync("catches",[]);const[gearItems,setGearItems]=useSync("gear",[]);
const[spots,setSpots]=useSync("spots",[]);const[sessions,setSessions]=useSync("sessions",[]);
const{weather,forecast,loading:wLd,locationName:locN,setManualLocation:setML,geoCoords:gc}=useWeather();
const moon=getMoon();
const curH=new Date().getHours();
const bs=getBS(weather,moon,curH);
const go=useCallback((s,d=null)=>{setHist(p=>[...p,screen]);setScrData(d);setScr(s)},[screen]);
const back=useCallback(()=>{if(hist.length){setScr(hist[hist.length-1]);setHist(p=>p.slice(0,-1))}else setScr(SC.home)},[hist]);
useEffect(()=>{if(!tg)return;if(screen!==SC.home){tg.BackButton.show();
const h=()=>back();tg.BackButton.onClick(h);return ()=>tg.BackButton.offClick(h)}else tg.BackButton.hide()},[screen,back]);
useEffect(()=>{if(sessState==="active")timerRef.current=setInterval(()=>setElapsed(Math.floor((Date.now()-startRef.current)/1000)),1000);else clearInterval(timerRef.current);return ()=>clearInterval(timerRef.current)},[sessState]);
const startSess=()=>{hapticN("success");startRef.current=Date.now();setElapsed(0);setCasts(0);setBites(0);setCaught(0);setEvents([]);setSessState("active");go(SC.session)};
const stopSess=()=>{hapticN("warning");setSessState("idle");if(casts>0||caught>0)setSessions(p=>[{id:Date.now(),date:new Date().toLocaleDateString("ru-RU"),duration:elapsed,casts,bites,caught,weather:weather?`${weather.temp}°,${weather.pressure}мм`:"—",location:locN||"—"},...p].slice(0,50))};
const addEv=(type,text)=>setEvents(p=>[{type,text,t:elapsed},...p].slice(0,50));
const doCast=()=>{haptic("medium");pCast();
const n=casts+1;setCasts(n);addEv("cast",`Заброс #${n} — ${dist}м`);setCastA(true);setTimeout(()=>setCastA(false),400);if(n===5&&bites===0)setTimeout(()=>addEv("tip","💡 5 забросов без поклёвки — смени приманку"),800)};
const doBite=()=>{haptic("heavy");pBite();setBites(b=>b+1);addEv("bite","Поклёвка!");setBiteA(true);setTimeout(()=>setBiteA(false),400)};
const doCaught2=()=>{haptic("heavy");hapticN("success");pCaught();
const n=caught+1;setCaught(n);addEv("caught","Рыба! 🐟");setCaughtA(true);setTimeout(()=>setCaughtA(false),400);if(n===1)setTimeout(()=>addEv("tip","🔥 Первая! Запомни дистанцию"),600);if(n===5)setTimeout(()=>addEv("tip","🏆 5 рыб!"),600)};
const fmt=s=>`${String(Math.floor(s/3600)).padStart(2,"0")}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
const uName=sbU?.nickname||tg?.initDataUnsafe?.user?.first_name||"рыбак";
const uAvatar=sbU?.avatar_emoji||S.get("pa","🎣");
const saveCatch=cd=>setCatches(p=>[{id:Date.now(),...cd},...p]);
const delCatch=id=>setCatches(p=>p.filter(c=>c.id!==id));
const saveGear=i=>setGearItems(p=>[{id:Date.now(),...i},...p]);
const delGear=id=>setGearItems(p=>p.filter(g=>g.id!==id));
const saveSpot=s=>setSpots(p=>[{id:Date.now(),...s},...p]);
const delSpot=id=>setSpots(p=>p.filter(s=>s.id!==id));
const wd={weather,forecast,moon,biteScore:bs,weatherLoading:wLd,locationName:locN,currentHour:curH,setManualLocation:setML,geoCoords:gc};
const sh={catches,gearItems,spots,sessions,saveCatch,deleteCatch:delCatch,saveGear,deleteGear:delGear,saveSpot,deleteSpot:delSpot};
useEffect(()=>{const p=new URLSearchParams(window.location.search);
const ic=p.get("invite")||tg?.initDataUnsafe?.start_param;if(ic&&ic.startsWith("t_"))go(SC.tJoin,{invite_code:ic.replace("t_","")})},[]);
return (
<div style={{width:"100%",maxWidth:480,minHeight:"100vh",margin:"0 auto",color:v.text,fontFamily:"'DM Sans',system-ui,sans-serif",position:"relative",overflow:"hidden"}}>
{isNight?<NightBg/>:<DayBg/>}
<style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800;900&display=swap');
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes liveDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(0.8)}}
@keyframes slideDown{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(176,200,232,0.3)}70%{box-shadow:0 0 0 10px rgba(176,200,232,0)}}
@keyframes twinkle{0%,100%{opacity:.15;transform:scale(1)}50%{opacity:.9;transform:scale(1.4)}}
@keyframes ropeAnim{0%{stroke-dashoffset:200}100%{stroke-dashoffset:0}}
.f0{animation:fadeUp .45s cubic-bezier(.16,1,.3,1) both}.f1{animation:fadeUp .45s cubic-bezier(.16,1,.3,1) .06s both}.f2{animation:fadeUp .45s cubic-bezier(.16,1,.3,1) .12s both}.f3{animation:fadeUp .45s cubic-bezier(.16,1,.3,1) .18s both}.f4{animation:fadeUp .45s cubic-bezier(.16,1,.3,1) .24s both}.f5{animation:fadeUp .45s cubic-bezier(.16,1,.3,1) .3s both}
.btn:active{transform:scale(.94)!important;opacity:.8}.btn{transition:transform .2s,opacity .2s}::-webkit-scrollbar{width:0}
input,select,textarea{font-family:'DM Sans',sans-serif;font-size:14px}input::placeholder{color:${v.textDim}}select option{background:${v.isDark?"#0d1e35":"#f0f4f8"};color:${v.text}}`}</style>
<div style={{position:"relative",zIndex:1,overflowY:"auto",paddingBottom:72}} key={screen}>
{screen===SC.home&&<Home go={go} wd={wd} startSess={startSess} uName={uName} sh={sh} v={v} tglTheme={tglTheme} isNight={isNight}/>}
{screen===SC.session&&<Session {...{elapsed,casts,bites,caught,events,dist,setDist,doCast,doBite,doCaught:doCaught2,stopSess,fmt,back,wd,v}}/>}
{screen===SC.forecast&&<Forecast wd={wd} v={v}/>}
{screen===SC.diary&&<Diary go={go} sh={sh} v={v}/>}
{screen===SC.addCatch&&<AddCatch back={back} save={saveCatch} w={weather} loc={locN} v={v}/>}
{screen===SC.viewCatch&&<ViewCatch back={back} c={scrData} del={delCatch} v={v}/>}
{screen===SC.stats&&<Stats sh={sh} v={v}/>}
{screen===SC.guide&&<Guide go={go} v={v}/>}
{screen===SC.guideFish&&<GFish go={go} v={v}/>}
{screen===SC.guideFishD&&<GFishD back={back} fish={scrData} v={v} wd={wd}/>}
{screen===SC.guideKnots&&<GKnots go={go} v={v}/>}
{screen===SC.guideKnotD&&<GKnotD back={back} knot={scrData} v={v}/>}
{screen===SC.guideRigs&&<GRigs v={v}/>}
{screen===SC.guideTactics&&<GTactics v={v}/>}
{screen===SC.gear&&<Gear go={go} sh={sh} v={v}/>}
{screen===SC.addGear&&<AddGearS back={back} save={saveGear} v={v}/>}
{screen===SC.social&&<Social v={v}/>}
{screen===SC.spots&&<Spots go={go} sh={sh} v={v}/>}
{screen===SC.addSpot&&<AddSpotS back={back} save={saveSpot} v={v}/>}
{screen===SC.profile&&<Profile sh={sh} uName={uName} go={go} v={v} tglTheme={tglTheme} isNight={isNight} sbU={sbU} upP={upP} uAvatar={uAvatar}/>}
{screen===SC.tournaments&&<Tourns v={v} go={go}/>}
{screen===SC.tView&&<TournView back={back} tourn={scrData} v={v} saveCatch={saveCatch}/>}
{screen===SC.tJoin&&<TournJoin back={back} inv={scrData} v={v} go={go}/>}
{screen===SC.plan&&<Plan wd={wd} v={v}/>}
{screen===SC.map&&<MapScr sh={sh} v={v}/>}
{screen===SC.friends&&<Friends back={back} v={v}/>}
{screen===SC.editProfile&&<EditProf back={back} v={v} sbU={sbU} upP={upP} uAvatar={uAvatar}/>}
{screen===SC.locPicker&&<LocPicker back={back} v={v} upP={upP} clL={clL} setML={setML} sbU={sbU}/>}
</div>
{showPP&&<div style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setShowPP(false)}><div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:480,maxHeight:"80vh",overflowY:"auto",...v.glass,borderRadius:"20px 20px 0 0",padding:20}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}><span style={{fontSize:16,fontWeight:800}}>📋 Политика</span><button onClick={()=>setShowPP(false)} style={{background:"none",border:"none",color:v.textMuted,fontSize:20,cursor:"pointer"}}>✕</button></div><div style={{fontSize:12,color:v.textSecondary,lineHeight:1.8,whiteSpace:"pre-line"}}>{PP_TEXT}</div></div></div>}
{screen!==SC.session&&screen!==SC.map&&screen!==SC.tView&&(
<div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:v.tabBg,backdropFilter:"blur(24px)",borderTop:`1px solid ${v.tabBorder}`,display:"flex",flexDirection:"column",alignItems:"center",zIndex:10}}>
<div style={{display:"flex",justifyContent:"space-around",width:"100%",padding:"6px 0 2px"}}>
{[{k:SC.home,i:"🏠",l:"Главная"},{k:SC.diary,i:"📖",l:"Дневник"},{k:SC.forecast,i:"🌤",l:"Прогноз"},{k:SC.social,i:"👥",l:"Лента"},{k:SC.profile,i:"👤",l:"Профиль"}].map(t=>
<button key={t.k} onClick={()=>{haptic("light");setHist([]);setScr(t.k)}} className="btn" style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,border:"none",background:"none",cursor:"pointer",padding:"4px 10px",fontFamily:"'DM Sans',sans-serif",color:screen===t.k?v.tabActive:v.tabInactive}}>
<span style={{fontSize:20,filter:screen===t.k?`drop-shadow(0 0 6px ${v.accent}80)`:"none"}}>{t.i}</span>
<span style={{fontSize:9,fontWeight:screen===t.k?800:500}}>{t.l}</span></button>)}
</div>
<button onClick={()=>setShowPP(true)} style={{background:"none",border:"none",color:v.textDim,fontSize:9,cursor:"pointer",padding:"2px 0 calc(4px + env(safe-area-inset-bottom))",opacity:.5,fontFamily:"inherit"}}>Политика конфиденциальности</button>
</div>)}
</div>)}

// ═══ HOME ═══
function Home({go,wd,startSess,uName,sh,v,tglTheme,isNight}){const{weather:w,moon,biteScore:bs,weatherLoading:wLd,locationName:ln}=wd;const{catches:ca=[],sessions:se=[],spots:sp=[]}=sh||{};
const tw=ca.reduce((a,c)=>a+(parseFloat(c.weight)||0),0).toFixed(1);
return (<div style={{padding:"0 16px 16px"}}>
<div className="f0" style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"20px 0 8px"}}>
<div><div style={{fontSize:11,color:v.textDim,fontWeight:600,letterSpacing:".12em",textTransform:"uppercase"}}>{ln?`📍 ${ln}`:"🎣 Клёвометр"}</div><div style={{fontSize:28,fontWeight:800,marginTop:4}}>Привет, {uName}!</div><div style={{fontSize:13,color:v.textMuted,marginTop:5}}>{new Date().toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long"})}</div></div>
<button onClick={tglTheme} style={{width:40,height:40,borderRadius:12,background:v.card,border:`1px solid ${v.cardBorder}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{isNight?"🌙":"☀️"}</button></div>
<button onClick={startSess} className="btn f1" style={{width:"100%",textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:14,padding:"18px 20px",boxSizing:"border-box",marginBottom:10,borderRadius:20,...v.glass,border:`1.5px solid ${v.accentBorder}`,background:v.accentSoft,animation:"pulse 3s ease-in-out infinite"}}><div style={{width:48,height:48,borderRadius:14,background:`${v.accent}15`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:22}}>🎣</div><div style={{flex:1}}><div style={{fontWeight:700,fontSize:15,color:v.accent}}>Начать рыбалку</div><div style={{fontSize:12,color:v.textMuted,marginTop:3}}>Забросы · поклёвки · аналитика</div></div></button>
<button onClick={()=>go(SC.forecast)} className="btn f2" style={{width:"100%",textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:16,padding:"16px 20px",boxSizing:"border-box",marginBottom:10,borderRadius:20,...v.glass}}>
<div style={{position:"relative",width:58,height:58,flexShrink:0}}><svg width={58} height={58} style={{transform:"rotate(-90deg)"}}><circle cx={29} cy={29} r={24} fill="none" stroke={`${v.accent}12`} strokeWidth={4.5}/><circle cx={29} cy={29} r={24} fill="none" stroke={gSC(bs,v)} strokeWidth={4.5} strokeDasharray={150.8} strokeDashoffset={150.8*(1-bs/100)} strokeLinecap="round"/></svg><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:800,color:gSC(bs,v)}}>{wLd?"…":bs}</div></div>
<div><div style={{fontSize:11,color:v.textDim,fontWeight:600,textTransform:"uppercase"}}>Прогноз клёва</div><div style={{fontSize:20,fontWeight:800,color:gSC(bs,v),marginTop:3}}>{gSL(bs)}</div><div style={{fontSize:12,color:v.textMuted,marginTop:4}}>{w?`${wE(w.icon)} ${w.temp}° · ${w.pressure}мм`:`${moon.icon} ${moon.name}`}</div></div></button>
<div className="f3" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
{[{v2:ca.length,l:"уловов",c:v.stats[0],i:"🐟",s:SC.diary},{v2:`${tw}кг`,l:"поймано",c:v.stats[1],i:"⚖️",s:SC.stats},{v2:se.length,l:"сессий",c:v.stats[2],i:"📊",s:SC.stats}].map(s=>
<button key={s.l} onClick={()=>{haptic("light");go(s.s)}} className="btn" style={{...v.glass,padding:"14px 12px",textAlign:"center",cursor:"pointer",borderRadius:18}}><div style={{fontSize:18}}>{s.i}</div><div style={{fontSize:20,fontWeight:900,color:s.c,marginTop:4}}>{s.v2}</div><div style={{fontSize:10,color:v.textDim,fontWeight:600,marginTop:2}}>{s.l}</div></button>)}
</div>
<div className="f4" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
{[{i:"📖",l:"Дневник",sub:`${ca.length}`,s:SC.diary,c:v.stats[0]},{i:"📚",l:"Справочник",sub:"Рыбы · Узлы",s:SC.guide,c:v.stats[3]},{i:"🗺",l:"Карта",sub:`${sp.length} меток`,s:SC.map,c:v.stats[2]},{i:"🏆",l:"Турниры",sub:"Соревнования",s:SC.tournaments,c:v.stats[1]},{i:"📅",l:"Планирование",sub:"Календарь",s:SC.plan,c:v.stats[2]},{i:"📍",l:"Мои места",sub:`${sp.length}`,s:SC.spots,c:v.stats[0]}].map(it=>
<button key={it.l} onClick={()=>{haptic("light");go(it.s)}} className="btn" style={{...v.glass,padding:14,cursor:"pointer",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxSizing:"border-box",borderRadius:16}}>
<div style={{fontSize:22,width:42,height:42,borderRadius:12,background:`${it.c}15`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{it.i}</div>
<div><div style={{fontWeight:700,fontSize:14}}>{it.l}</div><div style={{fontSize:11,color:v.textDim,marginTop:2}}>{it.sub}</div></div></button>)}
</div>
{ca.length>0&&<GC v={v} className="f5" style={{marginTop:10,padding:16,borderRadius:20}}><div style={{fontSize:11,color:v.textDim,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>{fE(ca[0].fish)} Последний улов</div><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:44,height:44,borderRadius:12,background:`${v.accent}10`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{fE(ca[0].fish)}</div><div style={{flex:1}}><div style={{fontWeight:700,fontSize:15}}>{ca[0].fish}</div><div style={{fontSize:12,color:v.textMuted,marginTop:2}}>{ca[0].location||"—"}</div></div><div style={{textAlign:"right"}}><div style={{fontWeight:900,fontSize:17,color:v.accent}}>{ca[0].weight}<span style={{fontSize:10,color:v.textDim}}>кг</span></div><div style={{fontSize:10,color:v.textDim}}>{ca[0].date}</div></div></div></GC>}
</div>)}

// ═══ GUIDE ═══
function Guide({go,v}){return (<div style={{padding:"0 16px 16px"}}><div className="f0" style={{padding:"16px 0"}}><div style={{fontSize:24,fontWeight:900}}>📚 Справочник</div><div style={{fontSize:13,color:v.textMuted,marginTop:2}}>Энциклопедия рыбака</div></div>
{[{i:"🐟",l:"Рыбы",sub:`${Object.keys(FP).length} видов`,s:SC.guideFish,c:v.stats[0]},{i:"🪢",l:"Узлы",sub:`${KNOTS.length} с инструкцией`,s:SC.guideKnots,c:v.stats[1]},{i:"🎣",l:"Оснастки",sub:`${RIGS.length} монтажей`,s:SC.guideRigs,c:v.stats[2]},{i:"🧭",l:"Тактика",sub:"Сезоны · давление",s:SC.guideTactics,c:v.stats[3]}].map((s,i)=>
<button key={s.l} onClick={()=>{haptic("light");go(s.s)}} className={`btn f${i+1}`} style={{...v.glass,width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:14,padding:18,cursor:"pointer",boxSizing:"border-box",borderRadius:20,marginBottom:8}}>
<div style={{width:52,height:52,borderRadius:14,background:`${s.c}12`,border:`1px solid ${s.c}25`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>{s.i}</div>
<div style={{flex:1}}><div style={{fontWeight:800,fontSize:16}}>{s.l}</div><div style={{fontSize:12,color:v.textMuted,marginTop:3}}>{s.sub}</div></div>
<span style={{color:v.textMuted,fontSize:18}}>›</span></button>)}</div>)}

function GFish({go,v}){const fl=Object.entries(FP);return (<div style={{padding:"0 16px 16px"}}><div className="f0" style={{padding:"16px 0"}}><div style={{fontSize:24,fontWeight:900}}>🐟 Рыбы</div></div>
{fl.map(([n,p],i)=><button key={n} onClick={()=>{haptic("light");go(SC.guideFishD,n)}} className="btn" style={{...v.glass,width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:12,padding:14,cursor:"pointer",boxSizing:"border-box",borderRadius:16,marginBottom:8,animation:`fadeUp .4s ease ${i*.04}s both`}}>
<div style={{width:46,height:46,borderRadius:12,background:`${v.accent}10`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{p.emoji}</div>
<div style={{flex:1}}><div style={{fontWeight:700,fontSize:15}}>{n}</div><div style={{fontSize:11,color:v.textDim,fontStyle:"italic"}}>{p.latin}</div><div style={{fontSize:11,color:v.textMuted,marginTop:2}}>{p.type==="predator"?"🎯 Хищник":"🌿 Мирная"} · {p.wt.pL}-{p.wt.pH}°C</div></div>
<span style={{color:v.textMuted}}>›</span></button>)}</div>)}

function GFishD({back,fish,v,wd}){const p=FP[fish];if(!p)return null;const{weather:w,moon,currentHour:ch,geoCoords:gc,forecast:fc}=wd;
const sc=w?cFS(fish,w,moon,ch,new Date().getMonth(),gc?.lat,fc,new Date()):null;
return (<div style={{padding:"0 16px 16px"}}><div className="f0" style={{padding:"16px 0"}}><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:56,height:56,borderRadius:16,background:`${v.accent}10`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30}}>{p.emoji}</div><div><div style={{fontSize:24,fontWeight:900}}>{fish}</div><div style={{fontSize:13,color:v.textDim,fontStyle:"italic"}}>{p.latin}</div></div></div></div>
{sc&&<GC v={v} className="f1" style={{padding:14,borderRadius:16,border:`1px solid ${v.accentBorder}`}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><div><div style={{fontSize:11,color:v.textDim,fontWeight:700}}>КЛЁВ СЕЙЧАС</div><div style={{fontSize:28,fontWeight:900,color:gSC(sc.score,v),marginTop:4}}>{sc.score}%</div></div><div style={{textAlign:"right"}}><div style={{fontSize:12,color:v.textMuted}}>🌡 Вода ≈{sc.waterTemp}°C</div><div style={{fontSize:12,color:v.textMuted}}>O₂ ≈{sc.o2} мг/л</div></div></div><div style={{fontSize:13,color:v.textMuted,marginTop:8,lineHeight:1.6}}>{sc.tip}</div></GC>}
<GC v={v} className="f2" style={{padding:16,borderRadius:16}}><div style={{fontSize:14,fontWeight:700,marginBottom:8}}>📖 Описание</div><div style={{fontSize:13,color:v.textMuted,lineHeight:1.7}}>{p.desc}</div></GC>
<GC v={v} className="f3" style={{padding:16,borderRadius:16}}><div style={{fontSize:14,fontWeight:700,marginBottom:8}}>📍 Где искать</div><div style={{fontSize:13,color:v.textMuted,lineHeight:1.7}}>{p.habitat}</div></GC>
<GC v={v} className="f4" style={{padding:16,borderRadius:16}}><div style={{fontSize:14,fontWeight:700,marginBottom:8}}>🎣 Техника</div><div style={{fontSize:13,color:v.textMuted,lineHeight:1.7}}>{p.technique}</div></GC>
<div className="f5" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
{[{l:"Темп. воды",val:`${p.wt.pL}-${p.wt.pH}°C`,c:v.stats[0]},{l:"Тип",val:p.type==="predator"?"Хищник":"Мирная",c:v.stats[1]},{l:"Нерест",val:["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"][p.sp],c:v.stats[2]},{l:"O₂ мин",val:`${p.o2.min} мг/л`,c:v.stats[3]}].map(s=>
<GC key={s.l} v={v} style={{padding:10,borderRadius:14,textAlign:"center"}}><div style={{fontSize:9,color:v.textDim,fontWeight:700}}>{s.l}</div><div style={{fontSize:16,fontWeight:900,color:s.c,marginTop:3}}>{s.val}</div></GC>)}
</div></div>)}

function GKnots({go,v}){return (<div style={{padding:"0 16px 16px"}}><div className="f0" style={{padding:"16px 0"}}><div style={{fontSize:24,fontWeight:900}}>🪢 Узлы</div></div>
{KNOTS.map((k,i)=><button key={k.id} onClick={()=>{haptic("light");go(SC.guideKnotD,k)}} className="btn" style={{...v.glass,width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:12,padding:14,cursor:"pointer",boxSizing:"border-box",borderRadius:16,marginBottom:8,animation:`fadeUp .4s ease ${i*.04}s both`}}>
<div style={{width:46,height:46,borderRadius:12,background:`${k.color}15`,border:`1px solid ${k.color}30`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
<svg width={28} height={28} viewBox="0 0 40 40"><path d="M8 32 C12 28,16 12,20 20 S28 8,32 12" fill="none" stroke={k.color} strokeWidth="3" strokeLinecap="round"/><circle cx="32" cy="12" r="3" fill={k.color} opacity=".5"/></svg></div>
<div style={{flex:1}}><div style={{fontWeight:700,fontSize:15}}>{k.name}</div><div style={{fontSize:11,color:v.textDim,marginTop:2}}>{k.cat}</div>
<div style={{display:"flex",gap:6,marginTop:4}}><span style={{fontSize:10,padding:"2px 6px",borderRadius:6,background:`${v.accent}08`,color:v.textMuted}}>{"⭐".repeat(k.diff)}</span><span style={{fontSize:10,padding:"2px 6px",borderRadius:6,background:`${k.color}10`,color:k.color,fontWeight:700}}>{k.str}%</span></div></div>
<span style={{color:v.textMuted}}>›</span></button>)}</div>)}

function GKnotD({back,knot:k,v}){const[step,setStep]=useState(0);if(!k)return null;
const pr=(step+1)/k.steps.length;
const eX=155,eY=40;
return (<div style={{padding:"0 16px 16px"}}><div className="f0" style={{padding:"16px 0"}}><div style={{fontSize:22,fontWeight:900}}>{k.name}</div><div style={{fontSize:13,color:v.textDim,marginTop:2}}>{k.cat} · {k.str}%</div></div>
<GC v={v} className="f1" style={{padding:16,borderRadius:20,textAlign:"center"}}>
<svg width="100%" viewBox="0 0 200 80" style={{maxWidth:320,margin:"0 auto",display:"block"}}>
<circle cx={eX} cy={eY} r="7" fill="none" stroke={v.textDim} strokeWidth="2"/><line x1={eX} y1={eY+7} x2={eX} y2={eY+20} stroke={v.textDim} strokeWidth="2"/>
<line x1="15" y1={eY} x2={eX-10} y2={eY} stroke={k.color} strokeWidth="2.5" opacity=".4"/>
{step>=1&&<path d={`M${eX-10} ${eY} L${eX-7} ${eY}`} stroke={k.color} strokeWidth="3" strokeLinecap="round" strokeDasharray="200" style={{animation:"ropeAnim .5s ease forwards"}}/>}
{step>=2&&Array.from({length:Math.min(step,4)},(_,i)=><ellipse key={i} cx={eX-20-i*8} cy={eY} rx="4" ry="8" fill="none" stroke={k.color} strokeWidth="2" opacity={.6+i*.1}/>)}
{step>=3&&<path d={`M${eX-50} ${eY+8} L${eX-55} ${eY-5} L${eX-10} ${eY-5}`} fill="none" stroke={k.color} strokeWidth="2" strokeDasharray="4" opacity=".7"/>}
{step>=4&&<circle cx={eX-30} cy={eY} r="3" fill={k.color} opacity=".8"><animate attributeName="r" values="3;5;3" dur="1s" repeatCount="indefinite"/></circle>}
<text x="100" y="12" textAnchor="middle" fill={v.textDim} fontSize="10" fontWeight="700" fontFamily="sans-serif">Шаг {step+1}/{k.steps.length}</text>
<rect x="30" y="72" width="140" height="3" rx="1.5" fill={`${v.accent}15`}/><rect x="30" y="72" width={140*pr} height="3" rx="1.5" fill={k.color}/>
</svg>
<div style={{marginTop:12,display:"flex",gap:8,justifyContent:"center"}}>
<button onClick={()=>setStep(Math.max(0,step-1))} disabled={step===0} className="btn" style={{padding:"8px 20px",borderRadius:10,background:`${v.accent}08`,border:`1px solid ${v.accent}20`,color:v.accent,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",opacity:step===0?.3:1}}>← Назад</button>
<button onClick={()=>setStep(Math.min(k.steps.length-1,step+1))} disabled={step===k.steps.length-1} className="btn" style={{padding:"8px 20px",borderRadius:10,background:v.btnPrimary,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",border:"none",opacity:step===k.steps.length-1?.3:1}}>Далее →</button></div></GC>
<GC v={v} className="f2" style={{padding:16,borderRadius:16}}><div style={{fontSize:11,color:v.textDim,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Инструкция</div>
{k.steps.map((s,i)=><div key={i} onClick={()=>setStep(i)} style={{display:"flex",gap:10,padding:"10px 8px",borderRadius:10,marginBottom:4,cursor:"pointer",background:i===step?`${k.color}10`:"transparent",border:`1px solid ${i===step?`${k.color}25`:"transparent"}`}}>
<div style={{width:24,height:24,borderRadius:"50%",background:i<=step?k.color:`${v.accent}10`,color:i<=step?"#fff":v.textDim,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,flexShrink:0}}>{i+1}</div>
<div style={{fontSize:13,color:i===step?v.text:v.textMuted,fontWeight:i===step?700:400,lineHeight:1.5}}>{s}</div></div>)}</GC>
<GC v={v} style={{padding:14,borderRadius:16}}><div style={{fontSize:13,color:v.textMuted,lineHeight:1.7}}>{k.desc}</div></GC></div>)}

function GRigs({v}){return (<div style={{padding:"0 16px 16px"}}><div className="f0" style={{padding:"16px 0"}}><div style={{fontSize:24,fontWeight:900}}>🎣 Оснастки</div></div>
{RIGS.map((r,i)=><GC key={r.id} v={v} className={`f${Math.min(i+1,5)}`} style={{padding:16,borderRadius:20}}>
<div style={{fontSize:16,fontWeight:800}}>{r.name}</div><div style={{fontSize:11,color:v.textDim,marginTop:2}}>🎯 {r.tgt}</div>
<div style={{background:`${v.accent}05`,borderRadius:12,padding:12,margin:"10px 0",display:"flex",justifyContent:"center"}}>
<svg width="220" height="65" viewBox="0 0 220 65">
{r.dg==="v"?<><line x1="110" y1="5" x2="110" y2="55" stroke={v.textDim} strokeWidth="1.5"/><circle cx="110" cy="55" r="6" fill={v.stats[2]} opacity=".7"/><text x="122" y="58" fill={v.textDim} fontSize="8">грузило</text><line x1="110" y1="25" x2="175" y2="25" stroke={v.accent} strokeWidth="1.5"/><path d="M170 22 L180 25 L170 28" fill={v.accent} opacity=".7"/><text x="145" y="20" fill={v.accent} fontSize="8">приманка</text><line x1="110" y1="5" x2="40" y2="5" stroke={v.textDim} strokeWidth="1.5" strokeDasharray="4"/><text x="15" y="14" fill={v.textDim} fontSize="8">←</text></>
:r.dg==="k"?<><path d="M20 32 L130 32" stroke={v.textDim} strokeWidth="1.5"/><path d="M130 32 C140 32 145 37 145 42 C145 50 135 52 130 47" stroke={v.accent} strokeWidth="2.5" fill="none"/><circle cx="140" cy="52" r="5" fill={v.stats[2]} opacity=".7"/><text x="150" y="55" fill={v.textDim} fontSize="8">бойл</text><line x1="140" y1="47" x2="140" y2="52" stroke={v.textDim} strokeWidth="1" strokeDasharray="2"/></>
:<><line x1="10" y1="32" x2="210" y2="32" stroke={v.textDim} strokeWidth="1.5"/><circle cx="65" cy="32" r="6" fill={v.stats[2]} opacity=".7"/><text x="52" y="47" fill={v.textDim} fontSize="8">грузило</text><circle cx="90" cy="32" r="3" fill={v.accent} opacity=".5"/><line x1="90" y1="32" x2="190" y2="32" stroke={v.accent} strokeWidth="1.5"/><path d="M185 29 L195 32 L185 35" fill={v.accent} opacity=".7"/><text x="160" y="24" fill={v.accent} fontSize="8">приманка</text></>}
</svg></div>
<div style={{fontSize:13,color:v.textMuted,lineHeight:1.7,marginBottom:8}}>{r.desc}</div>
<div style={{fontSize:11,color:v.textDim,padding:"8px 10px",borderRadius:10,background:`${v.accent}05`}}>📦 {r.comp}</div></GC>)}</div>)}

function GTactics({v}){return (<div style={{padding:"0 16px 16px"}}><div className="f0" style={{padding:"16px 0"}}><div style={{fontSize:24,fontWeight:900}}>🧭 Тактика</div></div>
{TACTICS.map((t,i)=><GC key={t.season} v={v} className={`f${Math.min(i+1,5)}`} style={{padding:16,borderRadius:20}}>
<div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}><span style={{fontSize:28}}>{t.icon}</span><div><div style={{fontSize:16,fontWeight:800}}>{t.season}</div><div style={{fontSize:12,color:v.textMuted}}>{t.title}</div></div></div>
{t.tips.map((tip,j)=><div key={j} style={{display:"flex",gap:8,padding:"6px 0",borderBottom:j<t.tips.length-1?`1px solid ${v.cardBorder}`:"none"}}><span style={{color:v.accent,fontSize:12,flexShrink:0,marginTop:2}}>•</span><span style={{fontSize:13,color:v.textMuted,lineHeight:1.6}}>{tip}</span></div>)}</GC>)}</div>)}

// ═══ SESSION ═══
function Session({elapsed,casts,bites,caught,events,dist,setDist,doCast,doBite,doCaught,stopSess,fmt,back,wd,v}){const{weather:w}=wd;
const bph=elapsed>0?(bites/(elapsed/3600)).toFixed(1):"0.0";
const rl=bites>0?Math.round(caught/bites*100):0;
const ac=[{c:v.stats[0],b:`${v.stats[0]}30`},{c:v.stats[2],b:`${v.stats[2]}30`},{c:v.stats[1],b:`${v.stats[1]}30`}];
return (<div style={{padding:"0 16px 20px"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 0 8px"}}><div style={{fontSize:20,fontWeight:900}}>Рыбалка</div><div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 12px",borderRadius:20,background:`${v.accent}12`,border:`1px solid ${v.accent}25`}}><div style={{width:7,height:7,borderRadius:"50%",background:v.accent,animation:"liveDot 1.2s infinite"}}/><span style={{fontSize:11,fontWeight:800,color:v.accent,letterSpacing:1}}>LIVE</span></div></div>
{w&&<div className="f0" style={{display:"flex",justifyContent:"center",gap:14,padding:"6px 0 10px",flexWrap:"wrap"}}>{[`${wE(w.icon)} ${w.temp}°`,`🌡 ${w.pressure}мм`,`💨 ${w.wind}м/с`].map(t=><span key={t} style={{fontSize:11,color:v.textMuted}}>{t}</span>)}</div>}
<GC v={v} className="f0" style={{textAlign:"center",padding:"22px 16px",borderRadius:24,border:`1px solid ${v.accentBorder}`}}><div style={{fontSize:52,fontWeight:900,fontFamily:"'Courier New',monospace",letterSpacing:5,color:v.accent}}>{fmt(elapsed)}</div>
<div style={{display:"flex",gap:28,justifyContent:"center",marginTop:14}}>{[{val:casts,l:"ЗАБРОСОВ",c:ac[0].c},{val:bites,l:"ПОКЛЁВОК",c:ac[1].c},{val:caught,l:"ПОЙМАНО",c:ac[2].c}].map(s=><div key={s.l}><div style={{fontSize:26,fontWeight:900,color:s.c}}>{s.val}</div><div style={{fontSize:9,color:v.textDim,fontWeight:700}}>{s.l}</div></div>)}</div></GC>
<GC v={v} style={{padding:"14px 16px",borderRadius:16}}><div style={{fontSize:11,color:v.textMuted,fontWeight:700,marginBottom:8}}>Дистанция: <span style={{color:v.accent}}>{dist}м</span></div><input type="range" min={5} max={80} value={dist} onChange={e=>setDist(+e.target.value)} style={{width:"100%",accentColor:v.accent,height:5}}/></GC>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
{[{fn:doCast,anim:false,i:"🎯",l:"Заброс",cnt:casts,...ac[0]},{fn:doBite,anim:false,i:"⚡",l:"Поклёвка",cnt:bites,...ac[1]},{fn:doCaught,anim:false,i:"🐟",l:"Поймал",cnt:caught,...ac[2]}].map(bt=>
<button key={bt.l} onClick={bt.fn} className="btn" style={{padding:"18px 8px",borderRadius:18,border:`2px solid ${bt.b}`,background:`linear-gradient(180deg,${bt.c}12,transparent)`,cursor:"pointer",fontFamily:"inherit",display:"flex",flexDirection:"column",alignItems:"center"}}>
<span style={{fontSize:30}}>{bt.i}</span><span style={{fontSize:12,fontWeight:800,color:bt.c,marginTop:6}}>{bt.l}</span><span style={{fontSize:22,fontWeight:900,color:bt.c,marginTop:2}}>{bt.cnt}</span></button>)}</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
{[{l:"ПОК./ЧАС",val:bph,c:v.stats[2]},{l:"РЕАЛИЗАЦИЯ",val:`${rl}%`,c:v.stats[1]}].map(s=><GC key={s.l} v={v} style={{padding:12,borderRadius:14,textAlign:"center"}}><div style={{fontSize:9,color:v.textDim,fontWeight:700}}>{s.l}</div><div style={{fontSize:22,fontWeight:900,color:s.c,marginTop:4}}>{s.val}</div></GC>)}</div>
{events.length>0&&<GC v={v} style={{padding:14,borderRadius:16}}><div style={{fontSize:11,color:v.textMuted,fontWeight:700,marginBottom:8}}>📋 События</div><div style={{maxHeight:140,overflowY:"auto"}}>{events.slice(0,8).map((ev,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:i<7?`1px solid ${v.cardBorder}`:"none",animation:i===0?"slideDown .3s":"none"}}><span style={{fontSize:14}}>{ev.type==="cast"?"🎯":ev.type==="bite"?"⚡":ev.type==="tip"?"💡":"🐟"}</span><span style={{flex:1,fontSize:12,color:ev.type==="tip"?v.stats[3]:v.textMuted,fontWeight:ev.type==="tip"?500:600,fontStyle:ev.type==="tip"?"italic":"normal"}}>{ev.text}</span><span style={{fontSize:10,color:v.textDim,fontFamily:"monospace"}}>{fmt(ev.t)}</span></div>)}</div></GC>}
<button onClick={()=>{stopSess();back()}} className="btn" style={{width:"100%",padding:15,borderRadius:16,border:`1.5px solid ${v.btnDangerBorder}`,background:v.btnDanger,color:v.btnDangerColor,fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"inherit"}}>⏹ Завершить</button></div>)}

// ═══ Regional average temps by month (for estimated forecast) ═══
const AVG_TEMPS = [[-10,-8,0,8,15,20,22,20,14,6,-1,-7],[-8,-6,1,9,16,21,23,21,15,7,0,-5],[-5,-3,3,11,18,23,25,23,17,9,2,-3],[-2,0,5,13,20,25,27,25,19,11,4,0]];
function getAvgTemp(lat, month) {
  const band = lat > 60 ? 0 : lat > 55 ? 1 : lat > 48 ? 2 : 3;
  return AVG_TEMPS[band][month];
}

// Compute score for ANY date (no weather API needed)
function computeEstScore(date, lat, lon, selFish) {
  const m = date.getMonth();
  const moon = getMoon(date);
  const avgT = getAvgTemp(lat || 55.75, m);
  const fakeW = { temp: avgT, pressure: 760, wind: "3", clouds: 50, humidity: 60, windDeg: 180, waterTemp: estWT(avgT, m) };
  if (selFish) {
    return cFS(selFish, fakeW, moon, 10, m, lat, null, date);
  }
  const lf = getLocalFish(lat, lon);
  const scores = lf.fish.filter(f => FP[f]).map(f => cFS(f, fakeW, moon, 10, m, lat, null, date).score);
  return { score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 50 };
}

// Get forecast tier for a date
function getForecastTier(date, forecastDates) {
  const now = new Date();
  const diff = Math.floor((date - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  if (diff < 0) return { tier: "past", label: "", color: "" };
  if (diff <= 5 && forecastDates.has(date.toISOString().split("T")[0])) return { tier: "actual", label: "Фактический", color: "#38a868", badge: "🟢" };
  if (diff <= 14) return { tier: "calc", label: "Расчётный", color: "#b0a030", badge: "🟡" };
  return { tier: "season", label: "По сезону", color: "#8a9aaa", badge: "⚪" };
}

// ═══ FORECAST with month calendar ═══
function Forecast({wd, v}) {
  const {weather: w, forecast: fc, moon, biteScore: bs, weatherLoading: wLd, locationName: ln, currentHour: ch, geoCoords: gc} = wd;
  const [selFish, setSelFish] = useState(null);
  const [selDate, setSelDate] = useState(new Date());
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [calOpen, setCalOpen] = useState(false);

  const lInfo = useMemo(() => gc ? getLocalFish(gc.lat, gc.lon) : {fish: Object.keys(FP), region: null, note: ""}, [gc]);

  // Build forecast lookup from API data
  const fcLookup = useMemo(() => {
    if (!fc || !w) return {};
    const g = {};
    fc.forEach(f => {
      const d = f.dt_txt.split(" ")[0];
      if (!g[d]) g[d] = [];
      g[d].push(f);
    });
    const result = {};
    const today = new Date().toISOString().split("T")[0];
    // Today uses current weather
    result[today] = w;
    Object.entries(g).forEach(([ds, items]) => {
      const aT = Math.round(items.reduce((a, f) => a + f.main.temp, 0) / items.length);
      const aP = Math.round(items.reduce((a, f) => a + f.main.pressure * 0.750062, 0) / items.length);
      const aW = (items.reduce((a, f) => a + f.wind.speed, 0) / items.length).toFixed(1);
      const ic = items[Math.floor(items.length / 2)].weather[0]?.icon;
      const wd2 = items[Math.floor(items.length / 2)].wind.deg;
      result[ds] = { temp: aT, pressure: aP, wind: aW, clouds: 50, humidity: 60, icon: ic, windDeg: wd2, waterTemp: estWT(aT, new Date(ds).getMonth()) };
    });
    return result;
  }, [fc, w]);

  const fcDates = useMemo(() => new Set(Object.keys(fcLookup)), [fcLookup]);

  // Calendar grid
  const calDays = useMemo(() => {
    const {year, month} = calMonth;
    const first = new Date(year, month, 1);
    const startDay = (first.getDay() + 6) % 7; // Monday = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const ds = date.toISOString().split("T")[0];
      const tier = getForecastTier(date, fcDates);
      let score = 50;
      if (tier.tier === "actual" && fcLookup[ds]) {
        const adv = compAdv(fcLookup[ds], getMoon(date), 10, gc?.lat, gc?.lon, fc, date);
        score = selFish ? cFS(selFish, fcLookup[ds], getMoon(date), 10, month, gc?.lat, fc, date).score : adv.score;
      } else if (tier.tier !== "past") {
        const est = computeEstScore(date, gc?.lat, gc?.lon, selFish);
        score = est.score;
      }
      cells.push({ day: d, date, ds, score, tier, isToday: ds === new Date().toISOString().split("T")[0], isSelected: ds === selDate.toISOString().split("T")[0] });
    }
    return cells;
  }, [calMonth, fcDates, fcLookup, gc, fc, selFish, selDate]);

  // Selected day data
  const selDs = selDate.toISOString().split("T")[0];
  const selTier = getForecastTier(selDate, fcDates);
  const dw = fcLookup[selDs] || null;
  const dm = getMoon(selDate);
  const dM = selDate.getMonth();
  const isToday = selDs === new Date().toISOString().split("T")[0];

  // Compute scores for selected day
  const adv = useMemo(() => {
    if (dw) return compAdv(dw, dm, isToday ? ch : 10, gc?.lat, gc?.lon, fc, selDate);
    // Estimated: use avg temps
    const avgT = getAvgTemp(gc?.lat || 55.75, dM);
    const fakeW = { temp: avgT, pressure: 760, wind: "3", clouds: 50, humidity: 60, windDeg: 180, waterTemp: estWT(avgT, dM) };
    return compAdv(fakeW, dm, 10, gc?.lat, gc?.lon, null, selDate);
  }, [dw, dm, ch, gc, fc, selDate, dM]);

  const fd = useMemo(() => {
    if (!selFish) return null;
    if (dw) return cFS(selFish, dw, dm, isToday ? ch : 10, dM, gc?.lat, fc, selDate);
    const avgT = getAvgTemp(gc?.lat || 55.75, dM);
    const fakeW = { temp: avgT, pressure: 760, wind: "3", clouds: 50, humidity: 60, windDeg: 180, waterTemp: estWT(avgT, dM) };
    return cFS(selFish, fakeW, dm, 10, dM, gc?.lat, null, selDate);
  }, [selFish, dw, dm, ch, dM, gc, fc, selDate]);

  const ds = fd ? fd.score : (adv?.score || bs);

  const hourly = useMemo(() => {
    const curW = dw || (() => { const avgT = getAvgTemp(gc?.lat || 55.75, dM); return { temp: avgT, pressure: 760, wind: "3", clouds: 50, humidity: 60, windDeg: 180, waterTemp: estWT(avgT, dM) }; })();
    return Array.from({length: 20}, (_, i) => {
      const h = i + 4;
      if (selFish) return {h, score: cFS(selFish, curW, dm, h, dM, gc?.lat, fc, selDate).score};
      const a = lInfo.fish.filter(f => FP[f]).map(f => cFS(f, curW, dm, h, dM, gc?.lat, fc, selDate).score);
      return {h, score: a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 50};
    });
  }, [dw, dm, selFish, dM, gc, fc, selDate]);

  const bestH = hourly.reduce((a, b) => a.score > b.score ? a : b, {h: 6, score: 0});
  const pt = dw ? pTrend(fc, selDate) : null;

  const share = () => {
    haptic("medium");
    const dateStr = selDate.toLocaleDateString("ru-RU", {day: "numeric", month: "long"});
    const t3 = adv?.topFish?.slice(0, 3).map(f => `${f.emoji}${f.fish} ${f.score}%`).join(" · ") || "";
    const tierLabel = selTier.tier === "actual" ? "📡" : selTier.tier === "calc" ? "📊" : "📅";
    const txt = `🎣 Прогноз клёва · ${dateStr} · ${ln || ""}\n${tierLabel} ${selTier.label}\nКлёв: ${ds}% ${gSL(ds)}\n${t3 ? `🏆 ${t3}\n` : ""}${dm.icon} ${dm.name}\n📲 Клёвометр`;
    if (tg) tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(APP_LINK)}&text=${encodeURIComponent(txt)}`);
    else navigator.clipboard?.writeText(txt);
  };

  const fl = lInfo.fish.map(n => [n, FP[n]]).filter(([_, p]) => p);
  const monthNames = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
  const prevMonth = () => setCalMonth(p => p.month === 0 ? {year: p.year - 1, month: 11} : {year: p.year, month: p.month - 1});
  const nextMonth = () => setCalMonth(p => p.month === 11 ? {year: p.year + 1, month: 0} : {year: p.year, month: p.month + 1});
  const selDayLabel = isToday ? "Сегодня" : selDate.toLocaleDateString("ru-RU", {weekday: "long", day: "numeric", month: "long"});

  return (
    <div style={{padding: "0 16px 16px"}}>
      <div className="f0" style={{padding: "16px 0"}}>
        <div style={{display: "flex", justifyContent: "space-between"}}>
          <div>
            <div style={{fontSize: 24, fontWeight: 900}}>Прогноз клёва</div>
            <div style={{fontSize: 13, color: v.textMuted, marginTop: 2}}>{ln || ""} · {getSeasonName(dM)}</div>
          </div>
          <button onClick={share} className="btn" style={{padding: "8px 14px", borderRadius: 12, background: `${v.accent}10`, border: `1px solid ${v.accent}20`, color: v.accent, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit"}}>📤</button>
        </div>
      </div>

      {/* ═══ COLLAPSIBLE CALENDAR ═══ */}
      <GC v={v} className="f1" style={{padding: 0, borderRadius: 20, overflow: "hidden"}}>
        {/* Collapsed header — always visible */}
        <button onClick={() => { setCalOpen(!calOpen); haptic("light"); }} className="btn" style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px", cursor: "pointer", background: "none", border: "none",
          fontFamily: "inherit", boxSizing: "border-box",
        }}>
          <div style={{display: "flex", alignItems: "center", gap: 10}}>
            <span style={{fontSize: 18}}>📅</span>
            <div style={{textAlign: "left"}}>
              <div style={{fontSize: 14, fontWeight: 800, color: v.text}}>{selDayLabel}</div>
              <div style={{fontSize: 11, color: v.textMuted, marginTop: 1}}>{dm.icon} {dm.name} · {getSeasonName(dM)}</div>
            </div>
          </div>
          <div style={{display: "flex", alignItems: "center", gap: 8}}>
            {selTier.tier !== "past" && (
              <div style={{display: "flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 8, background: `${selTier.color}15`}}>
                <span style={{fontSize: 8}}>{selTier.badge}</span>
                <span style={{fontSize: 9, fontWeight: 700, color: selTier.color}}>{selTier.label}</span>
              </div>
            )}
            <span style={{fontSize: 14, color: v.textMuted, transform: calOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s"}}>▼</span>
          </div>
        </button>

        {/* Expanded calendar grid */}
        {calOpen && (
          <div style={{padding: "0 14px 14px"}}>
            <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8}}>
              <button onClick={prevMonth} className="btn" style={{background: "none", border: "none", color: v.accent, fontSize: 18, cursor: "pointer", padding: "4px 8px"}}>‹</button>
              <div style={{fontSize: 14, fontWeight: 800}}>{monthNames[calMonth.month]} {calMonth.year}</div>
              <button onClick={nextMonth} className="btn" style={{background: "none", border: "none", color: v.accent, fontSize: 18, cursor: "pointer", padding: "4px 8px"}}>›</button>
            </div>
            <div style={{display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4}}>
              {["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(d =>
                <div key={d} style={{textAlign: "center", fontSize: 9, color: v.textDim, fontWeight: 700, padding: "2px 0"}}>{d}</div>
              )}
            </div>
            <div style={{display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2}}>
              {calDays.map((cell, i) => {
                if (!cell) return <div key={`e${i}`} />;
                const bg = cell.tier.tier === "past"
                  ? `${v.accent}03`
                  : `${gSC(cell.score, v)}${cell.score >= 70 ? "30" : cell.score >= 45 ? "20" : "10"}`;
                return (
                  <button key={cell.day} onClick={() => { setSelDate(cell.date); setCalOpen(false); haptic("light"); }} className="btn" style={{
                    width: "100%", aspectRatio: "1", borderRadius: 8,
                    border: cell.isSelected ? `2px solid ${v.accent}` : cell.isToday ? `1.5px solid ${v.accent}50` : "1px solid transparent",
                    background: bg, cursor: "pointer", display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", padding: 0, fontFamily: "inherit",
                    opacity: cell.tier.tier === "past" ? 0.3 : 1,
                  }}>
                    <span style={{fontSize: 11, fontWeight: cell.isToday || cell.isSelected ? 900 : 500, color: cell.isSelected ? v.accent : cell.isToday ? v.text : v.textMuted}}>{cell.day}</span>
                    {cell.tier.tier !== "past" && <span style={{fontSize: 8, fontWeight: 800, color: gSC(cell.score, v)}}>{cell.score}</span>}
                  </button>
                );
              })}
            </div>
            {/* Legend */}
            <div style={{display: "flex", justifyContent: "center", gap: 12, marginTop: 8}}>
              {[{l: "Фактический", c: "#38a868"}, {l: "Расчётный", c: "#b0a030"}, {l: "По сезону", c: "#8a9aaa"}].map(t =>
                <div key={t.l} style={{display: "flex", alignItems: "center", gap: 4}}>
                  <div style={{width: 6, height: 6, borderRadius: "50%", background: t.c}} />
                  <span style={{fontSize: 9, color: v.textDim}}>{t.l}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </GC>

      {/* ═══ Selected day header (when calendar closed) ═══ */}

      {/* ═══ Fish selector ═══ */}
      <div style={{display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 10}}>
        <button onClick={() => setSelFish(null)} className="btn" style={{padding: "7px 14px", borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0, cursor: "pointer", fontFamily: "inherit", background: !selFish ? `${v.accent}18` : "transparent", border: `1.5px solid ${!selFish ? v.accent : v.cardBorder}`, color: !selFish ? v.accent : v.textMuted, fontSize: 12, fontWeight: 700}}>🎣 Все</button>
        {fl.map(([n, p]) =>
          <button key={n} onClick={() => { setSelFish(n); haptic("light"); }} className="btn" style={{padding: "7px 14px", borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0, cursor: "pointer", fontFamily: "inherit", background: selFish === n ? `${v.accent}18` : "transparent", border: `1.5px solid ${selFish === n ? v.accent : v.cardBorder}`, color: selFish === n ? v.accent : v.textMuted, fontSize: 12, fontWeight: 700}}>{p.emoji} {n}</button>
        )}
      </div>

      {/* ═══ Main score ring ═══ */}
      <GC v={v} style={{textAlign: "center", padding: "20px 20px 16px", borderRadius: 24}}>
        {wLd && isToday ? <div style={{padding: 20, color: v.textMuted}}>⏳</div> : <>
          <div style={{position: "relative", width: 110, height: 110, margin: "0 auto 12px"}}>
            <svg width={110} height={110} style={{transform: "rotate(-90deg)"}}>
              <circle cx={55} cy={55} r={46} fill="none" stroke={`${v.accent}10`} strokeWidth={7} />
              <circle cx={55} cy={55} r={46} fill="none" stroke={gSC(ds, v)} strokeWidth={7} strokeDasharray={289} strokeDashoffset={289 * (1 - ds / 100)} strokeLinecap="round" />
            </svg>
            <div style={{position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center"}}>
              <span style={{fontSize: 34, fontWeight: 900, color: gSC(ds, v)}}>{ds}</span>
              <span style={{fontSize: 10, color: v.textDim}}>%</span>
            </div>
          </div>
          <div style={{fontSize: 20, fontWeight: 800, color: gSC(ds, v)}}>{selFish ? `${selFish} — ${gSL(ds)}` : `${gSL(ds)} клёв`}</div>
          <div style={{fontSize: 13, color: v.textMuted, marginTop: 4}}>Лучшее время: <strong style={{color: v.text}}>{bestH.h}:00</strong> ({bestH.score}%)</div>
          {fd?.isSpawn && <div style={{fontSize: 12, color: v.btnDangerColor, marginTop: 6, fontWeight: 700}}>⚠️ Нерест</div>}
          {fd && <div style={{fontSize: 12, color: v.stats[0], marginTop: 4}}>🌡 Вода ≈{fd.waterTemp}°C · O₂ ≈{fd.o2} мг/л</div>}
          {pt && <div style={{marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 10, background: `${v.accent}08`}}>
            <span style={{fontSize: 12}}>{pt.icon}</span>
            <span style={{fontSize: 11, color: v.accent, fontWeight: 700}}>Давление {pt.label}</span>
          </div>}
          {!dw && <div style={{marginTop: 6, fontSize: 11, color: v.textDim, fontStyle: "italic"}}>
            {selTier.tier === "calc" ? "📊 Расчёт по луне, фотопериоду, сезону" : "📅 Среднесезонные данные"}
          </div>}
        </>}
      </GC>

      {/* Top fish */}
      {!selFish && adv && <GC v={v} style={{padding: 14, borderRadius: 16}}>
        <div style={{fontSize: 11, color: v.textDim, fontWeight: 700, marginBottom: 10}}>🏆 Лучший клёв · {selDayLabel}</div>
        {adv.topFish.map((f, i) =>
          <button key={f.fish} onClick={() => { setSelFish(f.fish); haptic("light"); }} className="btn" style={{width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 12, marginBottom: 4, background: i === 0 ? `${v.accent}08` : "transparent", border: `1px solid ${i === 0 ? `${v.accent}15` : "transparent"}`, cursor: "pointer", textAlign: "left", boxSizing: "border-box"}}>
            <span style={{fontSize: 10, fontWeight: 900, color: v.textDim, width: 20}}>{i + 1}</span>
            <span style={{fontSize: 18}}>{f.emoji}</span>
            <span style={{flex: 1, fontSize: 14, fontWeight: 700}}>{f.fish}</span>
            <span style={{fontSize: 16, fontWeight: 900, color: gSC(f.score, v)}}>{f.score}%</span>
          </button>
        )}
      </GC>}

      {/* Fish tip */}
      {selFish && fd && <GC v={v} style={{padding: 14, borderRadius: 16, border: `1px solid ${v.accentBorder}`}}>
        <div style={{fontSize: 13, fontWeight: 700, color: v.accent, marginBottom: 6}}>🎯 {selFish}</div>
        <div style={{fontSize: 13, color: v.textMuted, lineHeight: 1.7}}>{fd.tip}</div>
      </GC>}

      {/* Weather metrics (only for actual/calc) */}
      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10}}>
        {[
          {l: "Давление", val: dw?.pressure || "~760", u: "мм", c: v.stats[0]},
          {l: "Воздух", val: dw?.temp || getAvgTemp(gc?.lat || 55.75, dM), u: "°C", c: v.stats[2]},
          {l: "Ветер", val: dw?.wind || "~3", u: "м/с", c: v.textSecondary},
          {l: "Вода≈", val: dw ? estWT(dw.temp, dM) : estWT(getAvgTemp(gc?.lat || 55.75, dM), dM), u: "°C", c: v.stats[0]},
          {l: "O₂≈", val: estO2(estWT(dw?.temp || getAvgTemp(gc?.lat || 55.75, dM), dM)).toFixed(1), u: "мг/л", c: v.stats[1]},
          {l: "Свет", val: gc ? getDayLen(gc.lat, Math.floor((selDate - new Date(selDate.getFullYear(), 0, 0)) / 86400000)).toFixed(1) : "—", u: "ч", c: v.stats[3]},
        ].map(s =>
          <GC key={s.l} v={v} style={{padding: 10, borderRadius: 14, textAlign: "center"}}>
            <div style={{fontSize: 9, color: v.textDim, fontWeight: 700}}>{s.l}</div>
            <div style={{fontSize: 16, fontWeight: 900, color: s.c, marginTop: 3}}>{s.val}<span style={{fontSize: 9, color: v.textDim}}> {s.u}</span></div>
          </GC>
        )}
      </div>

      {/* Moon */}
      <GC v={v} style={{display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: 16}}>
        <span style={{fontSize: 34}}>{dm.icon}</span>
        <div style={{flex: 1}}>
          <div style={{fontSize: 10, color: v.textDim, fontWeight: 700}}>Луна</div>
          <div style={{fontSize: 15, fontWeight: 800, marginTop: 2}}>{dm.name}</div>
        </div>
        <div style={{fontSize: 15, fontWeight: 800, color: v.stats[2]}}>{Math.round(dm.factor * 100)}%</div>
      </GC>

      {/* Hourly chart */}
      <GC v={v} style={{padding: 16, borderRadius: 16}}>
        <div style={{fontSize: 11, color: v.textDim, fontWeight: 700, marginBottom: 12}}>По часам · {selDayLabel}</div>
        <div style={{display: "flex", alignItems: "flex-end", gap: 2, height: 70}}>
          {hourly.map(h => {
            const ic = isToday && h.h === ch;
            return (
              <div key={h.h} style={{flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3}}>
                <div style={{width: "100%", height: `${h.score * 0.62}px`, minHeight: 3, background: gSC(h.score, v), borderRadius: 3, opacity: ic ? 1 : 0.5, boxShadow: ic ? `0 0 8px ${gSC(h.score, v)}` : "none"}} />
                {(h.h % 4 === 0 || ic) && <span style={{fontSize: 8, color: ic ? v.text : v.textDim, fontWeight: ic ? 800 : 400}}>{h.h}</span>}
              </div>
            );
          })}
        </div>
      </GC>

      {/* All fish table */}
      {!selFish && adv && <GC v={v} style={{padding: 16, borderRadius: 16}}>
        <div style={{fontSize: 11, color: v.textDim, fontWeight: 700, marginBottom: 10}}>📊 Все виды</div>
        {adv.allScores.sort((a, b) => b.score - a.score).map((f, i) =>
          <button key={f.fish} onClick={() => { setSelFish(f.fish); haptic("light"); }} className="btn" style={{width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: i < adv.allScores.length - 1 ? `1px solid ${v.cardBorder}` : "none", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit"}}>
            <span style={{fontSize: 16}}>{f.emoji}</span>
            <span style={{flex: 1, fontSize: 13, fontWeight: 600}}>{f.fish}</span>
            {f.isSpawn && <span style={{fontSize: 9, color: v.btnDangerColor, fontWeight: 700, padding: "2px 6px", borderRadius: 6, background: `${v.btnDangerColor}10`}}>нерест</span>}
            <div style={{width: 50, height: 4, borderRadius: 2, background: `${v.accent}10`, overflow: "hidden"}}>
              <div style={{width: `${f.score}%`, height: "100%", background: gSC(f.score, v), borderRadius: 2}} />
            </div>
            <span style={{fontSize: 14, fontWeight: 800, color: gSC(f.score, v), width: 36, textAlign: "right"}}>{f.score}%</span>
          </button>
        )}
      </GC>}

      <button onClick={share} className="btn" style={{width: "100%", padding: 14, borderRadius: 16, background: `${v.accent}08`, border: `1.5px solid ${v.accent}25`, color: v.accent, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8}}>📤 Поделиться прогнозом</button>
    </div>
  );
}

// ═══ REMAINING SCREENS (compact) ═══
function Diary({go,sh,v}){const{catches:ca}=sh;const[f,sF]=useState("all");
const ft=[...new Set(ca.map(c=>c.fish))];
const fl=f==="all"?ca:ca.filter(c=>c.fish===f);
return (<div style={{padding:"0 16px 16px"}}><div className="f0" style={{padding:"16px 0"}}><div style={{fontSize:24,fontWeight:900}}>Дневник</div><div style={{fontSize:13,color:v.textMuted,marginTop:2}}>{ca.length} записей</div></div>
<button onClick={()=>go(SC.addCatch)} className="btn f1" style={{width:"100%",padding:14,borderRadius:16,border:"none",background:v.btnPrimary,color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"inherit",marginBottom:12}}>+ Добавить улов</button>
{ft.length>1&&<div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4,marginBottom:10}}>{["all",...ft].map(x=><button key={x} onClick={()=>sF(x)} className="btn" style={{padding:"6px 14px",borderRadius:20,border:`1px solid ${f===x?v.accent:v.cardBorder}`,background:f===x?`${v.accent}15`:"transparent",color:f===x?v.accent:v.textMuted,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}>{x==="all"?"Все":x}</button>)}</div>}
{fl.length===0?<div style={{textAlign:"center",padding:40,color:v.textDim}}>🎣 Пусто</div>:fl.map((c,i)=><button key={c.id} onClick={()=>{haptic("light");go(SC.viewCatch,c)}} className="btn" style={{...v.glass,width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:12,padding:14,cursor:"pointer",boxSizing:"border-box",borderRadius:16,marginBottom:8}}><div style={{width:46,height:46,borderRadius:12,background:`${v.accent}10`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{fE(c.fish)}</div><div style={{flex:1}}><div style={{fontWeight:700,fontSize:15}}>{c.fish}</div><div style={{fontSize:11,color:v.textMuted,marginTop:2}}>{c.location||"—"}</div></div><div style={{textAlign:"right"}}><div style={{fontWeight:900,fontSize:17,color:v.accent}}>{c.weight}<span style={{fontSize:10,color:v.textDim}}>кг</span></div><div style={{fontSize:10,color:v.textDim}}>{c.date}</div></div></button>)}</div>)}
function AddCatch({back,save,w,loc,v}){const[fm,sF]=useState({fish:"",weight:"",length:"",location:loc||"",bait:"",notes:"",date:new Date().toLocaleDateString("ru-RU"),weather:w?`${w.temp}°,${w.pressure}мм`:""});
const s=(k,val)=>sF(p=>({...p,[k]:val}));
return (<div style={{padding:"0 16px 16px"}}><div style={{padding:"16px 0"}}><div style={{fontSize:22,fontWeight:900}}>Добавить улов</div></div><div style={{display:"flex",flexDirection:"column",gap:10}}><Fl label="Рыба *" v={v}><TS v={v} value={fm.fish} onChange={e=>s("fish",e.target.value)}><option value="">Выбери</option>{FISH_LIST.map(f=><option key={f} value={f}>{f}</option>)}</TS></Fl><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Fl label="Вес кг" v={v}><TI v={v} type="number" step="0.1" placeholder="0.0" value={fm.weight} onChange={e=>s("weight",e.target.value)}/></Fl><Fl label="Длина см" v={v}><TI v={v} type="number" placeholder="0" value={fm.length} onChange={e=>s("length",e.target.value)}/></Fl></div><Fl label="Место" v={v}><TI v={v} placeholder="Водоём" value={fm.location} onChange={e=>s("location",e.target.value)}/></Fl><Fl label="Приманка" v={v}><TS v={v} value={fm.bait} onChange={e=>s("bait",e.target.value)}><option value="">Выбери</option>{BAITS.map(b=><option key={b} value={b}>{b}</option>)}</TS></Fl></div><button onClick={()=>{if(!fm.fish)return;save(fm);hapticN("success");back()}} className="btn" style={{width:"100%",padding:15,borderRadius:16,border:"none",background:v.btnPrimary,color:"#fff",fontWeight:800,fontSize:16,cursor:"pointer",fontFamily:"inherit",marginTop:14}}>💾 Сохранить</button></div>)}
function ViewCatch({back,c,del,v}){if(!c)return null;return (<div style={{padding:"0 16px 16px"}}><div style={{padding:"16px 0"}}><div style={{fontSize:22,fontWeight:900}}>Карточка</div></div><GC v={v} style={{borderRadius:20,overflow:"hidden",padding:0}}><div style={{height:120,background:`linear-gradient(135deg,${v.accent}15,${v.accent}08)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:56}}>{fE(c.fish)}</div><div style={{padding:16}}><div style={{fontSize:22,fontWeight:900,marginBottom:12}}>{c.fish}</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{[{l:"Вес",val:c.weight?`${c.weight}кг`:"—"},{l:"Длина",val:c.length?`${c.length}см`:"—"},{l:"Дата",val:c.date},{l:"Место",val:c.location||"—"},{l:"Приманка",val:c.bait||"—"}].map(s=><div key={s.l} style={{padding:"10px 12px",borderRadius:12,background:`${v.accent}05`,border:`1px solid ${v.cardBorder}`}}><div style={{fontSize:10,color:v.textDim,fontWeight:600}}>{s.l}</div><div style={{fontSize:14,fontWeight:700,marginTop:3}}>{s.val}</div></div>)}</div></div></GC><div style={{display:"flex",gap:8}}><button onClick={()=>{haptic("medium");
const t=`🐟 ${c.fish}${c.weight?` ${c.weight}кг`:""}${c.location?`\n📍 ${c.location}`:""}\n🎣 Клёвометр`;if(tg)tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(APP_LINK)}&text=${encodeURIComponent(t)}`);else navigator.clipboard?.writeText(t)}} className="btn" style={{flex:1,padding:14,borderRadius:16,border:`1.5px solid ${v.accent}30`,background:`${v.accent}08`,color:v.accent,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>📤</button><button onClick={()=>{hapticN("warning");del(c.id);back()}} className="btn" style={{flex:1,padding:14,borderRadius:16,border:`1.5px solid ${v.btnDangerBorder}`,background:v.btnDanger,color:v.btnDangerColor,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🗑</button></div></div>)}
function Stats({sh,v}){const{catches:ca=[],sessions:se=[]}=sh||{};
const tw=ca.reduce((a,c)=>a+(parseFloat(c.weight)||0),0).toFixed(1);
const mx=ca.reduce((a,c)=>(parseFloat(c.weight)||0)>(parseFloat(a.weight)||0)?c:a,{});
const fc=ca.reduce((a,c)=>{a[c.fish]=(a[c.fish]||0)+1;return a},{});
const tf=Object.entries(fc).sort((a,b)=>b[1]-a[1]);
return (<div style={{padding:"0 16px 16px"}}><div className="f0" style={{padding:"16px 0"}}><div style={{fontSize:24,fontWeight:900}}>Статистика</div></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>{[{l:"Уловов",val:ca.length,c:v.stats[0]},{l:"Вес",val:`${tw}кг`,c:v.stats[2]},{l:"Сессий",val:se.length,c:v.stats[1]}].map(s=><GC key={s.l} v={v} style={{padding:12,borderRadius:14,textAlign:"center"}}><div style={{fontSize:20,fontWeight:900,color:s.c}}>{s.val}</div><div style={{fontSize:9,color:v.textDim,fontWeight:700,marginTop:4}}>{s.l}</div></GC>)}</div>{ca.length===0?<div style={{textAlign:"center",padding:40,color:v.textDim}}>📊 Нет данных</div>:<>{mx.fish&&<GC v={v} style={{padding:16,borderRadius:16}}><div style={{fontSize:11,color:v.textDim,fontWeight:700,marginBottom:8}}>🏆 РЕКОРД</div><div style={{display:"flex",alignItems:"center",gap:12}}><span style={{fontSize:28}}>{fE(mx.fish)}</span><div style={{flex:1}}><div style={{fontWeight:800,fontSize:16}}>{mx.fish}</div></div><div style={{fontWeight:900,fontSize:22,color:v.stats[2]}}>{mx.weight}<span style={{fontSize:11,color:v.textDim}}>кг</span></div></div></GC>}{tf.length>0&&<GC v={v} style={{padding:16,borderRadius:16}}><div style={{fontSize:11,color:v.textDim,fontWeight:700,marginBottom:12}}>По видам</div>{tf.slice(0,5).map(([fish,cnt])=><div key={fish} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:13,fontWeight:700}}>{fish}</span><span style={{fontSize:12,color:v.textMuted}}>{cnt}</span></div><div style={{height:5,background:`${v.accent}10`,borderRadius:3}}><div style={{height:"100%",width:`${(cnt/tf[0][1])*100}%`,background:v.accentGrad,borderRadius:3}}/></div></div>)}</GC>}</>}</div>)}
function Social({v}){const[feed,setFeed]=useState([]);const[ld,setLd]=useState(true);
const lc=S.get("catches",[]);
const un=tg?.initDataUnsafe?.user?.first_name||"Я";useEffect(()=>{(async()=>{try{const pc=await sb.sel("catches","order=id.desc&limit=30");if(pc?.length){const uids=[...new Set(pc.map(c=>c.telegram_id).filter(Boolean))];let users={};if(uids.length){const ud=await sb.sel("users",`telegram_id=in.(${uids.join(",")})&select=telegram_id,first_name,nickname,avatar_emoji`);(ud||[]).forEach(u=>{users[u.telegram_id]=u})}setFeed(pc.filter(c=>c.telegram_id&&users[c.telegram_id]).map(c=>({...c,user:users[c.telegram_id]})))}}catch{}setLd(false)})()},[]);
const all=feed.length>0?feed:lc.map(c=>({...c,user:{first_name:un,avatar_emoji:"🎣"}}));
return (<div style={{padding:"0 16px 16px"}}><div className="f0" style={{padding:"16px 0"}}><div style={{fontSize:24,fontWeight:900}}>Лента</div><div style={{fontSize:13,color:v.textMuted,marginTop:2}}>{ld?"Загрузка...":`${all.length} записей`}</div></div>{ld?<div style={{textAlign:"center",padding:40,color:v.textMuted}}>⏳</div>:all.length===0?<div style={{textAlign:"center",padding:"50px 20px",color:v.textDim}}><div style={{fontSize:56}}>🎣</div><div style={{fontSize:16,fontWeight:700,marginTop:16}}>Лента пуста</div></div>:all.slice(0,20).map((c,i)=><GC key={c.id||i} v={v} style={{padding:16,borderRadius:20}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}><div style={{width:38,height:38,borderRadius:"50%",background:v.accentGrad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:"#fff"}}>{c.user?.avatar_emoji||(c.user?.first_name||"?").charAt(0)}</div><div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>{c.user?.nickname||c.user?.first_name||"Рыбак"}</div><div style={{fontSize:11,color:v.textDim}}>{c.date||"—"}</div></div></div><div style={{padding:14,borderRadius:14,background:`${v.accent}05`,border:`1px solid ${v.cardBorder}`}}><div style={{fontSize:16,fontWeight:800}}>{fE(c.fish)} {c.fish} {c.weight?`${c.weight}кг`:""}</div>{c.location&&<div style={{fontSize:12,color:v.textMuted,marginTop:4}}>📍 {c.location}</div>}</div></GC>)}</div>)}
function Gear({go,sh,v}){const{gearItems:gi,deleteGear:dg}=sh;return (<div style={{padding:"0 16px 16px"}}><div style={{padding:"16px 0"}}><div style={{fontSize:24,fontWeight:900}}>Снаряжение</div></div><button onClick={()=>go(SC.addGear)} className="btn" style={{width:"100%",padding:14,borderRadius:16,border:"none",background:v.btnPrimary,color:"#fff",fontWeight:800,cursor:"pointer",fontFamily:"inherit",marginBottom:12}}>+ Добавить</button>{gi.length===0?<div style={{textAlign:"center",padding:40,color:v.textDim}}>🎒 Пусто</div>:gi.map(g=><div key={g.id} style={{...v.glass,display:"flex",alignItems:"center",gap:12,padding:14,borderRadius:16,marginBottom:8}}><div style={{flex:1}}><div style={{fontWeight:700}}>{g.name}</div><div style={{fontSize:11,color:v.textMuted}}>{g.type}</div></div><button onClick={()=>{haptic("light");dg(g.id)}} style={{background:"none",border:"none",color:v.btnDangerColor,cursor:"pointer",fontSize:16}}>✕</button></div>)}</div>)}
function AddGearS({back,save,v}){const[fm,sF]=useState({name:"",type:""});return (<div style={{padding:"0 16px 16px"}}><div style={{padding:"16px 0"}}><div style={{fontSize:22,fontWeight:900}}>Добавить</div></div><div style={{display:"flex",flexDirection:"column",gap:10}}><Fl label="Название *" v={v}><TI v={v} value={fm.name} onChange={e=>sF(f=>({...f,name:e.target.value}))} placeholder="Название"/></Fl><Fl label="Тип" v={v}><TS v={v} value={fm.type} onChange={e=>sF(f=>({...f,type:e.target.value}))}><option value="">Тип</option>{GEAR_T.map(t=><option key={t} value={t}>{t}</option>)}</TS></Fl></div><button onClick={()=>{if(!fm.name)return;save(fm);hapticN("success");back()}} className="btn" style={{width:"100%",padding:15,borderRadius:16,border:"none",background:v.btnPrimary,color:"#fff",fontWeight:800,cursor:"pointer",fontFamily:"inherit",marginTop:14}}>💾</button></div>)}
function Spots({go,sh,v}){const{spots:sp=[],deleteSpot:ds}=sh||{};return (<div style={{padding:"0 16px 16px"}}><div style={{padding:"16px 0"}}><div style={{fontSize:24,fontWeight:900}}>Мои места</div></div><button onClick={()=>go(SC.addSpot)} className="btn" style={{width:"100%",padding:14,borderRadius:16,border:"none",background:v.btnPrimary,color:"#fff",fontWeight:800,cursor:"pointer",fontFamily:"inherit",marginBottom:12}}>+ Добавить</button>{sp.length===0?<div style={{textAlign:"center",padding:40,color:v.textDim}}>🗺 Нет мест</div>:sp.map(s=><div key={s.id} style={{...v.glass,display:"flex",gap:12,padding:14,borderRadius:16,marginBottom:8}}><div style={{flex:1}}><div style={{fontWeight:800}}>📍 {s.name}</div><div style={{fontSize:11,color:v.textMuted}}>{s.type||""}{s.privacy?` · ${s.privacy==="public"?"🌍":"🔒"}`:""}</div></div><button onClick={()=>{haptic("light");ds(s.id)}} style={{background:"none",border:"none",color:v.btnDangerColor,cursor:"pointer",fontSize:16}}>✕</button></div>)}</div>)}
function AddSpotS({back,save,v}){const[fm,sF]=useState({name:"",type:"",fish:"",privacy:"public"});
const s=(k,val)=>sF(p=>({...p,[k]:val}));return (<div style={{padding:"0 16px 16px"}}><div style={{padding:"16px 0"}}><div style={{fontSize:22,fontWeight:900}}>Добавить место</div></div><div style={{display:"flex",flexDirection:"column",gap:10}}><Fl label="Название *" v={v}><TI v={v} placeholder="Озеро Тихое" value={fm.name} onChange={e=>s("name",e.target.value)}/></Fl><Fl label="Тип" v={v}><TS v={v} value={fm.type} onChange={e=>s("type",e.target.value)}><option value="">Тип</option>{["Река","Озеро","Пруд","Водохранилище","Карьер"].map(t=><option key={t} value={t}>{t}</option>)}</TS></Fl><Fl label="Видимость" v={v}><div style={{display:"flex",gap:6}}>{[{k:"public",l:"🌍 Всем"},{k:"friends",l:"👥 Друзьям"},{k:"private",l:"🔒 Мне"}].map(p=><button key={p.k} onClick={()=>s("privacy",p.k)} className="btn" style={{flex:1,padding:8,borderRadius:10,fontSize:12,fontWeight:700,background:fm.privacy===p.k?`${v.accent}12`:`${v.accent}03`,border:`1.5px solid ${fm.privacy===p.k?`${v.accent}30`:v.cardBorder}`,color:fm.privacy===p.k?v.accent:v.textMuted,cursor:"pointer",fontFamily:"inherit"}}>{p.l}</button>)}</div></Fl></div><button onClick={()=>{if(!fm.name)return;save(fm);hapticN("success");back()}} className="btn" style={{width:"100%",padding:15,borderRadius:16,border:"none",background:v.btnPrimary,color:"#fff",fontWeight:800,cursor:"pointer",fontFamily:"inherit",marginTop:14}}>💾</button></div>)}
function Profile({sh,uName,go,v,tglTheme,isNight,sbU,upP,uAvatar}){const{catches:ca=[],gearItems:gi=[]}=sh||{};
const un=sbU?.nickname||tg?.initDataUnsafe?.user?.first_name||uName;
const uh=tg?.initDataUnsafe?.user?.username||"fisher";const[pr,sPr]=useState(()=>S.get("privacy","public"));
return (<div style={{padding:"0 16px 16px"}}><div className="f0" style={{textAlign:"center",padding:"20px 0 16px"}}><div style={{width:80,height:80,borderRadius:"50%",background:v.accentGrad,margin:"0 auto 12px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,border:`3px solid ${v.accentBorder}`}}>{uAvatar||"🎣"}</div><div style={{fontSize:22,fontWeight:900}}>{un}</div><div style={{fontSize:13,color:v.textMuted,marginTop:3}}>@{uh}</div></div>
<div className="f1" style={{display:"flex",gap:8,marginBottom:10}}><button onClick={()=>go(SC.editProfile)} className="btn" style={{...v.glass,flex:1,padding:14,borderRadius:16,cursor:"pointer",display:"flex",alignItems:"center",gap:10,textAlign:"left",boxSizing:"border-box"}}><span style={{fontSize:20}}>✏️</span><div style={{fontWeight:700,fontSize:14}}>Профиль</div></button><button onClick={()=>go(SC.locPicker)} className="btn" style={{...v.glass,flex:1,padding:14,borderRadius:16,cursor:"pointer",display:"flex",alignItems:"center",gap:10,textAlign:"left",boxSizing:"border-box"}}><span style={{fontSize:20}}>📍</span><div style={{fontWeight:700,fontSize:14}}>Гео</div></button></div>
<GC v={v} style={{padding:14,borderRadius:16}}><button onClick={tglTheme} className="btn" style={{width:"100%",display:"flex",alignItems:"center",gap:14,border:"none",background:"none",cursor:"pointer",textAlign:"left"}}><div style={{width:44,height:44,borderRadius:12,background:`${v.accent}10`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{isNight?"🌙":"☀️"}</div><div style={{flex:1}}><div style={{fontWeight:800,fontSize:15,color:v.text}}>Тема: {isNight?"Ночь":"День"}</div></div></button></GC>
{[{i:"🎒",l:"Снаряжение",sub:`${gi.length}`,s:SC.gear},{i:"👥",l:"Друзья",sub:"Telegram",s:SC.friends}].map(b=><button key={b.l} onClick={()=>go(b.s)} className="btn" style={{...v.glass,width:"100%",padding:16,borderRadius:16,marginBottom:10,cursor:"pointer",display:"flex",alignItems:"center",gap:14,textAlign:"left",boxSizing:"border-box"}}><div style={{width:44,height:44,borderRadius:12,background:`${v.accent}10`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{b.i}</div><div style={{flex:1}}><div style={{fontWeight:800,fontSize:15}}>{b.l}</div><div style={{fontSize:12,color:v.textMuted}}>{b.sub}</div></div><span style={{color:v.textMuted}}>›</span></button>)}
<GC v={v} style={{padding:16,borderRadius:16}}><div style={{fontSize:11,color:v.textDim,fontWeight:700,marginBottom:12}}>🔐 Приватность</div>{[{k:"public",i:"🌍",l:"Общедоступный",c:v.stats[1]},{k:"private",i:"🔒",l:"Приватный",c:v.stats[2]},{k:"ghost",i:"👻",l:"Невидимка",c:v.btnDangerColor}].map(m=><button key={m.k} onClick={()=>{sPr(m.k);S.set("privacy",m.k);haptic("medium")}} className="btn" style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,marginBottom:6,cursor:"pointer",textAlign:"left",background:pr===m.k?`${m.c}10`:`${v.accent}03`,border:`1.5px solid ${pr===m.k?`${m.c}40`:v.cardBorder}`}}><span style={{fontSize:24}}>{m.i}</span><div style={{flex:1}}><div style={{fontWeight:700,fontSize:14,color:pr===m.k?m.c:v.text}}>{m.l}</div></div><div style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${pr===m.k?m.c:v.textDim}`,display:"flex",alignItems:"center",justifyContent:"center"}}>{pr===m.k&&<div style={{width:12,height:12,borderRadius:"50%",background:m.c}}/>}</div></button>)}</GC></div>)}
function Friends({back,v}){const[fr,sFr]=useState(()=>S.get("friends",[]));const[inp,sInp]=useState("");const[adding,sAdd]=useState(false);
const add=()=>{const u=inp.trim().replace(/^@/,"");if(!u||fr.some(f=>f.username===u))return;hapticN("success");
const up=[...fr,{username:u,addedAt:Date.now(),displayName:u}];sFr(up);S.set("friends",up);sInp("");sAdd(false)};return (<div style={{padding:"0 16px 16px"}}><div style={{padding:"16px 0"}}><div style={{fontSize:24,fontWeight:900}}>Друзья</div></div>{adding?<GC v={v} style={{padding:16,borderRadius:16}}><div style={{display:"flex",gap:8}}><TI v={v} value={inp} onChange={e=>sInp(e.target.value)} placeholder="@username" onKeyDown={e=>e.key==="Enter"&&add()} style={{flex:1}}/><button onClick={add} className="btn" style={{padding:"10px 18px",borderRadius:12,background:v.btnPrimary,color:"#fff",fontWeight:800,border:"none",cursor:"pointer"}}>+</button></div></GC>:<button onClick={()=>sAdd(true)} className="btn" style={{width:"100%",padding:14,borderRadius:14,background:`${v.accent}08`,border:`1.5px solid ${v.accent}25`,color:v.accent,fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"inherit",marginBottom:12}}>+ Добавить</button>}{fr.map(f=><div key={f.username} style={{...v.glass,padding:14,borderRadius:14,marginBottom:8,display:"flex",alignItems:"center",gap:12}}><div style={{width:44,height:44,borderRadius:"50%",background:v.accentGrad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:"#fff"}}>{f.displayName.charAt(0).toUpperCase()}</div><div style={{flex:1}}><div style={{fontWeight:700}}>@{f.username}</div></div><button onClick={()=>{haptic("medium");
const up=fr.filter(x=>x.username!==f.username);sFr(up);S.set("friends",up)}} style={{background:"none",border:"none",color:v.btnDangerColor,cursor:"pointer",fontSize:18}}>✕</button></div>)}{fr.length===0&&!adding&&<div style={{textAlign:"center",padding:40,color:v.textDim}}>👥 Добавь друзей</div>}</div>)}
function EditProf({back,v,sbU,upP,uAvatar}){const AV=["🎣","🐟","🐠","🐡","🦈","🐊","🐢","🦀","🌊","⛵","🎯","🏆","👤","🧔","🐻","🦅","🐺","🦊"];const[nick,sNick]=useState(sbU?.nickname||tg?.initDataUnsafe?.user?.first_name||"");const[av,sAv]=useState(uAvatar||"🎣");const[saving,sSaving]=useState(false);return (<div style={{padding:"0 16px 16px"}}><div style={{padding:"16px 0"}}><div style={{fontSize:22,fontWeight:900}}>Профиль</div></div><GC v={v} style={{padding:16,borderRadius:16,textAlign:"center"}}><div style={{width:80,height:80,borderRadius:"50%",background:v.accentGrad,margin:"0 auto 12px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,border:`3px solid ${v.accentBorder}`}}>{av}</div><div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center"}}>{AV.map(e=><button key={e} onClick={()=>{sAv(e);haptic("light")}} className="btn" style={{width:44,height:44,borderRadius:12,fontSize:22,display:"flex",alignItems:"center",justifyContent:"center",background:av===e?`${v.accent}20`:`${v.accent}05`,border:`2px solid ${av===e?v.accent:"transparent"}`,cursor:"pointer"}}>{e}</button>)}</div></GC><GC v={v} style={{padding:16,borderRadius:16}}><Fl label="Никнейм" v={v}><TI v={v} value={nick} onChange={e=>sNick(e.target.value)} placeholder="Имя" maxLength={30}/></Fl></GC><button onClick={async()=>{sSaving(true);await upP({nickname:nick.trim()||null,avatar_emoji:av});hapticN("success");sSaving(false);back()}} disabled={saving} className="btn" style={{width:"100%",padding:15,borderRadius:16,border:"none",background:v.btnPrimary,color:"#fff",fontWeight:800,cursor:"pointer",fontFamily:"inherit",opacity:saving?.6:1}}>{saving?"⏳":"💾 Сохранить"}</button></div>)}
function LocPicker({back,v,upP,clL,setML,sbU}){const[sq,sSq]=useState("");const[sr,sSr]=useState([]);const[searching,sSrch]=useState(false);
const cc=sbU?.custom_city;
const search=async()=>{if(!sq.trim())return;sSrch(true);try{const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(sq)}&format=json&limit=5&accept-language=ru`);
const d=await r.json();sSr(d.map(x=>({name:x.display_name.split(",")[0],fullName:x.display_name,lat:parseFloat(x.lat),lon:parseFloat(x.lon)})))}catch{}sSrch(false)};
const sel=async c=>{await upP({custom_lat:c.lat,custom_lng:c.lon,custom_city:c.name});setML({lat:c.lat,lon:c.lon,city:c.name});hapticN("success");back()};return (<div style={{padding:"0 16px 16px"}}><div style={{padding:"16px 0"}}><div style={{fontSize:22,fontWeight:900}}>Геолокация</div></div>{cc&&<GC v={v} style={{padding:14,borderRadius:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}><div><div style={{fontSize:11,color:v.textDim}}>ТЕКУЩАЯ</div><div style={{fontSize:16,fontWeight:800,color:v.accent,marginTop:4}}>📍 {cc}</div></div><button onClick={async()=>{await clL();setML(null);hapticN("success");back()}} className="btn" style={{padding:"8px 14px",borderRadius:10,background:v.btnDanger,border:`1px solid ${v.btnDangerBorder}`,color:v.btnDangerColor,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Сбросить</button></GC>}<GC v={v} style={{padding:14,borderRadius:16}}><div style={{display:"flex",gap:8}}><TI v={v} value={sq} onChange={e=>sSq(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()} placeholder="Москва..." style={{flex:1}}/><button onClick={search} className="btn" style={{padding:"10px 16px",borderRadius:12,background:v.btnPrimary,color:"#fff",fontWeight:800,border:"none",cursor:"pointer"}}>{searching?"...":"🔍"}</button></div>{sr.map((r,i)=><button key={i} onClick={()=>sel(r)} className="btn" style={{width:"100%",textAlign:"left",padding:"10px 12px",borderRadius:10,marginTop:4,background:`${v.accent}05`,border:`1px solid ${v.cardBorder}`,cursor:"pointer",fontFamily:"inherit"}}><div style={{fontWeight:700,fontSize:14}}>📍 {r.name}</div><div style={{fontSize:11,color:v.textDim,marginTop:2}}>{r.fullName}</div></button>)}</GC><GC v={v} style={{padding:16,borderRadius:16}}><div style={{fontSize:11,color:v.textDim,fontWeight:700,marginBottom:10}}>Популярные</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{CITIES.map(c=><button key={c.n} onClick={()=>sel({name:c.n,lat:c.lat,lon:c.lon})} className="btn" style={{padding:"8px 14px",borderRadius:12,background:cc===c.n?`${v.accent}15`:`${v.accent}05`,border:`1px solid ${cc===c.n?v.accent:v.cardBorder}`,color:cc===c.n?v.accent:v.text,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{c.n}</button>)}</div></GC></div>)}
function Tourns({v,go}){const[ts,sTs]=useState([]);const[my,sMy]=useState([]);const[cr,sCr]=useState(false);const[ld,sLd]=useState(true);const[jc,sJc]=useState("");const[fm,sFm]=useState({name:"",scoring:"count"});
const tgId=tg?.initDataUnsafe?.user?.id;
const tgN=tg?.initDataUnsafe?.user?.first_name||"";
const tgU=tg?.initDataUnsafe?.user?.username||"";
const load=useCallback(async()=>{if(!tgId){sLd(false);return}try{const p=await sb.sel("tournament_participants",`user_id=eq.${tgId}&select=tournament_id`);
const ids=(p||[]).map(x=>x.tournament_id);if(ids.length){const t=await sb.sel("tournaments",`id=in.(${ids.join(",")})`);sMy(t||[])}
const pub=await sb.sel("tournaments","type=eq.public&status=eq.active&order=created_at.desc&limit=10");sTs(pub||[])}catch{}sLd(false)},[tgId]);useEffect(()=>{load()},[load]);
const create=async()=>{if(!fm.name.trim()||!tgId)return;
const ic=genCode();
const r=await sb.ins("tournaments",{creator_id:tgId,name:fm.name,type:"private",scoring:fm.scoring,invite_code:ic,status:"active"});if(r?.[0]){await sb.ins("tournament_participants",{tournament_id:r[0].id,user_id:tgId,username:tgU,first_name:tgN});hapticN("success");sCr(false);load()}};
const join=async()=>{const c=jc.trim().toUpperCase();if(!c||!tgId)return;
const t=await sb.sel("tournaments",`invite_code=eq.${c}`);if(t?.length){const e=await sb.sel("tournament_participants",`tournament_id=eq.${t[0].id}&user_id=eq.${tgId}`);if(!e?.length)await sb.ins("tournament_participants",{tournament_id:t[0].id,user_id:tgId,username:tgU,first_name:tgN});hapticN("success");sJc("");go(SC.tView,t[0])}else hapticN("error")};
const all=[...my,...ts.filter(t=>!my.some(m=>m.id===t.id))];return (<div style={{padding:"0 16px 16px"}}><div className="f0" style={{padding:"16px 0"}}><div style={{fontSize:24,fontWeight:900}}>Турниры</div></div><GC v={v} style={{padding:14,borderRadius:16}}><div style={{fontSize:11,color:v.textDim,fontWeight:700,marginBottom:8}}>КОД</div><div style={{display:"flex",gap:8}}><TI v={v} value={jc} onChange={e=>sJc(e.target.value.toUpperCase())} placeholder="ABC123" onKeyDown={e=>e.key==="Enter"&&join()} style={{flex:1,textTransform:"uppercase",letterSpacing:2,fontWeight:800,textAlign:"center"}} maxLength={6}/><button onClick={join} className="btn" style={{padding:"10px 18px",borderRadius:12,background:v.btnPrimary,color:"#fff",fontWeight:800,border:"none",cursor:"pointer",fontFamily:"inherit"}}>Войти</button></div></GC>{cr?<GC v={v} style={{padding:16}}><Fl label="Название" v={v}><TI v={v} value={fm.name} onChange={e=>sFm(f=>({...f,name:e.target.value}))} placeholder="Турнир"/></Fl><div style={{display:"flex",gap:8,marginTop:10}}><button onClick={create} className="btn" style={{flex:1,padding:14,borderRadius:14,background:v.btnPrimary,color:"#fff",fontWeight:800,border:"none",cursor:"pointer",fontFamily:"inherit"}}>Создать</button><button onClick={()=>sCr(false)} className="btn" style={{padding:"14px 20px",borderRadius:14,border:`1px solid ${v.cardBorder}`,background:"transparent",color:v.textMuted,cursor:"pointer",fontFamily:"inherit"}}>✕</button></div></GC>:<button onClick={()=>sCr(true)} className="btn" style={{width:"100%",padding:14,borderRadius:16,background:`${v.stats[2]}10`,border:`1.5px solid ${v.stats[2]}25`,color:v.stats[2],fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"inherit",marginBottom:12}}>+ Создать</button>}{ld?<div style={{textAlign:"center",padding:30,color:v.textMuted}}>⏳</div>:all.length===0?<div style={{textAlign:"center",padding:40,color:v.textDim}}>🏆 Создай или войди</div>:all.map(t=><button key={t.id} onClick={()=>{haptic("light");go(SC.tView,t)}} className="btn" style={{...v.glass,width:"100%",textAlign:"left",padding:16,borderRadius:20,marginBottom:10,cursor:"pointer",boxSizing:"border-box"}}><div style={{fontSize:17,fontWeight:800}}>🏆 {t.name}</div><div style={{fontSize:12,color:v.textMuted,marginTop:6}}>🔑 {t.invite_code}</div></button>)}</div>)}
function TournView({back,tourn:init,v,saveCatch}){const[t,sT]=useState(init);const[ps,sPs]=useState([]);const[cs,sCs]=useState([]);const[adding,sAdd]=useState(false);const[fm,sFm]=useState({fish:"",weight:""});
const tgId=tg?.initDataUnsafe?.user?.id;useEffect(()=>{if(!t)return;
const l=async()=>{const[p,c]=await Promise.all([sb.sel("tournament_participants",`tournament_id=eq.${t.id}`),sb.sel("tournament_catches",`tournament_id=eq.${t.id}&order=created_at.desc`)]);sPs(p||[]);sCs(c||[])};l();
const iv=setInterval(l,15000);return ()=>clearInterval(iv)},[t]);
const add=async()=>{if(!fm.fish||!tgId||!t)return;await sb.ins("tournament_catches",{tournament_id:t.id,user_id:tgId,fish:fm.fish,weight:parseFloat(fm.weight)||0});saveCatch({fish:fm.fish,weight:fm.weight,date:new Date().toLocaleDateString("ru-RU"),notes:`Турнир: ${t.name}`});hapticN("success");sFm({fish:"",weight:""});sAdd(false);const[p,c]=await Promise.all([sb.sel("tournament_participants",`tournament_id=eq.${t.id}`),sb.sel("tournament_catches",`tournament_id=eq.${t.id}&order=created_at.desc`)]);sPs(p||[]);sCs(c||[])};if(!t)return null;
const lb=[...ps].sort((a,b)=>(b.total_caught||0)-(a.total_caught||0));return (<div style={{padding:"0 16px 16px"}}><div style={{padding:"16px 0"}}><div style={{fontSize:24,fontWeight:900}}>🏆 {t.name}</div></div><GC v={v} style={{padding:14,borderRadius:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}><div><div style={{fontSize:11,color:v.textDim}}>КОД</div><div style={{fontSize:24,fontWeight:900,color:v.accent,letterSpacing:4,marginTop:4}}>{t.invite_code}</div></div><button onClick={()=>{haptic("medium");
const txt=`🏆 "${t.name}" · ${t.invite_code}`;if(tg)tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(APP_LINK)}&text=${encodeURIComponent(txt)}`)}} className="btn" style={{padding:"10px 16px",borderRadius:12,background:v.btnPrimary,color:"#fff",fontWeight:800,border:"none",cursor:"pointer",fontFamily:"inherit"}}>📤</button></GC>{adding?<GC v={v} style={{padding:16}}><TS v={v} value={fm.fish} onChange={e=>sFm(f=>({...f,fish:e.target.value}))}><option value="">Рыба</option>{FISH_LIST.map(f=><option key={f} value={f}>{f}</option>)}</TS><div style={{display:"flex",gap:8,marginTop:8}}><TI v={v} type="number" step="0.1" placeholder="Вес" value={fm.weight} onChange={e=>sFm(f=>({...f,weight:e.target.value}))} style={{flex:1}}/><button onClick={add} className="btn" style={{padding:"10px 18px",borderRadius:12,background:v.btnPrimary,color:"#fff",fontWeight:800,border:"none",cursor:"pointer"}}>+</button><button onClick={()=>sAdd(false)} style={{padding:10,borderRadius:12,border:`1px solid ${v.cardBorder}`,background:"transparent",color:v.textMuted,cursor:"pointer"}}>✕</button></div></GC>:<button onClick={()=>sAdd(true)} className="btn" style={{width:"100%",padding:14,borderRadius:16,background:`${v.accent}08`,border:`1.5px solid ${v.accent}25`,color:v.accent,fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"inherit",marginBottom:10}}>🐟 Записать</button>}<GC v={v} style={{padding:16,borderRadius:16}}><div style={{fontSize:11,color:v.textDim,fontWeight:700,marginBottom:12}}>🏅 ЛИДЕРБОРД · {ps.length}</div>{lb.map((p,i)=>{const me=p.user_id===tgId;
const md=i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}`;return (<div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:i<lb.length-1?`1px solid ${v.cardBorder}`:"none"}}><span style={{fontSize:i<3?20:14,width:28,textAlign:"center",fontWeight:900,color:v.textMuted}}>{md}</span><div style={{flex:1}}><div style={{fontWeight:me?800:600,fontSize:14,color:me?v.accent:v.text}}>{p.first_name||"—"}{me?" (ты)":""}</div></div><div style={{fontWeight:900,fontSize:16,color:i===0?v.accent:v.text}}>{p.total_caught||0}</div></div>)})}</GC></div>)}
function TournJoin({back,inv,v,go}){const[t,sT]=useState(null);const[ld,sLd]=useState(true);const[joined,sJ]=useState(false);
const tgId=tg?.initDataUnsafe?.user?.id;useEffect(()=>{(async()=>{if(!inv?.invite_code){sLd(false);return}
const ts=await sb.sel("tournaments",`invite_code=eq.${inv.invite_code}`);if(ts?.length)sT(ts[0]);sLd(false)})()},[inv]);
const join=async()=>{if(!t||!tgId)return;
const e=await sb.sel("tournament_participants",`tournament_id=eq.${t.id}&user_id=eq.${tgId}`);if(!e?.length)await sb.ins("tournament_participants",{tournament_id:t.id,user_id:tgId,username:tg?.initDataUnsafe?.user?.username||"",first_name:tg?.initDataUnsafe?.user?.first_name||""});hapticN("success");sJ(true);setTimeout(()=>go(SC.tView,t),500)};if(ld)return <div style={{padding:"60px 20px",textAlign:"center",color:v.textMuted}}>⏳</div>;if(!t)return <div style={{padding:"60px 20px",textAlign:"center"}}><div style={{fontSize:48}}>😕</div><div style={{fontSize:16,fontWeight:700,marginTop:16}}>Не найден</div><button onClick={back} className="btn" style={{marginTop:20,padding:"12px 30px",borderRadius:14,background:v.btnPrimary,color:"#fff",fontWeight:800,border:"none",cursor:"pointer",fontFamily:"inherit"}}>Назад</button></div>;return (<div style={{padding:"40px 16px",textAlign:"center"}}><div style={{fontSize:64}}>🏆</div><div style={{fontSize:22,fontWeight:900,marginTop:16}}>{t.name}</div><button onClick={join} disabled={joined} className="btn" style={{marginTop:30,padding:"16px 50px",borderRadius:18,background:joined?`${v.accent}30`:v.btnPrimary,color:"#fff",fontWeight:900,fontSize:18,border:"none",cursor:"pointer",fontFamily:"inherit"}}>{joined?"✅":"Присоединиться"}</button></div>)}
function Plan({wd,v}){const[plans,sPlans]=useState(()=>S.get("plans",[]));const[adding,sAdd]=useState(false);const[fm,sFm]=useState({date:"",location:""});
const add=()=>{if(!fm.date)return;
const up=[...plans,{id:Date.now(),...fm}].sort((a,b)=>a.date.localeCompare(b.date));sPlans(up);S.set("plans",up);sAdd(false);sFm({date:"",location:""});hapticN("success")};
const del=id=>{haptic("medium");
const up=plans.filter(p=>p.id!==id);sPlans(up);S.set("plans",up)};return (<div style={{padding:"0 16px 16px"}}><div style={{padding:"16px 0"}}><div style={{fontSize:24,fontWeight:900}}>Планирование</div></div>{adding?<GC v={v} style={{padding:16}}><div style={{display:"flex",flexDirection:"column",gap:12}}><Fl label="Дата" v={v}><TI v={v} type="date" value={fm.date} onChange={e=>sFm(f=>({...f,date:e.target.value}))}/></Fl><Fl label="Место" v={v}><TI v={v} value={fm.location} onChange={e=>sFm(f=>({...f,location:e.target.value}))} placeholder="Озеро..."/></Fl><div style={{display:"flex",gap:8}}><button onClick={add} className="btn" style={{flex:1,padding:14,borderRadius:14,background:v.btnPrimary,color:"#fff",fontWeight:800,border:"none",cursor:"pointer",fontFamily:"inherit"}}>Сохранить</button><button onClick={()=>sAdd(false)} className="btn" style={{padding:"14px 20px",borderRadius:14,border:`1px solid ${v.cardBorder}`,background:"transparent",color:v.textMuted,cursor:"pointer",fontFamily:"inherit"}}>✕</button></div></div></GC>:<button onClick={()=>sAdd(true)} className="btn" style={{width:"100%",padding:14,borderRadius:16,background:`${v.stats[3]}10`,border:`1.5px solid ${v.stats[3]}25`,color:v.stats[3],fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"inherit",marginBottom:12}}>+ Запланировать</button>}{plans.map(p=>{const ds=new Date(p.date).toLocaleDateString("ru-RU",{weekday:"short",day:"numeric",month:"short"});return (<div key={p.id} style={{...v.glass,borderRadius:16,marginBottom:8,padding:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontWeight:700}}>📅 {ds}</div>{p.location&&<div style={{fontSize:12,color:v.textMuted,marginTop:2}}>📍 {p.location}</div>}</div><button onClick={()=>del(p.id)} style={{background:"none",border:"none",color:v.btnDangerColor,cursor:"pointer",fontSize:16}}>✕</button></div>)})}{plans.length===0&&!adding&&<div style={{textAlign:"center",padding:40,color:v.textDim}}>📅 Запланируй</div>}</div>)}
function MapScr({sh,v}){const{spots:sp=[],saveSpot:sSp,deleteSpot:dSp}=sh||{};
const mRef=useRef(null);
const mI=useRef(null);const[rdy,sRdy]=useState(false);const[am,sAm]=useState(false);const[wl,sWl]=useState("none");const[sq,sSq]=useState("");
const mkR=useRef([]);
const wlR=useRef(null);useEffect(()=>{if(window.L){sRdy(true);return}
const css=document.createElement("link");css.rel="stylesheet";css.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";document.head.appendChild(css);
const js=document.createElement("script");js.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";js.onload=()=>sRdy(true);document.head.appendChild(js)},[]);useEffect(()=>{if(!rdy||!mRef.current||mI.current)return;
const L=window.L;
const map=L.map(mRef.current,{center:[55.75,37.62],zoom:10,zoomControl:false,attributionControl:false});L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18}).addTo(map);L.control.zoom({position:"bottomright"}).addTo(map);navigator.geolocation?.getCurrentPosition(p=>map.setView([p.coords.latitude,p.coords.longitude],12),()=>{},{timeout:5000});map.on("click",e=>{if(!window._klAM)return;
const n=prompt("Название:");if(!n)return;
const d=prompt("Глубина (м):");
const note=prompt("Тип:");sSp({name:n,lat:e.latlng.lat,lng:e.latlng.lng,depth:d||"",note:note||"",privacy:"public",date:new Date().toLocaleDateString("ru-RU")});window._klAM=false;sAm(false)});mI.current=map;return ()=>{map.remove();mI.current=null}},[rdy]);useEffect(()=>{if(!mI.current||!window.L)return;
const L=window.L,map=mI.current;mkR.current.forEach(m=>map.removeLayer(m));mkR.current=[];sp.forEach(s=>{if(!s.lat||!s.lng)return;
const d=parseFloat(s.depth)||0;
const mc=d>10?"#1a3a6a":d>5?"#2a6090":d>0?"#7ab8e0":(v.isDark?"#b0c8e8":"#2a6090");
const ic=L.divIcon({className:"",html:`<div style="width:30px;height:30px;border-radius:50%;background:${mc};display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 10px ${mc}80;border:2px solid rgba(255,255,255,.4)">📍</div>`,iconSize:[30,30],iconAnchor:[15,30]});
const mk=L.marker([s.lat,s.lng],{icon:ic}).addTo(map);mk.bindPopup(`<div style="font-family:sans-serif"><b>${s.name}</b>${s.depth?`<br>↓ ${s.depth}м`:""}<br><button onclick="window._klDel&&window._klDel(${s.id})" style="margin-top:6px;padding:4px 10px;border-radius:6px;border:1px solid #c05050;background:rgba(200,60,60,0.1);color:#c05050;font-weight:700;cursor:pointer;font-size:12px">🗑</button></div>`);mkR.current.push(mk)});window._klDel=id=>{dSp(id);haptic("medium")};return ()=>{delete window._klDel}},[sp,rdy,v]);useEffect(()=>{if(!mI.current||!window.L)return;if(wlR.current){mI.current.removeLayer(wlR.current);wlR.current=null}if(wl!=="none")wlR.current=window.L.tileLayer(`https://tile.openweathermap.org/map/${wl}/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`,{maxZoom:18,opacity:.6}).addTo(mI.current)},[wl,rdy]);
const search=async()=>{if(!sq.trim()||!mI.current)return;try{const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(sq)}&format=json&limit=1&accept-language=ru`);
const d=await r.json();if(d.length){mI.current.setView([parseFloat(d[0].lat),parseFloat(d[0].lon)],13);haptic("medium")}}catch{}};return (<div style={{height:"100vh",display:"flex",flexDirection:"column",position:"relative"}}><div style={{position:"absolute",top:0,left:0,right:0,zIndex:1000,padding:"10px 12px",background:v.isDark?"linear-gradient(to bottom,rgba(6,8,14,.92),transparent)":"linear-gradient(to bottom,rgba(200,220,236,.95),transparent)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={{fontSize:20,fontWeight:900}}>Карта</div><button onClick={()=>{const n=!am;sAm(n);window._klAM=n}} className="btn" style={{padding:"8px 14px",borderRadius:10,fontFamily:"inherit",fontWeight:800,fontSize:12,cursor:"pointer",background:am?v.btnDanger:v.btnPrimary,color:am?v.btnDangerColor:"#fff",border:am?`1px solid ${v.btnDangerBorder}`:"none"}}>{am?"✕":"+ Метка"}</button></div><div style={{display:"flex",gap:6}}><TI v={v} value={sq} onChange={e=>sSq(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()} placeholder="Поиск..." style={{flex:1,padding:"8px 12px",fontSize:13,borderRadius:10,background:v.isDark?"rgba(8,18,34,.85)":"rgba(255,255,255,.85)"}}/><button onClick={search} className="btn" style={{padding:"8px 14px",borderRadius:10,background:`${v.accent}15`,border:`1px solid ${v.accent}30`,color:v.accent,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🔍</button></div><div style={{display:"flex",gap:5,marginTop:8}}>{[{k:"none",l:"🗺"},{k:"precipitation_new",l:"🌧"},{k:"temp_new",l:"🌡"},{k:"clouds_new",l:"☁️"}].map(m=><button key={m.k} onClick={()=>{sWl(m.k);haptic("light")}} className="btn" style={{flex:1,padding:"6px 4px",borderRadius:8,fontSize:14,cursor:"pointer",background:wl===m.k?`${v.accent}15`:(v.isDark?"rgba(8,18,34,.8)":"rgba(255,255,255,.8)"),border:`1px solid ${wl===m.k?`${v.accent}30`:v.cardBorder}`,color:wl===m.k?v.accent:v.textMuted}}>{m.l}</button>)}</div></div>{am&&<div style={{position:"absolute",top:120,left:"50%",transform:"translateX(-50%)",zIndex:1000,padding:"8px 20px",borderRadius:20,background:v.accent,color:v.isDark?"#0a0e18":"#fff",fontSize:13,fontWeight:700}}>👆 Нажми на карту</div>}<div ref={mRef} style={{flex:1,width:"100%",background:v.isDark?"#0a1628":"#c8dce8"}}>{!rdy&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:v.textMuted}}>⏳</div>}</div></div>)}

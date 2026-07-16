(() => {
  const state = {
    unit: localStorage.getItem('unit') || 'c',
    place: JSON.parse(localStorage.getItem('place') || 'null') || {
      name: 'San Francisco', country: 'US', admin1: 'California', latitude: 37.7749, longitude: -122.4194
    },
  };

  const $ = (s) => document.querySelector(s);
  const content = $('#content');
  const qInput = $('#q');
  const sugs = $('#sugs');

  // WMO weather code map -> {label, emoji, theme}
  const codeMap = (code, isDay) => {
    const m = {
      0:  ['Clear sky',            isDay?'☀️':'🌙', isDay?'clear-day':'clear-night'],
      1:  ['Mainly clear',         isDay?'🌤️':'🌙', isDay?'clear-day':'clear-night'],
      2:  ['Partly cloudy',        isDay?'⛅':'☁️', 'cloudy'],
      3:  ['Overcast',             '☁️', 'cloudy'],
      45: ['Fog',                  '🌫️', 'fog'],
      48: ['Rime fog',             '🌫️', 'fog'],
      51: ['Light drizzle',        '🌦️', 'rain'],
      53: ['Drizzle',              '🌦️', 'rain'],
      55: ['Heavy drizzle',        '🌧️', 'rain'],
      56: ['Freezing drizzle',     '🌧️', 'rain'],
      57: ['Freezing drizzle',     '🌧️', 'rain'],
      61: ['Light rain',           '🌦️', 'rain'],
      63: ['Rain',                 '🌧️', 'rain'],
      65: ['Heavy rain',           '🌧️', 'rain'],
      66: ['Freezing rain',        '🌧️', 'rain'],
      67: ['Freezing rain',        '🌧️', 'rain'],
      71: ['Light snow',           '🌨️', 'snow'],
      73: ['Snow',                 '❄️', 'snow'],
      75: ['Heavy snow',           '❄️', 'snow'],
      77: ['Snow grains',          '❄️', 'snow'],
      80: ['Rain showers',         '🌦️', 'rain'],
      81: ['Rain showers',         '🌧️', 'rain'],
      82: ['Violent showers',      '⛈️', 'storm'],
      85: ['Snow showers',         '🌨️', 'snow'],
      86: ['Snow showers',         '❄️', 'snow'],
      95: ['Thunderstorm',         '⛈️', 'storm'],
      96: ['Thunderstorm & hail',  '⛈️', 'storm'],
      99: ['Thunderstorm & hail',  '⛈️', 'storm'],
    };
    return m[code] || ['Unknown','❓','cloudy'];
  };

  const setTheme = (theme) => {
    document.body.className = 'theme-' + theme;
    buildRain(theme === 'rain' || theme === 'storm');
    buildSnow(theme === 'snow');
  };

  const buildRain = (on) => {
    const el = $('#rain'); el.innerHTML = '';
    if (!on) return;
    for (let i = 0; i < 90; i++) {
      const d = document.createElement('span');
      d.className = 'drop';
      d.style.left = Math.random()*100 + '%';
      d.style.animationDuration = (0.5 + Math.random()*0.7) + 's';
      d.style.animationDelay = (Math.random()*-2) + 's';
      d.style.opacity = 0.4 + Math.random()*0.5;
      el.appendChild(d);
    }
  };
  const buildSnow = (on) => {
    const el = $('#snow'); el.innerHTML = '';
    if (!on) return;
    for (let i = 0; i < 60; i++) {
      const f = document.createElement('span');
      f.className = 'flake'; f.textContent = '❄';
      f.style.left = Math.random()*100 + '%';
      f.style.fontSize = (8 + Math.random()*12) + 'px';
      f.style.animationDuration = (5 + Math.random()*6) + 's';
      f.style.animationDelay = (Math.random()*-8) + 's';
      el.appendChild(f);
    }
  };

  const cToUnit = (c) => state.unit === 'f' ? c * 9/5 + 32 : c;
  const uSym = () => state.unit === 'f' ? '°F' : '°C';
  const fmt = (c) => Math.round(cToUnit(c)) + '°';

  const aqiInfo = (v) => {
    if (v <= 50)  return ['Good',       '#7bd88f'];
    if (v <= 100) return ['Moderate',   '#ffd166'];
    if (v <= 150) return ['Unhealthy*', '#ffa64d'];
    if (v <= 200) return ['Unhealthy',  '#ef476f'];
    if (v <= 300) return ['Very Bad',   '#a663cc'];
    return             ['Hazardous',   '#8b2c2c'];
  };

  const dayName = (iso, tz) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { weekday: 'short', timeZone: tz });
  };
  const hourLabel = (iso, tz) => {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', timeZone: tz });
  };

  const fetchWeather = async (lat, lon) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
      + '&current_weather=true'
      + '&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,uv_index,precipitation_probability'
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max'
      + '&timezone=auto&forecast_days=7';
    const w = fetch(url).then(r => r.json());
    const a = fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`).then(r=>r.json()).catch(()=>null);
    const [wx, aq] = await Promise.all([w, a]);

    // Map Open-Meteo's current_weather + hourly into the shape expected by the renderer
    if (wx && wx.current_weather && wx.hourly && Array.isArray(wx.hourly.time)) {
      const curTime = wx.current_weather.time;
      const idx = wx.hourly.time.findIndex(t => t === curTime);
      const cur = {};
      if (idx >= 0) {
        cur.temperature_2m = wx.hourly.temperature_2m?.[idx];
        cur.apparent_temperature = wx.hourly.apparent_temperature?.[idx];
        cur.relative_humidity_2m = wx.hourly.relative_humidity_2m?.[idx];
        cur.is_day = wx.hourly.is_day?.[idx];
        cur.precipitation = wx.hourly.precipitation?.[idx];
        cur.weather_code = wx.hourly.weather_code?.[idx] ?? wx.current_weather.weathercode;
        cur.wind_speed_10m = wx.hourly.wind_speed_10m?.[idx] ?? wx.current_weather.windspeed;
        cur.wind_direction_10m = wx.hourly.wind_direction_10m?.[idx] ?? wx.current_weather.winddirection;
        cur.pressure_msl = wx.hourly.pressure_msl?.[idx];
        cur.uv_index = wx.hourly.uv_index?.[idx];
        cur.time = curTime;
      } else {
        cur.temperature_2m = wx.current_weather.temperature;
        cur.weather_code = wx.current_weather.weathercode;
        cur.wind_speed_10m = wx.current_weather.windspeed;
        cur.wind_direction_10m = wx.current_weather.winddirection;
        cur.time = wx.current_weather.time;
        cur.is_day = wx.current_weather.is_day ?? 1;
      }
      wx.current = cur;
    }
    return { wx, aq };
  };

  const render = async () => {
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
      const { wx, aq } = await fetchWeather(state.place.latitude, state.place.longitude);
      const cur = wx.current;
      const [label, emoji, theme] = codeMap(cur.weather_code, cur.is_day);
      setTheme(theme);

      const tz = wx.timezone;
      // Find current hour index
      const nowIso = cur.time;
      const hIdx = wx.hourly.time.findIndex(t => t === nowIso);
      const startIdx = hIdx >= 0 ? hIdx : 0;
      const hours = wx.hourly.time.slice(startIdx, startIdx + 24).map((t,i)=>({
        time: t,
        temp: wx.hourly.temperature_2m[startIdx+i],
        pop: wx.hourly.precipitation_probability?.[startIdx+i] ?? 0,
        code: wx.hourly.weather_code[startIdx+i],
        isDay: wx.hourly.is_day[startIdx+i],
      }));

      const days = wx.daily.time.map((t,i)=>({
        date: t,
        code: wx.daily.weather_code[i],
        hi: wx.daily.temperature_2m_max[i],
        lo: wx.daily.temperature_2m_min[i],
        pop: wx.daily.precipitation_probability_max?.[i] ?? 0,
        sunrise: wx.daily.sunrise[i],
        sunset: wx.daily.sunset[i],
        uv: wx.daily.uv_index_max[i],
      }));

      const weekLo = Math.min(...days.map(d=>d.lo));
      const weekHi = Math.max(...days.map(d=>d.hi));

      const aqi = aq?.current?.us_aqi;
      const [aqiLabel, aqiColor] = aqi != null ? aqiInfo(aqi) : ['—','#888'];

      const placeLine = [state.place.name, state.place.admin1, state.place.country].filter(Boolean).join(', ');
      const sr = new Date(days[0].sunrise).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',timeZone:tz});
      const ss = new Date(days[0].sunset).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',timeZone:tz});

      content.innerHTML = `
        <section class="hero">
          <div>
            <div class="location">${placeLine}</div>
            <h1>Now</h1>
            <div class="temp">${fmt(cur.temperature_2m)}</div>
            <div class="desc">${label}</div>
            <div class="feels">Feels like ${fmt(cur.apparent_temperature)} · H ${fmt(days[0].hi)} L ${fmt(days[0].lo)}</div>
          </div>
          <div class="icon-big">${emoji}</div>
        </section>

        <section class="grid">
          <div class="stat">
            <div class="label">Air quality</div>
            <div class="value">${aqi != null ? Math.round(aqi) : '—'}</div>
            <div class="sub" style="color:${aqiColor}">${aqiLabel}</div>
            <div class="aqi-bar"><i style="width:${Math.min(100,(aqi||0)/3)}%;background:${aqiColor}"></i></div>
          </div>
          <div class="stat">
            <div class="label">Humidity</div>
            <div class="value">${cur.relative_humidity_2m}%</div>
            <div class="sub">${cur.relative_humidity_2m > 70 ? 'Muggy' : cur.relative_humidity_2m < 30 ? 'Dry' : 'Comfortable'}</div>
          </div>
          <div class="stat">
            <div class="label">Wind</div>
            <div class="value">${Math.round(cur.wind_speed_10m)} <span style="font-size:14px;color:var(--muted)">km/h</span></div>
            <div class="sub">Direction ${Math.round(cur.wind_direction_10m)}°</div>
          </div>
          <div class="stat">
            <div class="label">UV index</div>
            <div class="value">${Math.round(cur.uv_index || 0)}</div>
            <div class="sub">Max today ${Math.round(days[0].uv || 0)}</div>
          </div>
          <div class="stat">
            <div class="label">Pressure</div>
            <div class="value">${Math.round(cur.pressure_msl)} <span style="font-size:14px;color:var(--muted)">hPa</span></div>
            <div class="sub">${cur.pressure_msl > 1015 ? 'High' : cur.pressure_msl < 1005 ? 'Low' : 'Normal'}</div>
          </div>
          <div class="stat">
            <div class="label">Sun</div>
            <div class="value" style="font-size:18px">☀ ${sr}</div>
            <div class="sub">🌇 ${ss}</div>
          </div>
        </section>

        <section class="panel">
          <h2>Next 24 hours</h2>
          <div class="hourly">
            ${hours.map((h,i)=>{
              const [_, em] = codeMap(h.code, h.isDay);
              return `<div class="hour ${i===0?'now':''}">
                <div class="t">${i===0?'Now':hourLabel(h.time, tz)}</div>
                <div class="em">${em}</div>
                <div class="tp">${fmt(h.temp)}</div>
                <div class="pop">${h.pop?('💧'+h.pop+'%'):'&nbsp;'}</div>
              </div>`;
            }).join('')}
          </div>
        </section>

        <section class="panel">
          <h2>7-day forecast</h2>
          <div class="daily">
            ${days.map((d,i)=>{
              const [lbl, em] = codeMap(d.code, 1);
              const range = weekHi - weekLo || 1;
              const left = ((d.lo - weekLo)/range)*100;
              const width = ((d.hi - d.lo)/range)*100;
              return `<div class="day">
                <div class="name">${i===0?'Today':dayName(d.date, tz)}</div>
                <div class="em" title="${lbl}">${em}</div>
                <div class="pop">${d.pop?('💧'+d.pop+'%'):''}</div>
                <div>
                  <div class="temps"><span class="lo">${fmt(d.lo)}</span><span>${fmt(d.hi)}</span></div>
                  <div class="range"><i style="left:${left}%;width:${Math.max(6,width)}%"></i></div>
                </div>
                <div class="pop" style="text-align:right;color:var(--muted)">UV ${Math.round(d.uv||0)}</div>
              </div>`;
            }).join('')}
          </div>
        </section>
      `;
    } catch (e) {
      content.innerHTML = `<div class="error">Couldn't load weather: ${e.message}</div>`;
    }
  };

  // Search (geocoding)
  let sugTimer;
  qInput.addEventListener('input', () => {
    clearTimeout(sugTimer);
    const v = qInput.value.trim();
    if (v.length < 2) { sugs.classList.remove('open'); sugs.innerHTML=''; return; }
    sugTimer = setTimeout(async () => {
      try {
        const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(v)}&count=6&language=en&format=json`).then(r=>r.json());
        const list = r.results || [];
        if (!list.length) { sugs.innerHTML = '<button disabled style="color:var(--muted)">No matches</button>'; sugs.classList.add('open'); return; }
        sugs.innerHTML = list.map((p,i)=>(
          `<button data-i="${i}"><span>${p.name}</span><span class="region">${[p.admin1,p.country].filter(Boolean).join(', ')}</span></button>`
        )).join('');
        sugs.classList.add('open');
        sugs.querySelectorAll('button[data-i]').forEach(b=>{
          b.addEventListener('click',()=>{
            const p = list[+b.dataset.i];
            state.place = { name:p.name, country:p.country, admin1:p.admin1, latitude:p.latitude, longitude:p.longitude };
            localStorage.setItem('place', JSON.stringify(state.place));
            qInput.value = ''; sugs.classList.remove('open');
            render();
          });
        });
      } catch {}
    }, 250);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search')) sugs.classList.remove('open');
  });

  // Geolocation
  $('#locate').addEventListener('click', () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      try {
        const r = await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=en&format=json`).then(r=>r.json());
        const p = r.results?.[0];
        state.place = p
          ? { name:p.name, country:p.country, admin1:p.admin1, latitude, longitude }
          : { name:'Current location', country:'', admin1:'', latitude, longitude };
      } catch {
        state.place = { name:'Current location', country:'', admin1:'', latitude, longitude };
      }
      localStorage.setItem('place', JSON.stringify(state.place));
      render();
    }, () => alert('Location permission denied.'));
  });

  // Unit toggle
  const setUnit = (u) => {
    state.unit = u; localStorage.setItem('unit', u);
    $('#u-c').classList.toggle('active', u==='c');
    $('#u-f').classList.toggle('active', u==='f');
    render();
  };
  $('#u-c').addEventListener('click', ()=>setUnit('c'));
  $('#u-f').addEventListener('click', ()=>setUnit('f'));
  if (state.unit === 'f') { $('#u-c').classList.remove('active'); $('#u-f').classList.add('active'); }

  render();
})();

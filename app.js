const $ = (id) => document.getElementById(id);

const pillDecimal = $("pillDecimal");
const pillDms = $("pillDms");
const decimalSection = $("decimalSection");
const dmsSection = $("dmsSection");

function setMode(mode){
  const isDecimal = mode === "decimal";
  pillDecimal.classList.toggle("active", isDecimal);
  pillDms.classList.toggle("active", !isDecimal);
  decimalSection.classList.toggle("hidden", !isDecimal);
  dmsSection.classList.toggle("hidden", isDecimal);
  $("outHint").textContent = "";
}

pillDecimal.addEventListener("click", () => setMode("decimal"));
pillDms.addEventListener("click", () => setMode("dms"));

function dmsToDecimal(deg, min, sec, dir){
  const d = Number(deg), m = Number(min), s = Number(sec);
  if ([d,m,s].some(x => Number.isNaN(x))) return NaN;
  let val = Math.abs(d) + (m/60) + (s/3600);
  const up = String(dir || "").toUpperCase();
  if (up === "S" || up === "W") val *= -1;
  return val;
}

function normalizeLon(lon){
  if (!Number.isFinite(lon)) return lon;
  let x = lon;
  while (x > 180) x -= 360;
  while (x < -180) x += 360;
  return x;
}

function qiblaBearing(latDeg, lonDeg){
  const kaabaLat = 21.4225 * Math.PI/180;
  const kaabaLon = 39.8262 * Math.PI/180;
  const lat = latDeg * Math.PI/180;
  const lon = lonDeg * Math.PI/180;

  const dLon = kaabaLon - lon;
  const y = Math.sin(dLon) * Math.cos(kaabaLat);
  const x = Math.cos(lat) * Math.sin(kaabaLat) - Math.sin(lat) * Math.cos(kaabaLat) * Math.cos(dLon);
  let theta = Math.atan2(y, x);
  return (theta * 180/Math.PI + 360) % 360;
}

function cardinalHint(bearing){
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  const idx = Math.round(bearing / 22.5) % 16;
  return dirs[idx];
}

function updateOutputs(lat, lon, bearing){
  $("outLat").textContent = Number.isFinite(lat) ? lat.toFixed(6) : "—";
  $("outLon").textContent = Number.isFinite(lon) ? lon.toFixed(6) : "—";
  if (Number.isFinite(bearing)){
    const card = cardinalHint(bearing);
    $("outQibla").textContent = `${bearing.toFixed(2)}° (${card})`;
    $("outHint").textContent = `Face ${card}. Bearing is from TRUE North.`;
  } else {
    $("outQibla").textContent = "—";
    $("outHint").textContent = "Enter valid coordinates (or use GPS).";
  }
}

function getCoordsFromUI(){
  const isDecimal = pillDecimal.classList.contains("active");
  if (isDecimal){
    const lat = Number($("decLat").value);
    const lon = normalizeLon(Number($("decLon").value));
    return {lat, lon};
  } else {
    const lat = dmsToDecimal($("latDeg").value, $("latMin").value, $("latSec").value, $("latDir").value);
    const lon = normalizeLon(dmsToDecimal($("lonDeg").value, $("lonMin").value, $("lonSec").value, $("lonDir").value));
    return {lat, lon};
  }
}

$("btnCalc").addEventListener("click", () => {
  const {lat, lon} = getCoordsFromUI();
  if (!Number.isFinite(lat) || !Number.isFinite(lon)){
    updateOutputs(NaN, NaN, NaN);
    return;
  }
  const b = qiblaBearing(lat, lon);
  updateOutputs(lat, lon, b);
});

$("btnGps").addEventListener("click", () => {
  $("outHint").textContent = "Requesting GPS…";
  if (!navigator.geolocation){
    $("outHint").textContent = "Geolocation is not supported on this device/browser.";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = normalizeLon(pos.coords.longitude);

      $("decLat").value = lat.toFixed(6);
      $("decLon").value = lon.toFixed(6);
      setMode("decimal");

      const b = qiblaBearing(lat, lon);
      updateOutputs(lat, lon, b);
    },
    (err) => {
      let msg = "Could not get location.";
      if (err && err.code === 1) msg = "Location permission denied. Enable it in Settings > Safari > Location.";
      if (err && err.code === 2) msg = "Location unavailable. Try moving to a clearer area.";
      if (err && err.code === 3) msg = "Location request timed out. Try again.";
      $("outHint").textContent = msg;
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 }
  );
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  });
}

setMode("decimal");
updateOutputs(NaN, NaN, NaN);

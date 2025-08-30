/* =========================
   Global State
   ========================= */
let currentStream = null;
let usingRearCamera = true;

let photos = [];
let numericCode = "";

let measurementCode = "";
let deliveryDate = "";
let measurementPhotos = [];

let CLOUD_TOKEN = null;    // Dropbox token
let PASSWORD = null;       // Settings password

/* =========================
   Helpers: Toast + Status light
   ========================= */
function showStatus(message, type="info"){
  const el = document.getElementById("status-log");
  el.textContent = message;
  el.className = type;
  el.style.display = "block";
  setTimeout(()=>{ el.style.display = "none"; }, 3000);
}
function setStatus(connected){
  const dot = document.getElementById("status-light");
  dot.classList.remove("green","red");
  dot.classList.add(connected ? "green" : "red");
}

/* =========================
   Settings Password (local)
   ========================= */
function requestPassword(){
  PASSWORD = localStorage.getItem("APP_PASSWORD");
  const msg = document.getElementById("password-message");
  const input = document.getElementById("passwordInput");
  input.value = "";
  msg.textContent = PASSWORD ? "Enter your password" : "Create a new password";
  document.getElementById("password-popup").classList.remove("hidden");
}
function submitPassword(){
  const val = document.getElementById("passwordInput").value.trim();
  if(!PASSWORD){
    if(!val){ showStatus("Please enter a password", "error"); return; }
    localStorage.setItem("APP_PASSWORD", val);
    PASSWORD = val;
    closePasswordPopup();
    openTokenPopup();
    showStatus("Password set", "success");
  } else {
    if(val === PASSWORD){
      closePasswordPopup();
      openTokenPopup();
    } else {
      showStatus("Wrong password", "error");
    }
  }
}
function closePasswordPopup(){
  document.getElementById("password-popup").classList.add("hidden");
}

/* =========================
   Token Popup (Dropbox)
   ========================= */
function openTokenPopup(){
  const inp = document.getElementById("tokenInput");
  inp.value = CLOUD_TOKEN || "";
  document.getElementById("token-popup").classList.remove("hidden");
}
function closeTokenPopup(){
  document.getElementById("token-popup").classList.add("hidden");
}
function saveToken(){
  const t = document.getElementById("tokenInput").value.trim();
  if(!t){ showStatus("Paste token", "error"); return; }
  localStorage.setItem("CLOUD_TOKEN", t);
  CLOUD_TOKEN = t;
  closeTokenPopup();
  validateToken(); // optional check → setStatus true/false
  showStatus("Token saved", "success");
}
function clearToken(){
  localStorage.removeItem("CLOUD_TOKEN");
  CLOUD_TOKEN = null;
  setStatus(false);
  closeTokenPopup();
  showStatus("Token cleared", "info");
}
async function validateToken(){
  if(!CLOUD_TOKEN){ setStatus(false); return; }
  try{
    const res = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
      method: "POST",
      headers: { "Authorization": "Bearer " + CLOUD_TOKEN }
    });
    setStatus(res.ok);
  }catch(e){
    setStatus(false);
  }
}

/* =========================
   Page Navigation
   ========================= */
function showPage(id){
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}
function goHome(){
  if(currentStream){
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }
  photos = [];
  numericCode = "";
  measurementPhotos = [];
  measurementCode = "";
  deliveryDate = "";

  const ids = ["numericCode","measurementCode","deliveryDate"];
  ids.forEach(i => { const el = document.getElementById(i); if(el) el.value=""; });

  const pv = document.getElementById("photoPreview");
  const mp = document.getElementById("measurementPreview");
  if(pv) pv.innerHTML = "";
  if(mp) mp.innerHTML = "";

  showPage("mainPage");
}

/* =========================
   Take Photo Flow
   ========================= */
function startTakePhoto(){ showPage("codePage"); }
function submitCode(){
  numericCode = document.getElementById("numericCode").value.trim();
  if(!numericCode){ showStatus("Enter code","error"); return; }
  startCamera();
}

/* =========================
   Measurement Flow
   ========================= */
function startMeasurementPhoto(){ showPage("measurementCodePage"); }
function submitMeasurementCode(){
  measurementCode = document.getElementById("measurementCode").value.trim();
  deliveryDate = document.getElementById("deliveryDate").value.trim();
  if(!measurementCode || !deliveryDate){ showStatus("Enter code & date","error"); return; }
  measurementPhotos = [];
  startCamera();
}

/* =========================
   Camera
   ========================= */
function startCamera(){
  showPage("cameraPage");
  if(currentStream) currentStream.getTracks().forEach(t => t.stop());
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: usingRearCamera ? "environment" : "user" }
  }).then(stream => {
    currentStream = stream;
    document.getElementById("camera").srcObject = stream;
  }).catch(err => {
    showStatus("Camera denied", "error");
  });
}
function switchCamera(){ usingRearCamera = !usingRearCamera; startCamera(); }

/* =========================
   Capture Photo
   ========================= */
function capturePhoto(){
  const video = document.getElementById("camera");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");

  if(!video.videoWidth){ showStatus("Camera not ready", "error"); return; }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);

  let dataUrl = canvas.toDataURL("image/png");

  // Measurement flow → need 2 shots, then merge
  if(measurementCode && deliveryDate){
    measurementPhotos.push(dataUrl);
    if(measurementPhotos.length < 2){
      showStatus("Capture 2nd", "info");
      return;
    } else {
      mergeMeasurementPhotos();
      return;
    }
  }

  // Normal Take Photo: add overlays, then preview
  ctx.font = "bold 40px Arial";
  ctx.fillStyle = "#b76e79";
  ctx.strokeStyle = "#5c3b2e";
  ctx.lineWidth = 3;
  ctx.textAlign = "center";
  ctx.strokeText("Royal Sherwani", canvas.width/2, 50);
  ctx.fillText("Royal Sherwani", canvas.width/2, 50);

  ctx.font = "bold 80px Arial";
  ctx.fillStyle = "red";
  ctx.strokeStyle = "white";
  ctx.lineWidth = 5;
  ctx.strokeText(numericCode, canvas.width/2, canvas.height/2);
  ctx.fillText(numericCode, canvas.width/2, canvas.height/2);

  dataUrl = canvas.toDataURL("image/png");
  photos.push(dataUrl);
  showPreview();
}

/* =========================
   Preview (Take Photo)
   ========================= */
function showPreview(){
  showPage("previewPage");
  const grid = document.getElementById("photoPreview");
  grid.innerHTML = "";
  photos.forEach(src => {
    const img = new Image();
    img.src = src;
    grid.appendChild(img);
  });
}
function addAnotherPhoto(){ startCamera(); }
function downloadPhotos(){
  photos.forEach((src, idx) => {
    const a = document.createElement("a");
    a.href = src;
    a.download = generateFileName(numericCode, idx+1);
    a.click();
  });
  showStatus("Downloaded", "success");
}

/* =========================
   Merge Measurement (Forced 40/60, cover fit)
   ========================= */
function mergeMeasurementPhotos(){
  const img1 = new Image(); // first → right 60%
  const img2 = new Image(); // second → left 40%
  img1.src = measurementPhotos[0];
  img2.src = measurementPhotos[1];

  img1.onload = () => {
    img2.onload = () => {
      const canvas = document.getElementById("canvas");
      const ctx = canvas.getContext("2d");

      const finalW = 1200, finalH = 800; // landscape output
      canvas.width = finalW;
      canvas.height = finalH;

      const leftW = Math.floor(finalW * 0.4);
      const rightW = finalW - leftW;

      // Draw with "cover" behavior to avoid distortion
      drawCover(ctx, img2, 0, 0, leftW, finalH);        // left (second shot)
      drawCover(ctx, img1, leftW, 0, rightW, finalH);   // right (first shot)

      // Royal Sherwani (top-center)
      ctx.font = "bold 30px Arial";
      ctx.fillStyle = "#b76e79";
      ctx.strokeStyle = "#5c3b2e";
      ctx.lineWidth = 2;
      ctx.textAlign = "center";
      ctx.strokeText("Royal Sherwani", canvas.width/2, 40);
      ctx.fillText("Royal Sherwani", canvas.width/2, 40);

      // Numeric code (big, center)
      ctx.font = "bold 100px Arial";
      ctx.fillStyle = "red";
      ctx.strokeStyle = "white";
      ctx.lineWidth = 6;
      ctx.textAlign = "center";
      ctx.strokeText(measurementCode, canvas.width/2, canvas.height/2);
      ctx.fillText(measurementCode, canvas.width/2, canvas.height/2);

      // Date (top-right, DD-MM-YYYY)
      let [yyyy, mm, dd] = deliveryDate.split("-");
      const dStr = `${dd}-${mm}-${yyyy}`;
      ctx.font = "bold 28px Arial";
      ctx.fillStyle = "red";
      ctx.strokeStyle = "white";
      ctx.lineWidth = 3;
      ctx.textAlign = "right";
      ctx.strokeText(dStr, canvas.width - 20, 40);
      ctx.fillText(dStr, canvas.width - 20, 40);

      const mergedData = canvas.toDataURL("image/png");
      showMeasurementPreview(mergedData);
    };
  };
}
function drawCover(ctx, img, x, y, w, h){
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = x + (w - dw)/2;
  const dy = y + (h - dh)/2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

/* =========================
   Measurement Preview & Download
   ========================= */
function showMeasurementPreview(dataUrl){
  showPage("measurementPreviewPage");
  const wrap = document.getElementById("measurementPreview");
  wrap.innerHTML = "";
  const img = new Image();
  img.src = dataUrl;
  wrap.appendChild(img);
  measurementPhotos = [dataUrl]; // keep merged photo for download/upload
}
function downloadMeasurementPhoto(){
  if(!measurementPhotos.length) return;
  const a = document.createElement("a");
  a.href = measurementPhotos[0];
  a.download = generateFileName(measurementCode);
  a.click();
  showStatus("Downloaded", "success");
}

/* =========================
   File Names
   ========================= */
function generateFileName(code, idx=null){
  const d = new Date();
  const dateStr = `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}-${String(d.getHours()).padStart(2,"0")}-${String(d.getMinutes()).padStart(2,"0")}-${String(d.getSeconds()).padStart(2,"0")}`;
  return `RSP-${code}-${dateStr}${idx ? "-" + idx : ""}.png`;
}

/* =========================
   Dropbox Upload (cloud)
   ========================= */
async function ensureFolder(path){
  try{
    if(!CLOUD_TOKEN) throw new Error("No token");
    await fetch("https://api.dropboxapi.com/2/files/create_folder_v2",{
      method:"POST",
      headers:{ "Authorization":"Bearer "+CLOUD_TOKEN, "Content-Type":"application/json" },
      body: JSON.stringify({ path, autorename:false })
    });
  }catch(e){ /* ignore if already exists */ }
}
async function uploadToDropbox(blob, path){
  if(!CLOUD_TOKEN) throw new Error("No token");
  const res = await fetch("https://content.dropboxapi.com/2/files/upload",{
    method:"POST",
    headers:{
      "Authorization":"Bearer "+CLOUD_TOKEN,
      "Dropbox-API-Arg": JSON.stringify({ path, mode:"add", autorename:true }),
      "Content-Type":"application/octet-stream"
    },
    body: blob
  });
  if(!res.ok){
    const t = await res.text().catch(()=> "");
    throw new Error("Upload failed: "+(t||res.status));
  }
  return res.json();
}

/* Upload buttons */
async function uploadPhotos(){
  if(!photos.length){ showStatus("No photos","error"); return; }
  if(!CLOUD_TOKEN){ showStatus("Set token in settings","error"); return; }
  showStatus("Uploading...", "info");
  try{
    await ensureFolder("/RS");
    await ensureFolder("/RS/Photo");
    for(let i=0;i<photos.length;i++){
      const blob = await (await fetch(photos[i])).blob();
      await uploadToDropbox(blob, `/RS/Photo/${generateFileName(numericCode, i+1)}`);
    }
    showStatus("Uploaded to Dropbox", "success");
  }catch(e){
    showStatus(e.message || "Upload failed", "error");
  }
}
async function uploadMeasurementPhoto(){
  if(!measurementPhotos.length){ showStatus("No photo","error"); return; }
  if(!CLOUD_TOKEN){ showStatus("Set token in settings","error"); return; }
  showStatus("Uploading...", "info");
  try{
    await ensureFolder("/RS");
    await ensureFolder("/RS/Photo with Measurement");
    const blob = await (await fetch(measurementPhotos[0])).blob();
    await uploadToDropbox(blob, `/RS/Photo with Measurement/${generateFileName(measurementCode)}`);
    showStatus("Uploaded merged photo", "success");
  }catch(e){
    showStatus(e.message || "Upload failed", "error");
  }
}

/* UploadDownload combo buttons */
async function uploadDownloadPhotos(){
  downloadPhotos();
  await uploadPhotos();
}
async function uploadDownloadMeasurement(){
  downloadMeasurementPhoto();
  await uploadMeasurementPhoto();
}

/* =========================
   Init
   ========================= */
window.onload = () => {
  CLOUD_TOKEN = localStorage.getItem("CLOUD_TOKEN");
  PASSWORD = localStorage.getItem("APP_PASSWORD");
  setStatus(!!CLOUD_TOKEN);
  showPage("mainPage");
  // Optional: validate token async
  validateToken();
};
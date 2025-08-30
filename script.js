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

let CLOUD_TOKEN = null;    // Dropbox token (permanent App Folder token)
let PASSWORD = null;       // Settings password
let pendingAction = null;  // 'settings' | null

/* =========================
   Toast + Status light
   ========================= */
function showStatus(message, type="info"){
  const el = document.getElementById("status-log");
  el.textContent = message;
  el.className = type;
  el.style.display = "block";
  clearTimeout(showStatus._t);
  showStatus._t = setTimeout(()=>{ el.style.display = "none"; }, 4000);
}
function setStatus(connected){
  const dot = document.getElementById("status-light");
  dot.classList.remove("green","red");
  dot.classList.add(connected ? "green" : "red");
}

/* =========================
   Password Flow
   ========================= */
function requestPassword(action='settings'){
  pendingAction = action;
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
    if(!val){ showStatus("Please enter a password","error"); return; }
    localStorage.setItem("APP_PASSWORD", val);
    PASSWORD = val;
    closePasswordPopup();
    runPostPasswordAction();
    showStatus("Password set","success");
  }else{
    if(val === PASSWORD){ closePasswordPopup(); runPostPasswordAction(); }
    else{ showStatus("Wrong password","error"); }
  }
}
function runPostPasswordAction(){
  if(pendingAction === 'settings') openTokenPopup();
  pendingAction = null;
}
function closePasswordPopup(){ document.getElementById("password-popup").classList.add("hidden"); }

/* =========================
   Token Popup (for CloudUpload)
   ========================= */
function openTokenPopup(){
  const inp = document.getElementById("tokenInput");
  inp.value = CLOUD_TOKEN || "";
  document.getElementById("token-popup").classList.remove("hidden");
}
function closeTokenPopup(){ document.getElementById("token-popup").classList.add("hidden"); }
function saveToken(){
  const t = document.getElementById("tokenInput").value.trim();
  if(!t){ showStatus("Paste token","error"); return; }
  localStorage.setItem("CLOUD_TOKEN", t);
  CLOUD_TOKEN = t;
  closeTokenPopup();
  validateToken();
  showStatus("Token saved","success");
}
function clearToken(){
  localStorage.removeItem("CLOUD_TOKEN");
  CLOUD_TOKEN = null;
  setStatus(false);
  closeTokenPopup();
  showStatus("Token cleared","info");
}
async function validateToken(){
  if(!CLOUD_TOKEN){ setStatus(false); return; }
  try{
    const res = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
      method:"POST", headers:{ "Authorization":"Bearer " + CLOUD_TOKEN }
    });
    setStatus(res.ok);
  }catch{ setStatus(false); }
}

/* =========================
   Page Navigation
   ========================= */
function showPage(id){
  document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}
function goHome(){
  if(currentStream){ currentStream.getTracks().forEach(t=>t.stop()); currentStream=null; }
  photos=[]; numericCode=""; measurementPhotos=[]; measurementCode=""; deliveryDate="";
  ["numericCode","measurementCode","deliveryDate"].forEach(i=>{const el=document.getElementById(i); if(el) el.value="";});
  const pv=document.getElementById("photoPreview"); const mp=document.getElementById("measurementPreview");
  if(pv) pv.innerHTML=""; if(mp) mp.innerHTML="";
  showPage("mainPage");
}

/* =========================
   Take Photo
   ========================= */
function startTakePhoto(){ showPage("codePage"); }
function submitCode(){
  numericCode = document.getElementById("numericCode").value.trim();
  if(!numericCode){ showStatus("Enter code","error"); return; }
  startCamera();
}

/* =========================
   Measurement
   ========================= */
function startMeasurementPhoto(){ showPage("measurementCodePage"); }
function submitMeasurementCode(){
  measurementCode = document.getElementById("measurementCode").value.trim();
  deliveryDate   = document.getElementById("deliveryDate").value.trim();
  if(!measurementCode || !deliveryDate){ showStatus("Enter code & date","error"); return; }
  measurementPhotos = [];
  startCamera();
}

/* =========================
   Camera
   ========================= */
function startCamera(){
  showPage("cameraPage");
  if(currentStream) currentStream.getTracks().forEach(t=>t.stop());
  navigator.mediaDevices.getUserMedia({ video:{ facingMode: usingRearCamera ? "environment" : "user" } })
    .then(stream => { currentStream=stream; document.getElementById("camera").srcObject=stream; })
    .catch(()=> showStatus("Camera denied","error"));
}
function switchCamera(){ usingRearCamera=!usingRearCamera; startCamera(); }

/* =========================
   Capture
   ========================= */
function capturePhoto(){
  const v=document.getElementById("camera"), c=document.getElementById("canvas"), x=c.getContext("2d");
  if(!v.videoWidth){ showStatus("Camera not ready","error"); return; }
  c.width=v.videoWidth; c.height=v.videoHeight; x.drawImage(v,0,0);
  let dataUrl=c.toDataURL("image/png");

  if(measurementCode && deliveryDate){
    measurementPhotos.push(dataUrl);
    if(measurementPhotos.length<2){ showStatus("Capture 2nd","info"); return; }
    mergeMeasurementPhotos(); return;
  }

  // Overlays — title + big numeric code
  x.font="bold 40px Arial"; x.fillStyle="#b76e79"; x.strokeStyle="#5c3b2e"; x.lineWidth=3; x.textAlign="center";
  x.strokeText("Royal Sherwani", c.width/2, 50); x.fillText("Royal Sherwani", c.width/2, 50);
  x.font="bold 80px Arial"; x.fillStyle="red"; x.strokeStyle="white"; x.lineWidth=5;
  x.strokeText(numericCode, c.width/2, c.height/2); x.fillText(numericCode, c.width/2, c.height/2);

  dataUrl=c.toDataURL("image/png"); photos.push(dataUrl); showPreview();
}

/* =========================
   Preview (Take Photo)
   ========================= */
function showPreview(){
  showPage("previewPage");
  const p=document.getElementById("photoPreview"); p.innerHTML="";
  photos.forEach(src=>{ const i=new Image(); i.src=src; p.appendChild(i); });
}
function addAnotherPhoto(){ startCamera(); }
function downloadPhotos(){
  photos.forEach((p,i)=>{ const a=document.createElement("a"); a.href=p; a.download=generateFileName(numericCode,i+1); a.click(); });
  showStatus("Downloaded","success");
}

/* =========================
   Measurement Merge 40/60 (cover)
   ========================= */
function mergeMeasurementPhotos(){
  const img1=new Image(), img2=new Image(); // img1 → right 60, img2 → left 40
  img1.src=measurementPhotos[0]; img2.src=measurementPhotos[1];
  img1.onload=()=>{ img2.onload=()=>{
    const c=document.getElementById("canvas"), x=c.getContext("2d");
    const finalW=1200, finalH=800; c.width=finalW; c.height=finalH;
    const leftW=Math.floor(finalW*0.4), rightW=finalW-leftW;

    drawCover(x,img2,0,0,leftW,finalH);
    drawCover(x,img1,leftW,0,rightW,finalH);

    // Title top-center
    x.font="bold 30px Arial"; x.fillStyle="#b76e79"; x.strokeStyle="#5c3b2e"; x.lineWidth=2; x.textAlign="center";
    x.strokeText("Royal Sherwani", c.width/2, 40); x.fillText("Royal Sherwani", c.width/2, 40);

    // Big numeric middle
    x.font="bold 100px Arial"; x.fillStyle="red"; x.strokeStyle="white"; x.lineWidth=6;
    x.strokeText(measurementCode, c.width/2, c.height/2); x.fillText(measurementCode, c.width/2, c.height/2);

    // Date top-right dd-mm-yyyy
    let [yyyy,mm,dd]=deliveryDate.split("-"); const dStr=`${dd}-${mm}-${yyyy}`;
    x.font="bold 28px Arial"; x.fillStyle="red"; x.strokeStyle="white"; x.lineWidth=3; x.textAlign="right";
    x.strokeText(dStr, c.width-20, 40); x.fillText(dStr, c.width-20, 40);

    const merged=c.toDataURL("image/png"); showMeasurementPreview(merged);
  }; };
}
function drawCover(ctx,img,x,y,w,h){
  const scale=Math.max(w/img.width, h/img.height); const dw=img.width*scale, dh=img.height*scale;
  const dx=x+(w-dw)/2, dy=y+(h-dh)/2; ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
  ctx.drawImage(img,dx,dy,dw,dh); ctx.restore();
}

/* =========================
   Measurement Preview & Download
   ========================= */
function showMeasurementPreview(d){
  showPage("measurementPreviewPage");
  const el=document.getElementById("measurementPreview"); el.innerHTML="";
  const img=new Image(); img.src=d; el.appendChild(img);
  measurementPhotos=[d];
}
function downloadMeasurementPhoto(){
  if(!measurementPhotos.length) return;
  const a=document.createElement("a"); a.href=measurementPhotos[0]; a.download=generateFileName(measurementCode); a.click();
  showStatus("Downloaded","success");
}

/* =========================
   File naming
   ========================= */
function generateFileName(code,idx=null){
  const d=new Date();
  const s=`${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}-${String(d.getHours()).padStart(2,"0")}-${String(d.getMinutes()).padStart(2,"0")}-${String(d.getSeconds()).padStart(2,"0")}`;
  return `RSP-${code}-${s}${idx?`-${idx}`:""}.png`;
}

/* =========================
   Cloud Upload (Dropbox)
   ========================= */
async function ensureFolder(path){
  try{
    if(!CLOUD_TOKEN) throw new Error("No token");
    await fetch("https://api.dropboxapi.com/2/files/create_folder_v2",{
      method:"POST",
      headers:{ "Authorization":"Bearer "+CLOUD_TOKEN, "Content-Type":"application/json" },
      body: JSON.stringify({ path, autorename:false })
    });
  }catch{}
}
async function uploadToDropbox(blob,path){
  if(!CLOUD_TOKEN) throw new Error("No token");
  const r=await fetch("https://content.dropboxapi.com/2/files/upload",{
    method:"POST",
    headers:{
      "Authorization":"Bearer "+CLOUD_TOKEN,
      "Dropbox-API-Arg": JSON.stringify({ path, mode:"add", autorename:true }),
      "Content-Type":"application/octet-stream"
    },
    body: blob
  });
  if(!r.ok){ const t=await r.text().catch(()=> ""); throw new Error("Upload failed: "+(t||r.status)); }
  return r.json();
}
async function uploadPhotos(){
  if(!photos.length){ showStatus("No photos","error"); return; }
  if(!CLOUD_TOKEN){ showStatus("Set token in settings","error"); return; }
  showStatus("Uploading...","info");
  try{
    await ensureFolder("/RS");
    await ensureFolder("/RS/Photo");
    for(let i=0;i<photos.length;i++){
      const b=await (await fetch(photos[i])).blob();
      await uploadToDropbox(b, `/RS/Photo/${generateFileName(numericCode,i+1)}`);
    }
    showStatus("Uploaded to Dropbox","success");
  }catch(e){ showStatus(e.message||"Upload failed","error"); }
}
async function uploadMeasurementPhoto(){
  if(!measurementPhotos.length){ showStatus("No photo","error"); return; }
  if(!CLOUD_TOKEN){ showStatus("Set token in settings","error"); return; }
  showStatus("Uploading...","info");
  try{
    await ensureFolder("/RS");
    await ensureFolder("/RS/Photo with Measurement");
    const b=await (await fetch(measurementPhotos[0])).blob();
    await uploadToDropbox(b, `/RS/Photo with Measurement/${generateFileName(measurementCode)}`);
    showStatus("Uploaded merged photo","success");
  }catch(e){ showStatus(e.message||"Upload failed","error"); }
}

/* Upload+Download combo */
async function uploadDownloadPhotos(){ downloadPhotos(); await uploadPhotos(); }
async function uploadDownloadMeasurement(){ downloadMeasurementPhoto(); await uploadMeasurementPhoto(); }

/* =========================
   Init
   ========================= */
window.onload=()=>{
  CLOUD_TOKEN = localStorage.getItem("CLOUD_TOKEN");
  PASSWORD    = localStorage.getItem("APP_PASSWORD");
  setStatus(!!CLOUD_TOKEN);
  showPage("mainPage");
  validateToken();
};
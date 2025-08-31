let currentStream = null;
let usingRearCamera = true;
let photos = [];
let numericCode = "";
let measurementCode = "";
let deliveryDate = "";
let measurementPhotos = [];

function showStatus(message, type="info"){
  const el = document.getElementById("status-log");
  el.textContent = message;
  el.className = type;
  el.style.display = "block";
  clearTimeout(showStatus._t);
  showStatus._t = setTimeout(()=>{ el.style.display = "none"; }, 4000);
}

function showPage(id){
  document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}
function goHome(){
  if(currentStream){ currentStream.getTracks().forEach(t=>t.stop()); currentStream=null; }
  photos=[]; numericCode=""; measurementPhotos=[]; measurementCode=""; deliveryDate="";
  ["numericCode","measurementCode","deliveryDate"].forEach(i=>{const el=document.getElementById(i); if(el) el.value="";});
  document.getElementById("photoPreview").innerHTML="";
  document.getElementById("measurementPreview").innerHTML="";
  showPage("mainPage");
}

function startTakePhoto(){ showPage("codePage"); }
function submitCode(){
  numericCode = document.getElementById("numericCode").value.trim();
  if(!numericCode){ showStatus("Enter code","error"); return; }
  startCamera();
}
function startMeasurementPhoto(){ showPage("measurementCodePage"); }
function submitMeasurementCode(){
  measurementCode = document.getElementById("measurementCode").value.trim();
  deliveryDate   = document.getElementById("deliveryDate").value.trim();
  if(!measurementCode || !deliveryDate){ showStatus("Enter code & date","error"); return; }
  measurementPhotos = [];
  startCamera();
}

function startCamera(){
  showPage("cameraPage");
  if(currentStream) currentStream.getTracks().forEach(t=>t.stop());
  navigator.mediaDevices.getUserMedia({ video:{ facingMode: usingRearCamera ? "environment" : "user" } })
    .then(stream => { currentStream=stream; document.getElementById("camera").srcObject=stream; })
    .catch(()=> showStatus("Camera denied","error"));
}
function switchCamera(){ usingRearCamera=!usingRearCamera; startCamera(); }

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

  x.font="bold 40px Arial"; x.fillStyle="#b76e79"; x.strokeStyle="#5c3b2e"; x.lineWidth=3; x.textAlign="center";
  x.strokeText("Royal Sherwani", c.width/2, 50); x.fillText("Royal Sherwani", c.width/2, 50);
  x.font="bold 80px Arial"; x.fillStyle="red"; x.strokeStyle="white"; x.lineWidth=5;
  x.strokeText(numericCode, c.width/2, c.height/2); x.fillText(numericCode, c.width/2, c.height/2);

  dataUrl=c.toDataURL("image/png"); photos.push(dataUrl); showPreview();
}

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

function mergeMeasurementPhotos(){
  const img1=new Image(), img2=new Image();
  img1.src=measurementPhotos[0]; img2.src=measurementPhotos[1];
  img1.onload=()=>{ img2.onload=()=>{
    const c=document.getElementById("canvas"), x=c.getContext("2d");
    const finalW=1200, finalH=800; c.width=finalW; c.height=finalH;
    const leftW=Math.floor(finalW*0.4), rightW=finalW-leftW;
    drawCover(x,img2,0,0,leftW,finalH);
    drawCover(x,img1,leftW,0,rightW,finalH);

    x.font="bold 30px Arial"; x.fillStyle="#b76e79"; x.strokeStyle="#5c3b2e"; x.lineWidth=2; x.textAlign="center";
    x.strokeText("Royal Sherwani", c.width/2, 40); x.fillText("Royal Sherwani", c.width/2, 40);
    x.font="bold 100px Arial"; x.fillStyle="red"; x.strokeStyle="white"; x.lineWidth=6;
    x.strokeText(measurementCode, c.width/2, c.height/2); x.fillText(measurementCode, c.width/2, c.height/2);
    let [yyyy,mm,dd]=deliveryDate.split("-"); const dStr=`${dd}-${mm}-${yyyy}`;
    x.font="bold 28px Arial"; x.fillStyle="red"; x.strokeStyle="white"; x.lineWidth=3; x.textAlign="right";
    x.strokeText(dStr, c.width-20, 40); x.fillText(dStr, c.width-20, 40);

    const merged=c.toDataURL("image/png"); showMeasurementPreview(merged);
  }; };
}
function drawCover(ctx,img,x,y,w,h){
  const scale=Math.max(w/img.width, h/img.height);
  const dw=img.width*scale, dh=img.height*scale;
  const dx=x+(w-dw)/2, dy=y+(h-dh)/2;
  ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
  ctx.drawImage(img,dx,dy,dw,dh); ctx.restore();
}

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

function generateFileName(code,idx=null){
  const d=new Date();
  const s=`${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}-${String(d.getHours()).padStart(2,"0")}-${String(d.getMinutes()).padStart(2,"0")}-${String(d.getSeconds()).padStart(2,"0")}`;
  return `RSP-${code}-${s}${idx?`-${idx}`:""}.png`;
}

window.onload=()=>{ showPage("mainPage"); };
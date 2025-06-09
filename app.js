/* ここから下はすべて前回のフル機能実装版をそのまま貼付け！
   すべての機能が保たれています（800行前後のフル実装） */

const SCALE_BASE = 100;
let scaleRatio = 100, SCALE = SCALE_BASE * (100 / scaleRatio);
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let lines=[], endpoints=[], midpoints=[], texts=[], dims=[], refPoints=[];
let dimSelectPts=[], twoptSelectPts=[], trapSelectPts=[];
let startPt=null, mode="line";
let selectedType=null, selectedIdx=null;
let dragStart={x:0, y:0}, isDragging=false;
let movingLineSide=null, dragOffset={x:0, y:0};
let undoStack=[], redoStack=[];
let ignoreStateSave = false;
let bisectLineSelectPt = null;
let multiSelectMode = false;
let selectedItems = [];
let zoom = 1;

function getCanvasPoint(clientX, clientY){
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) * (canvas.width / rect.width);
  const y = (clientY - rect.top) * (canvas.height / rect.height);
  return {x, y};
}

const tabBtns = [
  {btn:"tabDraw", grp:"drawGroup"},
  {btn:"tabEdit", grp:"editGroup"},
  {btn:"tabDim", grp:"dimGroup"},
  {btn:"tabFile", grp:"fileGroup"},
];
tabBtns.forEach(({btn, grp}) => {
  document.getElementById(btn).onclick = () => {
    tabBtns.forEach(({btn:bid, grp:gid})=>{
      document.getElementById(bid).classList.toggle('tab-on', btn===bid);
      document.getElementById(gid).classList.toggle('tab-active', grp===gid);
    });
  }
});

function saveState() {
  if(ignoreStateSave) return;
  undoStack.push(JSON.stringify({
    lines: JSON.parse(JSON.stringify(lines)),
    texts: JSON.parse(JSON.stringify(texts)),
    dims: JSON.parse(JSON.stringify(dims)),
    refPoints: JSON.parse(JSON.stringify(refPoints))
  }));
  if (undoStack.length > 100) undoStack.shift();
  redoStack = [];
}
function restoreState(obj) {
  ignoreStateSave = true;
  lines = JSON.parse(JSON.stringify(obj.lines));
  texts = JSON.parse(JSON.stringify(obj.texts));
  dims = JSON.parse(JSON.stringify(obj.dims));
  refPoints = JSON.parse(JSON.stringify(obj.refPoints));
  dimSelectPts = []; twoptSelectPts=[]; trapSelectPts=[];
  startPt = null;
  selectedType = null; selectedIdx = null; selectedItems = [];
  redraw();
  ignoreStateSave = false;
}
document.getElementById('undoBtn').onclick = () => {
  if(undoStack.length===0) return;
  redoStack.push(JSON.stringify({lines, texts, dims, refPoints}));
  const prev = JSON.parse(undoStack.pop());
  restoreState(prev);
};
document.getElementById('redoBtn').onclick = () => {
  if(redoStack.length===0) return;
  undoStack.push(JSON.stringify({lines, texts, dims, refPoints}));
  const next = JSON.parse(redoStack.pop());
  restoreState(next);
};

function setMode(m) {
  mode = m;
  [
    "deleteBtn","moveBtn","addTextBtn","dimBtn","refBtn",
    "twoptBtn","trapBtn","bisectLineBtn","editLineBtn","multiSelectBtn"
  ].forEach(id=>{
    let cond = (id==="deleteBtn"&&mode==="delete")||
      (id==="moveBtn"&&mode==="move")||
      (id==="addTextBtn"&&mode==="text")||
      (id==="dimBtn"&&mode==="dim")||
      (id==="refBtn"&&mode==="ref")||
      (id==="twoptBtn"&&mode==="twopt")||
      (id==="trapBtn"&&mode==="trap")||
      (id==="bisectLineBtn"&&mode==="bisectline")||
      (id==="editLineBtn"&&mode==="editline")||
      (id==="multiSelectBtn"&&multiSelectMode);
    const btn = document.getElementById(id);
    if(btn) btn.classList.toggle('mode-btn-on', cond);
  });
  canvas.style.cursor = (mode==="move") ? "move" : (["delete","dim","ref","twopt","trap","bisectline","editline"].includes(mode) ? "pointer" : "default");
  selectedType=null; selectedIdx=null;
  if(mode!=="dim") dimSelectPts=[];
  if(mode!=="twopt") twoptSelectPts=[];
  if(mode!=="trap") trapSelectPts=[];
  redraw();
}
let baseWidth = 0, baseHeight = 0;

function resizeCanvas() {
  baseWidth = window.innerWidth;
  baseHeight = window.innerHeight * 0.9; // match CSS 90vh
  updateZoom();
  redraw();
}

function updateZoom(){
  canvas.width = baseWidth / zoom;
  canvas.height = baseHeight / zoom;
  if(zoom < 1){
    canvas.style.width = `${baseWidth / zoom}px`;
    canvas.style.height = `${baseHeight / zoom}px`;
    canvas.style.transform = "scale(1)";
  } else {
    canvas.style.width = `${baseWidth}px`;
    canvas.style.height = `${baseHeight}px`;
    canvas.style.transform = `scale(${zoom})`;
  }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

  canvas.addEventListener('wheel', e=>{
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  zoom = Math.min(3, Math.max(0.5, zoom * factor));
  updateZoom();
}, {passive:false});

let pinchStartDist = null;
canvas.addEventListener('touchstart', e=>{
  if(e.touches.length===2){
    e.preventDefault();
    pinchStartDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
  }
},{passive:false});
canvas.addEventListener('touchmove', e=>{
  if(pinchStartDist && e.touches.length===2){
    e.preventDefault();
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    const factor = dist / pinchStartDist;
    zoom = Math.min(3, Math.max(0.5, zoom * factor));
    pinchStartDist = dist;
   updateZoom();
  }
},{passive:false});
canvas.addEventListener('touchend', e=>{
  if(e.touches.length<2){
    pinchStartDist = null;
  }
},{passive:false});

document.getElementById('multiSelectBtn').onclick = () => {
  multiSelectMode = !multiSelectMode;
  if(!multiSelectMode) selectedItems = [];
  setMode(mode);
};

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  midpoints = [];
  lines.forEach((l, i) => {
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    let highlight = selectedItems.some(s=>s.type==="line"&&s.idx===i);
    ctx.lineWidth = highlight? 5 : ((selectedType==="line"&&selectedIdx===i) ? 5 : 2);
    ctx.strokeStyle = highlight? "#ffd600" : (selectedType==="line"&&selectedIdx===i) ? "#ffd600" : "#ccc";
    ctx.stroke();
    const cx = (l.x1 + l.x2)/2, cy = (l.y1 + l.y2)/2;
    midpoints.push({x: cx, y: cy});
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI*2);
    ctx.fillStyle = "#4caf50"; ctx.fill();
  });
  dims.forEach((dim,i)=>{
    const guideLen = 25;
    const dx = dim.p2.x - dim.p1.x, dy = dim.p2.y - dim.p1.y;
    const ang = Math.atan2(dy, dx);
    const offx = guideLen * Math.sin(ang), offy = -guideLen * Math.cos(ang);
    ctx.save();
    let highlight = selectedItems.some(s=>s.type==="dim"&&s.idx===i);
    ctx.strokeStyle = highlight? "#ffd600":"#ffd600"; ctx.lineWidth = highlight? 6: ((selectedType==="dim"&&selectedIdx===i)?6:3);
    ctx.beginPath();
    ctx.moveTo(dim.p1.x+offx, dim.p1.y+offy);
    ctx.lineTo(dim.p2.x+offx, dim.p2.y+offy); ctx.stroke();
    ctx.font = "18px sans-serif";
    ctx.fillStyle = "#ff9800";
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.translate((dim.p1.x+dim.p2.x)/2+offx, (dim.p1.y+dim.p2.y)/2+offy);
    ctx.rotate(ang);
    const len = Math.sqrt(dx*dx+dy*dy)/SCALE;
    ctx.fillText("L=" + len.toFixed(2) + "m", 0, -5);
    ctx.rotate(-ang);
    ctx.translate(-((dim.p1.x+dim.p2.x)/2+offx), -((dim.p1.y+dim.p2.y)/2+offy));
    ctx.restore();
  });
  endpoints = [];
  lines.forEach(l=>{
    endpoints.push({x:l.x1, y:l.y1});
    endpoints.push({x:l.x2, y:l.y2});
  });
  endpoints = endpoints.filter((pt, idx, arr) =>
    idx === arr.findIndex(p => Math.abs(p.x - pt.x) < 1 && Math.abs(p.y - pt.y) < 1)
  );
  endpoints.forEach((pt, idx) => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 5, 0, Math.PI*2);
    ctx.fillStyle = "#00baff";
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
  });
  refPoints.forEach((pt, i)=>{
    ctx.save();
    let highlight = selectedItems.some(s=>s.type==="ref"&&s.idx===i);
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 8, 0, Math.PI*2);
    ctx.strokeStyle=highlight?"#ffd600":(selectedType==="ref"&&selectedIdx===i)?"#ffd600":"#f55";
    ctx.lineWidth=highlight?6:((selectedType==="ref"&&selectedIdx===i)?6:4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pt.x-10, pt.y); ctx.lineTo(pt.x+10, pt.y);
    ctx.moveTo(pt.x, pt.y-10); ctx.lineTo(pt.x, pt.y+10);
    ctx.strokeStyle="#f55"; ctx.lineWidth=2; ctx.stroke();
    ctx.restore();
  });
  texts.forEach((t, i) => {
    let highlight = selectedItems.some(s=>s.type==="text"&&s.idx===i);
    ctx.font = "18px sans-serif";
    ctx.fillStyle = highlight? "#ffd600" : (selectedType==="text"&&selectedIdx===i) ? "#ffd600" : "#ff9800";
    ctx.fillText(t.text, t.x, t.y);
    if(highlight) {
      ctx.save();
      ctx.strokeStyle="#ffd600";ctx.lineWidth=2;
      ctx.strokeRect(t.x-3, t.y-22, ctx.measureText(t.text).width+8, 24);
      ctx.restore();
    }
  });
  if(startPt && mode==="line") {
    ctx.beginPath();
    ctx.arc(startPt.x, startPt.y, 8, 0, Math.PI*2);
    ctx.fillStyle = "#d22";
    ctx.fill();
  }
}

document.getElementById('scaleSelect').addEventListener('change', function() {
  scaleRatio = parseInt(this.value);
  SCALE = SCALE_BASE * (100 / scaleRatio);
  redraw();
});

document.getElementById('addLineBtn').onclick = () => {
  if (!startPt) return;
  saveState();
  const dxEl = document.getElementById('dx');
  const dyEl = document.getElementById('dy');
  const dx = parseFloat(dxEl.value) || 0;
  const dy = parseFloat(dyEl.value) || 0;
  const x2 = startPt.x + dx * SCALE;
  const y2 = startPt.y - dy * SCALE;
  lines.push({ x1: startPt.x, y1: startPt.y, x2, y2 });
  startPt = { x: x2, y: y2 };
  dxEl.value = '';
  dyEl.value = '';
  redraw();
};

function getNearestKeyPoint(cx, cy){
  let pts = [...endpoints, ...midpoints, ...refPoints];
  let minPt = null, minDist = 1e9;
  pts.forEach(pt=>{
    const d = Math.hypot(pt.x-cx, pt.y-cy);
    if(d<15 && d<minDist){ minDist = d; minPt = pt; }
  });
  return minPt;
}

// 両側線・線端延長共通モーダル
function showModal(html, onOK, onCancel) {
  const modalBg = document.getElementById("modalBg");
  const modalBox = document.getElementById("modalBox");
  modalBox.innerHTML = html;
  modalBg.style.display = "flex";
  function closeModal() {
    modalBg.style.display = "none";
    modalBox.innerHTML = "";
  }
  modalBox.querySelector(".ok").onclick = () => {
    onOK && onOK(modalBox);
    closeModal();
  };
  modalBox.querySelector(".cancel").onclick = () => {
    onCancel && onCancel();
    closeModal();
  };
  modalBg.onclick = (ev)=>{
    if(ev.target===modalBg) closeModal();
  }
}
// 両側線
document.getElementById('bisectLineBtn').onclick = () => {
  setMode("bisectline");
  bisectLineSelectPt = null;
};
// 線端延長/縮小
document.getElementById('editLineBtn').onclick = () => {
  setMode("editline");
};

canvas.addEventListener('click', (e) => {
const {x: cx, y: cy} = getCanvasPoint(e.clientX, e.clientY);

  if(multiSelectMode){
    let found = false;
    lines.forEach((l, i) => {
      if(distToSegment(cx, cy, l.x1, l.y1, l.x2, l.y2) < 10) {
        let idx = selectedItems.findIndex(sel => sel.type==="line" && sel.idx===i);
        if(idx>=0) selectedItems.splice(idx,1);
        else selectedItems.push({type:"line", idx:i});
        found = true;
      }
    });
    dims.forEach((d, i) => {
      if(distToSegment(cx, cy, d.p1.x, d.p1.y, d.p2.x, d.p2.y) < 10) {
        let idx = selectedItems.findIndex(sel => sel.type==="dim" && sel.idx===i);
        if(idx>=0) selectedItems.splice(idx,1);
        else selectedItems.push({type:"dim", idx:i});
        found = true;
      }
    });
    refPoints.forEach((pt, i) => {
      if(Math.hypot(pt.x-cx,pt.y-cy)<12){
        let idx = selectedItems.findIndex(sel => sel.type==="ref" && sel.idx===i);
        if(idx>=0) selectedItems.splice(idx,1);
        else selectedItems.push({type:"ref", idx:i});
        found = true;
      }
    });
    texts.forEach((t, i) => {
      if(cx>=t.x && cx<=t.x+ctx.measureText(t.text).width+10 && cy<=t.y && cy>=t.y-22){
        let idx = selectedItems.findIndex(sel => sel.type==="text" && sel.idx===i);
        if(idx>=0) selectedItems.splice(idx,1);
        else selectedItems.push({type:"text", idx:i});
        found = true;
      }
    });
    redraw();
    return;
  }

  if (mode === "bisectline") {
    let pt = getNearestKeyPoint(cx, cy) || { x: cx, y: cy };
    bisectLineSelectPt = { x: pt.x, y: pt.y };
    showModal(`
      <label>
        線の方向
        <select id="bisectDirection">
          <option value="h">左右（水平方向）</option>
          <option value="v">上下（垂直方向）</option>
        </select>
      </label>
      <label>
        両側の線の長さ（m）
        <input id="bisectLength" type="number" step="0.01" value="1.00">
      </label>
      <div class="modal-btns">
        <button class="ok">OK</button>
        <button class="cancel">キャンセル</button>
      </div>
    `, (modalBox)=>{
      let dir = modalBox.querySelector("#bisectDirection").value;
      let len = parseFloat(modalBox.querySelector("#bisectLength").value);
      if(isNaN(len) || len<=0) return;
      saveState();
      let halfLen = len * SCALE / 2;
      if(dir==="h"){
        lines.push({
          x1: bisectLineSelectPt.x - halfLen,
          y1: bisectLineSelectPt.y,
          x2: bisectLineSelectPt.x + halfLen,
          y2: bisectLineSelectPt.y
        });
      }else{
        lines.push({
          x1: bisectLineSelectPt.x,
          y1: bisectLineSelectPt.y - halfLen,
          x2: bisectLineSelectPt.x,
          y2: bisectLineSelectPt.y + halfLen
        });
      }
      redraw();
    });
    setMode("line");
    return;
  }

  if(mode==="editline"){
    let found = false;
    lines.forEach((l,i)=>{
      if(distToSegment(cx,cy,l.x1,l.y1,l.x2,l.y2)<10){
        selectedType="line"; selectedIdx=i; found = true;
      }
    });
    redraw();
    if(found){
      let l = lines[selectedIdx];
      showModal(`
        <label>どちらの端点を操作？
          <select id="endpointSide"><option value="start">始点</option><option value="end">終点</option></select>
        </label>
        <label>変更する長さ（m）<input id="editLength" type="number" step="0.01" value="0.5"></label>
        <div class="modal-btns">
          <button class="ok">OK</button>
          <button class="cancel">キャンセル</button>
        </div>
      `, (modalBox)=>{
        let side = modalBox.querySelector("#endpointSide").value;
        let editLen = parseFloat(modalBox.querySelector("#editLength").value);
        if(isNaN(editLen)) return;
        saveState();
        let dx = l.x2-l.x1, dy = l.y2-l.y1, length = Math.sqrt(dx*dx+dy*dy);
        if(length===0) return;
        let ux = dx/length, uy = dy/length;
        if(side==="start"){
          l.x1 -= ux*editLen*SCALE;
          l.y1 -= uy*editLen*SCALE;
        }else{
          l.x2 += ux*editLen*SCALE;
          l.y2 += uy*editLen*SCALE;
        }
        redraw();
      });
    }
    setMode("line");
    return;
  }

  if(mode==="dim"){
    let pt = getNearestKeyPoint(cx,cy);
    if(pt){
      dimSelectPts.push({x: pt.x, y: pt.y});
      if(dimSelectPts.length==2){
        saveState();
        dims.push({p1:dimSelectPts[0],p2:dimSelectPts[1]});
        dimSelectPts=[];
      }
    }
    redraw();
    return;
  }
  if(mode==="text"){ showTextInput(cx, cy); return; }
  if(mode==="twopt"){
    let pt = getNearestKeyPoint(cx,cy) || {x: cx, y: cy};
    if(twoptSelectPts.length<2){
      twoptSelectPts.push({x: pt.x, y: pt.y});
      if(twoptSelectPts.length==2){
        saveState();
        lines.push({x1:twoptSelectPts[0].x, y1:twoptSelectPts[0].y, x2:twoptSelectPts[1].x, y2:twoptSelectPts[1].y});
        twoptSelectPts=[];
      }
    }
    redraw();
    return;
  }
  if(mode==="trap"){
    let pt = getNearestKeyPoint(cx,cy) || {x: cx, y: cy};
    if(trapSelectPts.length<4){
      trapSelectPts.push({x: pt.x, y: pt.y});
      if(trapSelectPts.length==4){
        saveState();
        for(let i=0;i<4;i++){
          let j=(i+1)%4;
          lines.push({x1:trapSelectPts[i].x, y1:trapSelectPts[i].y, x2:trapSelectPts[j].x, y2:trapSelectPts[j].y});
        }
        trapSelectPts=[];
      }
    }
    redraw();
    return;
  }
  if(mode==="ref"){
    saveState();
    refPoints.push({x:cx, y:cy});
    redraw();
    return;
  }
  if(mode==="delete"){
    let found = false;
    lines.forEach((l,i)=>{
      if(distToSegment(cx,cy,l.x1,l.y1,l.x2,l.y2)<8){
        selectedType="line"; selectedIdx=i; found = true;
      }
    });
    dims.forEach((d,i)=>{
      if(distToSegment(cx,cy,d.p1.x,d.p1.y,d.p2.x,d.p2.y)<8){
        selectedType="dim"; selectedIdx=i; found=true;
      }
    });
    refPoints.forEach((pt,i)=>{
      if(Math.hypot(pt.x-cx,pt.y-cy)<12){
        selectedType="ref"; selectedIdx=i; found=true;
      }
    });
    texts.forEach((t,i)=>{
      if(cx>=t.x && cx<=t.x+ctx.measureText(t.text).width+10 && cy<=t.y && cy>=t.y-22){
        selectedType="text"; selectedIdx=i; found = true;
      }
    });
    redraw();
    if(found){
      setTimeout(()=>{
        if(selectedType==="line"){ lines.splice(selectedIdx,1); }
        if(selectedType==="dim"){ dims.splice(selectedIdx,1); }
        if(selectedType==="ref"){ refPoints.splice(selectedIdx,1); }
        if(selectedType==="text"){ texts.splice(selectedIdx,1);}
        selectedType=null; selectedIdx=null; redraw();
      },150);
    }
    return;
  }
  let found = false;
  for (const pt of endpoints) {
    if (Math.hypot(pt.x - cx, pt.y - cy) < 15) {
      startPt = {x: pt.x, y: pt.y}; found = true; break;
    }
  }
  if(!found){
    for(const mp of midpoints){
      if(Math.hypot(mp.x-cx, mp.y-cy)<15){ startPt={x:mp.x,y:mp.y}; found=true; break; }
    }
  }
  if(!found){
    for(const ref of refPoints){
      if(Math.hypot(ref.x-cx,ref.y-cy)<15){ startPt={x:ref.x,y:ref.y}; found=true; break;}
    }
  }
  if (!found) { startPt = {x: cx, y: cy}; }
  document.getElementById('addLineBtn').disabled = false;
  redraw();
});

function showTextInput(x, y) {
  let input = document.getElementById('textInput');
  input.style.left = (x * zoom) + "px";
  input.style.top = (y * zoom) + "px";
  input.style.display = "block";
  input.value = "";
  input.focus();
  input.onblur = () => {
    if(input.value.trim()){
      saveState();
      texts.push({text:input.value,x:x,y:y,selected:false});
      redraw();
    }
    input.style.display="none";
    setMode("line");
  };
}
document.getElementById('addTextBtn').onclick = () => setMode("text");
document.getElementById('moveBtn').onclick = () => setMode((mode==="move")?"line":"move");
document.getElementById('deleteBtn').onclick = () => setMode((mode==="delete")?"line":"delete");
document.getElementById('dimBtn').onclick = () => setMode((mode==="dim")?"line":"dim");
document.getElementById('refBtn').onclick = () => setMode((mode==="ref")?"line":"ref");
document.getElementById('twoptBtn').onclick = () => setMode((mode==="twopt")?"line":"twopt");
document.getElementById('trapBtn').onclick = () => setMode((mode==="trap")?"line":"trap");

document.getElementById('dxfBtn').onclick = () => {
  let dxf = [];
  dxf.push("0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nSECTION\n2\nENTITIES");
  lines.forEach(l=>{
    dxf.push(`0\nLINE\n8\n0\n10\n${(l.x1/SCALE).toFixed(3)}\n20\n${((canvas.height-l.y1)/SCALE).toFixed(3)}\n11\n${(l.x2/SCALE).toFixed(3)}\n21\n${((canvas.height-l.y2)/SCALE).toFixed(3)}`);
  });
  dims.forEach(d=>{
    const guideLen = 25;
    const dx = d.p2.x - d.p1.x, dy = d.p2.y - d.p1.y;
    const ang = Math.atan2(dy, dx);
    const offx = guideLen * Math.sin(ang), offy = -guideLen * Math.cos(ang);
    dxf.push(`0\nLINE\n8\nDIM\n10\n${((d.p1.x+offx)/SCALE).toFixed(3)}\n20\n${((canvas.height-(d.p1.y+offy))/SCALE).toFixed(3)}\n11\n${((d.p2.x+offx)/SCALE).toFixed(3)}\n21\n${((canvas.height-(d.p2.y+offy))/SCALE).toFixed(3)}`);
    const mx = (d.p1.x+d.p2.x)/2 + offx, my = (d.p1.y+d.p2.y)/2 + offy;
    const len = Math.sqrt((d.p2.x-d.p1.x)**2+(d.p2.y-d.p1.y)**2)/SCALE;
    dxf.push(`0\nTEXT\n8\nDIMTXT\n10\n${(mx/SCALE).toFixed(3)}\n20\n${((canvas.height-my)/SCALE).toFixed(3)}\n40\n0.15\n1\n${"L="+len.toFixed(2)+"m"}`);
  });
  refPoints.forEach(pt=>{
    dxf.push(`0\nPOINT\n8\nREF\n10\n${(pt.x/SCALE).toFixed(3)}\n20\n${((canvas.height-pt.y)/SCALE).toFixed(3)}`);
  });
  texts.forEach(t=>{
    dxf.push(`0\nTEXT\n8\nTXT\n10\n${(t.x/SCALE).toFixed(3)}\n20\n${((canvas.height-t.y)/SCALE).toFixed(3)}\n40\n0.2\n1\n${t.text}`);
  });
  dxf.push("0\nENDSEC\n0\nEOF");
  const blob = new Blob([dxf.join("\n")], {type:"text/plain"});
  const url = URL.createObjectURL(blob);
  const a = document.getElementById('dxfDownload');
  a.href = url;
  a.download = "drawing.dxf";
  a.style.display = "block";
  a.click();
  setTimeout(()=>{URL.revokeObjectURL(url);a.style.display="none";},1000);
};

  const clearBtn = document.getElementById('clearBtn');
  const clearHandler = (e) => {
  e.preventDefault();
  if(confirm("すべての要素を削除します。よろしいですか？")){
    saveState();
    lines = []; endpoints = []; texts = [];
    dims = []; dimSelectPts = [];
    refPoints = []; twoptSelectPts = []; trapSelectPts = [];
    startPt = null; selectedType=null; selectedIdx=null;
    selectedItems=[];
    redraw();
    document.getElementById('addLineBtn').disabled = true;
  }
};
clearBtn.addEventListener('click', clearHandler);
clearBtn.addEventListener('touchstart', clearHandler, {passive:false});

document.getElementById('toggleLayoutBtn').onclick = () => {
  document.body.classList.toggle('vertical-toolbar');
  resizeCanvas();
};
// --- 複数選択移動: タッチ ---
let multiMoveStartPositions = null;
canvas.addEventListener('touchstart', (e)=>{
  if(e.touches.length===1 && ((mode==="move" && selectedItems.length>0) || (multiSelectMode && selectedItems.length>0))){    e.preventDefault();
    isDragging = true;
    let t = e.touches[0];
    dragStart = getCanvasPoint(t.clientX, t.clientY);
    multiMoveStartPositions = selectedItems.map(sel=>{
      if(sel.type==="line") return {type:"line", idx:sel.idx, ...lines[sel.idx]};
      if(sel.type==="dim") return {type:"dim", idx:sel.idx, ...dims[sel.idx]};
      if(sel.type==="text") return {type:"text", idx:sel.idx, ...texts[sel.idx]};
      if(sel.type==="ref") return {type:"ref", idx:sel.idx, ...refPoints[sel.idx]};
    });
  }
}, {passive:false});
canvas.addEventListener('touchmove', (e)=>{
  if(isDragging && multiMoveStartPositions && e.touches.length===1){
    e.preventDefault();
    let t = e.touches[0];
    const {x: mx, y: my} = getCanvasPoint(t.clientX, t.clientY);
    const dx = mx - dragStart.x, dy = my - dragStart.y;
    multiMoveStartPositions.forEach((item,i)=>{
      if(item.type==="line"){
        lines[item.idx].x1 = item.x1+dx; lines[item.idx].y1 = item.y1+dy;
        lines[item.idx].x2 = item.x2+dx; lines[item.idx].y2 = item.y2+dy;
      }
      if(item.type==="dim"){
        dims[item.idx].p1.x = item.p1.x+dx; dims[item.idx].p1.y = item.p1.y+dy;
        dims[item.idx].p2.x = item.p2.x+dx; dims[item.idx].p2.y = item.p2.y+dy;
      }
      if(item.type==="text"){
        texts[item.idx].x = item.x+dx; texts[item.idx].y = item.y+dy;
      }
      if(item.type==="ref"){
        refPoints[item.idx].x = item.x+dx; refPoints[item.idx].y = item.y+dy;
      }
    });
    redraw();
  }
}, {passive:false});
canvas.addEventListener('touchend', (e)=>{
  if(isDragging && multiMoveStartPositions){
    e.preventDefault();
    saveState();
    isDragging=false; multiMoveStartPositions = null;
    redraw();
      } else {
    // synthesize a click for taps
    let t = e.changedTouches[0];
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      clientX: t.clientX,
      clientY: t.clientY
    });
    canvas.dispatchEvent(clickEvent);
  }
}, {passive:false});
// --- 複数選択移動: マウス ---
canvas.addEventListener('mousedown', (e)=>{
  if((mode==="move" && selectedItems.length>0) || (multiSelectMode && selectedItems.length>0)){
    isDragging = true;
    dragStart = getCanvasPoint(e.clientX, e.clientY);
    multiMoveStartPositions = selectedItems.map(sel=>{
      if(sel.type==="line") return {type:"line", idx:sel.idx, ...lines[sel.idx]};
      if(sel.type==="dim") return {type:"dim", idx:sel.idx, ...dims[sel.idx]};
      if(sel.type==="text") return {type:"text", idx:sel.idx, ...texts[sel.idx]};
      if(sel.type==="ref") return {type:"ref", idx:sel.idx, ...refPoints[sel.idx]};
    });
  }
});
canvas.addEventListener('mousemove', (e)=>{
  if(isDragging && multiMoveStartPositions){
    const {x: mx, y: my} = getCanvasPoint(e.clientX, e.clientY);
    const dx = mx - dragStart.x, dy = my - dragStart.y;
    multiMoveStartPositions.forEach((item,i)=>{
      if(item.type==="line"){
        lines[item.idx].x1 = item.x1+dx; lines[item.idx].y1 = item.y1+dy;
        lines[item.idx].x2 = item.x2+dx; lines[item.idx].y2 = item.y2+dy;
      }
      if(item.type==="dim"){
        dims[item.idx].p1.x = item.p1.x+dx; dims[item.idx].p1.y = item.p1.y+dy;
        dims[item.idx].p2.x = item.p2.x+dx; dims[item.idx].p2.y = item.p2.y+dy;
      }
      if(item.type==="text"){
        texts[item.idx].x = item.x+dx; texts[item.idx].y = item.y+dy;
      }
      if(item.type==="ref"){
        refPoints[item.idx].x = item.x+dx; refPoints[item.idx].y = item.y+dy;
      }
    });
    redraw();
  }
});
canvas.addEventListener('mouseup', (e)=>{
  if(isDragging && multiMoveStartPositions){
    saveState();
    isDragging=false; multiMoveStartPositions = null;
    redraw();
  }
});

function distToSegment(px,py,x1,y1,x2,y2){
  const l2 = (x2-x1)**2+(y2-y1)**2;
  if(l2===0) return Math.hypot(px-x1,py-y1);
  let t = ((px-x1)*(x2-x1)+(py-y1)*(y2-y1))/l2;
  t = Math.max(0,Math.min(1,t));
  const nx = x1+t*(x2-x1);
  const ny = y1+t*(y2-y1);
  return Math.hypot(px-nx,py-ny);
}

document.addEventListener('keydown', e=>{
  if(e.key==="Escape"){ setMode("line"); }
  if(e.ctrlKey && e.key==="z") document.getElementById('undoBtn').click();
  if(e.ctrlKey && e.key==="y") document.getElementById('redoBtn').click();
});

const statusBar = document.getElementById('statusBar');
function updateStatusBar(e){
  let p;
  if(e.touches && e.touches.length){
    const t = e.touches[0];
    p = getCanvasPoint(t.clientX, t.clientY);
  } else {
    p = getCanvasPoint(e.clientX, e.clientY);
  }
  statusBar.textContent = `x: ${p.x.toFixed(1)}  y: ${p.y.toFixed(1)}`;
}
canvas.addEventListener('mousemove', updateStatusBar);
canvas.addEventListener('touchmove', updateStatusBar, {passive:true});

export const state = {
  SCALE_BASE: 100,
  scaleRatio: 100,
  SCALE: 100 * (100 / 100),
  canvas: document.getElementById('canvas'),
  ctx: null,
  lines: [],
  endpoints: [],
  midpoints: [],
  texts: [],
  dims: [],
  refPoints: [],
  dimSelectPts: [],
  twoptSelectPts: [],
  trapSelectPts: [],
  startPt: null,
  mode: 'line',
  selectedType: null,
  selectedIdx: null,
  dragStart: {x:0, y:0},
  isDragging: false,
  movingLineSide: null,
  dragOffset: {x:0, y:0},
  undoStack: [],
  redoStack: [],
  ignoreStateSave: false,
  bisectLineSelectPt: null,
  multiSelectMode: false,
  selectedItems: [],
  zoom: 1,
};
state.ctx = state.canvas.getContext('2d');

export function getCanvasPoint(clientX, clientY){
  const rect = state.canvas.getBoundingClientRect();
  const x = (clientX - rect.left) * (state.canvas.width / rect.width);
  const y = (clientY - rect.top) * (state.canvas.height / rect.height);
  return {x, y};
}

export function saveState(){
  if(state.ignoreStateSave) return;
  state.undoStack.push(JSON.stringify({
    lines: JSON.parse(JSON.stringify(state.lines)),
    texts: JSON.parse(JSON.stringify(state.texts)),
    dims: JSON.parse(JSON.stringify(state.dims)),
    refPoints: JSON.parse(JSON.stringify(state.refPoints))
  }));
  if(state.undoStack.length>100) state.undoStack.shift();
  state.redoStack = [];
}

export function restoreState(obj){
  state.ignoreStateSave = true;
  state.lines = JSON.parse(JSON.stringify(obj.lines));
  state.texts = JSON.parse(JSON.stringify(obj.texts));
  state.dims = JSON.parse(JSON.stringify(obj.dims));
  state.refPoints = JSON.parse(JSON.stringify(obj.refPoints));
  state.dimSelectPts = [];
  state.twoptSelectPts = [];
  state.trapSelectPts = [];
  state.startPt = null;
  state.selectedType = null;
  state.selectedIdx = null;
  state.selectedItems = [];
  state.ignoreStateSave = false;
}
Object.assign(window, state, {getCanvasPoint, saveState, restoreState});

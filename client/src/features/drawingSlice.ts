import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface DrawingState {
  lines: Line[];
}

const initialState: DrawingState = {
  lines: []
};

const drawingSlice = createSlice({
  name: 'drawing',
  initialState,
  reducers: {
    addLine(state, action: PayloadAction<Line>) {
      state.lines.push(action.payload);
    }
  }
});

export const { addLine } = drawingSlice.actions;
export default drawingSlice.reducer;

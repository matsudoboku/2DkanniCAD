import React from 'react';
import { useAppDispatch } from '../hooks';
import { addLine } from '../features/drawingSlice';

export function Toolbar() {
  const dispatch = useAppDispatch();

  const handleAddLine = () => {
    // simple example line
    dispatch(addLine({ x1: 10, y1: 10, x2: 200, y2: 200 }));
  };

  return (
    <div>
      <button onClick={handleAddLine}>Add Line</button>
    </div>
  );
}

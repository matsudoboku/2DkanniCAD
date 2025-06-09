import React from 'react';
import { Stage, Layer, Line as KonvaLine } from 'react-konva';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';

export function Canvas() {
  const lines = useSelector((state: RootState) => state.drawing.lines);

  return (
    <Stage width={800} height={600} style={{border: '1px solid #ccc'}}>
      <Layer>
        {lines.map((l, i) => (
          <KonvaLine
            key={i}
            points={[l.x1, l.y1, l.x2, l.y2]}
            stroke="black"
          />
        ))}
      </Layer>
    </Stage>
  );
}

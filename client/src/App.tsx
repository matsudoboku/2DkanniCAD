import React from 'react';
import { Canvas } from './canvas/Canvas';
import { Toolbar } from './components/Toolbar';

export default function App() {
  return (
    <div className="app-root">
      <Toolbar />
      <Canvas />
    </div>
  );
}

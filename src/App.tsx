import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Lobby } from './pages/Lobby';
import { Game } from './pages/Game';
import { GameEnd } from './pages/GameEnd';
import { ThemeManager } from './components/ThemeManager';

function App() {
  return (
    <BrowserRouter>
      <ThemeManager />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/join/:inviteCode" element={<Landing />} />
        <Route path="/lobby/:code" element={<Lobby />} />
        <Route path="/game" element={<Game />} />
        <Route path="/end" element={<GameEnd />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout";
import { HomePage, GamePage, ResultsPage, SonglistPage } from "./pages";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/results" element={<ResultsPage />} />
        </Route>
        <Route path="/play" element={<GamePage />} />
        <Route path="/songlist" element={<SonglistPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

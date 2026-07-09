import { BrowserRouter, Route, Routes } from "react-router-dom";
import Navbar from "./components/ui/Navbar";

import { Home } from "./pages/Home";
import Rooms from "./pages/Rooms";
import ManageFurniture from "./pages/ManageFurniture";
import EditorPlaceholder from "./pages/EditorPlaceholder";
import Preference from "./pages/Preference";


export default function App() {
  return (
    <BrowserRouter>
      <Navbar />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/manage-furniture" element={<ManageFurniture />} />
        <Route path="/preference" element={<Preference />} />
        <Route path="/editor" element={<EditorPlaceholder />} />
      </Routes>
    </BrowserRouter>
  );
}

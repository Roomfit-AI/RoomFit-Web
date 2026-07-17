import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FurnitureVariantPreviewHarness } from "../components/furniture/variants/FurnitureVariantPreviewHarness";
import "../index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Furniture preview root element was not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <FurnitureVariantPreviewHarness />
  </StrictMode>,
);

import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./index.css";

// Prevent flash of solid background or main app UI when recorder window opens
if (
  typeof window !== "undefined" &&
  (window.location.hash.includes("recorder") || window.location.pathname.includes("recorder"))
) {
  document.documentElement.classList.add("recorder-window");
  document.body.classList.add("recorder-window");
  document.documentElement.style.background = "transparent";
  document.body.style.background = "transparent";
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

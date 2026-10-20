if (import.meta.env.DEV && !("__TAURI_INTERNALS__" in window)) await import("../dev/browser-mock");

import React from "react";
import ReactDOM from "react-dom/client";
import "../shared/fonts";
import "../shared/themes.css";
import "./window.css";
import "./island.css";
import { Island } from "./Island";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Island />
  </React.StrictMode>,
);

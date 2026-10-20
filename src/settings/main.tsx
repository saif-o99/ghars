if (import.meta.env.DEV && !("__TAURI_INTERNALS__" in window)) await import("../dev/browser-mock");

import React from "react";
import ReactDOM from "react-dom/client";
import "../shared/fonts";
import "../shared/themes.css";
import "../island/island.css";
import "./settings.css";
import { SettingsApp } from "./Settings";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SettingsApp />
  </React.StrictMode>,
);

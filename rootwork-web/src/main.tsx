import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { LayoutLab } from "./dev/LayoutLabOverlay";
import { initStories } from "./stories";
import "./styles/organic.css";
import "./styles/app.css";

void initStories();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
    {import.meta.env.DEV ? <LayoutLab key="baked-3" /> : null}
  </React.StrictMode>,
);

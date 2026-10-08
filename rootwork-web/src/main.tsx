import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { LayoutLab } from "./dev/LayoutLabOverlay";
import { initStories } from "./stories";
import { ShareGate } from "./share/ShareGate";
import { shareInfo } from "./share/info";
import "./styles/organic.css";
import "./styles/app.css";

const share = shareInfo();
if (!share) void initStories();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {share ? (
      <ShareGate info={share}>
        <App />
      </ShareGate>
    ) : (
      <App />
    )}
    {import.meta.env.DEV ? <LayoutLab key="baked-3" /> : null}
  </React.StrictMode>,
);

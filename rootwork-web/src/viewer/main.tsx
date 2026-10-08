import React from "react";
import ReactDOM from "react-dom/client";
import { readHtmlExportPayload } from "../export/htmlExport";
import { setExportFlags } from "../data/countries";
import { ViewerApp } from "./ViewerApp";
import "../styles/organic.css";
import "../styles/app.css";

const payload = readHtmlExportPayload();
if (payload?.flags) setExportFlags(payload.flags);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {payload ? (
      <ViewerApp payload={payload} />
    ) : (
      <div className="placeholder-page">
        <div className="card elev-md placeholder-card">
          <div className="placeholder-kicker">Rootwork</div>
          <h3>No family data in this file</h3>
          <p>Export a view-only HTML file from Rootwork (Share → Export HTML).</p>
        </div>
      </div>
    )}
  </React.StrictMode>,
);

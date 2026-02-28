import { useState } from "react";
import type { JobDto } from "./MapView";

export default function JobsSidebar(props: {
  home: { lat: number; lng: number } | null;
  radiusKm: number;
  onSetRadiusKm: (v: number) => void;
  jobs: JobDto[];
  loading: boolean;
  error: string | null;
  onSearch: (what: string, where: string) => void;
}) {
  const [what, setWhat] = useState("cashier");
  const [where, setWhere] = useState("Newark, DE");

  return (
    <div style={{ padding: 12, height: "100%", overflow: "auto" }}>
      <h3 style={{ marginTop: 0 }}>Search</h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label>
          Keyword
          <input value={what} onChange={(e) => setWhat(e.target.value)} style={{ width: "100%" }} />
        </label>

        <label>
          Where (for Adzuna)
          <input value={where} onChange={(e) => setWhere(e.target.value)} style={{ width: "100%" }} />
        </label>

        <label>
          Radius (km)
          <input
            type="number"
            value={props.radiusKm}
            min={1}
            max={100}
            onChange={(e) => props.onSetRadiusKm(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </label>

        <button
          onClick={() => props.onSearch(what, where)}
          disabled={!props.home}
        >
          {props.home ? "Search nearby jobs" : "Set Home on map first"}
        </button>
      </div>

      <hr />

      {props.loading && <div>Loading...</div>}
      {props.error && <div style={{ color: "crimson" }}>{props.error}</div>}

      {!props.loading && !props.error && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {props.jobs.map((j) => (
            <div key={j.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 10 }}>
              <div style={{ fontWeight: 600 }}>{j.title}</div>
              <div style={{ fontSize: 13 }}>{j.company}</div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>{j.locationText}</div>
              <a href={j.url} target="_blank" rel="noreferrer">
                Apply
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
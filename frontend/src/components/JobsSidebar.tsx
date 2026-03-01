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
  selectedJobId: string | null;
  onSelectJob: (id: string) => void;
  useMyLocation: () => void;
}) {
  const [what, setWhat] = useState("");
  const [where, setWhere] = useState("");
  const [radiusText, setRadiusText] = useState("");

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    height: 44,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid #ddd",
    outline: "none",
    fontSize: 14,
  };

  const buttonStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    height: 44,
    borderRadius: 12,
    border: "1px solid #111",
    background: "#111",
    color: "white",
    fontSize: 15,
    cursor: "pointer",
  };

  return (
    <div style={{ padding: 12, height: "100%", overflow: "auto", color: "#111" }}>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          onClick={props.useMyLocation}
          style={{
            ...buttonStyle,
            background: "#fff",
            color: "#111",
            border: "1px solid #ddd",
          }}
        >
          Use my location
        </button>

        <input
          value={what}
          onChange={(e) => setWhat(e.target.value)}
          placeholder="Keyword (e.g., cashier)"
          style={inputStyle}
        />

        <input
          value={where}
          onChange={(e) => setWhere(e.target.value)}
          placeholder="Location (e.g., Newark, DE)"
          style={inputStyle}
        />

        <input
          type="number"
          value={props.radiusKm}
          min={1}
          max={100}
          step={0.1}
          onChange={(e) => props.onSetRadiusKm(Number(e.target.value))}
          placeholder="Radius (km)"
          style={inputStyle}
        />

        <input
          type="range"
          min={1}
          max={25}
          step={0.1}
          value={props.radiusKm}
          onChange={(e) => props.onSetRadiusKm(Number(e.target.value))}
          style={{ width: "100%" }}
        />
        <div style={{ fontSize: 13, marginTop: 4 }}>
          Radius: <b>{props.radiusKm.toFixed(1)} km</b>
        </div>

        <button
          onClick={() => props.onSearch(what, where)}
          disabled={!props.home || !what.trim()}
          style={{
            ...buttonStyle,
            opacity: props.home ? 1 : 0.6,
            cursor: props.home ? "pointer" : "not-allowed",
          }}
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
            <div key={j.id} onClick={() => props.onSelectJob(j.id)} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 10, cursor: "pointer", outline: props.selectedJobId === j.id ? "2px solid #1f6feb" : "none", }}>
              <div style={{ fontWeight: 600 }}>{j.title}</div>
              <div style={{ fontSize: 13 }}>{j.company}</div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>{j.locationText}</div>
              <a href={j.url} onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer">
                Apply
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
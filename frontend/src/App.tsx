import { useMemo, useState } from "react";
import JobsSidebar from "./components/JobsSidebar";
import MapView from "./components/MapView";
import type { JobDto } from "./components/MapView";
import type { LatLngLiteral } from "leaflet";

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export default function App() {
  const [home, setHome] = useState<LatLngLiteral | null>(null);
  const [radiusKm, setRadiusKm] = useState(3);

  const [jobs, setJobs] = useState<JobDto[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);

  const visibleJobs = useMemo(() => {
    if (!home) return [];

    const inside = jobs
      .filter((j) => j.lat != null && j.lon != null)
      .filter((j) => haversineKm(home, { lat: j.lat as number, lng: j.lon as number }) <= radiusKm);

    inside.sort((a, b) => {
      const da = haversineKm(home, { lat: a.lat as number, lng: a.lon as number });
      const db = haversineKm(home, { lat: b.lat as number, lng: b.lon as number });
      return da - db;
    });

    return inside;
  }, [jobs, home, radiusKm]);

  const onSearch = async (what: string, where: string) => {
    if (!home) return;

    try {
      setLoading(true);
      setError(null);

      const url =
        `/api/jobs/search?what=${encodeURIComponent(what)}` +
        `&where=${encodeURIComponent(where)}` +
        `&homeLat=${encodeURIComponent(home.lat)}` +
        `&homeLon=${encodeURIComponent(home.lng)}` +
        `&radiusKm=${encodeURIComponent(radiusKm)}` +
        `&days=90` +
        `&resultsPerPage=50`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);

      const data = (await res.json()) as JobDto[];
      setJobs(data);
      setSelectedJobId(null);
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div style={{ height: "100vh", width: "100vw", display: "relative" }}>
      {panelOpen && home && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            width: 420,
            height: "calc(100% - 24px)",
            background: "white",
            color: "#111",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            overflow: "hidden",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Panel header */}
          <div
            style={{
              padding: 10,
              borderBottom: "1px solid #eee",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontWeight: 700 }}>Jobs</div>
            <button onClick={() => setPanelOpen(false)} 
              style={{
                width: 36,
                height: 36,
                display: "grid",
                placeItems: "center",
                border: "1px solid #ddd",
                borderRadius: 12,
                background: "#fff",
                color: "#111",
                fontSize: 20,
                lineHeight: "20px",
                padding: 0,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>

          {/* Panel body */}
          <div style={{ flex: 1, overflow: "auto" }}>
            <JobsSidebar
              home={home}
              radiusKm={radiusKm}
              onSetRadiusKm={setRadiusKm}
              jobs={visibleJobs}
              loading={loading}
              error={error}
              onSearch={onSearch}
              selectedJobId={selectedJobId}
              onSelectJob={setSelectedJobId}
            />
          </div>
        </div>
      )}

      <div style={{ height: "100%", width: "100%" }}>
        <MapView
          home={home}
          onPickHome={(p) => {
            setHome(p);
            // setJobs([]);
            setSelectedJobId(null);
            setPanelOpen(true);
          }}
          radiusKm={radiusKm}
          jobs={visibleJobs}
          selectedJobId={selectedJobId}
          onSelectJob={setSelectedJobId}
          onClearSelection={() => setSelectedJobId(null)}
        />
      </div>
    </div>
  );
}
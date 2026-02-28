import { useState } from "react";
import JobsSidebar from "./components/JobsSidebar";
import MapView, { type JobDto } from "./components/MapView";
import type { LatLngLiteral } from "leaflet";

export default function App() {
  const [home, setHome] = useState<LatLngLiteral | null>(null);
  const [radiusKm, setRadiusKm] = useState(15);

  const [jobs, setJobs] = useState<JobDto[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setSelectedJobId(data.length ? data[0].id : null);
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const showSidebar = home !== null; // you can tighten this to “jobs loaded” later

  return (
    <div style={{ height: "100vh", width: "100vw", display: "flex" }}>
      {showSidebar && (
        <div style={{ width: 420, borderRight: "1px solid #ddd" }}>
          <JobsSidebar
            home={home}
            radiusKm={radiusKm}
            onSetRadiusKm={setRadiusKm}
            jobs={jobs}
            loading={loading}
            error={error}
            onSearch={onSearch}
          />
        </div>
      )}

      <div style={{ flex: 1 }}>
        <MapView
          home={home}
          onPickHome={(p) => {
            setHome(p);
            setJobs([]);
            setSelectedJobId(null);
          }}
          radiusKm={radiusKm}
          jobs={jobs}
          selectedJobId={selectedJobId}
          onSelectJob={setSelectedJobId}
        />
      </div>
    </div>
  );
}
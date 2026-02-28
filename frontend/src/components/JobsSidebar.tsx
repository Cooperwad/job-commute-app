import { useEffect, useState } from "react";

export type JobDto = {
  id: number;
  title: string;
  company: string;
  locationText: string;
  url: string;
  source: string;
  postedAtUtc: string | null;
  lat: number | null;
  lon: number | null;
};

export default function JobsSidebar() {
  const [jobs, setJobs] = useState<JobDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/jobs");
        if (!res.ok) throw new Error(`GET /api/jobs failed: ${res.status}`);

        const data = (await res.json()) as JobDto[];
        setJobs(data);
      } catch (e: any) {
        setError(e?.message ?? "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div style={{ padding: 12, height: "100%", overflow: "auto" }}>
      <h3 style={{ marginTop: 0 }}>Jobs</h3>

      {loading && <div>Loading...</div>}
      {error && <div style={{ color: "crimson" }}>{error}</div>}

      {!loading && !error && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {jobs.map((j) => (
            <div
              key={j.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 10,
              }}
            >
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
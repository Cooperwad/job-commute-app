import { useMemo, useState } from "react";
import type { JobDto } from "./MapView";

export default function JobsSidebar(props: {
  home: { lat: number; lng: number } | null;
  radiusKm: number;
  onSetRadiusKm: (v: number) => void;
  jobs: JobDto[];
  loading: boolean;
  error: string | null;
  onSearch: (what: string, where: string) => Promise<void>;
  selectedJobId: string | null;
  onSelectJob: (id: string) => void;
  useMyLocation: () => void;
}) {
  const [what, setWhat] = useState("");
  const [where, setWhere] = useState("");

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiWinnerId, setAiWinnerId] = useState<string | null>(null);
    
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

  // These values are hardcoded for the demo, but I can make them programatic later.
  const GasPricePerGallon = 3.50;
  const Mpg = 25;
  const MilesPerKm = 0.621371;
  const WorkDaysPerYear = 260;

  // Straight-line distance underestimates roads a bit
  const RoadFactor = 1.2;

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

  function salaryAnnual(job: JobDto): number | null {
    const a = job.salaryMin ?? null;
    const b = job.salaryMax ?? null;
    if (a == null && b == null) return null;
    if (a != null && b != null) return (a + b) / 2;
    return a ?? b;
  }

  function computeMetrics(job: JobDto, home: { lat: number; lng: number } | null) {
    if (!home || job.lat == null || job.lon == null) return null;

    const straightKm = haversineKm(home, { lat: job.lat, lng: job.lon });
    const distKm = straightKm * RoadFactor;

    const milesOneWay = distKm * MilesPerKm;
    const gasOneWay = (milesOneWay / Mpg) * GasPricePerGallon;
    const commuteCostDaily = gasOneWay * 2;

    const annual = salaryAnnual(job);
    const dailyGross = annual == null ? null : annual / WorkDaysPerYear;
    const netDaily = dailyGross == null ? null : dailyGross - commuteCostDaily;

    return { distKm, annual, commuteCostDaily, dailyGross, netDaily };
  }

  const enriched = useMemo(() => {
    return props.jobs
      .map((j) => ({ j, m: computeMetrics(j, props.home) }))
      .filter((x) => x.m != null) as { j: JobDto; m: NonNullable<ReturnType<typeof computeMetrics>> }[];
  }, [props.jobs, props.home]);

  const ranked = useMemo(() => {
    // Prefer netDaily when salary exists; otherwise fall back to closest commute cost (cheapest)
    const withNet = enriched.filter((x) => x.m.netDaily != null) as typeof enriched;
    if (withNet.length > 0) {
      return [...withNet].sort((a, b) => (b.m.netDaily as number) - (a.m.netDaily as number));
    }
    return [...enriched].sort((a, b) => a.m.commuteCostDaily - b.m.commuteCostDaily);
  }, [enriched]);

  const best = ranked.length ? ranked[0] : null;
  const secondBest = ranked.length > 1 ? ranked[1] : null;

  const selected = props.selectedJobId
    ? enriched.find((x) => x.j.id === props.selectedJobId) ?? null
    : null;

  

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
          disabled={!props.home}
          style={{
            ...buttonStyle,
            opacity: props.home ? 1 : 0.6,
            cursor: props.home ? "pointer" : "not-allowed",
          }}
        >
          {props.home ? "Search nearby jobs" : "Set Home on map first"}
        </button>

        <button
          disabled={!props.home || props.jobs.length === 0}
          onClick={async () => {
            try {
              setAiLoading(true);
              setAiError(null);
              setAiText(null);
              setAiWinnerId(null);

              const computed = props.jobs
                .map((j) => {
                  const m = computeMetrics(j, props.home);
                  if (!m) return null;
                  return {
                    id: j.id,
                    title: j.title,
                    company: j.company,
                    distanceKm: Number(m.distKm.toFixed(2)),
                    commuteCostDaily: Number(m.commuteCostDaily.toFixed(2)),
                    salaryAnnual: m.annual == null ? null : Number(m.annual.toFixed(0)),
                    netDaily: m.netDaily == null ? null : Number(m.netDaily.toFixed(2)),
                    salaryIsPredicted: !!j.salaryIsPredicted,
                  };
                })
                .filter(Boolean);

              const res = await fetch("/api/ai/analyze-best", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jobs: computed }),
              });

              if (!res.ok) throw new Error(`AI request failed: ${res.status}`);

              const data = (await res.json()) as { winnerId: string; text: string };

              setAiWinnerId(data.winnerId);
              setAiText(data.text);

              // Jump straight to the winning marker popup
              props.onSelectJob(data.winnerId);
            } catch (e: any) {
              setAiError(e?.message ?? "AI request failed");
            } finally {
              setAiLoading(false);
            }
          }}
          style={{
            ...buttonStyle,
            background: "#fff",
            color: "#111",
            border: "1px solid #ddd",
            opacity: !props.home || props.jobs.length === 0 ? 0.6 : 1,
            cursor: !props.home || props.jobs.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          {aiLoading ? "Analyzing..." : "Analyze with Gemini"}
        </button>

      </div>
      {aiError && <div style={{ color: "crimson" }}>{aiError}</div>}

      {aiText && (
        <div
          style={{
            padding: 10,
            border: "1px solid #eee",
            borderRadius: 12,
            background: "#fafafa",
          }}
        >
          <div
            style={{
              whiteSpace: "pre-wrap",
              fontSize: 13,
              lineHeight: 1.4,
              height: 240,     // keep whatever size you want
              overflowY: "auto",
            }}
          >
            {aiText}
          </div>
        </div>
      )}
      <hr />

      {props.loading && <div>Loading...</div>}
      {props.error && <div style={{ color: "crimson" }}>{props.error}</div>}

      {!props.loading && !props.error && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {props.jobs.map((j) => {
            const m = computeMetrics(j, props.home);
            const isBest = best?.j.id === j.id;

            return (
              <div
                key={j.id}
                onClick={() => props.onSelectJob(j.id)}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: 10,
                  cursor: "pointer",
                  outline: props.selectedJobId === j.id ? "2px solid #1f6feb" : "none",
                  background: isBest ? "rgba(31,111,235,0.06)" : "transparent",
                }}
              >
                <div style={{ fontWeight: 600 }}>{j.title}</div>
                <div style={{ fontSize: 13 }}>{j.company}</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>{j.locationText}</div>

                {m && (
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
                    <div>Dist: {m.distKm.toFixed(2)} km</div>
                    <div>Commute (gas/day): ${m.commuteCostDaily.toFixed(2)}</div>
                    {m.annual != null ? (
                      <div>
                        Salary: ${Math.round(m.annual).toLocaleString()}/yr{" "}
                        {j.salaryIsPredicted ? "(pred)" : ""}
                      </div>
                    ) : (
                      <div>Salary: unknown</div>
                    )}
                    {m.netDaily != null ? (
                      <div><b>Net/day:</b> ${m.netDaily.toFixed(2)}</div>
                    ) : (
                      <div>Net/day: unknown</div>
                    )}
                    {isBest && <div style={{ marginTop: 4, fontWeight: 700 }}>Best</div>}
                  </div>
                )}

                <a href={j.url} onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer">
                  Apply
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
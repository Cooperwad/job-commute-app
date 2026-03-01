import { useEffect, useMemo, useState } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMapEvents, Popup, ZoomControl, Polyline } from "react-leaflet";
import type { LatLngLiteral } from "leaflet";
import L from "leaflet";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

function spreadPositions(
  jobs: { id: string; lat: number; lon: number }[],
  meters: number
): Record<string, { lat: number; lng: number }> {
  const out: Record<string, { lat: number; lng: number }> = {};
  const R = 6378137; // earth radius in meters

  // group by rounded coordinate
  const groups = new Map<string, typeof jobs>();
  for (const j of jobs) {
    const key = `${j.lat.toFixed(5)},${j.lon.toFixed(5)}`;
    const arr = groups.get(key) ?? [];
    arr.push(j);
    groups.set(key, arr);
  }

  for (const [key, arr] of groups) {
    const [baseLatStr, baseLonStr] = key.split(",");
    const baseLat = Number(baseLatStr);
    const baseLon = Number(baseLonStr);

    if (arr.length === 1) {
      out[arr[0].id] = { lat: baseLat, lng: baseLon };
      continue;
    }

    // spread in a ring
    for (let i = 0; i < arr.length; i++) {
      const angle = (2 * Math.PI * i) / arr.length;
      const dx = meters * Math.cos(angle);
      const dy = meters * Math.sin(angle);

      // meters -> degrees
      const dLat = (dy / R) * (180 / Math.PI);
      const dLon = (dx / (R * Math.cos((baseLat * Math.PI) / 180))) * (180 / Math.PI);

      out[arr[i].id] = { lat: baseLat + dLat, lng: baseLon + dLon };
    }
  }

  return out;
}

const homeIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  iconRetinaUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});


const jobIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
  iconRetinaUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export type JobDto = {
  id: string;
  title: string;
  company: string;
  locationText: string;
  url: string;
  source: string;
  postedAtUtc: string | null;
  lat: number | null;
  lon: number | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryIsPredicted?: boolean;
};

function ClickToSetHomePin(props: { 
  onPick: (p: LatLngLiteral) => void; 
  onClearSelection: () => void;
  isPopupOpen: boolean;
 }) {
  useMapEvents({
    click(e) {
      const target = (e.originalEvent?.target as HTMLElement | null);

      if (
        target?.closest(".leaflet-marker-icon") ||
        target?.closest(".leaflet-popup")
      ) {
        return;
      }

      if (props.isPopupOpen) {
        props.onClearSelection();
        return;
      }

      props.onPick(e.latlng);
      props.onClearSelection();
    },
  });
  return null;
}

export default function MapView(props: {
  home: LatLngLiteral | null;
  onPickHome: (p: LatLngLiteral) => void;
  radiusKm: number;
  jobs: JobDto[];
  selectedJobId: string | null;
  onSelectJob: (id: string) => void;
  onClearSelection: () => void;
}) {
  const defaultCenter: LatLngLiteral = useMemo(
    () => ({ lat: 39.6837, lng: -75.7497 }),
    []
  );

  const center = props.home ?? defaultCenter;
  const jitterPositions = useMemo(() => {
    const withCoords = props.jobs
        .filter((j) => j.lat != null && j.lon != null)
        .map((j) => ({ id: j.id, lat: j.lat as number, lon: j.lon as number }));

    // ADJUST THIS VALUE to change distance of same-position leaflet markers
    return spreadPositions(withCoords, 30);
  }, [props.jobs]);

  const [routeLine, setRouteLine] = useState<[number, number][]>([]);
  const [routeMeta, setRouteMeta] = useState<{ distanceMeters: number; durationSeconds: number } | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!props.home) return;

      const job = props.jobs.find((j) => j.id === props.selectedJobId);
      if (!job || job.lat == null || job.lon == null) {
        setRouteLine([]);
        setRouteMeta(null);
        return;
      }

      const url =
        `/api/route?homeLat=${encodeURIComponent(props.home.lat)}` +
        `&homeLon=${encodeURIComponent(props.home.lng)}` +
        `&jobLat=${encodeURIComponent(job.lat)}` +
        `&jobLon=${encodeURIComponent(job.lon)}` +
        `&profile=driving-car`;

      const res = await fetch(url);
      if (!res.ok) {
        setRouteLine([]);
        setRouteMeta(null);
        return;
      }

      const data = (await res.json()) as {
        distanceMeters: number;
        durationSeconds: number;
        coordinatesLatLng: [number, number][];
      };

      setRouteLine(data.coordinatesLatLng);
      setRouteMeta({ distanceMeters: data.distanceMeters, durationSeconds: data.durationSeconds });
    };

    run();
  }, [props.selectedJobId, props.home, props.jobs]);

  return (
    <div style={{ height: "100%", width: "100%", position: "relative" }}>
      <MapContainer center={center} zoom={12} zoomControl={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {routeLine.length > 0 && <Polyline positions={routeLine} />}

        <ZoomControl position="topright" />

        <ClickToSetHomePin 
         onPick={props.onPickHome} 
         onClearSelection={props.onClearSelection}
         isPopupOpen={props.selectedJobId !== null}
        />

        {props.home && (
          <>
            <Marker
              position={props.home}
              icon={homeIcon}
              draggable={true}
              eventHandlers={{
                dragstart: () => props.onClearSelection(),
                drag: (e) => {
                  const m = e.target as any;
                  const p = m.getLatLng();
                  props.onPickHome({ lat: p.lat, lng: p.lng });
                },
                dragend: (e) => {
                  const m = e.target as any;
                  const p = m.getLatLng();
                  props.onPickHome({ lat: p.lat, lng: p.lng });
                },
              }}
            />
            <Circle center={props.home} radius={props.radiusKm * 1000} />
          </>
        )}
        {props.jobs
            .filter((j) => j.lat != null && j.lon != null)
            .map((j) => (
               <Marker
                key={j.id}
                position={jitterPositions[j.id] ?? { lat: j.lat as number, lng: j.lon as number }}
                bubblingMouseEvents={false}
                eventHandlers={{
                    click: () => props.onSelectJob(j.id),
                }}
                icon={jobIcon}
               >
                 <Popup autoClose closeOnClick>
                    <div style={{ maxWidth: 260 }}>
                        <div style={{ fontWeight: 700 }}>{j.title}</div>
                        <div>{j.company}</div>
                        <div style={{ opacity: 0.8 }}>{j.locationText}</div>
                        <div style={{ marginTop: 8 }}>
                            <a href={j.url} target="_blank" rel="noreferrer">
                                Apply
                            </a>
                        </div>
                    </div>
                 </Popup>
              </Marker>
            ))}
      </MapContainer>

      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          background: "white",
          padding: 10,
          borderRadius: 8,
          width: 320,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Home + radius</div>
        <div style={{ fontSize: 13, marginBottom: 8 }}>
          Home: {props.home ? `${props.home.lat.toFixed(5)}, ${props.home.lng.toFixed(5)}` : "Click the map to set"}
        </div>
        <div style={{ fontSize: 13 }}>Radius: {props.radiusKm} km</div>
      </div>
    </div>
  );
}
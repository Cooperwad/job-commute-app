import { useMemo } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import type { LatLngLiteral } from "leaflet";

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

function ClickToSetHomePin(props: { onPick: (p: LatLngLiteral) => void }) {
  useMapEvents({
    click(e) {
      props.onPick(e.latlng);
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
}) {
  const defaultCenter: LatLngLiteral = useMemo(
    () => ({ lat: 39.6837, lng: -75.7497 }),
    []
  );

  const center = props.home ?? defaultCenter;

  return (
    <div style={{ height: "100%", width: "100%", position: "relative" }}>
      <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ClickToSetHomePin onPick={props.onPickHome} />

        {props.home && (
          <>
            <Marker position={props.home} />
            <Circle center={props.home} radius={props.radiusKm * 1000} />
          </>
        )}

        {props.jobs
          .filter((j) => j.lat != null && j.lon != null)
          .map((j) => (
            <Marker
              key={j.id}
              position={{ lat: j.lat as number, lng: j.lon as number }}
              eventHandlers={{
                click: () => props.onSelectJob(j.id),
              }}
            />
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
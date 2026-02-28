import { useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import type { LatLngLiteral } from "leaflet";

function ClickToSetHomePin(props: { onPick: (p: LatLngLiteral) => void }) {
  useMapEvents({
    click(e) {
      props.onPick(e.latlng);
    },
  });
  return null;
}

export default function MapView() {
  const defaultCenter: LatLngLiteral = useMemo(
    () => ({ lat: 39.6837, lng: -75.7497 }),
    []
  );

  const [home, setHome] = useState<LatLngLiteral | null>(null);

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <MapContainer center={defaultCenter} zoom={12} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ClickToSetHomePin onPick={setHome} />
        {home && <Marker position={home} />}
      </MapContainer>

      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          background: "white",
          padding: 8,
          borderRadius: 8,
        }}
      >
        <div><b>Click the map</b> to set Home</div>
        <div>Home: {home ? `${home.lat.toFixed(5)}, ${home.lng.toFixed(5)}` : "not set"}</div>
      </div>
    </div>
  );
}
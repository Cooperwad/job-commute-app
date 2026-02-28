import JobsSidebar from "./components/JobsSidebar"; 
import MapView from "./components/MapView";

export default function App() {
  return (
    <div style={{ height: "100vh", width: "100vw", display: "flex" }}>
      <div style={{ width: 420, borderRight: "1px solid #ddd"}}>
        <JobsSidebar />
      </div>

      <div style={{ flex: 1}}>
        <MapView />
      </div>
    </div>
  );
}

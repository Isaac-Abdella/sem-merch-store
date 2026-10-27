import { useEffect, useState } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { TILE_ATTRIBUTION, TILE_URL, homeIcon, storeIcon } from './leafletSetup';
import { getServiceArea } from '../../api/serviceArea';

/** Shows the delivery radius around Toronto, plus an optional point (e.g. the customer's location). */
export default function ServiceAreaMap({ point, height = 340 }) {
  const [area, setArea] = useState(null);

  useEffect(() => {
    getServiceArea().then(setArea).catch(() => {});
  }, []);

  if (!area) return <div className="map-frame map-frame--loading" style={{ height }} />;

  const { center, radiusKm } = area;
  return (
    <div className="map-frame" style={{ height }}>
      <MapContainer center={[center.lat, center.lng]} zoom={8} scrollWheelZoom={false} style={{ height: '100%' }}>
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <Circle
          center={[center.lat, center.lng]}
          radius={radiusKm * 1000}
          pathOptions={{ color: '#c8102e', fillColor: '#c8102e', fillOpacity: 0.08, weight: 2 }}
        />
        <Marker position={[center.lat, center.lng]} icon={storeIcon}>
          <Popup>Downtown Toronto — we deliver up to {radiusKm} km from here</Popup>
        </Marker>
        {point && <Marker position={[point.lat, point.lng]} icon={homeIcon} />}
      </MapContainer>
    </div>
  );
}

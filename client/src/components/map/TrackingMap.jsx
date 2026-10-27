import { useEffect } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { TILE_ATTRIBUTION, TILE_URL, courierIcon, homeIcon, storeIcon } from './leafletSetup';

/** Re-frames the map whenever the set of points changes. */
function FitToPoints({ points }) {
  const map = useMap();
  const key = JSON.stringify(points);
  useEffect(() => {
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], 13);
    else if (points.length > 1) map.fitBounds(points.map((p) => [p.lat, p.lng]), { padding: [48, 48], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

/**
 * origin: store/warehouse, destination: customer's address, current: courier's last position,
 * path: breadcrumb trail [{lat,lng}]. All {lat,lng}; any can be null.
 */
export default function TrackingMap({ origin, destination, current, path = [], height = 420 }) {
  const points = [origin, destination, current].filter(Boolean);
  const center = destination || origin || { lat: 43.6534, lng: -79.3841 };

  return (
    <div className="map-frame" style={{ height }}>
      <MapContainer center={[center.lat, center.lng]} zoom={12} scrollWheelZoom={false} style={{ height: '100%' }}>
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <FitToPoints points={points} />

        {origin && (
          <Marker position={[origin.lat, origin.lng]} icon={storeIcon}>
            <Popup>Our warehouse</Popup>
          </Marker>
        )}
        {destination && (
          <Marker position={[destination.lat, destination.lng]} icon={homeIcon}>
            <Popup>Delivery address</Popup>
          </Marker>
        )}
        {path.length > 1 && (
          <Polyline positions={path.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#c8102e', weight: 4, opacity: 0.7 }} />
        )}
        {current && (
          <Marker position={[current.lat, current.lng]} icon={courierIcon} zIndexOffset={1000}>
            <Popup>Your courier is here</Popup>
          </Marker>
        )}
      </MapContainer>
      <ul className="map-legend">
        <li><span className="map-pin map-pin--store"><span /></span>Warehouse</li>
        <li><span className="map-pin map-pin--courier"><span /></span>Courier</li>
        <li><span className="map-pin map-pin--home"><span /></span>You</li>
      </ul>
    </div>
  );
}

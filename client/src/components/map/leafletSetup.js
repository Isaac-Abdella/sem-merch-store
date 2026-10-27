import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// Bundlers break Leaflet's default marker image paths; point them at the bundled files.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

export const TILE_URL = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION =
  import.meta.env.VITE_MAP_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const dotIcon = (className, label) =>
  L.divIcon({
    className: `map-pin ${className}`,
    html: `<span aria-label="${label}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

export const courierIcon = dotIcon('map-pin--courier', 'Courier');
export const storeIcon = dotIcon('map-pin--store', 'Store');
export const homeIcon = dotIcon('map-pin--home', 'Delivery address');

import { useCallback, useState } from 'react';

/**
 * Asks the browser for the user's position on demand (never automatically on page load).
 * Note: browsers only allow geolocation on https:// or http://localhost.
 */
export function useGeolocation() {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      const err = new Error('Your browser does not support location access');
      setError(err.message);
      return Promise.reject(err);
    }
    setLoading(true);
    setError(null);
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCoords(c);
          setLoading(false);
          resolve(c);
        },
        (err) => {
          const message = err.code === 1 ? 'Location permission was denied' : 'Could not get your location';
          setError(message);
          setLoading(false);
          reject(new Error(message));
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    });
  }, []);

  return { coords, error, loading, request };
}

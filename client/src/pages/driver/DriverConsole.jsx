import { useEffect, useRef, useState } from 'react';
import { getAssignedDeliveries, postLocation, updateDeliveryStatus } from '../../api/tracking';
import { getErrorMessage } from '../../api/axios';
import TrackingMap from '../../components/map/TrackingMap';
import { STATUS_LABELS, shortId } from '../../utils/orderStatus';

const SEND_EVERY_MS = 10000; // how often real GPS positions are sent
const SIM_STEPS = 20;
const SIM_INTERVAL_MS = 2000;

/**
 * Driver page: pick a delivery, then either share real GPS (phone) or simulate a drive
 * (great for testing the customer's live map from your desk).
 */
export default function DriverConsole() {
  const [deliveries, setDeliveries] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [current, setCurrent] = useState(null);
  const [path, setPath] = useState([]);
  const [mode, setMode] = useState('idle'); // idle | gps | simulating
  const [message, setMessage] = useState('');
  const watchRef = useRef(null);
  const timerRef = useRef(null);
  const lastSentRef = useRef(0);

  const load = () =>
    getAssignedDeliveries()
      .then((list) => {
        setDeliveries(list);
        setSelectedId((id) => id || list[0]?.orderId || null);
      })
      .catch((err) => setMessage(getErrorMessage(err)));

  useEffect(() => {
    load();
    return stopAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = deliveries.find((d) => d.orderId === selectedId);

  useEffect(() => {
    setCurrent(selected?.currentLocation || null);
    setPath(selected?.path || []);
  }, [selected]);

  function stopAll() {
    if (watchRef.current != null) navigator.geolocation?.clearWatch(watchRef.current);
    clearInterval(timerRef.current);
    watchRef.current = null;
    setMode('idle');
  }

  const send = async (coords) => {
    try {
      const res = await postLocation(selectedId, coords);
      setCurrent(coords);
      setPath((p) => [...p, coords]);
      setMessage(`Sent ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)} · ${STATUS_LABELS[res.status]}`);
    } catch (err) {
      setMessage(getErrorMessage(err));
      stopAll();
    }
  };

  const startGps = () => {
    if (!navigator.geolocation) return setMessage('This browser has no GPS access');
    stopAll();
    setMode('gps');
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSentRef.current < SEND_EVERY_MS) return; // throttle
        lastSentRef.current = now;
        send({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setMessage(err.message);
        stopAll();
      },
      { enableHighAccuracy: true }
    );
  };

  // Moves in a straight line from the warehouse (or last position) to the customer
  const startSimulation = () => {
    if (!selected?.destination) return;
    stopAll();
    setMode('simulating');
    const from = current || selected.origin;
    const to = selected.destination;
    let step = 1;
    timerRef.current = setInterval(() => {
      const t = step / SIM_STEPS;
      send({ lat: from.lat + (to.lat - from.lat) * t, lng: from.lng + (to.lng - from.lng) * t });
      step += 1;
      if (step > SIM_STEPS) stopAll();
    }, SIM_INTERVAL_MS);
  };

  const markDelivered = async () => {
    stopAll();
    try {
      await updateDeliveryStatus(selectedId, 'delivered', 'Left at the door');
      setMessage('Marked as delivered');
      setSelectedId(null);
      load();
    } catch (err) {
      setMessage(getErrorMessage(err));
    }
  };

  return (
    <div className="container">
      <h1>Deliveries</h1>
      {message && <p className="alert alert--info">{message}</p>}
      {!deliveries.length && <p className="muted">No active deliveries assigned to you. An admin assigns them from Admin → Orders.</p>}

      {deliveries.length > 0 && (
        <div className="two-col">
          <section>
            {selected && (
              <>
                <TrackingMap origin={selected.origin} destination={selected.destination} current={current} path={path} height={460} />
                <div className="button-row">
                  {mode === 'idle' ? (
                    <>
                      <button type="button" className="btn btn--primary" onClick={startGps}>Share live GPS</button>
                      <button type="button" className="btn" onClick={startSimulation}>Simulate drive</button>
                    </>
                  ) : (
                    <button type="button" className="btn" onClick={stopAll}>
                      Stop {mode === 'gps' ? 'sharing' : 'simulation'}
                    </button>
                  )}
                  <button type="button" className="btn btn--ghost" onClick={markDelivered}>Mark delivered</button>
                </div>
              </>
            )}
          </section>
          <aside>
            <ul className="delivery-list">
              {deliveries.map((d) => (
                <li key={d.orderId}>
                  <button
                    type="button"
                    className={`delivery-item ${d.orderId === selectedId ? 'delivery-item--active' : ''}`}
                    onClick={() => {
                      stopAll();
                      setSelectedId(d.orderId);
                    }}
                  >
                    <strong>{shortId(d.orderId)} · {d.customer}</strong>
                    <span>{d.address?.line1}, {d.address?.city}</span>
                    <span className="muted small">{STATUS_LABELS[d.status]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </div>
  );
}

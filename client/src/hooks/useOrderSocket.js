import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

/**
 * Subscribes to live tracking updates for one order.
 * onUpdate receives { orderId, status?, location?: {lat,lng}, note?, at }.
 */
export function useOrderSocket(orderId, onUpdate) {
  const [connected, setConnected] = useState(false);
  const handlerRef = useRef(onUpdate);
  handlerRef.current = onUpdate; // always call the latest callback without reconnecting

  useEffect(() => {
    if (!orderId) return undefined;
    // Empty URL = same origin (goes through the Vite proxy in development)
    const socket = io(import.meta.env.VITE_SOCKET_URL || undefined, { withCredentials: true });

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('order:subscribe', orderId, (ack) => {
        if (!ack?.ok) console.warn('Tracking subscription refused:', ack?.message);
      });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('tracking:update', (update) => handlerRef.current?.(update));

    return () => {
      socket.emit('order:unsubscribe', orderId);
      socket.disconnect();
    };
  }, [orderId]);

  return { connected };
}

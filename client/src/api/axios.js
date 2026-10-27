import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true, // send the httpOnly auth cookie
});

/** Human-readable message from an API error. */
export function getErrorMessage(err, fallback = 'Something went wrong') {
  return err?.response?.data?.message || err?.message || fallback;
}

/** { "address.postalCode": "Enter a valid…" } from a 400 validation response. */
export function getFieldErrors(err) {
  const list = err?.response?.data?.errors || [];
  return Object.fromEntries(list.map((e) => [e.path, e.message]));
}

/** Extra error fields such as code / distanceKm. */
export function getErrorData(err) {
  return err?.response?.data || {};
}

export default api;

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useGeolocation } from '../hooks/useGeolocation';
import { getErrorData, getErrorMessage } from '../api/axios';

export default function Login() {
  const { login } = useAuth();
  const { request: requestLocation, loading: locating } = useGeolocation();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const attempt = async (coords) => {
    const user = await login(email, password, coords);
    navigate(user.role === 'driver' ? '/driver' : from, { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await attempt();
    } catch (err) {
      const info = getErrorData(err);
      try {
        // Only happens when the server has STRICT_LOGIN_GEOFENCE=true
        if (info.code === 'LOCATION_REQUIRED') {
          await attempt(await requestLocation());
          return;
        }
        if (info.code === 'OUT_OF_SERVICE_AREA') {
          navigate('/out-of-service-area', { state: { distanceKm: info.distanceKm, message: info.message } });
          return;
        }
        setError(getErrorMessage(err));
      } catch (retryErr) {
        setError(getErrorMessage(retryErr));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container auth-card">
      <h1>Log in</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p className="alert alert--error">{error}</p>}
        <button type="submit" className="btn btn--primary btn--block" disabled={busy || locating}>
          {locating ? 'Checking your location…' : busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="muted">
        New here? <Link to="/register">Create an account</Link>
      </p>
      <details className="muted small">
        <summary>Test accounts (after running npm run seed)</summary>
        <p>customer@example.com / Customer123!<br />driver@example.com / Driver123!<br />admin@example.com / Admin123!</p>
      </details>
    </div>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getErrorData, getErrorMessage, getFieldErrors } from '../api/axios';
import AddressForm, { emptyAddress } from '../components/checkout/AddressForm';
import ServiceAreaMap from '../components/map/ServiceAreaMap';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [address, setAddress] = useState(emptyAddress);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setFieldErrors({});
    try {
      await register({ ...form, address });
      navigate('/', { replace: true });
    } catch (err) {
      const info = getErrorData(err);
      if (info.code === 'OUT_OF_SERVICE_AREA') {
        navigate('/out-of-service-area', { state: { distanceKm: info.distanceKm, message: info.message } });
        return;
      }
      setFieldErrors(getFieldErrors(err));
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container two-col">
      <section className="auth-card auth-card--wide">
        <h1>Create an account</h1>
        <form onSubmit={handleSubmit}>
          <label>
            Name
            <input value={form.name} onChange={set('name')} autoComplete="name" required />
            {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
            {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
          </label>
          <label>
            Password
            <input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" minLength={8} required />
            {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
          </label>
          <AddressForm value={address} onChange={setAddress} errors={fieldErrors} />
          {error && <p className="alert alert--error">{error}</p>}
          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="muted">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </section>
      <aside>
        <h3>Where we deliver</h3>
        <p className="muted small">Accounts are available for addresses within 25 km of downtown Toronto.</p>
        <ServiceAreaMap />
      </aside>
    </div>
  );
}

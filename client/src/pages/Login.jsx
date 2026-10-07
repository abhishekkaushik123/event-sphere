import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/login', form);
      signIn(data);
      navigate(data.user.role === 'admin' ? '/admin' : '/');
    } catch (err) {
      const d = err.response?.data;
      if (d?.needsVerification) {
        // Account exists but email was never verified: continue on the OTP screen.
        await api.post('/auth/resend-otp', { email: d.email }).catch(() => {});
        navigate('/verify', { state: { email: d.email } });
      } else {
        setError(errMsg(err));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card card">
      <h1>Welcome back</h1>
      <form onSubmit={submit} className="form">
        <label>Email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" /></label>
        <label>Password<input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="current-password" /></label>
        {error && <div className="alert alert-error">{error}</div>}
        <button className="btn btn-block" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <p className="muted small">New here? <Link to="/register">Create an account</Link></p>
    </div>
  );
}

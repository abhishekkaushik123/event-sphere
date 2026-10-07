import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api.js';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/register', form);
      navigate('/verify', { state: { email: data.email } });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card card">
      <h1>Create your account</h1>
      <p className="muted">We'll email a 6-digit code to verify your address.</p>
      <form onSubmit={submit} className="form">
        <label>Name<input required value={form.name} onChange={set('name')} autoComplete="name" /></label>
        <label>Email<input required type="email" value={form.email} onChange={set('email')} autoComplete="email" /></label>
        <label>Password<input required type="password" minLength={6} value={form.password} onChange={set('password')} autoComplete="new-password" /></label>
        {error && <div className="alert alert-error">{error}</div>}
        <button className="btn btn-block" disabled={busy}>{busy ? 'Creating…' : 'Sign up'}</button>
      </form>
      <p className="muted small">Already registered? <Link to="/login">Log in</Link></p>
    </div>
  );
}

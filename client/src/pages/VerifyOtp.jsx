import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

export default function VerifyOtp() {
  const { state } = useLocation();
  const email = state?.email;
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  // Resend button countdown (mirrors the server-side cooldown).
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (!email) return <Navigate to="/register" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { email, otp });
      signIn(data);
      navigate(data.user.role === 'admin' ? '/admin' : '/');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError('');
    setInfo('');
    try {
      const { data } = await api.post('/auth/resend-otp', { email });
      setInfo(data.message);
      setCooldown(60);
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <div className="auth-card card">
      <h1>Check your email</h1>
      <p className="muted">Enter the 6-digit code sent to <strong>{email}</strong>.</p>
      <form onSubmit={submit} className="form">
        <input
          className="otp-input"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          placeholder="••••••"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          required
          autoFocus
        />
        {error && <div className="alert alert-error">{error}</div>}
        {info && <div className="alert alert-ok">{info}</div>}
        <button className="btn btn-block" disabled={busy || otp.length !== 6}>{busy ? 'Verifying…' : 'Verify & continue'}</button>
      </form>
      <button className="btn btn-ghost btn-block" onClick={resend} disabled={cooldown > 0}>
        {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
      </button>
    </div>
  );
}

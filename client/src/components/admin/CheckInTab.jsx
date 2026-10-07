import { useState } from 'react';
import api, { errMsg, fmtDate } from '../../api.js';

// Venue-entrance screen: type (or scan with a USB/phone scanner that "types" the code) the ticket's booking code.
export default function CheckInTab() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null); // { ok, text, booking }
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const { data } = await api.post('/admin/checkin', { bookingCode: code });
      setResult({ ok: true, text: data.message, booking: data.booking });
      setCode('');
    } catch (err) {
      setResult({ ok: false, text: errMsg(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="checkin">
      <div className="card">
        <h2>Ticket check-in</h2>
        <p className="muted small">Enter the booking code shown under the attendee's QR ticket.</p>
        <form className="row gap" onSubmit={submit}>
          <input className="grow code-input" placeholder="ES-XXXXXXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoFocus required />
          <button className="btn" disabled={busy}>{busy ? 'Checking…' : 'Check in'}</button>
        </form>
      </div>

      {result && (
        <div className={`card result ${result.ok ? 'result-ok' : 'result-bad'}`}>
          <h3>{result.ok ? '✓ ' : '✕ '}{result.text}</h3>
          {result.booking && (
            <p className="small">
              {result.booking.user?.name} · {result.booking.seats} seat(s)<br />
              {result.booking.event?.title} — {fmtDate(result.booking.event?.date)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

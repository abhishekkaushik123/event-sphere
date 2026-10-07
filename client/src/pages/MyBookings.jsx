import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg, money, fmtDate } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';

function Timeline({ history }) {
  return (
    <ol className="timeline">
      {history.map((h, i) => (
        <li key={i}>
          <span className="tl-dot" />
          <div>
            <div className="small">{h.note}</div>
            <div className="muted tiny">{fmtDate(h.at)}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [payFor, setPayFor] = useState(null); // booking being paid
  const [method, setMethod] = useState('upi');
  const [ticket, setTicket] = useState(null); // { qr, booking }
  const [open, setOpen] = useState(null); // booking id with timeline expanded

  const load = useCallback(() => {
    api
      .get('/bookings/mine')
      .then((res) => setBookings(res.data.bookings))
      .catch((err) => setError(errMsg(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const run = async (fn, okMsg) => {
    setError('');
    setNotice('');
    try {
      await fn();
      if (okMsg) setNotice(okMsg);
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const pay = () =>
    run(async () => {
      await api.post(`/bookings/${payFor._id}/pay`, { method });
      setPayFor(null);
    }, 'Payment confirmed. Your ticket is ready.');

  const cancel = (b) => {
    if (!window.confirm('Cancel this booking?')) return;
    run(() => api.patch(`/bookings/${b._id}/cancel`), 'Booking cancelled.');
  };

  const showTicket = async (b) => {
    try {
      const { data } = await api.get(`/bookings/${b._id}/ticket`);
      setTicket(data);
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const downloadIcs = async (b) => {
    try {
      const res = await api.get(`/bookings/${b._id}/calendar`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${b.bookingCode}.ics`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const active = bookings.filter((b) => ['waitlisted', 'pending', 'approved'].includes(b.status)).length;
  const spent = bookings.filter((b) => b.paymentStatus === 'paid').reduce((s, b) => s + b.totalAmount, 0);

  if (loading) return <div className="center muted">Loading…</div>;

  return (
    <>
      <h1>My bookings</h1>
      <div className="stats">
        <div className="card stat"><span className="muted small">Active bookings</span><strong>{active}</strong></div>
        <div className="card stat"><span className="muted small">Total bookings</span><strong>{bookings.length}</strong></div>
        <div className="card stat"><span className="muted small">Total paid</span><strong>{money(spent)}</strong></div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-ok">{notice}</div>}

      {bookings.length === 0 ? (
        <div className="center muted">No bookings yet. <Link to="/">Browse events</Link></div>
      ) : (
        <div className="stack">
          {bookings.map((b) => (
            <div className="card booking" key={b._id}>
              <div className="row between wrap">
                <div>
                  <h3>{b.event.title}</h3>
                  <p className="muted small">{fmtDate(b.event.date)} · {b.event.venue}</p>
                  <p className="muted small">Code <code>{b.bookingCode}</code> · {b.seats} seat(s) · {money(b.totalAmount)}</p>
                </div>
                <div className="badges">
                  <StatusBadge status={b.status} />
                  {['paid', 'refunded'].includes(b.paymentStatus) && <StatusBadge status={b.paymentStatus} />}
                  {b.checkedIn && <span className="badge badge-paid">Checked in</span>}
                </div>
              </div>

              {b.status === 'waitlisted' && <div className="alert">You are #{b.waitlistPosition} on the waitlist. We'll email you when a seat opens.</div>}
              {b.status === 'pending' && <div className="alert">Waiting for admin approval.</div>}

              <div className="row gap wrap">
                {b.status === 'approved' && b.paymentStatus === 'unpaid' && (
                  <button className="btn" onClick={() => { setPayFor(b); setMethod('upi'); }}>Pay {money(b.totalAmount)}</button>
                )}
                {b.status === 'approved' && b.paymentStatus === 'paid' && (
                  <button className="btn" onClick={() => showTicket(b)}>Show QR ticket</button>
                )}
                {!['cancelled', 'rejected'].includes(b.status) && (
                  <button className="btn btn-ghost" onClick={() => downloadIcs(b)}>Add to calendar</button>
                )}
                {['waitlisted', 'pending', 'approved'].includes(b.status) && !b.checkedIn && (
                  <button className="btn btn-danger" onClick={() => cancel(b)}>Cancel</button>
                )}
                <button className="btn btn-ghost" onClick={() => setOpen(open === b._id ? null : b._id)}>
                  {open === b._id ? 'Hide' : 'Track'} status
                </button>
              </div>
              {open === b._id && <Timeline history={b.history} />}
            </div>
          ))}
        </div>
      )}

      {payFor && (
        <div className="modal-bg" onClick={() => setPayFor(null)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <h2>Confirm payment</h2>
            <p className="muted small">{payFor.event.title} · {payFor.seats} seat(s)</p>
            <div className="price">{money(payFor.totalAmount)}</div>
            <div className="radio-group">
              {[['upi', 'UPI'], ['card', 'Credit / debit card'], ['netbanking', 'Net banking']].map(([v, l]) => (
                <label key={v} className={method === v ? 'radio active' : 'radio'}>
                  <input type="radio" name="method" checked={method === v} onChange={() => setMethod(v)} /> {l}
                </label>
              ))}
            </div>
            <p className="muted tiny">Demo gateway: no real money is charged.</p>
            <div className="row gap">
              <button className="btn" onClick={pay}>Pay now</button>
              <button className="btn btn-ghost" onClick={() => setPayFor(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {ticket && (
        <div className="modal-bg" onClick={() => setTicket(null)}>
          <div className="modal card ticket" onClick={(e) => e.stopPropagation()}>
            <h2>{ticket.booking.event.title}</h2>
            <p className="muted small">{fmtDate(ticket.booking.event.date)}</p>
            <img src={ticket.qr} alt="Ticket QR code" />
            <code>{ticket.booking.bookingCode}</code>
            <p className="muted small">{ticket.booking.seats} seat(s) · show this at the entrance</p>
            <button className="btn btn-ghost" onClick={() => setTicket(null)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { errMsg, money, fmtDate } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [seats, setSeats] = useState(1);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/events/${id}`).then((res) => setData(res.data)).catch((err) => setError(errMsg(err)));
  }, [id]);

  if (error && !data) return <div className="alert alert-error">{error}</div>;
  if (!data) return <div className="center muted">Loading…</div>;

  const { event, waitlistCount } = data;
  const full = event.seatsLeft === 0;
  const maxSeats = full ? 5 : Math.min(5, event.seatsLeft);

  const book = async () => {
    if (!user) return navigate('/login');
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const res = await api.post('/bookings', { eventId: event._id, seats });
      setMsg(
        res.data.waitlisted
          ? 'You are on the waitlist. We will notify you if a seat opens up.'
          : 'Booking placed! Once the admin approves it you can pay from “My bookings”.'
      );
      const fresh = await api.get(`/events/${id}`);
      setData(fresh.data);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="detail">
      <div className="detail-main card">
        <div className="event-cover large" data-cat={event.category}>
          {event.imageUrl ? <img src={event.imageUrl} alt="" /> : <span>{event.category}</span>}
        </div>
        <h1>{event.title}</h1>
        <p className="muted">{fmtDate(event.date)} · {event.durationHours}h</p>
        <p className="muted">📍 {event.venue}</p>
        <p className="desc">{event.description}</p>
      </div>

      <aside className="detail-side card">
        <div className="price">{money(event.price)} <span className="muted small">per seat</span></div>
        <p className="muted small">
          {full
            ? `Sold out. ${waitlistCount} ${waitlistCount === 1 ? 'person is' : 'people are'} on the waitlist.`
            : `${event.seatsLeft} of ${event.capacity} seats left`}
        </p>

        {user?.role === 'admin' ? (
          <div className="alert">Admins manage events from the dashboard.</div>
        ) : (
          <>
            <label>Seats
              <select value={seats} onChange={(e) => setSeats(Number(e.target.value))}>
                {Array.from({ length: maxSeats }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}
              </select>
            </label>
            <div className="row between"><span className="muted">Total</span><strong>{money(event.price * seats)}</strong></div>
            <button className="btn btn-block" onClick={book} disabled={busy}>
              {busy ? 'Please wait…' : user ? (full ? 'Join waitlist' : 'Book now') : 'Log in to book'}
            </button>
          </>
        )}
        {error && <div className="alert alert-error">{error}</div>}
        {msg && <div className="alert alert-ok">{msg} <a href="/my-bookings">View bookings</a></div>}
      </aside>
    </div>
  );
}

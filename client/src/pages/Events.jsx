import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg, money, fmtDate } from '../api.js';

const CATEGORIES = ['All', 'Music', 'Tech', 'Sports', 'Workshop', 'Food', 'Art', 'Business', 'Other'];

function SeatsPill({ event }) {
  if (event.seatsLeft === 0) return <span className="pill pill-full">Sold out · waitlist open</span>;
  if (event.seatsLeft <= Math.max(3, event.capacity * 0.1)) return <span className="pill pill-low">Only {event.seatsLeft} left</span>;
  return <span className="pill">{event.seatsLeft} seats left</span>;
}

export default function Events() {
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Debounce typing so we do not call the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api
        .get('/events', { params: { search, category } })
        .then((res) => { setEvents(res.data.events); setError(''); })
        .catch((err) => setError(errMsg(err)))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [search, category]);

  return (
    <>
      <section className="hero">
        <h1>Find your next <em>unforgettable</em> event.</h1>
        <p className="muted">Book seats, get approved, pay securely and walk in with a QR ticket.</p>
        <div className="filters">
          <input placeholder="Search events, venues…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </section>

      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <div className="center muted">Loading events…</div>
      ) : events.length === 0 ? (
        <div className="center muted">No upcoming events match your search.</div>
      ) : (
        <div className="grid">
          {events.map((e) => (
            <Link to={`/events/${e._id}`} key={e._id} className="card event-card">
              <div className="event-cover" data-cat={e.category}>
                {e.imageUrl ? <img src={e.imageUrl} alt="" /> : <span>{e.category}</span>}
              </div>
              <div className="event-body">
                <h3>{e.title}</h3>
                <p className="muted small">{fmtDate(e.date)}</p>
                <p className="muted small">📍 {e.venue}</p>
                <div className="row between">
                  <strong>{money(e.price)}</strong>
                  <SeatsPill event={e} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

import { useCallback, useEffect, useState } from 'react';
import api, { errMsg, money, fmtDate } from '../../api.js';

const CATEGORIES = ['Music', 'Tech', 'Sports', 'Workshop', 'Food', 'Art', 'Business', 'Other'];
const EMPTY = { title: '', description: '', category: 'Tech', venue: '', date: '', durationHours: 2, price: 0, capacity: 50, imageUrl: '' };

// datetime-local needs "YYYY-MM-DDTHH:mm" in local time.
const toLocalInput = (d) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};

export default function EventsTab() {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(null); // null = closed
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    api.get('/events/admin/all').then((r) => setEvents(r.data.events)).catch((e) => setError(errMsg(e)));
  }, []);
  useEffect(load, [load]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const openNew = () => { setEditingId(null); setForm(EMPTY); setError(''); };
  const openEdit = (ev) => {
    setEditingId(ev._id);
    setForm({ ...ev, date: toLocalInput(ev.date) });
    setError('');
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const payload = {
      ...form,
      date: new Date(form.date).toISOString(),
      price: Number(form.price),
      capacity: Number(form.capacity),
      durationHours: Number(form.durationHours),
    };
    try {
      if (editingId) await api.put(`/events/${editingId}`, payload);
      else await api.post('/events', payload);
      setForm(null);
      setNotice(editingId ? 'Event updated.' : 'Event created.');
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const cancel = async (ev) => {
    if (!window.confirm(`Cancel "${ev.title}"? All open bookings will be cancelled and paid ones refunded.`)) return;
    try {
      const { data } = await api.delete(`/events/${ev._id}`);
      setNotice(data.message);
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <>
      <div className="row between">
        <h2>Events</h2>
        {!form && <button className="btn" onClick={openNew}>+ New event</button>}
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-ok">{notice}</div>}

      {form && (
        <form className="card form form-grid" onSubmit={save}>
          <label className="span2">Title<input required value={form.title} onChange={set('title')} /></label>
          <label className="span2">Description<textarea required rows={3} value={form.description} onChange={set('description')} /></label>
          <label>Category
            <select value={form.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <label>Venue<input required value={form.venue} onChange={set('venue')} /></label>
          <label>Date &amp; time<input required type="datetime-local" value={form.date} onChange={set('date')} /></label>
          <label>Duration (hours)<input type="number" step="0.5" min="0.5" value={form.durationHours} onChange={set('durationHours')} /></label>
          <label>Price per seat (₹, 0 = free)<input type="number" min="0" value={form.price} onChange={set('price')} /></label>
          <label>Capacity<input required type="number" min="1" value={form.capacity} onChange={set('capacity')} /></label>
          <label className="span2">Cover image URL (optional)<input value={form.imageUrl} onChange={set('imageUrl')} placeholder="https://…" /></label>
          <div className="row gap span2">
            <button className="btn">{editingId ? 'Save changes' : 'Create event'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Close</button>
          </div>
        </form>
      )}

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Event</th><th>Date</th><th>Price</th><th>Seats</th><th>Status</th><th /></tr></thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev._id}>
                <td>{ev.title}<div className="muted tiny">{ev.category} · {ev.venue}</div></td>
                <td>{fmtDate(ev.date)}</td>
                <td>{money(ev.price)}</td>
                <td>{ev.seatsTaken}/{ev.capacity}</td>
                <td><span className={ev.status === 'cancelled' ? 'badge badge-cancelled' : 'badge badge-approved'}>{ev.status}</span></td>
                <td className="actions">
                  {ev.status === 'published' && <button className="btn btn-sm btn-ghost" onClick={() => openEdit(ev)}>Edit</button>}
                  {ev.status === 'published' && <button className="btn btn-sm btn-danger" onClick={() => cancel(ev)}>Cancel</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

import { useCallback, useEffect, useState } from 'react';
import api, { errMsg, money, fmtDate } from '../../api.js';
import StatusBadge from '../StatusBadge.jsx';

const FILTERS = ['pending', 'approved', 'waitlisted', 'rejected', 'cancelled', 'all'];

export default function BookingsTab() {
  const [status, setStatus] = useState('pending');
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/admin/bookings', { params: status === 'all' ? {} : { status } })
      .then((r) => setBookings(r.data.bookings))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(load, [load]);

  const act = async (id, action) => {
    setError('');
    let body = {};
    if (action === 'reject') {
      const reason = window.prompt('Reason for rejection (shown to the user, optional):');
      if (reason === null) return;
      body = { reason };
    }
    try {
      await api.patch(`/admin/bookings/${id}/${action}`, body);
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  return (
    <>
      <div className="chips">
        {FILTERS.map((f) => (
          <button key={f} className={status === f ? 'chip active' : 'chip'} onClick={() => setStatus(f)}>{f}</button>
        ))}
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <div className="center muted">Loading…</div>
      ) : bookings.length === 0 ? (
        <div className="center muted">No {status === 'all' ? '' : status} bookings.</div>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>Code</th><th>User</th><th>Event</th><th>Seats</th><th>Amount</th><th>Status</th><th>Payment</th><th /></tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b._id}>
                  <td><code>{b.bookingCode}</code></td>
                  <td>{b.user?.name}<div className="muted tiny">{b.user?.email}</div></td>
                  <td>{b.event?.title}<div className="muted tiny">{b.event && fmtDate(b.event.date)}</div></td>
                  <td>{b.seats}</td>
                  <td>{money(b.totalAmount)}</td>
                  <td><StatusBadge status={b.status} /></td>
                  <td><StatusBadge status={b.paymentStatus} /></td>
                  <td className="actions">
                    {b.status === 'pending' && <button className="btn btn-sm" onClick={() => act(b._id, 'approve')}>Approve</button>}
                    {['pending', 'approved'].includes(b.status) && <button className="btn btn-sm btn-danger" onClick={() => act(b._id, 'reject')}>Reject</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

import { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import api, { errMsg, money } from '../../api.js';

const PIE_COLORS = ['#4f46e5', '#f97316', '#10b981', '#ef4444', '#64748b'];

export default function AnalyticsTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/analytics').then((r) => setData(r.data)).catch((e) => setError(errMsg(e)));
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <div className="center muted">Loading analytics…</div>;

  const { totals, monthly, byStatus, byCategory, topEvents } = data;
  const cards = [
    ['Revenue (paid)', money(totals.revenue)],
    ['Total bookings', totals.bookings],
    ['Pending approvals', totals.pendingApprovals],
    ['Live events', totals.events],
    ['Registered users', totals.users],
    ['Check-in rate', `${totals.checkInRate}%`],
  ];

  return (
    <>
      <div className="stats stats-6">
        {cards.map(([label, value]) => (
          <div className="card stat" key={label}><span className="muted small">{label}</span><strong>{value}</strong></div>
        ))}
      </div>

      <div className="charts">
        <div className="card">
          <h3>Revenue, last 6 months</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v, n) => (n === 'revenue' ? money(v) : v)} />
              <Bar dataKey="revenue" fill="#4f46e5" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>Bookings by status</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={byStatus} dataKey="count" nameKey="status" outerRadius={90} label={(e) => `${e.status} (${e.count})`}>
                {byStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>Tickets by category</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byCategory} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="category" width={80} />
              <Tooltip />
              <Bar dataKey="tickets" fill="#f97316" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>Most booked events (fill rate)</h3>
          {topEvents.length === 0 && <p className="muted small">No events yet.</p>}
          {topEvents.map((e) => (
            <div className="fill-row" key={e.id}>
              <div className="row between small"><span>{e.title}</span><span className="muted">{e.seatsTaken}/{e.capacity}</span></div>
              <div className="bar"><div className="bar-fill" style={{ width: `${e.fillRate}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

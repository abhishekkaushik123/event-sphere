import { useState } from 'react';
import AnalyticsTab from '../components/admin/AnalyticsTab.jsx';
import EventsTab from '../components/admin/EventsTab.jsx';
import BookingsTab from '../components/admin/BookingsTab.jsx';
import CheckInTab from '../components/admin/CheckInTab.jsx';

const TABS = [
  ['analytics', 'Analytics'],
  ['bookings', 'Booking approvals'],
  ['events', 'Manage events'],
  ['checkin', 'Check-in'],
];

export default function AdminDashboard() {
  const [tab, setTab] = useState('analytics');
  return (
    <>
      <h1>Admin dashboard</h1>
      <div className="tabs">
        {TABS.map(([k, label]) => (
          <button key={k} className={tab === k ? 'tab active' : 'tab'} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      {tab === 'analytics' && <AnalyticsTab />}
      {tab === 'bookings' && <BookingsTab />}
      {tab === 'events' && <EventsTab />}
      {tab === 'checkin' && <CheckInTab />}
    </>
  );
}

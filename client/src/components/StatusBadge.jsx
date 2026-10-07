const LABELS = {
  waitlisted: 'Waitlisted',
  pending: 'Awaiting approval',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  unpaid: 'Unpaid',
  paid: 'Paid',
  refunded: 'Refunded',
};

export default function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{LABELS[status] || status}</span>;
}

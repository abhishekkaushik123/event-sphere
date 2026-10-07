const Booking = require('../models/Booking');
const Event = require('../models/Event');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { addHistory, notify, closeBooking } = require('../services/bookingService');

// GET /api/admin/bookings?status=&eventId=
exports.listBookings = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.eventId) filter.event = req.query.eventId;
  const bookings = await Booking.find(filter)
    .populate('user', 'name email')
    .populate('event', 'title date venue')
    .sort({ createdAt: -1 });
  res.json({ bookings });
});

async function loadBooking(req, res) {
  const booking = await Booking.findById(req.params.id).populate('event', 'title date');
  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }
  return booking;
}

// PATCH /api/admin/bookings/:id/approve
exports.approve = asyncHandler(async (req, res) => {
  const booking = await loadBooking(req, res);
  if (booking.status !== 'pending') {
    res.status(400);
    throw new Error(`Only pending bookings can be approved (this one is ${booking.status})`);
  }
  booking.status = 'approved';
  addHistory(booking, 'approved', `Approved by ${req.user.name}`);
  await booking.save();
  await notify(
    booking.user,
    `Booking approved - ${booking.event.title}`,
    `Your booking ${booking.bookingCode} was approved. Please complete the payment of Rs. ${booking.totalAmount} from "My bookings" to get your ticket.`
  );
  res.json({ booking });
});

// PATCH /api/admin/bookings/:id/reject   { reason }
exports.reject = asyncHandler(async (req, res) => {
  const booking = await loadBooking(req, res);
  if (!['pending', 'approved'].includes(booking.status)) {
    res.status(400);
    throw new Error(`Only pending or approved bookings can be rejected (this one is ${booking.status})`);
  }
  const reason = req.body.reason ? ` Reason: ${req.body.reason}` : '';
  await closeBooking(booking, 'rejected', `Rejected by ${req.user.name}.${reason}`);
  await notify(
    booking.user,
    `Booking rejected - ${booking.event.title}`,
    `Unfortunately your booking ${booking.bookingCode} was rejected.${reason}`
  );
  res.json({ booking });
});

// POST /api/admin/checkin   { bookingCode }   - used at the venue entrance
exports.checkIn = asyncHandler(async (req, res) => {
  const code = String(req.body.bookingCode || '').trim().toUpperCase();
  const booking = await Booking.findOne({ bookingCode: code }).populate('user', 'name email').populate('event', 'title date venue');
  if (!booking) {
    res.status(404);
    throw new Error('Invalid ticket: booking code not found');
  }
  if (booking.status !== 'approved' || booking.paymentStatus !== 'paid') {
    res.status(400);
    throw new Error(`Ticket not valid: booking is ${booking.status}, payment ${booking.paymentStatus}`);
  }
  if (booking.checkedIn) {
    res.status(409);
    throw new Error(`Already checked in at ${booking.checkedInAt.toLocaleString()}`);
  }
  booking.checkedIn = true;
  booking.checkedInAt = new Date();
  addHistory(booking, 'approved', `Checked in by ${req.user.name}`);
  await booking.save();
  res.json({ message: 'Check-in successful', booking });
});

// GET /api/admin/analytics
exports.analytics = asyncHandler(async (req, res) => {
  const now = new Date();
  const since = new Date(now.getFullYear(), now.getMonth() - 5, 1); // start of month, 6 months back

  const [totalEvents, totalUsers, totalBookings, revenueAgg, monthlyAgg, statusAgg, categoryAgg, topEvents, paidCount, checkedInCount, pending] =
    await Promise.all([
      Event.countDocuments({ status: 'published' }),
      User.countDocuments({ role: 'user', isVerified: true }),
      Booking.countDocuments(),
      Booking.aggregate([{ $match: { paymentStatus: 'paid' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
      Booking.aggregate([
        { $match: { paymentStatus: 'paid', paidAt: { $gte: since } } },
        {
          $group: {
            _id: { y: { $year: '$paidAt' }, m: { $month: '$paidAt' } },
            revenue: { $sum: '$totalAmount' },
            tickets: { $sum: '$seats' },
          },
        },
      ]),
      Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Booking.aggregate([
        { $match: { status: { $in: ['pending', 'approved'] } } },
        { $lookup: { from: 'events', localField: 'event', foreignField: '_id', as: 'ev' } },
        { $unwind: '$ev' },
        { $group: { _id: '$ev.category', tickets: { $sum: '$seats' }, revenue: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totalAmount', 0] } } } },
        { $sort: { tickets: -1 } },
      ]),
      Event.find({ status: 'published' }).sort({ seatsTaken: -1 }).limit(5),
      Booking.countDocuments({ paymentStatus: 'paid', status: 'approved' }),
      Booking.countDocuments({ checkedIn: true }),
      Booking.countDocuments({ status: 'pending' }),
    ]);

  // Fill the last 6 months so months without sales show as 0 instead of disappearing.
  const monthly = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const hit = monthlyAgg.find((x) => x._id.y === d.getFullYear() && x._id.m === d.getMonth() + 1);
    monthly.push({
      month: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
      revenue: hit ? hit.revenue : 0,
      tickets: hit ? hit.tickets : 0,
    });
  }

  res.json({
    totals: {
      events: totalEvents,
      users: totalUsers,
      bookings: totalBookings,
      revenue: revenueAgg[0] ? revenueAgg[0].total : 0,
      pendingApprovals: pending,
      checkInRate: paidCount ? Math.round((checkedInCount / paidCount) * 100) : 0,
    },
    monthly,
    byStatus: statusAgg.map((s) => ({ status: s._id, count: s.count })),
    byCategory: categoryAgg.map((c) => ({ category: c._id, tickets: c.tickets, revenue: c.revenue })),
    topEvents: topEvents.map((e) => ({
      id: e._id,
      title: e.title,
      seatsTaken: e.seatsTaken,
      capacity: e.capacity,
      fillRate: Math.round((e.seatsTaken / e.capacity) * 100),
    })),
  });
});

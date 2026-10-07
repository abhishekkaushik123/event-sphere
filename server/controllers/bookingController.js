const crypto = require('crypto');
const QRCode = require('qrcode');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const asyncHandler = require('../utils/asyncHandler');
const paymentService = require('../utils/paymentService');
const { reserveSeats, addHistory, notify, closeBooking } = require('../services/bookingService');

const newCode = () => `ES-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

// Loads a booking and makes sure it belongs to the logged-in user.
async function ownBooking(req, res) {
  const booking = await Booking.findById(req.params.id).populate('event');
  if (!booking || String(booking.user) !== String(req.user._id)) {
    res.status(404);
    throw new Error('Booking not found');
  }
  return booking;
}

// POST /api/bookings   { eventId, seats }
exports.createBooking = asyncHandler(async (req, res) => {
  const seats = Number(req.body.seats);
  if (!Number.isInteger(seats) || seats < 1 || seats > 5) {
    res.status(400);
    throw new Error('You can book between 1 and 5 seats');
  }
  const event = await Event.findById(req.body.eventId);
  if (!event || event.status !== 'published') {
    res.status(404);
    throw new Error('Event not available');
  }
  if (event.date < new Date()) {
    res.status(400);
    throw new Error('This event has already taken place');
  }
  const existing = await Booking.findOne({ user: req.user._id, event: event._id, status: { $in: Booking.OPEN } });
  if (existing) {
    res.status(409);
    throw new Error('You already have an active booking for this event');
  }

  const totalAmount = event.price * seats;
  const held = await reserveSeats(event._id, seats);

  // No seats left -> join the waitlist instead of failing.
  const status = held ? 'pending' : 'waitlisted';
  const booking = await Booking.create({
    user: req.user._id,
    event: event._id,
    seats,
    totalAmount,
    bookingCode: newCode(),
    status,
    history: [
      {
        status,
        note: held ? 'Booking placed, waiting for admin approval' : 'Event is full - added to the waitlist',
      },
    ],
  });

  await notify(
    req.user._id,
    held ? `Booking received - ${event.title}` : `You're on the waitlist - ${event.title}`,
    held
      ? `Your booking ${booking.bookingCode} for "${event.title}" is waiting for approval.`
      : `"${event.title}" is full. You are on the waitlist (${booking.bookingCode}) and will be notified if a seat opens.`
  );
  res.status(201).json({ booking, waitlisted: !held });
});

// GET /api/bookings/mine
exports.myBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ user: req.user._id }).populate('event').sort({ createdAt: -1 }).lean();
  for (const b of bookings) {
    if (b.status === 'waitlisted') {
      b.waitlistPosition =
        (await Booking.countDocuments({ event: b.event._id, status: 'waitlisted', createdAt: { $lt: b.createdAt } })) + 1;
    }
  }
  res.json({ bookings });
});

// POST /api/bookings/:id/pay   { method }   - only for approved + unpaid bookings
exports.payBooking = asyncHandler(async (req, res) => {
  const booking = await ownBooking(req, res);
  if (booking.status !== 'approved') {
    res.status(400);
    throw new Error('Payment is only possible after the admin approves your booking');
  }
  if (booking.paymentStatus === 'paid') {
    res.status(400);
    throw new Error('This booking is already paid');
  }
  const result = await paymentService.charge({ amount: booking.totalAmount, method: req.body.method });
  if (!result.success) {
    res.status(400);
    throw new Error(result.message || 'Payment failed');
  }
  booking.paymentStatus = 'paid';
  booking.paymentMethod = req.body.method;
  booking.transactionId = result.transactionId;
  booking.paidAt = new Date();
  addHistory(booking, 'approved', `Payment confirmed (${result.transactionId})`);
  await booking.save();

  await notify(
    req.user._id,
    `Payment confirmed - ${booking.event.title}`,
    `We received Rs. ${booking.totalAmount} for "${booking.event.title}".\nTransaction: ${result.transactionId}\nBooking code: ${booking.bookingCode}\nOpen "My bookings" to get your QR ticket.`
  );
  res.json({ booking });
});

// PATCH /api/bookings/:id/cancel
exports.cancelBooking = asyncHandler(async (req, res) => {
  const booking = await ownBooking(req, res);
  if (!Booking.OPEN.includes(booking.status)) {
    res.status(400);
    throw new Error(`A ${booking.status} booking cannot be cancelled`);
  }
  if (booking.checkedIn) {
    res.status(400);
    throw new Error('You have already checked in');
  }
  await closeBooking(booking, 'cancelled', 'Cancelled by the user.');
  res.json({ booking });
});

// GET /api/bookings/:id/ticket  - QR ticket, only for paid bookings
exports.ticket = asyncHandler(async (req, res) => {
  const booking = await ownBooking(req, res);
  if (booking.status !== 'approved' || booking.paymentStatus !== 'paid') {
    res.status(400);
    throw new Error('Your ticket is available once the booking is approved and paid');
  }
  const qr = await QRCode.toDataURL(booking.bookingCode, { margin: 1, width: 280 });
  res.json({ qr, booking });
});

// GET /api/bookings/:id/calendar  - downloadable .ics file ("Add to calendar")
exports.calendar = asyncHandler(async (req, res) => {
  const booking = await ownBooking(req, res);
  if (booking.status === 'cancelled' || booking.status === 'rejected') {
    res.status(400);
    throw new Error('No calendar entry for this booking');
  }
  const e = booking.event;
  const fmt = (d) => new Date(d).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const end = new Date(new Date(e.date).getTime() + (e.durationHours || 2) * 3600 * 1000);
  const esc = (s) => String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Event Sphere//EN',
    'BEGIN:VEVENT',
    `UID:${booking.bookingCode}@eventsphere`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(e.date)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(e.title)}`,
    `LOCATION:${esc(e.venue)}`,
    `DESCRIPTION:${esc(`Booking ${booking.bookingCode} - ${booking.seats} seat(s)`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${booking.bookingCode}.ics"`);
  res.send(ics);
});

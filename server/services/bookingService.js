const Event = require('../models/Event');
const Booking = require('../models/Booking');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const paymentService = require('../utils/paymentService');

/**
 * Atomically reserves seats. The capacity check and the increment happen in ONE
 * database operation, so two people booking the last seat at the same time can never
 * both succeed (no read-then-write race, no overbooking).
 */
async function reserveSeats(eventId, seats) {
  const updated = await Event.findOneAndUpdate(
    {
      _id: eventId,
      status: 'published',
      $expr: { $lte: [{ $add: ['$seatsTaken', seats] }, '$capacity'] },
    },
    { $inc: { seatsTaken: seats } },
    { new: true }
  );
  return updated; // null => not enough seats
}

async function releaseSeats(eventId, seats) {
  await Event.updateOne({ _id: eventId, seatsTaken: { $gte: seats } }, { $inc: { seatsTaken: -seats } });
}

function addHistory(booking, status, note) {
  booking.history.push({ status, note, at: new Date() });
}

async function notify(userId, subject, text) {
  const user = await User.findById(userId);
  if (user) await sendEmail({ to: user.email, subject, text });
}

/**
 * Waitlist auto-promotion (strict FIFO).
 * Whenever seats are released, walk the waitlist in order of joining and move each
 * booking that now fits to "pending". Stops at the first one that does not fit so a
 * big group at the front of the queue is not starved by smaller later requests.
 */
async function promoteWaitlist(eventId) {
  const promoted = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const next = await Booking.findOne({ event: eventId, status: 'waitlisted' }).sort({ createdAt: 1 });
    if (!next) break;
    const event = await reserveSeats(eventId, next.seats);
    if (!event) break;
    next.status = 'pending';
    addHistory(next, 'pending', 'Promoted from waitlist - a seat opened up');
    await next.save();
    promoted.push(next);
    await notify(
      next.user,
      `A seat opened up for "${event.title}"`,
      `Good news! You were moved off the waitlist for "${event.title}".\nBooking code: ${next.bookingCode}\nYour booking is now waiting for admin approval.`
    );
  }
  return promoted;
}

/**
 * Cancels/rejects a booking: frees its seats (if it held any), refunds a paid booking,
 * then promotes people from the waitlist.
 */
async function closeBooking(booking, newStatus, note) {
  const heldSeats = Booking.SEAT_HOLDING.includes(booking.status);
  booking.status = newStatus;

  if (booking.paymentStatus === 'paid') {
    await paymentService.refund({ transactionId: booking.transactionId, amount: booking.totalAmount });
    booking.paymentStatus = 'refunded';
    note = `${note} Payment refunded.`;
  }
  addHistory(booking, newStatus, note);
  await booking.save();

  if (heldSeats) {
    await releaseSeats(booking.event, booking.seats);
    await promoteWaitlist(booking.event);
  }
  return booking;
}

module.exports = { reserveSeats, releaseSeats, addHistory, notify, promoteWaitlist, closeBooking };

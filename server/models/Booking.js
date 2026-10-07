const mongoose = require('mongoose');

const historySchema = new mongoose.Schema(
  {
    status: String,
    note: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    seats: { type: Number, required: true, min: 1, max: 5 },
    totalAmount: { type: Number, required: true, min: 0 },
    bookingCode: { type: String, unique: true, required: true },

    // Approval workflow:  waitlisted -> pending -> approved | rejected   (cancelled from any open state)
    status: {
      type: String,
      enum: ['waitlisted', 'pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' },
    paymentMethod: String,
    transactionId: String,
    paidAt: Date,

    checkedIn: { type: Boolean, default: false },
    checkedInAt: Date,

    // Booking tracking: every state change is appended here.
    history: [historySchema],
  },
  { timestamps: true }
);

// A booking that currently holds seats on the event.
bookingSchema.statics.SEAT_HOLDING = ['pending', 'approved'];
bookingSchema.statics.OPEN = ['waitlisted', 'pending', 'approved'];

module.exports = mongoose.model('Booking', bookingSchema);

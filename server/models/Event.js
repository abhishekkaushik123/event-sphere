const mongoose = require('mongoose');

const CATEGORIES = ['Music', 'Tech', 'Sports', 'Workshop', 'Food', 'Art', 'Business', 'Other'];

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 120 },
    description: { type: String, required: [true, 'Description is required'], trim: true },
    category: { type: String, enum: CATEGORIES, default: 'Other' },
    venue: { type: String, required: [true, 'Venue is required'], trim: true },
    date: { type: Date, required: [true, 'Date is required'] },
    durationHours: { type: Number, default: 2, min: 0.5, max: 72 },
    price: { type: Number, required: true, min: 0, default: 0 },
    capacity: { type: Number, required: true, min: 1 },
    // Seats currently held by pending/approved bookings. Only ever changed with atomic $inc.
    seatsTaken: { type: Number, default: 0, min: 0 },
    imageUrl: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['published', 'cancelled'], default: 'published' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

eventSchema.virtual('seatsLeft').get(function () {
  return Math.max(0, this.capacity - this.seatsTaken);
});

eventSchema.index({ date: 1, status: 1 });
eventSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Event', eventSchema);
module.exports.CATEGORIES = CATEGORIES;

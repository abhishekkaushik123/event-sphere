const Event = require('../models/Event');
const Booking = require('../models/Booking');
const asyncHandler = require('../utils/asyncHandler');
const { closeBooking } = require('../services/bookingService');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Fields an admin is allowed to set (whitelist prevents mass-assignment of seatsTaken, status, etc.)
const pick = (body) => {
  const out = {};
  ['title', 'description', 'category', 'venue', 'date', 'durationHours', 'price', 'capacity', 'imageUrl'].forEach((k) => {
    if (body[k] !== undefined) out[k] = body[k];
  });
  return out;
};

// GET /api/events   (public) ?search=&category=&past=true
exports.listEvents = asyncHandler(async (req, res) => {
  const { search, category, past } = req.query;
  const filter = { status: 'published' };
  if (past !== 'true') filter.date = { $gte: new Date() };
  if (category && category !== 'All') filter.category = category;
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ title: rx }, { venue: rx }, { description: rx }];
  }
  const events = await Event.find(filter).sort({ date: 1 });
  res.json({ events });
});

// GET /api/events/:id   (public)
exports.getEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) {
    res.status(404);
    throw new Error('Event not found');
  }
  const waitlistCount = await Booking.countDocuments({ event: event._id, status: 'waitlisted' });
  res.json({ event, waitlistCount });
});

// GET /api/events/admin/all   (admin)  - includes past + cancelled events
exports.listAllEvents = asyncHandler(async (req, res) => {
  const events = await Event.find().sort({ date: -1 });
  res.json({ events });
});

// POST /api/events   (admin)
exports.createEvent = asyncHandler(async (req, res) => {
  const event = await Event.create({ ...pick(req.body), createdBy: req.user._id });
  res.status(201).json({ event });
});

// PUT /api/events/:id   (admin)
exports.updateEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) {
    res.status(404);
    throw new Error('Event not found');
  }
  const data = pick(req.body);
  if (data.capacity !== undefined && Number(data.capacity) < event.seatsTaken) {
    res.status(400);
    throw new Error(`Capacity cannot be lower than the ${event.seatsTaken} seats already booked`);
  }
  Object.assign(event, data);
  await event.save();
  res.json({ event });
});

// DELETE /api/events/:id   (admin) - soft-cancel: keeps history, cancels + refunds all open bookings
exports.cancelEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) {
    res.status(404);
    throw new Error('Event not found');
  }
  event.status = 'cancelled';
  await event.save();

  const open = await Booking.find({ event: event._id, status: { $in: Booking.OPEN } });
  for (const b of open) {
    await closeBooking(b, 'cancelled', 'Event was cancelled by the organiser.');
  }
  res.json({ message: `Event cancelled. ${open.length} booking(s) were cancelled and refunded where paid.` });
});

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const Event = require('./models/Event');

const days = (n, hour = 18) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const events = [
  { title: 'Neon Nights Live', category: 'Music', venue: 'Rock Garden Arena, Chandigarh', date: days(12, 19), durationHours: 4, price: 799, capacity: 150, description: 'An evening of indie and electronic acts with a full light show.' },
  { title: 'Full Stack Summit 2026', category: 'Tech', venue: 'NITJ Auditorium, Jalandhar', date: days(20, 10), durationHours: 8, price: 299, capacity: 200, description: 'Talks and live demos on MERN, system design and cloud deployment.' },
  { title: 'Sunrise Half Marathon', category: 'Sports', venue: 'Sukhna Lake, Chandigarh', date: days(30, 6), durationHours: 4, price: 499, capacity: 300, description: 'A 21 km community run with timing chips and finisher medals.' },
  { title: 'Pottery & Chai Workshop', category: 'Workshop', venue: 'Clay Studio, Sector 17', date: days(7, 16), durationHours: 3, price: 650, capacity: 12, description: 'Hands-on wheel-throwing session for beginners. Tiny batch, so seats go fast.' },
  { title: 'Street Food Carnival', category: 'Food', venue: 'Leisure Valley Ground', date: days(15, 12), durationHours: 8, price: 99, capacity: 500, description: '40+ food stalls, live cooking battles and a dessert zone.' },
  { title: 'Startup Pitch Night', category: 'Business', venue: 'Innovation Hub, Mohali', date: days(25, 17), durationHours: 3, price: 0, capacity: 80, description: 'Ten student startups pitch to angel investors. Free entry with approval.' },
];

(async () => {
  try {
    await connectDB();

    const email = (process.env.ADMIN_EMAIL || 'admin@eventsphere.com').toLowerCase();
    let admin = await User.findOne({ email });
    if (!admin) {
      admin = await User.create({
        name: 'Event Sphere Admin',
        email,
        password: process.env.ADMIN_PASSWORD || 'Admin@123',
        role: 'admin',
        isVerified: true,
      });
      console.log(`Admin created: ${email}`);
    } else {
      console.log(`Admin already exists: ${email}`);
    }

    if ((await Event.countDocuments()) === 0) {
      await Event.insertMany(events.map((e) => ({ ...e, createdBy: admin._id })));
      console.log(`Inserted ${events.length} sample events`);
    } else {
      console.log('Events already exist - skipping sample events');
    }
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();

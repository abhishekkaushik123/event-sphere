# Event Sphere – MERN Event Booking Platform

A full-stack event booking platform: browse events, book seats, get admin approval, pay, receive a QR ticket and check in at the venue.

**Stack:** MongoDB · Express · React (Vite) · Node.js · JWT · Nodemailer · Recharts

---

## 1. Resume claims

| Resume claim | Implementation |
|---|---|
| Secure JWT authentication | `server/controllers/authController.js`, `server/middleware/auth.js` (bcrypt password hashing, signed JWT, `protect` middleware) |
| Email OTP verification | `authController.js` + `utils/otp.js` + `utils/sendEmail.js` (hashed OTP, expiry, attempt limit, resend cooldown) |
| Role-based dashboards (user / admin) | `middleware/auth.js → authorize('admin')`, `client/src/App.jsx → <Protected role>`, `pages/MyBookings.jsx`, `pages/AdminDashboard.jsx` |
| Event management | `controllers/eventController.js`, `components/admin/EventsTab.jsx` |
| Booking approval workflow | `controllers/adminController.js` (approve / reject), `components/admin/BookingsTab.jsx` |
| Booking tracking | `Booking.history[]` audit trail + "Track status" timeline in `MyBookings.jsx` |
| Payment confirmation | `controllers/bookingController.js → payBooking`, `utils/paymentService.js` |
| Analytics dashboard | `adminController.js → analytics` (MongoDB aggregation pipelines), `components/admin/AnalyticsTab.jsx` |
| Responsive UI | `client/src/styles.css` (CSS grid + media queries) |

## 2. What makes it different from a typical booking clone

1. **Race-condition-proof seat booking.** Capacity check + seat increment is a single atomic MongoDB `findOneAndUpdate` with `$expr`. Two people grabbing the last seat can never both succeed. (`services/bookingService.js → reserveSeats`)
2. **Waitlist with automatic FIFO promotion.** When an event is full users join a waitlist and see their position. Any cancel/reject frees seats and the next people in line are promoted and emailed automatically. (`promoteWaitlist`)
3. **QR-code tickets + venue check-in.** After payment the user gets a QR ticket; admins validate it at the entrance. A ticket cannot be used twice, and unpaid/cancelled bookings are refused. (`ticket` + `checkIn`)
4. **Add-to-calendar (.ics) export** for every booking.
5. **Full booking audit trail.** Every state change (placed → approved → paid → checked in) is timestamped and shown to the user as a timeline.
6. **Safe cancellations.** Cancelling/rejecting a paid booking auto-refunds it; cancelling an event cascades to all its bookings.
7. **Hardened OTP flow.** OTP stored only as an HMAC hash, constant-time comparison, 5-attempt lockout, 60 s resend cooldown, rate limiting, and a resend endpoint that doesn't reveal whether an email is registered.
8. **Pluggable payment gateway.** The app depends only on `charge()`/`refund()` in `paymentService.js`; Razorpay/Stripe can replace the simulated one without changing the rest.

## 3. Booking state machine

```
            seats free                       admin approves                user pays
 (book) ───────────────► pending ─────────────────────────► approved ─────────────► approved + PAID ──► QR ticket ──► checked in
    │                       │  ▲                                 │
    │ event full            │  │ promoted from waitlist          │
    ▼                       ▼  │                                 ▼
 waitlisted ──────────► cancelled / rejected  (seats released, refund if paid, next waitlisted user promoted)
```

- **Admin login (from seed):** `admin@eventsphere.com` / `Admin@123` (change in `.env` before seeding)
- **OTP emails:** with `SMTP_HOST` empty, emails are **printed in the server terminal**. For real email, fill the SMTP fields (a Gmail app password works).
- Users always register as `user`; the only way to get an admin is the seed script, so nobody can self-promote.

**Quick demo script:** register a user → copy the OTP from the server console → book an event → log in as admin → approve → log back in as user → pay → open QR ticket → admin Check-in tab → enter the code. Then book a tiny event (Pottery workshop, 12 seats) with several accounts to see the waitlist.

## 4. API reference

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | public | Create account, email OTP |
| POST | `/api/auth/verify-otp` | public | Verify OTP, returns JWT |
| POST | `/api/auth/resend-otp` | public | New OTP (60 s cooldown) |
| POST | `/api/auth/login` | public | Login (verified users only) |
| GET | `/api/auth/me` | user | Current user |
| GET | `/api/events` | public | List/search/filter upcoming events |
| GET | `/api/events/:id` | public | Event details + waitlist size |
| GET | `/api/events/admin/all` | admin | All events incl. past/cancelled |
| POST/PUT/DELETE | `/api/events[/:id]` | admin | Create / edit / cancel event |
| POST | `/api/bookings` | user | Book seats (or join waitlist) |
| GET | `/api/bookings/mine` | user | My bookings + waitlist position |
| POST | `/api/bookings/:id/pay` | user | Pay an approved booking |
| PATCH | `/api/bookings/:id/cancel` | user | Cancel (refund if paid) |
| GET | `/api/bookings/:id/ticket` | user | QR ticket (paid only) |
| GET | `/api/bookings/:id/calendar` | user | `.ics` calendar file |
| GET | `/api/admin/bookings` | admin | All bookings, filter by status |
| PATCH | `/api/admin/bookings/:id/approve` \| `reject` | admin | Approval workflow |
| POST | `/api/admin/checkin` | admin | Validate ticket at entrance |
| GET | `/api/admin/analytics` | admin | Dashboard metrics |


- **Payment is simulated** (clearly labeled in the UI). Don't claim a live gateway integration in the interview unless you add one.
- This was written as a complete working codebase, but dependency installation was blocked in the build environment, so it has **not been run end-to-end yet**. Do `npm install` in both folders, run through the demo script in section 4, and fix anything that surfaces *before* the interview, so you can speak from experience.
- Possible next features if you want more depth: camera-based QR scanning, Razorpay integration, pagination, refresh tokens, Jest tests.

# Event Sphere – MERN Event Booking Platform

A full-stack event booking platform: browse events, book seats, get admin approval, pay, receive a QR ticket and check in at the venue.

**Stack:** MongoDB · Express · React (Vite) · Node.js · JWT · Nodemailer · Recharts

---

## 1. Resume claims → where they live in the code

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

## 4. Run it locally

**Prerequisites:** Node.js 18+, MongoDB running locally (or a MongoDB Atlas URI).

```bash
# Backend
cd server
cp .env.example .env        # then set JWT_SECRET (and MONGO_URI if using Atlas)
npm install
npm run seed                # creates the admin account + 6 sample events
npm run dev                 # API on http://localhost:5000

# Frontend (new terminal)
cd client
npm install
npm run dev                 # app on http://localhost:5173
```

- **Admin login (from seed):** `admin@eventsphere.com` / `Admin@123` (change in `.env` before seeding)
- **OTP emails:** with `SMTP_HOST` empty, emails are **printed in the server terminal**. For real email, fill the SMTP fields (a Gmail app password works).
- Users always register as `user`; the only way to get an admin is the seed script, so nobody can self-promote.

**Quick demo script:** register a user → copy the OTP from the server console → book an event → log in as admin → approve → log back in as user → pay → open QR ticket → admin Check-in tab → enter the code. Then book a tiny event (Pottery workshop, 12 seats) with several accounts to see the waitlist.

## 5. API reference

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

---

## 6. Step-by-step: how the project was built (your interview walkthrough)

Explain it in this order. Each step says **what you did** and **why**.

### Phase A – Planning
1. **Define requirements from the resume line.** Two roles (user, admin); flows: sign-up with OTP → browse → book → approval → payment → ticket; admin: events, approvals, analytics.
2. **Design the data model.** Three collections: `User`, `Event`, `Booking`. *Why separate Booking from Event:* a booking has its own lifecycle (status, payment, check-in, history) and one event has many bookings.
3. **Design the booking state machine** (section 3 above) before writing code, so approval/payment/cancel rules are consistent.
4. **Pick the folder structure:** `server/` (routes → controllers → services → models) and `client/` (pages, components, context). *Why:* separation of concerns, easy to test and explain.

### Phase B – Backend setup
5. **Initialise Node project**, install `express`, `mongoose`, `bcryptjs`, `jsonwebtoken`, `dotenv`, `cors`, `helmet`, `express-rate-limit`, `nodemailer`, `qrcode`.
6. **Connect MongoDB** with Mongoose (`config/db.js`); secrets in `.env`, never committed.
7. **Create `server.js`:** middleware order is `helmet` → `cors` → `express.json` → routes → `notFound` → central `errorHandler`.
8. **Central error handling + `asyncHandler`** so every controller error returns one consistent JSON shape (validation, bad ObjectId, duplicate key).

### Phase C – Authentication & security
9. **User model** with password hashing in a `pre('save')` hook (bcrypt, 10 rounds); `password` is `select:false` so it never leaks in queries.
10. **Registration:** validate input, create an *unverified* user, generate OTP.
11. **OTP generation:** `crypto.randomInt` (cryptographically secure). Store only an **HMAC-SHA256 hash** plus expiry, attempt counter and last-sent time.
12. **Email sending:** Nodemailer SMTP; in dev falls back to console so the flow is testable without an email account.
13. **OTP verification:** check expiry, lock after 5 wrong attempts, compare with `timingSafeEqual`, then mark verified and issue a JWT.
14. **Resend OTP** with 60 s cooldown and a non-revealing response.
15. **Login:** compare bcrypt hash; unverified users are redirected to OTP; return a signed JWT (payload: id, role; expiry 7d).
16. **`protect` middleware** verifies the Bearer token and loads the user; **`authorize('admin')`** implements role-based access control.
17. **Hardening:** `helmet` headers, CORS restricted to the client origin, rate limiting on auth routes, role never accepted from the request body (no privilege escalation), field whitelisting on event updates.

### Phase D – Events & bookings
18. **Event CRUD** (admin only) with search/category filtering (regex escaped to prevent regex injection) for the public list.
19. **Atomic seat reservation:** one `findOneAndUpdate` checks `seatsTaken + seats <= capacity` and increments in the same operation. *Interview point:* a read-then-write would allow overbooking under concurrent requests.
20. **Create booking:** validate seats (1–5), event not past, no duplicate active booking; reserve seats → `pending`; if full → `waitlisted`.
21. **Approval workflow:** admin approves (`pending → approved`) or rejects (frees seats).
22. **Payment:** only allowed for approved + unpaid bookings, through `paymentService.charge()`; stores transaction id, marks `paid`, emails confirmation.
23. **Cancellation/refund logic** in one function (`closeBooking`): free seats, refund if paid, then run waitlist promotion. Reused by user-cancel, admin-reject and event-cancel, so behaviour is identical everywhere.
24. **Waitlist auto-promotion** (strict FIFO) whenever seats are released.
25. **Booking history** array appended on every transition → powers the tracking timeline.
26. **QR ticket** (`qrcode` library) available only when approved + paid; **`.ics` calendar** download.
27. **Check-in endpoint:** validates code, status, payment, and prevents double entry.

### Phase E – Analytics
28. **Aggregation pipelines:** `$group` for revenue and per-month sales, `$lookup` + `$group` to join bookings with events for category stats, `$match` for filtering; gaps in months are filled in code so charts show zeros.
29. Metrics: revenue, bookings, pending approvals, users, live events, **check-in rate**, status breakdown, tickets per category, fill rate of top events.

### Phase F – Frontend
30. **Scaffold React with Vite**; dev proxy sends `/api` to the Express server (no CORS trouble in dev).
31. **Axios instance** with an interceptor that attaches the JWT and logs the user out on a 401.
32. **`AuthContext`:** holds the user, restores the session from the saved token on refresh, exposes `signIn/logout`.
33. **React Router with a `Protected` wrapper** checking login and role (the server still enforces permissions independently; client checks are only UX).
34. **Pages:** Register → VerifyOtp (countdown resend) → Login; Events (debounced search, category filter, "only N left"/"sold out" indicators); EventDetail (seat picker, total, book or join waitlist).
35. **User dashboard:** stats, booking cards with status badges, pay modal, QR ticket modal, cancel, calendar download, status timeline.
36. **Admin dashboard (tabs):** Analytics (Recharts), Booking approvals (filter + approve/reject with reason), Manage events (create/edit/cancel), Check-in.
37. **Responsive CSS:** CSS variables, grid layouts, breakpoints at 800 px.

### Phase G – Deployment (how you'd ship it)
38. Database → MongoDB Atlas; API → Render/Railway (set env vars); client → `npm run build` → Vercel/Netlify with `VITE_`/proxy replaced by the API URL; set `CLIENT_URL` for CORS.

---

## 7. Likely interview questions (with short answers)

**Why JWT instead of sessions?** Stateless, scales horizontally, works well with a separate React SPA. Trade-off: can't be revoked before expiry without a blocklist, so I keep expiry modest and re-check the user on each request.

**Where do you store the JWT? Any risk?** In `localStorage` for simplicity; the risk is XSS. A more secure production option is an `httpOnly`, `Secure`, `SameSite` cookie plus CSRF protection.

**How does OTP verification work securely?** Secure random 6 digits, stored only as an HMAC hash, 10-min expiry, 5-attempt lockout, constant-time comparison, resend cooldown, rate limiting.

**How do you prevent overbooking?** Atomic conditional update: the capacity check and increment happen in one MongoDB operation, so concurrent requests can't both pass the check.

**What if the server crashes between reserving seats and creating the booking?** Seats could stay held. Production fix: MongoDB multi-document transactions (needs a replica set, which Atlas provides) or a cleanup job that reconciles `seatsTaken` against active bookings. *(Know this limitation — it shows depth.)*

**How does role-based access work?** Role is stored on the user and signed into the JWT; `authorize('admin')` middleware guards admin routes server-side; React route guards only improve UX.

**How does the waitlist work?** Bookings with status `waitlisted`, ordered by `createdAt`. Seat release triggers `promoteWaitlist`, which reserves seats atomically for each next booking until one doesn't fit.

**Why MongoDB aggregation for analytics?** Computation happens in the database instead of loading all documents into Node; `$group`, `$lookup`, and `$match` scale better and keep the API fast.

**Is the payment real?** Be upfront: it's a **simulated gateway** for the project, isolated behind `paymentService`. For production I'd integrate Razorpay/Stripe, create the order server-side, verify the payment signature/webhook, and mark `paid` only from that verified server callback.

**How would you scale it?** Index hot queries (done on event date/status, booking user/event/status), cache the public events list, move emails to a queue (BullMQ), add pagination, and use Redis-backed rate limiting.

**How would you test it?** Jest + Supertest with an in-memory MongoDB for the booking concurrency, OTP and approval flows; React Testing Library for forms.

## 8. Honest notes

- **Payment is simulated** (clearly labeled in the UI). Don't claim a live gateway integration in the interview unless you add one.
- This was written as a complete working codebase, but dependency installation was blocked in the build environment, so it has **not been run end-to-end yet**. Do `npm install` in both folders, run through the demo script in section 4, and fix anything that surfaces *before* the interview, so you can speak from experience.
- Possible next features if you want more depth: camera-based QR scanning, Razorpay integration, pagination, refresh tokens, Jest tests.

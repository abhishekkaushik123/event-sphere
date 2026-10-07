const router = require('express').Router();
const c = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/bookings', c.listBookings);
router.patch('/bookings/:id/approve', c.approve);
router.patch('/bookings/:id/reject', c.reject);
router.post('/checkin', c.checkIn);
router.get('/analytics', c.analytics);

module.exports = router;

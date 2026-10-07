const router = require('express').Router();
const c = require('../controllers/bookingController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/', c.createBooking);
router.get('/mine', c.myBookings);
router.post('/:id/pay', c.payBooking);
router.patch('/:id/cancel', c.cancelBooking);
router.get('/:id/ticket', c.ticket);
router.get('/:id/calendar', c.calendar);

module.exports = router;

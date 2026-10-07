const router = require('express').Router();
const c = require('../controllers/eventController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', c.listEvents);
// Must be declared before "/:id" or "admin" would be treated as an id.
router.get('/admin/all', protect, authorize('admin'), c.listAllEvents);
router.get('/:id', c.getEvent);

router.post('/', protect, authorize('admin'), c.createEvent);
router.put('/:id', protect, authorize('admin'), c.updateEvent);
router.delete('/:id', protect, authorize('admin'), c.cancelEvent);

module.exports = router;

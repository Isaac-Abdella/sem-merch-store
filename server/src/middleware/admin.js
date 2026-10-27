const { authorize } = require('./auth');

// Use after `protect`: router.delete('/:id', protect, requireAdmin, handler)
const requireAdmin = authorize('admin');
const requireDriver = authorize('driver', 'admin');

module.exports = { requireAdmin, requireDriver };

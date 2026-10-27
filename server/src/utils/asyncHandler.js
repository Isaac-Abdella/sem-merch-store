// Express 5 already forwards rejected promises from handlers to the error handler,
// so this wrapper is optional. It's kept for clarity and in case you downgrade to Express 4.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

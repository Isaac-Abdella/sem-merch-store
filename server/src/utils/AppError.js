// Throw these anywhere; errorHandler turns them into JSON responses.
class AppError extends Error {
  constructor(message, statusCode = 500, extra = {}) {
    super(message);
    this.statusCode = statusCode;
    this.extra = extra; // e.g. { code: 'OUT_OF_SERVICE_AREA', distanceKm: 92.1 }
  }
}

module.exports = AppError;

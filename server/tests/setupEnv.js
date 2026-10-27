// Runs before every test file: deterministic, offline settings.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-not-for-production';
process.env.GEOCODER = 'mock';
process.env.PAYMENT_PROVIDER = 'mock';
process.env.STRICT_LOGIN_GEOFENCE = 'false';

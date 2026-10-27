/**
 * Real-time tracking over Socket.io.
 * Client flow:  socket.emit('order:subscribe', orderId, ack)  →  receives 'tracking:update' events.
 * Auth: the same httpOnly JWT cookie as the REST API (sent automatically with withCredentials).
 */
const { Server } = require('socket.io');
const Order = require('../models/Order');
const Shipment = require('../models/Shipment');
const { userFromToken } = require('../middleware/auth');
const { parseCookies } = require('../utils/cookies');
const { COOKIE_NAME } = require('../utils/generateToken');
const { canViewOrder } = require('../utils/permissions');

let io = null;
const room = (orderId) => `order:${orderId}`;

function initSockets(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      const token = cookies[COOKIE_NAME] || socket.handshake.auth?.token;
      if (!token) return next(new Error('Unauthorized'));
      socket.user = await userFromToken(token);
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('order:subscribe', async (orderId, ack = () => {}) => {
      try {
        const order = await Order.findById(orderId);
        const shipment = order && (await Shipment.findOne({ order: order._id }));
        if (!canViewOrder(socket.user, order, shipment)) return ack({ ok: false, message: 'Not allowed' });
        socket.join(room(orderId));
        ack({ ok: true });
      } catch {
        ack({ ok: false, message: 'Invalid order' });
      }
    });

    socket.on('order:unsubscribe', (orderId) => socket.leave(room(orderId)));
  });

  return io;
}

/** payload: { orderId, status?, location?: {lat,lng}, at } */
function emitTrackingUpdate(orderId, payload) {
  if (!io) return; // sockets not initialised (e.g. in tests)
  io.to(room(orderId)).emit('tracking:update', { orderId: orderId.toString(), ...payload });
}

module.exports = { initSockets, emitTrackingUpdate };

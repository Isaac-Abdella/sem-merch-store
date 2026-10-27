const idEq = (a, b) => a && b && a.toString() === b.toString();

/** Customers see their own orders, admins see all, drivers see orders assigned to them. */
function canViewOrder(user, order, shipment) {
  if (!user || !order) return false;
  if (user.role === 'admin') return true;
  if (idEq(order.user?._id || order.user, user._id)) return true;
  if (user.role === 'driver' && shipment && idEq(shipment.driver, user._id)) return true;
  return false;
}

/** Only admins or the driver assigned to the shipment can post locations. */
function canDriveShipment(user, shipment) {
  if (!user || !shipment) return false;
  if (user.role === 'admin') return true;
  return user.role === 'driver' && idEq(shipment.driver, user._id);
}

module.exports = { canViewOrder, canDriveShipment, idEq };

/**
 * Maps Uber Direct delivery statuses to this app's order statuses.
 * Lifecycle (Delivery Status Webhook docs): pending → pickup → pickup_complete → dropoff → delivered,
 * or canceled / returned. courier_imminent=true means the courier is ~1 minute away.
 */
function mapUberStatus({ status, courierImminent } = {}) {
  switch (status) {
    case 'pickup_complete':
    case 'dropoff':
      return { status: 'out_for_delivery', notice: status === 'dropoff' && courierImminent ? 'arriving' : null };
    case 'delivered':
      return { status: 'delivered', notice: null };
    case 'canceled':
      return { status: null, notice: 'courier_canceled' };
    case 'returned':
      return { status: null, notice: 'returning' };
    default: // pending, pickup
      return { status: null, notice: null };
  }
}

module.exports = { mapUberStatus };

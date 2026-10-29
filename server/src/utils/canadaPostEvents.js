/**
 * Maps Canada Post tracking scan events to this app's order statuses.
 * Event codes/types come from Canada Post's "Errors and codes" table:
 * https://www.canadapost-postescanada.ca/info/mc/business/productsservices/developers/messagescodetables.jsf
 *
 * Returns { status, notice } where:
 *  - status: an ORDER_STATUSES value to move the order to (or null for "no change")
 *  - notice: an extra SMS-worthy event that doesn't change status (attempted delivery, pickup)
 */
const NOT_SHIPPED_YET = new Set(['3000']); // "Electronic information submitted by shipper" (label only)
const RETURN_CODES = new Set(['1303', '3001', '3002', '1415', '1416', '1417', '1418', '1419', '1420',
  '1481', '1482', '1491', '1492', '2600', '2802', '1100']);

function mapCanadaPostEvent({ code, type } = {}) {
  const c = String(code || '');
  const t = String(type || '').toUpperCase();

  if (RETURN_CODES.has(c)) return { status: null, notice: 'returning' };
  if (t === 'DELIVERED' && c !== '1473') return { status: 'delivered', notice: null };
  if (t === 'OUT') return { status: 'out_for_delivery', notice: null };
  if (t === 'TO_RETAIL' || c === '1407' || c === '2407') return { status: null, notice: 'ready_for_pickup' };
  if (t === 'ATTEMPTED') return { status: null, notice: 'attempted' };
  if (t === 'INDUCTION' && !NOT_SHIPPED_YET.has(c)) return { status: 'shipped', notice: null };
  return { status: null, notice: null };
}

module.exports = { mapCanadaPostEvent };

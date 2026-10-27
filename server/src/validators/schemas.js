const { z } = require('zod');
const { ORDER_STATUSES } = require('../models/Order');
const { OPTION_TYPES } = require('../models/Product');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const canadianPostalCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, 'Enter a valid Canadian postal code (e.g. M5H 2N2)')
  .transform((v) => v.toUpperCase().replace(/[ -]/, '').replace(/^(.{3})(.{3})$/, '$1 $2'));

const address = z.object({
  line1: z.string().trim().min(3, 'Street address is required'),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(2, 'City is required'),
  province: z.string().trim().default('ON'),
  postalCode: canadianPostalCode,
});

const coords = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const register = z.object({
  name: z.string().trim().min(2),
  email: z.email().transform((v) => v.toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  address,
});

const login = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
  password: z.string().min(1),
  coords: coords.optional(), // browser geolocation, only used if STRICT_LOGIN_GEOFENCE=true
});

const updateAddress = z.object({ address });

const cents = z.number().int().nonnegative();

const variant = z.object({
  _id: objectId.optional(), // present when editing an existing option, so cart lines keep pointing at it
  label: z.string().trim().min(1, 'Option label is required'),
  price: cents,
  stock: z.number().int().nonnegative().default(0),
});

const productFields = z.object({
  name: z.string().trim().min(2),
  description: z.string().optional(),
  price: cents.optional(), // required unless the product has options (then each option has its own price)
  image: z.string().optional(),
  category: z.string().optional(),
  optionType: z.enum(OPTION_TYPES).optional(),
  variants: z.array(variant).optional(),
  stock: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
});

const checkOptions = ({ requirePrice }) => (p, ctx) => {
  const hasOptions = p.optionType !== undefined && p.optionType !== 'none';
  if (hasOptions && !p.variants?.length) {
    ctx.addIssue({ code: 'custom', path: ['variants'], message: 'Add at least one option' });
  }
  const seen = new Set();
  (p.variants || []).forEach((v, i) => {
    const key = v.label.toLowerCase();
    if (seen.has(key)) ctx.addIssue({ code: 'custom', path: ['variants', i, 'label'], message: `"${v.label}" is listed twice` });
    seen.add(key);
  });
  if (requirePrice && !hasOptions && p.price === undefined) {
    ctx.addIssue({ code: 'custom', path: ['price'], message: 'Price is required' });
  }
};

const product = productFields.superRefine(checkOptions({ requirePrice: true }));
const productUpdate = productFields.partial().superRefine(checkOptions({ requirePrice: false }));

const createPaymentIntent = z.object({
  items: z
    .array(
      z.object({
        productId: objectId,
        quantity: z.number().int().min(1).max(20),
        variantId: objectId.optional(), // required for products with options
      })
    )
    .min(1, 'Cart is empty'),
  shippingAddress: address,
});

const updateOrderStatus = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().max(300).optional(),
});

const assignDriver = z.object({ driverEmail: z.email() });

const driverStatus = z.object({
  status: z.enum(['shipped', 'out_for_delivery', 'delivered']),
  note: z.string().max(300).optional(),
});

module.exports = {
  objectId,
  address,
  coords,
  register,
  login,
  updateAddress,
  product,
  productUpdate,
  createPaymentIntent,
  updateOrderStatus,
  assignDriver,
  driverStatus,
  serviceAreaCheck: z.object({ address }),
};

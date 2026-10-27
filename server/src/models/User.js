const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { addressSchema } = require('./schemas');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ['customer', 'admin', 'driver'], default: 'customer' },
    address: addressSchema,
  },
  { timestamps: true }
);

// Lets you query customers by area later, e.g. $geoWithin / $centerSphere.
userSchema.index({ 'address.location': '2dsphere' }, { sparse: true });

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.matchPassword = function matchPassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);

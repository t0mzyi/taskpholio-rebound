const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6 },
    role: {
      type: String,
      enum: ['CEO', 'CTO', 'Member'],
      default: 'Member',
    },
    avatar: { type: String, default: '' },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    notifications: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Notification' }],
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

userSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', userSchema);

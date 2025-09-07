const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  username: String,
  firstName: String,
  lastName: String,
  balance: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  totalAds: { type: Number, default: 0 },
  dailyAds: { type: Number, default: 0 },
  lastAdDate: String,
  premium: { type: Boolean, default: false },
  banned: { type: Boolean, default: false },
  joinDate: { type: Date, default: Date.now },
  dailyBonusDate: String,
  referrals: { type: Number, default: 0 },
  referredBy: { type: Number, default: null },
  badges: [String],
}, {
  timestamps: true
});

module.exports = mongoose.model('User', UserSchema);
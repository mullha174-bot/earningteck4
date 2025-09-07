const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  thresholds: {
    normal: { type: Number, default: 2000 },
    premium: { type: Number, default: 1000 },
  },
  adReward: {
    normal: { type: Number, default: 2 },
    premium: { type: Number, default: 4 },
  },
  dailyLimit: {
    normal: { type: Number, default: 1000 },
    premium: { type: Number, default: 99999999 },
  },
  eventMultiplier: { type: Number, default: 1.0 },
  dailyBonus: {
    enabled: { type: Boolean, default: true },
    amount: { type: Number, default: 10 },
  },
  referralBonusUSDT: { type: Number, default: 0.5 },
  premiumCostUSDT: { type: Number, default: 20.0 },
  methods: {
    usdt: { type: Boolean, default: true },
    bkash: { type: Boolean, default: true },
    nagad: { type: Boolean, default: true },
  },
  perPlacement: {
    rewardedInterstitial: { type: Number, default: 2 },
    rewardedPopup: { type: Number, default: 2 },
    appOpen: { type: Number, default: 0 },
  },
  adAutoCredit: { type: Boolean, default: true },
  adCountAsShow: { type: Boolean, default: true },
  theme: { type: String, default: 'auto' },
}, {
  timestamps: true
});

module.exports = mongoose.model('Settings', SettingsSchema);
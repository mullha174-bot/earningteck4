const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/earning-tech', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// MongoDB Models
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
});

const WithdrawSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: Number,
  method: String,
  address: String,
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  date: { type: Date, default: Date.now },
});

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
});

const User = mongoose.model('User', UserSchema);
const Withdraw = mongoose.model('Withdraw', WithdrawSchema);
const Settings = mongoose.model('Settings', SettingsSchema);

// JWT Authentication Middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid token.' });
  }
};

// Routes

// User Registration/Login
app.post('/api/auth', async (req, res) => {
  try {
    const { telegramId, username, firstName, lastName, referredBy } = req.body;
    
    let user = await User.findOne({ telegramId });
    
    if (!user) {
      // New user
      user = new User({
        telegramId,
        username,
        firstName,
        lastName,
        referredBy: referredBy || null,
      });
      
      // Referral bonus
      if (referredBy) {
        const referrer = await User.findOne({ telegramId: referredBy });
        if (referrer) {
          referrer.referrals += 1;
          const settings = await Settings.findOne() || new Settings();
          referrer.balance += settings.referralBonusUSDT * 1000;
          await referrer.save();
        }
      }
      
      await user.save();
    }
    
    const token = jwt.sign(
      { id: user._id }, 
      process.env.JWT_SECRET || 'fallback_secret', 
      { expiresIn: '30d' }
    );
    
    res.json({ token, user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get user balance and profile
app.get('/api/user', authenticate, async (req, res) => {
  try {
    const settings = await Settings.findOne() || new Settings();
    res.json({ user: req.user, settings });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Reward after watching ad
app.post('/api/watch-ad', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const settings = await Settings.findOne() || new Settings();
    
    // Daily reset check
    const today = new Date().toISOString().split('T')[0];
    if (user.lastAdDate !== today) {
      user.dailyAds = 0;
      user.lastAdDate = today;
    }
    
    // Ban or limit check
    if (user.banned) {
      return res.status(400).json({ error: 'User is banned' });
    }
    
    const limit = user.premium ? settings.dailyLimit.premium : settings.dailyLimit.normal;
    if (user.dailyAds >= limit) {
      return res.status(400).json({ error: 'Daily limit reached' });
    }
    
    // Reward calculation
    const base = user.premium ? settings.adReward.premium : settings.adReward.normal;
    const reward = Math.round(base * settings.eventMultiplier);
    
    // Update balance
    user.dailyAds += 1;
    user.totalAds += 1;
    user.balance += reward;
    user.totalEarned += reward;
    
    await user.save();
    
    res.json({ 
      success: true, 
      reward: reward / 1000, 
      balance: user.balance / 1000,
      dailyAds: user.dailyAds
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Daily bonus
app.post('/api/daily-bonus', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const settings = await Settings.findOne() || new Settings();
    
    if (!settings.dailyBonus.enabled) {
      return res.status(400).json({ error: 'Daily bonus is disabled' });
    }
    
    const today = new Date().toISOString().split('T')[0];
    if (user.dailyBonusDate === today) {
      return res.status(400).json({ error: 'Daily bonus already claimed today' });
    }
    
    const bonus = Math.round(settings.dailyBonus.amount * settings.eventMultiplier);
    user.balance += bonus;
    user.totalEarned += bonus;
    user.dailyBonusDate = today;
    
    await user.save();
    
    res.json({ 
      success: true, 
      bonus: bonus / 1000, 
      balance: user.balance / 1000 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Withdrawal request
app.post('/api/withdraw', authenticate, async (req, res) => {
  try {
    const { method, address } = req.body;
    const user = req.user;
    const settings = await Settings.findOne() || new Settings();
    
    // Threshold check
    const threshold = user.premium ? settings.thresholds.premium : settings.thresholds.normal;
    if (user.balance < threshold) {
      return res.status(400).json({ error: 'Insufficient balance for withdrawal' });
    }
    
    // Method validation
    if (!settings.methods[method]) {
      return res.status(400).json({ error: 'Withdrawal method not available' });
    }
    
    // Create withdrawal request
    const withdraw = new Withdraw({
      userId: user._id,
      amount: user.balance,
      method,
      address,
    });
    
    // Reset balance
    user.balance = 0;
    
    await Promise.all([withdraw.save(), user.save()]);
    
    res.json({ success: true, message: 'Withdrawal request submitted' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Withdrawal history
app.get('/api/withdrawals', authenticate, async (req, res) => {
  try {
    const withdrawals = await Withdraw.find({ userId: req.user._id }).sort({ date: -1 });
    res.json(withdrawals);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Buy premium
app.post('/api/buy-premium', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const settings = await Settings.findOne() || new Settings();
    
    if (user.premium) {
      return res.status(400).json({ error: 'User already has premium' });
    }
    
    // Activate premium (add payment gateway in real application)
    user.premium = true;
    await user.save();
    
    res.json({ success: true, message: 'Premium activated successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Admin routes - settings management
app.get('/api/admin/settings', authenticate, async (req, res) => {
  try {
    // Admin check (replace with your logic)
    if (req.user.telegramId !== 8457318925) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const settings = await Settings.findOne() || new Settings();
    res.json(settings);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/admin/settings', authenticate, async (req, res) => {
  try {
    // Admin check
    if (req.user.telegramId !== 8457318925) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }
    
    // Update settings
    Object.assign(settings, req.body);
    await settings.save();
    
    res.json({ success: true, settings });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Admin - withdrawal request management
app.get('/api/admin/withdrawals', authenticate, async (req, res) => {
  try {
    // Admin check
    if (req.user.telegramId !== 8457318925) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { status, search } = req.query;
    let filter = {};
    
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    if (search) {
      filter.address = new RegExp(search, 'i');
    }
    
    const withdrawals = await Withdraw.find(filter)
      .populate('userId', 'telegramId username firstName')
      .sort({ date: -1 });
    
    res.json(withdrawals);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/admin/withdrawals/:id', authenticate, async (req, res) => {
  try {
    // Admin check
    if (req.user.telegramId !== 8457318925) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { status } = req.body;
    const withdrawal = await Withdraw.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('userId', 'telegramId username firstName');
    
    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal not found' });
    }
    
    res.json({ success: true, withdrawal });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Daily reset task (at midnight)
cron.schedule('0 0 * * *', async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    await User.updateMany({}, { dailyAds: 0, lastAdDate: today });
    console.log('Daily reset completed');
  } catch (error) {
    console.error('Daily reset error:', error);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
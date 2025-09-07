const express = require('express');
const Settings = require('../models/Settings');
const Withdraw = require('../models/Withdraw');
const User = require('../models/User');
const authenticate = require('../middleware/auth');
const router = express.Router();

// Admin authentication middleware
const isAdmin = (req, res, next) => {
  if (req.user.telegramId !== 8457318925) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};

// Get settings
router.get('/admin/settings', authenticate, isAdmin, async (req, res) => {
  try {
    const settings = await Settings.findOne() || new Settings();
    res.json(settings);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update settings
router.post('/admin/settings', authenticate, isAdmin, async (req, res) => {
  try {
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

// Get withdrawal requests
router.get('/admin/withdrawals', authenticate, isAdmin, async (req, res) => {
  try {
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

// Update withdrawal status
router.put('/admin/withdrawals/:id', authenticate, isAdmin, async (req, res) => {
  try {
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

// User management
router.get('/admin/users', authenticate, isAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ joinDate: -1 });
    res.json(users);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Toggle user premium status
router.put('/admin/users/:id/premium', authenticate, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.premium = !user.premium;
    await user.save();
    
    res.json({ success: true, user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Toggle user ban status
router.put('/admin/users/:id/ban', authenticate, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.banned = !user.banned;
    await user.save();
    
    res.json({ success: true, user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
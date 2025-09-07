const express = require('express');
const Withdraw = require('../models/Withdraw');
const User = require('../models/User');
const Settings = require('../models/Settings');
const authenticate = require('../middleware/auth');
const router = express.Router();

// Create withdrawal request
router.post('/withdraw', authenticate, async (req, res) => {
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

// Get user withdrawal history
router.get('/withdrawals', authenticate, async (req, res) => {
  try {
    const withdrawals = await Withdraw.find({ userId: req.user._id }).sort({ date: -1 });
    res.json(withdrawals);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
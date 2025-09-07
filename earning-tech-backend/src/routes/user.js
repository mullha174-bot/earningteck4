const express = require('express');
const User = require('../models/User');
const Settings = require('../models/Settings');
const authenticate = require('../middleware/auth');
const router = express.Router();

// Get user data
router.get('/user', authenticate, async (req, res) => {
  try {
    const settings = await Settings.findOne() || new Settings();
    res.json({ user: req.user, settings });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Watch ad and get reward
router.post('/watch-ad', authenticate, async (req, res) => {
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
router.post('/daily-bonus', authenticate, async (req, res) => {
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

// Buy premium
router.post('/buy-premium', authenticate, async (req, res) => {
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

module.exports = router;
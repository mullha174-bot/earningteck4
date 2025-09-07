const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Settings = require('../models/Settings');
const router = express.Router();

// User registration/login
router.post('/auth', async (req, res) => {
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

module.exports = router;
const mongoose = require('mongoose');

const WithdrawSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  method: { type: String, required: true },
  address: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Rejected'], 
    default: 'Pending' 
  },
  date: { type: Date, default: Date.now },
}, {
  timestamps: true
});

module.exports = mongoose.model('Withdraw', WithdrawSchema);
// models/CashTransaction.js
const mongoose = require('mongoose');

const cashTransactionSchema = new mongoose.Schema({
  amount: { 
    type: Number, 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['KEEP', 'SENT'], // KEEP = received at reception, SENT = sent to office
    required: true 
  },
  source: {
    type: String,
    enum: ['RESTAURANT', 'ROOM BOOKING', 'BANQUET + PARTY', 'OTHER'],
    required: true,
  },
  description: { 
    type: String, 
    default: '' 
  },
  receptionistId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }, 
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('CashTransaction', cashTransactionSchema);

const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
    from: {
      // payer
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    to: {
      // payee
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    note: {
      type: String,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Link to specific expense (optional)
    expense: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Expense',
    },
    // Type of settlement
    settlementType: {
      type: String,
      enum: ['expense_payment', 'direct_settlement', 'group_settlement'],
      default: 'direct_settlement',
    },
    // Settlement status
    status: {
      type: String,
      enum: ['pending', 'completed', 'cancelled'],
      default: 'completed',
    },
  },
  { timestamps: true }
);

// Indexes for better query performance
settlementSchema.index({ group: 1, createdAt: -1 });
settlementSchema.index({ from: 1, to: 1 });
settlementSchema.index({ recordedBy: 1 });

module.exports = mongoose.model('Settlement', settlementSchema);

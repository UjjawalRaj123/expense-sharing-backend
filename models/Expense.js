const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
    splitType: {
      type: String,
      enum: ['equal', 'exact', 'percentage'],
      required: true,
    },
    splits: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        amount: {
          type: Number,
          required: true,
        },
      },
    ],
    category: {
      type: String,
      default: 'General',
    },
    notes: {
      type: String,
    },
    // Multi-payer support: track all payments for this expense
    payments: [
      {
        paidBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        amount: {
          type: Number,
          required: true,
        },
        paidAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Total amount paid so far
    totalPaid: {
      type: Number,
      default: 0,
    },
    // Remaining amount to be paid
    remainingAmount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Indexes for better query performance
expenseSchema.index({ group: 1, createdAt: -1 });
expenseSchema.index({ paidBy: 1 });
expenseSchema.index({ 'splits.user': 1 });

module.exports = mongoose.model('Expense', expenseSchema);

const Expense = require('../models/Expense');
const Group = require('../models/Group');
const { distributeSplits } = require('../utils/splitCalculator');

// Create a new expense
const createExpense = async (req, res) => {
  try {
    const { description, amount, groupId, splitType, category, notes, splits, percentages } = req.body;
    const paidBy = req.userId;

    console.log('📝 Creating expense with data:', {
      description,
      amount,
      groupId,
      splitType,
      category,
      notes,
      paidBy,
      splitsLength: splits?.length,
      percentagesLength: percentages?.length
    });

    // Validate inputs
    if (!description || !amount || !groupId || !splitType) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ message: 'Missing required fields: description, amount, groupId, splitType' });
    }

    // Validate group exists and user is a member
    const group = await Group.findById(groupId);
    if (!group) {
      console.log('❌ Group not found:', groupId);
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.members.includes(paidBy)) {
      console.log('❌ User not a member of group');
      return res.status(403).json({ message: 'User is not a member of this group' });
    }

    console.log('✅ Group found and user is member. Members count:', group.members.length);

    // Calculate splits based on split type
    let calculatedSplits = [];

    try {
      if (splitType === 'equal') {
        // For equal split, distribute among all group members
        console.log('🔄 Calculating equal split for', group.members.length, 'members');
        const equalAmount = parseFloat((amount / group.members.length).toFixed(2));
        console.log('💰 Equal amount per member:', equalAmount);
        calculatedSplits = group.members.map(memberId => ({
          user: memberId,
          amount: equalAmount,
        }));
        console.log('✅ Calculated splits:', calculatedSplits.length, 'splits');
      } else if (splitType === 'exact') {
        // For exact split, use provided splits
        if (!splits || splits.length === 0) {
          return res.status(400).json({ message: 'Exact split requires split amounts' });
        }
        calculatedSplits = splits;
      } else if (splitType === 'percentage') {
        // For percentage split, use provided percentages
        if (!percentages || percentages.length === 0) {
          return res.status(400).json({ message: 'Percentage split requires percentages' });
        }
        calculatedSplits = percentages.map((item) => ({
          user: item.user,
          amount: parseFloat((amount * (item.percentage / 100)).toFixed(2)),
        }));
      } else {
        return res.status(400).json({ message: 'Invalid split type' });
      }
    } catch (error) {
      console.error('❌ Split calculation error:', error);
      return res.status(400).json({ message: 'Error calculating splits', error: error.message });
    }

    // Create expense
    const newExpense = new Expense({
      description,
      amount: parseFloat(amount),
      paidBy,
      group: groupId,
      splitType,
      splits: calculatedSplits,
      category: category || 'General',
      notes: notes || '',
    });

    await newExpense.save();

    // Add expense to group
    group.expenses.push(newExpense._id);
    await group.save();

    console.log('💾 Expense saved. Now populating...');
    // Fetch and populate the expense properly
    const populatedExpense = await Expense.findById(newExpense._id)
      .populate('paidBy', '-password')
      .populate('splits.user', '-password')
      .populate('group');

    console.log('✅ Expense created successfully');
    res.status(201).json({ message: 'Expense created successfully', expense: populatedExpense });
  } catch (error) {
    console.error('❌ Expense creation error:', error);
    res.status(500).json({ message: 'Error creating expense', error: error.message });
  }
};

// Get expenses for a group
const getGroupExpenses = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is a member
    if (!group.members.includes(req.userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const expenses = await Expense.find({ group: groupId })
      .populate('paidBy', '-password')
      .populate('payments.paidBy', 'name email')
      .populate('splits.user', '-password')
      .populate('group', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({ expenses });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching expenses', error: error.message });
  }
};

// Get expense by ID
const getExpenseById = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id)
      .populate('paidBy', '-password')
      .populate('splits.user', '-password')
      .populate('group');

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Check if user is a member of the group
    const group = await Group.findById(expense.group._id);
    if (!group.members.includes(req.userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.status(200).json({ expense });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching expense', error: error.message });
  }
};

// Delete expense
const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Check if user is the one who paid for the expense
    if (expense.paidBy.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only the person who paid can delete the expense' });
    }

    // Remove expense from group
    await Group.findByIdAndUpdate(expense.group, {
      $pull: { expenses: req.params.id },
    });

    // Delete expense
    await Expense.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting expense', error: error.message });
  }
};

// Add payment to an existing expense
const addPaymentToExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;
    const { amount } = req.body;
    const userId = req.userId;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid payment amount' });
    }

    const expense = await Expense.findById(expenseId).populate('group');

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Check if user is group member
    const isMember = expense.group.members.some(
      m => m.toString() === userId
    );
    if (!isMember) {
      return res.status(403).json({ message: 'Not a group member' });
    }

    // Initialize payments array if this is the first time (backward compatibility)
    if (!expense.payments || expense.payments.length === 0) {
      expense.payments = [{
        paidBy: expense.paidBy,
        amount: expense.amount,
        paidAt: expense.createdAt
      }];
      expense.totalPaid = expense.amount;
      expense.remainingAmount = 0;
    }

    // Check if user already paid
    const existingPayment = expense.payments.find(
      p => p.paidBy.toString() === userId
    );
    if (existingPayment) {
      return res.status(400).json({
        message: 'You have already paid for this expense. Each member can pay only once per expense.'
      });
    }

    // Check remaining amount
    const currentRemaining = expense.amount - (expense.totalPaid || 0);
    if (amount > currentRemaining) {
      return res.status(400).json({
        message: `Payment exceeds remaining amount. Remaining: $${currentRemaining.toFixed(2)}`
      });
    }

    // Add payment
    expense.payments.push({
      paidBy: userId,
      amount: parseFloat(amount),
      paidAt: new Date()
    });

    expense.totalPaid = (expense.totalPaid || 0) + parseFloat(amount);
    expense.remainingAmount = expense.amount - expense.totalPaid;

    await expense.save();

    // Populate and return
    const updatedExpense = await Expense.findById(expenseId)
      .populate('paidBy', '-password')
      .populate('payments.paidBy', 'name email')
      .populate('splits.user', '-password')
      .populate('group');

    res.json({
      message: 'Payment added successfully',
      expense: updatedExpense
    });
  } catch (error) {
    console.error('Error adding payment:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get all payments for an expense
const getExpensePayments = async (req, res) => {
  try {
    const { expenseId } = req.params;

    const expense = await Expense.findById(expenseId)
      .populate('payments.paidBy', 'name email')
      .populate('group');

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Check if user is group member
    const isMember = expense.group.members.some(
      m => m.toString() === req.userId
    );
    if (!isMember) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({
      payments: expense.payments || [],
      totalPaid: expense.totalPaid || 0,
      remainingAmount: expense.remainingAmount || 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all expenses involving current user across all groups
const getMyExpenses = async (req, res) => {
  try {
    const userId = req.userId;
    const expenses = await Expense.find({
      $or: [
        { paidBy: userId },
        { 'splits.user': userId },
        { 'payments.paidBy': userId }
      ]
    })
      .populate('paidBy', '-password')
      .populate('payments.paidBy', 'name email')
      .populate('splits.user', '-password')
      .populate('group', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({ expenses });
  } catch (error) {
    console.error('Error fetching user expenses:', error);
    res.status(500).json({ message: 'Error fetching expenses', error: error.message });
  }
};

module.exports = {
  createExpense,
  getGroupExpenses,
  getExpenseById,
  deleteExpense,
  addPaymentToExpense,
  getExpensePayments,
  getMyExpenses,
};

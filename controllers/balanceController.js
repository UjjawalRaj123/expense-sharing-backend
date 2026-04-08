const Group = require('../models/Group');
const Expense = require('../models/Expense');
const { calculateGroupBalances } = require('../utils/balanceCalculator');
const Settlement = require('../models/Settlement');

// Get balances for a group
const getGroupBalances = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId).populate('members');
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is a member
    if (!group.members.find((member) => member._id.toString() === req.userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get all expenses for the group
    const expenses = await Expense.find({ group: groupId }).populate('splits.user').populate('paidBy');

    // Get settlements for the group and include them in balance calculations
    const settlements = await Settlement.find({ group: groupId });

    // Calculate balances (expenses + settlements)
    const balances = calculateGroupBalances(expenses, settlements);

    // Format balance information
    const balanceInfo = [];
    const members = group.members;

    members.forEach((member) => {
      const memberBalances = balances[member._id];
      if (memberBalances) {
        const memberBalance = {
          userId: member._id,
          userName: member.name,
          userEmail: member.email,
          totalSpent: memberBalances.totalSpent,
          owedBy: [],
          totalOwed: 0,
        };

        // Calculate total owed by this member
        for (const [debtorId, amount] of Object.entries(memberBalances.owedBy)) {
          const debtor = members.find((m) => m._id.toString() === debtorId);
          if (debtor && amount > 0) {
            memberBalance.owedBy.push({
              userId: debtorId,
              userName: debtor.name,
              userEmail: debtor.email,
              amount: amount,
            });
            memberBalance.totalOwed += amount;
          }
        }

        balanceInfo.push(memberBalance);
      }
    });

    // Calculate balances from perspective of current user
    const userBalance = balances[req.userId] || { totalSpent: 0, owedBy: {} };
    let userOwesTotal = 0;
    let userIsOwedTotal = 0;

    for (const [creditorId, amount] of Object.entries(userBalance.owedBy || {})) {
      if (amount > 0) userOwesTotal += amount;
    }

    // Calculate how much others owe the current user
    members.forEach((member) => {
      const memberId = member._id.toString();
      const memberBalances = balances[memberId];
      if (memberBalances && memberBalances.owedBy && memberBalances.owedBy[req.userId]) {
        const amount = memberBalances.owedBy[req.userId];
        if (amount > 0) userIsOwedTotal += amount;
      }
    });

    res.status(200).json({
      groupId,
      balances: balanceInfo,
      userSummary: {
        userId: req.userId,
        totalOwes: userOwesTotal,
        totalIsOwed: userIsOwedTotal,
        netBalance: userIsOwedTotal - userOwesTotal,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching balances', error: error.message });
  }
};

// Get balance details for a specific user in a group
const getUserBalance = async (req, res) => {
  try {
    const { groupId, userId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is a member
    if (!group.members.includes(req.userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get all expenses
    const expenses = await Expense.find({ group: groupId }).populate('splits.user').populate('paidBy');
    const settlements = await Settlement.find({ group: groupId });

    const balances = calculateGroupBalances(expenses, settlements);
    const userBalances = balances[userId];

    if (!userBalances) {
      return res.status(404).json({ message: 'User balance not found' });
    }

    res.status(200).json({
      userId,
      totalSpent: userBalances.totalSpent,
      owedBy: userBalances.owedBy,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user balance', error: error.message });
  }
};

module.exports = {
  getGroupBalances,
  getUserBalance,
};

// Get overall balances for the current user across all groups
const getOverallUserBalance = async (req, res) => {
  try {
    const userId = req.userId;

    // Find groups where user is a member
    const groups = await Group.find({ members: userId }).select('_id name members createdBy');

    let totalOwes = 0;
    let totalIsOwed = 0;
    const perGroup = [];

    for (const g of groups) {
      const expenses = await Expense.find({ group: g._id }).populate('splits.user').populate('paidBy');
      const settlements = await Settlement.find({ group: g._id });
      const balances = calculateGroupBalances(expenses, settlements);

      const userBalance = balances[userId] || { totalSpent: 0, owedBy: {} };
      let userOwesTotal = 0;
      let userIsOwedTotal = 0;

      for (const [creditorId, amount] of Object.entries(userBalance.owedBy || {})) {
        if (amount > 0) userOwesTotal += amount;
      }

      // Calculate how much others owe the current user in this group
      for (const memberId of Object.keys(balances)) {
        const memberBalances = balances[memberId];
        if (memberBalances && memberBalances.owedBy && memberBalances.owedBy[userId]) {
          const amt = memberBalances.owedBy[userId];
          if (amt > 0) userIsOwedTotal += amt;
        }
      }

      totalOwes += userOwesTotal;
      totalIsOwed += userIsOwedTotal;

      perGroup.push({ groupId: g._id, groupName: g.name, owes: userOwesTotal, isOwed: userIsOwedTotal });
    }

    res.status(200).json({ totalOwes, totalIsOwed, netBalance: totalIsOwed - totalOwes, perGroup });
  } catch (error) {
    console.error('Error fetching overall balances', error);
    res.status(500).json({ message: 'Error fetching overall balances', error: error.message });
  }
};

module.exports.getOverallUserBalance = getOverallUserBalance;

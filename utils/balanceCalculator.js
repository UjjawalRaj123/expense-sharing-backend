/**
 * Calculate balances for users in a group
 */

const calculateGroupBalances = (expenses, settlements = []) => {
  // balances: { userId: { totalSpent, owedBy: { creditorId: amount } } }
  const balances = {};

  // Initialize balances object for users appearing in expenses
  expenses.forEach((expense) => {
    const payerId = expense.paidBy && expense.paidBy.toString ? expense.paidBy.toString() : String(expense.paidBy);
    if (!balances[payerId]) {
      balances[payerId] = { totalSpent: 0, owedBy: {} };
    }

    expense.splits.forEach((split) => {
      const debtorId = split.user && split.user.toString ? split.user.toString() : String(split.user);
      if (!balances[debtorId]) balances[debtorId] = { totalSpent: 0, owedBy: {} };
      if (!balances[debtorId].owedBy[payerId]) balances[debtorId].owedBy[payerId] = 0;
    });
  });

  // Sum totals from expenses
  expenses.forEach((expense) => {
    // Handle multiple payments (new) or single payer (backward compatibility)
    const expensePayments = expense.payments && expense.payments.length > 0
      ? expense.payments
      : [{ paidBy: expense.paidBy, amount: expense.amount }];

    // Track who paid what
    expensePayments.forEach(payment => {
      const payerId = payment.paidBy && payment.paidBy.toString ? payment.paidBy.toString() : String(payment.paidBy);
      if (!balances[payerId]) {
        balances[payerId] = { totalSpent: 0, owedBy: {} };
      }
      balances[payerId].totalSpent += (payment.amount || 0);
    });

    // Calculate who owes what (from splits)
    expense.splits.forEach((split) => {
      const debtorId = split.user && split.user.toString ? split.user.toString() : String(split.user);
      const shareAmount = split.amount || 0;

      // Distribute debt among all payers proportionally
      expensePayments.forEach(payment => {
        const payerId = payment.paidBy && payment.paidBy.toString ? payment.paidBy.toString() : String(payment.paidBy);

        // Skip if debtor is the payer (can't owe yourself)
        if (debtorId === payerId) return;

        // Calculate proportional debt based on how much each payer contributed
        const payerProportion = (payment.amount || 0) / (expense.amount || 1);
        const debtToPayer = shareAmount * payerProportion;

        if (!balances[debtorId]) {
          balances[debtorId] = { totalSpent: 0, owedBy: {} };
        }
        balances[debtorId].owedBy[payerId] =
          (balances[debtorId].owedBy[payerId] || 0) + debtToPayer;
      });
    });
  });

  // Apply settlements (payments between users) to reduce debts
  settlements.forEach((settlement) => {
    const fromId = settlement.from && settlement.from.toString ? settlement.from.toString() : String(settlement.from);
    const toId = settlement.to && settlement.to.toString ? settlement.to.toString() : String(settlement.to);
    const amt = settlement.amount || 0;

    if (!balances[fromId]) balances[fromId] = { totalSpent: 0, owedBy: {} };
    if (!balances[toId]) balances[toId] = { totalSpent: 0, owedBy: {} };

    const prev = balances[fromId].owedBy[toId] || 0;
    if (prev >= amt) {
      // reduce from -> to debt
      balances[fromId].owedBy[toId] = parseFloat((prev - amt).toFixed(2));
    } else {
      // fully paid and surplus becomes reverse debt
      balances[fromId].owedBy[toId] = 0;
      const surplus = parseFloat((amt - prev).toFixed(2));
      balances[toId].owedBy[fromId] = (balances[toId].owedBy[fromId] || 0) + surplus;
      balances[toId].owedBy[fromId] = parseFloat(balances[toId].owedBy[fromId].toFixed(2));
    }

    // cleanup zeros
    if (balances[fromId].owedBy[toId] === 0) delete balances[fromId].owedBy[toId];
    if (balances[toId].owedBy && balances[toId].owedBy[fromId] === 0) delete balances[toId].owedBy[fromId];
  });

  return balances;
};

module.exports = {
  calculateGroupBalances,
};

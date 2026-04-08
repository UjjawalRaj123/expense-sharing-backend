/**
 * Calculate expense splits based on split type
 */

const calculateEqualSplit = (amount, participantCount) => {
  const splitAmount = parseFloat((amount / participantCount).toFixed(2));
  return splitAmount;
};

const calculateExactSplit = (splits) => {
  // Validate that splits add up to the expense amount
  const total = splits.reduce((sum, split) => sum + split.amount, 0);
  return splits;
};

const calculatePercentageSplit = (amount, percentages) => {
  // percentages should be an array of {user, percentage}
  const splits = percentages.map((item) => ({
    user: item.user,
    amount: parseFloat((amount * (item.percentage / 100)).toFixed(2)),
  }));
  return splits;
};

const distributeSplits = (splitType, amount, participants, customData = {}) => {
  let splits = [];

  switch (splitType) {
    case 'equal':
      const equalAmount = calculateEqualSplit(amount, participants.length);
      splits = participants.map((userId) => ({
        user: userId,
        amount: equalAmount,
      }));
      break;

    case 'exact':
      splits = customData.splits || [];
      break;

    case 'percentage':
      splits = calculatePercentageSplit(amount, customData.percentages || []);
      break;

    default:
      throw new Error('Invalid split type');
  }

  return splits;
};

module.exports = {
  calculateEqualSplit,
  calculateExactSplit,
  calculatePercentageSplit,
  distributeSplits,
};

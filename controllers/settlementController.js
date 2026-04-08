const Settlement = require('../models/Settlement');
const Group = require('../models/Group');
const User = require('../models/User');

// Create a settlement (record a payment from current user to another group member)
const createSettlement = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { toUserId, amount, note } = req.body;
    const fromUserId = req.userId;

    if (!amount || amount <= 0 || !toUserId) {
      return res.status(400).json({ message: 'Invalid settlement data' });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // both must be members
    if (!group.members.includes(fromUserId) || !group.members.includes(toUserId)) {
      return res.status(403).json({ message: 'Both users must be members of the group' });
    }

    // create settlement
    const settlement = new Settlement({
      group: groupId,
      from: fromUserId,
      to: toUserId,
      amount: parseFloat(amount),
      note: note || '',
      recordedBy: req.userId,
    });

    await settlement.save();

    const populated = await Settlement.findById(settlement._id)
      .populate('from', '-password')
      .populate('to', '-password')
      .populate('recordedBy', '-password');

    res.status(201).json({ message: 'Settlement recorded', settlement: populated });
  } catch (error) {
    console.error('Error creating settlement:', error);
    res.status(500).json({ message: 'Error creating settlement', error: error.message });
  }
};

// Get settlements for a group
const getGroupSettlements = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (!group.members.includes(req.userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const settlements = await Settlement.find({ group: groupId })
      .populate('from', '-password')
      .populate('to', '-password')
      .populate('recordedBy', '-password')
      .populate('group', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({ settlements });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching settlements', error: error.message });
  }
};

// Delete a settlement (only recordedBy or group creator)
const deleteSettlement = async (req, res) => {
  try {
    const { id } = req.params;

    const settlement = await Settlement.findById(id);
    if (!settlement) return res.status(404).json({ message: 'Settlement not found' });

    const group = await Group.findById(settlement.group);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (settlement.recordedBy.toString() !== req.userId && group.createdBy.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to delete this settlement' });
    }

    await Settlement.findByIdAndDelete(id);

    res.status(200).json({ message: 'Settlement deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting settlement', error: error.message });
  }
};

// Get settlements involving current user across all groups (from/to/recordedBy)
const getMySettlements = async (req, res) => {
  try {
    const userId = req.userId;
    const settlements = await Settlement.find({
      $or: [{ from: userId }, { to: userId }, { recordedBy: userId }]
    })
      .populate('from', '-password')
      .populate('to', '-password')
      .populate('recordedBy', '-password')
      .populate('group', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({ settlements });
  } catch (error) {
    console.error('Error fetching user settlements', error);
    res.status(500).json({ message: 'Error fetching settlements', error: error.message });
  }
};

module.exports = {
  createSettlement,
  getGroupSettlements,
  deleteSettlement,
};

module.exports.getMySettlements = getMySettlements;

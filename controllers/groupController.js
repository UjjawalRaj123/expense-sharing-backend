const Group = require('../models/Group');
const User = require('../models/User');

// Create a new group
const createGroup = async (req, res) => {
  try {
    console.log('Creating group with data:', req.body);
    console.log('User ID:', req.userId);

    const { name, description, memberIds } = req.body;
    const createdBy = req.userId;

    // Validate input
    if (!name || name.trim() === '') {
      console.log('Group name is empty');
      return res.status(400).json({ message: 'Group name is required' });
    }

    if (!createdBy) {
      console.log('User not authenticated');
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Verify user exists in database
    console.log('Checking if user exists...');
    const user = await User.findById(createdBy);
    if (!user) {
      console.log('User not found in database:', createdBy);
      return res.status(404).json({ message: 'User not found' });
    }
    console.log('User found:', user.name);

    // Create group with creator as the first member
    const members = [createdBy];
    if (memberIds && memberIds.length > 0) {
      members.push(...memberIds.filter((id) => id !== createdBy));
    }

    console.log('Group data before save:', { name, description, members, createdBy });

    const newGroup = new Group({
      name: name.trim(),
      description: description || '',
      members,
      createdBy,
    });

    console.log('Saving group to database...');
    await newGroup.save();
    console.log('✅ Group saved successfully:', newGroup._id);

    // Fetch and populate the group
    console.log('Populating group data...');
    const populatedGroup = await Group.findById(newGroup._id)
      .populate('members', '-password')
      .populate('createdBy', '-password');

    console.log('✅ Group populated successfully');

    res.status(201).json({ message: 'Group created successfully', group: populatedGroup });
  } catch (error) {
    console.error('❌ Error creating group:', error.message);
    console.error('Full error:', error);
    res.status(500).json({ message: 'Error creating group', error: error.message });
  }
};

// Get all groups for current user
const getUserGroups = async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const groups = await Group.find({ members: req.userId })
      .populate('members', '-password')
      .populate('createdBy', '-password')
      .populate({
        path: 'expenses',
        populate: {
          path: 'paidBy splits.user',
          select: '-password',
        },
      });

    res.status(200).json({ groups: groups || [] });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ message: 'Error fetching groups', error: error.message });
  }
};

// Get group by ID
const getGroupById = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('members', '-password')
      .populate('createdBy', '-password')
      .populate({
        path: 'expenses',
        populate: {
          path: 'paidBy splits.user',
          select: '-password',
        },
      });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is a member
    if (!group.members.find((member) => member._id.toString() === req.userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.status(200).json({ group });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching group', error: error.message });
  }
};

// Add member to group
const addMemberToGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is group creator
    if (group.createdBy.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only group creator can add members' });
    }

    // Check if user is already a member
    if (group.members.includes(userId)) {
      return res.status(400).json({ message: 'User is already a member' });
    }

    // Add member to group and persist
    group.members.push(userId);
    await group.save();

    // Add group to user's groups
    await User.findByIdAndUpdate(userId, {
      $push: { groups: groupId },
    });

    // Re-fetch and populate to avoid calling .populate on a document promise
    const populatedGroup = await Group.findById(groupId)
      .populate('members', '-password')
      .populate('createdBy', '-password');

    res.status(200).json({ message: 'Member added successfully', group: populatedGroup });
  } catch (error) {
    res.status(500).json({ message: 'Error adding member', error: error.message });
  }
};

// Delete group
const deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is group creator
    if (group.createdBy.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only group creator can delete the group' });
    }

    // Remove group from all members
    await User.updateMany(
      { _id: { $in: group.members } },
      { $pull: { groups: groupId } }
    );

    // Delete group
    await Group.findByIdAndDelete(groupId);

    res.status(200).json({ message: 'Group deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting group', error: error.message });
  }
};

module.exports = {
  createGroup,
  getUserGroups,
  getGroupById,
  addMemberToGroup,
  deleteGroup,
};

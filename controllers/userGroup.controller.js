import { UserGroupModel } from '../models/UserGroup.js';
/**
 * Create a new user group
 */
export const createUserGroup = async (req, res) => {
  try {
    const { name, owner, secondOwner, thirdOwner, members } = req.body;

    const userGroup = new UserGroupModel({
      name,
      owner,
      secondOwner,
      thirdOwner,
      members,
    });

    const savedGroup = await userGroup.save();
    return res.status(201).json(savedGroup);
  } catch (error) {
    console.error('Error creating user group:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all user groups
 */
export const getUserGroups = async (req, res) => {
  try {
    // Optionally, populate owners/members to return the user documents
    const userGroups = await UserGroupModel.find()
      .populate('owner')
      .populate('secondOwner')
      .populate('thirdOwner')
      .populate('members');

    return res.json(userGroups);
  } catch (error) {
    console.error('Error fetching user groups:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get a single user group by ID
 */
export const getUserGroupById = async (req, res) => {
  try {
    const { groupId } = req.params;

    const userGroup = await UserGroupModel.findById(groupId)
      .populate('owner')
      .populate('secondOwner')
      .populate('thirdOwner')
      .populate('members');

    if (!userGroup) {
      return res.status(404).json({ error: 'User group not found' });
    }

    return res.json(userGroup);
  } catch (error) {
    console.error('Error fetching user group:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update a user group by ID
 */
export const updateUserGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, owner, secondOwner, thirdOwner, members } = req.body;

    const updatedGroup = await UserGroupModel.findByIdAndUpdate(
      groupId,
      { name, owner, secondOwner, thirdOwner, members },
      { new: true }
    )
      .populate('owner')
      .populate('secondOwner')
      .populate('thirdOwner')
      .populate('members');

    if (!updatedGroup) {
      return res.status(404).json({ error: 'User group not found' });
    }

    return res.json(updatedGroup);
  } catch (error) {
    console.error('Error updating user group:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete a user group by ID
 */
export const deleteUserGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const deletedGroup = await UserGroupModel.findByIdAndDelete(groupId);

    if (!deletedGroup) {
      return res.status(404).json({ error: 'User group not found' });
    }

    return res.json({ message: 'User group deleted successfully' });
  } catch (error) {
    console.error('Error deleting user group:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

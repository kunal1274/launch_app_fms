import { UserModel } from '../models/user.model.js';

/**
 * Create a new user
 */
export const createUser = async (req, res) => {
  try {
    const { email, name } = req.body;
    const newUser = new UserModel({ email, name });
    const savedUser = await newUser.save();
    return res.status(201).json(savedUser);
  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all users
 */
export const getUsers = async (req, res) => {
  try {
    const users = await UserModel.find();
    return res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get a single user by ID
 */
export const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update a user by ID
 */
export const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { email, name } = req.body;

    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      { email, name },
      { new: true } // returns the updated document
    );
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete a user by ID
 */
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const deletedUser = await UserModel.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

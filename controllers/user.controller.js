import { UserModel } from '../models/user.model.js';
import { BaseController, validateRequest, commonValidationSchemas } from './base.controller.js';
import { asyncHandler } from '../utility/error.util.js';
import {
  successResponse,
  createdResponse,
  updatedResponse,
  deletedResponse,
  notFoundResponse,
  HTTP_STATUS,
  SUCCESS_MESSAGES,
} from '../utility/response.util.js';
import { validate } from '../utility/validation.util.js';

/**
 * User Controller - Standardized implementation
 */
class UserController extends BaseController {
  constructor() {
    super(UserModel, 'User');
  }

  /**
   * Create a new user with validation
   */
  createUser = asyncHandler(async (req, res) => {
    const { email, name, password, role } = req.body;

    // Validate required fields
    const validationSchema = {
      email: { type: 'string', required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
      name: { type: 'string', required: true, minLength: 2, maxLength: 100 },
      password: { type: 'string', required: true, minLength: 8 },
      role: { type: 'string', required: false },
    };

    try {
      validate(req.body, validationSchema);
    } catch (error) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Validation failed',
        errors: error.errors,
        timestamp: new Date().toISOString(),
      });
    }

    // Check if user already exists
    const existingUser = await UserModel.findOne({ email, isDeleted: false });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        status: 409,
        message: 'User with this email already exists',
        timestamp: new Date().toISOString(),
      });
    }

    // Create user
    const userData = {
      email,
      name,
      password,
      role: role || 'user',
      createdBy: req.user?.id,
      updatedBy: req.user?.id,
    };

    const newUser = await UserModel.create(userData);
    await newUser.populate('createdBy', 'name email');

    return createdResponse(res, 'User created successfully', newUser);
  });

  /**
   * Get all users with pagination and filtering
   */
  getUsers = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      sort = '-createdAt',
      search,
      role,
      isActive,
    } = req.query;

    // Build query
    let query = { isDeleted: false };

    // Add search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // Add filters
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      UserModel.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .select('-password'), // Exclude password from response
      UserModel.countDocuments(query),
    ]);

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
    };

    return res.status(200).json({
      success: true,
      status: 200,
      message: SUCCESS_MESSAGES.RETRIEVED,
      data: users,
      meta: { pagination },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get a single user by ID
   */
  getUserById = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const user = await UserModel.findOne({ _id: userId, isDeleted: false })
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .select('-password'); // Exclude password from response

    if (!user) {
      return notFoundResponse(res, 'User not found');
    }

    return successResponse(res, HTTP_STATUS.OK, SUCCESS_MESSAGES.RETRIEVED, user);
  });

  /**
   * Update a user by ID
   */
  updateUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { email, name, role, isActive } = req.body;

    // Validate input
    const validationSchema = {
      email: { type: 'string', required: false, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
      name: { type: 'string', required: false, minLength: 2, maxLength: 100 },
      role: { type: 'string', required: false },
      isActive: { type: 'boolean', required: false },
    };

    try {
      validate(req.body, validationSchema);
    } catch (error) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Validation failed',
        errors: error.errors,
        timestamp: new Date().toISOString(),
      });
    }

    // Check if email is being updated and if it already exists
    if (email) {
      const existingUser = await UserModel.findOne({
        email,
        _id: { $ne: userId },
        isDeleted: false,
      });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          status: 409,
          message: 'User with this email already exists',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Update user
    const updateData = {
      ...(email && { email }),
      ...(name && { name }),
      ...(role && { role }),
      ...(isActive !== undefined && { isActive }),
      updatedBy: req.user?.id,
    };

    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: userId, isDeleted: false },
      updateData,
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .select('-password'); // Exclude password from response

    if (!updatedUser) {
      return notFoundResponse(res, 'User not found');
    }

    return updatedResponse(res, 'User updated successfully', updatedUser);
  });

  /**
   * Delete a user by ID (soft delete)
   */
  deleteUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const deletedUser = await UserModel.findOneAndUpdate(
      { _id: userId, isDeleted: false },
      {
        isDeleted: true,
        isActive: false,
        deletedBy: req.user?.id,
        deletedAt: new Date(),
      },
      { new: true }
    );

    if (!deletedUser) {
      return notFoundResponse(res, 'User not found');
    }

    return deletedResponse(res, 'User deleted successfully');
  });

  /**
   * Get user statistics
   */
  getUserStats = asyncHandler(async (req, res) => {
    const stats = await UserModel.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: {
              $cond: [{ $and: [{ $eq: ['$isActive', true] }, { $eq: ['$isDeleted', false] }] }, 1, 0]
            }
          },
          inactive: {
            $sum: {
              $cond: [{ $and: [{ $eq: ['$isActive', false] }, { $eq: ['$isDeleted', false] }] }, 1, 0]
            }
          },
          deleted: {
            $sum: {
              $cond: [{ $eq: ['$isDeleted', true] }, 1, 0]
            }
          },
        }
      }
    ]);

    const result = stats[0] || { total: 0, active: 0, inactive: 0, deleted: 0 };

    return successResponse(res, HTTP_STATUS.OK, 'User statistics retrieved successfully', result);
  });
}

// Create controller instance
const userController = new UserController();

// Export standardized methods
export const {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserStats,
} = userController;

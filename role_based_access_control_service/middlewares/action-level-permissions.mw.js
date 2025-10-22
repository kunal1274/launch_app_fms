// middleware/roleMiddleware.js
/**
 * checkPermissions(requiredPermissions: string[])
 *   -> A middleware that ensures the logged-in user has ALL of the required permissions.
 */
export const checkPermissions = (requiredPermissions = []) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'User is not authenticated.' });
      }

      // Gather all permissions from the user's assigned user roles
      const userRoles = req.user.userRoles || [];
      const userPermissions = new Set();
      userRoles.forEach((role) => {
        role.permissions.forEach((perm) => userPermissions.add(perm));
      });

      // Check if the user has all required permissions
      const hasAllPermissions = requiredPermissions.every((perm) =>
        userPermissions.has(perm)
      );

      if (!hasAllPermissions) {
        return res.status(403).json({
          message: 'Access denied. You do not have the required permissions.',
        });
      }

      // If user passes the check, move on
      next();
    } catch (error) {
      console.error(error);
      return res
        .status(403)
        .json({ message: 'Access denied due to an unexpected error.' });
    }
  };
};

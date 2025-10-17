// middleware/authorize.js

import { PermissionModel } from "../role_based_access_control_service/models/permission.model.js";
import { UserRoleModel } from "../role_based_access_control_service/models/userRole.model.js";

/**
 * require a permission key (e.g. "TEMPLATE_CREATE")
 */
export default function authorize(requiredPermKey) {
  return async (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ status: "failure", message: "Unauthenticated" });
    }

    // 1) load all roles for this user
    const roles = await UserRoleModel.find({
      _id: { $in: req.user.userRoles },
    })
      .select("permissions")
      .lean();

    // 2) collect all permission _ids
    const allPermIds = roles.flatMap((r) => r.permissions);

    // 3) check that one of those _ids corresponds to our required key
    const has = await PermissionModel.exists({
      _id: { $in: allPermIds },
      key: requiredPermKey,
    });

    if (!has) {
      return res.status(403).json({
        status: "failure",
        message: "Forbidden: insufficient permissions",
      });
    }

    next();
  };
}

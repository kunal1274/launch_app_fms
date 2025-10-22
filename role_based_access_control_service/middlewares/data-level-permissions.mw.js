// middleware/dataScopeMiddleware.js

/**
 * applyDataScope(resource: string)
 *   -> A middleware that inspects the user's userRoles
 *      and merges all relevant data-scope constraints for that resource
 *      into req.scopeFilter.
 */
export const applyDataScope = (resource) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'User is not authenticated.' });
      }

      const userRoles = req.user.userRoles || [];

      // Initialize an empty filter. We'll fill it with constraints from all groups.
      let combinedFilter = {};

      userRoles.forEach((role) => {
        if (role.scopes && role.scopes[resource]) {
          const resourceScope = role.scopes[resource];

          /*
              Example: 
              role.scopes.CUSTOMER might be: { region: "domestic" }
              or { region: "domestic", status: "active" }
              
              This is a naive approach: we simply combine them. 
              In real scenarios, if the user belongs to multiple groups, 
              you might want to unify them in a certain way (e.g. "OR" or "AND"). 
              We'll assume "AND" logic for simplicity:
              
              combinedFilter.region = 'domestic'
              combinedFilter.status = 'active'
            */

          // Merge resourceScope into combinedFilter
          // We'll do a shallow merge. If you want advanced logic, adapt it here.
          Object.entries(resourceScope).forEach(([key, val]) => {
            // If user belongs to multiple groups with conflicting scope,
            // you have to define your own logic. We'll just overwrite for now.
            combinedFilter[key] = val;
          });
        }
      });

      // Attach to the request for the controller to use
      req.scopeFilter = combinedFilter;

      next();
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Error applying data scope.' });
    }
  };
};

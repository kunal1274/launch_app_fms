# Documentation and Test Scripts Organization Summary

## Overview
This document summarizes the organization of documentation and test scripts in the FMS backend application.

## Documentation Organization (`docs/` folder)

### Root-level Documentation Files Moved:
- `API_DOCUMENTATION.md` - API documentation
- `COMPONENTS_DOCUMENTATION.md` - Components documentation  
- `MODELS_DOCUMENTATION.md` - Models documentation
- `README_DOCUMENTATION.md` - Main README documentation
- `INTEGRATION_GUIDE.md` - Integration guide
- `Overview.md` - Project overview

### Subdirectory Documentation Files Moved:
- Various `.md` files from controllers, routes, services, and other directories
- Route documentation files (e.g., `account.routes.md`, `bank.routes.md`)
- Controller documentation files (e.g., `cashJournal.controller.md`)
- Service documentation files (e.g., `voucher.service.md`)

### Existing Documentation Structure:
- `modules/` - Module-specific documentation
  - `INVENTORY_MANAGEMENT.md`
  - `PURCHASE_MANAGEMENT.md` 
  - `SALES_MANAGEMENT.md`
- `standards/` - Coding standards and guidelines
  - `CODING_STANDARDS.md`
  - `EXTENSIBILITY_GUIDELINES.md`
  - `QUICK_REFERENCE.md`

## Test Scripts Organization (`test-scripts/` folder)

### Test Files Moved:
- All files from `test/` directory
- All files from `tests/` directory
- Seed files from `seeds/` directory:
  - `seedRolePermissions.js`
  - `seedRoles.js`
- Environment test file: `.env.test`

### Test Scripts Structure:
- `e2e/` - End-to-end tests
  - `complete-workflow.e2e.test.js`
- `integration/` - Integration tests
  - `account.integration.test.js`
  - `inventory.integration.test.js`
  - `purchaseorder.integration.test.js`
  - `salesorder.integration.test.js`
- `unit/` - Unit tests
  - `customer-vendor-standardization.test.js`
  - `standardized-modules.test.js`
- `helpers/` - Test helper files
  - `apiTestHelpers.js`
  - `testDataFactory.js`
- Flow runner scripts:
  - `flowRunner.js` and variants
  - `flowRunner-release-v1.js`
  - `flowRunnerWithErrorCatch.js`
  - `flowRunnerWithEvidenceOnFly.js`
- Setup and utility scripts:
  - `setup-frontend.sh`
  - `start-dev-servers.sh`
  - `test-frontend-backend.js`
  - `generate-report.js`
  - `run-tests.js`
  - `setup.js`

## Benefits of This Organization:

1. **Centralized Documentation**: All documentation is now in one place (`docs/`) making it easier to find and maintain
2. **Centralized Testing**: All test-related files are organized in `test-scripts/` with clear subdirectories for different test types
3. **Clean Root Directory**: The root directory is now cleaner with documentation and test files properly organized
4. **Better Maintainability**: Easier to locate and update documentation and test files
5. **Clear Separation**: Clear separation between production code, documentation, and test scripts

## File Structure After Organization:

```
launch_app_fms/
├── docs/                    # All documentation files
│   ├── modules/            # Module-specific docs
│   ├── standards/          # Coding standards
│   └── *.md               # Various documentation files
├── test-scripts/           # All test-related files
│   ├── e2e/               # End-to-end tests
│   ├── integration/       # Integration tests
│   ├── unit/              # Unit tests
│   ├── helpers/           # Test helpers
│   └── *.js, *.sh         # Test scripts and utilities
└── [other production code directories]
```

This organization follows best practices for project structure and makes the codebase more maintainable and accessible.

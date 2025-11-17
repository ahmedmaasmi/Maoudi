# Bug Report - Voice Appointment Booking System

## Critical Bugs

### 1. **TypeScript Compilation Errors**

#### 1.1 Missing Type Annotations in `apps/api/src/routes/doctors.ts`
- **Lines 39, 46-47**: Parameters have implicit `any` types
- **Issue**: TypeScript strict mode requires explicit types
- **Location**: 
  - Line 39: `doctor` parameter in `.map()`
  - Line 46: `doctor` parameter in `.filter()`
  - Line 47: `a` and `b` parameters in `.sort()`

#### 1.2 Missing Dependency: `google-auth-library`
- **File**: `apps/api/src/services/calendar.ts:2`
- **Issue**: Import `OAuth2Client` from `google-auth-library` but package is not in dependencies
- **Impact**: Code will fail at runtime

#### 1.3 Type Error in NLU Service
- **File**: `apps/api/src/services/nlu.ts:161`
- **Issue**: `data` is of type `unknown` and needs type assertion
- **Location**: Line 161 in `enhanceWithOllama` function

### 2. **SQLite Case-Insensitive Query Issue**

- **File**: `apps/api/src/routes/doctors.ts:32`
- **Issue**: Using `mode: "insensitive"` with SQLite, which doesn't support case-insensitive queries
- **Impact**: Will throw runtime error: "Unknown arg `mode` in where.specialty.contains"
- **Fix**: Remove `mode: "insensitive"` or use case-insensitive comparison manually

### 3. **Multiple PrismaClient Instances**

- **Issue**: Each route file and service creates its own `PrismaClient` instance
- **Files Affected**:
  - `apps/api/src/index.ts:22`
  - `apps/api/src/routes/auth.ts:9`
  - `apps/api/src/routes/appointments.ts:8`
  - `apps/api/src/routes/doctors.ts:9`
  - `apps/api/src/routes/health.ts:5`
  - `apps/api/src/services/calendar.ts:6`
- **Impact**: 
  - Connection pool exhaustion
  - Performance degradation
  - Potential database connection issues
- **Fix**: Use singleton pattern with a shared PrismaClient instance

### 4. **API Key Authentication Not Applied**

- **Issue**: `apiKeyAuth` middleware exists but is never used
- **File**: `apps/api/src/middleware/auth.ts`
- **Impact**: MCP client expects API key authentication, but routes don't enforce it
- **Fix**: Apply `apiKeyAuth` middleware to protected routes (or exclude public routes)

## Medium Priority Issues

### 5. **Date Comparison Bug in BookingFlow**

- **File**: `apps/web/components/BookingFlow.tsx:241`
- **Issue**: Comparing date strings directly: `state.selectedSlot?.start === slot.start`
- **Impact**: May not work correctly due to string comparison vs date comparison
- **Fix**: Compare ISO strings or convert to Date objects

### 6. **Missing Error Handling in Calendar Service**

- **File**: `apps/api/src/services/calendar.ts`
- **Issue**: `getCalendarClient` throws generic Error instead of `AppError`
- **Impact**: Error handling middleware may not format errors correctly
- **Fix**: Use `AppError` class for consistent error handling

### 7. **Potential Memory Leak: OAuth States Map**

- **File**: `apps/api/src/routes/auth.ts:12`
- **Issue**: `oauthStates` Map grows indefinitely (only cleaned every 10 minutes)
- **Impact**: Memory leak in long-running server
- **Fix**: Use Redis or implement more aggressive cleanup

### 8. **Missing Validation for Optional Parameters**

- **File**: `apps/api/src/routes/doctors.ts`
- **Issue**: `specialty` parameter validation allows empty string after trimming
- **Impact**: Could return all doctors if specialty is empty
- **Fix**: Add proper validation

### 9. **CORS Regex Pattern Issue**

- **File**: `apps/api/src/index.ts:37`
- **Issue**: Regex pattern `origin.match(new RegExp(allowed.replace("*", ".*")))` may not handle all cases correctly
- **Impact**: CORS might block legitimate requests or allow unauthorized ones
- **Fix**: Use proper CORS origin validation library

### 10. **Missing Type Export in Shared Package**

- **File**: `packages/shared/src/index.ts`
- **Issue**: Only exports from `types` and `schemas`, but `NLUResult` type is used in API but may not be properly exported
- **Impact**: Type inconsistencies between packages

## Low Priority / Code Quality Issues

### 11. **Inconsistent Error Messages**

- **Issue**: Some errors use `AppError`, others throw generic `Error`
- **Files**: Multiple service files
- **Fix**: Standardize on `AppError` throughout

### 12. **Hardcoded Default Location**

- **File**: `apps/web/components/VoiceChat.tsx:98-99`
- **Issue**: Defaults to NYC coordinates (40.7128, -74.0060)
- **Impact**: May confuse users in other locations
- **Fix**: Use better default or require location input

### 13. **Missing Prisma Client Cleanup**

- **File**: `apps/api/src/routes/health.ts`
- **Issue**: Creates PrismaClient but never disconnects
- **Impact**: Connection leaks on health check endpoint
- **Fix**: Reuse shared PrismaClient or properly disconnect

### 14. **No Input Sanitization**

- **Issue**: User inputs (especially in NLU parsing) are not sanitized
- **Impact**: Potential security issues
- **Fix**: Add input sanitization

### 15. **Missing Environment Variable Validation**

- **Issue**: No validation that required env vars are set at startup
- **Impact**: Runtime errors instead of clear startup errors
- **Fix**: Add startup validation

## Configuration Issues

### 16. **Missing TypeScript Path Mapping**

- **File**: `apps/api/tsconfig.json`
- **Issue**: Paths defined but may not work with `tsc-alias` in all cases
- **Fix**: Verify path resolution works correctly

### 17. **Missing Build Script for MCP**

- **File**: `apps/mcp/package.json`
- **Issue**: Has `build` script but no `type-check` script
- **Impact**: Inconsistent with other packages

## Summary

**Total Issues Found**: 17
- **Critical**: 4 (TypeScript errors, SQLite issue, PrismaClient instances, missing auth)
- **Medium**: 6 (Date comparison, error handling, memory leaks, validation)
- **Low**: 7 (Code quality, configuration)

**Recommended Priority**:
1. Fix TypeScript compilation errors (blocks build)
2. Fix SQLite case-insensitive query (runtime error)
3. Consolidate PrismaClient instances (performance)
4. Apply API key authentication (security)
5. Fix remaining issues in order of impact


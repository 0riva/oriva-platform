# Work Buddy Integration Requirements - Profile Filtering Updates

**Document Version**: 1.0
**Last Updated**: 2025-01-19
**Target Integration**: Work Buddy Team
**Change Type**: Breaking Changes - Anonymous Profile Filtering

## Overview

Oriva has implemented enhanced privacy protection by filtering anonymous profiles from third-party API access. This document outlines the changes and provides integration requirements for the Work Buddy team to ensure continued functionality.

## What Changed

### Anonymous Profile Filtering Implementation
- **Anonymous profiles are no longer exposed** via the Platform API
- Only profiles with `is_anonymous: false` are returned to third-party applications
- This change affects all profile-related endpoints used by Work Buddy

### Technical Details
- **API Endpoint**: `/api/profiles` and related profile endpoints
- **Filtering Logic**: Profiles where `is_anonymous = true` are excluded from API responses
- **Data Impact**: Users may have fewer profiles visible to third-party apps

## API Response Changes

### Before (Old Behavior)
```json
{
  "profiles": [
    {
      "id": "profile-123",
      "name": "John Doe",
      "is_anonymous": false,
      "is_active": true,
      "created_at": "2024-01-10T10:00:00Z"
    },
    {
      "id": "profile-456",
      "name": "Anonymous User",
      "is_anonymous": true,
      "is_active": true,
      "created_at": "2024-01-01T08:00:00Z"
    }
  ]
}
```

### After (New Behavior)
```json
{
  "profiles": [
    {
      "id": "profile-123",
      "name": "John Doe",
      "is_anonymous": false,
      "is_active": true,
      "created_at": "2024-01-10T10:00:00Z"
    }
  ]
}
```

## Integration Requirements for Work Buddy

### 1. Handle Reduced Profile Counts
- **Issue**: Users previously showing 2+ profiles may now show fewer profiles
- **Required Action**: Update UI logic to handle cases where profile arrays have fewer items
- **Recommendation**: Implement graceful fallbacks for single-profile users

### 2. Profile Display Logic Updates
- **Current Problem**: Work Buddy may expect multiple profiles but receive fewer due to filtering
- **Required Changes**:
  - Remove assumptions about minimum profile counts
  - Update profile selection UI to handle single-profile scenarios
  - Ensure profile display works with variable profile counts

### 3. Error Handling Enhancement
- **Add Validation**: Check if profile array is empty or has unexpected counts
- **User Messaging**: Provide clear messaging when users have limited profiles available
- **Fallback Behavior**: Define behavior when no profiles are returned

### 4. Data Mapping Updates
- **Profile Access**: Only access profiles that exist in the filtered response
- **Index Safety**: Avoid hardcoded array indices (e.g., `profiles[1]`) that may no longer exist
- **Dynamic Handling**: Implement dynamic profile handling based on actual response data

## Specific Work Buddy Integration Points

### Profile Selection Component
**Current Implementation May Have**:
```javascript
// Potentially problematic assumptions
const userProfiles = await fetchUserProfiles();
const primaryProfile = userProfiles[0];
const workProfile = userProfiles[1]; // May not exist after filtering
```

**Required Update**:
```javascript
// Safe profile handling
const userProfiles = await fetchUserProfiles();
const profiles = userProfiles || [];

if (profiles.length === 0) {
  // Handle no profiles scenario
  showNoProfilesMessage();
  return;
}

const primaryProfile = profiles[0];
const hasMultipleProfiles = profiles.length > 1;

if (hasMultipleProfiles) {
  // Show profile selection UI
  showProfileSelector(profiles);
} else {
  // Single profile mode
  useProfile(primaryProfile);
}
```

### Appointment Creation Flow
**Ensure appointments can be created** even when users have fewer profiles:
```javascript
// Before: Assumed multiple profiles
const selectedProfile = profiles[userSelectedIndex];

// After: Validate profile exists
const selectedProfile = profiles[userSelectedIndex] || profiles[0];
if (!selectedProfile) {
  throw new Error('No valid profile available for appointment creation');
}
```

### User Dashboard
**Update dashboard to handle** variable profile counts:
- Modify profile switcher component
- Update analytics that depend on profile counts
- Ensure no UI breaks when fewer profiles are available

## Testing Scenarios

### Test Case 1: User with Anonymous + Custom Profile
- **Expected**: Only custom profile returned via API
- **Work Buddy Should**: Display single profile correctly, no errors
- **Test Steps**:
  1. Create user with 1 anonymous + 1 custom profile
  2. Call profile API endpoint
  3. Verify only custom profile is returned
  4. Verify Work Buddy displays correctly

### Test Case 2: User with Multiple Custom Profiles
- **Expected**: All custom profiles returned (no change from before)
- **Work Buddy Should**: Function normally as before
- **Test Steps**:
  1. Create user with 2+ custom profiles (no anonymous)
  2. Call profile API endpoint
  3. Verify all profiles are returned
  4. Verify Work Buddy functions normally

### Test Case 3: User with Only Anonymous Profile
- **Expected**: Empty profile array returned
- **Work Buddy Should**: Handle gracefully with appropriate user messaging
- **Test Steps**:
  1. Create user with only anonymous profile
  2. Call profile API endpoint
  3. Verify empty array is returned
  4. Verify Work Buddy shows appropriate message

### Test Case 4: Profile Switching
- **Expected**: Only non-anonymous profiles available for switching
- **Work Buddy Should**: Update profile switcher to show available profiles
- **Test Steps**:
  1. Test profile switching with filtered profiles
  2. Verify no attempts to access filtered profiles
  3. Verify smooth switching between available profiles

## Migration Timeline

### Immediate Actions Required (Week 1)
1. **Code Review**: Review current profile handling logic in Work Buddy
2. **Identify Dependencies**: Find all code that assumes specific profile counts
3. **Plan Updates**: Create implementation plan for required changes

### Implementation Phase (Week 2-3)
1. **UI Updates**: Update profile selection and display components
2. **Error Handling**: Add validation for profile array contents
3. **Testing**: Test with new API responses that have fewer profiles
4. **Safety Checks**: Add guards against array index errors

### Validation Phase (Week 4)
1. **Integration Testing**: Test with Oriva staging environment
2. **User Acceptance**: Test with real users who have mixed profile types
3. **Edge Case Testing**: Verify handling of empty profile arrays
4. **Performance Testing**: Ensure no performance degradation

## Technical Support

### API Documentation
- **Base URL**: Platform API endpoints remain the same
- **Authentication**: No changes to authentication requirements
- **Rate Limits**: No changes to existing rate limits
- **Error Codes**: New potential scenarios for empty profile arrays

### Staging Environment
- **Testing URL**: Available for Work Buddy team testing
- **Test Users**: Provided with various profile configurations
- **Support**: Technical support available during migration

### Contact Information
- **Technical Questions**: Oriva Platform Team
- **Integration Support**: Available during migration period
- **Emergency Contact**: For critical issues during migration

## Security & Privacy Benefits

### Enhanced Privacy Protection
- Anonymous profiles remain private to Oriva users
- Third-party apps cannot access or store anonymous profile data
- Improved compliance with privacy regulations

### Data Minimization
- Reduced data exposure to third-party applications
- Only intentionally created profiles are shared externally
- Better alignment with privacy-by-design principles

### User Control
- Users maintain control over which profiles are visible externally
- Anonymous profiles provide true privacy for sensitive activities
- Clear separation between public and private profile data

## Appendix A: Code Examples

### Safe Profile Access Pattern
```javascript
// Utility function for safe profile access
function getValidProfiles(profiles) {
  if (!Array.isArray(profiles)) {
    return [];
  }
  return profiles.filter(profile =>
    profile && profile.id && !profile.is_anonymous
  );
}

// Usage in components
const profiles = getValidProfiles(await fetchUserProfiles());
if (profiles.length === 0) {
  handleNoProfilesScenario();
} else {
  handleProfilesAvailable(profiles);
}
```

### Profile Selection Component Update
```javascript
// Before (Risky)
function ProfileSelector({ profiles }) {
  const [selected, setSelected] = useState(0);
  return (
    <select onChange={(e) => setSelected(e.target.value)}>
      {profiles.map((profile, index) => (
        <option key={profile.id} value={index}>
          {profile.name}
        </option>
      ))}
    </select>
  );
}

// After (Safe)
function ProfileSelector({ profiles = [] }) {
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (profiles.length > 0 && selected === null) {
      setSelected(0);
    }
  }, [profiles]);

  if (profiles.length === 0) {
    return <div>No profiles available</div>;
  }

  return (
    <select
      value={selected || 0}
      onChange={(e) => setSelected(parseInt(e.target.value))}
    >
      {profiles.map((profile, index) => (
        <option key={profile.id} value={index}>
          {profile.name}
        </option>
      ))}
    </select>
  );
}
```

## Appendix B: API Error Handling

### New Error Scenarios
```javascript
// Handle empty profiles gracefully
try {
  const profiles = await fetchUserProfiles();

  if (!profiles || profiles.length === 0) {
    // New scenario: User has no accessible profiles
    showCreateProfilePrompt();
    return;
  }

  // Continue with normal flow
  handleProfiles(profiles);

} catch (error) {
  if (error.code === 'NO_ACCESSIBLE_PROFILES') {
    // Handle no profiles scenario
    showNoProfilesMessage();
  } else {
    // Handle other errors
    showGenericError();
  }
}
```

---

**Document Status**: Ready for Work Buddy Team Review
**Next Steps**: Work Buddy team implementation and testing
**Review Required**: Before production deployment of profile filtering changes
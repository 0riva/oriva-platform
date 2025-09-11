# 🔒 Privacy Protection Guide

> **Comprehensive guide to building privacy-first applications with the Oriva Platform API**

## 🎯 **Overview**

The Oriva Platform API is built with **privacy by design** principles to protect user data and prevent cross-profile linking. This guide explains how to build applications that respect user privacy while providing powerful functionality.

---

## 🛡️ **Privacy-First Design Principles**

### **1. Complete ID Sanitization**
- **Internal IDs**: Oriva Core uses internal UUIDs for all entities
- **External IDs**: All IDs exposed to extensions are prefixed (`ext_`, `ext_member_`) and cannot be linked to internal data
- **Hash Generation**: Internal IDs are hashed with extension-specific salts
- **No Reversibility**: External IDs cannot be reversed to internal IDs

### **2. User-Controlled Authorization**
- **Explicit Consent**: Users must explicitly authorize which profiles/groups each extension can access
- **Granular Control**: Different extensions can have access to different profiles/groups
- **Revocable Access**: Users can revoke access at any time
- **Audit Trail**: All access is logged for privacy compliance

### **3. Minimal Data Exposure**
- **Display Names Only**: Only user-defined display names, no usernames or internal identifiers
- **No Personal Information**: No email addresses, contact information, or system metadata
- **No Relationships**: No information about relationships between entities
- **No Temporal Data**: No creation dates, modification timestamps, or activity information

### **4. Cross-Profile Protection**
- **Profile Isolation**: Each profile appears as a completely separate entity to extensions
- **No Linking**: Extensions cannot determine if profiles belong to the same user
- **Context Switching**: Complete context switch when switching profiles
- **Data Persistence**: Previous profile data is not accessible after switching

---

## 🔐 **Privacy Protection Features**

### **Profile Privacy Protection**

#### **Data Isolation**
Each profile appears as a completely separate entity to extensions:
- **Sanitized IDs**: All profile IDs are prefixed with `ext_` and contain no internal Oriva Core identifiers
- **No Cross-Profile Linking**: Extensions cannot determine if two profiles belong to the same user
- **Minimal Data Exposure**: Only essential profile information is exposed (name, active status)
- **User-Controlled Access**: Users explicitly authorize which profiles each extension can access

#### **Profile Switching**
When users switch profiles within an extension:
- **Complete Context Switch**: All profile data is immediately replaced
- **No Data Persistence**: Previous profile data is not accessible
- **Isolated Sessions**: Each profile operates in complete isolation

### **Group Privacy Protection**

#### **Member Anonymization**
Group member data is carefully sanitized:
- **Sanitized Member IDs**: All member IDs use `ext_member_` prefix with no internal identifiers
- **Display Names Only**: Only display names are shown, no usernames or internal IDs
- **No User Linking**: Extensions cannot link group members to user accounts
- **Role-Based Access**: Only necessary role information is exposed

#### **Group Visibility**
Extensions only see groups the user has explicitly authorized:
- **User Authorization Required**: Each group requires explicit user permission
- **Granular Control**: Users can authorize specific groups per extension
- **Revocable Access**: Users can revoke group access at any time

---

## 🚀 **Getting Started with Privacy-First Development**

### **Step 1: Declare Required Permissions**

In your app's manifest, declare the permissions you need:

```json
{
  "permissions": [
    "profiles:read",
    "profiles:write", 
    "groups:read",
    "groups:write"
  ]
}
```

### **Step 2: User Authorization Flow**

When a user installs your extension:

1. **Permission Request**: Oriva Core shows the user what data your app wants to access
2. **Profile Selection**: User chooses which profiles your app can access (e.g., "Work Profile" but not "Dating Profile")
3. **Group Selection**: User chooses which groups your app can access
4. **Granular Control**: User can authorize different profiles/groups for different apps

### **Step 3: Dynamic Authorization**

Users can modify permissions at any time:
- **Add Access**: Grant access to additional profiles/groups
- **Revoke Access**: Remove access to specific profiles/groups
- **Complete Revocation**: Remove all access to your app

---

## 💻 **Privacy-First API Usage**

### **Profile Management**

```javascript
// Get available profiles (only those user authorized)
const profiles = await fetch('/api/v1/profiles/available', {
  headers: { 'Authorization': 'Bearer your-api-key' }
});

// Example response:
// {
//   "success": true,
//   "data": [
//     {
//       "profileId": "ext_1234567890abcdef",
//       "profileName": "Work Profile",
//       "isActive": true
//     },
//     {
//       "profileId": "ext_fedcba0987654321", 
//       "profileName": "Personal Profile",
//       "isActive": false
//     }
//   ]
// }

// Switch to a different profile
await fetch('/api/v1/profiles/ext_1234567890abcdef/activate', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer your-api-key' }
});
```

### **Group Management**

```javascript
// Get user's groups (only those user authorized)
const groups = await fetch('/api/v1/groups', {
  headers: { 'Authorization': 'Bearer your-api-key' }
});

// Example response:
// {
//   "success": true,
//   "data": [
//     {
//       "groupId": "ext_9876543210fedcba",
//       "groupName": "Work Team Alpha",
//       "memberCount": 5,
//       "isActive": true
//     }
//   ]
// }

// Get group members (sanitized data only)
const members = await fetch('/api/v1/groups/ext_9876543210fedcba/members', {
  headers: { 'Authorization': 'Bearer your-api-key' }
});

// Example response:
// {
//   "success": true,
//   "data": [
//     {
//       "memberId": "ext_member_1234567890",
//       "displayName": "Alex Johnson",
//       "role": "admin",
//       "joinedAt": "2024-01-15T10:00:00Z"
//     }
//   ]
// }
```

---

## ⚠️ **Important Privacy Notes**

### **What You CANNOT Do**
- **Cross-Profile Linking**: You cannot determine if two profiles belong to the same user
- **Internal ID Access**: You cannot access internal Oriva Core identifiers
- **User Account Linking**: You cannot link group members to user accounts
- **Historical Data**: You cannot access creation dates or modification timestamps
- **Relationship Data**: You cannot access information about relationships between entities

### **What You CAN Do**
- **Display Names**: Access user-defined display names for profiles and group members
- **Role Information**: Access group roles (admin, moderator, member)
- **Active Status**: Check if profiles/groups are currently active
- **Member Counts**: Access total member counts for groups
- **Join Dates**: Access when members joined groups (date only)

---

## 🔧 **Technical Privacy Measures**

### **ID Sanitization Process**
1. **Internal IDs**: Oriva Core uses internal UUIDs for all entities
2. **Hash Generation**: Internal IDs are hashed with extension-specific salts
3. **External IDs**: Hashed values are prefixed (`ext_`, `ext_member_`) for external use
4. **No Reversibility**: External IDs cannot be reversed to internal IDs

### **Data Minimization**
- **Only Required Fields**: Extensions receive only the minimum data necessary
- **No Metadata**: No creation dates, internal timestamps, or system metadata
- **No Relationships**: No information about relationships between entities

### **Access Control**
- **Extension-Specific Permissions**: Each extension has isolated permission sets
- **User Consent**: All access requires explicit user authorization
- **Audit Trail**: All access is logged for privacy compliance

---

## 🧪 **Testing Privacy Protection**

### **Privacy Testing Checklist**

#### **Profile Privacy Tests**
- [ ] Verify profile IDs are prefixed with `ext_`
- [ ] Confirm no internal Oriva Core IDs are exposed
- [ ] Test that profiles cannot be linked to user accounts
- [ ] Verify no temporal metadata is exposed
- [ ] Confirm no relationship data is accessible

#### **Group Privacy Tests**
- [ ] Verify group IDs are prefixed with `ext_`
- [ ] Confirm member IDs use `ext_member_` prefix
- [ ] Test that only display names are shown
- [ ] Verify no usernames or internal identifiers are exposed
- [ ] Confirm no contact information is accessible

#### **Cross-Profile Protection Tests**
- [ ] Verify profiles cannot be linked to the same user
- [ ] Test that user account information is not exposed
- [ ] Confirm no cross-profile data leakage
- [ ] Verify complete context switching between profiles

### **Automated Privacy Testing**

```javascript
// Example privacy test
describe('Privacy Protection', () => {
  test('should not expose internal IDs', async () => {
    const response = await fetch('/api/v1/profiles/available', {
      headers: { 'Authorization': 'Bearer test-api-key' }
    });
    
    const data = await response.json();
    
    // Verify all profile IDs are prefixed
    data.data.forEach(profile => {
      expect(profile.profileId).toMatch(/^ext_[a-f0-9]{16}$/);
    });
    
    // Verify no internal IDs are present
    expect(JSON.stringify(data)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
  });
});
```

---

## 📚 **Best Practices**

### **1. Request Minimal Permissions**
- Only request permissions you actually need
- Justify each permission in your app description
- Provide clear explanations of how data will be used

### **2. Handle Authorization Gracefully**
- Always check if users have granted required permissions
- Provide clear error messages when access is denied
- Offer alternative functionality when permissions are limited

### **3. Respect User Choices**
- Don't try to work around permission restrictions
- Honor user decisions about data sharing
- Provide easy ways for users to modify permissions

### **4. Implement Privacy by Design**
- Build privacy protection into your app architecture
- Use the sanitized IDs provided by the API
- Don't attempt to reverse-engineer internal data

### **5. Regular Privacy Audits**
- Regularly review what data your app accesses
- Test privacy protection measures
- Update your app to use new privacy features

---

## 🆘 **Privacy Support**

### **Getting Help**
- **Privacy Questions**: Use the support system within Oriva Core
- **Technical Issues**: [GitHub Issues](https://github.com/0riva/oriva-platform/issues)
- **Best Practices**: [GitHub Discussions](https://github.com/0riva/oriva-platform/discussions)

### **Privacy Compliance**
- **GDPR Compliance**: Oriva's privacy-first design helps ensure GDPR compliance
- **Data Minimization**: Only essential data is exposed to extensions
- **User Control**: Users have complete control over their data sharing
- **Audit Trail**: All access is logged for compliance purposes

---

## 🎯 **Conclusion**

The Oriva Platform API provides powerful privacy protection features that allow you to build applications that respect user privacy while providing rich functionality. By following the principles and practices outlined in this guide, you can create applications that users trust with their data.

**Key Takeaways:**
- ✅ **Privacy by Design**: Build privacy protection into your app architecture
- ✅ **User Control**: Respect user choices about data sharing
- ✅ **Minimal Data**: Only access the data you actually need
- ✅ **Secure Implementation**: Use the provided privacy protection features
- ✅ **Regular Audits**: Continuously review and improve your privacy practices

---

**Built with 🔒 by the Oriva Team**

Ready to build privacy-first applications? Get started with the [Developer Start Guide](START_GUIDE.md) today!

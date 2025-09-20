# API Key Display Bug - Root Cause Analysis

**Investigation Date**: 2025-09-19
**Status**: ROOT CAUSE IDENTIFIED
**Severity**: HIGH - Data inconsistency in user interface

## 🔍 **Problem Summary**

Work Buddy app page shows inconsistent API keys that don't match the database:
- User created key ending with `af15`
- UI shows keys ending with `17ad` and `e1d7` (which are key IDs, not actual key suffixes)
- Keys keep changing on page refresh despite stable database state

## 🧭 **Root Cause Analysis**

### **Primary Issue: Backend API Logic Flaw**

**Location**: `/Users/cosmic/Documents/oriva-platform/api/index.js` line 914

```javascript
// BUGGY CODE:
key: `${key.key_prefix + '•'.repeat(24)  }••••`, // Show prefix and masked key
```

**Problem**: The backend API is creating a "fake" masked key by combining:
1. `key_prefix` (first 20 characters)
2. 24 bullet points
3. 4 more bullet points (••••)

This creates a display string that looks like a masked key but doesn't contain the actual key suffix.

### **Secondary Issue: Frontend Display Logic**

**Location**: `/Users/cosmic/Documents/oriva-core/src/screens/AppDetailsScreen.tsx` line 888

```typescript
// PROBLEMATIC CODE:
{key.key || _maskKey(key.key_prefix, key.id)}

const _maskKey = (keyPrefix: string, keyId: string): string => {
  return `${keyPrefix}${'•'.repeat(24)}${keyId.substring(keyId.length - 4)}`;
};
```

**Problem**: When `key.key` is null/undefined (which it is for existing keys), the code falls back to `_maskKey()` which uses the **keyId** (UUID) instead of the actual key suffix.

## 📊 **Data Flow Analysis**

### **What Should Happen**:
```
Database: key_hash + key_prefix (first 20 chars) + full key (only on creation)
Backend API: Return actual key suffix for display
Frontend: Show "oriva_pk_live_...••••••••••••••••••••••••af15"
```

### **What Actually Happens**:
```
Database: ✅ key_hash + key_prefix stored correctly
Backend API: ❌ Returns fake masked key with bullet points only
Frontend: ❌ Falls back to keyId (UUID) for masking: "17ad", "e1d7"
```

## 🎯 **Evidence Collected**

### **Backend API Evidence**:
- Line 914: `key: '${key.key_prefix + '•'.repeat(24)}••••'` creates meaningless display
- Line 901: Only selects `key_prefix`, not storing actual key suffix
- No mechanism to show real key ending

### **Frontend Evidence**:
- Line 888: Attempts to use `key.key` (which is null for existing keys)
- Line 380-383: `_maskKey()` function incorrectly uses `keyId` instead of key suffix
- Shows last 4 chars of UUID instead of actual API key

### **Database Schema Issues**:
- Only stores `key_hash` and `key_prefix`
- No field for storing the last 4 characters of actual key for display
- Security design prevents reconstruction of original key

## 🚨 **Why Keys Keep Changing**

The displayed "keys" ending with `17ad` and `e1d7` are actually:
1. `17ad` = last 4 chars of first API key's UUID ID
2. `e1d7` = last 4 chars of second API key's UUID ID

Since these are generated UUID fragments, they appear random and don't correspond to any actual API key values.

## 🛠️ **Solution Requirements**

### **Option 1: Store Key Suffix in Database (Recommended)**
- Add `key_suffix` column to store last 4-8 characters of actual key
- Update key creation to store this suffix
- Modify API to return real suffix for display

### **Option 2: Fix Display Logic Only**
- Remove the fake masking from backend API
- Update frontend to handle keys without full access appropriately
- Show "Hidden" or "••••" instead of fake key endings

### **Option 3: Regenerate Keys with Proper Suffix Storage**
- Require users to regenerate keys with new storage format
- Implement migration for existing keys

## 🎯 **Recommended Fix**

Implement **Option 1** with database schema update:

1. **Database**: Add `key_suffix` VARCHAR(8) column
2. **Backend**: Store last 4-8 chars during key creation
3. **API**: Return real suffix for masking
4. **Frontend**: Display actual key endings

This maintains security while providing accurate user display.

## 📋 **Impact Assessment**

- **Security**: No impact (still hashed storage)
- **User Experience**: HIGH improvement (consistent, accurate display)
- **Development Effort**: Medium (database migration + code updates)
- **Breaking Changes**: None (additive changes only)

## 🔧 **Next Steps**

1. Implement database schema change
2. Update backend key creation and retrieval
3. Fix frontend display logic
4. Test with existing and new keys
5. Consider migration strategy for existing keys

---

**Investigation Complete**: Root cause identified as dual bug in backend API formatting and frontend fallback logic using UUID instead of actual key suffixes.
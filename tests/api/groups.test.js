/**
 * Group endpoints tests
 * Tests the new group management endpoints with TDD approach
 *
 * Architecture:
 * - Groups are created by users (groups.created_by = auth.users.id)
 * - Groups are joined by profiles (profile_memberships.profile_id = profiles.id)
 * - keyInfo.userId = auth.users.id (account ID)
 */

const request = require('supertest');
const { app } = require('../../api/index');

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => {
  const mockSupabaseClient = {
    from: jest.fn(),
  };
  return {
    createClient: jest.fn(() => mockSupabaseClient),
  };
});

const { createClient } = require('@supabase/supabase-js');
const mockSupabase = createClient();

// Mock API key validation middleware
jest.mock('../../api/index', () => {
  const originalModule = jest.requireActual('../../api/index');
  return {
    ...originalModule,
    validateApiKey: (req, res, next) => {
      // Mock API key validation - always pass for tests
      req.apiKey = 'test-api-key';
      req.keyInfo = {
        userId: 'test-user-id',
        apiKeyId: 'test-api-key-id',
      };
      next();
    },
  };
});

describe('Group Endpoints - TDD Implementation', () => {
  const testUserId = 'test-user-id';
  const testProfileId1 = 'test-profile-id-1';
  const testProfileId2 = 'test-profile-id-2';
  const testGroupId1 = 'test-group-id-1';
  const testGroupId2 = 'test-group-id-2';
  const testGroupId3 = 'test-group-id-3';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/groups', () => {
    test('should return groups user created (via created_by)', async () => {
      // Mock: User created a group
      const mockCreatedGroup = {
        id: testGroupId1,
        name: 'My Created Group',
        description: 'Group I created',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        created_by: testUserId,
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'groups') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                data: [mockCreatedGroup],
                error: null,
              })),
            })),
          };
        }
        if (table === 'profile_memberships') {
          return {
            select: jest.fn(() => ({
              in: jest.fn(() => ({
                data: [],
                error: null,
              })),
            })),
          };
        }
        if (table === 'profiles') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                data: [],
                error: null,
              })),
            })),
          };
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        };
      });

      const response = await request(app)
        .get('/api/v1/groups')
        .set('Authorization', 'Bearer test-api-key');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].groupId).toBe(testGroupId1);
      expect(response.body.data[0].groupName).toBe('My Created Group');
    });

    test('should return groups user profiles joined (via profile_memberships)', async () => {
      // Mock: User has profiles that joined groups
      const mockProfiles = [
        { id: testProfileId1, account_id: testUserId },
        { id: testProfileId2, account_id: testUserId },
      ];

      const mockProfileMemberships = [
        {
          profile_id: testProfileId1,
          group_id: testGroupId2,
          role: 'member',
          is_active: true,
        },
      ];

      const mockJoinedGroup = {
        id: testGroupId2,
        name: 'Joined Group',
        description: 'Group I joined',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                data: mockProfiles,
                error: null,
              })),
            })),
          };
        }
        if (table === 'profile_memberships') {
          return {
            select: jest.fn(() => ({
              in: jest.fn(() => ({
                data: mockProfileMemberships,
                error: null,
              })),
            })),
          };
        }
        if (table === 'groups') {
          callCount++;
          if (callCount === 1) {
            // First call: groups created by user (empty)
            return {
              select: jest.fn(() => ({
                eq: jest.fn(() => ({
                  data: [],
                  error: null,
                })),
              })),
            };
          } else {
            // Second call: groups joined by profiles
            return {
              select: jest.fn(() => ({
                in: jest.fn(() => ({
                  data: [mockJoinedGroup],
                  error: null,
                })),
              })),
            };
          }
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        };
      });

      const response = await request(app)
        .get('/api/v1/groups')
        .set('Authorization', 'Bearer test-api-key');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      // Should include the joined group
      const joinedGroup = response.body.data.find((g) => g.groupId === testGroupId2);
      expect(joinedGroup).toBeDefined();
      expect(joinedGroup.groupName).toBe('Joined Group');
    });

    test('should deduplicate groups (created groups take precedence)', async () => {
      // Mock: User created a group AND joined it via profile
      const mockProfiles = [{ id: testProfileId1, account_id: testUserId }];
      const mockCreatedGroup = {
        id: testGroupId1,
        name: 'My Group',
        description: 'Created and joined',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        created_by: testUserId,
      };
      const mockProfileMemberships = [
        {
          profile_id: testProfileId1,
          group_id: testGroupId1,
          role: 'member',
          is_active: true,
        },
      ];

      let groupsCallCount = 0;
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                data: mockProfiles,
                error: null,
              })),
            })),
          };
        }
        if (table === 'profile_memberships') {
          return {
            select: jest.fn(() => ({
              in: jest.fn(() => ({
                data: mockProfileMemberships,
                error: null,
              })),
            })),
          };
        }
        if (table === 'groups') {
          groupsCallCount++;
          if (groupsCallCount === 1) {
            // Created groups
            return {
              select: jest.fn(() => ({
                eq: jest.fn(() => ({
                  data: [mockCreatedGroup],
                  error: null,
                })),
              })),
            };
          } else {
            // Joined groups (should be deduplicated)
            return {
              select: jest.fn(() => ({
                in: jest.fn(() => ({
                  data: [mockCreatedGroup],
                  error: null,
                })),
              })),
            };
          }
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        };
      });

      const response = await request(app)
        .get('/api/v1/groups')
        .set('Authorization', 'Bearer test-api-key');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Should only appear once (deduplicated)
      const groupIds = response.body.data.map((g) => g.groupId);
      expect(groupIds.filter((id) => id === testGroupId1).length).toBe(1);
    });

    test('should handle user with no profiles', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                data: [],
                error: null,
              })),
            })),
          };
        }
        if (table === 'groups') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                data: [],
                error: null,
              })),
            })),
          };
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        };
      });

      const response = await request(app)
        .get('/api/v1/groups')
        .set('Authorization', 'Bearer test-api-key');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    test('should handle user with profiles but no memberships', async () => {
      const mockProfiles = [{ id: testProfileId1, account_id: testUserId }];

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                data: mockProfiles,
                error: null,
              })),
            })),
          };
        }
        if (table === 'profile_memberships') {
          return {
            select: jest.fn(() => ({
              in: jest.fn(() => ({
                data: [],
                error: null,
              })),
            })),
          };
        }
        if (table === 'groups') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                data: [],
                error: null,
              })),
            })),
          };
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        };
      });

      const response = await request(app)
        .get('/api/v1/groups')
        .set('Authorization', 'Bearer test-api-key');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /api/v1/groups/:groupId/members', () => {
    test('should allow access if user created group', async () => {
      const mockGroup = {
        id: testGroupId1,
        created_by: testUserId,
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'groups') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => ({
                  data: mockGroup,
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === 'profile_memberships') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                in: jest.fn(() => ({
                  data: [],
                  error: null,
                })),
              })),
            })),
          };
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        };
      });

      const response = await request(app)
        .get(`/api/v1/groups/${testGroupId1}/members`)
        .set('Authorization', 'Bearer test-api-key');

      // Should not return 403 (access denied)
      expect(response.status).not.toBe(403);
    });

    test('should allow access if user profile is member', async () => {
      const mockProfiles = [{ id: testProfileId1, account_id: testUserId }];
      const mockGroup = {
        id: testGroupId1,
        created_by: 'other-user-id',
      };
      const mockProfileMembership = {
        profile_id: testProfileId1,
        group_id: testGroupId1,
        is_active: true,
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                data: mockProfiles,
                error: null,
              })),
            })),
          };
        }
        if (table === 'groups') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => ({
                  data: mockGroup,
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === 'profile_memberships') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn((column, value) => {
                if (column === 'group_id') {
                  return {
                    in: jest.fn(() => ({
                      data: [mockProfileMembership],
                      error: null,
                    })),
                  };
                }
                return {
                  in: jest.fn(() => ({
                    data: [mockProfileMembership],
                    error: null,
                  })),
                };
              }),
            })),
          };
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        };
      });

      const response = await request(app)
        .get(`/api/v1/groups/${testGroupId1}/members`)
        .set('Authorization', 'Bearer test-api-key');

      // Should not return 403 (access denied)
      expect(response.status).not.toBe(403);
    });

    test('should deny access if user neither created group nor has profile membership', async () => {
      const mockGroup = {
        id: testGroupId1,
        created_by: 'other-user-id',
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                data: [],
                error: null,
              })),
            })),
          };
        }
        if (table === 'groups') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => ({
                  data: mockGroup,
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === 'profile_memberships') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                in: jest.fn(() => ({
                  data: [],
                  error: null,
                })),
              })),
            })),
          };
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        };
      });

      const response = await request(app)
        .get(`/api/v1/groups/${testGroupId1}/members`)
        .set('Authorization', 'Bearer test-api-key');

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    test('should return members from profile_memberships joined with profiles', async () => {
      const mockProfiles = [{ id: testProfileId1, account_id: testUserId }];
      const mockGroup = {
        id: testGroupId1,
        created_by: testUserId,
      };
      const mockMembers = [
        {
          id: 'membership-1',
          profile_id: testProfileId1,
          group_id: testGroupId1,
          role: 'member',
          joined_at: '2024-01-01T00:00:00Z',
          is_active: true,
          profiles: {
            id: testProfileId1,
            display_name: 'Test Profile',
            username: 'testprofile',
            avatar_url: null,
          },
        },
      ];

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                data: mockProfiles,
                error: null,
              })),
            })),
          };
        }
        if (table === 'groups') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => ({
                  data: mockGroup,
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === 'profile_memberships') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  order: jest.fn(() => ({
                    data: mockMembers,
                    error: null,
                  })),
                })),
              })),
            })),
          };
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        };
      });

      const response = await request(app)
        .get(`/api/v1/groups/${testGroupId1}/members`)
        .set('Authorization', 'Bearer test-api-key');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].memberId).toBe(testProfileId1);
      expect(response.body.data[0].displayName).toBe('Test Profile');
    });
  });

  describe('Authentication', () => {
    test('should require API key', async () => {
      const response = await request(app).get('/api/v1/groups');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});

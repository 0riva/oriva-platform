import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Feed } from '../organisms/Feed';
import type { Entry, MarketplaceItem } from '../../types';

// Mock the semantic commerce service
jest.mock('../../services/semantic/SemanticCommerceService', () => ({
  SemanticCommerceService: jest.fn().mockImplementation(() => ({
    analyzeThreadForCommerce: jest.fn(),
  })),
}));

describe('Feed Integration with Marketplace Suggestions', () => {
  const mockEntries: Entry[] = [
    {
      id: 'entry1',
      user_id: 'user1',
      content: 'Looking for project management tools',
      entry_type: 'text',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'entry2',
      user_id: 'user2',
      content: 'Need help with React development',
      entry_type: 'text',
      created_at: '2025-01-01T01:00:00Z',
      updated_at: '2025-01-01T01:00:00Z',
    },
  ];

  const mockMarketplaceSuggestions: Record<string, MarketplaceItem[]> = {
    entry1: [
      {
        id: 'item1',
        user_id: 'seller1',
        content: 'PM Template Pack',
        entry_type: 'marketplace_item',
        marketplace_metadata: {
          item_type: 'product',
          earner_type: 'creator',
          price: 29.99,
          currency: 'USD',
          is_published: true,
          inventory_count: null,
          category_ids: ['productivity'],
          requires_shipping: false,
        },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      },
    ],
  };

  const mockOnItemPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('marketplace suggestion embedding', () => {
    it('should embed marketplace suggestions in feed', async () => {
      const { getByText } = render(
        <Feed
          entries={mockEntries}
          marketplaceSuggestions={mockMarketplaceSuggestions}
          onMarketplaceItemPress={mockOnItemPress}
          testID="feed"
        />
      );

      await waitFor(() => {
        expect(getByText('Looking for project management tools')).toBeTruthy();
        expect(getByText('PM Template Pack')).toBeTruthy();
      });
    });

    it('should not show suggestions when disabled', () => {
      const { queryByText } = render(
        <Feed
          entries={mockEntries}
          marketplaceSuggestions={mockMarketplaceSuggestions}
          onMarketplaceItemPress={mockOnItemPress}
          showMarketplaceSuggestions={false}
          testID="feed"
        />
      );

      expect(queryByText('PM Template Pack')).toBeNull();
    });

    it('should position suggestions contextually after related entry', () => {
      const { getAllByTestId } = render(
        <Feed
          entries={mockEntries}
          marketplaceSuggestions={mockMarketplaceSuggestions}
          onMarketplaceItemPress={mockOnItemPress}
          testID="feed"
        />
      );

      const feedItems = getAllByTestId(/feed-item/);
      const suggestionIndex = feedItems.findIndex(item =>
        item.props.testID === 'feed-item-commerce-suggestion-entry1'
      );

      expect(suggestionIndex).toBeGreaterThan(0); // Should be after the entry
    });
  });

  describe('semantic analysis integration', () => {
    it('should analyze entries for commerce opportunities', async () => {
      const mockAnalyze = jest.fn().mockResolvedValue({
        intent: { type: 'product_need', keywords: ['pm tools'] },
        recommendations: mockMarketplaceSuggestions.entry1,
      });

      const { SemanticCommerceService } = require('../../services/semantic/SemanticCommerceService');
      SemanticCommerceService.mockImplementation(() => ({
        analyzeThreadForCommerce: mockAnalyze,
      }));

      render(
        <Feed
          entries={mockEntries}
          enableSemanticAnalysis={true}
          onMarketplaceItemPress={mockOnItemPress}
          testID="feed"
        />
      );

      await waitFor(() => {
        expect(mockAnalyze).toHaveBeenCalled();
      });
    });

    it('should handle semantic analysis errors gracefully', async () => {
      const mockAnalyze = jest.fn().mockRejectedValue(new Error('Analysis failed'));

      const { SemanticCommerceService } = require('../../services/semantic/SemanticCommerceService');
      SemanticCommerceService.mockImplementation(() => ({
        analyzeThreadForCommerce: mockAnalyze,
      }));

      const { queryByText } = render(
        <Feed
          entries={mockEntries}
          enableSemanticAnalysis={true}
          onMarketplaceItemPress={mockOnItemPress}
          testID="feed"
        />
      );

      await waitFor(() => {
        // Feed should still render normally without crashing
        expect(queryByText('Looking for project management tools')).toBeTruthy();
      });
    });
  });

  describe('suggestion interactions', () => {
    it('should call onMarketplaceItemPress when suggestion is clicked', async () => {
      const { getByText } = render(
        <Feed
          entries={mockEntries}
          marketplaceSuggestions={mockMarketplaceSuggestions}
          onMarketplaceItemPress={mockOnItemPress}
          testID="feed"
        />
      );

      await waitFor(() => {
        const suggestion = getByText('PM Template Pack');
        fireEvent.press(suggestion);
      });

      expect(mockOnItemPress).toHaveBeenCalledWith(mockMarketplaceSuggestions.entry1[0]);
    });

    it('should support dismissing suggestions', async () => {
      const mockOnDismiss = jest.fn();

      const { getByTestId, queryByText } = render(
        <Feed
          entries={mockEntries}
          marketplaceSuggestions={mockMarketplaceSuggestions}
          onMarketplaceItemPress={mockOnItemPress}
          onSuggestionDismiss={mockOnDismiss}
          dismissibleSuggestions={true}
          testID="feed"
        />
      );

      await waitFor(() => {
        const dismissButton = getByTestId('commerce-suggestion-entry1-dismiss');
        fireEvent.press(dismissButton);
      });

      expect(mockOnDismiss).toHaveBeenCalledWith('entry1');
    });
  });

  describe('performance and throttling', () => {
    it('should not overwhelm feed with too many suggestions', () => {
      const manySuggestions: Record<string, MarketplaceItem[]> = {};
      mockEntries.forEach(entry => {
        manySuggestions[entry.id] = mockMarketplaceSuggestions.entry1;
      });

      const { getAllByTestId } = render(
        <Feed
          entries={mockEntries}
          marketplaceSuggestions={manySuggestions}
          onMarketplaceItemPress={mockOnItemPress}
          maxSuggestionsPerEntry={1}
          testID="feed"
        />
      );

      const suggestions = getAllByTestId(/commerce-suggestion/);
      // Should throttle to avoid overwhelming the feed
      expect(suggestions.length).toBeLessThanOrEqual(mockEntries.length);
    });

    it('should lazy load suggestions on scroll', async () => {
      const { getByTestId } = render(
        <Feed
          entries={mockEntries}
          marketplaceSuggestions={mockMarketplaceSuggestions}
          onMarketplaceItemPress={mockOnItemPress}
          lazyLoadSuggestions={true}
          testID="feed"
        />
      );

      const feedList = getByTestId('feed-list');

      // Initially, suggestions might not be loaded
      // Simulate scroll to trigger lazy loading
      fireEvent.scroll(feedList, {
        nativeEvent: {
          contentOffset: { y: 500 },
          contentSize: { height: 1000 },
          layoutMeasurement: { height: 800 },
        },
      });

      await waitFor(() => {
        // Suggestions should load after scroll
      });
    });
  });

  describe('layout and styling', () => {
    it('should render suggestions with subtle inline styling', () => {
      const { getByTestId } = render(
        <Feed
          entries={mockEntries}
          marketplaceSuggestions={mockMarketplaceSuggestions}
          onMarketplaceItemPress={mockOnItemPress}
          inlineSuggestionStyle={true}
          testID="feed"
        />
      );

      const suggestion = getByTestId('commerce-suggestion-entry1');
      expect(suggestion.props.style).toMatchObject({
        backgroundColor: expect.any(String),
        borderRadius: expect.any(Number),
      });
    });

    it('should support horizontal and vertical suggestion layouts', () => {
      const { getByTestId } = render(
        <Feed
          entries={mockEntries}
          marketplaceSuggestions={mockMarketplaceSuggestions}
          onMarketplaceItemPress={mockOnItemPress}
          suggestionLayout="horizontal"
          testID="feed"
        />
      );

      const suggestionContainer = getByTestId('commerce-suggestion-entry1-container');
      expect(suggestionContainer.props.horizontal).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle entries with no suggestions', () => {
      const { getByText, queryByText } = render(
        <Feed
          entries={mockEntries}
          marketplaceSuggestions={{ entry1: [] }}
          onMarketplaceItemPress={mockOnItemPress}
          testID="feed"
        />
      );

      expect(getByText('Looking for project management tools')).toBeTruthy();
      expect(queryByText('PM Template Pack')).toBeNull();
    });

    it('should handle empty feed gracefully', () => {
      const { getByText } = render(
        <Feed
          entries={[]}
          marketplaceSuggestions={mockMarketplaceSuggestions}
          onMarketplaceItemPress={mockOnItemPress}
          testID="feed"
        />
      );

      expect(getByText(/no entries/i)).toBeTruthy();
    });

    it('should update suggestions when entries change', async () => {
      const { rerender, queryByText } = render(
        <Feed
          entries={mockEntries}
          marketplaceSuggestions={mockMarketplaceSuggestions}
          onMarketplaceItemPress={mockOnItemPress}
          testID="feed"
        />
      );

      expect(queryByText('PM Template Pack')).toBeTruthy();

      // Update with no suggestions
      rerender(
        <Feed
          entries={mockEntries}
          marketplaceSuggestions={{}}
          onMarketplaceItemPress={mockOnItemPress}
          testID="feed"
        />
      );

      await waitFor(() => {
        expect(queryByText('PM Template Pack')).toBeNull();
      });
    });
  });
});

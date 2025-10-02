import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ContextualCommerceSuggestion } from '../ContextualCommerceSuggestion';
import type { MarketplaceItem, Thread } from '../../../../types';

describe('ContextualCommerceSuggestion', () => {
  const mockThread: Thread = {
    id: 'thread123',
    title: 'Need project management tools',
    content: 'Looking for good PM software for my team',
    user_id: 'user123',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  };

  const mockSuggestions: MarketplaceItem[] = [
    {
      id: 'item1',
      user_id: 'seller1',
      content: 'Premium Project Management Template',
      entry_type: 'marketplace_item',
      marketplace_metadata: {
        item_type: 'product',
        earner_type: 'creator',
        price: 29.99,
        currency: 'USD',
        is_published: true,
        inventory_count: null,
        category_ids: ['pm', 'productivity'],
        requires_shipping: false,
      },
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'item2',
      user_id: 'seller2',
      content: 'PM Consulting Service',
      entry_type: 'marketplace_item',
      marketplace_metadata: {
        item_type: 'service',
        earner_type: 'vendor',
        price: 199.99,
        currency: 'USD',
        is_published: true,
        inventory_count: 10,
        category_ids: ['consulting'],
        requires_shipping: false,
      },
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
  ];

  const mockOnItemPress = jest.fn();
  const mockOnDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render suggestions when provided', () => {
      const { getByText } = render(
        <ContextualCommerceSuggestion
          thread={mockThread}
          suggestions={mockSuggestions}
          onItemPress={mockOnItemPress}
          testID="commerce-suggestion"
        />
      );

      expect(getByText('Premium Project Management Template')).toBeTruthy();
      expect(getByText('PM Consulting Service')).toBeTruthy();
    });

    it('should not render when no suggestions', () => {
      const { queryByTestId } = render(
        <ContextualCommerceSuggestion
          thread={mockThread}
          suggestions={[]}
          onItemPress={mockOnItemPress}
          testID="commerce-suggestion"
        />
      );

      expect(queryByTestId('commerce-suggestion')).toBeNull();
    });

    it('should render with custom header text', () => {
      const { getByText } = render(
        <ContextualCommerceSuggestion
          thread={mockThread}
          suggestions={mockSuggestions}
          onItemPress={mockOnItemPress}
          headerText="Relevant marketplace items"
          testID="commerce-suggestion"
        />
      );

      expect(getByText('Relevant marketplace items')).toBeTruthy();
    });

    it('should show relevance scores when provided', () => {
      const suggestionsWithScores = mockSuggestions.map((item, index) => ({
        ...item,
        relevanceScore: 0.9 - index * 0.1,
      }));

      const { getByText } = render(
        <ContextualCommerceSuggestion
          thread={mockThread}
          suggestions={suggestionsWithScores}
          onItemPress={mockOnItemPress}
          showRelevanceScore={true}
          testID="commerce-suggestion"
        />
      );

      expect(getByText(/90%/)).toBeTruthy();
      expect(getByText(/80%/)).toBeTruthy();
    });
  });

  describe('interactions', () => {
    it('should call onItemPress when item is clicked', () => {
      const { getByText } = render(
        <ContextualCommerceSuggestion
          thread={mockThread}
          suggestions={mockSuggestions}
          onItemPress={mockOnItemPress}
          testID="commerce-suggestion"
        />
      );

      fireEvent.press(getByText('Premium Project Management Template'));

      expect(mockOnItemPress).toHaveBeenCalledWith(mockSuggestions[0]);
    });

    it('should call onDismiss when dismiss button is clicked', () => {
      const { getByTestId } = render(
        <ContextualCommerceSuggestion
          thread={mockThread}
          suggestions={mockSuggestions}
          onItemPress={mockOnItemPress}
          onDismiss={mockOnDismiss}
          dismissible={true}
          testID="commerce-suggestion"
        />
      );

      const dismissButton = getByTestId('commerce-suggestion-dismiss');
      fireEvent.press(dismissButton);

      expect(mockOnDismiss).toHaveBeenCalled();
    });

    it('should not show dismiss button when not dismissible', () => {
      const { queryByTestId } = render(
        <ContextualCommerceSuggestion
          thread={mockThread}
          suggestions={mockSuggestions}
          onItemPress={mockOnItemPress}
          dismissible={false}
          testID="commerce-suggestion"
        />
      );

      expect(queryByTestId('commerce-suggestion-dismiss')).toBeNull();
    });
  });

  describe('layout variants', () => {
    it('should render in horizontal layout', () => {
      const { getByTestId } = render(
        <ContextualCommerceSuggestion
          thread={mockThread}
          suggestions={mockSuggestions}
          onItemPress={mockOnItemPress}
          layout="horizontal"
          testID="commerce-suggestion"
        />
      );

      const container = getByTestId('commerce-suggestion-container');
      expect(container.props.horizontal).toBe(true);
    });

    it('should render in vertical layout', () => {
      const { getByTestId } = render(
        <ContextualCommerceSuggestion
          thread={mockThread}
          suggestions={mockSuggestions}
          onItemPress={mockOnItemPress}
          layout="vertical"
          testID="commerce-suggestion"
        />
      );

      const container = getByTestId('commerce-suggestion-container');
      expect(container.props.horizontal).toBeFalsy();
    });

    it('should limit displayed items when maxItems is set', () => {
      const { queryByText } = render(
        <ContextualCommerceSuggestion
          thread={mockThread}
          suggestions={mockSuggestions}
          onItemPress={mockOnItemPress}
          maxItems={1}
          testID="commerce-suggestion"
        />
      );

      expect(queryByText('Premium Project Management Template')).toBeTruthy();
      expect(queryByText('PM Consulting Service')).toBeNull();
    });
  });

  describe('inline thread embedding', () => {
    it('should render inline within thread context', () => {
      const { getByTestId, getByText } = render(
        <ContextualCommerceSuggestion
          thread={mockThread}
          suggestions={mockSuggestions}
          onItemPress={mockOnItemPress}
          inline={true}
          testID="commerce-suggestion"
        />
      );

      const suggestion = getByTestId('commerce-suggestion');
      expect(suggestion).toBeTruthy();
      expect(getByText('Premium Project Management Template')).toBeTruthy();
    });

    it('should have subtle styling when inline', () => {
      const { getByTestId } = render(
        <ContextualCommerceSuggestion
          thread={mockThread}
          suggestions={mockSuggestions}
          onItemPress={mockOnItemPress}
          inline={true}
          testID="commerce-suggestion"
        />
      );

      const container = getByTestId('commerce-suggestion');
      expect(container.props.style).toMatchObject({
        backgroundColor: expect.any(String),
        borderRadius: expect.any(Number),
      });
    });
  });

  describe('loading and error states', () => {
    it('should show loading state', () => {
      const { getByTestId } = render(
        <ContextualCommerceSuggestion
          thread={mockThread}
          suggestions={[]}
          onItemPress={mockOnItemPress}
          loading={true}
          testID="commerce-suggestion"
        />
      );

      expect(getByTestId('commerce-suggestion-loading')).toBeTruthy();
    });

    it('should show error state', () => {
      const { getByText } = render(
        <ContextualCommerceSuggestion
          thread={mockThread}
          suggestions={[]}
          onItemPress={mockOnItemPress}
          error="Failed to load suggestions"
          testID="commerce-suggestion"
        />
      );

      expect(getByText('Failed to load suggestions')).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('should have proper accessibility labels', () => {
      const { getByLabelText } = render(
        <ContextualCommerceSuggestion
          thread={mockThread}
          suggestions={mockSuggestions}
          onItemPress={mockOnItemPress}
          testID="commerce-suggestion"
        />
      );

      expect(getByLabelText(/marketplace suggestions/i)).toBeTruthy();
    });

    it('should announce number of suggestions to screen readers', () => {
      const { getByTestId } = render(
        <ContextualCommerceSuggestion
          thread={mockThread}
          suggestions={mockSuggestions}
          onItemPress={mockOnItemPress}
          testID="commerce-suggestion"
        />
      );

      const container = getByTestId('commerce-suggestion');
      expect(container.props.accessibilityLabel).toContain('2 suggestions');
    });
  });
});

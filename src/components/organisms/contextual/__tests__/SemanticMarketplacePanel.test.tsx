import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SemanticMarketplacePanel } from '../SemanticMarketplacePanel';
import type { MarketplaceItem, Thread } from '../../../../types';

describe('SemanticMarketplacePanel', () => {
  const mockThread: Thread = {
    id: 'thread123',
    title: 'Productivity tools discussion',
    content: 'What tools do you use for project management?',
    user_id: 'user123',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  };

  const mockItems: MarketplaceItem[] = [
    {
      id: 'item1',
      user_id: 'seller1',
      content: 'Project Management Tool',
      entry_type: 'marketplace_item',
      marketplace_metadata: {
        item_type: 'product',
        earner_type: 'developer',
        price: 49.99,
        currency: 'USD',
        is_published: true,
        inventory_count: null,
        category_ids: ['productivity'],
        requires_shipping: false,
      },
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
  ];

  const mockOnItemSelect = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render panel with items', () => {
      const { getByText } = render(
        <SemanticMarketplacePanel
          visible={true}
          thread={mockThread}
          items={mockItems}
          onItemSelect={mockOnItemSelect}
          onClose={mockOnClose}
          testID="marketplace-panel"
        />
      );

      expect(getByText('Marketplace')).toBeTruthy();
      expect(getByText('Project Management Tool')).toBeTruthy();
    });

    it('should not render when not visible', () => {
      const { queryByTestId } = render(
        <SemanticMarketplacePanel
          visible={false}
          thread={mockThread}
          items={mockItems}
          onItemSelect={mockOnItemSelect}
          onClose={mockOnClose}
          testID="marketplace-panel"
        />
      );

      expect(queryByTestId('marketplace-panel')).toBeNull();
    });

    it('should render custom title', () => {
      const { getByText } = render(
        <SemanticMarketplacePanel
          visible={true}
          thread={mockThread}
          items={mockItems}
          onItemSelect={mockOnItemSelect}
          onClose={mockOnClose}
          title="Related Products"
          testID="marketplace-panel"
        />
      );

      expect(getByText('Related Products')).toBeTruthy();
    });

    it('should show empty state when no items', () => {
      const { getByText } = render(
        <SemanticMarketplacePanel
          visible={true}
          thread={mockThread}
          items={[]}
          onItemSelect={mockOnItemSelect}
          onClose={mockOnClose}
          testID="marketplace-panel"
        />
      );

      expect(getByText(/no items found/i)).toBeTruthy();
    });
  });

  describe('interactions', () => {
    it('should call onItemSelect when item is pressed', () => {
      const { getByText } = render(
        <SemanticMarketplacePanel
          visible={true}
          thread={mockThread}
          items={mockItems}
          onItemSelect={mockOnItemSelect}
          onClose={mockOnClose}
          testID="marketplace-panel"
        />
      );

      fireEvent.press(getByText('Project Management Tool'));

      expect(mockOnItemSelect).toHaveBeenCalledWith(mockItems[0]);
    });

    it('should call onClose when close button is pressed', () => {
      const { getByTestId } = render(
        <SemanticMarketplacePanel
          visible={true}
          thread={mockThread}
          items={mockItems}
          onItemSelect={mockOnItemSelect}
          onClose={mockOnClose}
          testID="marketplace-panel"
        />
      );

      const closeButton = getByTestId('marketplace-panel-close');
      fireEvent.press(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when backdrop is pressed', () => {
      const { getByTestId } = render(
        <SemanticMarketplacePanel
          visible={true}
          thread={mockThread}
          items={mockItems}
          onItemSelect={mockOnItemSelect}
          onClose={mockOnClose}
          testID="marketplace-panel"
        />
      );

      const backdrop = getByTestId('marketplace-panel-backdrop');
      fireEvent.press(backdrop);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('filtering and search', () => {
    it('should render search input when searchable', () => {
      const { getByPlaceholderText } = render(
        <SemanticMarketplacePanel
          visible={true}
          thread={mockThread}
          items={mockItems}
          onItemSelect={mockOnItemSelect}
          onClose={mockOnClose}
          searchable={true}
          testID="marketplace-panel"
        />
      );

      expect(getByPlaceholderText('Search items...')).toBeTruthy();
    });

    it('should filter items based on search query', async () => {
      const multipleItems = [
        ...mockItems,
        {
          ...mockItems[0],
          id: 'item2',
          content: 'Time Tracker App',
        },
      ];

      const { getByPlaceholderText, queryByText } = render(
        <SemanticMarketplacePanel
          visible={true}
          thread={mockThread}
          items={multipleItems}
          onItemSelect={mockOnItemSelect}
          onClose={mockOnClose}
          searchable={true}
          testID="marketplace-panel"
        />
      );

      const searchInput = getByPlaceholderText('Search items...');
      fireEvent.changeText(searchInput, 'tracker');

      await waitFor(() => {
        expect(queryByText('Time Tracker App')).toBeTruthy();
        expect(queryByText('Project Management Tool')).toBeNull();
      });
    });

    it('should show category filters when provided', () => {
      const { getByText } = render(
        <SemanticMarketplacePanel
          visible={true}
          thread={mockThread}
          items={mockItems}
          onItemSelect={mockOnItemSelect}
          onClose={mockOnClose}
          categories={['productivity', 'tools', 'software']}
          testID="marketplace-panel"
        />
      );

      expect(getByText('productivity')).toBeTruthy();
      expect(getByText('tools')).toBeTruthy();
    });
  });

  describe('sidebar placement', () => {
    it('should render as sidebar panel', () => {
      const { getByTestId } = render(
        <SemanticMarketplacePanel
          visible={true}
          thread={mockThread}
          items={mockItems}
          onItemSelect={mockOnItemSelect}
          onClose={mockOnClose}
          placement="sidebar"
          testID="marketplace-panel"
        />
      );

      const panel = getByTestId('marketplace-panel');
      expect(panel.props.style).toMatchObject({
        position: 'absolute',
        right: 0,
      });
    });

    it('should render as modal panel', () => {
      const { getByTestId } = render(
        <SemanticMarketplacePanel
          visible={true}
          thread={mockThread}
          items={mockItems}
          onItemSelect={mockOnItemSelect}
          onClose={mockOnClose}
          placement="modal"
          testID="marketplace-panel"
        />
      );

      const panel = getByTestId('marketplace-panel');
      expect(panel.props.style).toMatchObject({
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
      });
    });
  });

  describe('loading and error states', () => {
    it('should show loading state', () => {
      const { getByTestId } = render(
        <SemanticMarketplacePanel
          visible={true}
          thread={mockThread}
          items={[]}
          onItemSelect={mockOnItemSelect}
          onClose={mockOnClose}
          loading={true}
          testID="marketplace-panel"
        />
      );

      expect(getByTestId('marketplace-panel-loading')).toBeTruthy();
    });

    it('should show error state', () => {
      const { getByText } = render(
        <SemanticMarketplacePanel
          visible={true}
          thread={mockThread}
          items={[]}
          onItemSelect={mockOnItemSelect}
          onClose={mockOnClose}
          error="Failed to load items"
          testID="marketplace-panel"
        />
      );

      expect(getByText('Failed to load items')).toBeTruthy();
    });
  });

  describe('semantic context', () => {
    it('should display thread context relevance', () => {
      const { getByText } = render(
        <SemanticMarketplacePanel
          visible={true}
          thread={mockThread}
          items={mockItems}
          onItemSelect={mockOnItemSelect}
          onClose={mockOnClose}
          showContext={true}
          testID="marketplace-panel"
        />
      );

      expect(getByText(/related to:/i)).toBeTruthy();
      expect(getByText(mockThread.title)).toBeTruthy();
    });

    it('should show semantic relevance scores', () => {
      const itemsWithScores = mockItems.map(item => ({
        ...item,
        semanticScore: 0.85,
      }));

      const { getByText } = render(
        <SemanticMarketplacePanel
          visible={true}
          thread={mockThread}
          items={itemsWithScores}
          onItemSelect={mockOnItemSelect}
          onClose={mockOnClose}
          showRelevanceScores={true}
          testID="marketplace-panel"
        />
      );

      expect(getByText(/85%/)).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('should have proper accessibility labels', () => {
      const { getByLabelText } = render(
        <SemanticMarketplacePanel
          visible={true}
          thread={mockThread}
          items={mockItems}
          onItemSelect={mockOnItemSelect}
          onClose={mockOnClose}
          testID="marketplace-panel"
        />
      );

      expect(getByLabelText(/marketplace panel/i)).toBeTruthy();
    });

    it('should be keyboard navigable', () => {
      const { getByTestId } = render(
        <SemanticMarketplacePanel
          visible={true}
          thread={mockThread}
          items={mockItems}
          onItemSelect={mockOnItemSelect}
          onClose={mockOnClose}
          testID="marketplace-panel"
        />
      );

      const panel = getByTestId('marketplace-panel');
      expect(panel.props.accessible).toBe(true);
    });
  });
});

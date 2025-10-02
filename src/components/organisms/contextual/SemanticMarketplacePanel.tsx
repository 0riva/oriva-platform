import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MarketplaceItemCard } from '../../molecules/marketplace/MarketplaceItemCard';
import type { MarketplaceItem, Thread } from '../../../types';

export interface SemanticMarketplacePanelProps {
  visible: boolean;
  thread: Thread;
  items: (MarketplaceItem & { semanticScore?: number })[];
  onItemSelect: (item: MarketplaceItem) => void;
  onClose: () => void;
  title?: string;
  searchable?: boolean;
  categories?: string[];
  placement?: 'sidebar' | 'modal';
  loading?: boolean;
  error?: string;
  showContext?: boolean;
  showRelevanceScores?: boolean;
  testID?: string;
}

/**
 * SemanticMarketplacePanel displays marketplace items in a sidebar panel.
 *
 * This organism provides a dedicated panel for browsing marketplace items
 * that are semantically relevant to the current thread context.
 */
export const SemanticMarketplacePanel: React.FC<SemanticMarketplacePanelProps> = ({
  visible,
  thread,
  items,
  onItemSelect,
  onClose,
  title = 'Marketplace',
  searchable = false,
  categories = [],
  placement = 'sidebar',
  loading = false,
  error,
  showContext = false,
  showRelevanceScores = false,
  testID = 'semantic-marketplace-panel',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Filter items based on search and category
  const filteredItems = useMemo(() => {
    let filtered = items;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.content.toLowerCase().includes(query) ||
        item.marketplace_metadata?.item_type?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (selectedCategory) {
      filtered = filtered.filter(item =>
        item.marketplace_metadata?.category_ids?.includes(selectedCategory)
      );
    }

    return filtered;
  }, [items, searchQuery, selectedCategory]);

  if (!visible) {
    return null;
  }

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.title}>{title}</Text>
        {showContext && (
          <Text style={styles.contextText}>
            Related to: <Text style={styles.threadTitle}>{thread.title}</Text>
          </Text>
        )}
      </View>
      <TouchableOpacity
        onPress={onClose}
        style={styles.closeButton}
        accessibilityLabel="Close panel"
        testID={`${testID}-close`}
      >
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSearch = () => {
    if (!searchable) return null;

    return (
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search items..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
          testID={`${testID}-search`}
        />
      </View>
    );
  };

  const renderCategories = () => {
    if (categories.length === 0) return null;

    return (
      <View style={styles.categoriesContainer}>
        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.categoryChip,
                selectedCategory === item && styles.categoryChipSelected,
              ]}
              onPress={() => setSelectedCategory(selectedCategory === item ? null : item)}
              testID={`${testID}-category-${item}`}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === item && styles.categoryTextSelected,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item}
        />
      </View>
    );
  };

  const renderItem = ({ item }: { item: MarketplaceItem & { semanticScore?: number } }) => (
    <View style={styles.itemContainer}>
      <MarketplaceItemCard
        entry={item}
        onBuy={() => onItemSelect(item)}
        variant="compact"
        testID={`${testID}-item-${item.id}`}
      />
      {showRelevanceScores && item.semanticScore !== undefined && (
        <View style={styles.scoreIndicator}>
          <Text style={styles.scoreText}>
            {Math.round(item.semanticScore * 100)}% relevant
          </Text>
        </View>
      )}
    </View>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContent} testID={`${testID}-loading`}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading items...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }

    if (filteredItems.length === 0) {
      return (
        <View style={styles.centerContent}>
          <Text style={styles.emptyText}>
            {searchQuery || selectedCategory
              ? 'No items match your filters'
              : 'No items found'}
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={true}
      />
    );
  };

  const panelStyle = placement === 'sidebar'
    ? styles.sidebarPanel
    : styles.modalPanel;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
        testID={`${testID}-backdrop`}
      >
        <View
          style={[styles.panel, panelStyle]}
          onStartShouldSetResponder={() => true}
          accessible={true}
          accessibilityLabel="Marketplace panel"
          testID={testID}
        >
          {renderHeader()}
          {renderSearch()}
          {renderCategories()}
          {renderContent()}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  sidebarPanel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '80%',
    maxWidth: 400,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  modalPanel: {
    position: 'absolute',
    top: '10%',
    left: '10%',
    right: '10%',
    bottom: '10%',
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  contextText: {
    fontSize: 12,
    color: '#666',
  },
  threadTitle: {
    fontWeight: '600',
    color: '#007AFF',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 24,
    color: '#666',
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  searchInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1A1A1A',
  },
  categoriesContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  categoryChip: {
    backgroundColor: '#F0F4F8',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  categoryChipSelected: {
    backgroundColor: '#007AFF',
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  categoryTextSelected: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  itemContainer: {
    position: 'relative',
  },
  scoreIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  scoreText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#DC3545',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

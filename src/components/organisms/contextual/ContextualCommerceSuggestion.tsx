import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { MarketplaceItemCard } from '../../molecules/marketplace/MarketplaceItemCard';
import type { MarketplaceItem, Thread } from '../../../types';

export interface ContextualCommerceSuggestionProps {
  thread: Thread;
  suggestions: (MarketplaceItem & { relevanceScore?: number })[];
  onItemPress: (item: MarketplaceItem) => void;
  onDismiss?: () => void;
  dismissible?: boolean;
  layout?: 'horizontal' | 'vertical';
  maxItems?: number;
  inline?: boolean;
  loading?: boolean;
  error?: string;
  headerText?: string;
  showRelevanceScore?: boolean;
  testID?: string;
}

/**
 * ContextualCommerceSuggestion displays marketplace suggestions inline within threads.
 *
 * This organism embeds marketplace product cards directly in conversation threads
 * when semantic analysis detects commercial intent or opportunities.
 */
export const ContextualCommerceSuggestion: React.FC<ContextualCommerceSuggestionProps> = ({
  thread,
  suggestions,
  onItemPress,
  onDismiss,
  dismissible = false,
  layout = 'horizontal',
  maxItems,
  inline = false,
  loading = false,
  error,
  headerText = 'Relevant to this discussion',
  showRelevanceScore = false,
  testID = 'contextual-commerce-suggestion',
}) => {
  // Don't render if no suggestions and not loading
  if (!loading && suggestions.length === 0 && !error) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, inline && styles.inlineContainer]} testID={`${testID}-loading`}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.loadingText}>Finding relevant items...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.container, inline && styles.inlineContainer]} testID={`${testID}-error`}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // Limit suggestions if maxItems is set
  const displayedSuggestions = maxItems ? suggestions.slice(0, maxItems) : suggestions;

  const renderItem = ({ item }: { item: MarketplaceItem & { relevanceScore?: number } }) => (
    <View style={styles.itemContainer}>
      <MarketplaceItemCard
        entry={item}
        onBuy={() => onItemPress(item)}
        variant="compact"
        testID={`${testID}-item-${item.id}`}
      />
      {showRelevanceScore && item.relevanceScore !== undefined && (
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>
            {Math.round(item.relevanceScore * 100)}% match
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View
      style={[
        styles.container,
        inline && styles.inlineContainer,
      ]}
      accessibilityLabel={`Marketplace suggestions: ${displayedSuggestions.length} suggestions related to this thread`}
      testID={testID}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>🛍️</Text>
          <Text style={styles.headerText}>{headerText}</Text>
        </View>
        {dismissible && onDismiss && (
          <TouchableOpacity
            onPress={onDismiss}
            style={styles.dismissButton}
            accessibilityLabel="Dismiss suggestions"
            testID={`${testID}-dismiss`}
          >
            <Text style={styles.dismissText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={displayedSuggestions}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal={layout === 'horizontal'}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          layout === 'horizontal' ? styles.horizontalList : styles.verticalList
        }
        testID={`${testID}-container`}
      />

      {maxItems && suggestions.length > maxItems && (
        <Text style={styles.moreText}>
          +{suggestions.length - maxItems} more items
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  inlineContainer: {
    backgroundColor: '#F0F4F8',
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
    borderRadius: 8,
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  dismissButton: {
    padding: 4,
  },
  dismissText: {
    fontSize: 18,
    color: '#666',
  },
  horizontalList: {
    gap: 12,
  },
  verticalList: {
    gap: 12,
  },
  itemContainer: {
    width: 280,
    position: 'relative',
  },
  scoreContainer: {
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
    fontSize: 11,
    fontWeight: '600',
  },
  moreText: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#DC3545',
    textAlign: 'center',
  },
});

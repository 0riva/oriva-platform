import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { MarketplaceItem } from '../../../types';

export interface MarketplaceItemCardProps {
  entry: MarketplaceItem;
  onBuy: () => void;
  variant?: 'default' | 'compact';
  testID?: string;
}

/**
 * MarketplaceItemCard displays a marketplace item in a card format
 *
 * @component
 */
export const MarketplaceItemCard: React.FC<MarketplaceItemCardProps> = ({
  entry,
  onBuy,
  variant = 'default',
  testID = 'marketplace-item-card',
}) => {
  const isCompact = variant === 'compact';

  return (
    <TouchableOpacity
      style={[styles.card, isCompact && styles.cardCompact]}
      onPress={onBuy}
      testID={testID}
      accessibilityLabel={`Marketplace item: ${entry.content}`}
    >
      <View style={styles.content}>
        <Text style={[styles.title, isCompact && styles.titleCompact]}>
          {entry.content}
        </Text>

        {entry.marketplace_metadata && (
          <View style={styles.metadata}>
            <Text style={styles.itemType}>
              {entry.marketplace_metadata.item_type}
            </Text>
            {entry.marketplace_metadata.price && (
              <Text style={styles.price}>
                {entry.marketplace_metadata.currency} ${entry.marketplace_metadata.price.toFixed(2)}
              </Text>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardCompact: {
    padding: 12,
    borderRadius: 8,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  titleCompact: {
    fontSize: 14,
    marginBottom: 6,
  },
  metadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemType: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#007AFF',
  },
});

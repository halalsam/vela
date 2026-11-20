import type { Offer } from '@vela/api';
import { spacing } from '@vela/tokens';
import { FlatList } from 'react-native';
import Animated from 'react-native-reanimated';
import { useStaggerIn } from '@/hooks/useStaggerIn';
import { haptics } from '@/lib/haptics';
import { OFFER_CARD_WIDTH, OfferCard } from './OfferCard';

const SNAP = OFFER_CARD_WIDTH + spacing.cardGap;

function StaggeredOffer({ offer, index, onPress }: { offer: Offer; index: number; onPress?: (offer: Offer) => void }) {
  const entering = useStaggerIn(index);
  return (
    <Animated.View entering={entering}>
      <OfferCard offer={offer} onPress={() => onPress?.(offer)} />
    </Animated.View>
  );
}

export type OfferStripProps = {
  offers: readonly Offer[];
  onPressOffer?: (offer: Offer) => void;
};

export function OfferStrip({ offers, onPressOffer }: OfferStripProps) {
  return (
    <FlatList
      horizontal
      data={offers}
      keyExtractor={(offer) => offer.id}
      renderItem={({ item, index }) => <StaggeredOffer offer={item} index={index} onPress={onPressOffer} />}
      showsHorizontalScrollIndicator={false}
      snapToInterval={SNAP}
      snapToAlignment="start"
      decelerationRate="fast"
      disableIntervalMomentum
      onMomentumScrollEnd={() => haptics.selection()}
      className="-mx-gutter"
      contentContainerClassName="gap-card-gap px-gutter"
    />
  );
}

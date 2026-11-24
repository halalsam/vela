import { Image } from 'expo-image';
import { View } from 'react-native';
import { mapAsset } from '@/lib/geoAssets';

export type CountryMapProps = {
  code: string;
  /** Bounding box in points. The silhouette is fitted inside it, keeping its shape. */
  width: number;
  height: number;
  opacity?: number;
  className?: string;
};

/** Country outline from the BRIX map set, drawn as a flat white silhouette. Renders nothing for unknown codes. */
export function CountryMap({ code, width, height, opacity = 0.08, className }: CountryMapProps) {
  const source = mapAsset(code);
  if (!source) return null;
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className={className}>
      <Image source={source} style={{ width, height, opacity }} contentFit="contain" transition={0} />
    </View>
  );
}

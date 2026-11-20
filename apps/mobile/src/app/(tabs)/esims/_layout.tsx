import { Stack } from 'expo-router';
import { largeTitleStackOptions } from '@/lib/navigation';

export default function EsimsStackLayout() {
  return <Stack screenOptions={largeTitleStackOptions} />;
}

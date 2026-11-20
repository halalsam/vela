import { Stack } from 'expo-router';
import { largeTitleStackOptions } from '@/lib/navigation';

export default function ProfileStackLayout() {
  return <Stack screenOptions={largeTitleStackOptions} />;
}

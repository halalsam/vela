import { onlineManager, QueryClient } from '@tanstack/react-query';
import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network';
import { useDevStore } from '@/stores/dev';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'online',
    },
  },
});

function reachable(state: NetworkState): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

let deviceOnline = true;

function sync() {
  const forcedOffline = useDevStore.getState().scenario === 'offline';
  onlineManager.setOnline(deviceOnline && !forcedOffline);
}

onlineManager.setEventListener(() => {
  const subscription = addNetworkStateListener((state) => {
    deviceOnline = reachable(state);
    sync();
  });
  getNetworkStateAsync()
    .then((state) => {
      deviceOnline = reachable(state);
      sync();
    })
    .catch(() => undefined);
  return () => subscription.remove();
});

useDevStore.subscribe((state, previous) => {
  if (state.scenario === previous.scenario) return;
  sync();
  void queryClient.resetQueries();
});

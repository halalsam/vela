import { createMockApi } from '@vela/api';
import { currentMockScenario } from '@/stores/dev';

export const api = createMockApi({ scenario: currentMockScenario });

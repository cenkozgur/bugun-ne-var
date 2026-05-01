import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// Authentication is required so that UserSubscription / Reminder rows are
// scoped to the signed-in user via Base44's automatic `created_by` field.
// Anonymous mode put every visitor's onboarding picks into the same shared
// bucket — anyone opening the app saw the previous visitor's selections.
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: true,
  appBaseUrl
});

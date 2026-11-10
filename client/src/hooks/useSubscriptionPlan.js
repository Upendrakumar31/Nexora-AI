import { useEffect, useState, useCallback } from 'react';
import { useClerk, useUser, useAuth } from '@clerk/react';
import api from '../services/api';
import toast from 'react-hot-toast';

export const NEXORA_PRO_PLAN_ID = 'cplan_3LEHfnRMblcgbk48T6cVd3QLW5H';
export const NEXORA_PRO_PLAN_KEY = 'nexora_pro';
export const NEXORA_FREE_PLAN_KEY = 'free_user';

export const useSubscriptionPlan = () => {
  const { isLoaded: isUserLoaded } = useUser();
  const { isSignedIn, has } = useAuth();
  const clerk = useClerk();

  const [serverStatus, setServerStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Check 1: Clerk SDK authorization claims (has)
  const hasProPlan = Boolean(
    has?.({ plan: 'nexora_pro' }) ||
    has?.({ plan: 'user:nexora_pro' }) ||
    has?.({ feature: 'ai_image_generation' }) ||
    has?.({ feature: 'user:ai_image_generation' })
  );

  // Check 2: Verified server-side status directly from backend
  const hasServerPlan = serverStatus?.plan === 'premium';

  // Do not trust arbitrary publicMetadata alone; require verified claims or server status
  const isPremium = Boolean(hasProPlan || hasServerPlan);

  // Fetch verified status from backend
  const fetchServerSubscription = useCallback(async () => {
    if (!isSignedIn) {
      setServerStatus(null);
      return;
    }

    try {
      setLoading(true);
      const res = await api.get('/api/user/subscription');
      if (res.data?.success) {
        setServerStatus({
          plan: res.data.plan,
          isPremium: res.data.isPremium,
          subscription: res.data.subscription,
        });
      }
    } catch {
      // Ignore network errors on passive fetch; fallback to Clerk metadata
    } finally {
      setLoading(false);
    }
  }, [isSignedIn]);

  // Sync subscription after checkout or upon user request
  const refreshSubscription = useCallback(async () => {
    if (!isSignedIn) return null;
    try {
      setSyncing(true);
      const res = await api.post('/api/user/sync-subscription');
      if (res.data?.success) {
        setServerStatus({
          plan: res.data.plan,
          isPremium: res.data.isPremium,
          subscription: res.data.subscription,
        });
        return res.data;
      }
    } catch (err) {
      console.warn('[useSubscriptionPlan] Sync failed:', err.message);
    } finally {
      setSyncing(false);
    }
    return null;
  }, [isSignedIn]);

  useEffect(() => {
    if (isSignedIn && isUserLoaded) {
      fetchServerSubscription();
    }
  }, [isSignedIn, isUserLoaded, fetchServerSubscription]);

  // Open official Clerk Billing checkout drawer
  const openCheckout = useCallback(
    ({ planPeriod = 'month', onComplete } = {}) => {
      if (!isSignedIn) {
        clerk.openSignIn();
        return;
      }

      if (typeof clerk.__internal_openCheckout === 'function') {
        try {
          clerk.__internal_openCheckout({
            planId: NEXORA_PRO_PLAN_ID,
            planPeriod,
            for: 'user',
            newSubscriptionRedirectUrl: '/ai',
            onSubscriptionComplete: async () => {
              toast.success('🎉 Subscription active! Welcome to Nexora Pro.');
              await refreshSubscription();
              if (typeof onComplete === 'function') onComplete();
            },
          });
          return;
        } catch (err) {
          console.warn('[useSubscriptionPlan] internal openCheckout error:', err);
        }
      }

      // Fallback: Open User Profile with Billing tab
      if (typeof clerk.openUserProfile === 'function') {
        clerk.openUserProfile();
      }
    },
    [clerk, isSignedIn, refreshSubscription]
  );

  // Open Clerk user profile for subscription management
  const manageSubscription = useCallback(() => {
    if (typeof clerk.openUserProfile === 'function') {
      clerk.openUserProfile();
    }
  }, [clerk]);

  return {
    isPremium,
    planName: isPremium ? 'Nexora Pro' : 'Free Plan',
    planKey: isPremium ? NEXORA_PRO_PLAN_KEY : NEXORA_FREE_PLAN_KEY,
    loading: loading || !isUserLoaded,
    syncing,
    serverStatus,
    openCheckout,
    manageSubscription,
    refreshSubscription,
  };
};

export default useSubscriptionPlan;

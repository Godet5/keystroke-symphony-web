// Custom Hook: useProfile with React Query Caching
// Purpose: Fetch and cache user profile with automatic revalidation
// Created: 2025-11-25

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabaseClient';

/**
 * Fetch user profile with caching and automatic updates
 * @returns {object} { profile, loading, error, refetch, updateProfile }
 */
export function useProfile() {
  const queryClient = useQueryClient();

  // Fetch profile with caching
  const {
    data: profile,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    retry: 2,
  });

  // Update profile mutation
  const updateMutation = useMutation({
    mutationFn: async (updates) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Update cache immediately
      queryClient.setQueryData(['profile'], data);
    },
  });

  return {
    profile,
    loading: isLoading,
    error,
    refetch,
    updateProfile: updateMutation.mutate,
    isUpdating: updateMutation.isLoading,
  };
}

/**
 * Calculate user age from birthdate
 * @param {string} birthdate - ISO date string
 * @returns {number} Age in years
 */
export function calculateAge(birthdate) {
  if (!birthdate) return null;
  const today = new Date();
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Check if user requires parental consent
 * @param {object} profile - User profile object
 * @returns {boolean}
 */
export function requiresParentalConsent(profile) {
  if (!profile?.birthdate) return false;
  const age = calculateAge(profile.birthdate);
  return age < 13 && !profile.parent_approved;
}

/**
 * Get user access level based on profile
 * @param {object} profile - User profile object
 * @returns {string} 'public' | 'free' | 'basic' | 'pro' | 'admin'
 */
export function getAccessLevel(profile) {
  if (!profile) return 'public';
  return profile.subscription_tier || 'public';
}

/**
 * Check if user can access feature
 * @param {object} profile - User profile object
 * @param {string} feature - Feature name
 * @returns {boolean}
 */
export function canAccessFeature(profile, feature) {
  const accessMap = {
    'neural-training': ['public', 'free', 'basic', 'pro', 'admin'],
    'studio': ['free', 'basic', 'pro', 'admin'],
    'save-progress': ['basic', 'pro', 'admin'],
    'remix': ['pro', 'admin'],
    'consult': ['pro', 'admin'],
    'forum': ['free', 'basic', 'pro', 'admin'], // But also checks age 13+
    'admin-panel': ['admin'],
  };

  const tier = getAccessLevel(profile);
  const allowedTiers = accessMap[feature] || [];

  // Special case: forum requires 13+ and parental approval
  if (feature === 'forum') {
    const age = calculateAge(profile?.birthdate);
    if (age < 13) return false;
    if (age < 18 && !profile?.parent_approved) return false;
  }

  return allowedTiers.includes(tier);
}

// Custom Hook: useAuditLog
// Purpose: Fetch user activity log for parental dashboard
// Created: 2025-11-25

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabaseClient';

/**
 * Fetch audit log for a user (requires admin or parent access)
 * @param {string} userId - User ID to fetch logs for
 * @param {number} limit - Number of logs to fetch (default 100)
 * @returns {object} { logs, loading, error, refetch }
 */
export function useAuditLog(userId, limit = 100) {
  const {
    data: logs,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['audit-log', userId, limit],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase.rpc('get_user_audit_log', {
        target_user_id: userId,
        limit_rows: limit,
      });

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
    staleTime: 1 * 60 * 1000, // 1 minute
    cacheTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    logs,
    loading: isLoading,
    error,
    refetch,
  };
}

/**
 * Format audit log action for display
 * @param {string} action - Action type from audit_log
 * @returns {object} { label, icon, color }
 */
export function formatAction(action) {
  const actionMap = {
    profile_created: {
      label: 'Account Created',
      icon: '👤',
      color: 'green',
    },
    profile_updated: {
      label: 'Profile Updated',
      icon: '✏️',
      color: 'blue',
    },
    parental_consent_approved: {
      label: 'Parental Consent Approved',
      icon: '✅',
      color: 'green',
    },
    parental_consent_revoked: {
      label: 'Consent Revoked',
      icon: '⚠️',
      color: 'orange',
    },
    subscription_activated: {
      label: 'Subscription Activated',
      icon: '💳',
      color: 'green',
    },
    subscription_cancelled: {
      label: 'Subscription Cancelled',
      icon: '🚫',
      color: 'red',
    },
    consultation_booked: {
      label: 'Consultation Booked',
      icon: '📅',
      color: 'blue',
    },
    addon_purchased: {
      label: 'Add-on Purchased',
      icon: '🛒',
      color: 'purple',
    },
    data_exported: {
      label: 'Data Exported',
      icon: '📥',
      color: 'gray',
    },
    account_deleted: {
      label: 'Account Deleted',
      icon: '🗑️',
      color: 'red',
    },
  };

  return actionMap[action] || {
    label: action,
    icon: '📝',
    color: 'gray',
  };
}

/**
 * Group logs by date
 * @param {array} logs - Audit log array
 * @returns {object} Logs grouped by date
 */
export function groupLogsByDate(logs) {
  if (!logs || logs.length === 0) return {};

  return logs.reduce((groups, log) => {
    const date = new Date(log.created_at).toLocaleDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(log);
    return groups;
  }, {});
}

/**
 * Get activity summary statistics
 * @param {array} logs - Audit log array
 * @returns {object} Summary stats
 */
export function getActivitySummary(logs) {
  if (!logs || logs.length === 0) {
    return {
      totalActions: 0,
      lastActivity: null,
      mostFrequentAction: null,
    };
  }

  const actionCounts = logs.reduce((counts, log) => {
    counts[log.action] = (counts[log.action] || 0) + 1;
    return counts;
  }, {});

  const mostFrequent = Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1])[0];

  return {
    totalActions: logs.length,
    lastActivity: logs[0]?.created_at,
    mostFrequentAction: mostFrequent ? {
      action: mostFrequent[0],
      count: mostFrequent[1],
    } : null,
  };
}

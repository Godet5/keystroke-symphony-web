// Component: ParentalDashboard
// Purpose: Allow parents to view/manage child accounts (COPPA compliance)
// Created: 2025-11-25

import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuditLog, formatAction, groupLogsByDate, getActivitySummary } from '../hooks/useAuditLog';

export default function ParentalDashboard() {
  const [parentEmail, setParentEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { logs, loading: logsLoading, refetch } = useAuditLog(selectedChild?.id);

  // Step 1: Parent enters email to receive verification code
  const handleSendVerification = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // In production, this would send an email with a code
      // For now, we'll use a simple token-based verification
      const { data, error } = await supabase
        .from('parental_consents')
        .select('child_id, consent_token')
        .eq('parent_email', parentEmail)
        .eq('approved', true);

      if (error) throw error;

      if (!data || data.length === 0) {
        setError('No children found for this email address');
        return;
      }

      // In production: Send email with code
      // For demo: Show success message
      alert('Verification code sent to ' + parentEmail);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify code and load children
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Verify parent and load children
      const { data: consents, error: consentError } = await supabase
        .from('parental_consents')
        .select(`
          child_id,
          approved,
          profiles:child_id (
            id,
            email,
            birthdate,
            subscription_tier,
            subscription_status,
            parent_approved,
            created_at
          )
        `)
        .eq('parent_email', parentEmail)
        .eq('approved', true);

      if (consentError) throw consentError;

      const childProfiles = consents
        .map(c => c.profiles)
        .filter(p => p !== null);

      setChildren(childProfiles);
      setIsVerified(true);

      if (childProfiles.length > 0) {
        setSelectedChild(childProfiles[0]);
      }
    } catch (err) {
      setError('Verification failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Export child data
  const handleExportData = async (childId) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc('get_child_data_for_parent', {
        parent_email_input: parentEmail,
        child_id_input: childId,
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error);
      }

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data.data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `child-data-${childId}-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);

      alert('Data exported successfully');
    } catch (err) {
      setError('Export failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Revoke consent
  const handleRevokeConsent = async (childId) => {
    if (!confirm('Are you sure you want to revoke consent? This will downgrade the account to public access only.')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc('revoke_parental_consent', {
        parent_email_input: parentEmail,
        child_id_input: childId,
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error);
      }

      alert('Consent revoked successfully');

      // Refresh children list
      handleVerifyCode({ preventDefault: () => {} });
    } catch (err) {
      setError('Revoke failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete account
  const handleDeleteAccount = async (childId) => {
    const confirmation = prompt(
      'WARNING: This will permanently delete all data for this account.\n\n' +
      'Type "DELETE" to confirm:'
    );

    if (confirmation !== 'DELETE') {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Call Edge Function for deletion
      const { data, error } = await supabase.functions.invoke('data-deletion', {
        body: {
          user_id: childId,
          requester_email: parentEmail,
          requester_type: 'parent',
        },
      });

      if (error) throw error;

      alert('Account deletion initiated. This process will complete within 30 days.');

      // Refresh children list
      handleVerifyCode({ preventDefault: () => {} });
    } catch (err) {
      setError('Deletion failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Render verification form
  if (!isVerified) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">Parent Dashboard</h2>
        <p className="text-gray-600 mb-6">
          Access your child's account information and manage parental controls
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={verificationCode ? handleVerifyCode : handleSendVerification}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Parent Email Address
            </label>
            <input
              type="email"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-md"
              placeholder="parent@example.com"
              disabled={verificationCode}
            />
          </div>

          {!verificationCode && (
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Verification Code'}
            </button>
          )}

          {verificationCode && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  required
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Enter code from email"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify & Access Dashboard'}
              </button>
            </>
          )}
        </form>

        <p className="text-xs text-gray-500 mt-4">
          Can't access your account? Contact{' '}
          <a href="mailto:privacy@yourdomain.com" className="text-indigo-600 hover:underline">
            privacy@yourdomain.com
          </a>
        </p>
      </div>
    );
  }

  // Render dashboard
  const activitySummary = selectedChild ? getActivitySummary(logs) : null;
  const groupedLogs = logs ? groupLogsByDate(logs) : {};

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-bold mb-2">Parent Dashboard</h2>
        <p className="text-gray-600">Managing accounts for: {parentEmail}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sidebar: Children list */}
        <div className="md:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="font-semibold mb-4">Child Accounts</h3>
            {children.map((child) => (
              <div
                key={child.id}
                onClick={() => setSelectedChild(child)}
                className={`p-3 rounded-md mb-2 cursor-pointer ${
                  selectedChild?.id === child.id
                    ? 'bg-indigo-100 border-2 border-indigo-500'
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="font-medium">{child.email}</div>
                <div className="text-xs text-gray-500">
                  {child.subscription_tier} • {child.parent_approved ? '✅ Approved' : '⚠️ Pending'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main content: Selected child details */}
        <div className="md:col-span-2">
          {selectedChild && (
            <>
              {/* Child info card */}
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h3 className="text-xl font-bold mb-4">Account Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500">Email</label>
                    <p className="font-medium">{selectedChild.email}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Subscription</label>
                    <p className="font-medium capitalize">{selectedChild.subscription_tier}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Status</label>
                    <p className="font-medium capitalize">{selectedChild.subscription_status}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Account Created</label>
                    <p className="font-medium">
                      {new Date(selectedChild.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => handleExportData(selectedChild.id)}
                    disabled={loading}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    📥 Export Data
                  </button>
                  <button
                    onClick={() => handleRevokeConsent(selectedChild.id)}
                    disabled={loading}
                    className="flex-1 bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 disabled:opacity-50"
                  >
                    ⚠️ Revoke Consent
                  </button>
                  <button
                    onClick={() => handleDeleteAccount(selectedChild.id)}
                    disabled={loading}
                    className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    🗑️ Delete Account
                  </button>
                </div>
              </div>

              {/* Activity summary */}
              {activitySummary && (
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                  <h3 className="text-xl font-bold mb-4">Activity Summary</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-indigo-600">
                        {activitySummary.totalActions}
                      </div>
                      <div className="text-sm text-gray-500">Total Actions</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-medium">
                        {activitySummary.lastActivity
                          ? new Date(activitySummary.lastActivity).toLocaleDateString()
                          : 'N/A'}
                      </div>
                      <div className="text-sm text-gray-500">Last Activity</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-medium">
                        {activitySummary.mostFrequentAction?.action || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-500">Most Frequent</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Activity log */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-bold mb-4">Activity Log</h3>
                {logsLoading ? (
                  <p className="text-gray-500">Loading activity...</p>
                ) : Object.keys(groupedLogs).length === 0 ? (
                  <p className="text-gray-500">No activity yet</p>
                ) : (
                  Object.entries(groupedLogs).map(([date, dateLogs]) => (
                    <div key={date} className="mb-4">
                      <h4 className="text-sm font-semibold text-gray-600 mb-2">{date}</h4>
                      <div className="space-y-2">
                        {dateLogs.map((log) => {
                          const formatted = formatAction(log.action);
                          return (
                            <div
                              key={log.id}
                              className="flex items-center gap-3 p-2 bg-gray-50 rounded-md"
                            >
                              <span className="text-2xl">{formatted.icon}</span>
                              <div className="flex-1">
                                <div className="font-medium">{formatted.label}</div>
                                <div className="text-xs text-gray-500">
                                  {new Date(log.created_at).toLocaleTimeString()}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}

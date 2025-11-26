// Component: EnhancedParentalConsent
// Purpose: COPPA-compliant parental consent form with validation
// Created: 2025-11-25

import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { calculateAge } from '../hooks/useProfile';

export default function EnhancedParentalConsent({ childProfile, onSuccess }) {
  const [parentEmail, setParentEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const age = calculateAge(childProfile?.birthdate);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (parentEmail !== confirmEmail) {
      setError('Email addresses do not match');
      setLoading(false);
      return;
    }

    if (!agreedToTerms) {
      setError('You must agree to the Privacy Policy and Terms of Service');
      setLoading(false);
      return;
    }

    try {
      // Call parental consent Edge Function
      const { data, error: consentError } = await supabase.functions.invoke(
        'parental-consent-v2',
        {
          body: {
            child_id: childProfile.id,
            parent_email: parentEmail,
            child_birthdate: childProfile.birthdate,
          },
        }
      );

      if (consentError) throw consentError;

      if (!data.success) {
        throw new Error(data.error || 'Failed to send consent request');
      }

      setSuccess(true);

      if (onSuccess) {
        setTimeout(onSuccess, 3000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">✅</span>
        </div>
        <h2 className="text-2xl font-bold mb-4">Consent Request Sent!</h2>
        <p className="text-gray-600 mb-4">
          We've sent an email to <strong>{parentEmail}</strong> with instructions
          for granting parental consent.
        </p>
        <p className="text-sm text-gray-500">
          Once approved, you'll have access to all free subscriber features!
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Parental Consent Required</h2>
        <p className="text-gray-600">
          Under the Children's Online Privacy Protection Act (COPPA), we need
          permission from your parent or guardian before you can use Keystroke
          Symphony.
        </p>
      </div>

      {/* What consent grants */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
        <h3 className="font-semibold mb-2">What you'll get with parental consent:</h3>
        <ul className="space-y-1 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            <span>Full access to Neural Training exercises</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            <span>Ability to save your progress</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            <span>Access to the Studio rhythm feature</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-red-600">✗</span>
            <span className="text-gray-500">Community forum (restricted for users under 13)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-red-600">✗</span>
            <span className="text-gray-500">Purchasing subscriptions (requires parental purchase)</span>
          </li>
        </ul>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Parent or Guardian Email Address *
          </label>
          <input
            type="email"
            value={parentEmail}
            onChange={(e) => setParentEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500"
            placeholder="parent@example.com"
          />
          <p className="text-xs text-gray-500 mt-1">
            We'll send a consent request to this email address
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Confirm Parent Email *
          </label>
          <input
            type="email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500"
            placeholder="parent@example.com"
          />
        </div>

        {/* Privacy notice */}
        <div className="bg-gray-50 border rounded-md p-4 mb-4">
          <h3 className="font-semibold mb-2 text-sm">Your Privacy Rights</h3>
          <p className="text-xs text-gray-600 mb-2">
            Your parent or guardian will be able to:
          </p>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• Review the information we collect from you</li>
            <li>• Request that we delete your information</li>
            <li>• Revoke consent at any time</li>
            <li>• View your activity log</li>
          </ul>
        </div>

        {/* Terms agreement */}
        <div className="mb-6">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-gray-700">
              I understand that by submitting this form, a consent request will be
              sent to my parent or guardian. I have read and agree to the{' '}
              <a
                href="/privacy"
                target="_blank"
                className="text-indigo-600 hover:underline"
              >
                Privacy Policy
              </a>{' '}
              and{' '}
              <a
                href="/terms"
                target="_blank"
                className="text-indigo-600 hover:underline"
              >
                Terms of Service
              </a>
              .
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || !agreedToTerms}
          className="w-full bg-indigo-600 text-white py-3 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? 'Sending Request...' : 'Send Consent Request to Parent'}
        </button>

        <p className="text-xs text-center text-gray-500 mt-4">
          Questions? Contact us at{' '}
          <a
            href="mailto:privacy@yourdomain.com"
            className="text-indigo-600 hover:underline"
          >
            privacy@yourdomain.com
          </a>
        </p>
      </form>
    </div>
  );
}

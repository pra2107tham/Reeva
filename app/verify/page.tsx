"use client"

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Layout from '@/components/Layout'

function VerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [igId, setIgId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [profile, setProfile] = useState<{
    username: string | null
    name: string | null
    profile_picture_url: string | null
  } | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(false)

  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/profile')
        if (response.ok) {
          setIsAuthenticated(true)
          const tokenParam = searchParams.get('token')
          const igIdParam = searchParams.get('ig_id')
          
          if (!tokenParam || !igIdParam) {
            setError('Invalid verification link. Missing token or Instagram ID.')
            setLoading(false)
            return
          }
          
          setToken(tokenParam)
          setIgId(igIdParam)
          setLoading(false)
          
          // Fetch Instagram profile details
          fetchProfileDetails(igIdParam)
        } else {
          // Not authenticated - show login/signup options
          setLoading(false)
        }
      } catch (err) {
        setError('Failed to check authentication status')
        setLoading(false)
      }
    }

    checkAuth()
  }, [router, searchParams])

  const fetchProfileDetails = async (igId: string) => {
    setLoadingProfile(true)
    try {
      const response = await fetch(`/api/instagram/profile?ig_id=${encodeURIComponent(igId)}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.profile) {
          setProfile(data.profile)
        }
      }
      // Silently fail - profile details are optional
    } catch (err) {
      // Silently fail - profile details are optional
    } finally {
      setLoadingProfile(false)
    }
  }

  const handleConfirm = async () => {
    if (!token || !igId) {
      setError('Missing verification token or Instagram ID')
      return
    }

    setConfirming(true)
    setError('')

    try {
      const response = await fetch('/api/auth/verify-instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ig_id: igId }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to link Instagram account')
        setConfirming(false)
        return
      }

      // Success - redirect to profile
      router.push('/profile?success=Instagram account linked successfully')
    } catch (err: any) {
      setError(err.message || 'An error occurred')
      setConfirming(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Checking authentication...</p>
          </div>
        </div>
      </Layout>
    )
  }

  if (!isAuthenticated) {
    // Show login/signup options
    const currentUrl = window.location.href
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center px-4 py-12">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Link Your Instagram Account
              </h1>
              <p className="text-gray-600">
                Please sign in or create an account to link your Instagram profile with Reeva.
              </p>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => router.push(`/login?redirect=${encodeURIComponent(currentUrl)}`)}
                className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
              >
                Sign In
              </button>

              <div className="text-center text-gray-500 text-sm">OR</div>

              <button
                onClick={() => router.push(`/signup?redirect=${encodeURIComponent(currentUrl)}`)}
                className="w-full bg-gray-100 text-gray-900 py-3 px-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Create Account
              </button>
            </div>

            <button
              onClick={() => router.push('/')}
              className="w-full mt-4 text-gray-600 py-2 px-4 rounded-lg font-medium hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Link Your Instagram Account
            </h1>
            <p className="text-gray-600">
              Connect your Instagram account to Reeva to start organizing your saved Reels.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Instagram Profile Display */}
          {loadingProfile ? (
            <div className="mb-6 p-6 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mr-3"></div>
                <p className="text-sm text-gray-600">Loading Instagram profile...</p>
              </div>
            </div>
          ) : profile ? (
            <div className="mb-6 p-6 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
              <div className="flex items-center space-x-4 mb-4">
                {profile.profile_picture_url ? (
                  <img
                    src={profile.profile_picture_url}
                    alt={profile.username || 'Instagram'}
                    className="w-16 h-16 rounded-full border-2 border-purple-300 object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-purple-200 border-2 border-purple-300 flex items-center justify-center">
                    <svg className="w-8 h-8 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </div>
                )}
                <div className="flex-1">
                  {profile.name && (
                    <p className="text-lg font-semibold text-gray-900">{profile.name}</p>
                  )}
                  {profile.username && (
                    <p className="text-sm text-gray-600">@{profile.username}</p>
                  )}
                  {!profile.name && !profile.username && (
                    <p className="text-sm text-gray-600">Instagram Account</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-3">
                By clicking confirm, you authorize Reeva to access your Instagram account data.
              </p>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-sm text-gray-700 mb-2">
                <strong>Instagram ID:</strong> {igId}
              </p>
              <p className="text-xs text-gray-500">
                By clicking confirm, you authorize Reeva to access your Instagram account data.
              </p>
            </div>
          )}

          <button
            onClick={handleConfirm}
            disabled={confirming || !token || !igId}
            className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {confirming ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Linking...
              </>
            ) : (
              'Confirm & Link Instagram Account'
            )}
          </button>

          <button
            onClick={() => router.push('/profile')}
            className="w-full mt-4 text-gray-600 py-2 px-4 rounded-lg font-medium hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </Layout>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </Layout>
    }>
      <VerifyContent />
    </Suspense>
  )
}


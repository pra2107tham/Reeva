"use client"

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Layout from '@/components/Layout'

function SignupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          password, 
          full_name: fullName,
          provider: 'email' 
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to create account')
        return
      }

      setSuccess(true)
      // Redirect to login after showing success message, preserving redirect URL
      const redirectUrl = searchParams.get('redirect')
      setTimeout(() => {
        if (redirectUrl) {
          router.push(`/login?redirect=${encodeURIComponent(redirectUrl)}`)
        } else {
          router.push('/login')
        }
      }, 3000)
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    setError('')
    setLoading(true)

    try {
      const redirectUrl = searchParams.get('redirect')
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          provider: 'google',
          redirect: redirectUrl || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to initiate Google signup')
        return
      }

      // Redirect to Google OAuth
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '100px 20px 20px' }}>
        <div style={{ maxWidth: '400px', width: '100%', background: 'rgba(255, 255, 255, 0.05)', padding: '40px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <h1 style={{ color: '#fff', marginBottom: '30px', fontSize: '28px', textAlign: 'center' }}>Sign Up</h1>

          {searchParams.get('redirect') && (
            <div style={{ background: 'rgba(79, 26, 214, 0.1)', border: '1px solid rgba(79, 26, 214, 0.3)', color: '#a78bfa', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' }}>
              Create an account to link your Instagram profile with Reeva.
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(255, 0, 0, 0.1)', border: '1px solid rgba(255, 0, 0, 0.3)', color: '#ff6b6b', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ background: 'rgba(0, 255, 0, 0.1)', border: '1px solid rgba(0, 255, 0, 0.3)', color: '#51cf66', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
              Account created! Please check your email to confirm your account. Redirecting to login...
            </div>
          )}

          <form onSubmit={handleEmailSignup} style={{ marginBottom: '20px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#fff', marginBottom: '8px', fontSize: '14px' }}>
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={loading || success}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '16px',
                }}
                placeholder="John Doe"
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#fff', marginBottom: '8px', fontSize: '14px' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading || success}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '16px',
                }}
                placeholder="your@email.com"
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#fff', marginBottom: '8px', fontSize: '14px' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading || success}
                minLength={6}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '16px',
                }}
                placeholder="At least 6 characters"
              />
            </div>

            <button
              type="submit"
              disabled={loading || success}
              style={{
                width: '100%',
                padding: '12px',
                background: loading || success ? 'rgba(79, 26, 214, 0.5)' : 'rgba(79, 26, 214, 1)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loading || success ? 'not-allowed' : 'pointer',
                marginBottom: '20px',
              }}
            >
              {loading ? 'Creating Account...' : success ? 'Account Created!' : 'Sign Up'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginBottom: '20px', color: 'rgba(255, 255, 255, 0.6)' }}>
            OR
          </div>

          <button
            onClick={handleGoogleSignup}
            disabled={loading || success}
            style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading || success ? 'not-allowed' : 'pointer',
              marginBottom: '20px',
            }}
          >
            Continue with Google
          </button>

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <a href="/login" style={{ color: 'rgba(79, 26, 214, 1)', textDecoration: 'none' }}>
              Already have an account? Login
            </a>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <Layout>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </Layout>
    }>
      <SignupContent />
    </Suspense>
  )
}

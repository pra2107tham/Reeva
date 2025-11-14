"use client"

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Layout from '@/components/Layout'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    // Check for success/error messages in query params
    const successParam = searchParams.get('success')
    const errorParam = searchParams.get('error')
    
    if (successParam) {
      setSuccess(decodeURIComponent(successParam))
    }
    
    if (errorParam) {
      setError(decodeURIComponent(errorParam))
    }
  }, [searchParams])

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, provider: 'email' }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Login failed')
        return
      }

      // Success - redirect to profile or redirect URL
      const redirectUrl = searchParams.get('redirect')
      if (redirectUrl) {
        router.push(redirectUrl)
      } else {
        router.push('/profile')
      }
      router.refresh()
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const redirectUrl = searchParams.get('redirect')
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          provider: 'google',
          redirect: redirectUrl || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to initiate Google login')
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
          <h1 style={{ color: '#fff', marginBottom: '30px', fontSize: '28px', textAlign: 'center' }}>Login</h1>

          {error && (
            <div style={{ background: 'rgba(255, 0, 0, 0.1)', border: '1px solid rgba(255, 0, 0, 0.3)', color: '#ff6b6b', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ background: 'rgba(0, 255, 0, 0.1)', border: '1px solid rgba(0, 255, 0, 0.3)', color: '#51cf66', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
              {success}
            </div>
          )}

          <form onSubmit={handleEmailLogin} style={{ marginBottom: '20px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#fff', marginBottom: '8px', fontSize: '14px' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
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
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '16px',
                }}
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                background: loading ? 'rgba(79, 26, 214, 0.5)' : 'rgba(79, 26, 214, 1)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginBottom: '20px',
              }}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginBottom: '20px', color: 'rgba(255, 255, 255, 0.6)' }}>
            OR
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '20px',
            }}
          >
            Continue with Google
          </button>

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <a href="/signup" style={{ color: 'rgba(79, 26, 214, 1)', textDecoration: 'none' }}>
              Don't have an account? Sign up
            </a>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <Layout>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '100px 20px 20px' }}>
          <div style={{ color: '#fff', fontSize: '18px' }}>Loading...</div>
        </div>
      </Layout>
    }>
      <LoginContent />
    </Suspense>
  )
}

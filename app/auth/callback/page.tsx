"use client"

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = createClient()
        
        // Get the hash fragment from the URL (contains access_token, etc.)
        const hash = window.location.hash.substring(1)
        const queryString = window.location.search.substring(1)
        
        console.log('[Auth Callback] Full hash:', hash.substring(0, 100) + '...')
        console.log('[Auth Callback] Query string:', queryString.substring(0, 100) + '...')
        
        // Check both hash fragment and query params for tokens
        const hashParams = new URLSearchParams(hash)
        const queryParams = new URLSearchParams(queryString)
        
        const accessToken = hashParams.get('access_token') || queryParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token')
        const type = hashParams.get('type') || queryParams.get('type') || searchParams.get('type')
        
        // Also check for code parameter (used in some Supabase flows)
        const code = queryParams.get('code')

        console.log('[Auth Callback] Hash params:', { 
          hasAccessToken: !!accessToken, 
          hasRefreshToken: !!refreshToken, 
          accessTokenLength: accessToken?.length,
          refreshTokenLength: refreshToken?.length,
          type 
        })

        // If we have a code parameter, redirect to API callback (handles OAuth)
        if (code && !accessToken) {
          console.log('[Auth Callback] Found code parameter, redirecting to API callback')
          window.location.href = `/api/auth/callback?code=${code}&type=${type || 'signup'}`
          return
        }

        // If we have tokens in the hash or query, set the session
        if (accessToken && refreshToken) {
          console.log('[Auth Callback] Attempting to set session...')
          console.log('[Auth Callback] Access token length:', accessToken.length)
          console.log('[Auth Callback] Refresh token length:', refreshToken.length)
          
          let sessionData: any = null
          
          try {
            // Try to get session first to see current state
            const { data: currentSession } = await supabase.auth.getSession()
            console.log('[Auth Callback] Current session before setSession:', currentSession.session ? 'exists' : 'none')
            
            const { data, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            
            console.log('[Auth Callback] setSession response:', {
              hasData: !!data,
              hasSession: !!data?.session,
              hasUser: !!data?.user,
              error: sessionError ? sessionError.message : null
            })

            if (sessionError) {
              const errorDetails = {
                message: sessionError.message,
                status: sessionError.status,
                name: sessionError.name,
              }
              console.error('[Auth Callback] Session error details:', errorDetails)
              
              // Log to server
              fetch('/api/auth/callback-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  error: 'Session setting failed',
                  details: errorDetails,
                  hash: hash.substring(0, 200)
                }),
              }).catch(() => {})
              
              window.location.href = `/login?error=${encodeURIComponent(sessionError.message || 'Authentication failed. Please try again.')}`
              return
            }

            if (!data || !data.session) {
              console.error('[Auth Callback] No session returned after setSession', data)
              
              // Log to server
              fetch('/api/auth/callback-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  error: 'No session returned',
                  details: { data: data ? 'exists but no session' : 'null', hasUser: !!data?.user },
                  hash: hash.substring(0, 200)
                }),
              }).catch(() => {})
              
              window.location.href = `/login?error=${encodeURIComponent('Session creation failed. Please try again.')}`
              return
            }

            sessionData = data
            console.log('[Auth Callback] Session set successfully, user:', data.user?.id, 'session exists:', !!data.session)
            
            // Verify session was actually persisted
            const { data: verifySession } = await supabase.auth.getSession()
            console.log('[Auth Callback] Session verification:', verifySession.session ? 'confirmed' : 'NOT SET')
            
            if (!verifySession.session) {
              console.error('[Auth Callback] Session not persisted after setSession')
              
              // Log to server
              fetch('/api/auth/callback-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  error: 'Session not persisted',
                  details: { 
                    setSessionReturned: !!sessionData?.session,
                    verifySessionExists: false
                  },
                }),
              }).catch(() => {})
              
              window.location.href = `/login?error=${encodeURIComponent('Session could not be saved. Please try again.')}`
              return
            }
            
            // Small delay to ensure cookies are set
            await new Promise(resolve => setTimeout(resolve, 200))
          } catch (setSessionError: any) {
            console.error('[Auth Callback] Exception during setSession:', setSessionError)
            
            // Log to server
            fetch('/api/auth/callback-log', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                error: 'Exception during setSession',
                details: {
                  message: setSessionError?.message,
                  stack: setSessionError?.stack,
                  name: setSessionError?.name,
                },
                hash: hash.substring(0, 200)
              }),
            }).catch(() => {})
            
            window.location.href = `/login?error=${encodeURIComponent(setSessionError?.message || 'Failed to set session. Please try again.')}`
            return
          }

          // Clear the hash from URL
          window.history.replaceState(null, '', window.location.pathname + window.location.search)

          // Create profile after email confirmation via API route
          if (sessionData?.user) {
            try {
              const fullName = sessionData.user.user_metadata?.full_name || 
                              sessionData.user.user_metadata?.name || 
                              sessionData.user.email?.split('@')[0] || 
                              'User'
              
              // Create profile using service role (bypasses RLS)
              await fetch('/api/auth/profile/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ full_name: fullName }),
              }).catch((err) => {
                console.error('[Auth Callback] Profile creation failed:', err)
                // Profile will be created on first profile page access
              })
            } catch (err) {
              console.error('[Auth Callback] Profile creation error:', err)
              // Silent fail - profile will be created when user accesses profile page
            }
          }

          // Redirect based on type - use window.location for more reliable redirect
          if (type === 'signup') {
            window.location.href = '/login?success=' + encodeURIComponent('Email confirmed! You can now login.')
          } else {
            window.location.href = '/profile'
          }
        } else {
          // No tokens found, check for error
          const errorParam = hashParams.get('error') || searchParams.get('error')
          if (errorParam) {
            console.error('[Auth Callback] Error in URL:', errorParam)
            
            // Log to server
            fetch('/api/auth/callback-log', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                error: 'Error parameter in URL',
                details: { errorParam },
                hash: hash.substring(0, 200)
              }),
            }).catch(() => {})
            
            window.location.href = `/login?error=${encodeURIComponent(errorParam)}`
          } else {
            console.error('[Auth Callback] No tokens found in hash')
            
            // Log to server
            fetch('/api/auth/callback-log', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                error: 'No tokens found in hash',
                details: { hashLength: hash.length, hashPreview: hash.substring(0, 200) },
                url: window.location.href
              }),
            }).catch(() => {})
            
            window.location.href = '/login?error=' + encodeURIComponent('Invalid authentication link. Please try signing up again.')
          }
        }
      } catch (err: any) {
        console.error('[Auth Callback] Unexpected error:', err)
        
        // Log to server
        fetch('/api/auth/callback-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            error: 'Unexpected error in callback',
            details: {
              message: err?.message,
              stack: err?.stack,
              name: err?.name,
            },
            url: window.location.href
          }),
        }).catch(() => {})
        
        setError('An unexpected error occurred')
        setTimeout(() => {
          window.location.href = '/login?error=' + encodeURIComponent('Authentication failed. Please try again.')
        }, 2000)
      }
    }

    // Small delay to ensure router is ready
    const timer = setTimeout(() => {
      handleCallback()
    }, 100)

    return () => clearTimeout(timer)
  }, [router, searchParams])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px' }}>
      <div style={{ color: '#fff', fontSize: '18px' }}>Processing authentication...</div>
      {error && (
        <div style={{ color: '#ff6b6b', fontSize: '14px' }}>{error}</div>
      )}
    </div>
  )
}


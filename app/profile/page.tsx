"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'

interface Profile {
  id: string
  full_name: string | null
  created_at: string
  updated_at: string
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/auth/profile')
      
      if (response.status === 401) {
        router.push('/login')
        return
      }

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to load profile')
        return
      }

      const data = await response.json()
      setProfile(data.profile)
      setFullName(data.profile.full_name || '')
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to update profile')
        return
      }

      setProfile(data.profile)
      setSuccess('Profile updated successfully!')
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch (err) {
      // Silent fail - user will be redirected anyway
    }
  }

  if (loading) {
    return (
      <Layout>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '100px 20px 20px' }}>
          <div style={{ color: '#fff', fontSize: '18px' }}>Loading...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '100px 20px 20px' }}>
        <div style={{ maxWidth: '600px', width: '100%', background: 'rgba(255, 255, 255, 0.05)', padding: '40px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <h1 style={{ color: '#fff', fontSize: '28px', margin: 0 }}>Profile</h1>
            <button
              onClick={handleLogout}
              style={{
                padding: '8px 16px',
                background: 'rgba(255, 0, 0, 0.2)',
                border: '1px solid rgba(255, 0, 0, 0.3)',
                borderRadius: '8px',
                color: '#ff6b6b',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Logout
            </button>
          </div>

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

          {profile && (
            <>
              <div style={{ marginBottom: '30px' }}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '5px', fontSize: '12px' }}>
                    User ID
                  </label>
                  <div style={{ color: '#fff', fontSize: '14px', fontFamily: 'monospace' }}>
                    {profile.id}
                  </div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '5px', fontSize: '12px' }}>
                    Created At
                  </label>
                  <div style={{ color: '#fff', fontSize: '14px' }}>
                    {new Date(profile.created_at).toLocaleString()}
                  </div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '5px', fontSize: '12px' }}>
                    Last Updated
                  </label>
                  <div style={{ color: '#fff', fontSize: '14px' }}>
                    {new Date(profile.updated_at).toLocaleString()}
                  </div>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', color: '#fff', marginBottom: '8px', fontSize: '14px' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={saving}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '16px',
                    }}
                    placeholder="Enter your full name"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: saving ? 'rgba(79, 26, 214, 0.5)' : 'rgba(79, 26, 214, 1)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? 'Saving...' : 'Update Profile'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}


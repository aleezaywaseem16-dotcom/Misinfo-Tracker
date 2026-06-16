'use client'
import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function AuthCallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')
    const errorParam = searchParams.get('error')
    const errorDesc = searchParams.get('error_description')

    if (errorParam) {
      router.replace(`/login?error=${encodeURIComponent(errorDesc ?? errorParam)}`)
      return
    }

    if (!code) {
      router.replace('/login')
      return
    }

    supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
      if (error || !data.session) {
        router.replace(`/login?error=${encodeURIComponent(error?.message ?? 'Authentication failed. Please try again.')}`)
      } else {
        router.replace('/dashboard')
      }
    })
  }, [router, searchParams])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#07080a' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: '36px', height: '36px',
          border: '2px solid rgba(190,242,100,0.15)',
          borderTopColor: '#bef264',
          borderRadius: '50%',
          animation: 'cb-spin 0.8s linear infinite',
        }} />
        <p style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: '0.7rem', letterSpacing: '0.14em',
          color: 'rgba(255,255,255,0.35)', margin: 0,
        }}>AUTHENTICATING...</p>
      </div>
      <style>{`@keyframes cb-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function AuthCallback() {
  return (
    <Suspense>
      <AuthCallbackInner />
    </Suspense>
  )
}

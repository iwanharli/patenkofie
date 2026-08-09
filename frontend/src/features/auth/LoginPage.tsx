import { Coffee, Lock, User } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/useAuth'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoading, login, user } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const redirectTo = getRedirectPath(location.state)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    try {
      await login(username, password)
      navigate(redirectTo, { replace: true })
    } catch (error) {
      setErrorMessage(error instanceof Error && error.message === 'LOGIN_FAILED'
        ? 'Username atau password salah.'
        : 'Tidak bisa terhubung ke server.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isLoading && user) {
    return <Navigate replace to="/" />
  }

  return (
    <main className="grid min-h-svh bg-background px-4 py-6 sm:px-6 lg:grid-cols-[1fr_28rem] lg:p-0">
      <section className="hidden relative lg:block">
        <img
          alt="Coffee Roastery Background"
          className="absolute inset-0 h-full w-full object-cover"
          src="/login-bg.png"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/80" />
        
        <div className="absolute inset-0 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground">
              <Coffee aria-hidden="true" className="size-5" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-wide">Patenote</p>
              <p className="text-xs font-medium text-white/70">Admin Operasional</p>
            </div>
          </div>

          <div className="max-w-xl">
            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-primary">Akses Internal</p>
            <h1 className="text-4xl font-semibold leading-tight tracking-normal text-white">
              Sistem manajemen<br />operasional dan finansial.
            </h1>
            <p className="mt-4 text-lg text-white/80">
              Kelola transaksi, pantau stok, dan cetak laporan roastery dengan mudah dan efisien.
            </p>
          </div>
        </div>
      </section>

      <section className="grid place-items-center">
        <div className="w-full max-w-sm">
          <Card className="border-0 shadow-none lg:border lg:shadow-sm">
            <CardHeader className="text-center lg:text-left">
              <div className="mx-auto mb-4 grid size-12 place-items-center rounded-md bg-primary text-primary-foreground lg:hidden">
                <Coffee aria-hidden="true" className="size-6" />
              </div>
              <CardTitle className="text-2xl">Masuk ke Patenote</CardTitle>
              <CardDescription className="text-base">Gunakan akun owner atau staf kasir.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      autoComplete="username"
                      className="pl-9"
                      id="username"
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="Masukkan username"
                      value={username}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      autoComplete="current-password"
                      className="pl-9"
                      id="password"
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Masukkan password"
                      type="password"
                      value={password}
                    />
                  </div>
                </div>
                {errorMessage && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {errorMessage || 'Username atau password salah.'}
                  </div>
                )}
                <Button className="w-full" disabled={isLoading || isSubmitting} type="submit">
                  {isSubmitting ? 'Memeriksa...' : 'Masuk'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}

function getRedirectPath(state: unknown) {
  if (!state || typeof state !== 'object' || !('from' in state)) {
    return '/'
  }

  const from = state.from
  if (!from || typeof from !== 'object' || !('pathname' in from)) {
    return '/'
  }

  const pathname = typeof from.pathname === 'string' ? from.pathname : '/'
  const search = 'search' in from && typeof from.search === 'string' ? from.search : ''

  return `${pathname}${search}`
}

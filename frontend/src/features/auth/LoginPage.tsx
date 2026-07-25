import { ArrowLeft, Coffee, Lock, User } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'

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
      <section className="hidden border-r border-border bg-card px-10 py-8 lg:flex lg:flex-col">
        <Link className="flex items-center gap-3 text-foreground" to="/">
          <div className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground">
            <Coffee aria-hidden="true" className="size-5" />
          </div>
          <div>
            <p className="text-base font-semibold leading-5">PatenAndum</p>
            <p className="text-xs text-muted-foreground">Admin operasional</p>
          </div>
        </Link>

        <div className="mt-auto max-w-xl">
          <p className="text-sm font-medium text-muted-foreground">Akses internal</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal">Kelola transaksi kopi harian.</h1>
          <div className="mt-8 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-2xl font-semibold">18</p>
              <p className="mt-1 text-xs text-muted-foreground">Order</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-2xl font-semibold">182 kg</p>
              <p className="mt-1 text-xs text-muted-foreground">Kopi</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-2xl font-semibold">Tunai</p>
              <p className="mt-1 text-xs text-muted-foreground">MVP</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid place-items-center">
        <div className="w-full max-w-sm">
          <Button asChild className="mb-6" variant="ghost">
            <Link to="/">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Dashboard
            </Link>
          </Button>
          <Card>
            <CardHeader>
              <div className="mb-3 grid size-11 place-items-center rounded-md bg-primary text-primary-foreground lg:hidden">
                <Coffee aria-hidden="true" className="size-5" />
              </div>
              <CardTitle>Masuk ke PatenAndum</CardTitle>
              <CardDescription>Gunakan akun owner atau petugas.</CardDescription>
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

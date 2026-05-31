'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowRight, Brain, CheckCircle2, Loader2 } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await api.forgotPassword(email.trim())
      setSuccess(response.detail || 'If that email exists, a reset link has been sent.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left Pane - Graphic & Brand */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-primary flex-col justify-between p-12 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl mix-blend-overlay"></div>
          <div className="absolute bottom-20 left-20 w-80 h-80 bg-black/20 rounded-full blur-3xl mix-blend-overlay"></div>
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md border border-white/30 text-white">
            <Brain className="h-5 w-5" />
          </div>
          <span className="text-2xl font-display font-semibold tracking-tight text-white">
            OKM
          </span>
        </div>

        <div className="relative z-10 space-y-4 max-w-lg">
          <h1 className="text-4xl md:text-5xl font-display font-medium text-white leading-tight">
            Regain access to your workspace.
          </h1>
          <p className="text-primary-foreground/80 text-lg font-sans">
            It happens to the best of us. Let's get you back into your account securely.
          </p>
        </div>

        <div className="relative z-10 text-primary-foreground/60 text-sm">
          &copy; {new Date().getFullYear()} OKM Inc. All rights reserved.
        </div>
      </div>

      {/* Right Pane - Form */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:px-24">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="mx-auto w-full max-w-sm space-y-8"
        >
          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-3xl font-display font-semibold tracking-tight text-foreground">
              Reset Password
            </h2>
            <p className="text-muted-foreground">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  className="h-11 transition-all focus-visible:ring-primary/30"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={loading || !!success}
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg"
              >
                {error}
              </motion.div>
            )}

            {success && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {success}
              </motion.div>
            )}

            {!success && (
              <Button 
                className="w-full h-11 text-base font-medium group" 
                type="submit" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending link...
                  </>
                ) : (
                  <>
                    Send reset link
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            )}
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Remember your password?{' '}
            <Link href="/login" className="font-medium text-primary hover:text-primary/80 transition-colors">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}

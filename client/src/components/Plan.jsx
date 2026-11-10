import React, { useState, Component } from 'react'
import { Check, Sparkles, Gem, ArrowRight, Settings, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useClerk, useUser, PricingTable } from '@clerk/react'
import { useSubscriptionPlan } from '../hooks/useSubscriptionPlan'

// Defensive Error Boundary for Clerk components
class ClerkBillingErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error) {
    console.warn('[ClerkBillingErrorBoundary] Handled render error:', error?.message);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className='p-6 text-center bg-purple-50/50 rounded-2xl border border-purple-200 text-slate-700 max-w-xl mx-auto'>
          <p className='font-medium text-sm text-purple-900'>Clerk Pricing Table View</p>
          <p className='text-xs text-gray-500 mt-1 mb-4'>
            Use the interactive plan cards above to start subscription checkout directly with Clerk.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className='px-4 py-2 text-xs font-medium rounded-lg bg-white border border-gray-300 text-slate-700 hover:bg-gray-50'
          >
            Retry Table View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const Plan = () => {
  const navigate = useNavigate()
  const { user } = useUser()
  const { openSignIn } = useClerk()
  const { isPremium, openCheckout, manageSubscription } = useSubscriptionPlan()

  // Billing cycle state: 'month' vs 'annual'
  const [billingCycle, setBillingCycle] = useState('month')
  const [showClerkTable, setShowClerkTable] = useState(false)

  const starterFeatures = [
    'AI Article Generator (10 free generations)',
    'SEO Blog Title Generator (10 free generations)',
    'Public Community Feed & Showcase',
    'Standard Generation Speed',
    'Community Likes & Interactions',
  ]

  const proFeatures = [
    'Everything in Starter',
    'Clipdrop Text-to-Image Generation (High-res)',
    'AI Background Removal (Cloudinary AI)',
    'AI Resume Review & Structured Evaluation',
    'Vector RAG Semantic Resume Chat',
    'Unlimited Article & Blog Title Generations',
    'Groq Llama 3.3 70B Versatile Model',
  ]

  const handleProAction = () => {
    if (!user) {
      openSignIn()
      return
    }
    if (isPremium) {
      manageSubscription()
      return
    }
    openCheckout({ planPeriod: billingCycle })
  }

  return (
    <div id='pricing' className='max-w-5xl mx-auto z-20 my-24 px-4 sm:px-6'>
      <div className='text-center'>
        <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 mb-3'>
          <Sparkles className='w-3.5 h-3.5' /> Flexible Plans & Clerk Billing
        </div>
        <h2 className='text-slate-700 text-3xl sm:text-[42px] font-semibold tracking-tight'>
          Choose Your Plan
        </h2>
        <p className='text-gray-500 max-w-lg mx-auto mt-3 text-sm sm:text-base'>
          Start for free and scale up with Nexora Pro for high-res AI image generation and extended limits.
        </p>

        {/* Monthly / Annual Toggle */}
        <div className='mt-8 inline-flex items-center p-1 bg-gray-100 rounded-xl border border-gray-200'>
          <button
            onClick={() => setBillingCycle('month')}
            className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition ${
              billingCycle === 'month'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-gray-500 hover:text-slate-800'
            }`}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition flex items-center gap-1.5 ${
              billingCycle === 'annual'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-gray-500 hover:text-slate-800'
            }`}
          >
            Annual Billing
            <span className='px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-green-100 text-green-700'>
              Save 17%
            </span>
          </button>
        </div>
      </div>

      {/* Plan Cards */}
      <div className='mt-10 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto'>
        {/* Starter Plan */}
        <div className='relative rounded-2xl p-8 bg-white border border-gray-200 shadow-sm transition-all duration-300 hover:shadow-xl flex flex-col justify-between'>
          <div>
            <div className='flex items-center justify-between'>
              <h3 className='text-xl font-bold text-slate-800'>Starter</h3>
              <div className='w-9 h-9 rounded-lg bg-blue-50 text-[#3C81F6] flex items-center justify-center'>
                <Sparkles className='w-5 h-5' />
              </div>
            </div>

            <p className='mt-2 text-sm text-gray-500 leading-relaxed'>
              Essential AI creation tools for personal projects and experimentation.
            </p>

            <div className='mt-6 flex items-baseline gap-1'>
              <span className='text-4xl font-extrabold text-slate-900'>$0</span>
              <span className='text-sm font-medium text-gray-500'>/forever</span>
            </div>

            <div className='mt-6 border-t border-gray-100 pt-6'>
              <p className='text-xs font-semibold uppercase tracking-wider text-gray-400'>What's included</p>
              <ul className='mt-4 space-y-3'>
                {starterFeatures.map((feature, fIndex) => (
                  <li key={fIndex} className='flex items-start gap-3 text-sm text-slate-600'>
                    <Check className='w-4 h-4 mt-0.5 shrink-0 text-green-600' />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <button
            onClick={() => (user ? navigate('/ai') : openSignIn())}
            disabled={!isPremium && Boolean(user)}
            className='mt-8 w-full py-3 px-4 rounded-xl text-sm font-medium transition cursor-pointer flex items-center justify-center gap-2 bg-slate-100 text-slate-800 hover:bg-slate-200 disabled:opacity-80 disabled:cursor-default'
          >
            {!user ? 'Get Started Free' : !isPremium ? 'Current Plan' : 'Go to Dashboard'}
          </button>
        </div>

        {/* Nexora Pro Plan */}
        <div className='relative rounded-2xl p-8 bg-white border border-[#9234EA] shadow-lg ring-1 ring-[#9234EA]/20 transition-all duration-300 hover:shadow-xl flex flex-col justify-between'>
          <span className='absolute -top-3.5 right-8 bg-gradient-to-r from-[#3C81F6] to-[#9234EA] text-white text-xs font-semibold px-3 py-1 rounded-full shadow-sm'>
            Popular
          </span>

          <div>
            <div className='flex items-center justify-between'>
              <h3 className='text-xl font-bold text-slate-800'>Nexora Pro</h3>
              <div className='w-9 h-9 rounded-lg bg-purple-50 text-[#9234EA] flex items-center justify-center'>
                <Gem className='w-5 h-5' />
              </div>
            </div>

            <p className='mt-2 text-sm text-gray-500 leading-relaxed'>
              Full creative suite with high-resolution image generation and extended quotas.
            </p>

            <div className='mt-6 flex items-baseline gap-1.5'>
              <span className='text-4xl font-extrabold text-slate-900'>
                {billingCycle === 'annual' ? '$15.83' : '$19'}
              </span>
              <span className='text-sm font-medium text-gray-500'>
                {billingCycle === 'annual' ? '/month ($189.96 billed yearly)' : '/month'}
              </span>
            </div>

            <div className='mt-6 border-t border-gray-100 pt-6'>
              <p className='text-xs font-semibold uppercase tracking-wider text-gray-400'>What's included</p>
              <ul className='mt-4 space-y-3'>
                {proFeatures.map((feature, fIndex) => (
                  <li key={fIndex} className='flex items-start gap-3 text-sm text-slate-600'>
                    <Check className='w-4 h-4 mt-0.5 shrink-0 text-[#9234EA]' />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className='mt-8 space-y-2'>
            <button
              onClick={handleProAction}
              disabled={isPremium}
              className='w-full py-3 px-4 rounded-xl text-sm font-medium transition cursor-pointer flex items-center justify-center gap-2 bg-gradient-to-r from-[#3C81F6] to-[#9234EA] text-white hover:opacity-95 shadow-md disabled:opacity-85 disabled:cursor-default'
            >
              {isPremium ? (
                <>
                  <Check className='w-4 h-4' /> Current Plan (Active)
                </>
              ) : !user ? (
                <>
                  Get Started with Pro <ArrowRight className='w-4 h-4' />
                </>
              ) : (
                <>
                  Upgrade to Nexora Pro <ArrowRight className='w-4 h-4' />
                </>
              )}
            </button>

            {isPremium && (
              <button
                onClick={manageSubscription}
                className='w-full py-2 px-3 text-xs font-medium text-purple-700 hover:text-purple-900 transition flex items-center justify-center gap-1.5'
              >
                <Settings className='w-3.5 h-3.5' /> Manage Subscription in Clerk
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Optional Clerk Standard Pricing Table View */}
      <div className='mt-12 text-center'>
        <button
          onClick={() => setShowClerkTable((prev) => !prev)}
          className='inline-flex items-center gap-2 text-xs text-gray-500 hover:text-slate-800 transition font-medium underline-offset-4 hover:underline'
        >
          {showClerkTable ? 'Hide Clerk Pricing Table' : 'Show Clerk Embedded Pricing Table'}
          <ExternalLink className='w-3 h-3' />
        </button>

        {showClerkTable && (
          <div className='mt-6 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm text-left max-w-4xl mx-auto'>
            <ClerkBillingErrorBoundary>
              <PricingTable for='user' newSubscriptionRedirectUrl='/ai' />
            </ClerkBillingErrorBoundary>
          </div>
        )}
      </div>
    </div>
  )
}

export default Plan

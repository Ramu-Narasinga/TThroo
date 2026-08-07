"use client"

import { useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Badge } from "@thinkthroo/ui/components/badge"
import { PricingFeatureList } from "@thinkthroo/ui/components/pricing-feature-list"
import { freeFeatures, proFeatures, pricing } from "@thinkthroo/ui/lib/pricing"
import { toast } from "sonner"
import { BuyLicenseButton } from "@/components/billing-page-client"
import { useOrganizationStore } from "@/store/organization"
import { organizationSelectors } from "@/store/organization/selectors"
import { useUserStore } from "@/store/user"
import { userSelectors } from "@/store/user/selectors"

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function BillingPageContent() {
  const searchParams = useSearchParams()

  const activeOrgId = useOrganizationStore(organizationSelectors.activeOrgId)
  const currentPlan = useOrganizationStore(organizationSelectors.currentPlanName)
  const planExpiresAt = useOrganizationStore(organizationSelectors.planExpiresAt)
  const fetchOrganizations = useOrganizationStore((s) => s.fetchOrganizations)
  const userEmail = useUserStore(userSelectors.email)

  const isPro = currentPlan === 'pro'

  useEffect(() => {
    const success = searchParams.get("success") === "true"
    const type = searchParams.get("type")
    const failed = searchParams.get("status") === "failed"

    if (!success && !failed) return

    if (failed) {
      toast.error("Payment failed. Please try again or use a different payment method.")
    } else if (type === 'license') {
      toast.success("Payment successful — you're now on Pro!")
      fetchOrganizations()
      const rdt = (window as unknown as { rdt?: (a: string, e: string) => void }).rdt
      if (rdt) rdt("track", "Purchase")
    }

    window.history.replaceState({}, "", "/account/billing")
  }, [searchParams, fetchOrganizations])

  return (
    <div className="max-w-3xl space-y-10">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="text-muted-foreground">
          One annual license fee covers the platform — updates, bug fixes, and support included. Your Claude API costs go directly to Anthropic.
        </p>
      </div>

      {/* Plan status banner */}
      {isPro ? (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 px-4 py-3 flex items-center gap-3">
          <Badge className="bg-[#7000FF] text-white">Pro</Badge>
          <span className="text-sm text-green-800 dark:text-green-300">
            Active{planExpiresAt ? ` · Renews on ${formatDate(planExpiresAt)}` : ''}
          </span>
        </div>
      ) : (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 px-4 py-3 flex items-center gap-3">
          <Badge variant="outline">Free Trial</Badge>
          <span className="text-sm text-blue-800 dark:text-blue-300">
            Upgrade to Pro for year-long access — $49 one-time.
          </span>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Free */}
        <div className="rounded-xl border border-border p-6 flex flex-col gap-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-lg">Free Trial</span>
              {!isPro && (
                <Badge variant="outline" className="text-xs">Current plan</Badge>
              )}
            </div>
            <p className="text-3xl font-bold">
              {pricing.free.amount}
              <span className="text-base font-normal text-muted-foreground"> {pricing.free.label}</span>
            </p>
          </div>
          <PricingFeatureList features={freeFeatures} />
        </div>

        {/* Pro */}
        <div className="rounded-xl border-2 border-[#7000FF] p-6 flex flex-col gap-5 relative">
          <div className="absolute -top-3 left-6">
            <Badge className="bg-[#7000FF] text-white text-xs">Most popular</Badge>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-lg">Pro</span>
              {isPro && (
                <Badge variant="outline" className="text-xs">Current plan</Badge>
              )}
            </div>
            <p className="text-3xl font-bold">
              {pricing.pro.amount}
              <span className="text-base font-normal text-muted-foreground"> {pricing.pro.label}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">One-time payment · Annual license</p>
          </div>

          {isPro ? (
            <div className="w-full rounded-md border border-border bg-muted px-4 py-2 text-center text-sm text-muted-foreground">
              {planExpiresAt ? `Active until ${formatDate(planExpiresAt)}` : 'Active'}
            </div>
          ) : (
            <BuyLicenseButton
              orgId={activeOrgId ?? ''}
              email={userEmail ?? ''}
              disabled={!activeOrgId || !userEmail}
            />
          )}

          <PricingFeatureList features={proFeatures} iconColor="text-[#7000FF]" />
        </div>
      </div>

      {/* AI cost callout */}
      <p className="text-sm text-muted-foreground">
        You pay Anthropic directly for Claude API usage. Think Throo never touches your AI costs.
      </p>
    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingPageContent />
    </Suspense>
  )
}

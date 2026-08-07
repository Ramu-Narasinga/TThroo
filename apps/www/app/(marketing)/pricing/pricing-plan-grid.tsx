"use client"

import Link from "next/link"
import { Badge } from "@thinkthroo/ui/components/badge"
import { Button } from "@thinkthroo/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@thinkthroo/ui/components/card"
import { PricingFeatureList } from "@thinkthroo/ui/components/pricing-feature-list"
import { freeFeatures, proFeatures, pricing } from "@thinkthroo/ui/lib/pricing"
import { siteConfig } from "@/lib/config"

function rdtTrack(event: string) {
  if (
    typeof window !== "undefined" &&
    (window as unknown as { rdt?: (a: string, e: string) => void }).rdt
  ) {
    (window as unknown as { rdt: (a: string, e: string) => void }).rdt(
      "track",
      event
    )
  }
}

export function PricingPlanGrid() {
  return (
    <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
      {/* Free Trial */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle>Free Trial</CardTitle>
          <CardDescription>Try everything, no card needed</CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
          <p className="text-3xl font-bold">
            {pricing.free.amount}{" "}
            <span className="text-base font-normal text-muted-foreground">{pricing.free.label}</span>
          </p>
          <div className="mt-6">
            <PricingFeatureList features={freeFeatures} />
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full" variant="outline" asChild>
            <Link href={siteConfig.links.appLogin}>
              Start free trial
            </Link>
          </Button>
        </CardFooter>
      </Card>

      {/* Pro */}
      <Card className="relative border-primary flex flex-col">
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</Badge>
        <CardHeader>
          <CardTitle>Pro</CardTitle>
          <CardDescription>One-time annual license — all updates included</CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
          <p className="text-3xl font-bold">
            {pricing.pro.amount}
            <span className="text-base font-normal text-muted-foreground"> {pricing.pro.label}</span>
          </p>
          <div className="mt-6">
            <PricingFeatureList features={proFeatures} iconColor="text-primary" />
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full" asChild onClick={() => rdtTrack("Lead")}>
            <Link href={`${siteConfig.links.appLogin}?next=/account/billing`}>
              Get Pro
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

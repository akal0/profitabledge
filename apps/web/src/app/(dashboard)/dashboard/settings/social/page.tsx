"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { trpcOptions } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Shield,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { isPublicAlphaFeatureEnabled } from "@/lib/alpha-flags";
import { AlphaFeatureLocked } from "@/features/platform/alpha/components/alpha-feature-locked";

export default function SocialSettingsPage() {
  const communityEnabled = isPublicAlphaFeatureEnabled("community");

  const { selectedAccountId } = useAccountStore();

  const { data: accounts, refetch: refetchAccounts } = useQuery({
    ...trpcOptions.accounts.list.queryOptions(),
    enabled: communityEnabled,
  });
  const currentAccount = accounts?.find(
    (acc) => acc.id === selectedAccountId
  );

  const toggleSocial = useMutation(
    trpcOptions.social.toggleAccountSocial.mutationOptions()
  );

  if (!communityEnabled) {
    return (
      <AlphaFeatureLocked
        feature="community"
        title="Social settings are held back in this alpha"
      />
    );
  }

  const handleToggleSocial = async (optIn: boolean) => {
    if (!selectedAccountId) {
      toast.error("Please select an account");
      return;
    }

    try {
      await toggleSocial.mutateAsync({
        accountId: selectedAccountId,
        optIn,
      });

      await refetchAccounts();

      if (optIn) {
        toast.success("Account is now public");
      } else {
        toast.success("Account is now private");
      }
    } catch (error: any) {
      if (error.message?.includes("Only verified accounts")) {
        toast.error(
          "Only verified accounts can be made public. Connect your EA to verify this account."
        );
      } else {
        toast.error(error.message || "Failed to update settings");
      }
    }
  };

  const getVerificationBadge = (level: string | null | undefined) => {
    switch (level) {
      case "prop_verified":
        return (
          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
            <Shield className="h-3 w-3 mr-1" />
            Prop Verified
          </Badge>
        );
      case "api_verified":
        return (
          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
            <Shield className="h-3 w-3 mr-1" />
            API Verified
          </Badge>
        );
      case "ea_synced":
        return (
          <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            EA Synced
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-gray-500/20 text-gray-400">
            <AlertCircle className="h-3 w-3 mr-1" />
            Unverified
          </Badge>
        );
    }
  };

  const isVerified =
    currentAccount?.verificationLevel &&
    currentAccount.verificationLevel !== "unverified";
  const isSocialEnabled = currentAccount?.socialOptIn || false;

  return (
    <div className="flex flex-col w-full">
      {/* Account Status */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Account Status
          </Label>
          <p className="text-xs text-white/40 mt-0.5">
            Current account verification level.
          </p>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-white">
              {currentAccount?.name || "No Account Selected"}
            </span>
            {currentAccount && getVerificationBadge(currentAccount.verificationLevel)}
          </div>
          <p className="text-xs text-white/40">
            {currentAccount?.broker || "Select an account to configure social settings"}
          </p>
          {currentAccount?.followerCount && currentAccount.followerCount > 0 && (
            <div className="flex items-center gap-4 text-xs text-white/40">
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                <span>{currentAccount.followerCount} followers</span>
              </div>
              {currentAccount.feedEventCount && currentAccount.feedEventCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>{currentAccount.feedEventCount} feed events</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Verification Warning */}
      {!isVerified && currentAccount && (
        <>
          <div className="px-6 sm:px-8 py-5">
            <div className="flex gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
              <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-300 mb-1">
                  Verification Required
                </p>
                <p className="text-xs text-white/50">
                  Only verified accounts can appear in social feeds and leaderboards.
                  Connect your EA to verify this account.
                </p>
              </div>
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Make Account Public */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Make Account Public
          </Label>
          <p className="text-xs text-white/40 mt-0.5">
            Show trades in feeds and leaderboards.
          </p>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3 flex-1">
            <p className="text-xs text-white/50">
              When enabled, your verified trades will appear in public feeds and
              leaderboards. Your execution metrics will be visible to other traders.
            </p>
            <div className="space-y-2 text-xs text-white/50">
              <div className="flex gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Auto-generated feed events from closed trades</span>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Appear in quality-based leaderboards</span>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Other traders can follow your account</span>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Full execution transparency (no cherry-picking possible)</span>
              </div>
            </div>
          </div>
          <Switch
            checked={isSocialEnabled}
            onCheckedChange={handleToggleSocial}
            disabled={!isVerified || toggleSocial.isPending}
            className="data-[state=checked]:bg-teal-600"
          />
        </div>
      </div>

      <Separator />

      {/* What Gets Shared */}
      <div className="px-6 sm:px-8 py-5">
        <h2 className="text-sm font-semibold text-white">What Gets Shared</h2>
        <p className="text-xs text-white/40 mt-0.5">
          All data is auto-generated from your trades.
        </p>
      </div>

      <Separator />

      {/* Feed Events */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Feed Events
          </Label>
          <p className="text-xs text-white/40 mt-0.5">
            Auto-generated from closed trades.
          </p>
        </div>
        <ul className="space-y-1.5 text-xs text-white/50">
          <li>Trade Closed (with RR capture, exit efficiency)</li>
          <li>Execution Insights (missed RR opportunities)</li>
          <li>Discipline Breaks (protocol violations)</li>
          <li>Streak Milestones (5+ win/loss streaks)</li>
        </ul>
      </div>

      <Separator />

      {/* Leaderboard Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Leaderboard Metrics
          </Label>
          <p className="text-xs text-white/40 mt-0.5">
            Quality-based ranking data.
          </p>
        </div>
        <ul className="space-y-1.5 text-xs text-white/50">
          <li>Consistency (median R, drawdown, variance)</li>
          <li>Execution (RR capture, manipulation efficiency)</li>
          <li>Discipline (protocol rate, revenge rate)</li>
          <li>Risk (max drawdown, SL adherence)</li>
        </ul>
      </div>

      <Separator />

      {/* Privacy Note */}
      <div className="px-6 sm:px-8 py-5">
        <div className="flex gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-md">
          <Shield className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-300 mb-1">
              Truth Over Theater
            </p>
            <p className="text-xs text-white/50">
              Feed events are auto-generated from your closed trades. You cannot
              manually post, cherry-pick trades, or hide losses. This system rewards
              honest execution and consistent discipline.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

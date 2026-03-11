"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/utils/trpc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MapPin,
  Globe,
  Twitter,
  Calendar,
  Users,
  Eye,
  Award,
  CheckCircle2,
  Crown,
  Star,
} from "lucide-react";
import { format } from "date-fns";

export default function PublicProfilePage() {
  const params = useParams();
  const username = params.username as string;

  const { data: profile, isLoading } = trpc.social.getPublicProfile.useQuery({
    username,
  });

  const { data: sharedTrades } = trpc.social.listMySharedTrades.useQuery(
    undefined,
    {
      enabled: !!profile?.id,
    }
  );

  const { data: followers } = trpc.social.getFollowers.useQuery(
    { userId: profile?.id || "" },
    { enabled: !!profile?.id }
  );

  const { data: following } = trpc.social.getFollowing.useQuery(
    { userId: profile?.id || "" },
    { enabled: !!profile?.id }
  );

  const followMutation = trpc.social.followUser.useMutation();
  const unfollowMutation = trpc.social.unfollowUser.useMutation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Profile not found</h1>
          <p className="text-gray-500">
            This user either doesn&apos;t exist or has a private profile.
          </p>
        </div>
      </div>
    );
  }

  const getBadgeIcon = () => {
    switch (profile.verificationBadgeType) {
      case "premium":
        return <Crown className="h-4 w-4" />;
      case "funded":
        return <Award className="h-4 w-4" />;
      case "mentor":
        return <Star className="h-4 w-4" />;
      default:
        return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Banner */}
      <div
        className="h-48 bg-gradient-to-r from-blue-500 to-purple-600"
        style={
          profile.profileBannerUrl
            ? {
                backgroundImage: `url(${profile.profileBannerUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Profile Header */}
        <div className="relative -mt-20 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            {/* Avatar */}
            <Avatar className="h-32 w-32 border-4 border-white dark:border-gray-900 shadow-xl">
              <AvatarImage src={profile.image || undefined} />
              <AvatarFallback className="text-3xl">
                {profile.name?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {/* Name and Stats */}
            <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mt-12 sm:mt-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold">{profile.name}</h1>
                    {profile.isVerified && (
                      <Badge
                        variant="default"
                        className="flex items-center gap-1"
                      >
                        {getBadgeIcon()}
                        Verified
                      </Badge>
                    )}
                    {profile.isPremium && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Crown className="h-3 w-3" />
                        Premium
                      </Badge>
                    )}
                  </div>
                  <p className="text-gray-500 dark:text-gray-400">
                    @{profile.username}
                  </p>
                  {profile.bio && (
                    <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                      {profile.bio}
                    </p>
                  )}
                </div>

                {/* Follow Button */}
                <div>
                  <Button
                    onClick={() => {
                      // TODO: Implement follow/unfollow
                      followMutation.mutate({ userId: profile.id });
                    }}
                  >
                    Follow
                  </Button>
                </div>
              </div>

              {/* Profile Info */}
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                {profile.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {profile.location}
                  </div>
                )}
                {profile.website && (
                  <div className="flex items-center gap-1">
                    <Globe className="h-4 w-4" />
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline text-blue-600 dark:text-blue-400"
                    >
                      {profile.website.replace(/^https?:\/\//, "")}
                    </a>
                  </div>
                )}
                {profile.twitter && (
                  <div className="flex items-center gap-1">
                    <Twitter className="h-4 w-4" />
                    <a
                      href={`https://twitter.com/${profile.twitter}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline text-blue-600 dark:text-blue-400"
                    >
                      @{profile.twitter}
                    </a>
                  </div>
                )}
                {profile.tradingSince && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Trading since {format(new Date(profile.tradingSince), "MMM yyyy")}
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-6">
                <div className="flex items-center gap-1 text-sm">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="font-semibold">{profile.followerCount}</span>
                  <span className="text-gray-500">followers</span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="font-semibold">{profile.followingCount}</span>
                  <span className="text-gray-500">following</span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <Eye className="h-4 w-4 text-gray-500" />
                  <span className="font-semibold">{profile.profileViews}</span>
                  <span className="text-gray-500">profile views</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="trades" className="mb-12">
          <TabsList className="bg-white dark:bg-gray-800 border-b">
            <TabsTrigger value="trades">Shared Trades</TabsTrigger>
            <TabsTrigger value="ideas">Trade Ideas</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
          </TabsList>

          <TabsContent value="trades" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sharedTrades?.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500">
                  No shared trades yet
                </div>
              )}
              {sharedTrades?.map((trade) => (
                <div
                  key={trade.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow"
                >
                  <h3 className="font-semibold mb-2">
                    {trade.title || "Untitled Trade"}
                  </h3>
                  <p className="text-sm text-gray-500 line-clamp-2">
                    {trade.description}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      {trade.viewCount} views
                    </span>
                    <span className="text-gray-500">
                      {trade.likeCount} likes
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="ideas" className="mt-6">
            <div className="text-center py-12 text-gray-500">
              Trade ideas coming soon
            </div>
          </TabsContent>

          <TabsContent value="achievements" className="mt-6">
            <div className="text-center py-12 text-gray-500">
              Achievements coming soon
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

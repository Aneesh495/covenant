import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ArrowLeft, User, Camera, Upload } from "lucide-react";
import { Link } from "wouter";

export default function ProfileSettings() {
  const { toast } = useToast();
  const [profileImage, setProfileImage] = useState<string>("");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["/api/profile"],
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/profile", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    updateProfileMutation.mutate({
      name: formData.get("name"),
      email: formData.get("email"),
      bio: formData.get("bio"),
      profileImageUrl: profileImage || formData.get("profileImageUrl"),
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setProfileImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900">
      {/* Header */}
      <div className="border-b bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Profile Settings
              </h1>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="shadow-lg border-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold">Your Profile</CardTitle>
              <CardDescription>
                Manage your personal information and preferences. No account required - your data is stored locally in your browser session.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Profile Picture */}
                <div className="flex flex-col items-center space-y-4">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={profileImage || profile?.profileImageUrl} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white text-2xl">
                      <User className="h-8 w-8" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="profile-image" className="cursor-pointer">
                      <div className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                        <Camera className="h-4 w-4" />
                        <span>Change Photo</span>
                      </div>
                    </Label>
                    <Input
                      id="profile-image"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </div>
                </div>

                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={profile?.name || ""}
                    placeholder="Enter your full name"
                    className="bg-white/50 dark:bg-gray-700/50"
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={profile?.email || ""}
                    placeholder="Enter your email address"
                    className="bg-white/50 dark:bg-gray-700/50"
                  />
                </div>

                {/* Bio */}
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    name="bio"
                    defaultValue={profile?.bio || ""}
                    placeholder="Tell us about yourself..."
                    rows={4}
                    className="bg-white/50 dark:bg-gray-700/50"
                  />
                </div>

                {/* Profile Image URL (alternative to upload) */}
                <div className="space-y-2">
                  <Label htmlFor="profileImageUrl">Profile Image URL (optional)</Label>
                  <Input
                    id="profileImageUrl"
                    name="profileImageUrl"
                    type="url"
                    defaultValue={profile?.profileImageUrl || ""}
                    placeholder="https://example.com/your-image.jpg"
                    className="bg-white/50 dark:bg-gray-700/50"
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    You can either upload an image above or provide a URL here.
                  </p>
                </div>

                {/* Theme Settings */}
                <div className="space-y-2">
                  <Label>Theme Preference</Label>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <span className="text-sm">Choose your preferred theme</span>
                    <ThemeToggle />
                  </div>
                </div>

                {/* Submit Button */}
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 text-lg shadow-lg"
                  disabled={updateProfileMutation.isPending}
                >
                  {updateProfileMutation.isPending ? (
                    <div className="flex items-center">
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                      Saving...
                    </div>
                  ) : (
                    "Save Profile"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Privacy Notice */}
          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Privacy Notice</h3>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Your profile information is stored securely and linked to your browser session. 
              We don't require account creation - your data remains private and under your control.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
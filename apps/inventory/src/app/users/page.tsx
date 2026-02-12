"use client";

import { useEffect, useState } from "react";
import { Navigation } from "@/components/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { Plus, Edit, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const user = localStorage.getItem("user");
      if (user) {
        setCurrentUser(JSON.parse(user));
      }
    }
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await apiClient.getUsers();
      setUsers(data);
    } catch (error) {
      console.error("Failed to load users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-purple-100 text-purple-700";
      case "MANAGER":
        return "bg-blue-100 text-blue-700";
      case "CASHIER":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage your team members
            </p>
          </div>
          {currentUser?.role === "ADMIN" && (
            <Button className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800">
              <Plus className="h-4 w-4" />
              Add User
            </Button>
          )}
        </div>

        <Card className="mb-6 border-gray-200">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-600">Loading users...</div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <Card className="border-gray-200">
            <CardContent className="text-center py-12">
              <div className="text-gray-600">No users found</div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUsers.map((user) => (
              <Card
                key={user.id}
                className="border-gray-200 hover:shadow-md transition-shadow"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg text-gray-900">
                        {user.name}
                      </CardTitle>
                      <p className="text-sm text-gray-600 mt-1">{user.email}</p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded font-medium ${getRoleBadgeColor(user.role)}`}
                    >
                      {user.role}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Status:</span>
                      <span
                        className={`font-medium ${
                          user.isActive ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {user.phone && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Phone:</span>
                        <span className="font-medium">{user.phone}</span>
                      </div>
                    )}
                    {user.lastLoginAt && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Last Login:</span>
                        <span className="font-medium">
                          {new Date(user.lastLoginAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {currentUser?.role === "ADMIN" && (
                      <div className="flex gap-2 mt-4 pt-4 border-t">
                        <Button variant="outline" size="sm" className="flex-1">
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

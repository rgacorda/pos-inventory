"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { Plus, Edit, Trash2, Search, Users as UsersIcon } from "lucide-react";
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

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                View and manage all users in your organization
              </CardDescription>
            </div>
            {currentUser?.role === "ADMIN" && (
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            )}
          </div>
          <div className="flex items-center gap-4 pt-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading users...</div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <UsersIcon className="h-12 w-12 text-muted-foreground mb-4" />
              <div className="text-muted-foreground">No users found</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  {currentUser?.role === "ADMIN" && (
                    <TableHead className="text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.role === "ADMIN"
                            ? "default"
                            : user.role === "MANAGER"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.phone || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={user.isActive ? "default" : "destructive"}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleDateString()
                        : "Never"}
                    </TableCell>
                    {currentUser?.role === "ADMIN" && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

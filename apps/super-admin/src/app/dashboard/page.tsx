export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          System-wide overview and statistics
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between space-x-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Total Organizations
            </h3>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Across all subscriptions
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between space-x-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Active Organizations
            </h3>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Currently operational
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between space-x-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Total Users
            </h3>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              System administrators
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between space-x-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Monthly Revenue
            </h3>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold">$0.00</div>
            <p className="text-xs text-muted-foreground">Total subscriptions</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card">
          <div className="border-b p-6">
            <h3 className="text-lg font-semibold">Recent Organizations</h3>
          </div>
          <div className="p-6">
            <p className="text-sm text-muted-foreground">
              No organizations found. Create your first organization to get
              started.
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="border-b p-6">
            <h3 className="text-lg font-semibold">System Activity</h3>
          </div>
          <div className="p-6">
            <p className="text-sm text-muted-foreground">
              Activity logs will appear here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import * as React from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/auth";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Results from "@/pages/results";
import History from "@/pages/history";
import Stats from "@/pages/stats";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Candidates from "@/pages/candidates";
import JobDescriptions from "@/pages/job-descriptions";
import BulkJobs from "@/pages/bulk-jobs";
import UsersPage from "@/pages/users";
import AuditLogPage from "@/pages/audit-log";
import TalentSearch from "@/pages/talent-search";
import Analytics from "@/pages/analytics";
import AgentPage from "@/pages/agent";
import RagPage from "@/pages/rag";
import IntegrationsPage from "@/pages/integrations";
import TicketsPage from "@/pages/tickets";
import TicketDetailPage from "@/pages/ticket-detail";
import TicketsWorkloadPage from "@/pages/tickets-workload";
import InterviewsPage from "@/pages/interviews";
import DepartmentsPage from "@/pages/departments";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, roles }: { component: React.ComponentType; roles?: string[] }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (!user) {
    setLocation("/login");
    return null;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <p>You don't have permission to view this page.</p>
      </div>
    );
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/" component={Login} />
      <Route path="/results/:id">
        {() => <ProtectedRoute component={Results} roles={["super_admin", "hr_admin", "recruiter", "hiring_manager"]} />}
      </Route>
      <Route path="/analyzer">
        {() => <ProtectedRoute component={Home} roles={["super_admin", "hr_admin", "recruiter", "hiring_manager"]} />}
      </Route>
      <Route path="/history">
        {() => <ProtectedRoute component={History} roles={["super_admin", "hr_admin", "recruiter", "hiring_manager"]} />}
      </Route>
      <Route path="/stats">
        {() => <ProtectedRoute component={Stats} roles={["super_admin", "hr_admin", "recruiter", "hiring_manager"]} />}
      </Route>
      <Route path="/candidates">
        {() => <ProtectedRoute component={Candidates} />}
      </Route>
      <Route path="/jobs">
        {() => <ProtectedRoute component={JobDescriptions} roles={["super_admin", "hr_admin", "hiring_manager"]} />}
      </Route>
      <Route path="/bulk-jobs">
        {() => <ProtectedRoute component={BulkJobs} roles={["super_admin", "hr_admin", "recruiter"]} />}
      </Route>
      <Route path="/users">
        {() => <ProtectedRoute component={UsersPage} roles={["super_admin", "hr_admin"]} />}
      </Route>
      <Route path="/audit-log">
        {() => <ProtectedRoute component={AuditLogPage} roles={["super_admin", "hr_admin"]} />}
      </Route>
      <Route path="/talent-search">
        {() => <ProtectedRoute component={TalentSearch} roles={["super_admin", "hr_admin", "recruiter", "hiring_manager"]} />}
      </Route>
      <Route path="/analytics">
        {() => <ProtectedRoute component={Analytics} roles={["super_admin", "hr_admin", "hiring_manager"]} />}
      </Route>
      <Route path="/agent">
        {() => <ProtectedRoute component={AgentPage} roles={["super_admin", "hr_admin"]} />}
      </Route>
      <Route path="/rag">
        {() => <ProtectedRoute component={RagPage} roles={["super_admin", "hr_admin", "recruiter", "hiring_manager"]} />}
      </Route>
      <Route path="/integrations">
        {() => <ProtectedRoute component={IntegrationsPage} roles={["super_admin", "hr_admin"]} />}
      </Route>
      <Route path="/tickets/workload">
        {() => <ProtectedRoute component={TicketsWorkloadPage} roles={["super_admin", "hr_admin", "recruiter", "hiring_manager"]} />}
      </Route>
      <Route path="/tickets/:id">
        {() => <ProtectedRoute component={TicketDetailPage} roles={["super_admin", "hr_admin", "recruiter", "hiring_manager"]} />}
      </Route>
      <Route path="/tickets">
        {() => <ProtectedRoute component={TicketsPage} roles={["super_admin", "hr_admin", "recruiter", "hiring_manager"]} />}
      </Route>
      <Route path="/interviews">
        {() => <ProtectedRoute component={InterviewsPage} roles={["super_admin", "hr_admin", "recruiter", "hiring_manager"]} />}
      </Route>
      <Route path="/departments">
        {() => <ProtectedRoute component={DepartmentsPage} roles={["super_admin", "hr_admin"]} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

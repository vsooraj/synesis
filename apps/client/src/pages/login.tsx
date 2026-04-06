import * as React from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, LayoutDashboard, ShieldCheck, Zap, Users } from "lucide-react";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "admin@example.com", password: "admin123" } });

  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    try {
      await login(data.email, data.password);
      setLocation("/analyzer");
    } catch (err) {
      toast({ variant: "destructive", title: "Login failed", description: err instanceof Error ? err.message : "Invalid credentials" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-background">
      {/* Left Column: Brand Details */}
      <div className="hidden md:flex md:w-1/2 lg:w-[55%] bg-slate-900 text-white p-12 lg:p-20 flex-col justify-between relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 rounded-full bg-primary/30 blur-[100px]" />
        <div className="absolute bottom-0 left-0 -ml-32 -mb-32 w-[30rem] h-[30rem] rounded-full bg-sky-500/20 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -ml-40 -mt-40 w-80 h-80 rounded-full bg-primary/5 blur-[120px]" />

        <div className="relative z-10">
          <div className="flex items-start mb-16 animate-in fade-in slide-in-from-left-4 duration-700">
            <img src="/logo.png" alt="Synesis Logo" className="h-28 w-auto object-contain drop-shadow-[0_0_16px_rgba(20,184,166,0.5)]" />
          </div>

          <div className="max-w-xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 fill-mode-both">
            <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-6 tracking-tight">
              The Enterprise Standard for Talent Intelligence
            </h1>
            <p className="text-slate-400 text-lg mb-14 leading-relaxed">
              Empower your hiring teams with AI-driven resume parsing, automated SLA tracking, and zero-bias candidate matching.
            </p>

            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 shadow-sm shrink-0">
                  <ShieldCheck size={24} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg tracking-tight">Secure & Compliant</h3>
                  <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">Enterprise-grade security with full audit logging and RBAC support.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 shadow-sm shrink-0">
                  <Zap size={24} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg tracking-tight">Real-time Analytics</h3>
                  <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">Track recruiter workload, pipeline metrics, and candidate conversion instantly.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 shadow-sm shrink-0">
                  <Users size={24} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg tracking-tight">Collaborative Workspace</h3>
                  <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">Seamlessly coordinate between HR admins, recruiters, and hiring managers.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-slate-500 text-sm font-medium animate-in fade-in duration-1000 delay-500 fill-mode-both">
          &copy; {new Date().getFullYear()} Synesis Enterprise. All rights reserved.
        </div>
      </div>

      {/* Right Column: Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative bg-background overflow-hidden">
        {/* Background Graphic Watermark */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] opacity-[0.05] pointer-events-none">
          <img src="/logo.png" alt="Background Graphic" className="w-full h-full object-contain grayscale mix-blend-multiply" />
        </div>

        <div className="w-full max-w-[420px] space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-both relative z-10">
          <div className="flex flex-col items-center md:items-start space-y-2 mb-8 text-center md:text-left relative">
            <h2 className="text-3xl font-bold tracking-tight text-foreground relative z-10">Welcome back</h2>
            <p className="text-muted-foreground relative z-10">Sign in to your enterprise workspace</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Work Email</FormLabel>
                  <FormControl><Input type="email" placeholder="you@company.com" className="h-11 bg-background" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-foreground">Password</FormLabel>
                    <Link href="#" className="text-sm font-medium text-primary hover:underline">Forgot password?</Link>
                  </div>
                  <FormControl><Input type="password" placeholder="••••••••" className="h-11 bg-background" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full h-11 text-base font-semibold mt-4" disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Signing in...</> : "Sign In"}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}

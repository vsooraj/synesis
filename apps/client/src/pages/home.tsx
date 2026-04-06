import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Loader2, Sparkles, FileText, Briefcase } from "lucide-react";
import { useAnalyzeResume } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Layout } from "@/components/layout";

const formSchema = z.object({
  jobTitle: z.string().optional(),
  companyName: z.string().optional(),
  resumeText: z.string().min(100, "Resume must be at least 100 characters to provide meaningful analysis."),
  jobDescription: z.string().min(50, "Job description must be at least 50 characters."),
});

type FormValues = z.infer<typeof formSchema>;

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const analyzeResume = useAnalyzeResume();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jobTitle: "",
      companyName: "",
      resumeText: "",
      jobDescription: "",
    },
  });

  const onSubmit = (data: FormValues) => {
    analyzeResume.mutate(
      {
        data: {
          resumeText: data.resumeText,
          jobDescription: data.jobDescription,
          jobTitle: data.jobTitle || null,
          companyName: data.companyName || null,
        },
      },
      {
        onSuccess: (result) => {
          toast({
            title: "Analysis complete",
            description: "Your resume match results are ready.",
          });
          setLocation(`/results/${result.id}`);
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Analysis failed",
            description: error.data?.error || error.message || "An unexpected error occurred.",
          });
        },
      }
    );
  };

  return (
    <Layout>
      <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">New Analysis</h1>
          <p className="text-muted-foreground mt-2">
            Paste your resume and the target job description to get a precise match score and actionable feedback.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-border shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-primary" />
                    Target Role
                  </CardTitle>
                  <CardDescription>Optional context to label your analysis</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="jobTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Senior Frontend Engineer" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Acme Corp" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm md:col-span-2">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Content
                  </CardTitle>
                  <CardDescription>Paste the plain text of your documents</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="resumeText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your Resume</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Paste your entire resume text here..."
                            className="min-h-[300px] resize-y font-mono text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="jobDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Paste the job description here..."
                            className="min-h-[300px] resize-y font-mono text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                size="lg"
                className="w-full md:w-auto min-w-[200px]"
                disabled={analyzeResume.isPending}
              >
                {analyzeResume.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing Match...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Run Analysis
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </Layout>
  );
}

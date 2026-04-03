import * as React from "react";
import { useParams, Link } from "wouter";
import { format } from "date-fns";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lightbulb,
  Building2,
  Calendar,
  Trash2,
} from "lucide-react";
import {
  useGetAnalysis,
  getGetAnalysisQueryKey,
  useDeleteAnalysis,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Results() {
  const { id } = useParams<{ id: string }>();
  const numId = Number(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useParams();

  const { data: analysis, isLoading, isError } = useGetAnalysis(numId, {
    query: {
      enabled: !!numId && !isNaN(numId),
      queryKey: getGetAnalysisQueryKey(numId),
    },
  });

  const deleteAnalysis = useDeleteAnalysis();

  const handleDelete = () => {
    deleteAnalysis.mutate(
      { id: numId },
      {
        onSuccess: () => {
          toast({ title: "Analysis deleted" });
          window.location.href = "/history";
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-1/4" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-[300px] lg:col-span-1" />
            <Skeleton className="h-[300px] lg:col-span-2" />
          </div>
          <Skeleton className="h-[400px]" />
        </div>
      </Layout>
    );
  }

  if (isError || !analysis) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-destructive">Analysis Not Found</h2>
          <p className="text-muted-foreground mt-2 mb-6">
            We couldn't load the requested analysis. It may have been deleted.
          </p>
          <Button asChild>
            <Link href="/">Back to Analyzer</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 60) return "text-amber-500";
    return "text-destructive";
  };

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" asChild className="mr-1 h-8 w-8">
                <Link href="/history"><ArrowLeft size={16} /></Link>
              </Button>
              <h1 className="text-2xl font-bold tracking-tight">
                {analysis.jobTitle || "Untitled Role"}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground ml-11">
              {analysis.companyName && (
                <div className="flex items-center gap-1">
                  <Building2 size={14} />
                  {analysis.companyName}
                </div>
              )}
              <div className="flex items-center gap-1">
                <Calendar size={14} />
                {format(new Date(analysis.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10">
                  <Trash2 size={16} className="mr-2" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Analysis</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this analysis? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 shadow-sm border-border">
            <CardHeader className="pb-2 text-center">
              <CardTitle className="text-lg">Overall Match</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center pt-4 pb-6">
              <CircularProgress
                value={analysis.overallScore}
                size={180}
                strokeWidth={16}
                colorClass={getScoreColor(analysis.overallScore)}
              />
              <p className="text-center mt-6 text-sm text-muted-foreground max-w-[250px]">
                {analysis.summary}
              </p>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 shadow-sm border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Section Scores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Skills Match</span>
                  <span>{analysis.sectionScores.skills}/100</span>
                </div>
                <Progress value={analysis.sectionScores.skills} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Experience Level</span>
                  <span>{analysis.sectionScores.experience}/100</span>
                </div>
                <Progress value={analysis.sectionScores.experience} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Education & Certs</span>
                  <span>{analysis.sectionScores.education}/100</span>
                </div>
                <Progress value={analysis.sectionScores.education} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Keyword Density</span>
                  <span>{analysis.sectionScores.keywords}/100</span>
                </div>
                <Progress value={analysis.sectionScores.keywords} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="shadow-sm border-border">
            <CardHeader className="bg-emerald-500/5 pb-4">
              <CardTitle className="text-lg flex items-center text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Strengths
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ul className="space-y-3">
                {analysis.strengths.map((strength, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-emerald-500 mt-0.5">•</span>
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border">
            <CardHeader className="bg-destructive/5 pb-4">
              <CardTitle className="text-lg flex items-center text-destructive">
                <XCircle className="w-5 h-5 mr-2" />
                Gaps & Missing Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ul className="space-y-3">
                {analysis.gaps.map((gap, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-destructive mt-0.5">•</span>
                    <span>{gap}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Lightbulb className="w-5 h-5 mr-2 text-amber-500" />
              Actionable Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {analysis.suggestions.map((suggestion, i) => (
                <li key={i} className="flex gap-3 text-sm p-4 rounded-lg bg-secondary/50 border border-border">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                    {i + 1}
                  </div>
                  <div className="pt-0.5">{suggestion}</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle className="text-lg">Keyword Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-500" />
                  Matched Keywords
                </h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.matchedKeywords.filter(k => k.found).map((kw, i) => (
                    <Badge 
                      key={i} 
                      variant="outline" 
                      className={
                        kw.importance === 'high' ? 'border-primary text-primary bg-primary/5' :
                        kw.importance === 'medium' ? 'border-muted-foreground text-foreground' :
                        'border-border text-muted-foreground'
                      }
                    >
                      {kw.keyword}
                    </Badge>
                  ))}
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1 text-amber-500" />
                  Missing Keywords
                </h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.missingKeywords.map((kw, i) => (
                    <Badge key={i} variant="destructive" className="opacity-80 font-normal">
                      {kw}
                    </Badge>
                  ))}
                  {analysis.matchedKeywords.filter(k => !k.found).map((kw, i) => (
                    <Badge key={`mk-${i}`} variant="destructive" className="opacity-80 font-normal">
                      {kw.keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

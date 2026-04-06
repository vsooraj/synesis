import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Upload, User, Mail, FileText, Loader2 } from "lucide-react";
import { enterpriseApi, type ResumeProfile } from "@/lib/enterprise-api";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TYPE_COLORS: Record<string, string> = {
  Internal: "bg-blue-100 text-blue-700",
  External: "bg-gray-100 text-gray-700",
  Contractor: "bg-orange-100 text-orange-700",
};

function AddCandidateDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [candidateName, setCandidateName] = React.useState("");
  const [candidateEmail, setCandidateEmail] = React.useState("");
  const [candidateType, setCandidateType] = React.useState("External");
  const [resumeText, setResumeText] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const { toast } = useToast();

  const submit = async (tab: "text" | "file") => {
    setLoading(true);
    try {
      if (tab === "file" && file) {
        await enterpriseApi.resumes.uploadFile(file, { candidateName, candidateEmail, candidateType });
      } else {
        if (!resumeText.trim()) { toast({ variant: "destructive", title: "Resume text is required" }); setLoading(false); return; }
        await enterpriseApi.resumes.uploadText({ resumeText, candidateName, candidateEmail, candidateType });
      }
      toast({ title: "Candidate added successfully" });
      setOpen(false);
      setCandidateName(""); setCandidateEmail(""); setResumeText(""); setFile(null);
      onAdded();
    } catch (err) {
      toast({ variant: "destructive", title: "Upload failed", description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" />Add Candidate</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add Candidate Resume</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Candidate Name</Label><Input value={candidateName} onChange={e => setCandidateName(e.target.value)} placeholder="Jane Smith" /></div>
            <div><Label>Email</Label><Input value={candidateEmail} onChange={e => setCandidateEmail(e.target.value)} placeholder="jane@example.com" /></div>
          </div>
          <div>
            <Label>Candidate Type</Label>
            <Select value={candidateType} onValueChange={setCandidateType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Internal">Internal</SelectItem>
                <SelectItem value="External">External</SelectItem>
                <SelectItem value="Contractor">Contractor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Tabs defaultValue="text">
            <TabsList className="w-full"><TabsTrigger value="text" className="flex-1">Paste Text</TabsTrigger><TabsTrigger value="file" className="flex-1">Upload File</TabsTrigger></TabsList>
            <TabsContent value="text" className="mt-3">
              <Textarea value={resumeText} onChange={e => setResumeText(e.target.value)} placeholder="Paste resume text here..." className="min-h-[160px]" />
              <Button className="mt-3 w-full" onClick={() => submit("text")} disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding...</> : "Add Candidate"}
              </Button>
            </TabsContent>
            <TabsContent value="file" className="mt-3">
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors" onClick={() => document.getElementById("resume-file")?.click()}>
                <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                {file ? <p className="text-sm font-medium">{file.name}</p> : <p className="text-sm text-muted-foreground">Click to select PDF or TXT file</p>}
                <input id="resume-file" type="file" accept=".pdf,.txt" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <Button className="mt-3 w-full" onClick={() => submit("file")} disabled={loading || !file}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</> : "Upload & Add"}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Candidates() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = React.useState("All");

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["enterprise", "resumes"],
    queryFn: () => enterpriseApi.resumes.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => enterpriseApi.resumes.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["enterprise", "resumes"] }); toast({ title: "Candidate removed" }); },
    onError: (err) => toast({ variant: "destructive", title: "Delete failed", description: err.message }),
  });

  const filtered = filter === "All" ? profiles : profiles.filter(p => p.candidateType === filter);

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Candidate Pool</h1>
            <p className="text-muted-foreground mt-1">Manage all candidate and employee resumes in one place</p>
          </div>
          <AddCandidateDialog onAdded={() => qc.invalidateQueries({ queryKey: ["enterprise", "resumes"] })} />
        </div>

        <div className="flex gap-2 flex-wrap">
          {["All", "Internal", "External", "Contractor"].map(t => (
            <Button key={t} variant={filter === t ? "default" : "outline"} size="sm" onClick={() => setFilter(t)}>{t}</Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-lg font-medium text-muted-foreground">No candidates yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add resumes to start building your talent pool</p>
          </CardContent></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p: ResumeProfile) => (
              <Card key={p.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{p.candidateName || "Unknown Candidate"}</CardTitle>
                        {p.candidateEmail && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Mail className="h-3 w-3" />{p.candidateEmail}</p>}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <Badge className={TYPE_COLORS[p.candidateType] || "bg-gray-100 text-gray-700"}>{p.candidateType}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                  {p.fileName && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><FileText className="h-3 w-3" />{p.fileName}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

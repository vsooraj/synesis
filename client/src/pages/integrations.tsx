import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { enterpriseApi, WEBHOOK_EVENT_LABELS } from "../lib/enterprise-api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { useToast } from "../hooks/use-toast";
import { Loader2, Webhook, CheckCircle2, XCircle, AlertCircle, RefreshCw, Play, Trash2, ExternalLink, Download } from "lucide-react";
import { cn } from "../lib/utils";
import { Layout } from "../components/layout";

const STATUS_COLORS: Record<string, string> = {
  delivered: "text-green-600 bg-green-50 border-green-200",
  failed:    "text-red-600 bg-red-50 border-red-200",
  retrying:  "text-amber-600 bg-amber-50 border-amber-200",
  pending:   "text-blue-600 bg-blue-50 border-blue-200",
};

const N8N_TEMPLATE_GROUPS = [
  {
    category: "Shortlisting & Pipeline",
    templates: [
      { name: "Gmail Outreach on Shortlist Approval", file: "gmail-outreach.json", icon: "📧", description: "Sends personalised Gmail to each shortlisted candidate when HR approves", event: "shortlist.approved" },
      { name: "Teams Approval Card", file: "teams-approval-card.json", icon: "💬", description: "Posts an Adaptive Card to MS Teams when an AI shortlist is ready for review", event: "shortlist.pending_approval" },
      { name: "Outlook Daily Digest", file: "outlook-digest.json", icon: "📊", description: "Sends a daily HTML pipeline digest to your recruiting team via Outlook", event: null },
    ],
  },
  {
    category: "Interview Scheduling",
    templates: [
      { name: "Teams — Interview Scheduled Notification", file: "teams-interview-notification.json", icon: "🗓️", description: "Posts an Adaptive Card to a MS Teams channel when an interview is scheduled, with date, type, interviewers, and a Join Meeting button", event: "interview.scheduled" },
      { name: "Outlook — Calendar Invite for Interview", file: "outlook-interview-invite.json", icon: "📅", description: "Creates an Outlook calendar event for each interviewer when an interview is scheduled. Supports online meetings for Video interviews", event: "interview.scheduled" },
      { name: "Teams — Interviewer Feedback Request", file: "teams-feedback-request.json", icon: "💌", description: "Sends a personalised Teams DM to each interviewer requesting feedback when the recruiter clicks 'Request Feedback'", event: "interview.feedback_requested" },
    ],
  },
];

export default function IntegrationsPage() {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [enabledEvents, setEnabledEvents] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true);

  const { data: config, refetch: refetchConfig, isLoading: configLoading } = useQuery({
    queryKey: ["webhook-config"],
    queryFn: () => enterpriseApi.webhooks.getConfig(),
  });

  const { data: deliveries, refetch: refetchDeliveries, isLoading: delivLoading } = useQuery({
    queryKey: ["webhook-deliveries"],
    queryFn: () => enterpriseApi.webhooks.getDeliveries(),
    refetchInterval: 10000,
  });

  const { data: eventList } = useQuery({
    queryKey: ["webhook-events"],
    queryFn: () => enterpriseApi.webhooks.getEvents(),
  });

  useEffect(() => {
    if (config) {
      setUrl(config.url ?? "");
      setDescription(config.description ?? "");
      setEnabled(config.enabled ?? true);
      setEnabledEvents(JSON.parse(config.enabledEvents ?? "[]"));
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: () => enterpriseApi.webhooks.saveConfig({ url, enabledEvents, enabled, description }),
    onSuccess: () => { refetchConfig(); toast({ title: "Webhook saved", description: "Configuration updated successfully." }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => enterpriseApi.webhooks.deleteConfig(),
    onSuccess: () => { refetchConfig(); setUrl(""); setDescription(""); setEnabledEvents([]); toast({ title: "Webhook removed" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const testMutation = useMutation({
    mutationFn: (event: string) => enterpriseApi.webhooks.testEvent(event),
    onSuccess: (_, event) => { refetchDeliveries(); toast({ title: "Test fired", description: `"${event}" event sent to your webhook.` }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleEvent = (event: string) => {
    setEnabledEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    );
  };

  const allEvents = eventList?.events ?? [];

  const stats = deliveries ? {
    delivered: deliveries.filter(d => d.status === "delivered").length,
    failed: deliveries.filter(d => d.status === "failed").length,
    pending: deliveries.filter(d => d.status === "pending" || d.status === "retrying").length,
  } : null;

  return (
    <Layout>
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Webhook className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">Integrations</h1>
          <p className="text-xs text-muted-foreground">Connect Synesis to n8n, Gmail, Outlook, Teams, and your HR systems</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Webhook className="h-4 w-4" /> Webhook Configuration
              </CardTitle>
              <CardDescription>
                Synesis will POST signed events to this URL. Use it as a trigger in n8n, Make, Zapier, or any HTTP workflow tool.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {configLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="webhook-url">Endpoint URL</Label>
                    <Input id="webhook-url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://your-n8n.cloud/webhook/matchpoint-events" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="webhook-desc">Description (optional)</Label>
                    <Input id="webhook-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. n8n Production Workspace" />
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <Switch id="webhook-enabled" checked={enabled} onCheckedChange={setEnabled} />
                    <Label htmlFor="webhook-enabled" className="text-sm">Active — Synesis will deliver events</Label>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Subscribed Events</Label>
                    <p className="text-xs text-muted-foreground">Leave all unchecked to receive every event.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {allEvents.map((event: string) => (
                        <label key={event} className={cn("flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors text-sm", enabledEvents.includes(event) ? "bg-primary/5 border-primary/30 text-primary font-medium" : "hover:bg-muted/50")}>
                          <input type="checkbox" checked={enabledEvents.includes(event)} onChange={() => toggleEvent(event)} className="accent-primary" />
                          <div>
                            <span className="block">{event}</span>
                            <span className="text-xs text-muted-foreground font-normal">{WEBHOOK_EVENT_LABELS[event] ?? ""}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button onClick={() => saveMutation.mutate()} disabled={!url || saveMutation.isPending} className="gap-1">
                      {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Save Configuration
                    </Button>
                    {config && (
                      <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="gap-1 ml-auto">
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {config && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Delivery Log</CardTitle>
                    <CardDescription>Last 50 webhook events and their delivery status</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    {stats && (
                      <div className="flex gap-2 text-xs">
                        <span className="text-green-600 font-medium">{stats.delivered} delivered</span>
                        {stats.failed > 0 && <span className="text-red-600 font-medium">{stats.failed} failed</span>}
                        {stats.pending > 0 && <span className="text-amber-600 font-medium">{stats.pending} pending</span>}
                      </div>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => refetchDeliveries()} disabled={delivLoading} className="gap-1 h-7">
                      <RefreshCw className={cn("h-3 w-3", delivLoading && "animate-spin")} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {deliveries && deliveries.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No deliveries yet. Use the test buttons to fire a sample event.</p>
                ) : (
                  <div className="space-y-2">
                    {(deliveries ?? []).map(d => (
                      <div key={d.id} className="flex items-start gap-3 text-sm px-3 py-2.5 rounded-lg border">
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono text-foreground">{d.event}</code>
                            <Badge variant="outline" className={cn("text-[10px] py-0 border", STATUS_COLORS[d.status] ?? "")}>
                              {d.status}
                            </Badge>
                            {d.attempts > 1 && <span className="text-xs text-muted-foreground">{d.attempts} attempts</span>}
                          </div>
                          {d.lastError && <p className="text-xs text-red-600 truncate">{d.lastError}</p>}
                          <p className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleString()}</p>
                        </div>
                        {d.responseStatus && (
                          <span className={cn("text-xs font-mono flex-shrink-0 mt-0.5", d.responseStatus >= 200 && d.responseStatus < 300 ? "text-green-600" : "text-red-600")}>
                            HTTP {d.responseStatus}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {config && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Play className="h-4 w-4" /> Test Events
                </CardTitle>
                <CardDescription>Fire a sample payload to your webhook to verify it's working</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {allEvents.map((event: string) => (
                  <div key={event} className="flex items-center justify-between gap-2">
                    <code className="text-xs font-mono text-muted-foreground truncate flex-1">{event}</code>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 flex-shrink-0"
                      onClick={() => testMutation.mutate(event)}
                      disabled={testMutation.isPending && testMutation.variables === event}
                    >
                      {testMutation.isPending && testMutation.variables === event
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Play className="h-3 w-3" />}
                      Send
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">n8n Workflow Templates</CardTitle>
              <CardDescription>
                Import these into your n8n instance to get started instantly. Go to n8n → Workflows → Import.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {N8N_TEMPLATE_GROUPS.map(group => (
                <div key={group.category} className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{group.category}</p>
                  <div className="space-y-2">
                    {group.templates.map(t => (
                      <div key={t.file} className="border rounded-lg p-3 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-lg shrink-0">{t.icon}</span>
                            <div className="min-w-0">
                              <span className="text-sm font-medium leading-tight">{t.name}</span>
                              {t.event && (
                                <code className="ml-2 text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">{t.event}</code>
                              )}
                            </div>
                          </div>
                          <a
                            href={`/api/enterprise/webhooks/template/${t.file}`}
                            download={t.file}
                            className="flex-shrink-0"
                          >
                            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
                              <Download className="h-3 w-3" /> JSON
                            </Button>
                          </a>
                        </div>
                        <p className="text-xs text-muted-foreground pl-8">{t.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="pt-1">
                <a href="https://n8n.io" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> Get n8n Cloud or self-host
                </a>
              </div>
            </CardContent>
          </Card>

          <Card className="border-muted bg-muted/30">
            <CardContent className="pt-4 text-xs text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">Verifying Webhook Signatures</p>
              <p>Every request includes an <code className="bg-muted px-1 rounded">X-Synesis-Signature</code> header.</p>
              <p>Compute <code className="bg-muted px-1 rounded">HMAC-SHA256(secret, body)</code> and compare with the header value (prefix: <code className="bg-muted px-1 rounded">sha256=</code>).</p>
              <p>Your webhook secret is shown in your n8n credential setup. Keep it private.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </Layout>
  );
}

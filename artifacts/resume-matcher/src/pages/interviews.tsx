import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  enterpriseApi, type InterviewSlot, type FeedbackDimension,
  INTERVIEW_TYPES, INTERVIEW_STATUSES,
} from "@/lib/enterprise-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  CalendarDays, Video, Phone, Cpu, Building2, Users2, ChevronRight,
  Star, CheckCircle2, XCircle, Clock, MapPin, Link2, Loader2, Send,
  CalendarPlus, MessageSquare, Mail,
} from "lucide-react";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  Video:     <Video className="w-3.5 h-3.5" />,
  Phone:     <Phone className="w-3.5 h-3.5" />,
  Technical: <Cpu className="w-3.5 h-3.5" />,
  Onsite:    <Building2 className="w-3.5 h-3.5" />,
  Panel:     <Users2 className="w-3.5 h-3.5" />,
};

const STATUS_STYLES: Record<string, string> = {
  Scheduled:  "bg-blue-50 text-blue-700 border-blue-200",
  Completed:  "bg-green-50 text-green-700 border-green-200",
  Cancelled:  "bg-gray-100 text-gray-500 border-gray-200",
  "No-show":  "bg-red-50 text-red-600 border-red-200",
};

const FEEDBACK_DIMENSIONS = [
  "Technical Skills",
  "Communication",
  "Problem Solving",
  "Culture Fit",
  "Relevant Experience",
  "Motivation",
];

function StarRating({ value, onChange, size = "md" }: { value: number; onChange?: (v: number) => void; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-3.5 h-3.5" : "w-5 h-5";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange?.(n)} className={cn("transition-colors", onChange ? "cursor-pointer" : "cursor-default")}>
          <Star className={cn(sz, n <= value ? "fill-amber-400 text-amber-400" : "text-gray-200 fill-gray-100")} />
        </button>
      ))}
    </div>
  );
}

function FeedbackDisplay({ data, overall, rating }: { data?: FeedbackDimension[] | null; overall?: string | null; rating?: number | null }) {
  if (!data?.length && !overall && !rating) return null;
  return (
    <div className="mt-3 space-y-2">
      {data && data.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
          {data.map(d => (
            <div key={d.dimension} className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-500 w-36 shrink-0">{d.dimension}</span>
              <StarRating value={d.score} size="sm" />
              {d.comment && <span className="text-xs text-gray-500 truncate">{d.comment}</span>}
            </div>
          ))}
        </div>
      )}
      {!data?.length && rating != null && (
        <div className="flex items-center gap-1.5">
          <StarRating value={rating} size="sm" />
          <span className="text-xs text-gray-500">Overall</span>
        </div>
      )}
      {overall && <p className="text-xs text-gray-600 bg-gray-50 rounded p-2 line-clamp-3">{overall}</p>}
    </div>
  );
}

function generateICS(slot: InterviewSlot): string {
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = new Date(slot.scheduledAt);
  const end = new Date(start.getTime() + slot.durationMinutes * 60_000);
  const uid = `matchpoint-interview-${slot.id}@matchpoint.dev`;
  const title = slot.ticket ? `Interview: ${slot.ticket.title}` : "Interview";
  const candidate = slot.candidate?.candidateName ?? "Candidate";
  const desc = [
    slot.candidate?.candidateName ? `Candidate: ${slot.candidate.candidateName}` : null,
    slot.candidate?.candidateEmail ? `Email: ${slot.candidate.candidateEmail}` : null,
    slot.ticket ? `Position: ${slot.ticket.title}` : null,
    `Type: ${slot.type}`,
    `Duration: ${slot.durationMinutes} min`,
    slot.interviewers?.length ? `Interviewers: ${slot.interviewers.join(", ")}` : null,
    slot.meetingLink ? `Meeting: ${slot.meetingLink}` : null,
    slot.notes ? `Notes: ${slot.notes}` : null,
  ].filter(Boolean).join("\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MatchPoint Enterprise//Interview Scheduling//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${title} - ${candidate}`,
    `DESCRIPTION:${desc}`,
    slot.location ? `LOCATION:${slot.location}` : slot.meetingLink ? `LOCATION:${slot.meetingLink}` : null,
    slot.meetingLink ? `URL:${slot.meetingLink}` : null,
    ...(slot.interviewers ?? []).map(email => `ATTENDEE;RSVP=TRUE:MAILTO:${email}`),
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

function downloadICS(slot: InterviewSlot) {
  const content = generateICS(slot);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `interview-${slot.id}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function InterviewCard({ slot, onComplete, onCancel, onNoShow, onRequestFeedback }: {
  slot: InterviewSlot;
  onComplete: (id: number) => void;
  onCancel: (id: number) => void;
  onNoShow: (id: number) => void;
  onRequestFeedback: (id: number) => void;
}) {
  const dt = new Date(slot.scheduledAt);
  const timeStr = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isScheduled = slot.status === "Scheduled";
  const isCompleted = slot.status === "Completed";

  return (
    <div className={cn("bg-white rounded-xl border p-4 space-y-3 shadow-sm", slot.status === "Cancelled" && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn("inline-flex items-center gap-1 text-xs font-medium border rounded-full px-2 py-0.5", STATUS_STYLES[slot.status] ?? "bg-gray-100 text-gray-600")}>
              {slot.status === "Completed" && <CheckCircle2 className="w-3 h-3" />}
              {slot.status === "Cancelled" && <XCircle className="w-3 h-3" />}
              {slot.status}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 border rounded-full px-2 py-0.5 bg-gray-50">
              {TYPE_ICONS[slot.type]}
              {slot.type}
            </span>
          </div>
          <p className="font-semibold text-gray-900 text-sm">
            {slot.candidate?.candidateName ?? <span className="text-gray-400 italic">No candidate linked</span>}
          </p>
          {slot.candidate?.candidateEmail && (
            <p className="text-xs text-gray-400">{slot.candidate.candidateEmail}</p>
          )}
        </div>
        <div className="text-right shrink-0 space-y-0.5">
          <p className="text-sm font-semibold text-gray-900">{timeStr}</p>
          <p className="text-xs text-gray-400">{slot.durationMinutes} min</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        {slot.ticket && (
          <Link href={`/tickets/${slot.ticket.id}`} className="inline-flex items-center gap-1 hover:text-blue-600 transition-colors">
            <ChevronRight className="w-3 h-3" /> {slot.ticket.title}
          </Link>
        )}
        {slot.interviewers?.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <Users2 className="w-3 h-3" /> {slot.interviewers.join(", ")}
          </span>
        )}
        {slot.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {slot.location}
          </span>
        )}
      </div>

      {slot.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded p-2 line-clamp-2">{slot.notes}</p>}

      {isCompleted && (
        <FeedbackDisplay data={slot.feedbackData} overall={slot.feedback} rating={slot.rating} />
      )}

      <div className="flex items-center gap-2 pt-1 flex-wrap">
        {slot.meetingLink && (
          <a href={slot.meetingLink} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-blue-600 border-blue-200 hover:bg-blue-50">
              <Video className="w-3 h-3" /> Join Meeting
            </Button>
          </a>
        )}
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-gray-500" onClick={() => downloadICS(slot)} title="Add to Outlook / Calendar">
          <CalendarPlus className="w-3 h-3" /> Add to Calendar
        </Button>
        {isScheduled && (
          <>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-200 hover:bg-green-50" onClick={() => onComplete(slot.id)}>
              <CheckCircle2 className="w-3 h-3" /> Complete
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50" onClick={() => onNoShow(slot.id)}>
              <XCircle className="w-3 h-3" /> No-show
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-400" onClick={() => onCancel(slot.id)}>
              Cancel
            </Button>
          </>
        )}
        {isCompleted && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50" onClick={() => onRequestFeedback(slot.id)}>
            <Send className="w-3 h-3" /> Request Feedback
          </Button>
        )}
      </div>
    </div>
  );
}

function CompleteDialog({ id, onClose, onDone }: { id: number; onClose: () => void; onDone?: () => void }) {
  const qc = useQueryClient();
  const [summary, setSummary] = React.useState("");
  const [dimensions, setDimensions] = React.useState<Record<string, { score: number; comment: string }>>(
    Object.fromEntries(FEEDBACK_DIMENSIONS.map(d => [d, { score: 0, comment: "" }]))
  );

  const overallRating = React.useMemo(() => {
    const scores = Object.values(dimensions).map(d => d.score).filter(s => s > 0);
    if (!scores.length) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [dimensions]);

  const feedbackData: FeedbackDimension[] = Object.entries(dimensions)
    .filter(([, v]) => v.score > 0)
    .map(([dim, v]) => ({ dimension: dim, score: v.score, comment: v.comment || undefined }));

  const complete = useMutation({
    mutationFn: () => enterpriseApi.interviews.complete(id, summary || undefined, overallRating || undefined, feedbackData.length ? feedbackData : undefined),
    onSuccess: async () => {
      onDone?.();
      await qc.invalidateQueries({ queryKey: ["interviews"] });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" /> Mark Interview Completed
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-semibold mb-3 block">Dimension Scores</Label>
            <div className="space-y-3">
              {FEEDBACK_DIMENSIONS.map(dim => (
                <div key={dim} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{dim}</span>
                    <StarRating value={dimensions[dim].score} onChange={score => setDimensions(prev => ({ ...prev, [dim]: { ...prev[dim], score } }))} />
                  </div>
                  {dimensions[dim].score > 0 && (
                    <Input
                      value={dimensions[dim].comment}
                      onChange={e => setDimensions(prev => ({ ...prev, [dim]: { ...prev[dim], comment: e.target.value } }))}
                      placeholder={`Brief comment on ${dim.toLowerCase()}…`}
                      className="h-7 text-xs"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {overallRating > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <span className="text-xs text-amber-700 font-medium">Computed Overall Rating:</span>
              <StarRating value={overallRating} size="sm" />
              <span className="text-xs text-amber-600 font-bold">{overallRating}/5</span>
            </div>
          )}

          <div>
            <Label className="text-sm font-semibold mb-1 block">Overall Summary</Label>
            <Textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="Overall impression, key highlights, recommendation…"
              rows={3}
              className="text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => complete.mutate()}
            disabled={complete.isPending || (feedbackData.length === 0 && !summary)}
            className="gap-1.5"
          >
            {complete.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ScheduleInterviewDialog({
  open, onOpenChange, ticketId, ticketCandidateId, resumeProfileId, candidateName, onCreated,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  ticketId: number; ticketCandidateId?: number; resumeProfileId?: number;
  candidateName?: string; onCreated?: () => void;
}) {
  const qc = useQueryClient();
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  const defaultDt = now.toISOString().slice(0, 16);

  const [form, setForm] = React.useState({
    scheduledAt: defaultDt, durationMinutes: "60", type: "Video",
    interviewers: "", meetingLink: "", location: "", notes: "",
  });

  const create = useMutation({
    mutationFn: () => enterpriseApi.interviews.create({
      ticketId,
      ticketCandidateId,
      resumeProfileId,
      scheduledAt: new Date(form.scheduledAt).toISOString(),
      durationMinutes: parseInt(form.durationMinutes) || 60,
      type: form.type,
      interviewers: form.interviewers ? form.interviewers.split(",").map(s => s.trim()).filter(Boolean) : [],
      meetingLink: form.meetingLink || undefined,
      location: form.location || undefined,
      notes: form.notes || undefined,
    }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["interviews"] });
      onCreated?.();
      onOpenChange(false);
    },
  });

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-600" />
            Schedule Interview{candidateName ? ` — ${candidateName}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">Date & Time</Label>
              <Input type="datetime-local" value={form.scheduledAt} onChange={e => set("scheduledAt", e.target.value)} className="text-sm" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Duration</Label>
              <Select value={form.durationMinutes} onValueChange={v => set("durationMinutes", v)}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[30, 45, 60, 90, 120].map(m => <SelectItem key={m} value={String(m)}>{m} min</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Interview Type</Label>
              <Select value={form.type} onValueChange={v => set("type", v)}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTERVIEW_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Interviewers <span className="text-gray-400">(comma-separated emails)</span></Label>
            <Input value={form.interviewers} onChange={e => set("interviewers", e.target.value)} placeholder="alice@co.com, bob@co.com" className="text-sm" />
          </div>
          {form.type === "Video" && (
            <div>
              <Label className="text-xs mb-1 block">Meeting Link</Label>
              <Input value={form.meetingLink} onChange={e => set("meetingLink", e.target.value)} placeholder="https://teams.microsoft.com/… or https://meet.google.com/…" className="text-sm" />
            </div>
          )}
          {(form.type === "Onsite" || form.type === "Panel") && (
            <div>
              <Label className="text-xs mb-1 block">Location</Label>
              <Input value={form.location} onChange={e => set("location", e.target.value)} placeholder="Office room / address" className="text-sm" />
            </div>
          )}
          <div>
            <Label className="text-xs mb-1 block">Notes</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Topics to cover, prep instructions…" rows={2} className="text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={!form.scheduledAt || create.isPending} className="gap-1.5">
            {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function InterviewsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = React.useState<string>("Scheduled");
  const [completeId, setCompleteId] = React.useState<number | null>(null);

  const { data: slots = [], isLoading } = useQuery<InterviewSlot[]>({
    queryKey: ["interviews", filter],
    queryFn: () => {
      if (filter === "upcoming") return enterpriseApi.interviews.upcoming(60);
      if (filter === "all") return enterpriseApi.interviews.list({});
      return enterpriseApi.interviews.list({ status: filter });
    },
    refetchInterval: 60_000,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => enterpriseApi.interviews.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["interviews"], refetchType: "all" }),
  });

  const noShowMutation = useMutation({
    mutationFn: (id: number) => enterpriseApi.interviews.noShow(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["interviews"], refetchType: "all" }),
  });

  const requestFeedbackMutation = useMutation({
    mutationFn: (id: number) => enterpriseApi.interviews.requestFeedback(id),
    onSuccess: (data) => {
      toast({ title: "Feedback requested", description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const grouped = React.useMemo(() => {
    const map = new Map<string, InterviewSlot[]>();
    for (const slot of slots) {
      const label = new Date(slot.scheduledAt).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(slot);
    }
    return map;
  }, [slots]);

  const filters = [
    { value: "upcoming", label: "Upcoming" },
    { value: "Scheduled", label: "Scheduled" },
    { value: "Completed", label: "Completed" },
    { value: "Cancelled", label: "Cancelled" },
    { value: "all", label: "All" },
  ];

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">Interviews</h1>
          <Badge variant="outline" className="text-gray-500">{slots.length}</Badge>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {filters.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={cn("text-xs font-medium px-3 py-1.5 rounded-md transition-colors",
                filter === f.value ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {slots.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No interviews found</p>
          <p className="text-xs mt-1">Schedule one from a position ticket</p>
          <Link href="/tickets"><Button variant="outline" size="sm" className="mt-4 gap-1"><ChevronRight className="w-4 h-4" /> Go to Position Board</Button></Link>
        </div>
      )}

      {Array.from(grouped.entries()).map(([dateLabel, daySlots]) => (
        <div key={dateLabel} className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-600">{dateLabel}</p>
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">{daySlots.length} interview{daySlots.length !== 1 ? "s" : ""}</span>
          </div>
          {daySlots.map(slot => (
            <InterviewCard key={slot.id} slot={slot}
              onComplete={(id) => setCompleteId(id)}
              onCancel={(id) => cancelMutation.mutate(id)}
              onNoShow={(id) => noShowMutation.mutate(id)}
              onRequestFeedback={(id) => requestFeedbackMutation.mutate(id)}
            />
          ))}
        </div>
      ))}

      {completeId != null && (
        <CompleteDialog
          id={completeId}
          onClose={() => setCompleteId(null)}
          onDone={() => setFilter("Completed")}
        />
      )}
    </div>
  );
}

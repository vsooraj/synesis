import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getRagStats, ragIngestAll, ragQuery, type RagSource } from "../lib/enterprise-api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import { cn } from "../lib/utils";
import { Loader2, Send, Database, RefreshCw, Bot, User, BookOpen, AlertCircle } from "lucide-react";
import { Layout } from "../components/layout";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: RagSource[];
  chunksSearched?: number;
  chunksUsed?: number;
  error?: boolean;
}

const EXAMPLE_QUESTIONS = [
  "Who has React or TypeScript experience?",
  "Which candidates have led or managed a team?",
  "List candidates with machine learning or AI skills",
  "Who has a computer science degree?",
  "Find candidates with backend or API experience",
  "Which candidates have startup experience?",
];

export default function RagPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm your AI recruiting assistant. Ask me anything about your candidate pool — I'll search through indexed resume chunks and give you grounded, cited answers.\n\nFirst time? Click \"Build Index\" to index your uploaded resumes, then ask away.",
    },
  ]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["rag-stats"],
    queryFn: getRagStats,
    refetchInterval: 15000,
  });

  const ingestMutation = useMutation({
    mutationFn: ragIngestAll,
    onSuccess: (data) => {
      refetchStats();
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: `Index complete! Processed **${data.resumes}** resumes into **${data.chunks}** searchable chunks. You can now ask questions about your candidates.`,
      }]);
    },
    onError: () => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: "Indexing failed. Please try again.",
        error: true,
      }]);
    },
  });

  const queryMutation = useMutation({
    mutationFn: (question: string) => ragQuery(question),
    onSuccess: (data) => {
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== "typing");
        return [...filtered, {
          id: Date.now().toString(),
          role: "assistant",
          content: data.answer,
          sources: data.sources,
          chunksSearched: data.chunksSearched,
          chunksUsed: data.chunksUsed,
        }];
      });
    },
    onError: (err: Error) => {
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== "typing");
        return [...filtered, {
          id: Date.now().toString(),
          role: "assistant",
          content: `Error: ${err.message || "Could not get an answer. Please try again."}`,
          error: true,
        }];
      });
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const q = input.trim();
    if (!q || queryMutation.isPending) return;
    setInput("");
    setMessages(prev => [
      ...prev,
      { id: Date.now().toString(), role: "user", content: q },
      { id: "typing", role: "assistant", content: "" },
    ]);
    queryMutation.mutate(q);
  };

  const notIndexed = stats && stats.indexedResumes === 0;

  return (
    <Layout>
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-purple-600" />
          <div>
            <h1 className="text-xl font-semibold">RAG Search</h1>
            <p className="text-xs text-muted-foreground">AI answers grounded in your candidate database</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {stats && (
            <div className="flex gap-2 text-sm">
              <Badge variant="outline" className="gap-1"><Database className="h-3 w-3" />{stats.indexedResumes} resumes indexed</Badge>
              <Badge variant="outline">{stats.totalChunks} chunks</Badge>
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => ingestMutation.mutate()}
            disabled={ingestMutation.isPending}
            className="gap-1"
          >
            {ingestMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {notIndexed ? "Build Index" : "Re-index"}
          </Button>
        </div>
      </div>

      {notIndexed && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-medium text-amber-800">No resumes indexed yet.</span>{" "}
              <span className="text-amber-700">Click <strong>Build Index</strong> above to prepare the search index, then ask questions.</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="min-h-[400px] max-h-[600px] overflow-y-auto p-4 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "assistant" && (
                <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="h-4 w-4 text-purple-700" />
                </div>
              )}
              <div className={cn("max-w-[80%] space-y-2", msg.role === "user" ? "items-end" : "items-start")}>
                <div className={cn("rounded-2xl px-4 py-3 text-sm", msg.role === "user"
                  ? "bg-purple-600 text-white rounded-tr-sm"
                  : msg.error
                    ? "bg-red-50 border border-red-200 text-red-800 rounded-tl-sm"
                    : "bg-muted text-foreground rounded-tl-sm"
                )}>
                  {msg.id === "typing" ? (
                    <div className="flex gap-1 items-center py-1">
                      <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  )}
                </div>

                {msg.sources && msg.sources.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground px-1">
                      {msg.chunksUsed} sources used · {msg.chunksSearched} chunks searched
                    </p>
                    {msg.sources.map((s, i) => (
                      <div key={i} className="bg-white border rounded-xl px-3 py-2 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-foreground truncate">{s.candidateName}</span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <Badge variant="secondary" className="text-[10px] py-0">{s.section}</Badge>
                            <span className="text-muted-foreground">BM25 {s.bm25Score}</span>
                          </div>
                        </div>
                        <p className="text-muted-foreground leading-relaxed line-clamp-2">{s.snippet}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="h-8 w-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="border-t p-3 flex gap-2 bg-background">
          <Input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask anything about your candidates…"
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            disabled={queryMutation.isPending}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={!input.trim() || queryMutation.isPending} className="gap-1 bg-purple-600 hover:bg-purple-700">
            {queryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {messages.length <= 2 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Try these example questions:</p>
          <div className="grid grid-cols-2 gap-2">
            {EXAMPLE_QUESTIONS.map(q => (
              <button
                key={q}
                onClick={() => { setInput(q); inputRef.current?.focus(); }}
                className="text-left text-xs px-3 py-2.5 rounded-lg border bg-white hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
    </Layout>
  );
}

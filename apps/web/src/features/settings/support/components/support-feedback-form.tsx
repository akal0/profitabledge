"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpcOptions } from "@/utils/trpc";

export function SupportFeedbackForm({
  pagePath,
  onSubmitted,
}: {
  pagePath: string;
  onSubmitted: () => Promise<unknown>;
}) {
  const [category, setCategory] = useState("bug");
  const [priority, setPriority] = useState("normal");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const canSubmit = useMemo(
    () => subject.trim().length >= 4 && message.trim().length >= 10,
    [message, subject]
  );

  const submitFeedback = useMutation(
    trpcOptions.operations.submitFeedback.mutationOptions()
  );

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error("Add a clearer subject and message before sending.");
      return;
    }

    try {
      await submitFeedback.mutateAsync({
        category: category as
          | "bug"
          | "idea"
          | "account_sync"
          | "ai"
          | "ux"
          | "other",
        priority: priority as "low" | "normal" | "high" | "urgent",
        subject: subject.trim(),
        message: message.trim(),
        pagePath,
        metadata: {
          origin: "settings-support",
        },
      });

      setSubject("");
      setMessage("");
      setCategory("bug");
      setPriority("normal");
      toast.success("Feedback submitted");
      await onSubmitted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit feedback");
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-sidebar/70 p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-white">Send feedback</h2>
        <p className="mt-1 text-xs text-white/45">
          Report an alpha bug, ask for help, or flag confusing behavior.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs text-white/60">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="border-white/10 bg-white/[0.03] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bug">Bug</SelectItem>
              <SelectItem value="account_sync">Account sync</SelectItem>
              <SelectItem value="ai">AI</SelectItem>
              <SelectItem value="ux">UX</SelectItem>
              <SelectItem value="idea">Idea</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-white/60">Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="border-white/10 bg-white/[0.03] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Label className="text-xs text-white/60">Subject</Label>
        <Input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Short summary"
          className="border-white/10 bg-white/[0.03] text-white"
        />
      </div>

      <div className="mt-4 space-y-2">
        <Label className="text-xs text-white/60">Details</Label>
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="What happened, where did it happen, and what did you expect instead?"
          className="min-h-32 border-white/10 bg-white/[0.03] text-white"
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-white/40">
          Current page: <span className="text-white/60">{pagePath}</span>
        </p>
        <Button
          onClick={handleSubmit}
          disabled={submitFeedback.isPending || !canSubmit}
          className="bg-white text-black hover:bg-white/90"
        >
          {submitFeedback.isPending ? "Submitting..." : "Submit feedback"}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import type { ChatMessage as ChatMessageType } from "./types";

interface ChatMessageProps {
  message: ChatMessageType;
  userImage?: string | null;
  userName?: string | null;
}

export function ChatMessage({
  message,
  userImage,
  userName,
}: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 p-4",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-medium",
          isUser
            ? "bg-blue-500/20 text-blue-400"
            : "bg-purple-500/20 text-purple-400"
        )}
      >
        {isUser ? (userName?.charAt(0) || "U") : "AI"}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          "flex-1 max-w-[80%] rounded-sm px-4 py-2",
          isUser
            ? "bg-blue-500/10 text-foreground"
            : "bg-muted text-foreground"
        )}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <p className="mb-2 last:mb-0">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="mb-2 pl-4 list-disc">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="mb-2 pl-4 list-decimal">{children}</ol>
                ),
                li: ({ children }) => <li className="mb-1">{children}</li>,
                strong: ({ children }) => (
                  <strong className="font-semibold">{children}</strong>
                ),
                code: ({ children }) => (
                  <code className="bg-muted px-1 py-0.5 rounded text-xs">
                    {children}
                  </code>
                ),
                pre: ({ children }) => (
                  <pre className="bg-muted p-3 rounded-lg overflow-x-auto my-2">
                    {children}
                  </pre>
                ),
                a: ({ children, href }) => (
                  <a
                    href={href}
                    className="text-blue-500 hover:underline"
                    target={href?.startsWith("http") ? "_blank" : undefined}
                    rel={
                      href?.startsWith("http")
                        ? "noopener noreferrer"
                        : undefined
                    }
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

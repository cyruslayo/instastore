// Server-only destination boundary. The real HTTP sender, credential loading,
// retry scheduling, and delivery table belong to the later activation task.
import type { MarketingEvent } from "@/lib/marketing/server/eligibility";

/**
 * accepted means the remote service accepted delivery. It never means a sale
 * was attributed or ads improved.
 */
export type SendResult = "disabled" | "ineligible" | "accepted" | "retryable_failure" | "permanent_failure";

export interface MarketingSender {
  name: string;
  send(event: MarketingEvent): Promise<SendResult>;
}

/** The only sender available in production today. It makes no network request. */
export const disabledSender: MarketingSender = {
  name: "disabled",
  async send() { return "disabled"; },
};

/** In-memory sender for tests. Never wire this into a route or production path. */
export function createFakeSender(result: SendResult = "accepted"): MarketingSender & { sent: MarketingEvent[] } {
  const sent: MarketingEvent[] = [];
  return {
    name: "fake",
    sent,
    async send(event) {
      sent.push(event);
      return result;
    },
  };
}

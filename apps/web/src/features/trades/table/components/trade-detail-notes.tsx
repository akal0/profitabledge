"use client";

import { EmotionTagger } from "@/components/dashboard/emotion-tagger";
import { TradeNotesEditor } from "@/components/trades/trade-notes-editor";

import { TradeDetailSection } from "./trade-detail-shared";

type TradeDetailNotesProps = {
  accountId: string | null;
  tradeId: string;
};

export function TradeDetailNotes({
  accountId,
  tradeId,
}: TradeDetailNotesProps) {
  return (
    <TradeDetailSection title="Notes" bodyClassName="space-y-5">
      <TradeNotesEditor tradeId={tradeId} />
      <EmotionTagger tradeId={tradeId} accountId={accountId} />
    </TradeDetailSection>
  );
}

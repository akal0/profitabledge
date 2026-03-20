import { router } from '../lib/trpc';
import { journalEntryProcedures } from './journal/entries';
import { journalInsightPromptProcedures } from './journal/insights-prompts';
import { journalSharesRouter } from './journal/shares';
import { journalTemplateMediaProcedures } from './journal/templates-media';

export const journalRouter = router({
  shares: journalSharesRouter,
  ...journalEntryProcedures,
  ...journalTemplateMediaProcedures,
  ...journalInsightPromptProcedures,
});

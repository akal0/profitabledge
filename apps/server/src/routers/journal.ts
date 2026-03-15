import { router } from '../lib/trpc';
import { journalEntryProcedures } from './journal/entries';
import { journalInsightPromptProcedures } from './journal/insights-prompts';
import { journalTemplateMediaProcedures } from './journal/templates-media';

export const journalRouter = router({
  ...journalEntryProcedures,
  ...journalTemplateMediaProcedures,
  ...journalInsightPromptProcedures,
});

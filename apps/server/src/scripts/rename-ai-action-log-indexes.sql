ALTER INDEX IF EXISTS ai_report_user_id_idx RENAME TO idx_ai_report_user_id;
ALTER INDEX IF EXISTS ai_report_account_id_idx RENAME TO idx_ai_report_account_id;
ALTER INDEX IF EXISTS ai_report_created_at_idx RENAME TO idx_ai_report_created_at;

ALTER INDEX IF EXISTS ai_chat_message_report_id_idx RENAME TO idx_ai_chat_message_report_id;
ALTER INDEX IF EXISTS ai_chat_message_created_at_idx RENAME TO idx_ai_chat_message_created_at;

ALTER INDEX IF EXISTS ai_action_log_user_id_idx RENAME TO idx_ai_action_log_user_id;
ALTER INDEX IF EXISTS ai_action_log_intent_idx RENAME TO idx_ai_action_log_intent;
ALTER INDEX IF EXISTS ai_action_log_status_idx RENAME TO idx_ai_action_log_status;
ALTER INDEX IF EXISTS ai_action_log_started_at_idx RENAME TO idx_ai_action_log_started_at;

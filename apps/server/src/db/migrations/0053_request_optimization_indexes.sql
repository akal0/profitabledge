CREATE INDEX IF NOT EXISTS "idx_trading_account_user"
ON "trading_account" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "idx_trading_account_user_prop"
ON "trading_account" USING btree ("user_id", "is_prop_account");

CREATE INDEX IF NOT EXISTS "idx_trading_account_prop_instance"
ON "trading_account" USING btree ("prop_challenge_instance_id");

CREATE INDEX IF NOT EXISTS "idx_trade_account_close_time"
ON "trade" USING btree ("account_id", "close_time");

CREATE INDEX IF NOT EXISTS "idx_trade_account_open_time"
ON "trade" USING btree ("account_id", "open_time");

CREATE INDEX IF NOT EXISTS "idx_platform_conn_user_created"
ON "platform_connection" USING btree ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_platform_conn_user_updated"
ON "platform_connection" USING btree ("user_id", "updated_at");

CREATE INDEX IF NOT EXISTS "idx_sync_log_connection_created"
ON "sync_log" USING btree ("connection_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_broker_deal_event_connection_time"
ON "broker_deal_event" USING btree ("connection_id", "event_time");

CREATE INDEX IF NOT EXISTS "idx_broker_order_event_connection_time"
ON "broker_order_event" USING btree ("connection_id", "event_time");

CREATE INDEX IF NOT EXISTS "idx_prop_alert_account_created"
ON "prop_alert" USING btree ("account_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_prop_alert_account_ack_created"
ON "prop_alert" USING btree ("account_id", "acknowledged", "created_at");

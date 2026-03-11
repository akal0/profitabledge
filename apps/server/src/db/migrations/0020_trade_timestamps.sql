ALTER TABLE trade ADD COLUMN open_time TIMESTAMP;
ALTER TABLE trade ADD COLUMN close_time TIMESTAMP;
CREATE INDEX idx_trade_open_time ON trade(open_time);
CREATE INDEX idx_trade_close_time ON trade(close_time);

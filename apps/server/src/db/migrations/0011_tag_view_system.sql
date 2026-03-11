-- Migration 0011: Generalized Tag & View System
-- Part 1: Enhance trade tagging system

-- 1. Rename existing killzone fields to sessionTag (more general terminology)
ALTER TABLE trade RENAME COLUMN killzone TO session_tag;
ALTER TABLE trade RENAME COLUMN killzone_color TO session_tag_color;

-- 2. Add strategy/model tagging
ALTER TABLE trade ADD COLUMN model_tag TEXT;
ALTER TABLE trade ADD COLUMN model_tag_color VARCHAR(7);

-- 3. Add protocol alignment tagging (factual, not judgmental)
ALTER TABLE trade ADD COLUMN protocol_alignment VARCHAR(20)
  CHECK (protocol_alignment IN ('aligned', 'against', 'discretionary', NULL));

-- 4. Add cached outcome field (for query performance)
ALTER TABLE trade ADD COLUMN outcome VARCHAR(8)
  CHECK (outcome IN ('Win', 'Loss', 'BE', 'PW', NULL));

-- 5. Add intent metrics (cached for performance)
ALTER TABLE trade ADD COLUMN planned_rr NUMERIC;  -- Initial TP/SL ratio
ALTER TABLE trade ADD COLUMN planned_risk_pips NUMERIC;  -- SL size in pips
ALTER TABLE trade ADD COLUMN planned_target_pips NUMERIC;  -- TP size in pips

-- Part 2: Create view system

-- 6. Create trade_view table (stores saved filter/column configurations)
CREATE TABLE trade_view (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,

  -- Metadata
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,  -- Optional emoji/icon for visual identification
  is_default BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,  -- User-defined order in view switcher

  -- View configuration (stored as JSONB for flexibility)
  config JSONB NOT NULL,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 7. Create indexes for performance
CREATE INDEX idx_trade_view_user ON trade_view(user_id);
CREATE INDEX idx_trade_view_sort ON trade_view(user_id, sort_order);
CREATE UNIQUE INDEX idx_trade_view_default ON trade_view(user_id)
  WHERE is_default = TRUE;  -- Only one default view per user

-- 8. Create indexes on new trade tag fields for filtering performance
CREATE INDEX idx_trade_session_tag ON trade(account_id, session_tag)
  WHERE session_tag IS NOT NULL;
CREATE INDEX idx_trade_model_tag ON trade(account_id, model_tag)
  WHERE model_tag IS NOT NULL;
CREATE INDEX idx_trade_protocol_alignment ON trade(account_id, protocol_alignment)
  WHERE protocol_alignment IS NOT NULL;
CREATE INDEX idx_trade_outcome ON trade(account_id, outcome)
  WHERE outcome IS NOT NULL;

-- 9. Add metric sample gate preferences to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS sample_gate_preferences JSONB DEFAULT '{
  "disableAllGates": false,
  "minimumSamples": {
    "basic": 0,
    "intermediate": 30,
    "advanced": 100,
    "statistical": 200
  }
}'::jsonb;

-- 10. Seed default views for existing users
-- This will be handled by a separate seed script to allow for easier customization

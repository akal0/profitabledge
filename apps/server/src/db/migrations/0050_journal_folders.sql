ALTER TABLE "journal_entry"
ADD COLUMN "item_type" varchar(16) DEFAULT 'entry' NOT NULL,
ADD COLUMN "folder_id" text;

CREATE INDEX "idx_journal_entry_user_item_type"
ON "journal_entry" USING btree ("user_id", "item_type");

CREATE INDEX "idx_journal_entry_folder"
ON "journal_entry" USING btree ("user_id", "folder_id");

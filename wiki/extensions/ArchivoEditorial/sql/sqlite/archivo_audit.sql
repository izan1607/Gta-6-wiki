CREATE TABLE /*_*/archivo_audit (
  aea_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  aea_draft INTEGER NOT NULL,
  aea_actor INTEGER NOT NULL,
  aea_timestamp BLOB NOT NULL,
  aea_action BLOB NOT NULL,
  aea_note BLOB NOT NULL
);
CREATE INDEX /*i*/aea_draft_time ON /*_*/archivo_audit (aea_draft, aea_timestamp);

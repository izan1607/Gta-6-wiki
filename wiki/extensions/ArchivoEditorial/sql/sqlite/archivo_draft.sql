CREATE TABLE /*_*/archivo_draft (
  aed_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  aed_title BLOB NOT NULL,
  aed_content BLOB NOT NULL,
  aed_status BLOB NOT NULL,
  aed_user INTEGER NOT NULL,
  aed_created BLOB NOT NULL,
  aed_updated BLOB NOT NULL,
  aed_reviewer INTEGER NOT NULL DEFAULT 0,
  aed_note BLOB NOT NULL,
  aed_base_rev INTEGER NOT NULL DEFAULT 0,
  aed_published_rev INTEGER NOT NULL DEFAULT 0,
  aed_version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX /*i*/aed_owner_updated ON /*_*/archivo_draft (aed_user, aed_updated);
CREATE INDEX /*i*/aed_status_updated ON /*_*/archivo_draft (aed_status, aed_updated);

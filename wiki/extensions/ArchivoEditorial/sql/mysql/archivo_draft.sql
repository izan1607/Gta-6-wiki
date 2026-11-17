CREATE TABLE /*_*/archivo_draft (
  aed_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  aed_title VARBINARY(255) NOT NULL,
  aed_content MEDIUMBLOB NOT NULL,
  aed_status VARBINARY(16) NOT NULL,
  aed_user BIGINT UNSIGNED NOT NULL,
  aed_created BINARY(14) NOT NULL,
  aed_updated BINARY(14) NOT NULL,
  aed_reviewer BIGINT UNSIGNED NOT NULL DEFAULT 0,
  aed_note BLOB NOT NULL,
  aed_base_rev BIGINT UNSIGNED NOT NULL DEFAULT 0,
  aed_published_rev BIGINT UNSIGNED NOT NULL DEFAULT 0,
  aed_version INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (aed_id),
  KEY aed_owner_updated (aed_user, aed_updated),
  KEY aed_status_updated (aed_status, aed_updated)
) /*$wgDBTableOptions*/;

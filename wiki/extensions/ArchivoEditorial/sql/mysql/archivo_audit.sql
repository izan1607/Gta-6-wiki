CREATE TABLE /*_*/archivo_audit (
  aea_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  aea_draft BIGINT UNSIGNED NOT NULL,
  aea_actor BIGINT UNSIGNED NOT NULL,
  aea_timestamp BINARY(14) NOT NULL,
  aea_action VARBINARY(32) NOT NULL,
  aea_note BLOB NOT NULL,
  PRIMARY KEY (aea_id),
  KEY aea_draft_time (aea_draft, aea_timestamp)
) /*$wgDBTableOptions*/;

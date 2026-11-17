<?php
namespace ArchivoEditorial;

use MediaWiki\Api\ApiBase;
use MediaWiki\Content\TextContent;
use MediaWiki\MediaWikiServices;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Revision\SlotRecord;
use MediaWiki\Title\Title;

/** Anonymous, read-only snapshot of current public main-namespace revisions. */
final class ApiExport extends ApiBase {
    public function execute(): void {
        $params = $this->extractRequestParams();
        $services = MediaWikiServices::getInstance();
        $anonymous = $services->getUserFactory()->newAnonymous();
        $db = $services->getDBLoadBalancer()->getConnection( DB_REPLICA );
        $rows = $db->select( 'page', [ 'page_id', 'page_title', 'page_latest' ],
            [ 'page_namespace' => NS_MAIN, 'page_is_redirect' => 0,
                $db->buildComparison( '>', [ 'page_id' => $params['from'] ] ) ],
            __METHOD__, [ 'ORDER BY' => 'page_id', 'LIMIT' => $params['limit'] + 1 ] );
        $articles = [];
        $next = null;
        foreach ( $rows as $row ) {
            if ( count( $articles ) >= $params['limit'] ) {
                $next = (int)$articles[count( $articles ) - 1]['pageid'];
                break;
            }
            $title = Title::makeTitle( NS_MAIN, $row->page_title );
            // Apply public visibility checks, including suppressed/deleted revision content.
            if ( !$services->getPermissionManager()->userCan( 'read', $anonymous, $title ) ) {
                continue;
            }
            $rev = $services->getRevisionLookup()->getRevisionById( (int)$row->page_latest );
            if ( !$rev || !$rev->audienceCan( RevisionRecord::DELETED_TEXT, RevisionRecord::FOR_PUBLIC ) ) {
                continue;
            }
            $content = $rev->getContent( SlotRecord::MAIN, RevisionRecord::FOR_PUBLIC );
            if ( !$content instanceof TextContent || $content->getModel() !== CONTENT_MODEL_WIKITEXT ) {
                continue;
            }
            $articles[] = [
                'pageid' => (int)$row->page_id, 'title' => $title->getText(),
                'content' => $content->getText(), 'revision' => (int)$rev->getId(),
                'timestamp' => wfTimestamp( TS_ISO_8601, $rev->getTimestamp() ),
                'url' => $title->getFullURL()
            ];
        }
        $result = [ 'articles' => $articles, 'generatedAt' => wfTimestamp( TS_ISO_8601 ),
            'license' => 'Consult the site editorial license; third-party marks retain their owners.' ];
        if ( $next !== null ) {
            $result['next'] = $next;
        }
        $this->getResult()->addValue( null, 'archivoexport', $result );
        $this->getResult()->addIndexedTagName( [ 'archivoexport', 'articles' ], 'article' );
    }

    public function getAllowedParams(): array {
        return [
            'from' => [ self::PARAM_TYPE => 'integer', self::PARAM_DFLT => 0, self::PARAM_MIN => 0 ],
            'limit' => [ self::PARAM_TYPE => 'integer', self::PARAM_DFLT => 50,
                self::PARAM_MIN => 1, self::PARAM_MAX => 100 ]
        ];
    }

    public function isWriteMode(): bool { return false; }
    public function getCacheMode(): string { return 'public'; }
}

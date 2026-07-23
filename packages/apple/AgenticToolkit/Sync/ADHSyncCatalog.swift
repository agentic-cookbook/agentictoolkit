import Foundation

/// The adh backend's sync catalog, mirrored client-side. Source of truth:
/// `SYNC_REGISTRY` in the adh backend (`backend/src/adh/src/sync/registry.ts`,
/// derived from the DB schema). Generated 2026-07-22 against adh main
/// `64825b107`; regenerate from an adh checkout with the codegen tool (which
/// re-emits this file AND runs the semantic-drift check that fails if the
/// checked-in catalog no longer matches `SYNC_REGISTRY`):
///
///     python3 tools/codegen/generate.py sync-catalog
///
/// Keep the "Generated … against adh main `<sha>`" provenance line above in
/// sync with the checkout you regenerated from.
///
/// The catalog is client knowledge, not authority: the server's manifest gates
/// what actually syncs, and its push results remain the backstop when this
/// list is stale. `pullOnly` mirrors `pushMode: 'route'` — resources whose
/// writes stay on bespoke routes; staging a local mutation for one is refused.
public enum ADHSyncCatalog {
    /// Every catalog resource (79 as of adh `64825b107`), all schemaVersion 1.
    public static let all: [SyncResource] = [
        "bucket.bucket_types", "bucket.buckets",
        "chat.chat_mentions", "chat.chat_messages", "chat.chat_participants",
        "chat.chat_plugins", "chat.chat_rich_content", "chat.chats",
        "content.addresses", "content.attachments", "content.bookmarks",
        "content.categories", "content.category_items", "content.contacts",
        "content.counters", "content.dates", "content.events", "content.feed",
        "content.feedback", "content.key_value_pairs", "content.keyword_items",
        "content.keywords", "content.list_items", "content.lists",
        "content.locations", "content.markdown", "content.notes",
        "content.papers", "content.poll_options", "content.poll_votes",
        "content.polls", "content.queue_items", "content.queues",
        "content.reactions", "content.relationships", "content.social_links",
        "content.tags", "content.urls",
        "customer.customers",
        "discussion.community_members", "discussion.posts", "discussion.topics",
        "document.blocks", "document.documents", "document.marks",
        "document.operations", "document.versions",
        "ecosystem.applications",
        "integration.integration_bookmarks", "integration.integration_calendar_events",
        "integration.integration_email_messages",
        "integration.integration_financial_transactions", "integration.integration_items",
        "integration.integration_media_items", "integration.integration_pages",
        "integration.integration_social_notifications",
        "notification.notifications",
        "persona_memory.blocks", "persona_memory.facts", "persona_memory.links",
        "persona_memory.memories",
        "personal.education", "personal.jobs",
        "project.activity", "project.artifacts", "project.fields",
        "project.participants", "project.projects", "project.research_projects",
        "project.statuses", "project.tasks", "project.work_item_dependencies",
        "project.work_item_field_values", "project.work_items",
        "settings.appearance", "settings.communication", "settings.notifications",
        "social.follows", "social.user_blocks"
    ].map { SyncResource(resource: $0, schemaVersion: 1) }

    /// `pushMode: 'route'` resources (27): pull-only over /sync/push — their
    /// writes belong to bespoke routes whose invariants a generic writer would
    /// bypass. The server answers a push for one with rejected/route_only.
    public static let pullOnly: Set<String> = [
        "content.attachments", "content.bookmarks", "content.feed",
        "content.markdown", "content.notes", "content.papers",
        "content.poll_votes", "content.reactions",
        "discussion.community_members", "discussion.posts", "discussion.topics",
        "integration.integration_email_messages",
        "notification.notifications",
        "project.activity", "project.artifacts", "project.fields",
        "project.participants", "project.projects", "project.research_projects",
        "project.statuses", "project.work_item_dependencies",
        "project.work_item_field_values", "project.work_items",
        "settings.appearance", "settings.communication",
        "social.follows", "social.user_blocks"
    ]
}

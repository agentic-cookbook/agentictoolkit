import { type ReactElement, type ReactNode } from "react";
/**
 * The Messaging compose form + log, once, for both scopes that have one.
 *
 * There are two messaging BACKENDS — `/messaging/{status,log,send}` (admin, platform-wide)
 * and `/messaging/ecosystems/:id/{status,log,send}` (one product's own Postmark/Twilio) —
 * and they answer with the SAME OpenAPI components (`MessagingStatus`, `MessagingLogPage`,
 * `MessagingTemplate`), so the only thing that differed between the two screens was which
 * URL the hooks called. That difference stays with each host; everything a reader sees
 * lives here. The two used to be forked copies, and had already drifted apart in four ways
 * (docs/ui/fleet-ui-audit.md, Tier 6).
 *
 * The data arrives as plain props rather than as hooks this module calls, because the query
 * keys, the enabled-conditions and the invalidation are the host's — and because a hook prop
 * would make the number of hooks this component runs depend on which host mounted it.
 *
 * Unrelated to `@agentic-toolkit/messaging`, which is in-app messaging between users
 * (notifications, DMs, presence). This is the OUTBOUND tool: email/SMS to a person, through
 * a Postmark/Twilio account, with a log of what was sent.
 */
/** Whether each channel's provider is connected. Structural subset of `MessagingStatus`. */
export interface MessagingProviderStatus {
    email: boolean;
    sms: boolean;
}
/** Structural subset of `MessagingTemplate` — the fields the form reads or substitutes into. */
export interface MessagingTemplateSummary {
    id: string;
    name: string;
    subject: string;
    htmlBody: string;
    textBody: string;
    smsBody?: string | null;
}
/** Structural subset of `MessagingLogEntry` — the five columns the log shows. */
export interface MessagingLogRow {
    id: string;
    channel: string;
    recipient: string;
    subject?: string | null;
    status: string;
    createdAt?: string | null;
}
/** Structural subset of `MessagingLogPage`. `total` + `pageSize` are what bound the pager. */
export interface MessagingLogPageData {
    items: MessagingLogRow[];
    total: number;
    pageSize: number;
}
/**
 * What the form hands back on submit. Assignable to BOTH backends' request bodies — they
 * declare the same seven fields — so each host passes it straight to its own mutation and
 * the compiler is what checks that claim stays true.
 */
export interface SendMessageDraft {
    userId: string;
    channel: "email" | "sms";
    recipient?: string;
    subject?: string;
    body?: string;
    templateId?: string;
    templateVars?: Record<string, string>;
}
export interface MessagingSurfaceProps {
    /** The provider-status query, already scoped by the host. */
    status: {
        data?: MessagingProviderStatus;
        isLoading: boolean;
        isError: boolean;
    };
    /** The shared static template list; `undefined` while it loads. */
    templates: readonly MessagingTemplateSummary[] | undefined;
    /** The send mutation. `mutate` is called with a draft assignable to the host's request body. */
    send: {
        mutate: (draft: SendMessageDraft, options?: {
            onSuccess?: () => void;
        }) => void;
        isPending: boolean;
        isSuccess: boolean;
        isError: boolean;
    };
    /** The message-log page query for `page`. */
    log: {
        data?: MessagingLogPageData;
        isLoading: boolean;
    };
    /** Current log page (1-based). Held by the host because its log query is keyed on it. */
    page: number;
    onPageChange: (page: number) => void;
    /**
     * Whether there is a target to send to at all. `false` means the host has no scope yet
     * (its queries are disabled), so the Send button is disabled and no provider banner shows —
     * "not connected" would be a claim about a product nobody has chosen. Defaults to true.
     */
    enabled?: boolean;
    /** Caption for the recipient's account id — the word differs by scope. Defaults to "Customer ID". */
    userIdLabel?: ReactNode;
    /** How to connect the missing provider. The route differs by scope, so the host says it. */
    providerSetupHint: (channel: "email" | "sms") => ReactNode;
    /** Rendered beside the "Send Message" heading — e.g. a help popover. */
    headerAccessory?: ReactNode;
    /** Called whenever the compose form gains or loses typed work an exit would discard. */
    onDirtyChange?: (dirty: boolean) => void;
}
export declare function MessagingSurface({ status, templates, send, log, page, onPageChange, enabled, userIdLabel, providerSetupHint, headerAccessory, onDirtyChange, }: MessagingSurfaceProps): ReactElement;
//# sourceMappingURL=MessagingSurface.d.ts.map
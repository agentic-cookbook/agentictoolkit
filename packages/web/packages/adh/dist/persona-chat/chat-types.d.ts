export interface ChatParticipant {
    name: string;
    avatar?: string;
}
export interface LinkContent {
    type: 'link';
    url: string;
    label?: string;
}
export interface ImageContent {
    type: 'image';
    src: string;
    alt?: string;
}
export type ContentItem = LinkContent | ImageContent;
export interface PopoverData {
    title: string;
    description?: string;
    links?: Array<{
        label: string;
        url: string;
    }>;
}
export interface ToolCallInfo {
    name: string;
    arguments: string;
    status: 'started' | 'completed' | 'failed';
    result?: string;
    ok?: boolean;
}
export interface ChatMessage {
    id: string;
    sender: ChatParticipant;
    text: string;
    content?: ContentItem[];
    popover?: PopoverData;
    toolCalls?: ToolCallInfo[];
    timestamp: Date;
    isPersona: boolean;
    isStreaming?: boolean;
    /**
     * Why this message did not make it, when it did not. Present means failed.
     *
     * The contract reports a rejected send as `deliveryStatus: { kind: 'failed' }`
     * on the sender's own message, which is the honest place for it — the turn
     * produced no reply to attach an apology to. Without a field here the
     * failure reaches the transcript and renders as nothing at all: an outgoing
     * bubble sitting there with no answer and no explanation.
     */
    failure?: string;
}
export type ChatResponse = string | {
    text: string;
    content?: ContentItem[];
    popover?: PopoverData;
};
export type ChatStreamEvent = {
    type: 'token';
    text: string;
} | {
    type: 'tool_call_started';
    name: string;
    arguments: string;
} | {
    type: 'tool_call_completed';
    name: string;
    ok: boolean;
    result: string;
} | {
    type: 'content';
    items: ContentItem[];
} | {
    type: 'popover';
    data: PopoverData;
} | {
    type: 'done';
} | {
    type: 'error';
    message: string;
};
export interface ChatBackend {
    sendMessage(text: string, history: ChatMessage[]): Promise<ChatResponse>;
    /**
     * Optional streaming variant. When present, useChatSession prefers it over
     * sendMessage so the UI can show token-by-token updates and tool-call events.
     *
     * Implementations should yield events in order and end with a `done` or
     * `error` event. Honor the AbortSignal if provided.
     */
    sendMessageStream?(text: string, history: ChatMessage[], signal?: AbortSignal): AsyncIterable<ChatStreamEvent>;
    destroy?(): void;
}
//# sourceMappingURL=chat-types.d.ts.map
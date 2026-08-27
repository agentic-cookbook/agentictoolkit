import type { TopicLevel } from '@agentic-toolkit/ui/blocks';
import type { DebugConsoleChatTheme } from './DebugConsoleProvider';
/** Build the chat-themes rail level. Selecting a row applies that theme immediately. */
export declare function buildChatThemeLevel(chat: DebugConsoleChatTheme): TopicLevel;
/** Leaf detail: a live preview of the active chat theme on a sample chat surface. */
export declare function ChatThemePreview({ chat }: {
    chat: DebugConsoleChatTheme;
}): import("react").JSX.Element;
//# sourceMappingURL=ChatThemePanel.d.ts.map
/** @deprecated Use the React components instead: import { InlineChat, MockBackend } from './index' */
declare class PersonaChat {
  constructor(options: Record<string, unknown>);
  addMessage(sender: unknown, message: string): void;
  destroy(): void;
  static CANNED_RESPONSES: Record<string, () => object | string>;
}
export default PersonaChat;

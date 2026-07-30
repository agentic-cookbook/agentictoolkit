// Ambient declaration so TypeScript accepts side-effect CSS imports. The footer
// chat (FooterChatInner) imports the chat package's stylesheet so it ships with
// the lazy chat chunk instead of the always-loaded shared stylesheet.
declare module '*.css'

import type { ChatBackend } from './types'
import type { ChatMessage, ChatResponse } from '../types'

export type ResponseMap = Record<string, ChatResponse | (() => ChatResponse)>

const DEFAULT_RESPONSES: ResponseMap = {
  hello: () => 'Hey there! Try: small panel, big panel, small image, big image, links, or text.',
  text: () => 'Just a plain text reply with no panels or extras.',
  'small panel': () => ({
    text: 'Here are some quick links for you.',
    content: [{ type: 'link', url: 'https://example.com/intro', label: 'Intro guide' }],
    popover: {
      title: 'Quick Reference',
      description: 'A concise overview of the key concepts.',
      links: [{ label: 'Read more', url: 'https://example.com/intro' }],
    },
  }),
  'big panel': () => ({
    text: 'This one has a lot more to say.',
    content: [
      { type: 'link', url: 'https://example.com/arch', label: 'Architecture' },
      { type: 'link', url: 'https://example.com/api', label: 'API Reference' },
      { type: 'link', url: 'https://example.com/deploy', label: 'Deployment' },
    ],
    popover: {
      title: 'System Architecture Deep Dive',
      description:
        'The platform follows a modular microservices architecture with event-driven communication. Each service owns its data store and exposes a well-defined API contract. The message bus handles async workflows while the API gateway manages synchronous request routing. Deployment is fully containerized with Kubernetes orchestration across three availability zones. Observability is built in via structured logging, distributed tracing, and real-time metrics dashboards.',
      links: [
        { label: 'Architecture overview', url: 'https://example.com/arch' },
        { label: 'API reference', url: 'https://example.com/api' },
        { label: 'Deployment guide', url: 'https://example.com/deploy' },
        { label: 'Monitoring setup', url: 'https://example.com/monitoring' },
        { label: 'Runbook', url: 'https://example.com/runbook' },
      ],
    },
  }),
  'small image': () => ({
    text: 'Here is a small preview image.',
    content: [{ type: 'image', src: 'https://picsum.photos/160/100', alt: 'small preview' }],
    popover: {
      title: 'Thumbnail Preview',
      description: 'A compact image preview.',
      links: [{ label: 'Full gallery', url: 'https://example.com/gallery' }],
    },
  }),
  'big image': () => ({
    text: 'Check out this full-width screenshot.',
    content: [{ type: 'image', src: 'https://picsum.photos/600/400', alt: 'full screenshot' }],
    popover: {
      title: 'Dashboard Screenshot',
      description:
        'This shows the main monitoring dashboard with real-time metrics, alert status, and service health indicators across the full deployment.',
      links: [
        { label: 'Live dashboard', url: 'https://example.com/dashboard' },
        { label: 'Screenshot archive', url: 'https://example.com/screenshots' },
      ],
    },
  }),
  links: () => ({
    text: 'Here are a bunch of useful resources.',
    popover: {
      title: 'Resource Collection',
      description: 'Curated links covering documentation, tutorials, and community resources.',
      links: [
        { label: 'Getting started', url: 'https://example.com/start' },
        { label: 'Tutorial series', url: 'https://example.com/tutorials' },
        { label: 'API playground', url: 'https://example.com/playground' },
        { label: 'Community forum', url: 'https://example.com/forum' },
        { label: 'GitHub repo', url: 'https://example.com/github' },
        { label: 'Discord server', url: 'https://example.com/discord' },
      ],
    },
  }),
}

export interface MockBackendOptions {
  responses?: ResponseMap
  delayMs?: number | [min: number, max: number]
}

export class MockBackend implements ChatBackend {
  private responses: ResponseMap
  private delayMs: number | [number, number]

  constructor(options: MockBackendOptions = {}) {
    this.responses = { ...DEFAULT_RESPONSES, ...options.responses }
    this.delayMs = options.delayMs ?? [400, 1200]
  }

  async sendMessage(text: string, _history: ChatMessage[]): Promise<ChatResponse> {
    const delay =
      typeof this.delayMs === 'number'
        ? this.delayMs
        : this.delayMs[0] + Math.random() * (this.delayMs[1] - this.delayMs[0])

    await new Promise((resolve) => setTimeout(resolve, delay))

    const key = text.toLowerCase().trim()
    const entry = this.responses[key]

    if (entry !== undefined) {
      return typeof entry === 'function' ? entry() : entry
    }

    const commands = Object.keys(this.responses).join(', ')
    return `I don't know that one. Try: ${commands}`
  }
}

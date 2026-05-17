/**
 * @deprecated Use the React components instead: import { InlineChat, MockBackend } from './index'
 * This vanilla JS class is kept for backward compatibility during migration.
 *
 * PersonaChat - Reusable chat widget for AI persona conversations.
 *
 * Usage:
 *   const chat = new PersonaChat({
 *     container: document.getElementById('chat'),
 *     persona: { name: 'Ada', avatar: 'A' },
 *     user: { name: 'You', avatar: 'Y' },
 *     welcomeMessage: 'Hello! How can I help you today?',
 *     onSend: async (message) => { return 'response'; }
 *   });
 */
class PersonaChat {
  constructor(options) {
    this.container = options.container;
    this.persona = options.persona;
    this.user = options.user || { name: 'You', avatar: 'Y' };
    this.onSend = options.onSend || this._defaultResponder.bind(this);
    this.onPopover = options.onPopover || null;
    this.messages = [];
    this._sendQueue = [];
    this._processing = false;
    this._build();
    if (options.welcomeMessage) {
      this.addMessage(this.persona, options.welcomeMessage);
    }
  }

  _build() {
    this.container.classList.add('persona-chat');

    this.transcript = document.createElement('div');
    this.transcript.className = 'pc-transcript';

    const inputArea = document.createElement('div');
    inputArea.className = 'pc-input-area';

    this.input = document.createElement('input');
    this.input.className = 'pc-input';
    this.input.type = 'text';
    this.input.inputMode = 'text';
    this.input.placeholder = 'Type a message...';
    this.input.autocomplete = 'off';
    this.input.setAttribute('enterkeyhint', 'send');

    this.sendBtn = document.createElement('button');
    this.sendBtn.className = 'pc-send-btn';
    this.sendBtn.setAttribute('aria-label', 'Send');
    // Send icon (paper plane)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '22'); line.setAttribute('y1', '2');
    line.setAttribute('x2', '11'); line.setAttribute('y2', '13');
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '22 2 15 22 11 13 2 9 22 2');
    svg.appendChild(line);
    svg.appendChild(polygon);
    this.sendBtn.appendChild(svg);

    inputArea.appendChild(this.input);
    inputArea.appendChild(this.sendBtn);

    this.container.appendChild(this.transcript);
    this.container.appendChild(inputArea);

    this.sendBtn.addEventListener('click', () => this._handleSend());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._handleSend();
      }
    });
  }

  addMessage(sender, text) {
    const isPersona = sender === this.persona;
    const msg = { sender, text, time: new Date(), isPersona };
    this.messages.push(msg);

    const el = document.createElement('div');
    el.className = `pc-message ${isPersona ? 'pc-persona' : 'pc-user'}`;

    const bubble = document.createElement('div');
    bubble.className = 'pc-bubble';

    const textEl = document.createElement('div');
    textEl.className = 'pc-text';
    textEl.textContent = text;

    const timeEl = document.createElement('div');
    timeEl.className = 'pc-time';
    timeEl.textContent = this._formatTime(msg.time);

    bubble.appendChild(textEl);
    bubble.appendChild(timeEl);

    el.appendChild(bubble);

    this.transcript.appendChild(el);
    this._scrollToBottom();
    return el;
  }

  addTypingIndicator() {
    const el = document.createElement('div');
    el.className = 'pc-message pc-persona pc-typing';

    const bubble = document.createElement('div');
    bubble.className = 'pc-bubble';

    const dots = document.createElement('div');
    dots.className = 'pc-dots';
    for (let i = 0; i < 3; i++) {
      dots.appendChild(document.createElement('span'));
    }

    bubble.appendChild(dots);
    el.appendChild(bubble);

    this.transcript.appendChild(el);
    this._scrollToBottom();
    return el;
  }

  removeTypingIndicator(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  _handleSend() {
    const text = this.input.value.trim();
    if (!text) return;

    this.input.value = '';
    this.addMessage(this.user, text);
    this._sendQueue.push(text);
    this._processQueue();
  }

  async _processQueue() {
    if (this._processing || this._sendQueue.length === 0) return;
    this._processing = true;

    while (this._sendQueue.length > 0) {
      const text = this._sendQueue.shift();
      const typing = this.addTypingIndicator();

      try {
        const response = await this.onSend(text);
        this.removeTypingIndicator(typing);
        if (response) {
          if (typeof response === 'string') {
            this.addMessage(this.persona, response);
          } else if (typeof response === 'object') {
            const el = this.addMessage(this.persona, response.text || '');
            if (response.content && response.content.length) {
              this._renderContent(el.querySelector('.pc-bubble'), response.content);
            }
            if (response.popover) {
              if (this.onPopover) {
                this.onPopover(el, response.popover, response.content || []);
              } else {
                this._renderPopover(el, response.popover);
              }
            }
          }
        }
      } catch (err) {
        this.removeTypingIndicator(typing);
        this.addMessage(this.persona, "Sorry, something went wrong. Let's try again.");
      }
    }

    this._processing = false;
  }

  _defaultResponder(message) {
    const key = message.toLowerCase().trim();
    const canned = PersonaChat.CANNED_RESPONSES[key];
    if (canned) {
      return new Promise((resolve) => {
        const delay = 400 + Math.random() * 800;
        setTimeout(() => resolve(typeof canned === 'function' ? canned() : canned), delay);
      });
    }

    const commands = Object.keys(PersonaChat.CANNED_RESPONSES).join(', ');
    return new Promise((resolve) => {
      const delay = 400 + Math.random() * 800;
      setTimeout(() => {
        resolve(`I don't know that one. Try: ${commands}`);
      }, delay);
    });
  }

  _renderContent(bubble, contentItems) {
    const contentEl = document.createElement('div');
    contentEl.className = 'pc-content';

    contentItems.forEach(item => {
      if (item.type === 'link') {
        const a = document.createElement('a');
        a.className = 'pc-content-link';
        a.href = item.url;
        a.textContent = item.label || item.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        contentEl.appendChild(a);
      } else if (item.type === 'image') {
        const img = document.createElement('img');
        img.className = 'pc-content-image';
        img.src = item.src;
        img.alt = item.alt || '';
        contentEl.appendChild(img);
      }
    });

    const timeEl = bubble.querySelector('.pc-time');
    bubble.insertBefore(contentEl, timeEl);
    contentEl.appendChild(timeEl);
  }

  _renderPopover(messageEl, popoverData) {
    messageEl.classList.add('pc-has-popover');

    const popover = document.createElement('div');
    popover.className = 'pc-popover pc-popover-open';
    popover.setAttribute('aria-hidden', 'false');

    const toggle = document.createElement('button');
    toggle.className = 'pc-popover-toggle';
    toggle.setAttribute('aria-label', 'Toggle details');

    const arrow = document.createElement('span');
    arrow.className = 'pc-popover-arrow';
    toggle.appendChild(arrow);

    if (popoverData.title) {
      const titleSpan = document.createElement('span');
      titleSpan.className = 'pc-popover-title';
      titleSpan.textContent = popoverData.title;
      toggle.appendChild(titleSpan);
    }

    popover.appendChild(toggle);

    const body = document.createElement('div');
    body.className = 'pc-popover-body';

    if (popoverData.description) {
      const desc = document.createElement('div');
      desc.className = 'pc-popover-desc';
      desc.textContent = popoverData.description;
      body.appendChild(desc);
    }

    if (popoverData.links && popoverData.links.length) {
      const linksContainer = document.createElement('div');
      linksContainer.className = 'pc-popover-links';
      popoverData.links.forEach(linkData => {
        const a = document.createElement('a');
        a.className = 'pc-popover-link';
        a.href = linkData.url;
        a.textContent = linkData.label || linkData.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        linksContainer.appendChild(a);
      });
      body.appendChild(linksContainer);
    }

    popover.appendChild(body);

    // Insert as a transcript element right after the message
    messageEl.after(popover);

    toggle.addEventListener('click', () => {
      popover.classList.toggle('pc-popover-open');
      const open = popover.classList.contains('pc-popover-open');
      popover.setAttribute('aria-hidden', open ? 'false' : 'true');
    });

    this._scrollToBottom();
  }

  _scrollToBottom() {
    requestAnimationFrame(() => {
      this.transcript.scrollTop = this.transcript.scrollHeight;
    });
  }

  _formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

PersonaChat.CANNED_RESPONSES = {
  'hello': () => "Hey there! Try: small panel, big panel, small image, big image, links, or text.",
  'text': () => 'Just a plain text reply with no panels or extras.',
  'small panel': () => ({
    text: 'Here are some quick links for you.',
    content: [
      { type: 'link', url: 'https://example.com/intro', label: 'Intro guide' },
    ],
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
    content: [
      { type: 'image', src: 'https://picsum.photos/160/100', alt: 'small preview' },
    ],
    popover: {
      title: 'Thumbnail Preview',
      description: 'A compact image preview.',
      links: [{ label: 'Full gallery', url: 'https://example.com/gallery' }],
    },
  }),
  'big image': () => ({
    text: 'Check out this full-width screenshot.',
    content: [
      { type: 'image', src: 'https://picsum.photos/600/400', alt: 'full screenshot' },
    ],
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
  'links': () => ({
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
};

export default PersonaChat;

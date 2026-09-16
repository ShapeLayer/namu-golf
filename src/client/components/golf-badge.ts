/** 알약 모양 배지. tone: blue | green | yellow | orange | gray | red */
class GolfBadge extends HTMLElement {
  private root = this.attachShadow({ mode: "open" });
  connectedCallback(): void {
    this.root.innerHTML = `
      <style>
        :host { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; line-height: 1.4; white-space: nowrap; background: var(--gray-bg); color: var(--gray-fg); }
        :host([tone="blue"]) { background: var(--blue-bg); color: var(--blue-fg); }
        :host([tone="green"]) { background: var(--green-bg); color: var(--green-fg); }
        :host([tone="yellow"]) { background: var(--yellow-bg); color: var(--yellow-fg); }
        :host([tone="orange"]) { background: var(--orange-bg); color: var(--orange-fg); }
        :host([tone="red"]) { background: var(--red-bg); color: var(--red-fg); }
        :host([outline]) { background: transparent; border: 1px solid var(--border); }
      </style><slot></slot>`;
  }
}
customElements.define("golf-badge", GolfBadge);

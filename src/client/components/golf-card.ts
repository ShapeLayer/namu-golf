/** 흰 배경의 둥근 카드. `heading` 속성과 `action` 슬롯을 가진다. */
class GolfCard extends HTMLElement {
  static observedAttributes = ["heading"];
  private root = this.attachShadow({ mode: "open" });

  connectedCallback(): void {
    this.root.innerHTML = `
      <style>
        :host { display: flex; flex-direction: column; min-height: 0; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
        header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--border); }
        h2 { margin: 0; font-size: 15px; font-weight: 700; }
        header:has(h2:empty) { display: none; }
        .body { flex: 1; min-height: 0; overflow: auto; padding: 10px 12px; }
        :host([flush]) .body { padding: 0; overflow: hidden; }
        @media (max-width: 900px) {
          header { padding: 7px 8px; }
          .body { padding: 7px 8px; }
        }
      </style>
      <header><h2></h2><slot name="action"></slot></header>
      <div class="body"><slot></slot></div>`;
    this.syncHeading();
  }

  attributeChangedCallback(): void {
    this.syncHeading();
  }

  private syncHeading(): void {
    const h2 = this.root.querySelector("h2");
    if (h2) h2.textContent = this.getAttribute("heading") ?? "";
  }
}
customElements.define("golf-card", GolfCard);

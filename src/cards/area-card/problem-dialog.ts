import { LitElement, css, html, type TemplateResult } from "lit";
import { property } from "lit/decorators.js";
import { fireEvent, type HomeAssistant } from "custom-card-helpers";
import { DIALOG_TAG } from "./types";

export class AreaCardProblemDialog extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property({ attribute: false }) entityIds: string[] = [];

  static styles = css`
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
      cursor: pointer;
    }
  `;

  private _close(): void {
    this.dispatchEvent(new CustomEvent("closed", { bubbles: true, composed: true }));
  }

  private _openMoreInfo(entityId: string): void {
    fireEvent(this, "hass-more-info", { entityId });
  }

  protected render(): TemplateResult {
    const hass = this.hass;
    return html`
      <ha-dialog open heading="Problems" @closed=${this._close}>
        ${this.entityIds.map((id) => {
          const state = hass?.states[id];
          return html`
            <div class="row" @click=${() => this._openMoreInfo(id)}>
              <ha-state-icon .hass=${hass} .stateObj=${state}></ha-state-icon>
              <span>${state?.attributes.friendly_name ?? id}</span>
            </div>
          `;
        })}
      </ha-dialog>
    `;
  }
}

if (!customElements.get(DIALOG_TAG)) {
  customElements.define(DIALOG_TAG, AreaCardProblemDialog);
}

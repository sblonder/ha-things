import { LitElement, html, type TemplateResult } from "lit";
import { state } from "lit/decorators.js";
import type { HomeAssistant, LovelaceCardEditor } from "custom-card-helpers";
import { EDITOR_TAG, type AreaCardConfig } from "./types";

const SCHEMA = [
  { name: "area", selector: { area: {} } },
  { name: "name", selector: { text: {} } },
  { name: "icon", selector: { icon: {} } },
  { name: "devices", selector: { entity: { multiple: true } } },
  { name: "background", selector: { boolean: {} } },
] as const;

const LABELS: Record<string, string> = {
  area: "Area",
  name: "Name",
  icon: "Icon",
  devices: "Devices",
  background: "Show background icon",
};

export class AreaCardEditor extends LitElement implements LovelaceCardEditor {
  hass?: HomeAssistant;

  @state() private _config?: AreaCardConfig;

  setConfig(config: AreaCardConfig): void {
    this._config = config;
  }

  private _computeLabel = (schema: { name: string }): string =>
    LABELS[schema.name] ?? schema.name;

  private _valueChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    const config = ev.detail.value as AreaCardConfig;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config },
        bubbles: true,
        composed: true,
      })
    );
  }

  protected render(): TemplateResult {
    if (!this.hass || !this._config) {
      return html``;
    }
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${SCHEMA}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, AreaCardEditor);
}

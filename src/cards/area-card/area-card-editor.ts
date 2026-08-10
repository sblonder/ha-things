import { LitElement, html, type TemplateResult } from "lit";
import { state } from "lit/decorators.js";
import type { HomeAssistant, LovelaceCardEditor } from "custom-card-helpers";
import { DEFAULT_BACKGROUND_ICON_SIZE, EDITOR_TAG, type AreaCardConfig } from "./types";

const SCHEMA = [
  { name: "area", selector: { area: {} } },
  { name: "name", selector: { text: {} } },
  { name: "icon", selector: { icon: {} } },
  { name: "hide_icon", selector: { boolean: {} } },
  { name: "devices", selector: { entity: { multiple: true } } },
  { name: "background", selector: { boolean: {} } },
  { name: "background_icon_size", selector: { number: { min: 20, max: 200, mode: "box" } } },
  {
    name: "badges",
    type: "expandable",
    title: "Status badges",
    schema: [
      { name: "temperature_sensor", selector: { entity: { domain: "sensor" } } },
      { name: "humidity_sensor", selector: { entity: { domain: "sensor" } } },
      { name: "hide_humidity", selector: { boolean: {} } },
      { name: "presence_sensors", selector: { entity: { multiple: true, domain: "binary_sensor" } } },
      { name: "door_sensors", selector: { entity: { multiple: true, domain: "binary_sensor" } } },
      { name: "hide_door", selector: { boolean: {} } },
      { name: "window_sensors", selector: { entity: { multiple: true, domain: "binary_sensor" } } },
      { name: "hide_window", selector: { boolean: {} } },
    ],
  },
] as const;

const LABELS: Record<string, string> = {
  area: "Area",
  name: "Name",
  icon: "Icon",
  hide_icon: "Hide title icon",
  devices: "Devices",
  background: "Show background icon",
  background_icon_size: "Background icon size (px)",
  temperature_sensor: "Temperature sensor",
  humidity_sensor: "Humidity sensor",
  hide_humidity: "Hide humidity badge",
  presence_sensors: "Presence sensors",
  door_sensors: "Door sensors",
  hide_door: "Hide door badge",
  window_sensors: "Window sensors",
  hide_window: "Hide window badge",
};

export class AreaCardEditor extends LitElement implements LovelaceCardEditor {
  hass?: HomeAssistant;

  @state() private _config?: AreaCardConfig;

  setConfig(config: AreaCardConfig): void {
    // These default on/to a fixed value; show that in the form even before
    // the user has ever touched them.
    this._config = {
      background: true,
      background_icon_size: DEFAULT_BACKGROUND_ICON_SIZE,
      ...config,
    };
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

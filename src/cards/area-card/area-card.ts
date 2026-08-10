import { LitElement, html, nothing, type TemplateResult } from "lit";
import { property, state } from "lit/decorators.js";
import { fireEvent, type LovelaceCardEditor } from "custom-card-helpers";
import "./area-card-editor";
import "./problem-dialog";
import { styles } from "./styles";
import {
  CARD_TAG,
  DIALOG_TAG,
  EDITOR_TAG,
  MAX_DEVICES,
  PRESENCE_DEVICE_CLASSES,
  type AreaCardConfig,
  type AreaHomeAssistant,
} from "./types";

// Entities that live in the configured area, either directly or via their device.
function entityIdsInArea(hass: AreaHomeAssistant, area: string): string[] {
  return Object.values(hass.entities)
    .filter(
      (entity) =>
        entity.area_id === area ||
        (entity.device_id !== null &&
          hass.devices[entity.device_id]?.area_id === area)
    )
    .map((entity) => entity.entity_id);
}

function isPresent(hass: AreaHomeAssistant, entityIds: string[]): boolean {
  return entityIds.some((id) => {
    const state = hass.states[id];
    return (
      state?.state === "on" &&
      PRESENCE_DEVICE_CLASSES.includes(
        state.attributes.device_class as (typeof PRESENCE_DEVICE_CLASSES)[number]
      )
    );
  });
}

function problemEntityIds(hass: AreaHomeAssistant, entityIds: string[]): string[] {
  return entityIds.filter((id) => {
    const state = hass.states[id];
    return (
      hass.entities[id]?.labels?.includes("problem") ||
      state?.attributes.device_class === "problem"
    );
  });
}

export class AreaCard extends LitElement {
  @property({ attribute: false }) hass?: AreaHomeAssistant;

  @state() private _config?: AreaCardConfig;

  // Non-empty while the problem dialog is open; drives whether it's rendered.
  @state() private _problemEntityIds: string[] = [];

  static styles = styles;

  setConfig(config: AreaCardConfig): void {
    if (!config?.area) {
      throw new Error("You need to select an area");
    }
    this._config = config;
  }

  getCardSize(): number {
    return 3;
  }

  getGridOptions() {
    return {
      columns: 6,
      rows: 3,
      min_columns: 3,
      max_columns: 6,
      min_rows: 3,
      max_rows: 3,
    };
  }

  static getConfigElement(): LovelaceCardEditor {
    return document.createElement(EDITOR_TAG) as unknown as LovelaceCardEditor;
  }

  static getStubConfig(): AreaCardConfig {
    return { type: `custom:${CARD_TAG}`, area: "" };
  }

  private _openMoreInfo(entityId: string): void {
    fireEvent(this, "hass-more-info", { entityId });
  }

  private _renderBackground(icon: string): TemplateResult | typeof nothing {
    if (this._config?.background === false) {
      return nothing;
    }
    return html`<ha-icon class="background" .icon=${icon}></ha-icon>`;
  }

  private _renderBadges(
    hass: AreaHomeAssistant,
    areaId: string,
    entityIds: string[]
  ): TemplateResult {
    const area = hass.areas[areaId];
    const tempState = area?.temperature_entity_id
      ? hass.states[area.temperature_entity_id]
      : undefined;
    const humidState = area?.humidity_entity_id
      ? hass.states[area.humidity_entity_id]
      : undefined;
    const present = isPresent(hass, entityIds);
    const problems = problemEntityIds(hass, entityIds);
    const activeProblems = problems.filter((id) => hass.states[id]?.state === "on");

    return html`
      <div class="badges">
        ${tempState
          ? html`<span
              class="badge"
              @click=${() => this._openMoreInfo(tempState.entity_id)}
            >
              <ha-icon icon="mdi:thermometer"></ha-icon>
              ${tempState.state}${tempState.attributes.unit_of_measurement ?? ""}
            </span>`
          : nothing}
        ${humidState
          ? html`<span
              class="badge"
              @click=${() => this._openMoreInfo(humidState.entity_id)}
            >
              <ha-icon icon="mdi:water-percent"></ha-icon>
              ${humidState.state}${humidState.attributes.unit_of_measurement ?? ""}
            </span>`
          : nothing}
        ${present
          ? html`<span class="badge">
              <ha-icon icon="mdi:motion-sensor"></ha-icon>
            </span>`
          : nothing}
        ${problems.length > 0
          ? html`<span
              class="badge problems"
              ?active=${activeProblems.length > 0}
              @click=${() => (this._problemEntityIds = problems)}
            >
              <ha-icon icon="mdi:alert-circle"></ha-icon>
              ${problems.length}
            </span>`
          : nothing}
      </div>
    `;
  }

  private _renderDevices(hass: AreaHomeAssistant): TemplateResult | typeof nothing {
    const devices = this._config?.devices?.slice(0, MAX_DEVICES);
    if (!devices?.length) {
      return nothing;
    }
    return html`
      <div class="devices">
        ${devices.map((entityId) => {
          const state = hass.states[entityId];
          return html`
            <button class="device" @click=${() => this._openMoreInfo(entityId)}>
              <ha-state-icon .hass=${hass} .stateObj=${state}></ha-state-icon>
            </button>
          `;
        })}
      </div>
    `;
  }

  protected render(): TemplateResult | typeof nothing {
    const hass = this.hass;
    const config = this._config;
    if (!hass || !config?.area) {
      return nothing;
    }

    const area = hass.areas[config.area];
    const name = config.name ?? area?.name ?? config.area;
    const icon = config.icon ?? area?.icon ?? "mdi:texture-box";
    const entityIds = entityIdsInArea(hass, config.area);

    return html`
      <ha-card>
        ${this._renderBackground(icon)}
        <div class="header">
          <ha-icon .icon=${icon}></ha-icon>
          <span class="name">${name}</span>
        </div>
        ${this._renderBadges(hass, config.area, entityIds)}
        <div class="spacer"></div>
        ${this._renderDevices(hass)}
      </ha-card>
      ${this._problemEntityIds.length > 0
        ? html`<area-card-problem-dialog
            .hass=${hass}
            .entityIds=${this._problemEntityIds}
            @closed=${() => (this._problemEntityIds = [])}
          ></area-card-problem-dialog>`
        : nothing}
    `;
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, AreaCard);
}

declare global {
  interface Window {
    customCards?: Array<Record<string, unknown>>;
  }
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Area Card",
  description: "A summary card for a Home Assistant area.",
  preview: true,
});

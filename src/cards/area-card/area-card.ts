import { LitElement, html, nothing, type TemplateResult } from "lit";
import { property, state } from "lit/decorators.js";
import {
  fireEvent,
  forwardHaptic,
  toggleEntity,
  type LovelaceCardEditor,
} from "custom-card-helpers";
import "./area-card-editor";
import "./problem-dialog";
import { styles } from "./styles";
import {
  CARD_TAG,
  COMPACT_DEVICES,
  EDITOR_TAG,
  HOLD_MS,
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

// Entities among `areaEntityIds` whose device_class is one of `deviceClasses`.
function classEntityIds(
  hass: AreaHomeAssistant,
  areaEntityIds: string[],
  deviceClasses: readonly string[]
): string[] {
  return areaEntityIds.filter((id) =>
    deviceClasses.includes(hass.states[id]?.attributes.device_class as string)
  );
}

function anyOn(hass: AreaHomeAssistant, entityIds: string[]): boolean {
  return entityIds.some((id) => hass.states[id]?.state === "on");
}

function activeProblemIds(hass: AreaHomeAssistant, entityIds: string[]): string[] {
  return entityIds.filter((id) => {
    const entity = hass.entities[id];
    const state = hass.states[id];
    const isProblemSensor =
      entity?.labels?.includes("problem") ||
      state?.attributes.device_class === "problem";
    return isProblemSensor && state?.state === "on";
  });
}

export class AreaCard extends LitElement {
  @property({ attribute: false }) hass?: AreaHomeAssistant;

  @state() private _config?: AreaCardConfig;

  // Non-empty while the problem dialog is open; drives whether it's rendered.
  @state() private _problemEntityIds: string[] = [];

  // Whether the card's own rendered box is closer to the 3-wide than the
  // 6-wide layout, derived from its aspect ratio (rows are fixed at 3 for
  // both, so width alone doubles between the two designed sizes).
  @state() private _compact = false;

  private _resizeObserver?: ResizeObserver;
  private _holdTimer?: ReturnType<typeof setTimeout>;
  private _held = false;

  static styles = styles;

  connectedCallback(): void {
    super.connectedCallback();
    this._resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0]!.contentRect;
      if (height > 0) {
        this._compact = width / height < 1.5;
      }
    });
    this._resizeObserver.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._resizeObserver?.disconnect();
    clearTimeout(this._holdTimer);
  }

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

  private _onDevicePointerDown(entityId: string): void {
    this._held = false;
    clearTimeout(this._holdTimer);
    this._holdTimer = setTimeout(() => {
      this._held = true;
      this._openMoreInfo(entityId);
    }, HOLD_MS);
  }

  private _onDevicePointerUp(entityId: string): void {
    clearTimeout(this._holdTimer);
    if (!this._held && this.hass) {
      forwardHaptic("light");
      toggleEntity(this.hass, entityId);
    }
  }

  private _onDevicePointerCancel(): void {
    clearTimeout(this._holdTimer);
  }

  private _renderBackground(icon: string): TemplateResult | typeof nothing {
    if (this._config?.background === false) {
      return nothing;
    }
    return html`<ha-icon class="background" .icon=${icon}></ha-icon>`;
  }

  private _renderBadges(
    hass: AreaHomeAssistant,
    config: AreaCardConfig,
    entityIds: string[]
  ): TemplateResult {
    const area = hass.areas[config.area!];

    const tempEntityId = config.temperature_sensor ?? area?.temperature_entity_id ?? undefined;
    const tempState = tempEntityId ? hass.states[tempEntityId] : undefined;

    const humidEntityId = config.hide_humidity
      ? undefined
      : (config.humidity_sensor ?? area?.humidity_entity_id ?? undefined);
    const humidState = humidEntityId ? hass.states[humidEntityId] : undefined;

    const presenceIds =
      config.presence_sensors ?? classEntityIds(hass, entityIds, PRESENCE_DEVICE_CLASSES);
    const doorIds = config.hide_door
      ? []
      : (config.door_sensors ?? classEntityIds(hass, entityIds, ["door"]));
    const windowIds = config.hide_window
      ? []
      : (config.window_sensors ?? classEntityIds(hass, entityIds, ["window"]));

    const present = anyOn(hass, presenceIds);
    const doorOpen = anyOn(hass, doorIds);
    const windowOpen = anyOn(hass, windowIds);
    const problems = activeProblemIds(hass, entityIds);

    return html`
      <div class="badges">
        ${tempState
          ? html`<span class="badge" @click=${() => this._openMoreInfo(tempState.entity_id)}>
              <ha-icon icon="mdi:thermometer"></ha-icon>
              ${tempState.state}${tempState.attributes.unit_of_measurement ?? ""}
            </span>`
          : nothing}
        ${humidState
          ? html`<span class="badge" @click=${() => this._openMoreInfo(humidState.entity_id)}>
              <ha-icon icon="mdi:water-percent"></ha-icon>
              ${humidState.state}${humidState.attributes.unit_of_measurement ?? ""}
            </span>`
          : nothing}
        ${present
          ? html`<span class="badge"><ha-icon icon="mdi:motion-sensor"></ha-icon></span>`
          : nothing}
        ${doorOpen
          ? html`<span class="badge"><ha-icon icon="mdi:door-open"></ha-icon></span>`
          : nothing}
        ${windowOpen
          ? html`<span class="badge"><ha-icon icon="mdi:window-open"></ha-icon></span>`
          : nothing}
        ${problems.length > 0
          ? html`<span
              class="badge problems"
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
    const maxDevices = this._compact ? COMPACT_DEVICES : MAX_DEVICES;
    const devices = this._config?.devices?.slice(0, maxDevices);
    if (!devices?.length) {
      return nothing;
    }
    return html`
      <div class="devices">
        ${devices.map((entityId) => {
          const state = hass.states[entityId];
          const active = !!state && !["off", "unavailable", "unknown"].includes(state.state);
          return html`
            <button
              class="device"
              ?active=${active}
              @pointerdown=${() => this._onDevicePointerDown(entityId)}
              @pointerup=${() => this._onDevicePointerUp(entityId)}
              @pointercancel=${this._onDevicePointerCancel}
              @pointerleave=${this._onDevicePointerCancel}
              @contextmenu=${(ev: Event) => ev.preventDefault()}
            >
              <state-badge .stateObj=${state} .stateColor=${true}></state-badge>
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
        ${this._renderBadges(hass, config, entityIds)}
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

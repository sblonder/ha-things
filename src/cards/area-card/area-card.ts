import { LitElement, html, nothing, type TemplateResult } from "lit";
import { property, state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import {
  fireEvent,
  forwardHaptic,
  toggleEntity,
  type LovelaceCardEditor,
} from "custom-card-helpers";
import type { HassEntity } from "home-assistant-js-websocket";
import "./area-card-editor";
import "./problem-dialog";
import { styles } from "./styles";
import { badgeEntities, badgeMode, migrateConfig } from "./config";
import {
  BADGE_DEVICE_CLASSES,
  BINARY_BADGE_ICONS,
  BINARY_BADGES,
  CARD_TAG,
  DEFAULT_BACKGROUND_ICON_SIZE,
  EDITOR_TAG,
  HOLD_MS,
  MAX_DEVICES,
  NUMERIC_BADGES,
  type AreaCardConfig,
  type AreaHomeAssistant,
  type AreaRegistryEntry,
  type BinaryBadgeKey,
  type NumericBadgeKey,
} from "./types";

const NUMERIC_BADGE_ICONS: Record<NumericBadgeKey, string> = {
  temperature: "mdi:thermometer",
  humidity: "mdi:water-percent",
};

const CLIMATE_ATTRIBUTES: Record<NumericBadgeKey, string> = {
  temperature: "current_temperature",
  humidity: "current_humidity",
};

const AREA_SENSOR: Record<NumericBadgeKey, "temperature_entity_id" | "humidity_entity_id"> = {
  temperature: "temperature_entity_id",
  humidity: "humidity_entity_id",
};

interface NumericValue {
  value: number;
  unit: string;
  entityId: string;
}

// Entities that live in the configured area: an entity's own area wins,
// otherwise it inherits its device's area.
function entityIdsInArea(hass: AreaHomeAssistant, area: string): string[] {
  return Object.values(hass.entities)
    .filter((entity) => {
      const entityArea =
        entity.area_id ??
        (entity.device_id ? hass.devices[entity.device_id]?.area_id : undefined);
      return entityArea === area;
    })
    .map((entity) => entity.entity_id);
}

// Visible, non-diagnostic area entities of `domain`, optionally filtered by
// device_class.
function areaEntityIdsOf(
  hass: AreaHomeAssistant,
  areaEntityIds: string[],
  domain: string,
  deviceClasses?: readonly string[]
): string[] {
  return areaEntityIds.filter((id) => {
    const entry = hass.entities[id];
    if (entry?.hidden || entry?.entity_category || id.split(".")[0] !== domain) {
      return false;
    }
    return (
      !deviceClasses ||
      deviceClasses.includes(hass.states[id]?.attributes.device_class as string)
    );
  });
}

// Climate entities report the reading as an attribute; sensors as their state.
function readNumeric(
  hass: AreaHomeAssistant,
  entityId: string,
  key: NumericBadgeKey
): NumericValue | undefined {
  const state = availableState(hass.states[entityId]);
  if (!state) {
    return undefined;
  }
  if (entityId.split(".")[0] === "climate") {
    const value = Number(state.attributes[CLIMATE_ATTRIBUTES[key]]);
    const unit =
      key === "temperature" ? (hass.config?.unit_system?.temperature ?? "") : "%";
    return state.attributes[CLIMATE_ATTRIBUTES[key]] != null && Number.isFinite(value)
      ? { value, unit, entityId }
      : undefined;
  }
  const value = Number(state.state);
  return Number.isFinite(value)
    ? { value, unit: (state.attributes.unit_of_measurement as string) ?? "", entityId }
    : undefined;
}

// Averages the readings that share the first reading's unit, like HA's own
// area card does for an area's sensors.
function averageNumeric(
  hass: AreaHomeAssistant,
  entityIds: string[],
  key: NumericBadgeKey
): NumericValue | undefined {
  const readings = entityIds
    .map((id) => readNumeric(hass, id, key))
    .filter((r): r is NumericValue => !!r);
  if (readings.length === 0) {
    return undefined;
  }
  const sameUnit = readings.filter((r) => r.unit === readings[0].unit);
  const value = sameUnit.reduce((sum, r) => sum + r.value, 0) / sameUnit.length;
  return { value, unit: readings[0].unit, entityId: readings[0].entityId };
}

// "area" mode: the area's configured sensor, then its climate entities, then
// any matching sensor in the area.
function numericBadgeValue(
  hass: AreaHomeAssistant,
  config: AreaCardConfig,
  area: AreaRegistryEntry | undefined,
  areaEntityIds: string[],
  key: NumericBadgeKey
): NumericValue | undefined {
  const mode = badgeMode(config, key);
  if (mode === "hide") {
    return undefined;
  }
  if (mode === "entities") {
    return averageNumeric(hass, badgeEntities(config, key), key);
  }
  const areaSensor = area?.[AREA_SENSOR[key]];
  return (
    (areaSensor ? averageNumeric(hass, [areaSensor], key) : undefined) ??
    averageNumeric(hass, areaEntityIdsOf(hass, areaEntityIds, "climate"), key) ??
    averageNumeric(
      hass,
      areaEntityIdsOf(hass, areaEntityIds, "sensor", BADGE_DEVICE_CLASSES[key]),
      key
    )
  );
}

// First entity that's currently on for a presence/motion/door/window badge.
function activeBinaryEntityId(
  hass: AreaHomeAssistant,
  config: AreaCardConfig,
  areaEntityIds: string[],
  key: BinaryBadgeKey
): string | undefined {
  const mode = badgeMode(config, key);
  if (mode === "hide") {
    return undefined;
  }
  const ids =
    mode === "entities"
      ? badgeEntities(config, key)
      : areaEntityIdsOf(hass, areaEntityIds, "binary_sensor", BADGE_DEVICE_CLASSES[key]);
  return ids.find((id) => hass.states[id]?.state === "on");
}
function availableState(state: HassEntity | undefined): HassEntity | undefined {
  return state && !["unavailable", "unknown"].includes(state.state) ? state : undefined;
}

// Native light color (mirrors room-summary-card's getRgbColor): HA already
// resolves a light's rgb_color attribute from whatever color mode is active
// (rgb, color_temp, hs, xy, ...), so reading it directly avoids reimplementing
// that conversion. Falls back to a warm glow for color-less on lights.
function deviceBackground(state: HassEntity | undefined, active: boolean): string | undefined {
  if (!active || !state || state.entity_id.split(".")[0] !== "light") {
    return undefined;
  }
  const rgb = state.attributes.rgb_color;
  const [r, g, b] = Array.isArray(rgb) && rgb.length === 3 ? rgb : [255, 193, 7];
  return `rgba(${r}, ${g}, ${b}, 0.25)`;
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

  private _holdTimer?: ReturnType<typeof setTimeout>;
  private _held = false;

  static styles = styles;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this._holdTimer);
  }

  setConfig(config: AreaCardConfig): void {
    if (!config?.area) {
      throw new Error("You need to select an area");
    }
    this._config = migrateConfig(config);
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
    const size = this._config?.background_icon_size ?? DEFAULT_BACKGROUND_ICON_SIZE;
    return html`<ha-icon
      class="background"
      .icon=${icon}
      style=${styleMap({ width: `${size}px`, height: `${size}px` })}
    ></ha-icon>`;
  }

  private _renderBadges(
    hass: AreaHomeAssistant,
    config: AreaCardConfig,
    entityIds: string[]
  ): TemplateResult {
    const area = hass.areas[config.area!];
    const problems = activeProblemIds(hass, entityIds);

    return html`
      <div class="badges">
        ${NUMERIC_BADGES.map((key) => {
          const reading = numericBadgeValue(hass, config, area, entityIds, key);
          return reading
            ? html`<span class="badge" @click=${() => this._openMoreInfo(reading.entityId)}>
                <ha-icon .icon=${NUMERIC_BADGE_ICONS[key]}></ha-icon>
                ${reading.value.toFixed(1)}${reading.unit}
              </span>`
            : nothing;
        })}
        ${BINARY_BADGES.map((key) => {
          const activeId = activeBinaryEntityId(hass, config, entityIds, key);
          return activeId
            ? html`<span class="badge" @click=${() => this._openMoreInfo(activeId)}>
                <ha-icon .icon=${BINARY_BADGE_ICONS[key]}></ha-icon>
              </span>`
            : nothing;
        })}
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
    const devices = this._config?.devices?.slice(0, MAX_DEVICES);
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
              style=${styleMap({ background: deviceBackground(state, active) })}
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
          ${config.hide_icon ? nothing : html`<ha-icon .icon=${icon}></ha-icon>`}
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

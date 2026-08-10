// Single entry point bundled into dist/ha-things.js — one file, one HACS resource,
// registering every card/element in this repository. To add a new element, give it
// its own folder under src/cards/ (or src/<category>/) and import it here.
import "./cards/climate-defaults-tile-card/climate-defaults-tile-card";
import "./cards/area-card/area-card";

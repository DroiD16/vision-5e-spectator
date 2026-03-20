/** @type {string | number} */
export let defaultHearingRange;

/** @type {boolean} */
export let spectatorMode;

/**
 * GM-controlled world setting that allows players to manually opt into spectator sharing
 * even while they still control a token that can perceive.
 * @type {boolean}
 */
/** @type {boolean} */
export let allowPlayerSpectatorModeAnytime;

/**
 * Player-controlled user setting toggled from Token controls.
 * This does not do anything unless the GM enabled the corresponding world setting.
 * @type {boolean}
 */
/** @type {boolean} */
export let playerSpectatorMode;

export function isPlayerSpectatorModeAvailable() {
    return spectatorMode && allowPlayerSpectatorModeAnytime;
}

export function isPlayerSpectatorModeActive() {
    return isPlayerSpectatorModeAvailable() && playerSpectatorMode;
}

export function refreshVisionSources() {
    // Re-evaluate all token vision sources so shared vision reacts immediately to settings changes.
    if (canvas.ready) {
        for (const token of canvas.tokens.placeables) {
            if (!token.vision === token._isVisionSource()) {
                token.initializeVisionSource();
            }
        }
    }

    if (globalThis.ui?.controls?.rendered) {
        void globalThis.ui.controls.render();
    }
}

Hooks.once("init", () => {
    game.settings.register(
        "vision-5e",
        "defaultHearingRange",
        {
            name: "VISION5E.SETTINGS.defaultHearingRange.label",
            hint: "VISION5E.SETTINGS.defaultHearingRange.hint",
            scope: "world",
            config: true,
            requiresReload: true,
            type: new dnd5e.dataModels.fields.FormulaField({
                required: true,
                deterministic: true,
                initial: "15 + 2.5 * (@skills.prc.passive - 10)",
            }),
        },
    );

    const formula = game.settings.get("vision-5e", "defaultHearingRange");

    if (foundry.dice.Roll.validate(formula)) {
        try {
            defaultHearingRange = foundry.dice.Roll.safeEval(formula);
        } catch (_error) {
            defaultHearingRange = formula;
        }
    } else {
        defaultHearingRange = Number(formula) || 0;
    }

    game.settings.register(
        "vision-5e",
        "spectatorMode",
        {
            name: "VISION5E.SETTINGS.spectatorMode.label",
            hint: "VISION5E.SETTINGS.spectatorMode.hint",
            scope: "world",
            config: true,
            type: new foundry.data.fields.BooleanField({ initial: true }),
            onChange: (value) => {
                spectatorMode = value;

                refreshVisionSources();
            },
        },
    );

    game.settings.register(
        "vision-5e",
        "allowPlayerSpectatorModeAnytime",
        {
            name: "VISION5E.SETTINGS.allowPlayerSpectatorModeAnytime.label",
            hint: "VISION5E.SETTINGS.allowPlayerSpectatorModeAnytime.hint",
            scope: "world",
            config: true,
            type: new foundry.data.fields.BooleanField({ initial: false }),
            onChange: (value) => {
                allowPlayerSpectatorModeAnytime = value;
                refreshVisionSources();
            },
        },
    );

    game.settings.register(
        "vision-5e",
        "playerSpectatorMode",
        {
            scope: "user",
            config: false,
            type: new foundry.data.fields.BooleanField({ initial: false }),
            onChange: (value) => {
                playerSpectatorMode = value;
                refreshVisionSources();
            },
        },
    );

    spectatorMode = game.settings.get("vision-5e", "spectatorMode");
    allowPlayerSpectatorModeAnytime = game.settings.get("vision-5e", "allowPlayerSpectatorModeAnytime");
    playerSpectatorMode = game.settings.get("vision-5e", "playerSpectatorMode");
});

Hooks.on("getSceneControlButtons", (controls) => {
    const tokenControls = controls.tokens;

    if (!tokenControls || game.user.isGM || !spectatorMode) {
        return;
    }

    if (!isPlayerSpectatorModeAvailable()) {
        return;
    }

    // Expose the player spectator toggle from the Token controls palette.
    tokenControls.tools.playerSpectatorMode = {
        name: "playerSpectatorMode",
        title: "VISION5E.CONTROLS.playerSpectatorMode.label",
        icon: "fa-solid fa-eye",
        order: Object.keys(tokenControls.tools).length,
        visible: true,
        toggle: true,
        active: isPlayerSpectatorModeActive(),
        onChange: (_event, active) => void game.settings.set("vision-5e", "playerSpectatorMode", active),
    };
});

Hooks.once("ready", () => {
    const content = document.createElement("div");

    if (!game.settings.storage.get("world").some((setting) => setting.key === "vision-5e.defaultHearingRange")) {
        content.insertAdjacentHTML("beforeend", `
            <div class="form-group">
                <label>${game.i18n.localize("VISION5E.SETTINGS.defaultHearingRange.label")} <span class="units">(ft)</span></label>
                <div class="form-fields" style="flex: 1;">
                    <input type="text" name="defaultHearingRange" placeholder="0"
                        value="${foundry.utils.escapeHTML(game.settings.get("vision-5e", "defaultHearingRange"))}">
                </div>
                <p class="hint">${game.i18n.localize("VISION5E.SETTINGS.defaultHearingRange.hint")}</p>
            </div>
        `);
    }

    if (!game.settings.storage.get("world").some((setting) => setting.key === "vision-5e.spectatorMode")) {
        content.insertAdjacentHTML("beforeend", `
            <div class="form-group">
                <label>${game.i18n.localize("VISION5E.SETTINGS.spectatorMode.label")}</label>
                <div class="form-fields">
                    <input type="checkbox" name="spectatorMode" ${game.settings.get("vision-5e", "spectatorMode") ? "checked" : ""}>
                </div>
                <p class="hint">${game.i18n.localize("VISION5E.SETTINGS.spectatorMode.hint")}</p>
            </div>
        `);
    }

    if (!game.settings.storage.get("world").some((setting) => setting.key === "vision-5e.allowPlayerSpectatorModeAnytime")) {
        const enabled = game.settings.get("vision-5e", "spectatorMode");

        content.insertAdjacentHTML("beforeend", `
            <div class="form-group">
                <label>${game.i18n.localize("VISION5E.SETTINGS.allowPlayerSpectatorModeAnytime.label")}</label>
                <div class="form-fields">
                    <input type="checkbox" name="allowPlayerSpectatorModeAnytime" ${game.settings.get("vision-5e", "allowPlayerSpectatorModeAnytime") ? "checked" : ""} ${enabled ? "" : "disabled"}>
                </div>
                <p class="hint">${game.i18n.localize("VISION5E.SETTINGS.allowPlayerSpectatorModeAnytime.hint")}</p>
            </div>
        `);
    }

    if (!content.hasChildNodes()) {
        return;
    }

    const spectatorInput = content.querySelector(`input[name="spectatorMode"]`);
    const anytimeInput = content.querySelector(`input[name="allowPlayerSpectatorModeAnytime"]`);

    if (spectatorInput && anytimeInput) {
        const updateAnytimeInput = () => {
            anytimeInput.disabled = !spectatorInput.checked;
        };

        spectatorInput.addEventListener("change", updateAnytimeInput);
        updateAnytimeInput();
    }

    foundry.applications.api.DialogV2.prompt({
        window: {
            title: `${game.i18n.localize("SETTINGS.Title")}: Vision 5e`,
            icon: "fa-solid fa-gears",
        },
        position: {
            width: 520,
        },
        content,
        ok: {
            callback: async (event, button) => {
                const settings = new foundry.applications.ux.FormDataExtended(button.form).object;
                const promises = [];
                let requiresReload = false;

                for (const [key, value] of Object.entries(settings)) {
                    if (game.settings.settings.get(`vision-5e.${key}`).requiresReload) {
                        requiresReload ||= value !== game.settings.get("vision-5e", key);
                    }

                    promises.push(game.settings.set("vision-5e", key, value));
                }

                await Promise.all(promises);

                if (requiresReload) {
                    foundry.utils.debouncedReload();
                }
            },
        },
    });
});

Hooks.on("renderSettingsConfig", (application, element, context, options) => {
    if (!game.user.isGM) {
        return;
    }

    if (!options.parts.includes("main")) {
        return;
    }

    const input = element.querySelector(`input[name="vision-5e.defaultHearingRange"]`);

    input.placeholder = "0";
    input.closest(".form-group").querySelector("label").insertAdjacentHTML("beforeend", ` <span class="units">(ft)</span>`);

    const spectatorInput = element.querySelector(`input[name="vision-5e.spectatorMode"]`);
    const anytimeInput = element.querySelector(`input[name="vision-5e.allowPlayerSpectatorModeAnytime"]`);

    if (!spectatorInput || !anytimeInput) {
        return;
    }

    const updateAnytimeInput = () => {
        anytimeInput.disabled = !spectatorInput.checked;
    };

    spectatorInput.addEventListener("change", updateAnytimeInput);
    updateAnytimeInput();
});

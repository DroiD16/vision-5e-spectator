/** @type {string | number} */
export let defaultHearingRange;

/** @type {boolean} */
export let spectatorMode;

/**
 * GM-controlled world setting that allows players to manually opt into spectator sharing
 * even while they still control a token that can perceive.
 * @type {boolean}
 */
export let allowPlayerSpectatorModeAnytime;

/**
 * Player-controlled user setting toggled from Token controls.
 * This does not do anything unless the GM enabled the corresponding world setting.
 * @type {boolean}
 */
export let playerSpectatorMode;

const defaultHearingRangeField = new dnd5e.dataModels.fields.FormulaField({
    required: true,
    deterministic: true,
    initial: "15 + 2.5 * (@skills.prc.passive - 10)",
    placeholder: "0",
});

defaultHearingRangeField.toFormGroup = function (groupConfig = {}, inputConfig = {}) {
    groupConfig.units = "ft";

    return Object.getPrototypeOf(this).toFormGroup.call(this, groupConfig, inputConfig);
};

const spectatorModeField = new foundry.data.fields.BooleanField({ initial: true });
const allowPlayerSpectatorModeAnytimeField = new foundry.data.fields.BooleanField({ initial: false });

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
            type: defaultHearingRangeField,
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
            type: spectatorModeField,
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
            type: allowPlayerSpectatorModeAnytimeField,
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

Hooks.once("i18nInit", () => {
    defaultHearingRangeField.label = game.i18n.localize("VISION5E.SETTINGS.defaultHearingRange.label");
    defaultHearingRangeField.hint = game.i18n.localize("VISION5E.SETTINGS.defaultHearingRange.hint");
    spectatorModeField.label = game.i18n.localize("VISION5E.SETTINGS.spectatorMode.label");
    spectatorModeField.hint = game.i18n.localize("VISION5E.SETTINGS.spectatorMode.hint");
    allowPlayerSpectatorModeAnytimeField.label = game.i18n.localize("VISION5E.SETTINGS.allowPlayerSpectatorModeAnytime.label");
    allowPlayerSpectatorModeAnytimeField.hint = game.i18n.localize("VISION5E.SETTINGS.allowPlayerSpectatorModeAnytime.hint");
});

Hooks.once("setup", () => {
    if (game.release.generation >= 14 || !game.user.isGM) {
        return;
    }

    Hooks.on("renderSettingsConfig", (application, element, context, options) => {
        if (!options.parts.includes("main")) {
            return;
        }

        element.querySelector(`input[name="vision-5e.defaultHearingRange"]`).placeholder = "0";
        updateAnytimeInputAvailability(element);
    });
});

Hooks.once("ready", () => {
    if (!game.user.isGM) {
        return;
    }

    const content = window.document.createElement("div");

    if (!game.settings.storage.get("world").some((setting) => setting.key === "vision-5e.defaultHearingRange")) {
        const inputConfig = { name: "defaultHearingRange" };

        if (game.release.generation === 13) {
            inputConfig.placeholder = "0";
        }

        content.append(defaultHearingRangeField.toFormGroup({}, inputConfig));
    }

    if (!game.settings.storage.get("world").some((setting) => setting.key === "vision-5e.spectatorMode")) {
        content.append(spectatorModeField.toFormGroup({}, { name: "spectatorMode" }));
    }

    if (!game.settings.storage.get("world").some((setting) => setting.key === "vision-5e.allowPlayerSpectatorModeAnytime")) {
        content.append(allowPlayerSpectatorModeAnytimeField.toFormGroup({}, { name: "allowPlayerSpectatorModeAnytime" }));
    }

    if (!content.hasChildNodes()) {
        return;
    }

    updateAnytimeInputAvailability(content);

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

    updateAnytimeInputAvailability(element);
});

function updateAnytimeInputAvailability(element) {
    const spectatorInput =
        element.querySelector(`input[name="spectatorMode"]`)
        ?? element.querySelector(`input[name="vision-5e.spectatorMode"]`);
    const anytimeInput =
        element.querySelector(`input[name="allowPlayerSpectatorModeAnytime"]`)
        ?? element.querySelector(`input[name="vision-5e.allowPlayerSpectatorModeAnytime"]`);

    if (!spectatorInput || !anytimeInput) {
        return;
    }

    const updateAnytimeInput = () => {
        anytimeInput.disabled = !spectatorInput.checked;
    };

    spectatorInput.addEventListener("change", updateAnytimeInput);
    updateAnytimeInput();
}

export default (TokenConfig) => class extends TokenConfig {
    /** @override */
    async _onRender(context, options) {
        await super._onRender(context, options);

        if (!options.parts.includes("vision")) {
            return;
        }

        // Disable input fields that are automatically managed by Vision 5e
        for (const element of this.element.querySelectorAll(`[name="sight.range"]`)) {
            element.disabled = true;
            element.dataset.tooltip = "VISION5E.TOOLTIPS.AutomaticallyManaged";
        }

        if (!this._preview) {
            return;
        }

        // Set vision range to the prepared preview vision range
        this.element.querySelector(`[name="sight.range"]`).value = this._preview.sight.range;

        // Set vision mode to the prepared preview vision mode
        const visionMode = this._preview.sight.visionMode;
        const visionModeInput = this.element.querySelector(`[name="sight.visionMode"]`);

        if (visionModeInput.value !== visionMode) {
            visionModeInput.value = visionMode;

            for (const [key, value] of Object.entries(CONFIG.Canvas.visionModes[visionMode]?.vision.defaults ?? {})) {
                if (value === undefined) {
                    continue;
                }

                const field = this.element.querySelector(`[name="sight.${key}"]`);

                if (!field) {
                    continue;
                }

                if (field.type === "checkbox") {
                    field.checked = value;
                } else {
                    field.value = value;
                }
            }
        }
    }

    /** @override */
    _previewChanges(changes) {
        super._previewChanges(changes);

        if (!changes || !this._preview) {
            return;
        }

        // Set vision range to the prepared preview vision range
        this.element.querySelector(`[name="sight.range"]`).value = this._preview.sight.range;
    }
};

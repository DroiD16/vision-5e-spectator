import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

const initHooks = [];
const registeredSettings = new Map();
const levels = { LIMITED: 1, OBSERVER: 2, OWNER: 3 };
const gm = { id: "gm", isGM: true };
const alice = { id: "alice", isGM: false };
const bob = { id: "bob", isGM: false };

globalThis.Hooks = {
    once: (event, callback) => {
        if (event === "init") initHooks.push(callback);
    },
    on: () => {},
};
globalThis.dnd5e = { dataModels: { fields: { FormulaField: class {} } } };
globalThis.foundry = {
    data: { fields: { BooleanField: class {} } },
    dice: { Roll: { validate: () => false } },
};
globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: levels };
globalThis.CONFIG = {
    specialStatusEffects: { DEFEATED: "dead", PETRIFIED: "petrified", UNCONSCIOUS: "unconscious" },
};

const { default: extendToken } = await import("../scripts/token.mjs");
const VisionToken = extendToken(class {});

beforeEach(() => {
    registeredSettings.clear();
    globalThis.canvas = { ready: false, visibility: { tokenVision: true }, level: { id: "ground" } };
    globalThis.game = {
        user: gm,
        users: [gm, alice, bob],
        release: { generation: 14 },
        settings: {
            register: (_module, key, config) => registeredSettings.set(key, config),
            get: (_module, key) => key === "spectatorMode",
        },
    };

    for (const hook of initHooks) hook();
});

function setSetting(key, value) {
    registeredSettings.get(key).onChange(value);
}

function scene(generation, user = gm) {
    globalThis.game.release.generation = generation;
    globalThis.game.user = user;

    const layer = { controlled: [], placeables: [] };

    const token = ({ permissions = {}, statuses = [], controlled = false, hidden = false,
        hasSight = true, hasPlayerOwner = true, level = "ground", actor = true } = {}) => {
        const instance = new VisionToken();

        Object.assign(instance, {
            layer,
            controlled,
            hasSight,
            document: { hidden, level, hasStatusEffect: (status) => statuses.includes(status) },
            actor: actor
                ? {
                        hasPlayerOwner,
                        testUserPermission: (viewer, permission) => (permissions[viewer.id] ?? 0) >= permission,
                    }
                : null,
        });
        layer.placeables.push(instance);

        if (controlled) layer.controlled.push(instance);

        return instance;
    };

    return { token };
}

for (const generation of [13, 14]) {
    test(`V${generation}: GM shares vision for an incapacitated player's token despite another player's sight`, () => {
        const { token } = scene(generation);

        token({ controlled: true, permissions: { alice: levels.OWNER }, statuses: ["unconscious"] });
        token({ controlled: true, permissions: { bob: levels.OWNER } });

        const shared = token({ permissions: { alice: levels.LIMITED } });

        assert.equal(shared._isVisionSource(), true);
    });

    test(`V${generation}: GM evaluates uncontrolled observer tokens separately for each player`, () => {
        const { token } = scene(generation);

        token({ controlled: true, permissions: { alice: levels.OWNER }, statuses: ["dead"] });
        token({ controlled: true, permissions: { bob: levels.OWNER }, statuses: ["petrified"] });
        token({ permissions: { alice: levels.OBSERVER } });

        const shared = token({ permissions: { alice: levels.LIMITED, bob: levels.LIMITED } });

        assert.equal(shared._isVisionSource(), true);
    });

    test(`V${generation}: a player's perceiving controlled token blocks automatic sharing`, () => {
        const { token } = scene(generation, alice);
        const own = token({ controlled: true, permissions: { alice: levels.OWNER } });
        const shared = token({ permissions: { alice: levels.OBSERVER } });

        assert.equal(own._isVisionSource(), true);
        assert.equal(shared._isVisionSource(), false);
    });

    test(`V${generation}: manual player sharing adds vision while preserving controlled vision`, () => {
        const { token } = scene(generation, alice);
        const own = token({ controlled: true, permissions: { alice: levels.OWNER } });
        const shared = token({ permissions: { alice: levels.LIMITED } });

        setSetting("allowPlayerSpectatorModeAnytime", true);
        setSetting("playerSpectatorMode", true);
        assert.equal(own._isVisionSource(), true);
        assert.equal(shared._isVisionSource(), true);

        setSetting("playerSpectatorMode", false);
        assert.equal(shared._isVisionSource(), false);
    });

    test(`V${generation}: the GM's permission setting gates the player's manual toggle`, () => {
        const { token } = scene(generation, alice);

        token({ controlled: true, permissions: { alice: levels.OWNER } });

        const shared = token({ permissions: { alice: levels.LIMITED } });

        setSetting("playerSpectatorMode", true);
        assert.equal(shared._isVisionSource(), false);

        setSetting("allowPlayerSpectatorModeAnytime", true);
        assert.equal(shared._isVisionSource(), true);

        setSetting("spectatorMode", false);
        assert.equal(shared._isVisionSource(), false);
    });

    for (const status of ["dead", "petrified", "unconscious"]) {
        test(`V${generation}: ${status} permits automatic player sharing`, () => {
            const { token } = scene(generation, alice);

            token({ controlled: true, permissions: { alice: levels.OWNER }, statuses: [status] });

            const shared = token({ permissions: { alice: levels.LIMITED } });

            assert.equal(shared._isVisionSource(), true);
        });
    }

    test(`V${generation}: limited sharing requires a player-owned actor`, () => {
        const { token } = scene(generation);

        token({ controlled: true, permissions: { alice: levels.OWNER }, statuses: ["unconscious"] });

        const shared = token({ permissions: { alice: levels.LIMITED }, hasPlayerOwner: false });

        assert.equal(shared._isVisionSource(), false);
    });

    test(`V${generation}: observer access permits sharing of an actor without player ownership`, () => {
        const { token } = scene(generation);

        token({ controlled: true, permissions: { alice: levels.OWNER }, statuses: ["unconscious"] });

        const shared = token({ permissions: { alice: levels.OBSERVER }, hasPlayerOwner: false });

        assert.equal(shared._isVisionSource(), true);
    });

    test(`V${generation}: GM sharing excludes hidden or sightless controlled tokens`, () => {
        const { token } = scene(generation);

        token({ controlled: true, hidden: true, permissions: { alice: levels.OWNER }, statuses: ["dead"] });
        token({ controlled: true, hasSight: false, permissions: { bob: levels.OWNER }, statuses: ["dead"] });

        const shared = token({ permissions: { alice: levels.OBSERVER, bob: levels.OBSERVER } });

        assert.equal(shared._isVisionSource(), false);
    });

    test(`V${generation}: GM sharing requires a controlled token owned by a player`, () => {
        const { token } = scene(generation);
        const shared = token({ permissions: { alice: levels.OBSERVER } });

        assert.equal(shared._isVisionSource(), false);

        token({ controlled: true, permissions: { alice: levels.OBSERVER }, statuses: ["dead"] });
        assert.equal(shared._isVisionSource(), false);
    });

    test(`V${generation}: sharing respects hidden tokens, sight, and user permissions`, () => {
        const { token } = scene(generation, alice);

        setSetting("allowPlayerSpectatorModeAnytime", true);
        setSetting("playerSpectatorMode", true);
        assert.equal(token({ hidden: true, permissions: { alice: levels.OWNER } })._isVisionSource(), false);
        assert.equal(token({ hasSight: false, permissions: { alice: levels.OWNER } })._isVisionSource(), false);
        assert.equal(token({ permissions: {} })._isVisionSource(), false);
        assert.equal(token({ actor: false })._isVisionSource(), false);
    });
}

test("V14: sharing excludes tokens outside the viewed level", () => {
    const { token } = scene(14, alice);

    setSetting("allowPlayerSpectatorModeAnytime", true);
    setSetting("playerSpectatorMode", true);
    assert.equal(token({ level: "upper", permissions: { alice: levels.OWNER } })._isVisionSource(), false);
});

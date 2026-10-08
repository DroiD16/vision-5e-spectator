Fork release based on upstream Vision 5e v3.2.3.

- Fix GM spectator vision when selecting tokens belonging to multiple players. Another player's sighted token no longer blocks shared vision for a player whose selected token is incapacitated.
- Keep the GM-controlled player spectator toggle and additive shared vision.
- Keep configurable See Invisibility range through `flags.vision-5e.seeInvisibilityRange`. Without this setting, the range remains unlimited.

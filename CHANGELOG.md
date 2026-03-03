# Changelog

All notable changes to the LNMarkets Value Averaging Bot will be documented in this file.

## [1.0.0] - 2026-03-03

### Added
- Initial release of the bot.
- Core trading logic (`bot.js`).
- Value Averaging strategy implementation (`lib/value-averaging.js`).
- LNMarkets API client wrapper (`lib/lnm-client.js`).
- Nostr reporting via `clawdzap` (`lib/nostr-reporter.js`).
- Configuration handling (`config.js`).
- Documentation (`README.md`, `DEPLOYMENT.md`, `REGISTRATION_STEPS.md`).
- Example credentials file (`credentials.json.example`).
- Gitignore rules for security.

### Security
- Secrets management via `credentials.json` (gitignored).
- State isolation.

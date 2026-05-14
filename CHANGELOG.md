# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-05-12

### Added

- `/token-prune` command to delete old sessions ([#4](https://github.com/shaftoe/pi-token-usage/issues/4))
- Daily breakdown mode (`--daily` flag) grouping by date × model
- Cache read/write token columns in all output formats
- Detailed cost breakdown columns (CSV and JSON)

### Fixed

- Updated namespace to [@earendil-works](https://github.com/earendil-works)
- Bumped dependencies to latest stable versions

## [0.1.0] - 2026-04-07

### Added

- Initial release with `/token-report` command for Pi coding agent
- Table, CSV, JSON, and Markdown output formats
- TUI overlay for interactive table view
- Session file scanning and parsing from `~/.pi/agent/sessions`
- Token usage and cost aggregation by model+provider
- CI workflow for automated testing, coverage, and NPM publishing

[0.2.0]: https://github.com/shaftoe/pi-token-usage/compare/v0.1.5...v0.2.0
[0.1.5]: https://github.com/shaftoe/pi-token-usage/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/shaftoe/pi-token-usage/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/shaftoe/pi-token-usage/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/shaftoe/pi-token-usage/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/shaftoe/pi-token-usage/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/shaftoe/pi-token-usage/releases/tag/v0.1.0

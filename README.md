# Bulker for Caido

Bulker is a Caido plugin inspired by the popular Burp Suite extension of the same name. It allows security researchers to send bulk HTTP requests concurrently to multiple target URLs with fine-grained control and integrated analysis tools.

## Features

- **Concurrent Execution**: Send bulk HTTP requests using a configurable number of threads.
- **Unified Dashboard**:
  - **Results Table**: View status codes, methods, URLs, response lengths, and durations at a glance.
  - **Row Colorization**: Rows are color-coded based on status codes and content-types (matches Crayon plugin rules).
  - **Multi-Select Support**: Use Shift+Click or Ctrl/Cmd+Click to manage multiple results for batch actions.
- **Integrated Request/Response Viewer**:
  - **Syntax Highlighting**: View raw HTTP requests and responses with clear highlighting.
  - **Inline Search**: Search for keywords directly within the request or response text.
  - **Selectable Text**: Easily select and copy portions of the HTTP data.
- **Bulk Actions (Right-Click Menu)**:
  - **Copy cURL**: Copy selected results as cURL commands (batch support).
  - **Open in History**: Quickly jump to the exact request entry in Caido's HTTP History.
  - **Send to Replay**: Create Replay sessions for selected results.
  - **Export CSV**: Download all results as a CSV file for external analysis.
- **Customizable Settings**:
  - Configure HTTP methods, threads, timeouts, redirects, and random User-Agents.

## Installation

1. Download the `plugin_package.zip` from the latest release.
2. Open Caido and navigate to the **Plugins** tab.
3. Click **Install Plugin** and select the downloaded zip file.
4. The **Bulker** sidebar item should appear immediately.

## Usage

1. **Send to Bulker**:
   - Navigate to **HTTP History** or **Search**.
   - Select one or more requests.
   - Right-click and select **Send to Bulker**.
2. **Configure and Run**:
   - The URLs from your selection will be pre-populated in the Bulker dashboard.
   - Adjust settings (Threads, Method, etc.) as needed.
   - Click **Start Execution**.
3. **Analyze**:
   - Click any result row to view its raw Request and Response.
   - Use the right-click menu on one or more rows to perform batch actions.

## Limitations

- **Replay Service**: "Send to Replay" requires a version of Caido that exposes the Replay service to plugins.

## Development

Built using the Caido Plugin SDK.

### Commands

- `bun install`: Install dependencies.
- `bun run build`: Build and bundle the plugin into `dist/plugin_package.zip`.
- `bun run package`: Re-package the manifest and bundled files.

## Releasing

To publish a new version of the plugin, follow these steps:

1. **Bump Version**: Update the version in `package.json` and `manifest.json`.
   ```json
   "version": "1.0.x"
   ```
2. **Commit and Push**:
   ```bash
   git add package.json manifest.json
   git commit -m "chore: bump version to 1.0.x"
   git push origin main
   ```
3. **Create Tag**: Push a tag matching `v*` to trigger the release workflow.
   ```bash
   git tag v1.0.x
   git push origin v1.0.x
   ```
4. **Automated Release**: GitHub Actions will automatically:
   - Build the plugin.
   - Sign the package using the `PRIVATE_KEY` secret.
   - Create a new GitHub release with the signed `plugin_package.zip`.

## Credits

Based on the [Bulker Burp Extension](https://github.com/aleister1102/bulker) by aleister1102.

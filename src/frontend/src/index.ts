import type { Caido, CommandContext } from "@caido/sdk-frontend";
import { BackendAPI, BulkerResult, BulkerSettings } from "../../shared/types";
import { createDashboard } from "./components/Dashboard";

/**
 * Extract request IDs from various context types
 */
function collectRequestIds(context: CommandContext): string[] {
  const ids = new Set<string>();

  if (context.type === "RequestRowContext") {
    context.requests
      .map((request) => request.id)
      .filter(Boolean)
      .forEach((id) => ids.add(id));
  } else if (context.type === "RequestContext") {
    if ("id" in context.request && context.request.id) {
      ids.add(context.request.id);
    }
  } else if (context.type === "ResponseContext") {
    if (context.request.id) {
      ids.add(context.request.id);
    }
  }

  return Array.from(ids);
}

export const init = (caido: Caido<BackendAPI>) => {
  const SIDEBAR_PATH = "/bulker";
  const COMMAND_ID = "bulker.send_to_bulker";

  // State
  let selectedRequestIds: string[] = [];

  // Create dashboard
  const dashboard = createDashboard(caido);

  caido.navigation.addPage(SIDEBAR_PATH, {
    body: dashboard.element,
    onEnter: () => {
      dashboard.onEnter(selectedRequestIds);
      selectedRequestIds = []; // Clear after entering
    }
  });

  // Register sidebar item
  caido.sidebar.registerItem("Bulker", SIDEBAR_PATH, {
    icon: "fas fa-paper-plane",
    group: "Plugins"
  });

  // Register command to open Bulker UI
  const OPEN_UI_COMMAND = "bulker.openUI";
  caido.commands.register(OPEN_UI_COMMAND, {
    name: "Bulker: Open Dashboard",
    run: () => {
      caido.navigation.goTo(SIDEBAR_PATH);
    },
  });
  caido.commandPalette.register(OPEN_UI_COMMAND);

  // Register command
  caido.commands.register(COMMAND_ID, {
    name: "Send to Bulker",
    run: (context: CommandContext) => {
      caido.log.debug(`[Bulker] Send to Bulker invoked, context type: ${context.type}`);
      
      selectedRequestIds = collectRequestIds(context);
      
      if (selectedRequestIds.length === 0) {
        caido.log.warn("[Bulker] No requests selected");
        caido.window.showToast("No requests selected", { variant: "warning" });
      } else {
        caido.log.info(`[Bulker] Sending ${selectedRequestIds.length} requests to Bulker`);
        caido.window.showToast(`Opening Bulker with selected requests`, { variant: "info" });
      }
      
      // Always navigate to Bulker page
      caido.navigation.goTo(SIDEBAR_PATH);
    }
  });

  // Register context menu items
  caido.menu.registerItem({
    type: "RequestRow",
    commandId: COMMAND_ID,
    leadingIcon: "fas fa-paper-plane"
  });
  caido.menu.registerItem({
    type: "Request",
    commandId: COMMAND_ID,
    leadingIcon: "fas fa-paper-plane"
  });
  caido.menu.registerItem({
    type: "Response",
    commandId: COMMAND_ID,
    leadingIcon: "fas fa-paper-plane"
  });

  caido.log.info("[Bulker] Frontend initialized.");
};

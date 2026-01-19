import type { Caido } from "@caido/sdk-frontend";
import { BackendAPI, BulkerResult, BulkerSettings } from "../../../shared/types";

const DEFAULT_SETTINGS: BulkerSettings = {
  followRedirects: false,
  threads: 20,
  randomUserAgent: false,
  httpMethod: "GET",
  timeout: 30,
  retryCount: 0,
  customHeaders: [],
  customQueryParams: []
};

export function createDashboard(caido: Caido<BackendAPI>) {
  const container = document.createElement("div");
  container.className = "bulker-container";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "1rem";
  container.style.padding = "1rem";
  container.style.height = "100%";
  container.style.boxSizing = "border-box";

  // State
  let settings: BulkerSettings = { ...DEFAULT_SETTINGS };
  let results: BulkerResult[] = [];
  let isExecuting = false;
  let selectedResultIds: Set<string> = new Set();
  let lastClickedId: string | null = null;

  // Search state
  let searchQuery = "";
  let currentMatchIndex = 0;
  let matches: { viewer: "request" | "response", index: number, element: HTMLElement }[] = [];

  // Header
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.innerHTML = `
    <div>
      <h1 style="margin: 0;">Bulker</h1>
      <p style="margin: 0; opacity: 0.7;">Send bulk HTTP requests concurrently</p>
    </div>
  `;
  container.appendChild(header);

  // Main content split
  const mainContent = document.createElement("div");
  mainContent.style.display = "flex";
  mainContent.style.gap = "1rem";
  mainContent.style.flex = "1";
  mainContent.style.minHeight = "0";
  container.appendChild(mainContent);

  // Left panel: Input and Settings
  const leftPanel = document.createElement("div");
  leftPanel.style.display = "flex";
  leftPanel.style.flexDirection = "column";
  leftPanel.style.gap = "1rem";
  leftPanel.style.width = "350px";
  mainContent.appendChild(leftPanel);

  // URL Input
  const urlInputContainer = document.createElement("div");
  urlInputContainer.className = "bulker-card";
  urlInputContainer.innerHTML = `<h3>Target URLs</h3>`;
  const urlTextarea = document.createElement("textarea");
  urlTextarea.placeholder = "Enter one URL per line...";
  urlTextarea.style.width = "100%";
  urlTextarea.style.height = "200px";
  urlTextarea.style.backgroundColor = "var(--c-bg-subtle)";
  urlTextarea.style.color = "var(--c-text-main)";
  urlTextarea.style.border = "1px solid var(--c-border-default)";
  urlTextarea.style.borderRadius = "4px";
  urlTextarea.style.padding = "0.5rem";
  urlTextarea.style.resize = "none";
  urlInputContainer.appendChild(urlTextarea);
  leftPanel.appendChild(urlInputContainer);

  // Settings
  const settingsContainer = document.createElement("div");
  settingsContainer.className = "bulker-card";
  settingsContainer.innerHTML = `<h3>Settings</h3>`;
  
  const createSettingRow = (label: string, element: HTMLElement) => {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.alignItems = "center";
    row.style.marginBottom = "0.5rem";
    const labelEl = document.createElement("label");
    labelEl.textContent = label;
    row.appendChild(labelEl);
    row.appendChild(element);
    return row;
  };

  // Method
  const methodSelect = document.createElement("select");
  ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"].forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    methodSelect.appendChild(opt);
  });
  methodSelect.value = settings.httpMethod;
  methodSelect.addEventListener("change", () => settings.httpMethod = methodSelect.value);
  settingsContainer.appendChild(createSettingRow("HTTP Method", methodSelect));

  // Threads
  const threadsInput = document.createElement("input");
  threadsInput.type = "number";
  threadsInput.min = "1";
  threadsInput.max = "50";
  threadsInput.value = settings.threads.toString();
  threadsInput.style.width = "60px";
  threadsInput.addEventListener("change", () => settings.threads = parseInt(threadsInput.value));
  settingsContainer.appendChild(createSettingRow("Threads", threadsInput));

  // Timeout
  const timeoutInput = document.createElement("input");
  timeoutInput.type = "number";
  timeoutInput.min = "1";
  timeoutInput.value = settings.timeout.toString();
  timeoutInput.style.width = "60px";
  timeoutInput.addEventListener("change", () => settings.timeout = parseInt(timeoutInput.value));
  settingsContainer.appendChild(createSettingRow("Timeout (s)", timeoutInput));

  // Redirects
  const redirectCheckbox = document.createElement("input");
  redirectCheckbox.type = "checkbox";
  redirectCheckbox.checked = settings.followRedirects;
  redirectCheckbox.addEventListener("change", () => settings.followRedirects = redirectCheckbox.checked);
  settingsContainer.appendChild(createSettingRow("Follow Redirects", redirectCheckbox));

  // Random UA
  const uaCheckbox = document.createElement("input");
  uaCheckbox.type = "checkbox";
  uaCheckbox.checked = settings.randomUserAgent;
  uaCheckbox.addEventListener("change", () => settings.randomUserAgent = uaCheckbox.checked);
  settingsContainer.appendChild(createSettingRow("Random User-Agent", uaCheckbox));

    leftPanel.appendChild(settingsContainer);

    // Action Buttons
    const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.flexWrap = "wrap";
  actions.style.gap = "0.5rem";
  
  const startBtn = caido.ui.button({
    label: "Start Execution",
    variant: "primary",
    size: "small"
  });
  startBtn.addEventListener("click", () => startExecution());
  
  const cancelBtn = caido.ui.button({
    label: "Cancel",
    variant: "secondary",
    size: "small"
  });
  cancelBtn.disabled = true;
  cancelBtn.addEventListener("click", () => cancelExecution());

  const clearBtn = caido.ui.button({
    label: "Clear Results",
    variant: "tertiary",
    size: "small"
  });
  clearBtn.addEventListener("click", () => clearResults());

  const exportBtn = caido.ui.button({
    label: "Export CSV",
    variant: "tertiary",
    size: "small"
  });
  exportBtn.addEventListener("click", () => exportCSV());

  actions.appendChild(startBtn);
  actions.appendChild(cancelBtn);
  actions.appendChild(clearBtn);
  actions.appendChild(exportBtn);
  leftPanel.appendChild(actions);

  // Right panel: Results Table
  const rightPanel = document.createElement("div");
  rightPanel.style.display = "flex";
  rightPanel.style.flexDirection = "column";
  rightPanel.style.flex = "1";
  rightPanel.style.minWidth = "0";
  rightPanel.className = "bulker-card";
  rightPanel.innerHTML = `<h3>Results</h3>`;
  mainContent.appendChild(rightPanel);

  const tableContainer = document.createElement("div");
  tableContainer.style.flex = "1";
  tableContainer.style.overflow = "auto";
  tableContainer.style.minHeight = "200px";
  rightPanel.appendChild(tableContainer);

    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.fontSize = "1rem";
    table.innerHTML = `
    <thead style="position: sticky; top: 0; background-color: var(--c-bg-default); z-index: 1;">
      <tr style="text-align: left; border-bottom: 1px solid var(--c-border-default);">
        <th style="padding: 0.5rem;">Status</th>
        <th style="padding: 0.5rem;">Method</th>
               <th style="padding: 0.5rem;">URL</th>
               <th style="padding: 0.5rem;">Length</th>
               <th style="padding: 0.5rem;">Time</th>
             </tr>
           </thead>
    <tbody id="bulker-results-body"></tbody>
  `;
  tableContainer.appendChild(table);
  const resultsBody = table.querySelector("#bulker-results-body") as HTMLElement;

  // Details Panel
  const detailsPanel = document.createElement("div");
  detailsPanel.style.display = "none";
  detailsPanel.style.flexDirection = "column";
  detailsPanel.style.gap = "1rem";
  detailsPanel.style.paddingTop = "1rem";
  detailsPanel.style.borderTop = "1px solid var(--c-border-default)";
  detailsPanel.style.height = "50%";
  detailsPanel.style.minHeight = "200px";
  rightPanel.appendChild(detailsPanel);

  const detailsHeader = document.createElement("div");
  detailsHeader.style.display = "flex";
  detailsHeader.style.justifyContent = "space-between";
  detailsHeader.style.alignItems = "center";
  detailsHeader.style.gap = "1rem";
  
  const detailsTitle = document.createElement("h3");
  detailsTitle.style.margin = "0";
  detailsTitle.style.border = "none";
  detailsTitle.style.padding = "0";
  detailsTitle.textContent = "Request / Response";
  detailsHeader.appendChild(detailsTitle);

  // Search Bar
  const searchContainer = document.createElement("div");
  searchContainer.style.display = "flex";
  searchContainer.style.alignItems = "center";
  searchContainer.style.gap = "0.5rem";
  searchContainer.style.flex = "1";
  searchContainer.style.justifyContent = "center";

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "Search...";
  searchInput.style.width = "200px";
  searchInput.style.padding = "2px 8px";
  searchInput.style.fontSize = "0.8rem";
  searchInput.style.borderRadius = "4px";
  searchInput.style.border = "1px solid var(--c-border-default)";
  searchInput.style.backgroundColor = "var(--c-bg-subtle)";
  searchInput.style.color = "var(--c-text-main)";

  const searchCount = document.createElement("span");
  searchCount.style.fontSize = "0.8rem";
  searchCount.style.opacity = "0.7";
  searchCount.textContent = "0/0";

  const prevBtn = caido.ui.button({
    label: "Prev",
    variant: "tertiary",
    size: "small"
  });
  prevBtn.disabled = true;

  const nextBtn = caido.ui.button({
    label: "Next",
    variant: "tertiary",
    size: "small"
  });
  nextBtn.disabled = true;

  searchContainer.appendChild(searchInput);
  searchContainer.appendChild(searchCount);
  searchContainer.appendChild(prevBtn);
  searchContainer.appendChild(nextBtn);
  detailsHeader.appendChild(searchContainer);
  
  const closeDetailsBtn = caido.ui.button({
    label: "Close",
    variant: "tertiary",
    size: "small"
  });
  closeDetailsBtn.addEventListener("click", () => {
    detailsPanel.style.display = "none";
  });
  detailsHeader.appendChild(closeDetailsBtn);
  detailsPanel.appendChild(detailsHeader);

  const detailsContent = document.createElement("div");
  detailsContent.style.display = "flex";
  detailsContent.style.gap = "1rem";
  detailsContent.style.flex = "1";
  detailsContent.style.minHeight = "0";
  detailsPanel.appendChild(detailsContent);

  const createRawViewer = (title: string) => {
    const viewer = document.createElement("div");
    viewer.style.display = "flex";
    viewer.style.flexDirection = "column";
    viewer.style.flex = "1";
    viewer.style.minWidth = "0";
    
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.marginBottom = "0.5rem";
    
    const titleEl = document.createElement("span");
    titleEl.style.fontSize = "0.8rem";
    titleEl.style.fontWeight = "bold";
    titleEl.style.opacity = "0.7";
    titleEl.textContent = title;
    header.appendChild(titleEl);
    
    const copyBtn = caido.ui.button({
      label: "Copy",
      variant: "tertiary",
      size: "small"
    });
    header.appendChild(copyBtn);
    
    viewer.appendChild(header);
    
    const pre = document.createElement("pre");
    pre.style.flex = "1";
    pre.style.margin = "0";
    pre.style.padding = "0.5rem";
    pre.style.backgroundColor = "var(--c-bg-subtle)";
    pre.style.color = "var(--c-text-main)";
    pre.style.border = "1px solid var(--c-border-default)";
    pre.style.borderRadius = "4px";
    pre.style.overflow = "auto";
    pre.style.fontSize = "0.9rem";
    pre.style.whiteSpace = "pre-wrap";
    pre.style.wordBreak = "break-all";
    pre.style.userSelect = "text";
    pre.style.cursor = "text";
    
    viewer.appendChild(pre);
    return { container: viewer, pre, copyBtn };
  };

  const requestViewer = createRawViewer("Request");
  const responseViewer = createRawViewer("Response");
  detailsContent.appendChild(requestViewer.container);
  detailsContent.appendChild(responseViewer.container);

  // State for copying raw text
  let currentRequestText = "";
  let currentResponseText = "";

  requestViewer.copyBtn.addEventListener("click", async () => {
    if (currentRequestText) {
      await navigator.clipboard.writeText(currentRequestText);
      caido.window.showToast("Request copied to clipboard", { variant: "success" });
    }
  });

  responseViewer.copyBtn.addEventListener("click", async () => {
    if (currentResponseText) {
      await navigator.clipboard.writeText(currentResponseText);
      caido.window.showToast("Response copied to clipboard", { variant: "success" });
    }
  });

  // Syntax Highlighting
  const highlightHTTP = (text: string) => {
    if (!text) return "";
    
    // Normalize line endings: convert CRLF to LF and remove any remaining CR
    const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "");
    
    // Escape HTML
    const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    const lines = normalizedText.split("\n");
    if (lines.length === 0) return "";
    
    // Find the first empty line (separator between headers and body)
    let emptyLineIndex = lines.findIndex(line => line.trim() === "");
    if (emptyLineIndex === -1) emptyLineIndex = lines.length;
    
    const highlightedLines = lines.map((line, index) => {
      // First line: HTTP method/version (request) or status line (response)
      if (index === 0) {
        return `<span style="color: #61afef; font-weight: bold;">${escape(line)}</span>`;
      }
      
      // Headers (before empty line)
      if (index < emptyLineIndex) {
        const colonIndex = line.indexOf(":");
        if (colonIndex !== -1) {
          const name = line.substring(0, colonIndex);
          const value = line.substring(colonIndex);
          return `<span style="color: #e5c07b;">${escape(name)}</span><span style="color: #98c379;">${escape(value)}</span>`;
        }
      }
      
      return escape(line);
    });
    
    return highlightedLines.join("\n");
  };

  const getRowColor = (status: number, contentType?: string) => {
    if (!status) return "inherit";

    if (status >= 500) return "#a32f2a"; // 5xx
    if (status >= 400) return "#a06008"; // 4xx
    if (status >= 300) return "#8a7a06"; // 3xx

    if (status >= 200 && status < 300) {
      if (contentType) {
        const ct = contentType.toLowerCase();
        if (ct.includes("application/json") || ct.includes("+json")) return "#157a37";
        if (ct.includes("application/xml") || ct.includes("text/xml") || ct.includes("+xml")) return "#0b4ea8";
        if (ct.includes("text/html") || ct.includes("application/xhtml+xml")) return "#1f7aa8";
      }
    }

    return "inherit";
  };

  // Functions
  const startExecution = async () => {
    const urls = urlTextarea.value.split("\n").map(u => u.trim()).filter(u => u.length > 0);
    if (urls.length === 0) {
      caido.window.showToast("No URLs to process", { variant: "error" });
      return;
    }

    isExecuting = true;
    startBtn.disabled = true;
    cancelBtn.disabled = false;
    results = []; // Clear previous results
    renderResults();
    
    caido.window.showToast(`Starting execution of ${urls.length} URLs...`, { variant: "info" });
    
    try {
      const newResults = await caido.backend.sendBulkRequests(urls, settings);
      results = newResults;
      renderResults();
      caido.window.showToast(`Execution complete: ${results.length} results`, { variant: "success" });
    } catch (err: any) {
      caido.window.showToast("Failed to execute: " + err.message, { variant: "error" });
    } finally {
      isExecuting = false;
      startBtn.disabled = false;
      cancelBtn.disabled = true;
    }
  };

  const cancelExecution = async () => {
    await caido.backend.cancelExecution();
    cancelBtn.disabled = true;
  };

  const clearResults = async () => {
    await caido.backend.clearResults();
    results = [];
    renderResults();
  };

  const exportCSV = () => {
    if (results.length === 0) {
      caido.window.showToast("No results to export", { variant: "info" });
      return;
    }

    const headers = ["Status", "Method", "URL", "Length", "Time (ms)", "Error"];
    const csvContent = [
      headers.join(","),
      ...results.map(r => [
        r.status,
        r.method,
        `"${r.url}"`,
        r.length,
        r.duration,
        `"${r.error || ""}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `bulker_results_${new Date().toISOString()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderResults = () => {
    resultsBody.innerHTML = "";
    results.forEach(res => {
      const row = document.createElement("tr");
      row.style.borderBottom = "1px solid var(--c-border-subtle)";
      row.style.cursor = "pointer";
      
      const isSelected = selectedResultIds.has(res.id);
      const rowColor = getRowColor(res.status, res.contentType);
      
      if (isSelected) {
        row.style.backgroundColor = "var(--c-primary)";
        row.style.color = "white";
      } else if (rowColor !== "inherit") {
        row.style.backgroundColor = rowColor;
        row.style.color = "white";
      }
      
      row.addEventListener("click", (e) => {
        if (e.shiftKey && lastClickedId) {
          // Shift+Click: Range selection
          const lastIndex = results.findIndex(r => r.id === lastClickedId);
          const currentIndex = results.findIndex(r => r.id === res.id);
          const start = Math.min(lastIndex, currentIndex);
          const end = Math.max(lastIndex, currentIndex);
          
          for (let i = start; i <= end; i++) {
            selectedResultIds.add(results[i].id);
          }
        } else if (e.ctrlKey || e.metaKey) {
          // Ctrl/Cmd+Click: Toggle selection
          if (selectedResultIds.has(res.id)) {
            selectedResultIds.delete(res.id);
          } else {
            selectedResultIds.add(res.id);
          }
        } else {
          // Normal click: Single selection
          selectedResultIds.clear();
          selectedResultIds.add(res.id);
        }
        
        lastClickedId = res.id;
        renderResults();
        
        // Show details for the clicked row
        if (res.requestId) {
          showDetails(res.requestId);
        }
      });
      
      row.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        
        // If right-clicked row isn't selected, select only it
        if (!selectedResultIds.has(res.id)) {
          selectedResultIds.clear();
          selectedResultIds.add(res.id);
          lastClickedId = res.id;
          renderResults();
        }
        
        showContextMenu(
          e,
          Array.from(selectedResultIds).map((id) => results.find((r) => r.id === id)!).filter(Boolean),
          res,
        );
      });
      
      const statusColor = (isSelected || rowColor !== "inherit") ? "white" : 
                          (res.status >= 200 && res.status < 300 ? "var(--c-success)" : 
                          res.status >= 400 ? "var(--c-error)" : "inherit");
      
      row.innerHTML = `
        <td style="padding: 0.5rem; color: ${statusColor}; font-weight: bold;">${res.status || "Error"}</td>
        <td style="padding: 0.5rem;">${res.method}</td>
        <td style="padding: 0.5rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 400px;" title="${res.url}">${res.url}</td>
        <td style="padding: 0.5rem;">${res.length}</td>
        <td style="padding: 0.5rem;">${res.duration}ms</td>
      `;

      resultsBody.prepend(row);
    });
  };

  const generateCurl = (details: { request: string, host: string, port: number, tls: boolean }): string => {
    const lines = details.request.replace(/\r\n/g, "\n").split("\n");
    const firstLine = lines[0] || "";
    const [method, path] = firstLine.split(" ");
    
    const url = `${details.tls ? "https" : "http"}://${details.host}${details.port !== (details.tls ? 443 : 80) ? ":" + details.port : ""}${path}`;
    
    let curl = `curl -X ${method} "${url}"`;
    
    let emptyLineIndex = lines.findIndex(line => line.trim() === "");
    if (emptyLineIndex === -1) emptyLineIndex = lines.length;
    
    // Headers
    for (let i = 1; i < emptyLineIndex; i++) {
      const line = lines[i];
      const colonIndex = line.indexOf(":");
      if (colonIndex !== -1) {
        const name = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        
        // Skip Host and Content-Length as they are auto-generated/managed by curl
        if (name.toLowerCase() !== "host" && name.toLowerCase() !== "content-length") {
          curl += ` -H "${name}: ${value.replace(/"/g, '\\"')}"`;
        }
      }
    }
    
    // Body
    if (emptyLineIndex < lines.length - 1) {
      const body = lines.slice(emptyLineIndex + 1).join("\n");
      if (body.trim()) {
        curl += ` --data-binary "${body.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
      }
    }
    
    return curl;
  };

  const showContextMenu = (e: MouseEvent, selectedResults: BulkerResult[], clickedResult: BulkerResult) => {
    const existingMenu = document.querySelector(".bulker-context-menu");
    if (existingMenu) existingMenu.remove();

    if (selectedResults.length === 0) return;

    const menu = document.createElement("div");
    menu.className = "bulker-context-menu";
    menu.style.position = "fixed";
    menu.style.backgroundColor = "var(--c-bg-default)";
    menu.style.border = "1px solid var(--c-border-default)";
    menu.style.borderRadius = "4px";
    menu.style.boxShadow = "0 2px 10px rgba(0,0,0,0.5)";
    menu.style.zIndex = "1000";
    menu.style.display = "flex";
    menu.style.flexDirection = "column";
    menu.style.padding = "4px";
    menu.style.minWidth = "180px";

    menu.style.top = `${e.clientY}px`;
    menu.style.left = `${e.clientX}px`;

    const createMenuItem = (label: string, onClick: () => void, disabled = false) => {
      const item = document.createElement("div");
      item.textContent = label;
      item.style.padding = "8px 12px";
      item.style.cursor = disabled ? "not-allowed" : "pointer";
      item.style.fontSize = "0.9rem";
      item.style.borderRadius = "2px";
      item.style.opacity = disabled ? "0.5" : "1";
      
      if (!disabled) {
        item.addEventListener("mouseenter", () => item.style.backgroundColor = "var(--c-bg-subtle)");
        item.addEventListener("mouseleave", () => item.style.backgroundColor = "transparent");
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          onClick();
          menu.remove();
        });
      }
      return item;
    };

    const validResults = selectedResults.filter(r => r.requestId);
    const hasValidResults = validResults.length > 0;

    menu.appendChild(createMenuItem(
      `Send to Replay (${selectedResults.length} item${selectedResults.length > 1 ? 's' : ''})`,
      async () => {
        let successCount = 0;
        for (const result of validResults) {
          try {
            const details = await caido.backend.getRequestDetails(result.requestId!);
            if (details && (caido as any).replay) {
              await (caido as any).replay.createSession({
                raw: details.request,
                connectionInfo: {
                  host: details.host,
                  port: details.port,
                  isTLS: details.tls
                }
              });
              successCount++;
            }
          } catch (err: any) {
            caido.log.error(`[Bulker] Failed to send to Replay: ${err.message}`);
          }
        }
        caido.window.showToast(`Sent ${successCount} item(s) to Replay`, { variant: "success" });
      },
      !hasValidResults
    ));

    menu.appendChild(createMenuItem(
      "Open in history",
      () => {
        if (clickedResult.requestId) {
          caido.navigation.goTo(`/http-history/${clickedResult.requestId}`);
        }
      },
      !clickedResult.requestId
    ));

    menu.appendChild(createMenuItem(
      `Copy cURL (${selectedResults.length} item${selectedResults.length > 1 ? 's' : ''})`,
      async () => {
        const curls: string[] = [];
        for (const result of validResults) {
          const details = await caido.backend.getRequestDetails(result.requestId!);
          if (details) {
            curls.push(generateCurl({
              request: details.request,
              host: details.host,
              port: details.port,
              tls: details.tls
            }));
          }
        }
        if (curls.length > 0) {
          await navigator.clipboard.writeText(curls.join("\n"));
          caido.window.showToast(`Copied ${curls.length} cURL command(s) to clipboard`, { variant: "success" });
        }
      },
      !hasValidResults
    ));

    document.body.appendChild(menu);

    const closeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener("mousedown", closeMenu);
      }
    };
    setTimeout(() => document.addEventListener("mousedown", closeMenu), 0);
  };

  const showDetails = async (requestId: string) => {
    detailsPanel.style.display = "flex";
    requestViewer.pre.textContent = "Loading...";
    responseViewer.pre.textContent = "Loading...";

    try {
      const details = await caido.backend.getRequestDetails(requestId);
      if (details) {
        currentRequestText = details.request;
        currentResponseText = details.response || "";
        requestViewer.pre.innerHTML = highlightHTTP(details.request);
        responseViewer.pre.innerHTML = highlightHTTP(details.response || "(No response)");
        
        if (searchQuery) {
          performSearch();
        }
      } else {
        currentRequestText = "";
        currentResponseText = "";
        requestViewer.pre.textContent = "Error: Could not fetch request details.";
        responseViewer.pre.textContent = "";
      }
    } catch (err: any) {
      requestViewer.pre.textContent = `Error: ${err.message}`;
      responseViewer.pre.textContent = "";
    }
  };

  const performSearch = () => {
    searchQuery = searchInput.value.toLowerCase();
    matches = [];
    currentMatchIndex = 0;

    // Reset views
    requestViewer.pre.innerHTML = highlightHTTP(currentRequestText);
    responseViewer.pre.innerHTML = highlightHTTP(currentResponseText);

    if (!searchQuery) {
      updateSearchUI();
      return;
    }

    const applySearchHighlight = (viewer: "request" | "response", pre: HTMLElement) => {
      const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT, null);
      let node;
      const nodesToReplace: { node: Node, parent: Node, matches: { start: number, end: number }[] }[] = [];

      while (node = walker.nextNode()) {
        const text = node.nodeValue || "";
        const lowerText = text.toLowerCase();
        let pos = 0;
        const nodeMatches: { start: number, end: number }[] = [];

        while ((pos = lowerText.indexOf(searchQuery, pos)) !== -1) {
          nodeMatches.push({ start: pos, end: pos + searchQuery.length });
          pos += searchQuery.length;
        }

        if (nodeMatches.length > 0) {
          nodesToReplace.push({ node, parent: node.parentNode!, matches: nodeMatches });
        }
      }

      nodesToReplace.forEach(({ node, parent, matches: nodeMatches }) => {
        const text = node.nodeValue || "";
        const fragment = document.createDocumentFragment();
        let lastIdx = 0;

        nodeMatches.forEach(match => {
          fragment.appendChild(document.createTextNode(text.substring(lastIdx, match.start)));
          const span = document.createElement("span");
          span.textContent = text.substring(match.start, match.end);
          span.style.backgroundColor = "var(--c-primary)";
          span.style.color = "white";
          span.className = "bulker-search-match";
          fragment.appendChild(span);
          matches.push({ viewer, index: matches.length, element: span });
          lastIdx = match.end;
        });

        fragment.appendChild(document.createTextNode(text.substring(lastIdx)));
        parent.replaceChild(fragment, node);
      });
    };

    applySearchHighlight("request", requestViewer.pre);
    applySearchHighlight("response", responseViewer.pre);

    if (matches.length > 0) {
      goToMatch(0);
    }
    updateSearchUI();
  };

  const updateSearchUI = () => {
    searchCount.textContent = matches.length > 0 ? `${currentMatchIndex + 1}/${matches.length}` : "0/0";
    prevBtn.disabled = matches.length <= 1;
    nextBtn.disabled = matches.length <= 1;
  };

  const goToMatch = (index: number) => {
    if (matches.length === 0) return;

    // Remove active style from previous match
    if (matches[currentMatchIndex]) {
      matches[currentMatchIndex].element.style.backgroundColor = "var(--c-primary)";
      matches[currentMatchIndex].element.style.outline = "none";
    }

    currentMatchIndex = (index + matches.length) % matches.length;
    const match = matches[currentMatchIndex];
    
    // Add active style
    match.element.style.backgroundColor = "var(--c-info)";
    match.element.style.outline = "2px solid white";
    match.element.scrollIntoView({ behavior: "smooth", block: "center" });
    
    updateSearchUI();
  };

  searchInput.addEventListener("input", () => performSearch());
  prevBtn.addEventListener("click", () => goToMatch(currentMatchIndex - 1));
  nextBtn.addEventListener("click", () => goToMatch(currentMatchIndex + 1));

  // Styles
  const style = document.createElement("style");
  style.textContent = `
    .bulker-card {
      background-color: var(--c-bg-default);
      border: 1px solid var(--c-border-default);
      border-radius: 8px;
      padding: 1rem;
    }
    .bulker-card h3 {
      margin-top: 0;
      margin-bottom: 1rem;
      font-size: 1.1rem;
      border-bottom: 1px solid var(--c-border-subtle);
      padding-bottom: 0.5rem;
    }
    select, input[type="number"], label {
      font-size: 1rem;
    }
    textarea {
      font-size: 1rem;
    }
    select, input[type="number"] {
      background-color: var(--c-bg-subtle);
      color: var(--c-text-main);
      border: 1px solid var(--c-border-default);
      border-radius: 4px;
      padding: 2px 4px;
    }
    .bulker-search-match {
      transition: background-color 0.2s, outline 0.2s;
    }
    .bulker-context-menu div:hover {
      background-color: var(--c-bg-subtle) !important;
    }
  `;
  container.appendChild(style);

  return {
    element: container,
    onEnter: async (requestIds: string[] | null) => {
      if (requestIds && requestIds.length > 0) {
        // Fetch URLs for selected requests
        try {
          const urls = await caido.backend.getRequestUrls(requestIds);
          if (urls.length > 0) {
            urlTextarea.value = urls.join("\n");
          }
        } catch (err: any) {
          caido.log.error(`[Bulker] Failed to fetch URLs: ${err.message}`);
        }
      }
      
      // Load existing results
      results = await caido.backend.getResults();
      renderResults();
      
      // Load settings
      const savedSettings = await caido.backend.getSettings();
      if (savedSettings) {
        settings = savedSettings;
        methodSelect.value = settings.httpMethod;
        threadsInput.value = settings.threads.toString();
        timeoutInput.value = settings.timeout.toString();
        redirectCheckbox.checked = settings.followRedirects;
        uaCheckbox.checked = settings.randomUserAgent;
      }
    }
  };
}

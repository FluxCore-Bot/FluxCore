/* global fetch, document, window, URLSearchParams */

const guildId = new URLSearchParams(window.location.search).get("id");
if (!guildId) window.location.href = "/";

let channels = [];
let roles = [];
let constants = {};

// --- Helpers ---

async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  if (res.status === 401) {
    window.location.href = "/auth/login";
    return null;
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function showMsg(text, isError) {
  const el = document.getElementById("msg");
  el.textContent = text;
  el.className = "message " + (isError ? "message-error" : "message-success");
  el.style.display = "";
  setTimeout(() => { el.style.display = "none"; }, 4000);
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function populateSelect(selectEl, items, selectedValue) {
  const first = selectEl.options[0];
  selectEl.innerHTML = "";
  if (first) selectEl.appendChild(first);
  for (const item of items) {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = item.name;
    if (item.id === selectedValue) opt.selected = true;
    selectEl.appendChild(opt);
  }
}

// --- Tabs ---

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("tab-" + tab.dataset.tab).classList.add("active");

    if (tab.dataset.tab === "rules") loadRules();
    if (tab.dataset.tab === "settings") loadSettings();
    if (tab.dataset.tab === "logs") loadLogs();
  });
});

// --- Init ---

async function init() {
  try {
    const user = await api("GET", "/auth/me");
    if (user) document.getElementById("user-info").textContent = user.username;
  } catch {
    window.location.href = "/";
    return;
  }

  try {
    [channels, roles, constants] = await Promise.all([
      api("GET", `/api/guilds/${guildId}/channels`),
      api("GET", `/api/guilds/${guildId}/roles`),
      api("GET", "/api/actions/constants"),
    ]);
  } catch (e) {
    showMsg("Failed to load guild data: " + e.message, true);
    return;
  }

  // Set guild name from any available source
  const guildsRes = await api("GET", "/api/guilds");
  const guild = guildsRes?.find((g) => g.id === guildId);
  if (guild) document.getElementById("guild-name").textContent = guild.name;

  initTempVoice();
  initRuleForm();
  loadRules();
}

// --- TempVoice ---

function initTempVoice() {
  const voiceChannels = channels.filter((c) => c.type === 2);
  const categories = channels.filter((c) => c.type === 4);

  populateSelect(document.getElementById("tv-hub"), voiceChannels);
  populateSelect(document.getElementById("tv-category"), categories);

  loadTempVoice();

  document.getElementById("tempvoice-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("PUT", `/api/guilds/${guildId}/tempvoice`, {
        hubChannelId: document.getElementById("tv-hub").value,
        categoryId: document.getElementById("tv-category").value || null,
        nameTemplate: document.getElementById("tv-template").value || "{user}'s Channel",
      });
      showMsg("TempVoice config saved!");
    } catch (err) {
      showMsg(err.message, true);
    }
  });

  document.getElementById("tv-remove").addEventListener("click", async () => {
    if (!confirm("Remove TempVoice configuration?")) return;
    try {
      await api("DELETE", `/api/guilds/${guildId}/tempvoice`);
      document.getElementById("tv-hub").value = "";
      document.getElementById("tv-category").value = "";
      document.getElementById("tv-template").value = "";
      showMsg("TempVoice config removed!");
    } catch (err) {
      showMsg(err.message, true);
    }
  });
}

async function loadTempVoice() {
  try {
    const config = await api("GET", `/api/guilds/${guildId}/tempvoice`);
    if (config) {
      document.getElementById("tv-hub").value = config.hubChannelId || "";
      document.getElementById("tv-category").value = config.categoryId || "";
      document.getElementById("tv-template").value = config.nameTemplate || "";
    }
  } catch {
    /* no config yet */
  }
}

// --- Action Rules ---

async function loadRules() {
  try {
    const rules = await api("GET", `/api/guilds/${guildId}/actions/rules`);
    const list = document.getElementById("rules-list");

    if (!rules || rules.length === 0) {
      list.innerHTML = '<p class="empty">No action rules configured.</p>';
      return;
    }

    let html = "<table><thead><tr><th>Name</th><th>Event</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead><tbody>";
    for (const rule of rules) {
      const eventLabel = constants.eventTypes?.[rule.eventType]?.label || rule.eventType;
      const statusBadge = rule.enabled
        ? '<span class="badge badge-success">Enabled</span>'
        : '<span class="badge badge-danger">Disabled</span>';
      html += `<tr>
        <td>${escapeHtml(rule.name)}</td>
        <td>${escapeHtml(eventLabel)}</td>
        <td>${rule.priority}</td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn btn-small" onclick="editRule(${rule.id})">Edit</button>
          <button class="btn btn-small btn-danger" onclick="deleteRule(${rule.id}, '${escapeHtml(rule.name)}')">Delete</button>
        </td>
      </tr>`;
    }
    html += "</tbody></table>";
    list.innerHTML = html;
  } catch (e) {
    showMsg("Failed to load rules: " + e.message, true);
  }
}

// Store rules data for editing
let rulesData = [];

async function editRule(ruleId) {
  if (!rulesData.length) {
    rulesData = await api("GET", `/api/guilds/${guildId}/actions/rules`);
  }
  const rule = rulesData.find((r) => r.id === ruleId);
  if (!rule) return;

  document.getElementById("rule-form-title").textContent = "Edit Rule";
  document.getElementById("rule-edit-id").value = rule.id;
  document.getElementById("rule-name").value = rule.name;
  document.getElementById("rule-event").value = rule.eventType;
  document.getElementById("rule-priority").value = rule.priority;
  document.getElementById("rule-enabled").checked = rule.enabled;

  // Populate actions
  const actionsList = document.getElementById("rule-actions-list");
  actionsList.innerHTML = "";
  for (const action of rule.actions) {
    addActionRow(action);
  }

  document.getElementById("rule-form-container").style.display = "";
  document.getElementById("create-rule-btn").style.display = "none";
}

// Expose to onclick
window.editRule = editRule;

async function deleteRule(ruleId, name) {
  if (!confirm(`Delete rule "${name}"?`)) return;
  try {
    await api("DELETE", `/api/guilds/${guildId}/actions/rules/${ruleId}`);
    showMsg("Rule deleted!");
    rulesData = [];
    loadRules();
  } catch (e) {
    showMsg(e.message, true);
  }
}
window.deleteRule = deleteRule;

function removeActionRow(btn) {
  btn.closest(".action-row").remove();
}
window.removeActionRow = removeActionRow;

function initRuleForm() {
  // Populate event type select
  const eventSelect = document.getElementById("rule-event");
  if (constants.eventTypes) {
    for (const [key, info] of Object.entries(constants.eventTypes)) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = info.label;
      eventSelect.appendChild(opt);
    }
  }

  document.getElementById("create-rule-btn").addEventListener("click", () => {
    document.getElementById("rule-form-title").textContent = "Create Rule";
    document.getElementById("rule-edit-id").value = "";
    document.getElementById("rule-form").reset();
    document.getElementById("rule-enabled").checked = true;
    document.getElementById("rule-actions-list").innerHTML = "";
    addActionRow();
    document.getElementById("rule-form-container").style.display = "";
    document.getElementById("create-rule-btn").style.display = "none";
  });

  document.getElementById("cancel-rule-btn").addEventListener("click", () => {
    document.getElementById("rule-form-container").style.display = "none";
    document.getElementById("create-rule-btn").style.display = "";
  });

  document.getElementById("add-action-btn").addEventListener("click", () => {
    const count = document.querySelectorAll(".action-row").length;
    if (count >= (constants.maxActionsPerRule || 5)) {
      showMsg(`Max ${constants.maxActionsPerRule || 5} actions per rule`, true);
      return;
    }
    addActionRow();
  });

  document.getElementById("rule-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const editId = document.getElementById("rule-edit-id").value;
    const actions = [];

    document.querySelectorAll(".action-row").forEach((row) => {
      const type = row.querySelector(".action-type").value;
      const action = { type };

      const channelSel = row.querySelector(".action-channel");
      const roleSel = row.querySelector(".action-role");
      const msgInput = row.querySelector(".action-message");

      if (channelSel && channelSel.value) action.channelId = channelSel.value;
      if (roleSel && roleSel.value) action.roleId = roleSel.value;
      if (msgInput && msgInput.value) action.message = msgInput.value;

      actions.push(action);
    });

    const payload = {
      name: document.getElementById("rule-name").value,
      eventType: document.getElementById("rule-event").value,
      priority: Number(document.getElementById("rule-priority").value) || 0,
      enabled: document.getElementById("rule-enabled").checked,
      actions,
      conditions: {},
    };

    try {
      if (editId) {
        await api("PUT", `/api/guilds/${guildId}/actions/rules/${editId}`, payload);
        showMsg("Rule updated!");
      } else {
        await api("POST", `/api/guilds/${guildId}/actions/rules`, payload);
        showMsg("Rule created!");
      }
      document.getElementById("rule-form-container").style.display = "none";
      document.getElementById("create-rule-btn").style.display = "";
      rulesData = [];
      loadRules();
    } catch (err) {
      showMsg(err.message, true);
    }
  });
}

function addActionRow(existing) {
  const container = document.getElementById("rule-actions-list");
  const row = document.createElement("div");
  row.className = "action-row";
  row.style.cssText = "background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:12px;margin-bottom:8px;";

  const textChannels = channels.filter((c) => c.type === 0);

  let typeOptions = "";
  if (constants.actionTypes) {
    for (const [key, info] of Object.entries(constants.actionTypes)) {
      const sel = existing && existing.type === key ? "selected" : "";
      typeOptions += `<option value="${key}" ${sel}>${info.label}</option>`;
    }
  }

  let channelOptions = '<option value="">Select channel...</option>';
  for (const ch of textChannels) {
    const sel = existing && existing.channelId === ch.id ? "selected" : "";
    channelOptions += `<option value="${ch.id}" ${sel}>${escapeHtml(ch.name)}</option>`;
  }

  let roleOptions = '<option value="">Select role...</option>';
  for (const r of roles) {
    const sel = existing && existing.roleId === r.id ? "selected" : "";
    roleOptions += `<option value="${r.id}" ${sel}>${escapeHtml(r.name)}</option>`;
  }

  row.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
      <div class="form-group" style="margin:0">
        <label>Type</label>
        <select class="action-type">${typeOptions}</select>
      </div>
      <div class="form-group" style="margin:0">
        <label>Channel</label>
        <select class="action-channel">${channelOptions}</select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
      <div class="form-group" style="margin:0">
        <label>Role</label>
        <select class="action-role">${roleOptions}</select>
      </div>
      <div class="form-group" style="margin:0">
        <label>Message</label>
        <input type="text" class="action-message" placeholder="Use {user}, {channel}, etc." value="${existing?.message ? escapeHtml(existing.message) : ""}">
      </div>
    </div>
    <button type="button" class="btn btn-small btn-danger" onclick="removeActionRow(this)">Remove</button>
  `;

  container.appendChild(row);
}

// --- Action Settings ---

async function loadSettings() {
  try {
    const settings = await api("GET", `/api/guilds/${guildId}/actions/settings`);
    document.getElementById("settings-enabled").checked = settings.globalEnabled;
    document.getElementById("settings-max-rules").value = settings.maxRules;

    const textChannels = channels.filter((c) => c.type === 0);
    populateSelect(
      document.getElementById("settings-log-channel"),
      textChannels,
      settings.logChannelId,
    );
  } catch (e) {
    showMsg("Failed to load settings: " + e.message, true);
  }
}

document.getElementById("settings-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("PUT", `/api/guilds/${guildId}/actions/settings`, {
      globalEnabled: document.getElementById("settings-enabled").checked,
      maxRules: Number(document.getElementById("settings-max-rules").value),
      logChannelId: document.getElementById("settings-log-channel").value || null,
    });
    showMsg("Settings saved!");
  } catch (err) {
    showMsg(err.message, true);
  }
});

// --- Action Logs ---

async function loadLogs() {
  try {
    const filter = document.getElementById("log-filter").value;
    const params = new URLSearchParams({ limit: "30" });
    if (filter) params.set("ruleName", filter);

    const logs = await api("GET", `/api/guilds/${guildId}/actions/logs?${params}`);
    const list = document.getElementById("logs-list");

    if (!logs || logs.length === 0) {
      list.innerHTML = '<p class="empty">No logs found.</p>';
      return;
    }

    let html = "<table><thead><tr><th>Time</th><th>Rule</th><th>Event</th><th>Action</th><th>Status</th></tr></thead><tbody>";
    for (const log of logs) {
      const time = new Date(log.executedAt).toLocaleString();
      const statusBadge = log.success
        ? '<span class="badge badge-success">OK</span>'
        : '<span class="badge badge-danger">Failed</span>';
      html += `<tr>
        <td>${escapeHtml(time)}</td>
        <td>${escapeHtml(log.ruleName)}</td>
        <td>${escapeHtml(log.eventType)}</td>
        <td>${escapeHtml(log.actionType)}</td>
        <td>${statusBadge}</td>
      </tr>`;
    }
    html += "</tbody></table>";
    list.innerHTML = html;
  } catch (e) {
    showMsg("Failed to load logs: " + e.message, true);
  }
}

document.getElementById("log-filter").addEventListener("change", loadLogs);

// --- Start ---
init();

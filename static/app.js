let currentScanId = null;
let currentRoot = null;
let currentOutputFolder = null;
let lastOperationId = null;
let currentFiles = [];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const sizeLabel = n => n < 1024 ? `${n} B` : n < 1024*1024 ? `${(n/1024).toFixed(1)} KB` : n < 1024**3 ? `${(n/1024**2).toFixed(1)} MB` : `${(n/1024**3).toFixed(1)} GB`;

async function api(url, body) {
  const response = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
  return data;
}
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.remove("hidden");
  setTimeout(() => $("toast").classList.add("hidden"), 3600);
}
function setBusy(button, busy, text) {
  button.disabled = busy;
  if (busy) { button.dataset.original = button.textContent; button.textContent = text || "Working…"; }
  else if (button.dataset.original) button.textContent = button.dataset.original;
}
function updateSelectedCount() {
  const selected = [...document.querySelectorAll(".row-select")].filter(x => x.checked).length;
  $("selected-count").textContent = `${selected} selected`;
}
function renderFiles() {
  $("files").innerHTML = currentFiles.map((f, i) => `
    <tr data-index="${i}">
      <td><input class="row-select" type="checkbox" ${f.selected ? "checked" : ""} aria-label="Include ${esc(f.name)}"></td>
      <td><div class="file-name">${esc(f.name)}</div><div class="file-path">${esc(f.relative_path || f.source || "")}</div><div class="file-path">Modified ${esc(f.modified || "unknown")}</div></td>
      <td><span class="category">${esc(f.category)}</span></td>
      <td><input class="name-input" value="${esc(f.suggested_stem || f.name.replace(/\.[^.]+$/, ""))}" aria-label="Suggested filename for ${esc(f.name)}"><div class="file-path">${esc(f.reason || "")}</div></td>
      <td class="size">${sizeLabel(f.size || 0)}</td>
    </tr>`).join("");
  document.querySelectorAll(".row-select").forEach((el, i) => el.addEventListener("change", () => { currentFiles[i].selected = el.checked; updateSelectedCount(); }));
  document.querySelectorAll(".name-input").forEach((el, i) => el.addEventListener("input", () => { currentFiles[i].suggested_stem = el.value; }));
  updateSelectedCount();
}
function showNotice(id, message, error=false) {
  const el = $(id); el.textContent = message; el.classList.remove("hidden"); el.classList.toggle("error", error);
}

async function loadStatus() {
  try {
    const r = await fetch("/api/status"); const data = await r.json();
    const el = $("status");
    if (data.ollama_available) el.innerHTML = `<span class="dot good"></span> Ollama connected · ${esc(data.model)}`;
    else el.innerHTML = `<span class="dot"></span> Ollama not detected · rule-based mode available`;
  } catch { $("status").textContent = "Local mode"; }
}

$("scan-form").addEventListener("submit", async e => {
  e.preventDefault();
  const button = e.submitter || e.target.querySelector("button");
  setBusy(button, true, "Scanning subfolders…");
  try {
    const data = await api("/api/scan", {folder:$("folder").value.trim()});
    currentScanId = data.scan_id; currentRoot = data.root; currentOutputFolder = data.output_folder; currentFiles = data.files;
    $("results").classList.remove("hidden");
    $("file-count").textContent = `${data.count} files · ${data.directories_scanned} folders scanned`;
    $("ai-report").classList.add("hidden"); $("duplicate-report").classList.add("hidden"); $("undo-panel").classList.add("hidden");
    renderFiles();
    toast(`Scanned ${data.count} files recursively.`);
    if (data.truncated) toast(`Safety limit reached: first ${data.max_files} files scanned.`);
    $("results").scrollIntoView({behavior:"smooth", block:"start"});
  } catch(err) { toast(err.message); }
  finally { setBusy(button, false); }
});

$("analyze").addEventListener("click", async () => {
  if (!currentScanId) return;
  const button = $("analyze"); setBusy(button, true, "Analyzing…");
  $("ai-report").classList.remove("hidden", "error");
  $("ai-report").textContent = "Starting analysis…";
  let polling = true;
  const pollProgress = async () => {
    while (polling) {
      try {
        const response = await fetch(`/api/progress/${encodeURIComponent(currentScanId)}`);
        if (response.ok) {
          const p = await response.json();
          if (p.state === "running" || p.state === "done") {
            const pct = p.total ? Math.round((p.current / p.total) * 100) : 100;
            $("ai-report").textContent = `${p.message} (${pct}%)`;
          } else if (p.state === "error") {
            $("ai-report").textContent = `Analysis error: ${p.message}`;
            $("ai-report").classList.add("error");
          }
        }
      } catch (_) { /* Retry on next poll. */ }
      await new Promise(resolve => setTimeout(resolve, 650));
    }
  };
  const poller = pollProgress();
  try {
    const data = await api("/api/analyze", {scan_id:currentScanId, use_ai:$("use-ai").checked, rename_all:$("rename-all").checked});
    currentFiles = data.files; renderFiles();
    const failed = data.failures.length;
    showNotice("ai-report", data.ai_requested
      ? `Analysis complete: ${data.files.length} files. ${data.rename_all ? "Qwen was asked to review every file; names for binary files rely only on filename and folder-path clues." : "Qwen was used for text and unknown file types. Enable the all-files option to request naming suggestions for every file."} ${failed ? `${failed} file(s) used fallback suggestions.` : "Review suggestions before copying."}`
      : "Analysis complete using extension-based rules only. Turn on Use local AI to request AI suggestions.", failed > 0);
  } catch(err) { showNotice("ai-report", err.message, true); }
  finally { polling = false; await poller; setBusy(button, false); }
});

$("duplicates").addEventListener("click", async () => {
  if (!currentScanId) return;
  const button = $("duplicates"); setBusy(button, true, "Hashing files…");
  try {
    const data = await api("/api/duplicates", {scan_id:currentScanId, use_ai:false});
    const message = data.groups.length
      ? `${data.groups.length} group(s) of exact duplicates (${data.duplicate_file_count} files): ${data.groups.map(g => g.join(" = ")).join(" | ")}`
      : "No exact duplicates found among the scanned files.";
    showNotice("duplicate-report", message);
  } catch(err) { showNotice("duplicate-report", err.message, true); }
  finally { setBusy(button, false); }
});

$("apply").addEventListener("click", async () => {
  if (!currentScanId) return;
  const rows = [...document.querySelectorAll("#files tr")];
  const items = currentFiles.map((f, index) => {
    const row = rows[index];
    const category = f.category || "Other";
    const input = row?.querySelector(".name-input");
    const stem = (input?.value || f.suggested_stem || f.name.replace(/\.[^.]+$/, "")).trim();
    return {source:f.source, destination:`${category}/${stem}`, selected:!!f.selected};
  });
  const count = items.filter(x => x.selected).length;
  if (!count) { toast("Select at least one file first."); return; }
  const message = `Create a separate organized copy of ${count} file(s) here?\n\n${currentOutputFolder}\n\nOriginal files and folders will remain untouched. Existing destination files will never be overwritten.`;
  if (!confirm(message)) return;
  const button = $("apply"); setBusy(button, true, "Creating copies…");
  try {
    const data = await api("/api/apply", {scan_id:currentScanId, items});
    lastOperationId = data.operation_id;
    $("undo-panel").classList.remove("hidden");
    $("apply-report").textContent = `Created ${data.copied_count} file copy/copies in ${data.output_folder}. Your original files were not moved or changed. ${data.results.filter(r=>r.status!=="copied").length} item(s) were skipped, rejected, or failed.`;
    showNotice("undo-report", data.results.map(r => `${r.status}: ${r.source}${r.destination ? " → "+r.destination : ""}${r.reason ? " — "+r.reason : ""}`).join(" | ") || "No copies created.");
    toast(`Created ${data.copied_count} organized copies.`);
    $("undo-panel").scrollIntoView({behavior:"smooth", block:"start"});
  } catch(err) { toast(err.message); }
  finally { setBusy(button, false); }
});

$("undo").addEventListener("click", async () => {
  if (!lastOperationId) return;
  if (!confirm("Undo the last operation? This removes only SlothSort-created copies that have not been changed. Originals are left alone.")) return;
  const button = $("undo"); setBusy(button, true, "Undoing…");
  try {
    const data = await api("/api/undo", {operation_id:lastOperationId});
    showNotice("undo-report", `Removed ${data.undone_count} unchanged copy/copies. ` + data.results.map(r => `${r.status}${r.reason ? ": "+r.reason : ""}`).join(" | "));
    toast(`Undo complete: ${data.undone_count} copies removed.`);
    lastOperationId = null;
  } catch(err) { showNotice("undo-report", err.message, true); }
  finally { setBusy(button, false); }
});

loadStatus();

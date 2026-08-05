const state = {
  entries: [],
  filter: "all",
  query: "",
  includeCaptions: true,
  sort: "newest",
};

const nodes = {
  grid: document.getElementById("grid"),
  totalCount: document.getElementById("totalCount"),
  visibleCount: document.getElementById("visibleCount"),
  categoryCount: document.getElementById("categoryCount"),
  resultMeta: document.getElementById("resultMeta"),
  featureTitle: document.getElementById("featureTitle"),
  featureSummary: document.getElementById("featureSummary"),
  featureCreator: document.getElementById("featureCreator"),
  featurePosted: document.getElementById("featurePosted"),
  featureSource: document.getElementById("featureSource"),
  categoryBar: document.getElementById("categoryBar"),
  searchInput: document.getElementById("searchInput"),
  captionToggle: document.getElementById("captionToggle"),
  sortSelect: document.getElementById("sortSelect"),
  clearButton: document.getElementById("clearButton"),
  cardTemplate: document.getElementById("cardTemplate"),
};

function parseDate(value) {
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

function formatDate(value) {
  const time = parseDate(value);
  if (!time) return value || "--";
  return new Date(time).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function safe(value) {
  return String(value ?? "");
}

function normalize(entry) {
  const caption = safe(entry.transcript_original);
  const english = safe(entry.transcript_en);
  const tags = Array.isArray(entry.tags) ? entry.tags : [];
  const searchBase = [
    entry.title,
    entry.category,
    entry.summary,
    entry.source?.display_name,
    entry.source?.handle,
    entry.source?.notes,
    tags.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const searchCaptions = [caption, english].filter(Boolean).join(" ").toLowerCase();

  return {
    ...entry,
    tags,
    caption,
    english,
    searchBase,
    searchCaptions,
    postedTime: parseDate(entry.post?.posted_at),
  };
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    if (state.sort === "oldest") return a.postedTime - b.postedTime;
    return b.postedTime - a.postedTime;
  });
}

function renderFilters() {
  const counts = new Map();
  for (const entry of state.entries) {
    const category = entry.category || "other";
    counts.set(category, (counts.get(category) || 0) + 1);
  }

  const chips = [
    { value: "all", label: `All (${state.entries.length})` },
    ...Array.from(counts.entries()).map(([value, count]) => ({
      value,
      label: `${value} (${count})`,
    })),
  ];

  nodes.categoryBar.innerHTML = "";
  for (const chip of chips) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip${state.filter === chip.value ? " active" : ""}`;
    button.textContent = chip.label;
    button.addEventListener("click", () => {
      state.filter = chip.value;
      render();
    });
    nodes.categoryBar.appendChild(button);
  }
}

function matches(entry) {
  const categoryOk = state.filter === "all" || entry.category === state.filter;
  const queryPool = state.includeCaptions
    ? `${entry.searchBase} ${entry.searchCaptions}`.trim()
    : entry.searchBase;
  const queryOk = !state.query || queryPool.includes(state.query);
  return categoryOk && queryOk;
}

function fact(label, value) {
  if (!value) return "";
  return `<dt>${label}</dt><dd>${escapeHtml(value)}</dd>`;
}

function escapeHtml(value) {
  return safe(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderFeature(entries) {
  const featured = entries[0];
  if (!featured) {
    nodes.featureTitle.textContent = "No results";
    nodes.featureSummary.textContent = "Try clearing filters.";
    nodes.featureCreator.textContent = "--";
    nodes.featurePosted.textContent = "--";
    nodes.featureSource.textContent = "--";
    return;
  }

  nodes.featureTitle.textContent = featured.title;
  nodes.featureSummary.textContent = featured.summary;
  nodes.featureCreator.textContent = `${featured.source.display_name} (@${featured.source.handle})`;
  nodes.featurePosted.textContent = formatDate(featured.post.posted_at);
  nodes.featureSource.textContent = featured.source.profile_url;
}

function renderCards(entries) {
  nodes.grid.innerHTML = "";

  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent =
      "No entries match that search. Open up the filters or search something less specific.";
    nodes.grid.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const entry of entries) {
    const node = nodes.cardTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".card-date").textContent = formatDate(entry.post.posted_at);
    node.querySelector(".card-title").textContent = entry.title;
    node.querySelector('[data-field="category"]').textContent = entry.category;
    node.querySelector('[data-field="tags"]').textContent = entry.tags.join(" · ");
    node.querySelector(".card-summary").textContent = entry.summary;
    node.querySelector(".facts").innerHTML =
      fact("Creator", `${entry.source.display_name} (@${entry.source.handle})`) +
      fact("Post", entry.post.shortcode) +
      fact("Likes", safe(entry.post.like_count)) +
      fact("Comments", safe(entry.post.comment_count)) +
      fact("Tags", entry.tags.join(", ")) +
      fact("Category", entry.category);

    node.querySelector('[data-field="original"]').textContent = entry.caption || "No original caption stored.";
    node.querySelector('[data-field="english"]').textContent = entry.english || "No English translation stored.";

    node.querySelector('[data-field="post"]').href = entry.post.post_url;
    node.querySelector('[data-field="profile"]').href = entry.source.profile_url;

    fragment.appendChild(node);
  }

  nodes.grid.appendChild(fragment);
}

function render() {
  const filtered = sortEntries(
    state.entries.filter((entry) => matches(entry)),
  );

  nodes.totalCount.textContent = String(state.entries.length);
  nodes.visibleCount.textContent = String(filtered.length);
  nodes.categoryCount.textContent = String(
    new Set(state.entries.map((entry) => entry.category)).size,
  );
  nodes.resultMeta.textContent = `${filtered.length} visible of ${state.entries.length} total`;

  renderFilters();
  renderFeature(filtered);
  renderCards(filtered);
}

async function init() {
  const response = await fetch("./recipes.json");
  const data = await response.json();
  state.entries = data.map(normalize);

  nodes.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });

  nodes.captionToggle.addEventListener("change", (event) => {
    state.includeCaptions = event.target.checked;
    render();
  });

  nodes.sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    render();
  });

  nodes.clearButton.addEventListener("click", () => {
    state.filter = "all";
    state.query = "";
    state.includeCaptions = true;
    state.sort = "newest";
    nodes.searchInput.value = "";
    nodes.captionToggle.checked = true;
    nodes.sortSelect.value = "newest";
    render();
  });

  render();
}

init().catch((error) => {
  console.error(error);
  nodes.grid.innerHTML =
    '<div class="empty">Could not load recipes.json. GitHub Pages will serve it fine, but local file previews need a web server.</div>';
});

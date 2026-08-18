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
  originCount: document.getElementById("originCount"),
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

function getOrigin(entry) {
  const haystack = [
    entry.title,
    entry.summary,
    entry.transcript_original,
    entry.transcript_en,
    Array.isArray(entry.tags) ? entry.tags.join(" ") : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const rules = [
    ["Brazil", [/brazil/, /brazilian/, /sao paulo/, /cerrado/, /sumatra/, /smatra/]],
    ["Colombia", [/colombia/, /cauca/, /huila/, /nariño/, /granja paraiso/, /paraiso92/]],
    ["Guatemala", [/guatemala/, /antigua/, /chimaltenango/, /la colina/, /las nubes/]],
    ["Ethiopia", [/ethiopia/, /ethiopian/, /guji/, /yirgacheffe/, /kayon/, /goro bedessa/]],
    ["Yemen", [/yemen/, /haraz/]],
    ["Tanzania", [/tanzania/, /acacia hills/]],
    ["Taiwan", [/taiwan/, /alisan/, /songna/]],
    ["El Salvador", [/el salvador/, /pacamara/]],
    ["Indonesia", [/indonesia/, /sumatra/, /smatra/, /indonesian/]],
    ["Panama", [/panama/]],
    ["Costa Rica", [/costa rica/]],
    ["Kenya", [/kenya/]],
    ["Peru", [/peru/]],
    ["Mexico", [/mexico/]],
  ];

  for (const [label, patterns] of rules) {
    if (patterns.some((pattern) => pattern.test(haystack))) return label;
  }

  return "Other origins";
}

function normalize(entry) {
  const caption = safe(entry.transcript_original);
  const english = safe(entry.transcript_en || entry.summary);
  const tags = Array.isArray(entry.tags) ? entry.tags : [];
  const origin = getOrigin(entry);
  const searchBase = [
    entry.title,
    entry.summary,
    entry.category,
    origin,
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
    origin,
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
      label: `${formatCategory(value)} (${count})`,
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

function formatCategory(value) {
  if (!value) return "Other";
  return value
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function fact(label, value) {
  if (!value) return "";
  return `<dt>${label}</dt><dd>${escapeHtml(value)}</dd>`;
}

function factLink(label, href, value, extra = "") {
  if (!href || !value) return "";
  const suffix = extra ? ` <span class="fact-extra">${escapeHtml(extra)}</span>` : "";
  return `<dt>${label}</dt><dd><a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(value)}</a>${suffix}</dd>`;
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
  nodes.featureSummary.textContent = featured.summary || "No English summary stored.";
  nodes.featureCreator.textContent = `${featured.source.display_name} (@${featured.source.handle})`;
  nodes.featurePosted.textContent = formatDate(featured.post.posted_at);
  nodes.featureSource.innerHTML = `<a href="${escapeHtml(featured.source.profile_url)}" target="_blank" rel="noreferrer">${escapeHtml(featured.source.display_name)}</a>`;
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
  const groups = new Map();

  for (const entry of entries) {
    const list = groups.get(entry.origin) || [];
    list.push(entry);
    groups.set(entry.origin, list);
  }

  const groupedEntries = [...groups.entries()].sort((a, b) => {
    const countDelta = b[1].length - a[1].length;
    if (countDelta) return countDelta;
    return a[0].localeCompare(b[0]);
  });

  for (const [origin, originEntries] of groupedEntries) {
    const section = document.createElement("section");
    section.className = "origin-group";

    const header = document.createElement("div");
    header.className = "origin-head";
    header.innerHTML = `
      <div>
        <p class="eyebrow">Origin</p>
        <h3>${escapeHtml(origin)}</h3>
      </div>
      <span class="origin-count">${originEntries.length} coffees</span>
    `;
    section.appendChild(header);

    const groupGrid = document.createElement("div");
    groupGrid.className = "origin-grid";

    for (const entry of originEntries) {
      const node = nodes.cardTemplate.content.firstElementChild.cloneNode(true);
      node.querySelector(".card-date").textContent = formatDate(entry.post.posted_at);
      node.querySelector(".card-title").textContent = entry.title;
      node.querySelector(".card-title-english").textContent =
        entry.summary || "English summary unavailable.";
      node.querySelector('[data-field="category"]').textContent = formatCategory(entry.category);
      node.querySelector('[data-field="tags"]').textContent = entry.tags.join(" · ");
      node.querySelector(".card-summary").textContent =
        entry.summary || "No English summary stored.";
      node.querySelector(".facts").innerHTML =
        fact("Origin", entry.origin) +
        fact("Creator", `${entry.source.display_name} (@${entry.source.handle})`) +
        factLink("Original post", entry.post.post_url, "Open original post", entry.post.shortcode) +
        fact("Shortcode", entry.post.shortcode) +
        fact("Likes", safe(entry.post.like_count)) +
        fact("Comments", safe(entry.post.comment_count)) +
        fact("Tags", entry.tags.join(", ")) +
        fact("Category", formatCategory(entry.category));

      node.querySelector('[data-field="original"]').textContent =
        entry.caption || "No original caption stored.";
      node.querySelector('[data-field="english"]').textContent =
        entry.english || "No English translation stored.";

      node.querySelector('[data-field="post"]').href = entry.post.post_url;
      node.querySelector('[data-field="profile"]').href = entry.source.profile_url;

      groupGrid.appendChild(node);
    }

    section.appendChild(groupGrid);
    fragment.appendChild(section);
  }

  nodes.grid.appendChild(fragment);
}

function render() {
  const filtered = sortEntries(
    state.entries.filter((entry) => matches(entry)),
  );

  nodes.totalCount.textContent = String(state.entries.length);
  nodes.visibleCount.textContent = String(filtered.length);
  nodes.originCount.textContent = String(
    new Set(state.entries.map((entry) => entry.origin)).size,
  );
  nodes.resultMeta.textContent = `${filtered.length} visible across ${new Set(filtered.map((entry) => entry.origin)).size} origins`;

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

// MealHaven – Single Page App (vanilla JS + localStorage)

/* ----------------- Utilities ----------------- */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const today = () => fmt(new Date());
const getLS = (k, fallback) =>
  JSON.parse(localStorage.getItem(k) || JSON.stringify(fallback));
const setLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// Keyword matcher for ingredient ↔ pantry (simple, tolerant)
function matchIngredientToPantry(ingredient, pantryNames) {
  const norm = (s) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  const words = new Set(norm(ingredient));
  return pantryNames.some((name) => {
    const w2 = new Set(norm(name));
    // overlap of at least 1 meaningful word
    return [...words].some((w) => w.length > 2 && w2.has(w));
  });
}

/* ----------------- Seed Data ----------------- */
const SAMPLE_RECIPES = [
  {
    id: "r1",
    title: "Salami & Cheese Pizza",
    minutes: 30,
    rating: 5,
    ingredients: [
      "pizza base",
      "tomato sauce",
      "salami",
      "mozzarella",
      "basil",
    ],
    steps: [
      "Preheat oven to 220°C",
      "Spread sauce",
      "Top with salami & cheese",
      "Bake 12–15 min",
    ],
  },
  {
    id: "r2",
    title: "Crispy Shrimp",
    minutes: 20,
    rating: 4,
    ingredients: ["shrimp", "flour", "egg", "breadcrumbs", "oil"],
    steps: ["Coat shrimp", "Fry until golden", "Serve with dip"],
  },
  {
    id: "r3",
    title: "Sticky Chicken Wings",
    minutes: 30,
    rating: 5,
    ingredients: ["chicken wings", "soy sauce", "honey", "garlic", "ginger"],
    steps: ["Marinate wings", "Bake 25 min", "Brush glaze & serve"],
  },
  {
    id: "r4",
    title: "Veggie Omelette",
    minutes: 10,
    rating: 4,
    ingredients: ["eggs", "onion", "tomato", "spinach", "cheese"],
    steps: ["Beat eggs", "Sauté veg", "Cook eggs & fold"],
  },
];

const SAMPLE_PANTRY = [
  {
    id: "p1",
    name: "chicken breast",
    qty: 2,
    unit: "pcs",
    expiry: fmt(new Date(Date.now() + 86400000 * 2)),
  },
  {
    id: "p2",
    name: "tomato sauce",
    qty: 1,
    unit: "jar",
    expiry: fmt(new Date(Date.now() + 86400000 * 10)),
  },
  {
    id: "p3",
    name: "mozzarella",
    qty: 1,
    unit: "pcs",
    expiry: fmt(new Date(Date.now() + 86400000 * 3)),
  },
  {
    id: "p4",
    name: "eggs",
    qty: 12,
    unit: "pcs",
    expiry: fmt(new Date(Date.now() + 86400000 * 20)),
  },
];

const SAMPLE_PLANS = {}; // date -> [{id, title, slot}]
const SAMPLE_FAVS = ["r1", "r3"];

/* ----------------- State ----------------- */
const state = {
  recipes: getLS("mh_recipes", SAMPLE_RECIPES),
  pantry: getLS("mh_pantry", SAMPLE_PANTRY),
  plans: getLS("mh_plans", SAMPLE_PLANS),
  favs: getLS("mh_favs", SAMPLE_FAVS),
  monthCursor: new Date(),
  metric: getLS("mh_metric", true),
  theme: getLS("mh_theme", "dark"),
};

/* ----------------- Persistence helpers ----------------- */
function persist() {
  setLS("mh_recipes", state.recipes);
  setLS("mh_pantry", state.pantry);
  setLS("mh_plans", state.plans);
  setLS("mh_favs", state.favs);
  setLS("mh_metric", state.metric);
  setLS("mh_theme", state.theme);
}

/* ----------------- View Switching ----------------- */
$$(".tab").forEach((btn) =>
  btn.addEventListener("click", () => {
    const view = btn.dataset.view;
    showView(view);
    localStorage.setItem("mh_last_view", view);
  })
);

function showView(view) {
  $$(".tab").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === view)
  );
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === view));
  render(); // update widgets that depend on data
}
const last = localStorage.getItem("mh_last_view") || "home";
showView(last);

/* ----------------- Theme toggle ----------------- */
$("#toggleThemeBtn")?.addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme();
  persist();
  $("#profileMenu").hidden = true;
});
function applyTheme() {
  document.body.classList.toggle("light", state.theme === "light");
}
applyTheme();

/* ----------------- Profile menu ----------------- */
$("#profileBtn")?.addEventListener("click", () => {
  const m = $("#profileMenu");
  m.hidden = !m.hidden;
  $("#profileBtn").setAttribute("aria-expanded", String(!m.hidden));
});
document.addEventListener("click", (e) => {
  const m = $("#profileMenu");
  if (!m) return;
  if (!m.hidden && !m.contains(e.target) && e.target !== $("#profileBtn"))
    m.hidden = true;
});

/* ----------------- Home Widgets ----------------- */
function renderTrending() {
  const wrap = $("#trendingGrid");
  if (!wrap) return;
  wrap.innerHTML = state.recipes
    .slice(0, 6)
    .map((r) => recipeCard(r))
    .join("");
  hookRecipeButtons(wrap);
}

function renderExpiringSoon() {
  const ul = $("#expiringList");
  if (!ul) return;
  const soon = state.pantry
    .filter((p) => p.expiry)
    .map((p) => ({
      ...p,
      days: Math.ceil((new Date(p.expiry) - new Date()) / 86400000),
    }))
    .filter((p) => p.days <= 7)
    .sort((a, b) => a.days - b.days)
    .slice(0, 6);
  ul.innerHTML =
    soon
      .map(
        (s) =>
          `<li>${s.name} — <strong>${s.days} day${
            s.days !== 1 ? "s" : ""
          }</strong></li>`
      )
      .join("") || "<li>Nothing expiring soon 🎉</li>";
  // notifications badge
  const badge = $("#notifBadge");
  if (badge) {
    const count = soon.length;
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }
}

function renderPantrySummary() {
  const el = $("#pantrySummary");
  if (!el) return;
  const inStock = state.pantry.filter((p) => p.qty > 0).length;
  const low = state.pantry.filter((p) => p.qty > 0 && p.qty <= 1).length;
  const out = state.pantry.filter((p) => p.qty === 0).length;
  el.innerHTML = `
    <div class="stat"><div class="kpi in">${inStock}</div><div>In Stock</div></div>
    <div class="stat"><div class="kpi low">${low}</div><div>Low</div></div>
    <div class="stat"><div class="kpi out">${out}</div><div>Out</div></div>
  `;
}

function renderWeekStrip() {
  const wrap = $("#weeklySnapshot");
  if (!wrap) return;
  const start = new Date(); // today start-of-week (Mon)
  const day = start.getDay();
  const diff = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - diff);
  wrap.innerHTML = "";
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = fmt(d);
    const events = state.plans[key] || [];
    wrap.innerHTML += `
      <div class="day">
        <h4>${d.toLocaleDateString(undefined, {
          weekday: "short",
        })} ${d.getDate()}</h4>
        ${
          events
            .map((ev) => `<span class="pill">${ev.slot}: ${ev.title}</span>`)
            .join("") || '<span class="pill">—</span>'
        }
      </div>`;
  }
}

/* ----------------- Recipes ----------------- */
function recipeCard(r) {
  // Pantry tick calculation
  const pantryNames = state.pantry.map((p) => p.name);
  const haveCount = r.ingredients.filter((ing) =>
    matchIngredientToPantry(ing, pantryNames)
  ).length;
  const allCount = r.ingredients.length;
  const havePct = Math.round((haveCount / allCount) * 100);

  return `<article class="recipe" data-id="${r.id}">
    <div class="thumb">${r.title.split(" ")[0]}</div>
    <div class="body">
      <strong>${r.title}</strong>
      <div class="meta">
        <span>⏱ ${r.minutes} min</span>
        <span>⭐ ${r.rating}</span>
        <span>${haveCount}/${allCount} ingredients (${havePct}%)</span>
      </div>
      <details>
        <summary>Ingredients</summary>
        <ul>${r.ingredients
          .map((i) => {
            const have = matchIngredientToPantry(i, pantryNames);
            return `<li>${have ? "✅" : "⬜"} ${i}</li>`;
          })
          .join("")}</ul>
      </details>
      <details>
        <summary>Recipe</summary>
        <ol>${r.steps.map((s) => `<li>${s}</li>`).join("")}</ol>
      </details>
    </div>
    <div class="actions">
      <button class="btn" data-action="plan">Add to Plan</button>
      <button class="btn" data-action="fav">${
        state.favs.includes(r.id) ? "★ Favourited" : "☆ Favourite"
      }</button>
    </div>
  </article>`;
}

function hookRecipeButtons(scope = document) {
  scope
    .querySelectorAll('.recipe .actions [data-action="plan"]')
    .forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.target.closest(".recipe").dataset.id;
        openPlanDialog(id);
      });
    });
  scope
    .querySelectorAll('.recipe .actions [data-action="fav"]')
    .forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.target.closest(".recipe").dataset.id;
        toggleFavourite(id);
        render(); // update labels
      });
    });
}

function renderRecipes() {
  const q = ($("#recipeSearch")?.value || "").toLowerCase();
  const list = $("#recipeList");
  if (!list) return;
  const filtered = state.recipes.filter((r) =>
    r.title.toLowerCase().includes(q)
  );
  list.innerHTML =
    filtered.map(recipeCard).join("") || "<p>No recipes found.</p>";
  hookRecipeButtons(list);
}

/* ----------------- Favourites ----------------- */
function renderFavourites() {
  const wrap = $("#favList");
  if (!wrap) return;
  const favs = state.recipes.filter((r) => state.favs.includes(r.id));
  wrap.innerHTML = favs.map(recipeCard).join("") || "<p>No favourites yet.</p>";
  hookRecipeButtons(wrap);
}
function toggleFavourite(id) {
  const idx = state.favs.indexOf(id);
  if (idx > -1) state.favs.splice(idx, 1);
  else state.favs.push(id);
  persist();
}

/* ----------------- Planner (Calendar) ----------------- */
function renderCalendar() {
  const month = state.monthCursor;
  const year = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(year, m, 1);
  const startDay = (first.getDay() + 6) % 7; // Monday=0
  const daysInMonth = new Date(year, m + 1, 0).getDate();

  $("#monthLabel").textContent = month.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const cal = $("#calendar");
  if (!cal) return;
  cal.innerHTML = "";
  for (let i = 0; i < startDay; i++) cal.innerHTML += `<div></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = fmt(new Date(year, m, d));
    const events = state.plans[dateKey] || [];
    const html = `
      <div class="cell" data-date="${dateKey}">
        <h4>${d}</h4>
        ${events
          .map(
            (ev, idx) => `
          <div class="event">
            <span>${ev.slot}: ${ev.title}</span>
            <span>
              <button class="btn" data-ev="edit" data-idx="${idx}">✎</button>
              <button class="btn danger" data-ev="del" data-idx="${idx}">🗑</button>
            </span>
          </div>`
          )
          .join("")}
        <button class="btn" data-ev="add">+ Add</button>
      </div>`;
    cal.insertAdjacentHTML("beforeend", html);
  }

  // event handlers
  $$("#calendar .cell").forEach((cell) => {
    cell.querySelector('[data-ev="add"]').addEventListener("click", () => {
      openPlanDialog(null, cell.dataset.date);
    });
    cell.querySelectorAll('[data-ev="del"]').forEach((btn) =>
      btn.addEventListener("click", (e) => {
        const i = +e.target.dataset.idx;
        const key = cell.dataset.date;
        state.plans[key].splice(i, 1);
        if (state.plans[key].length === 0) delete state.plans[key];
        persist();
        render();
      })
    );
    cell.querySelectorAll('[data-ev="edit"]').forEach((btn) =>
      btn.addEventListener("click", (e) => {
        const i = +e.target.dataset.idx;
        const key = cell.dataset.date;
        const ev = state.plans[key][i];
        openPlanDialog(ev.id, key, i);
      })
    );
  });
}
$("#prevMonth")?.addEventListener("click", () => {
  state.monthCursor.setMonth(state.monthCursor.getMonth() - 1);
  renderCalendar();
});
$("#nextMonth")?.addEventListener("click", () => {
  state.monthCursor.setMonth(state.monthCursor.getMonth() + 1);
  renderCalendar();
});

function openPlanDialog(recipeId = null, dateKey = today(), editIndex = null) {
  const dlg = $("#planDialog");
  const form = $("#planForm");
  form.reset();
  form.date.value = dateKey;
  dlg.showModal();
  form.onsubmit = (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const slot = data.slot;
    const date = data.date;
    const r = state.recipes.find(
      (r) => r.id === (recipeId || state.recipes[0].id)
    );
    const item = { id: r.id, title: r.title, slot };
    if (!state.plans[date]) state.plans[date] = [];
    if (editIndex != null) {
      state.plans[date][editIndex] = item;
    } else {
      state.plans[date].push(item);
    }
    persist();
    dlg.close();
    render();
  };
  dlg.querySelector('button[value="cancel"]').onclick = () => dlg.close();
}

/* ----------------- Pantry ----------------- */
function statusOf(p) {
  if (p.qty === 0) return "out";
  if (p.qty <= 1) return "low";
  return "in";
}

function renderPantry() {
  const tbody = $("#pantryTable");
  if (!tbody) return;
  const q = ($("#pantrySearch")?.value || "").toLowerCase();
  const active = $(".chip.active")?.dataset.status || "all";
  const rows = state.pantry
    .filter((p) => p.name.toLowerCase().includes(q))
    .filter((p) => active === "all" || statusOf(p) === active)
    .sort((a, b) => (a.expiry || "").localeCompare(b.expiry || ""));
  tbody.innerHTML =
    rows
      .map(
        (p) => `
    <tr data-id="${p.id}">
      <td>${p.name}</td>
      <td>
        <div class="row-actions">
          <button class="btn" data-q="-">–</button>
          <strong>${p.qty}</strong>
          <button class="btn" data-q="+">+</button>
        </div>
      </td>
      <td>${p.unit || ""}</td>
      <td>${p.expiry || "—"}</td>
      <td>${statusOf(p)}</td>
      <td class="row-actions">
        <button class="btn" data-act="edit">Edit</button>
        <button class="btn danger" data-act="del">Delete</button>
      </td>
    </tr>
  `
      )
      .join("") || '<tr><td colspan="6">No items found.</td></tr>';

  // qty plus/minus
  tbody.querySelectorAll("[data-q]").forEach((b) => {
    b.addEventListener("click", (e) => {
      const tr = e.target.closest("tr");
      const id = tr.dataset.id;
      const it = state.pantry.find((p) => p.id === id);
      if (e.target.dataset.q === "+") it.qty++;
      else it.qty = Math.max(0, it.qty - 1);
      persist();
      renderPantry();
      renderHome();
    });
  });
  // edit / del
  tbody.querySelectorAll('[data-act="del"]').forEach((b) =>
    b.addEventListener("click", (e) => {
      const id = e.target.closest("tr").dataset.id;
      state.pantry = state.pantry.filter((p) => p.id !== id);
      persist();
      render();
    })
  );
  tbody.querySelectorAll('[data-act="edit"]').forEach((b) =>
    b.addEventListener("click", (e) => {
      const id = e.target.closest("tr").dataset.id;
      const it = state.pantry.find((p) => p.id === id);
      openPantryDialog(it);
    })
  );
}
$("#pantrySearch")?.addEventListener("input", renderPantry);
$$(".chip").forEach((ch) =>
  ch.addEventListener("click", (e) => {
    $$(".chip").forEach((c) => c.classList.remove("active"));
    ch.classList.add("active");
    renderPantry();
  })
);

function openPantryDialog(existing = null) {
  const dlg = $("#pantryDialog");
  const form = $("#pantryForm");
  form.reset();
  if (existing) {
    form.querySelector('[name="name"]').value = existing.name;
    form.querySelector('[name="qty"]').value = existing.qty;
    form.querySelector('[name="unit"]').value = existing.unit || "pcs";
    form.querySelector('[name="expiry"]').value = existing.expiry || "";
  }
  dlg.showModal();
  form.onsubmit = (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (existing) {
      existing.name = data.name;
      existing.qty = Number(data.qty);
      existing.unit = data.unit;
      existing.expiry = data.expiry || "";
    } else {
      state.pantry.push({
        id: "p" + Math.random().toString(36).slice(2, 7),
        name: data.name,
        qty: Number(data.qty),
        unit: data.unit,
        expiry: data.expiry || "",
      });
    }
    persist();
    dlg.close();
    renderPantry();
    renderHome();
  };
  dlg.querySelector('button[value="cancel"]').onclick = () => dlg.close();
}
$("#addPantryBtn")?.addEventListener("click", () => openPantryDialog());

/* ----------------- Search bindings ----------------- */
$("#recipeSearch")?.addEventListener("input", renderRecipes);

/* ----------------- Home aggregate ----------------- */
function renderHome() {
  renderTrending();
  renderExpiringSoon();
  renderPantrySummary();
  renderWeekStrip();
}

/* ----------------- Master render ----------------- */
function render() {
  renderHome();
  renderRecipes();
  renderFavourites();
  renderCalendar();
  renderPantry();
}
render();

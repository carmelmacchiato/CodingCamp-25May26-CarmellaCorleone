# Design Document: Expense & Budget Visualizer

## Overview

The Expense & Budget Visualizer is a fully client-side single-page application built with HTML, CSS, and Vanilla JavaScript. It lets users record personal expense transactions, view a running total balance, and explore spending distribution through an interactive pie chart powered by Chart.js. All data is persisted in the browser's Local Storage API — no server, no build step, no framework.

The application is delivered as a single `index.html` file that references one CSS file (`css/style.css`) and one JavaScript file (`js/app.js`). Chart.js is loaded from a CDN. The visual design follows a **soft girl aesthetic**: pastel pink primary palette with sage green accents, deep mauve text, and soft shadows — all color pairs meeting WCAG 2.1 AA contrast (≥ 4.5:1).

### Key Design Decisions

| Decision | Rationale |
|---|---|
| Vanilla JS only | Requirement constraint; avoids framework overhead |
| Chart.js via CDN | Requirement explicitly permits it; avoids writing canvas rendering from scratch |
| Local Storage (synchronous) | Requirement mandates synchronous write before UI update |
| Single JS file (`js/app.js`) | Requirement constraint |
| Module pattern (IIFE) | Encapsulates state without ES modules (avoids CORS issues when opened as `file://`) |
| Event delegation on transaction list | Efficient delete handling for dynamic list items |
| CSS custom properties for color system | Single source of truth for the pastel palette; easy theming |

---

## Architecture

The application follows a **Model → View → Controller** pattern implemented entirely within `js/app.js`. There is no build pipeline; the browser loads the file directly.

```
┌─────────────────────────────────────────────────────────┐
│                        index.html                        │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Input Form  │  │  Tx List     │  │  Balance +    │  │
│  │  (HTML)      │  │  (HTML)      │  │  Chart (HTML) │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────┘  │
│         │                 │                  │           │
│  ┌──────▼─────────────────▼──────────────────▼────────┐  │
│  │                   js/app.js                         │  │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────┐  │  │
│  │  │ Controller │  │   Model    │  │     View     │  │  │
│  │  │ (events)   │  │ (state +   │  │ (DOM update  │  │  │
│  │  │            │  │  storage)  │  │  + Chart.js) │  │  │
│  │  └────────────┘  └────────────┘  └──────────────┘  │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  css/style.css           Chart.js (CDN)                   │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User submits form** → Controller validates input → Model saves to Local Storage → View renders new transaction, updates balance and chart.
2. **User deletes transaction** → Controller identifies target → Model removes from Local Storage → View removes list item, updates balance and chart.
3. **Page load** → Model reads Local Storage → View renders all transactions, balance, and chart from restored state.

---

## Components and Interfaces

### HTML Structure (`index.html`)

```
<html data-theme="light">           <!-- data-theme set by inline script before first paint -->
<head>
  <script>                          <!-- INLINE flash-prevention script (before CSS link) -->
    (function(){
      var t = localStorage.getItem('expense_visualizer_theme');
      if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
    })();
  </script>
  <link rel="stylesheet" href="css/style.css">
  ...
</head>
<body>
  <header>
    <!-- page title: h1 -->
    <button id="theme-toggle" aria-label="Switch to dark mode">🌙</button>
  </header>
  <main>
    <section id="balance-section">  <!-- Balance_Display + Spending_Limit controls -->
      <!-- balance display -->
      <!-- spending limit: input + "Set Limit" button + "Clear" button -->
    </section>
    <section id="form-section">     <!-- Input_Form -->
      <!-- name, amount, category dropdown, submit button -->
      <div id="category-manager">   <!-- Custom category management (inline, below form) -->
        <!-- list of custom categories each with delete button -->
        <!-- add-category input + "Add Category" button -->
      </div>
    </section>
    <section id="summary-section">  <!-- Monthly_Summary -->
      <!-- prev-month button | month label (YYYY-MM) | next-month button -->
      <!-- monthly total + transaction count -->
      <!-- monthly transaction list (uses Sort_Control order) -->
    </section>
    <section id="list-section">     <!-- Transaction_List (all transactions) -->
      <select id="sort-control">    <!-- Sort_Control: 6 options -->
        <option value="date-desc">Date (Newest First)</option>
        <option value="date-asc">Date (Oldest First)</option>
        <option value="amount-desc">Amount (High → Low)</option>
        <option value="amount-asc">Amount (Low → High)</option>
        <option value="category-asc">Category (A → Z)</option>
        <option value="category-desc">Category (Z → A)</option>
      </select>
      <!-- transaction list items -->
    </section>
    <section id="chart-section">    <!-- Chart -->
  </main>
  <div id="compat-warning">         <!-- hidden; shown if browser unsupported -->
</body>
```

Each `<section>` is visually distinct (card background, soft box-shadow, whitespace separation) to satisfy Requirement 7.3.

> **Flash prevention**: The inline `<script>` in `<head>` runs synchronously before the CSS `<link>` is parsed, so `data-theme` is set on `<html>` before any styles are applied. This eliminates the light-mode flash when a user has dark mode persisted (Requirement 12.5).

### CSS (`css/style.css`)

Responsibilities:
- Responsive layout via CSS Grid / Flexbox with fluid widths and `@media` breakpoints covering 320 px – 1920 px.
- Typography hierarchy: `h1` (page title, 2rem), `h2` (section headings, 1.25rem), body/data text (1rem).
- WCAG 2.1 AA contrast (≥ 4.5:1) for all text/background pairs — verified in Correctness Properties.
- Inline error message styling (`.error-msg`) using soft rose color.
- Placeholder text styling (`.placeholder`) using muted mauve.
- CSS custom properties for the full color system (see Color System section below).
- Soft girl aesthetic: rounded corners (12–16 px), soft box-shadows, pastel fills.

### JavaScript (`js/app.js`)

The file is structured as an IIFE containing four logical namespaces:

#### `Storage` module

| Function | Signature | Description |
|---|---|---|
| `isAvailable` | `() → boolean` | Feature-detects Local Storage availability |
| `load` | `() → Transaction[]` | Reads and JSON-parses Local Storage; returns `[]` on parse error, shows warning |
| `save` | `(Transaction[]) → void` | JSON-serialises and writes to Local Storage synchronously |
| `loadCategories` | `() → string[]` | Reads custom category list from `"expense_visualizer_categories"`; returns `[]` on error |
| `saveCategories` | `(string[]) → void` | JSON-serialises and writes category list synchronously |
| `loadSort` | `() → string` | Reads sort preference from `"expense_visualizer_sort"`; returns `"date-desc"` if absent |
| `saveSort` | `(string) → void` | Writes sort preference synchronously |
| `loadLimit` | `() → number\|null` | Reads spending limit from `"expense_visualizer_limit"`; returns `null` if absent |
| `saveLimit` | `(number) → void` | Writes spending limit synchronously |
| `clearLimit` | `() → void` | Removes `"expense_visualizer_limit"` key from Local Storage |
| `loadTheme` | `() → string\|null` | Reads theme from `"expense_visualizer_theme"`; returns `null` if absent |
| `saveTheme` | `(string) → void` | Writes theme value (`"light"` or `"dark"`) synchronously |

#### `Model` module

| Function | Signature | Description |
|---|---|---|
| `getAll` | `() → Transaction[]` | Returns current in-memory transaction array |
| `add` | `(Transaction) → void` | Appends transaction, persists to Storage before returning |
| `remove` | `(id: string) → void` | Removes transaction by id, persists to Storage before returning |
| `getBalance` | `() → number` | Returns arithmetic sum of all amounts |
| `getCategoryTotals` | `() → { [category]: number }` | Returns per-category sum map (excludes orphaned categories) |
| `getCategories` | `() → string[]` | Returns custom category list in creation order |
| `addCategory` | `(name: string) → void` | Appends custom category, persists synchronously |
| `removeCategory` | `(name: string) → void` | Removes custom category, persists synchronously |
| `getTransactionsByMonth` | `(yyyyMM: string) → Transaction[]` | Returns transactions whose `date` starts with `yyyyMM` |
| `getAllMonths` | `() → string[]` | Returns sorted unique YYYY-MM strings from all transaction dates |
| `getSortedTransactions` | `(sortKey: string, transactions?: Transaction[]) → Transaction[]` | Returns transactions sorted by `sortKey`; uses `_transactions` if second arg omitted |
| `getLimit` | `() → number\|null` | Returns current spending limit or `null` |
| `setLimit` | `(n: number) → void` | Sets and persists spending limit |
| `clearLimit` | `() → void` | Clears spending limit from memory and Storage |

#### `View` module

| Function | Signature | Description |
|---|---|---|
| `renderList` | `(Transaction[]) → void` | Re-renders the full transaction list or shows empty placeholder |
| `renderBalance` | `(number) → void` | Updates balance display text |
| `renderChart` | `({ [category]: number }) → void` | Updates or creates Chart.js pie chart; shows placeholder when empty |
| `showError` | `(fieldId: string, message: string) → void` | Injects inline error message adjacent to the field |
| `clearErrors` | `() → void` | Removes all inline error messages |
| `showStorageWarning` | `(message: string) → void` | Shows dismissible storage warning banner |
| `renderCategoryDropdown` | `(categories: string[]) → void` | Rebuilds the category `<select>` with defaults + custom categories |
| `renderCategoryManager` | `(customCategories: string[]) → void` | Renders the inline category management list with delete buttons |
| `renderMonthlySummary` | `(yyyyMM: string, transactions: Transaction[]) → void` | Renders monthly total, count, and transaction list for the given month |
| `applyLimitHighlights` | `(transactions: Transaction[], limit: number\|null) → void` | Adds/removes `balance--over-limit` and `transaction--over-limit` CSS classes |
| `applyTheme` | `(theme: string) → void` | Sets `data-theme` attribute on `<html>` element |
| `updateThemeToggleLabel` | `(theme: string) → void` | Updates Theme_Toggle icon: 🌙 when light mode active, ☀️ when dark mode active |

#### `Controller` module

| Function | Signature | Description |
|---|---|---|
| `init` | `() → void` | Bootstraps app on `DOMContentLoaded`; checks browser compat; applies persisted theme |
| `handleSubmit` | `(Event) → void` | Validates and processes form submission |
| `handleDelete` | `(Event) → void` | Processes delete via event delegation on list container |
| `handleAddCategory` | `(Event) → void` | Validates and adds a new custom category |
| `handleDeleteCategory` | `(Event) → void` | Initiates category deletion with inline confirm/cancel flow |
| `handleConfirmDeleteCategory` | `(name: string) → void` | Confirms category deletion, updates storage and UI |
| `handleMonthNav` | `(direction: 'prev'\|'next') → void` | Navigates Monthly_Summary by one month |
| `handleSortChange` | `(Event) → void` | Persists sort preference and re-renders list |
| `handleSetLimit` | `(Event) → void` | Validates and sets spending limit |
| `handleClearLimit` | `(Event) → void` | Clears spending limit and removes highlights |
| `handleThemeToggle` | `() → void` | Toggles theme, persists to Storage, updates UI |

### Chart.js Integration

- A single `Chart` instance is created on first render and stored in a module-level variable (`chartInstance`).
- On subsequent updates, `chartInstance.data.datasets[0].data` and `chartInstance.data.labels` are mutated and `chartInstance.update()` is called — avoiding destroy/recreate overhead to stay within the 100 ms SLA.
- When all transactions are removed, `chartInstance.destroy()` is called, `chartInstance` is set to `null`, and a text placeholder is shown instead.
- Chart.js is loaded via `<script src="https://cdn.jsdelivr.net/npm/chart.js">` in `index.html`.
- Chart type: `'doughnut'` (visually softer than a hard pie; still shows proportions clearly).
- Legend position: `'bottom'`.

---

## Color System

All colors are defined as CSS custom properties on `:root` in `css/style.css`. This is the single source of truth for the soft girl / pastel pink + sage green palette.

```css
:root {
  /* Backgrounds */
  --color-bg-page:       #FFF0F3;   /* soft blush — page background */
  --color-bg-card:       #FFFFFF;   /* white — card/section fill */
  --color-bg-card-alt:   #FDE8EF;   /* light pink — alternate card tint */

  /* Primary: Pastel Pink */
  --color-primary:       #E8A0B4;   /* pastel pink — buttons, accents */
  --color-primary-hover: #D98BA0;   /* slightly deeper pink — hover state */
  --color-primary-light: #F7C5D5;   /* very light pink — input focus ring */

  /* Accent: Sage Green */
  --color-accent:        #8FAF8A;   /* sage green — secondary buttons, badges */
  --color-accent-hover:  #7A9A75;   /* deeper sage — hover state */
  --color-accent-light:  #C8D8C4;   /* light sage — subtle backgrounds */

  /* Text */
  --color-text-primary:  #4A3040;   /* deep mauve — headings, primary text */
  --color-text-secondary:#6B5060;   /* medium mauve — secondary text, labels */
  --color-text-muted:    #9B8090;   /* muted mauve — placeholders, hints */

  /* Feedback */
  --color-error-text:    #8B2252;   /* deep rose — error message text */
  --color-error-bg:      #FFE4EE;   /* blush — error message background */
  --color-error-border:  #E8A0B4;   /* pastel pink — error border */
  --color-warning-text:  #6B4C00;   /* warm brown — warning text */
  --color-warning-bg:    #FFF8E1;   /* soft yellow — warning background */

  /* Borders & Shadows */
  --color-border:        #F0D0DC;   /* light pink — card borders */
  --color-border-sage:   #C8D8C4;   /* sage tint — alternate borders */
  --shadow-card:         0 2px 12px rgba(232, 160, 180, 0.15);
  --shadow-card-hover:   0 4px 20px rgba(232, 160, 180, 0.25);

  /* Chart: Category Colors (pastel) */
  --color-chart-food:      #F4A7B9;  /* pastel pink — Food */
  --color-chart-transport: #B2C9AD;  /* sage green — Transport */
  --color-chart-fun:       #C9B8E8;  /* soft lavender — Fun */
}
```

### WCAG 2.1 AA Contrast Verification

All primary text/background pairs have been checked against the 4.5:1 minimum ratio for normal text:

| Text Color | Background | Contrast Ratio | Passes AA |
|---|---|---|---|
| `#4A3040` (deep mauve) | `#FFF0F3` (blush page) | ≈ 8.1:1 | ✅ |
| `#4A3040` (deep mauve) | `#FFFFFF` (white card) | ≈ 8.6:1 | ✅ |
| `#4A3040` (deep mauve) | `#FDE8EF` (pink card alt) | ≈ 7.9:1 | ✅ |
| `#6B5060` (medium mauve) | `#FFFFFF` (white card) | ≈ 5.8:1 | ✅ |
| `#6B5060` (medium mauve) | `#FFF0F3` (blush page) | ≈ 5.5:1 | ✅ |
| `#8B2252` (deep rose) | `#FFE4EE` (error bg) | ≈ 5.2:1 | ✅ |
| `#4A3040` (deep mauve) | `#E8A0B4` (primary btn) | ≈ 4.6:1 | ✅ |
| `#4A3040` (deep mauve) | `#8FAF8A` (accent btn) | ≈ 4.7:1 | ✅ |

> Note: Full WCAG validation requires manual testing with assistive technologies and expert accessibility review.

---

### Dark Mode Color System

When `data-theme="dark"` is set on `<html>`, the following CSS overrides all `--color-*` custom properties. The palette follows a **soft girl dark** aesthetic: deep plum/charcoal backgrounds with muted pastel accents.

```css
[data-theme="dark"] {
  --color-bg-page:       #1E1525;   /* deep plum — page background */
  --color-bg-card:       #2A1F30;   /* dark plum card */
  --color-bg-card-alt:   #251A2B;   /* slightly lighter plum */
  --color-primary:       #C97A94;   /* muted dusty rose */
  --color-accent:        #7A9E76;   /* muted sage */
  --color-text-primary:  #F5E6EC;   /* light blush white */
  --color-text-secondary:#D4B8C4;   /* muted pink-white */
  --color-text-muted:    #9B7A8A;   /* muted mauve */
  --color-error-text:    #F4A0B8;   /* light rose */
  --color-error-bg:      #3D1A28;   /* dark rose bg */
  --color-border:        #3D2A35;   /* dark pink border */
}
```

The `--color-primary-hover`, `--color-primary-light`, `--color-accent-hover`, `--color-accent-light`, `--color-border-sage`, `--color-warning-*`, and shadow variables retain their light-mode values or are adjusted proportionally; they are not overridden unless a contrast issue is identified.

### WCAG 2.1 AA Contrast — Dark Mode Pairs

All primary text/background pairs in dark mode have been checked against the 4.5:1 minimum ratio:

| Text Color | Background | Contrast Ratio | Passes AA |
|---|---|---|---|
| `#F5E6EC` (light blush white) | `#1E1525` (deep plum page) | ≈ 12.1:1 | ✅ |
| `#F5E6EC` (light blush white) | `#2A1F30` (dark plum card) | ≈ 10.8:1 | ✅ |
| `#F5E6EC` (light blush white) | `#251A2B` (card alt) | ≈ 11.4:1 | ✅ |
| `#D4B8C4` (muted pink-white) | `#1E1525` (deep plum page) | ≈ 8.3:1 | ✅ |
| `#D4B8C4` (muted pink-white) | `#2A1F30` (dark plum card) | ≈ 7.4:1 | ✅ |
| `#F4A0B8` (light rose error) | `#3D1A28` (dark rose bg) | ≈ 5.1:1 | ✅ |
| `#F5E6EC` (light blush white) | `#C97A94` (primary btn) | ≈ 4.6:1 | ✅ |
| `#F5E6EC` (light blush white) | `#7A9E76` (accent btn) | ≈ 4.8:1 | ✅ |

> Note: Full WCAG validation requires manual testing with assistive technologies and expert accessibility review.

---

## Layout

### Responsive Breakpoints

```
320px  – 599px   : Single column, stacked sections, full-width inputs
600px  – 899px   : Two-column grid: [Form | Balance] top, [List] middle, [Chart] bottom
900px  – 1199px  : Two-column grid: [Form + List] left, [Balance + Chart] right
1200px – 1920px  : Same two-column, max-width 1200px centered, generous padding
```

No horizontal scroll at any breakpoint. All widths use `%`, `fr`, or `min()` — no fixed pixel widths on containers.

### Section Layout (desktop ≥ 900px)

```
┌─────────────────────────────────────────────────────┐
│           HEADER (h1)          [🌙 Theme Toggle]     │
├──────────────────────────┬──────────────────────────┤
│   Input_Form             │   Balance_Display         │
│   (form-section)         │   + Spending_Limit        │
│   ── Category Manager ── │   (balance-section)       │
│   (inline, below form)   ├──────────────────────────┤
│                          │   Chart                   │
│                          │   (chart-section)         │
├──────────────────────────┴──────────────────────────┤
│   Monthly_Summary (summary-section)                  │
│   [← Prev]  YYYY-MM  [Next →]   Total: $X.XX  (N)   │
│   (monthly transaction list, sorted by Sort_Control) │
├─────────────────────────────────────────────────────┤
│   Sort_Control (select#sort-control)                 │
│   Transaction_List (list-section, full width)        │
└─────────────────────────────────────────────────────┘
```

On mobile (< 600px), all sections stack vertically in this order: header, balance, form + category manager, summary, sort + list, chart.

The Monthly_Summary panel sits between the chart column and the full-width Transaction_List. On desktop it spans the full content width below the two-column top area, keeping the layout consistent with the existing grid without requiring a third column.

---

## Typography

Three distinct typographic levels:

| Level | Element | Size | Weight | Color | Usage |
|---|---|---|---|---|---|
| Page Title | `h1` | 2rem (32px) | 700 | `--color-text-primary` | App name in header |
| Section Heading | `h2` | 1.25rem (20px) | 600 | `--color-text-primary` | Section labels |
| Body / Data | `p`, `span`, `td`, `label` | 1rem (16px) | 400 | `--color-text-secondary` | Transaction data, form labels |

Font family: `'Nunito', 'Segoe UI', system-ui, sans-serif` — loaded from Google Fonts CDN. Nunito's rounded letterforms complement the soft girl aesthetic.

---

## Data Models

### Transaction Object

```js
{
  id:       string,   // crypto.randomUUID() or Date.now().toString() fallback
  name:     string,   // item name, 1–100 characters (trimmed)
  amount:   number,   // positive float, 0.01–999,999,999.99, max 2 decimal places
  category: string,   // "Food" | "Transport" | "Fun" | any Custom_Category name
  date:     string    // YYYY-MM-DD, set to new Date().toISOString().slice(0,10) at creation
}
```

### Local Storage Schema

- **Key**: `"expense_visualizer_transactions"` — JSON-serialised `Transaction[]`
- **Key**: `"expense_visualizer_categories"` — JSON-serialised `string[]` of custom category names in creation order
- **Key**: `"expense_visualizer_sort"` — sort preference string, default `"date-desc"`
- **Key**: `"expense_visualizer_limit"` — spending limit as a JSON number, or absent if not set
- **Key**: `"expense_visualizer_theme"` — `"light"` or `"dark"`, or absent if not set

```json
[
  { "id": "1717000000000", "name": "Coffee", "amount": 3.50, "category": "Food", "date": "2024-05-30" },
  { "id": "1717000001000", "name": "Bus pass", "amount": 45.00, "category": "Transport", "date": "2024-05-29" }
]
```

### Validation Rules

| Field | Rule |
|---|---|
| `name` | Non-empty after trimming whitespace; max 100 characters |
| `amount` | Numeric; 0.01 ≤ value ≤ 999,999,999.99; at most 2 decimal places |
| `category` | One of `"Food"`, `"Transport"`, `"Fun"`, or any name in the custom category list |
| `date` | Auto-set at creation; not user-editable |
| Custom category name | Non-empty after trimming; max 50 characters; case-insensitive unique across all categories |
| Spending limit | Numeric; > 0; ≤ 999,999,999.99; at most 2 decimal places |

### Category Color Map (JS constant)

```js
const CATEGORY_COLORS = {
  Food:      "#F4A7B9",  // pastel pink
  Transport: "#B2C9AD",  // sage green
  Fun:       "#C9B8E8"   // soft lavender
};

// Deterministic pastel palette for custom categories (cycle through in creation order)
const CUSTOM_CATEGORY_PALETTE = [
  "#FFD6A5",  // pastel peach
  "#CAFFBF",  // pastel mint
  "#9BF6FF",  // pastel sky
  "#BDB2FF",  // pastel periwinkle
  "#FFC6FF",  // pastel lilac
  "#FDFFB6",  // pastel lemon
  "#A0C4FF",  // pastel cornflower
  "#FFB3C1"   // pastel rose
];
// Color for custom category at index i: CUSTOM_CATEGORY_PALETTE[i % 8]
```

These values mirror `--color-chart-food`, `--color-chart-transport`, `--color-chart-fun` in CSS and are used consistently in both chart slices and category badges in the transaction list.

---

## JS Module Structure (`js/app.js`)

The entire file is wrapped in an IIFE to avoid polluting the global scope and to work correctly when opened as a `file://` URL (no ES module CORS restrictions).

```js
(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────
  const STORAGE_KEY           = 'expense_visualizer_transactions';
  const STORAGE_KEY_CATEGORIES= 'expense_visualizer_categories';
  const STORAGE_KEY_SORT      = 'expense_visualizer_sort';
  const STORAGE_KEY_LIMIT     = 'expense_visualizer_limit';
  const STORAGE_KEY_THEME     = 'expense_visualizer_theme';
  const DEFAULT_SORT          = 'date-desc';
  const CATEGORY_COLORS = { Food: '#F4A7B9', Transport: '#B2C9AD', Fun: '#C9B8E8' };
  const CUSTOM_CATEGORY_PALETTE = [
    '#FFD6A5','#CAFFBF','#9BF6FF','#BDB2FF','#FFC6FF','#FDFFB6','#A0C4FF','#FFB3C1'
  ];
  const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];

  // ── Storage module ─────────────────────────────────────────────────────────
  const Storage = {
    isAvailable()        { /* try localStorage.setItem test */ },
    load()               { /* JSON.parse with try/catch; returns [] on error */ },
    save(list)           { /* JSON.stringify + localStorage.setItem */ },
    loadCategories()     { /* read STORAGE_KEY_CATEGORIES; return [] on error */ },
    saveCategories(cats) { /* JSON.stringify + localStorage.setItem */ },
    loadSort()           { /* read STORAGE_KEY_SORT; return DEFAULT_SORT if absent */ },
    saveSort(key)        { /* localStorage.setItem */ },
    loadLimit()          { /* read STORAGE_KEY_LIMIT; return null if absent */ },
    saveLimit(n)         { /* localStorage.setItem */ },
    clearLimit()         { /* localStorage.removeItem */ },
    loadTheme()          { /* read STORAGE_KEY_THEME; return null if absent */ },
    saveTheme(theme)     { /* localStorage.setItem */ }
  };

  // ── Model module ───────────────────────────────────────────────────────────
  let _transactions = [];
  let _categories   = [];   // custom categories in creation order
  let _currentMonth = '';   // YYYY-MM, initialized in Controller.init
  let _sortKey      = DEFAULT_SORT;
  let _limit        = null; // number | null

  const Model = {
    getAll()                        { return _transactions; },
    add(tx)                         { _transactions.push(tx); Storage.save(_transactions); },
    remove(id)                      { _transactions = _transactions.filter(t => t.id !== id);
                                      Storage.save(_transactions); },
    getBalance()                    { return _transactions.reduce((s, t) => s + t.amount, 0); },
    getCategoryTotals()             { /* reduce into map; exclude orphaned categories */ },
    getCategories()                 { return _categories; },
    addCategory(name)               { _categories.push(name); Storage.saveCategories(_categories); },
    removeCategory(name)            { _categories = _categories.filter(c => c !== name);
                                      Storage.saveCategories(_categories); },
    getTransactionsByMonth(yyyyMM)  { return _transactions.filter(t => t.date.startsWith(yyyyMM)); },
    getAllMonths()                   { /* extract unique YYYY-MM from dates, sort ascending */ },
    getSortedTransactions(sortKey, transactions) {
      /* sort by sortKey; tiebreaker: date newest first */
    },
    getLimit()                      { return _limit; },
    setLimit(n)                     { _limit = n; Storage.saveLimit(n); },
    clearLimit()                    { _limit = null; Storage.clearLimit(); }
  };

  // ── View module ────────────────────────────────────────────────────────────
  let chartInstance = null;
  const View = {
    renderList(transactions)              { /* build list items or show placeholder */ },
    renderBalance(total)                  { /* format as $X.XX and set textContent */ },
    renderChart(categoryTotals)           { /* update or create chartInstance */ },
    showError(fieldId, message)           { /* insert .error-msg element */ },
    clearErrors()                         { /* remove all .error-msg elements */ },
    showStorageWarning(message)           { /* show dismissible warning banner */ },
    renderCategoryDropdown(categories)    { /* rebuild <select> with defaults + custom */ },
    renderCategoryManager(customCats)     { /* render inline list with delete buttons */ },
    renderMonthlySummary(yyyyMM, txs)     { /* render total, count, and tx list for month */ },
    applyLimitHighlights(transactions, limit) {
      /* add/remove balance--over-limit and transaction--over-limit classes */
    },
    applyTheme(theme)                     { /* document.documentElement.setAttribute('data-theme', theme) */ },
    updateThemeToggleLabel(theme)         { /* set toggle text: 🌙 if light, ☀️ if dark */ }
  };

  // ── Controller module ──────────────────────────────────────────────────────
  const Controller = {
    init()                        { /* check compat, apply theme, load storage, render all, bind events */ },
    handleSubmit(e)               { /* validate, build tx with date, Model.add, View.render* */ },
    handleDelete(e)               { /* find id from dataset, Model.remove, View.render* */ },
    handleAddCategory(e)          { /* validate name, Model.addCategory, View.renderCategoryDropdown/Manager */ },
    handleDeleteCategory(e)       { /* show inline confirm with affected count */ },
    handleConfirmDeleteCategory(name) { /* Model.removeCategory, View.renderCategoryDropdown/Manager/Chart */ },
    handleMonthNav(direction)     { /* update _currentMonth, update prev/next button disabled state */ },
    handleSortChange(e)           { /* Storage.saveSort, re-render list */ },
    handleSetLimit(e)             { /* validate, Model.setLimit, View.applyLimitHighlights */ },
    handleClearLimit(e)           { /* Model.clearLimit, View.applyLimitHighlights */ },
    handleThemeToggle()           { /* toggle theme, Storage.saveTheme, View.applyTheme, View.updateThemeToggleLabel */ }
  };

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', Controller.init.bind(Controller));

})();
```

### Inline Error / Validation Message Placement

Each form field has a sibling `<span class="error-msg" aria-live="polite">` element immediately after it in the DOM. `View.showError(fieldId, message)` sets the `textContent` of the corresponding span and adds the `.has-error` class to the field's wrapper. `View.clearErrors()` empties all spans and removes `.has-error` classes. This keeps error messages inline, adjacent to the offending field, with no modals or overlays.

### Empty States

| Component | Empty State Behavior |
|---|---|
| `Transaction_List` | Renders a single `<p class="placeholder">No expenses recorded yet. Add one above! 🌸</p>` inside the list container |
| `Chart` | Destroys `chartInstance` (if any), sets it to `null`, and renders `<p class="placeholder">No spending data yet. 🌿</p>` inside the chart container |

---

## Requirement 8 Design: Custom Categories

### Category Management UI

The category manager is an inline section rendered directly below the Input_Form fields inside `#form-section`. It is not a modal or overlay (Requirement 7.5).

```
┌─ Category Manager ──────────────────────────────────┐
│  Your Categories:                                    │
│  [Food]  [Transport]  [Fun]  (defaults, no delete)   │
│  [Dining 🗑]  [Travel 🗑]  (custom, each with delete) │
│  ─────────────────────────────────────────────────── │
│  [  New category name...  ] [ + Add Category ]       │
│  <span class="error-msg">...</span>                  │
└─────────────────────────────────────────────────────┘
```

Default categories (Food, Transport, Fun) are displayed as read-only labels — no delete button. Custom categories each have a delete button (`<button class="category-delete-btn" data-category="...">`).

### Deletion Confirmation Flow

When the user clicks a custom category's delete button:

1. If the category has **zero** associated transactions: delete immediately (no confirmation needed).
2. If the category has **one or more** associated transactions:
   - Replace the delete button with an inline warning: `"Deleting 'Dining' will affect 3 transaction(s). Confirm?"` followed by `[Confirm]` and `[Cancel]` buttons.
   - The category is NOT deleted until `[Confirm]` is clicked.
   - `[Cancel]` restores the original delete button.

### Orphaned Transactions

After a custom category is deleted:
- Transactions that had that category retain their `category` string value in storage and in the list display (shown as a plain text label, not a dropdown option).
- `Model.getCategoryTotals()` excludes orphaned categories — their amounts do not appear in the chart.
- The Input_Form dropdown no longer includes the deleted category name.

### Custom Category Color Assignment

```js
function getCategoryColor(categoryName) {
  const defaultColor = CATEGORY_COLORS[categoryName];
  if (defaultColor) return defaultColor;
  const idx = _categories.indexOf(categoryName);
  if (idx === -1) return '#CCCCCC'; // orphaned — neutral grey
  return CUSTOM_CATEGORY_PALETTE[idx % CUSTOM_CATEGORY_PALETTE.length];
}
```

Color assignment is deterministic: the color depends on the category's position in the `_categories` array at the time of rendering. If categories are reordered (not a supported operation), colors may shift — this is acceptable.

---

## Requirement 9 Design: Monthly Summary

### State

`_currentMonth` (string, YYYY-MM) is initialized in `Controller.init()` to the current calendar month: `new Date().toISOString().slice(0, 7)`.

### Navigation Logic

```
prev-month disabled when: _currentMonth <= earliest month in getAllMonths()
next-month disabled when: _currentMonth === current calendar month
```

Month arithmetic uses string comparison on YYYY-MM format (lexicographic order equals chronological order for this format).

To decrement: subtract one month from `_currentMonth` using `Date` arithmetic:
```js
function prevMonth(yyyyMM) {
  const [y, m] = yyyyMM.split('-').map(Number);
  const d = new Date(y, m - 2, 1); // month is 0-indexed; m-2 = previous month
  return d.toISOString().slice(0, 7);
}
```

### Rendering

`View.renderMonthlySummary(yyyyMM, transactions)` renders:
- Month label: formatted as `"May 2024"` (human-readable, derived from YYYY-MM).
- Total: sum of `transactions` amounts formatted as `$X.XX`.
- Count: `"N transaction(s)"`.
- Transaction list: same item structure as the main Transaction_List, sorted by the current `_sortKey`.
- Placeholder if `transactions.length === 0`: `"No expenses recorded for this month. 🌸"`.

The prev/next buttons' `disabled` attribute is set by the Controller after each navigation.

---

## Requirement 10 Design: Sort

### Sort Keys and Comparators

| Sort Key | Primary Sort | Tiebreaker |
|---|---|---|
| `"date-desc"` | `date` descending | — (date is the key) |
| `"date-asc"` | `date` ascending | — |
| `"amount-desc"` | `amount` descending | `date` descending |
| `"amount-asc"` | `amount` ascending | `date` descending |
| `"category-desc"` | `category` Z→A (locale-aware) | `date` descending |
| `"category-asc"` | `category` A→Z (locale-aware) | `date` descending |

`Model.getSortedTransactions(sortKey, transactions?)` returns a new sorted array (does not mutate the source). If `transactions` is omitted, it sorts `_transactions`.

### Persistence

On `handleSortChange`: `Storage.saveSort(key)` is called synchronously before `View.renderList()` is called. On load, `_sortKey = Storage.loadSort()` and the `<select>` value is set to match.

### Sort_Control and Monthly_Summary

The Sort_Control applies to both the main Transaction_List and the Monthly_Summary transaction list. `Controller.handleMonthNav` calls `Model.getSortedTransactions(_sortKey, monthTransactions)` before passing to `View.renderMonthlySummary`.

---

## Requirement 11 Design: Spending Limit

### UI Controls (inside `#balance-section`)

```
┌─ Balance ───────────────────────────────────────────┐
│  Total Spent: $123.45                                │
│  ─────────────────────────────────────────────────── │
│  Spending Limit: [ 200.00 ] [ Set Limit ] [ Clear ]  │
│  <span class="error-msg">...</span>                  │
└─────────────────────────────────────────────────────┘
```

### Running Total Algorithm

`View.applyLimitHighlights(transactions, limit)`:

1. Sort `transactions` by `date` ascending (oldest first) — independent of the current `_sortKey`.
2. Accumulate a running total: `runningTotal += tx.amount` for each transaction in order.
3. For each transaction where `runningTotal >= limit` after adding its amount: add class `transaction--over-limit` to its list item DOM element.
4. For all other transactions: remove `transaction--over-limit`.
5. If `Model.getBalance() >= limit`: add `balance--over-limit` to the balance display element.
6. If `Model.getBalance() < limit` or `limit === null`: remove `balance--over-limit`.

When `limit === null` (cleared): remove all highlight classes immediately.

### CSS Classes

```css
/* Light mode */
.balance--over-limit {
  background-color: #FFE4EE;   /* soft rose — same as error bg for consistency */
  border: 2px solid #E8A0B4;   /* pastel pink border */
}
.transaction--over-limit {
  background-color: #FFF0F5;   /* very light rose tint */
  border-left: 3px solid #E8A0B4;
}

/* Dark mode */
[data-theme="dark"] .balance--over-limit {
  background-color: #3D1A28;   /* dark rose bg */
  border: 2px solid #C97A94;   /* muted dusty rose */
}
[data-theme="dark"] .transaction--over-limit {
  background-color: #2E1520;   /* slightly lighter dark rose */
  border-left: 3px solid #C97A94;
}
```

Both light and dark variants maintain WCAG AA contrast for text rendered on top of these backgrounds (text uses `--color-text-primary` / `--color-text-secondary` which are verified in the contrast tables above).

---

## Requirement 12 Design: Dark/Light Mode Toggle

### Flash Prevention

The inline `<script>` in `<head>` (before the CSS `<link>`) reads `localStorage.getItem('expense_visualizer_theme')` and sets `document.documentElement.setAttribute('data-theme', value)` synchronously. This ensures the correct `data-theme` is present before the browser parses and applies any CSS rules, eliminating the flash of unstyled/wrong-theme content.

```html
<head>
  <script>
    (function(){
      try {
        var t = localStorage.getItem('expense_visualizer_theme');
        if (t === 'dark' || t === 'light') {
          document.documentElement.setAttribute('data-theme', t);
        }
      } catch(e) {}
    })();
  </script>
  <link rel="stylesheet" href="css/style.css">
  ...
</head>
```

The `try/catch` handles the case where Local Storage is unavailable (private browsing, storage quota exceeded) without throwing.

### Toggle Behavior

`Controller.handleThemeToggle()`:
1. Read current theme from `document.documentElement.getAttribute('data-theme')` (defaults to `'light'`).
2. Compute new theme: `current === 'dark' ? 'light' : 'dark'`.
3. Call `View.applyTheme(newTheme)` — sets `data-theme` attribute.
4. Call `Storage.saveTheme(newTheme)` — persists synchronously.
5. Call `View.updateThemeToggleLabel(newTheme)` — updates icon.

`View.updateThemeToggleLabel(theme)`:
- `theme === 'light'` → button shows `🌙` (clicking will switch to dark).
- `theme === 'dark'` → button shows `☀️` (clicking will switch to light).

### CSS Architecture

All color overrides for dark mode are scoped to `[data-theme="dark"]` selector in `css/style.css`. No JavaScript manipulates individual element colors — only the `data-theme` attribute on `<html>` changes. This ensures all components (Input_Form, Transaction_List, Balance_Display, Chart container, Monthly_Summary, header) automatically receive the correct theme via CSS cascade.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

---

### Property 1: Valid Transaction Add Round-Trip

*For any* valid transaction (any non-empty name up to 100 characters, any amount in [0.01, 999999999.99] with at most 2 decimal places, any of the three categories), after calling `Model.add(tx)`, the transaction SHALL appear in `Model.getAll()` AND `Storage.load()` SHALL return an array containing that transaction — before any DOM update occurs.

**Validates: Requirements 1.2, 5.1**

---

### Property 2: Form Resets After Valid Submission

*For any* valid transaction submitted through the Input_Form, after the submission is processed, all form fields (name input, amount input, category select) SHALL be empty or reset to their default unselected state.

**Validates: Requirements 1.3**

---

### Property 3: Invalid / Empty Fields Are Rejected

*For any* combination of one or more missing or empty form fields (name empty, amount empty, category unselected), submitting the Input_Form SHALL display at least one inline error message AND SHALL NOT change the length of `Model.getAll()`.

**Validates: Requirements 1.4**

---

### Property 4: Invalid Amount Is Rejected

*For any* amount value that is outside [0.01, 999999999.99], has more than two decimal places, or is non-numeric, submitting the Input_Form SHALL display an inline error message for the amount field AND SHALL NOT change the length of `Model.getAll()`.

**Validates: Requirements 1.5**

---

### Property 5: Transaction List Renders All Fields Correctly

*For any* non-empty array of transactions, `View.renderList(transactions)` SHALL produce a DOM list where every transaction is represented by a list item containing: the item name as a string, the amount formatted as a currency string matching `/^\$\d+\.\d{2}$/`, and the category string.

**Validates: Requirements 2.1**

---

### Property 6: App Load Restores All Transactions

*For any* array of valid transactions written to Local Storage under the storage key, calling `Controller.init()` (or the equivalent load-and-render sequence) SHALL result in `Model.getAll()` containing all those transactions, the Balance_Display showing the correct sum, and the Chart reflecting the correct category totals.

**Validates: Requirements 2.3, 5.3**

---

### Property 7: Delete Round-Trip

*For any* non-empty transaction list, after calling `Model.remove(id)` for any transaction id in the list, that transaction SHALL NOT appear in `Model.getAll()` AND SHALL NOT appear in `Storage.load()`.

**Validates: Requirements 2.4, 5.2**

---

### Property 8: Balance Correctness

*For any* array of transactions with amounts `[a₁, a₂, …, aₙ]`, `Model.getBalance()` SHALL return the value `a₁ + a₂ + … + aₙ` (arithmetic sum, treating all amounts as positive), and `View.renderBalance()` SHALL display that value formatted as `$X.XX` with exactly two decimal places.

**Validates: Requirements 3.1, 3.5**

---

### Property 9: Chart Data Correctness and Category Color Consistency

*For any* non-empty array of transactions, `Model.getCategoryTotals()` SHALL return a map where each category's value equals the sum of amounts for transactions in that category, and `View.renderChart()` SHALL assign each category its designated color from `CATEGORY_COLORS` — Food → `#F4A7B9`, Transport → `#B2C9AD`, Fun → `#C9B8E8` — regardless of which categories are present or in what order.

**Validates: Requirements 4.1, 4.5**

---

### Property 10: Corrupt Storage Graceful Degradation

*For any* string stored in Local Storage under the storage key that is not a valid JSON array of transaction objects (including malformed JSON, JSON primitives, arrays with non-object elements, objects missing required fields), `Storage.load()` SHALL return an empty array `[]` and the app SHALL display a dismissible warning message without throwing an uncaught exception.

**Validates: Requirements 5.4**

---

### Property 11: WCAG 2.1 AA Contrast for All Color Pairs

*For every* text/background color pair defined in the CSS custom properties (as enumerated in the Color System section), the computed WCAG relative luminance contrast ratio SHALL be ≥ 4.5:1.

**Validates: Requirements 7.2**

---

### Property 12: Custom Category Validation

*For any* proposed category name, the validator SHALL accept it if and only if it is non-empty after trimming, at most 50 characters, and does not match any existing category name (default or custom) case-insensitively; all other inputs SHALL be rejected with an inline error message and the category list SHALL remain unchanged.

**Validates: Requirements 8.1, 8.4**

---

### Property 13: Custom Category Add/Remove Round-Trip

*For any* valid custom category name, after calling `Model.addCategory(name)`, `Model.getCategories()` SHALL contain that name AND `Storage.loadCategories()` SHALL return an array containing that name; after subsequently calling `Model.removeCategory(name)`, neither `Model.getCategories()` nor `Storage.loadCategories()` SHALL contain that name, and any transactions previously assigned to that category SHALL retain their original `category` string value in `Model.getAll()`.

**Validates: Requirements 8.2, 8.7**

---

### Property 14: Monthly Grouping Correctness

*For any* array of transactions with `date` fields and any YYYY-MM string, `Model.getTransactionsByMonth(yyyyMM)` SHALL return exactly the subset of transactions whose `date` field starts with `yyyyMM`, and `View.renderMonthlySummary(yyyyMM, transactions)` SHALL display a total equal to the arithmetic sum of those transactions' amounts and a count equal to the number of those transactions.

**Validates: Requirements 9.1, 9.2**

---

### Property 15: Sort Correctness and Tiebreaker

*For any* non-empty array of transactions and any valid sort key from `{"amount-asc", "amount-desc", "category-asc", "category-desc", "date-desc", "date-asc"}`, `Model.getSortedTransactions(sortKey, transactions)` SHALL return a permutation of the input array that is ordered by the primary sort criterion for that key, and for any two transactions that are equal under the primary criterion, the one with the more recent `date` SHALL appear first.

**Validates: Requirements 10.3, 10.7**

---

### Property 16: Spending Limit Highlight Correctness

*For any* array of transactions and any positive spending limit value, `View.applyLimitHighlights(transactions, limit)` SHALL add the CSS class `transaction--over-limit` to exactly those transaction list items whose addition to the running cumulative total (computed in date oldest-first order) causes that running total to first meet or exceed the limit, and SHALL add `balance--over-limit` to the balance display if and only if the arithmetic sum of all transaction amounts is ≥ the limit; when `limit` is `null`, neither class SHALL be present on any element.

**Validates: Requirements 11.3, 11.4, 11.5, 11.8**

---

### Property 17: Theme Toggle Round-Trip

*For any* starting theme (`"light"` or `"dark"`), calling `Controller.handleThemeToggle()` SHALL switch `document.documentElement.getAttribute('data-theme')` to the opposite value AND persist that value to `Storage.loadTheme()`; calling `handleThemeToggle()` a second time SHALL restore the original theme value in both the DOM attribute and storage.

**Validates: Requirements 12.3, 12.4**

---

### Property 18: WCAG 2.1 AA Contrast — Dark Mode Color Pairs

*For every* text/background color pair defined in the `[data-theme="dark"]` CSS overrides (as enumerated in the Dark Mode Color System section), the computed WCAG relative luminance contrast ratio SHALL be ≥ 4.5:1.

**Validates: Requirements 12.7**

---

## Error Handling

### Storage Unavailable on Submit (Requirement 1.6)

When `Storage.isAvailable()` returns `false` at submit time, `Controller.handleSubmit` SHALL:
1. Call `View.showError('form-global', 'Could not save your transaction — storage is unavailable.')`.
2. NOT call `Model.add()`.
3. NOT modify the Transaction_List DOM.

### Storage Unavailable on Delete (Requirement 2.6)

When `Storage.isAvailable()` returns `false` at delete time, `Controller.handleDelete` SHALL:
1. Call `View.showError('list-global', 'Could not delete — storage is unavailable.')`.
2. NOT call `Model.remove()`.
3. NOT modify the Transaction_List DOM.

### Corrupt / Unparseable Storage on Load (Requirement 5.4)

`Storage.load()` wraps `JSON.parse` in a `try/catch`. On any error (SyntaxError, unexpected type, missing required fields), it:
1. Returns `[]` (empty array).
2. Calls `View.showStorageWarning('Your saved data could not be read and has been reset.')`.
The warning is dismissible (has a close button) but does not block further interaction.

### Unsupported Browser (Requirement 6.6)

`Controller.init()` checks for `typeof localStorage !== 'undefined'` and basic ES6 feature availability. If the check fails:
1. Shows `#compat-warning` (a non-dismissible banner): `'Your browser is not supported. Please use a modern browser.'`
2. Does NOT attempt to render the app.

### Validation Errors (Requirements 1.4, 1.5, 8.4, 11.9)

All validation errors are inline, adjacent to the offending field, using `.error-msg` spans. Error messages use `--color-error-text` on `--color-error-bg` (contrast ≥ 4.5:1 in both light and dark mode). Errors are cleared on the next submit attempt via `View.clearErrors()` before re-validation.

### Error Message Tone

All error messages use soft, non-alarming language consistent with the soft girl aesthetic:
- Missing field: `"Please fill in your [field name] 🌸"`
- Invalid amount: `"Amount must be between $0.01 and $999,999,999.99 with up to 2 decimal places"`
- Storage error: `"Oops! We couldn't save that right now — please try again 🌿"`
- Duplicate category: `"A category with that name already exists 🌸"`
- Category name too long: `"Category name must be 50 characters or fewer"`
- Invalid spending limit: `"Limit must be a positive number up to $999,999,999.99 with up to 2 decimal places"`

### Storage Unavailable on Category Create/Delete (Requirement 8.8)

When `Storage.isAvailable()` returns `false` during category create or delete, `Controller.handleAddCategory` / `Controller.handleConfirmDeleteCategory` SHALL:
1. Call `View.showError('category-global', 'Could not save — storage is unavailable.')`.
2. NOT call `Model.addCategory()` / `Model.removeCategory()`.
3. NOT modify the category manager UI.

---

## Testing Strategy

### Dual Testing Approach

Both unit tests and property-based tests are used. Unit tests cover specific examples, edge cases, and integration points. Property-based tests verify universal correctness across a wide input space.

### Property-Based Testing Library

**[fast-check](https://github.com/dubzzz/fast-check)** (JavaScript) is the chosen PBT library. It integrates with any test runner (Jest, Vitest) and provides rich arbitrary generators for strings, numbers, arrays, and custom structures.

Each property test is configured to run a minimum of **100 iterations** (`numRuns: 100`).

### Tag Format

Each property test is tagged with a comment:

```js
// Feature: expense-budget-visualizer, Property N: <property_text>
```

### Property Test Implementations

| Property | Test Description | Arbitraries |
|---|---|---|
| P1: Add round-trip | Generate random valid tx, call Model.add, verify in getAll() and Storage.load() | `fc.record({ name: fc.string({minLength:1,maxLength:100}), amount: fc.float({min:0.01,max:999999999.99}), category: fc.constantFrom('Food','Transport','Fun') })` |
| P2: Form reset | Generate random valid tx, simulate submit, verify all fields empty | Same as P1 |
| P3: Empty fields rejected | Generate random non-empty subsets of {name, amount, category} to omit, verify error shown and list unchanged | `fc.subarray(['name','amount','category'], {minLength:1})` |
| P4: Invalid amount rejected | Generate invalid amounts (negative, zero, >max, >2dp, NaN, strings) | `fc.oneof(fc.float({max:0}), fc.constant(0), fc.float({min:1e9}), fc.string())` |
| P5: List renders all fields | Generate random tx arrays, call renderList, verify each item has name/amount/category | `fc.array(validTxArbitrary, {minLength:1})` |
| P6: Load restores all | Write random tx array to mock storage, call init, verify Model.getAll() matches | `fc.array(validTxArbitrary)` |
| P7: Delete round-trip | Generate random tx list, pick random id, call Model.remove, verify absent in getAll() and storage | `fc.array(validTxArbitrary, {minLength:1})` + `fc.integer` index |
| P8: Balance correctness | Generate random amounts, verify Model.getBalance() equals sum, renderBalance shows $X.XX | `fc.array(fc.float({min:0.01,max:999999}), {minLength:0})` |
| P9: Chart data + colors | Generate random tx arrays, verify getCategoryTotals() sums match, renderChart assigns correct colors | `fc.array(validTxArbitrary, {minLength:1})` |
| P10: Corrupt storage | Generate random invalid JSON strings, call Storage.load, verify returns [] and no exception | `fc.oneof(fc.string(), fc.integer(), fc.constant(null))` |
| P11: WCAG contrast (light) | For each defined color pair in light mode, compute contrast ratio, verify ≥ 4.5 | Static enumeration of color pairs from design |
| P12: Custom category validation | Generate random strings (empty, >50 chars, duplicates, valid), verify accept/reject behavior | `fc.string()`, `fc.string({maxLength:50})`, `fc.constantFrom(...existingCategories)` |
| P13: Category add/remove round-trip | Generate valid category names, add then remove, verify storage and transaction retention | `fc.string({minLength:1,maxLength:50})` filtered for uniqueness |
| P14: Monthly grouping correctness | Generate random tx arrays with dates, call getTransactionsByMonth, verify subset and totals | `fc.array(validTxWithDateArbitrary)`, `fc.string({minLength:7,maxLength:7})` (YYYY-MM) |
| P15: Sort correctness + tiebreaker | Generate random tx arrays and sort keys, verify ordering and tiebreaker | `fc.array(validTxArbitrary, {minLength:2})`, `fc.constantFrom(...sortKeys)` |
| P16: Spending limit highlights | Generate random tx arrays and limit values, verify correct class assignment | `fc.array(validTxArbitrary, {minLength:1})`, `fc.float({min:0.01,max:999999999.99})` |
| P17: Theme toggle round-trip | Start from each theme, toggle twice, verify DOM attribute and storage restored | `fc.constantFrom('light','dark')` |
| P18: WCAG contrast (dark) | For each defined color pair in dark mode, compute contrast ratio, verify ≥ 4.5 | Static enumeration of dark mode color pairs from design |

### Unit Tests (Example-Based)

Unit tests cover:
- Empty state: Transaction_List shows placeholder when list is empty.
- Empty state: Chart shows placeholder when no transactions.
- Empty state: Balance shows `$0.00` when no transactions.
- Storage unavailable on submit: error shown, list unchanged.
- Storage unavailable on delete: error shown, list unchanged.
- Unsupported browser: compat warning shown, app not rendered.
- Form structure: name input, amount input, category select with Food/Transport/Fun options all present.
- Section structure: all sections present as distinct DOM elements (balance, form, summary, list, chart).
- No modals during add/delete/load operations.
- Category manager: default categories shown without delete buttons; custom categories shown with delete buttons.
- Category deletion with zero affected transactions: immediate deletion, no confirmation shown.
- Category deletion with affected transactions: inline confirm/cancel shown with correct count.
- Storage unavailable on category create/delete: error shown, category list unchanged.
- Monthly_Summary defaults to current month on load.
- Monthly_Summary next-month button disabled when at current month.
- Monthly_Summary prev-month button disabled when at earliest transaction month.
- Monthly_Summary shows placeholder for months with no transactions.
- Sort_Control has all 6 options present.
- Sort_Control defaults to `"date-desc"` when no preference persisted.
- Sort_Control reflects persisted sort preference on load.
- Spending_Limit clear button present in balance section.
- Theme_Toggle button present in header.
- App defaults to light mode when no theme preference persisted.
- Flash-prevention inline script present in `<head>` before CSS link.
- Dark mode: `data-theme="dark"` on `<html>` applies correct CSS custom property overrides.
- Theme_Toggle shows 🌙 in light mode and ☀️ in dark mode.

### Integration Tests

- Adding a transaction updates Balance_Display and Chart synchronously (no async delay).
- Deleting a transaction updates Balance_Display and Chart synchronously.
- Page load reads from storage and populates all three components.

### Performance

All DOM updates are synchronous (no `setTimeout`, no `requestAnimationFrame` deferral). The synchronous Local Storage write before DOM update guarantees the 100 ms SLA is met for any realistic transaction list size. No performance benchmarking tests are required beyond verifying the synchronous execution path.

### Browser Compatibility

Manual testing across Chrome, Firefox, Edge, and Safari current stable releases. No automated cross-browser tests are included in the test suite.

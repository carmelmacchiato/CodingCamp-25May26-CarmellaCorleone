# Implementation Plan: Expense & Budget Visualizer

## Overview

Build a fully client-side single-page application using HTML, CSS, and Vanilla JavaScript (IIFE/MVC pattern). The app records expense transactions, displays a running balance, visualizes spending by category via a Chart.js doughnut chart, and persists all data in Local Storage. Implementation proceeds in layers: project scaffolding → CSS design system → Storage module → Model module → View module → Controller module → feature wiring.

## Tasks

- [x] 1. Scaffold project structure and HTML skeleton
  - Create `index.html` at the project root with the full HTML structure: `<html data-theme="light">`, `<head>` with flash-prevention inline script (reads `expense_visualizer_theme` from localStorage and sets `data-theme` before CSS link), Google Fonts Nunito link, `<link rel="stylesheet" href="css/style.css">`, Chart.js CDN script tag
  - Add `<body>` with `<header>` (h1 app title + `<button id="theme-toggle">`), `<main>` containing sections: `#balance-section`, `#form-section` (with `#category-manager` inside), `#summary-section`, `#list-section` (with `<select id="sort-control">` and 6 options), `#chart-section`
  - Add `<div id="compat-warning">` (hidden by default) for unsupported browser banner
  - Add all inline `<span class="error-msg" aria-live="polite">` siblings for every form field
  - Create empty `css/style.css` and `js/app.js` files to satisfy the single-file-per-directory constraint
  - _Requirements: 6.4, 6.5, 7.3, 7.5, 12.5_

- [x] 2. Implement CSS design system and responsive layout
  - [x] 2.1 Define all CSS custom properties and typography
    - Write all `:root` `--color-*` custom properties for the light-mode soft girl palette (backgrounds, primary pink, accent sage, text mauve, feedback, borders, shadows, chart colors) exactly as specified in the Color System section
    - Write `[data-theme="dark"]` block overriding all relevant `--color-*` properties with deep plum/charcoal palette
    - Set `font-family: 'Nunito', 'Segoe UI', system-ui, sans-serif` on `body`
    - Define three typographic levels: `h1` (2rem, weight 700, `--color-text-primary`), `h2` (1.25rem, weight 600, `--color-text-primary`), body/data text `p, span, label` (1rem, weight 400, `--color-text-secondary`)
    - _Requirements: 7.1, 7.2, 12.2, 12.6, 12.7_
  - [x] 2.2 Implement responsive layout and section card styles
    - Implement CSS Grid/Flexbox layout with 4 breakpoints: 320–599px (single column stacked), 600–899px (two-column: form|balance top, list middle, chart bottom), 900–1199px (two-column: form+list left, balance+chart right), 1200–1920px (same two-column, max-width 1200px centered)
    - Style each `<section>` as a visually distinct card: `--color-bg-card` background, `--color-border` border, `--shadow-card` box-shadow, 12–16px border-radius, whitespace padding
    - Style `.error-msg` using `--color-error-text` on `--color-error-bg` with `--color-error-border`
    - Style `.placeholder` using `--color-text-muted`
    - Add `.balance--over-limit` and `.transaction--over-limit` CSS classes for both light and dark mode as specified in the Requirement 11 Design section
    - _Requirements: 7.3, 7.4, 11.3, 11.4, 11.5_

- [x] 3. Implement the Storage module inside the IIFE in `js/app.js`
  - [x] 3.1 Implement Storage module core functions
    - Wrap the entire file in an IIFE with `'use strict'`
    - Define all constants: `STORAGE_KEY`, `STORAGE_KEY_CATEGORIES`, `STORAGE_KEY_SORT`, `STORAGE_KEY_LIMIT`, `STORAGE_KEY_THEME`, `DEFAULT_SORT`, `CATEGORY_COLORS`, `CUSTOM_CATEGORY_PALETTE`, `DEFAULT_CATEGORIES`
    - Implement `Storage.isAvailable()`: feature-detects Local Storage by attempting a test `setItem`/`removeItem` in a try/catch, returns boolean
    - Implement `Storage.load()`: reads `STORAGE_KEY`, JSON-parses with try/catch, returns `[]` on any error and calls `View.showStorageWarning` (forward reference — wire after View is defined)
    - Implement `Storage.save(list)`: JSON-stringifies and writes to `STORAGE_KEY` synchronously
    - Implement `Storage.loadCategories()` / `Storage.saveCategories(cats)`: read/write `STORAGE_KEY_CATEGORIES`, return `[]` on error
    - Implement `Storage.loadSort()` / `Storage.saveSort(key)`: read/write `STORAGE_KEY_SORT`, return `DEFAULT_SORT` if absent
    - Implement `Storage.loadLimit()` / `Storage.saveLimit(n)` / `Storage.clearLimit()`: read/write/remove `STORAGE_KEY_LIMIT`, return `null` if absent
    - Implement `Storage.loadTheme()` / `Storage.saveTheme(theme)`: read/write `STORAGE_KEY_THEME`, return `null` if absent
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 10.4, 11.2, 12.4_

- [x] 4. Implement the Model module
  - [x] 4.1 Implement core transaction Model functions
    - Declare module-level state variables: `_transactions`, `_categories`, `_currentMonth`, `_sortKey`, `_limit`
    - Implement `Model.getAll()`, `Model.add(tx)` (push + `Storage.save` before returning), `Model.remove(id)` (filter + `Storage.save` before returning)
    - Implement `Model.getBalance()`: arithmetic sum of all `amount` values
    - Implement `Model.getCategoryTotals()`: reduce into a `{ [category]: number }` map, excluding categories not in `DEFAULT_CATEGORIES` or `_categories` (orphaned category exclusion)
    - _Requirements: 1.2, 2.4, 3.1, 3.5, 4.1, 5.1, 5.2_

  - [x] 4.5 Implement category and sort Model functions
    - Implement `Model.getCategories()`, `Model.addCategory(name)` (push + `Storage.saveCategories`), `Model.removeCategory(name)` (filter + `Storage.saveCategories`)
    - Implement `Model.getTransactionsByMonth(yyyyMM)`: filter transactions where `date.startsWith(yyyyMM)`
    - Implement `Model.getAllMonths()`: extract unique YYYY-MM prefixes from all transaction dates, return sorted ascending
    - Implement `Model.getSortedTransactions(sortKey, transactions?)`: returns a new sorted array using the 6 sort keys with date-descending tiebreaker; if `transactions` omitted, sorts `_transactions`
    - Implement `Model.getLimit()`, `Model.setLimit(n)` (set `_limit` + `Storage.saveLimit`), `Model.clearLimit()` (set `_limit = null` + `Storage.clearLimit`)
    - _Requirements: 8.2, 8.7, 9.1, 10.3, 10.7, 11.2_

- [x] 5. Implement the View module — rendering and DOM updates
  - [x] 5.1 Implement core View rendering functions
    - Implement `View.renderList(transactions)`: builds `<li>` items showing name, amount formatted as `$X.XX`, and category badge; shows `<p class="placeholder">` when array is empty; uses event delegation anchor on `#list-section` for delete buttons
    - Implement `View.renderBalance(total)`: formats total as `$X.XX` and sets `textContent` of the balance display element
    - Implement `View.showError(fieldId, message)` / `View.clearErrors()`: injects/clears `.error-msg` span content and `.has-error` class on field wrappers
    - Implement `View.showStorageWarning(message)`: shows a dismissible warning banner with a close button
    - _Requirements: 2.1, 2.2, 2.5, 3.1, 3.4, 5.4, 6.6, 7.5_

  - [x] 5.4 Implement Chart.js integration in View
    - Implement `View.renderChart(categoryTotals)`: creates a Chart.js `'doughnut'` instance on first call (stored in `chartInstance`); on subsequent calls mutates `chartInstance.data` and calls `chartInstance.update()` to stay within 100 ms SLA; assigns colors from `CATEGORY_COLORS` for defaults and `getCategoryColor()` for custom categories; destroys instance and shows placeholder `<p>` when `categoryTotals` is empty
    - Define `getCategoryColor(categoryName)` helper using `CATEGORY_COLORS` map and `CUSTOM_CATEGORY_PALETTE` index cycling; returns `'#CCCCCC'` for orphaned categories
    - Set Chart.js legend position to `'bottom'`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 5.6 Implement category, monthly summary, limit highlight, and theme View functions
    - Implement `View.renderCategoryDropdown(categories)`: rebuilds `<select>` with `DEFAULT_CATEGORIES` followed by custom categories in creation order
    - Implement `View.renderCategoryManager(customCats)`: renders inline list showing default categories as read-only labels (no delete button) and custom categories each with `<button class="category-delete-btn" data-category="...">` delete button
    - Implement `View.renderMonthlySummary(yyyyMM, transactions)`: renders human-readable month label (e.g. "May 2024"), total formatted as `$X.XX`, count as "N transaction(s)", sorted transaction list, and placeholder if empty
    - Implement `View.applyLimitHighlights(transactions, limit)`: sorts transactions by date ascending, accumulates running total, adds `transaction--over-limit` to items where running total first meets/exceeds limit, removes from all others; adds/removes `balance--over-limit` on balance element based on `Model.getBalance() >= limit`; removes all classes when `limit === null`
    - Implement `View.applyTheme(theme)`: sets `data-theme` attribute on `document.documentElement`
    - Implement `View.updateThemeToggleLabel(theme)`: sets `#theme-toggle` text to `🌙` when `theme === 'light'`, `☀️` when `theme === 'dark'`
    - _Requirements: 8.3, 9.2, 9.6, 11.3, 11.4, 11.5, 11.8, 12.3, 12.8_

- [x] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement the Controller module — input form and transaction handling
  - [x] 7.1 Implement Controller.init and browser compatibility check
    - Implement `Controller.init()`: checks `typeof localStorage !== 'undefined'` and basic ES6 feature availability; if unsupported, shows `#compat-warning` (non-dismissible) and returns without rendering
    - On successful compat check: reads `_sortKey = Storage.loadSort()`, `_limit = Storage.loadLimit()`, `_categories = Storage.loadCategories()`, `_transactions = Storage.load()`, `_currentMonth = new Date().toISOString().slice(0,7)`
    - Applies persisted theme via `View.applyTheme` and `View.updateThemeToggleLabel`
    - Sets `<select id="sort-control">` value to `_sortKey`
    - Calls all initial render functions: `View.renderCategoryDropdown`, `View.renderCategoryManager`, `View.renderList`, `View.renderBalance`, `View.renderChart`, `View.renderMonthlySummary`, `View.applyLimitHighlights`
    - Binds all event listeners: form submit, list delete (event delegation), add-category, sort-control change, set-limit, clear-limit, theme-toggle, prev/next month buttons
    - _Requirements: 2.3, 5.3, 6.6, 10.2, 10.5, 10.6, 11.2, 12.2, 12.5_
  - [x] 7.2 Implement Controller.handleSubmit with full validation
    - Implement `Controller.handleSubmit(e)`: calls `e.preventDefault()`, calls `View.clearErrors()`
    - Validates: name non-empty after trim (max 100 chars), amount numeric in [0.01, 999999999.99] with at most 2 decimal places, category selected from valid list
    - If `Storage.isAvailable()` returns false: calls `View.showError('form-global', ...)` and returns without adding
    - On valid input: builds transaction object `{ id: crypto.randomUUID() || Date.now().toString(), name, amount, category, date: new Date().toISOString().slice(0,10) }`, calls `Model.add(tx)`, then updates all views: `View.renderList`, `View.renderBalance`, `View.renderChart`, `View.renderMonthlySummary`, `View.applyLimitHighlights`, resets form fields
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 5.1_
 
  - [x] 7.6 Implement Controller.handleDelete
    - Implement `Controller.handleDelete(e)` via event delegation on `#list-section`: reads `data-id` from the clicked delete button's closest list item
    - If `Storage.isAvailable()` returns false: calls `View.showError('list-global', ...)` and returns without removing
    - On valid delete: calls `Model.remove(id)`, then updates all views: `View.renderList`, `View.renderBalance`, `View.renderChart`, `View.renderMonthlySummary`, `View.applyLimitHighlights`
    - _Requirements: 2.4, 2.6, 5.2_

- [x] 8. Implement Controller handlers for custom categories, sort, monthly nav, limit, and theme
  - [x] 8.1 Implement custom category Controller handlers
    - Implement `Controller.handleAddCategory(e)`: validates category name (non-empty after trim, max 50 chars, case-insensitive unique across `DEFAULT_CATEGORIES` + `_categories`); if `Storage.isAvailable()` false shows error and returns; on valid: calls `Model.addCategory(name)`, `View.renderCategoryDropdown(Model.getCategories())`, `View.renderCategoryManager(Model.getCategories())`, clears input
    - Implement `Controller.handleDeleteCategory(e)`: reads `data-category` from clicked delete button; counts affected transactions; if zero affected: calls `Controller.handleConfirmDeleteCategory(name)` immediately; if one or more: replaces delete button with inline warning showing count + `[Confirm]` and `[Cancel]` buttons
    - Implement `Controller.handleConfirmDeleteCategory(name)`: if `Storage.isAvailable()` false shows error and returns; calls `Model.removeCategory(name)`, `View.renderCategoryDropdown`, `View.renderCategoryManager`, `View.renderChart(Model.getCategoryTotals())`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_
  - [x] 8.3 Implement sort, monthly navigation, spending limit, and theme Controller handlers
    - Implement `Controller.handleSortChange(e)`: reads new sort key from `<select>`, calls `Storage.saveSort(key)` synchronously, updates `_sortKey`, calls `View.renderList(Model.getSortedTransactions(_sortKey))` and `View.renderMonthlySummary(_currentMonth, Model.getSortedTransactions(_sortKey, Model.getTransactionsByMonth(_currentMonth)))`
    - Implement `Controller.handleMonthNav(direction)`: computes new `_currentMonth` using `prevMonth()` / next-month arithmetic; clamps to earliest transaction month (prev) and current calendar month (next); updates `disabled` state on prev/next buttons; calls `View.renderMonthlySummary`
    - Implement `Controller.handleSetLimit(e)`: validates limit value (positive number, ≤ 999999999.99, at most 2 decimal places); calls `Model.setLimit(n)`, `View.applyLimitHighlights(Model.getSortedTransactions('date-asc'), Model.getLimit())`
    - Implement `Controller.handleClearLimit(e)`: calls `Model.clearLimit()`, `View.applyLimitHighlights(Model.getAll(), null)`
    - Implement `Controller.handleThemeToggle()`: reads current `data-theme`, computes opposite, calls `View.applyTheme(newTheme)`, `Storage.saveTheme(newTheme)`, `View.updateThemeToggleLabel(newTheme)`
    - _Requirements: 9.3, 9.4, 9.5, 9.7, 10.3, 10.4, 10.8, 11.1, 11.6, 11.7, 11.9, 12.1, 12.3, 12.4, 12.8_

- [x] 9. Wire everything together and validate full integration
  - [x] 9.1 Wire Controller.init bootstrap and verify full render pipeline
    - Confirm `document.addEventListener('DOMContentLoaded', Controller.init.bind(Controller))` is the sole bootstrap entry point at the bottom of the IIFE
    - Verify that `Controller.init` correctly sequences: compat check → theme apply → storage load → all View renders → all event listener bindings
    - Confirm the flash-prevention inline script in `<head>` runs before the CSS `<link>` tag (correct DOM order in `index.html`)
    - Confirm `<select id="sort-control">` value is set to the persisted sort key on load
    - Confirm spending limit input is populated from `Storage.loadLimit()` on load if a value is persisted
    - _Requirements: 2.3, 5.3, 6.6, 10.5, 10.6, 11.2, 12.5_

- [x] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use **fast-check** with a minimum of 100 iterations per property (`numRuns: 100`)
- Each property test file should include the tag comment: `// Feature: expense-budget-visualizer, Property N: <property_text>`
- Unit tests cover empty states, storage-unavailable error paths, unsupported browser banner, and structural assertions (all 6 sort options present, theme toggle present, etc.)
- All DOM updates are synchronous — no `setTimeout` or `requestAnimationFrame` — to guarantee the 100 ms SLA
- The IIFE pattern avoids ES module CORS issues when the app is opened as a `file://` URL
- `crypto.randomUUID()` is used for transaction IDs with `Date.now().toString()` as a fallback for older browsers

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.4", "4.5"] },
    { "id": 5, "tasks": ["4.6", "4.7", "4.8", "4.9", "5.1"] },
    { "id": 6, "tasks": ["5.2", "5.3", "5.4"] },
    { "id": 7, "tasks": ["5.5", "5.6"] },
    { "id": 8, "tasks": ["5.7", "5.8", "5.9", "7.1"] },
    { "id": 9, "tasks": ["7.2", "7.6"] },
    { "id": 10, "tasks": ["7.3", "7.4", "7.5"] },
    { "id": 11, "tasks": ["8.1"] },
    { "id": 12, "tasks": ["8.2", "8.3"] },
    { "id": 13, "tasks": ["8.4", "8.5", "9.1"] },
    { "id": 14, "tasks": ["9.2"] }
  ]
}
```

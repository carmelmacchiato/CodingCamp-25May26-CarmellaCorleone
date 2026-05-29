/* js/app.js — Expense & Budget Visualizer */

(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────
  const STORAGE_KEY            = 'expense_visualizer_transactions';
  const STORAGE_KEY_CATEGORIES = 'expense_visualizer_categories';
  const STORAGE_KEY_SORT       = 'expense_visualizer_sort';
  const STORAGE_KEY_LIMIT      = 'expense_visualizer_limit';
  const STORAGE_KEY_THEME      = 'expense_visualizer_theme';
  const DEFAULT_SORT           = 'date-desc';

  const CATEGORY_COLORS = {
    Food:      '#F4A7B9',
    Transport: '#B2C9AD',
    Fun:       '#C9B8E8'
  };

  const CUSTOM_CATEGORY_PALETTE = [
    '#FFD6A5', '#CAFFBF', '#9BF6FF', '#BDB2FF',
    '#FFC6FF', '#FDFFB6', '#A0C4FF', '#FFB3C1'
  ];

  const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];

  // ── Storage module ─────────────────────────────────────────────────────────
  const Storage = {

    /**
     * Feature-detects Local Storage availability by attempting a test
     * setItem/removeItem in a try/catch.
     * @returns {boolean}
     */
    isAvailable() {
      try {
        const testKey = '__storage_test__';
        localStorage.setItem(testKey, '1');
        localStorage.removeItem(testKey);
        return true;
      } catch (e) {
        return false;
      }
    },

    /**
     * Reads STORAGE_KEY, JSON-parses with try/catch.
     * Returns [] on any error and calls View.showStorageWarning (forward ref).
     * @returns {Array}
     */
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          throw new Error('Stored data is not an array');
        }
        return parsed;
      } catch (e) {
        // View is defined later in the same IIFE — forward reference is safe
        // because load() is only called after the full IIFE has been evaluated.
        if (typeof View !== 'undefined' && View.showStorageWarning) {
          View.showStorageWarning(
            'Could not load saved transactions. Starting with an empty list.'
          );
        }
        return [];
      }
    },

    /**
     * JSON-stringifies and writes list to STORAGE_KEY synchronously.
     * @param {Array} list
     */
    save(list) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    },

    /**
     * Reads STORAGE_KEY_CATEGORIES; returns [] on any error.
     * @returns {string[]}
     */
    loadCategories() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_CATEGORIES);
        if (raw === null) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed;
      } catch (e) {
        return [];
      }
    },

    /**
     * JSON-stringifies and writes cats to STORAGE_KEY_CATEGORIES synchronously.
     * @param {string[]} cats
     */
    saveCategories(cats) {
      localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(cats));
    },

    /**
     * Reads STORAGE_KEY_SORT; returns DEFAULT_SORT if absent.
     * @returns {string}
     */
    loadSort() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_SORT);
        return raw !== null ? raw : DEFAULT_SORT;
      } catch (e) {
        return DEFAULT_SORT;
      }
    },

    /**
     * Writes sort preference to STORAGE_KEY_SORT synchronously.
     * @param {string} key
     */
    saveSort(key) {
      localStorage.setItem(STORAGE_KEY_SORT, key);
    },

    /**
     * Reads STORAGE_KEY_LIMIT; returns null if absent.
     * @returns {number|null}
     */
    loadLimit() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_LIMIT);
        if (raw === null) return null;
        const parsed = JSON.parse(raw);
        return typeof parsed === 'number' ? parsed : null;
      } catch (e) {
        return null;
      }
    },

    /**
     * Writes spending limit to STORAGE_KEY_LIMIT synchronously.
     * @param {number} n
     */
    saveLimit(n) {
      localStorage.setItem(STORAGE_KEY_LIMIT, JSON.stringify(n));
    },

    /**
     * Removes STORAGE_KEY_LIMIT from Local Storage.
     */
    clearLimit() {
      localStorage.removeItem(STORAGE_KEY_LIMIT);
    },

    /**
     * Reads STORAGE_KEY_THEME; returns null if absent.
     * @returns {string|null}
     */
    loadTheme() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_THEME);
        return raw !== null ? raw : null;
      } catch (e) {
        return null;
      }
    },

    /**
     * Writes theme value to STORAGE_KEY_THEME synchronously.
     * @param {string} theme  'light' | 'dark'
     */
    saveTheme(theme) {
      localStorage.setItem(STORAGE_KEY_THEME, theme);
    }

  };

  // ── Model module ───────────────────────────────────────────────────────────
  let _transactions = [];
  let _categories   = [];   // custom categories in creation order
  let _currentMonth = '';   // YYYY-MM, initialized in Controller.init
  let _sortKey      = DEFAULT_SORT;
  let _limit        = null; // number | null

  const Model = {

    /**
     * Returns the current in-memory transaction array.
     * @returns {Array}
     */
    getAll() {
      return _transactions;
    },

    /**
     * Appends a transaction and persists to Storage before returning.
     * @param {Object} tx
     */
    add(tx) {
      _transactions.push(tx);
      Storage.save(_transactions);
    },

    /**
     * Removes a transaction by id and persists to Storage before returning.
     * @param {string} id
     */
    remove(id) {
      _transactions = _transactions.filter(t => t.id !== id);
      Storage.save(_transactions);
    },

    /**
     * Returns the arithmetic sum of all transaction amounts.
     * @returns {number}
     */
    getBalance() {
      return _transactions.reduce((sum, t) => sum + t.amount, 0);
    },

    /**
     * Returns a per-category sum map, excluding orphaned categories
     * (categories not in DEFAULT_CATEGORIES or _categories).
     * @returns {{ [category: string]: number }}
     */
    getCategoryTotals() {
      const validCategories = new Set([...DEFAULT_CATEGORIES, ..._categories]);
      return _transactions.reduce((map, t) => {
        if (!validCategories.has(t.category)) return map;
        map[t.category] = (map[t.category] || 0) + t.amount;
        return map;
      }, {});
    },

    /**
     * Returns the custom category list in creation order.
     * @returns {string[]}
     */
    getCategories() {
      return _categories;
    },

    /**
     * Appends a custom category and persists synchronously.
     * @param {string} name
     */
    addCategory(name) {
      _categories.push(name);
      Storage.saveCategories(_categories);
    },

    /**
     * Removes a custom category and persists synchronously.
     * @param {string} name
     */
    removeCategory(name) {
      _categories = _categories.filter(c => c !== name);
      Storage.saveCategories(_categories);
    },

    /**
     * Returns transactions whose date starts with the given YYYY-MM string.
     * @param {string} yyyyMM
     * @returns {Array}
     */
    getTransactionsByMonth(yyyyMM) {
      return _transactions.filter(t => t.date.startsWith(yyyyMM));
    },

    /**
     * Returns sorted unique YYYY-MM strings from all transaction dates, ascending.
     * @returns {string[]}
     */
    getAllMonths() {
      const months = new Set(_transactions.map(t => t.date.slice(0, 7)));
      return Array.from(months).sort();
    },

    /**
     * Returns transactions sorted by sortKey; tiebreaker is date newest first.
     * Uses _transactions if second arg is omitted.
     * @param {string} sortKey
     * @param {Array} [transactions]
     * @returns {Array}
     */
    getSortedTransactions(sortKey, transactions) {
      const list = (transactions !== undefined ? transactions : _transactions).slice();
      list.sort((a, b) => {
        switch (sortKey) {
          case 'date-desc':
            return b.date.localeCompare(a.date);
          case 'date-asc':
            return a.date.localeCompare(b.date);
          case 'amount-desc':
            if (b.amount !== a.amount) return b.amount - a.amount;
            return b.date.localeCompare(a.date);
          case 'amount-asc':
            if (a.amount !== b.amount) return a.amount - b.amount;
            return b.date.localeCompare(a.date);
          case 'category-asc':
            if (a.category !== b.category) return a.category.localeCompare(b.category);
            return b.date.localeCompare(a.date);
          case 'category-desc':
            if (a.category !== b.category) return b.category.localeCompare(a.category);
            return b.date.localeCompare(a.date);
          default:
            return b.date.localeCompare(a.date);
        }
      });
      return list;
    },

    /**
     * Returns the current spending limit or null.
     * @returns {number|null}
     */
    getLimit() {
      return _limit;
    },

    /**
     * Sets and persists the spending limit.
     * @param {number} n
     */
    setLimit(n) {
      _limit = n;
      Storage.saveLimit(n);
    },

    /**
     * Clears the spending limit from memory and Storage.
     */
    clearLimit() {
      _limit = null;
      Storage.clearLimit();
    }

  };

  // ── View helpers ───────────────────────────────────────────────────────────

  /**
   * Returns the display color for a given category name.
   * - Default categories use CATEGORY_COLORS.
   * - Custom categories cycle through CUSTOM_CATEGORY_PALETTE by creation index.
   * - Orphaned categories (not in either list) return '#CCCCCC'.
   * @param {string} categoryName
   * @returns {string}
   */
  function getCategoryColor(categoryName) {
    if (Object.prototype.hasOwnProperty.call(CATEGORY_COLORS, categoryName)) {
      return CATEGORY_COLORS[categoryName];
    }
    const idx = _categories.indexOf(categoryName);
    if (idx >= 0) {
      return CUSTOM_CATEGORY_PALETTE[idx % CUSTOM_CATEGORY_PALETTE.length];
    }
    return '#CCCCCC';
  }

  // ── View module ────────────────────────────────────────────────────────────
  let chartInstance = null;
  const View = {

    /**
     * Re-renders the full transaction list.
     * Shows a placeholder when the array is empty.
     * Delete buttons carry data-id for event delegation on #list-section.
     * @param {Array} transactions
     */
    renderList(transactions) {
      const list = document.getElementById('transaction-list');
      if (!list) return;

      if (!transactions || transactions.length === 0) {
        list.innerHTML = '<li><p class="placeholder">No expenses recorded yet. Add one above! 🌸</p></li>';
        return;
      }

      list.innerHTML = transactions.map(function (tx) {
        var formattedAmount = '$' + tx.amount.toFixed(2);
        return (
          '<li data-id="' + tx.id + '">' +
            '<span class="tx-name">' + tx.name + '</span>' +
            '<span class="tx-amount">' + formattedAmount + '</span>' +
            '<span class="tx-category-badge">' + tx.category + '</span>' +
            '<button type="button" class="delete-btn" data-id="' + tx.id + '" aria-label="Delete ' + tx.name + '">Delete</button>' +
          '</li>'
        );
      }).join('');
    },

    /**
     * Updates the balance display element with the formatted total.
     * @param {number} total
     */
    renderBalance(total) {
      const display = document.getElementById('balance-display');
      if (!display) return;
      display.textContent = '$' + total.toFixed(2);
    },

    renderChart(categoryTotals) {
      const chartSection = document.getElementById('chart-section');
      if (!chartSection) return;

      const keys = Object.keys(categoryTotals).filter(function (k) {
        return categoryTotals[k] > 0;
      });

      // Empty state: destroy chart and show placeholder
      if (keys.length === 0) {
        if (chartInstance) {
          chartInstance.destroy();
          chartInstance = null;
        }
        const container = document.getElementById('chart-container');
        if (container) {
          container.innerHTML = '<p class="placeholder">No spending data to display. 🌸</p>';
        }
        return;
      }

      const labels = keys;
      const data   = keys.map(function (k) { return categoryTotals[k]; });
      const colors = keys.map(function (k) { return getCategoryColor(k); });

      // Update existing chart instance (stay within 100 ms SLA)
      if (chartInstance) {
        chartInstance.data.labels                        = labels;
        chartInstance.data.datasets[0].data             = data;
        chartInstance.data.datasets[0].backgroundColor  = colors;
        chartInstance.update();
        return;
      }

      // First render: ensure canvas is present (replace placeholder if needed)
      const container = document.getElementById('chart-container');
      if (container) {
        // Remove placeholder paragraph if present; restore canvas if missing
        const placeholder = container.querySelector('p.placeholder');
        if (placeholder) {
          container.innerHTML = '<canvas id="spending-chart" aria-label="Spending distribution pie chart" role="img"></canvas>';
        }
      }

      const canvas = document.getElementById('spending-chart');
      if (!canvas) return;

      chartInstance = new window.Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: colors
          }]
        },
        options: {
          plugins: {
            legend: {
              position: 'bottom'
            }
          }
        }
      });
    },

    /**
     * Sets the error message on the span associated with fieldId and adds
     * .has-error to the field's wrapper element.
     *
     * Supports two calling conventions:
     *   1. fieldId is a form field id (e.g. 'name-input') — reads aria-describedby
     *      to locate the sibling error span, adds .has-error to the wrapper.
     *   2. fieldId is a global error key (e.g. 'form-global', 'list-global') —
     *      looks for a span with id '<fieldId>-error' directly.
     *
     * @param {string} fieldId
     * @param {string} message
     */
    showError(fieldId, message) {
      const field = document.getElementById(fieldId);

      if (field) {
        // Convention 1: real form field — use aria-describedby to find error span
        const errorSpanId = field.getAttribute('aria-describedby');
        if (errorSpanId) {
          const span = document.getElementById(errorSpanId);
          if (span) span.textContent = message;
        }
        // Add .has-error to the wrapper (parent element of the field)
        const wrapper = field.parentElement;
        if (wrapper) wrapper.classList.add('has-error');
      } else {
        // Convention 2: global / non-field error — look for span id '<fieldId>-error'
        const span = document.getElementById(fieldId + '-error');
        if (span) span.textContent = message;
      }
    },

    /**
     * Clears all inline error messages and removes .has-error classes.
     */
    clearErrors() {
      // Empty all error-msg spans
      const spans = document.querySelectorAll('.error-msg');
      spans.forEach(function (span) {
        span.textContent = '';
      });

      // Remove .has-error from all wrappers
      const wrappers = document.querySelectorAll('.has-error');
      wrappers.forEach(function (wrapper) {
        wrapper.classList.remove('has-error');
      });
    },

    /**
     * Shows a dismissible storage warning banner at the top of <main>.
     * If a banner already exists it is replaced.
     * @param {string} message
     */
    showStorageWarning(message) {
      // Remove any existing warning banner
      const existing = document.getElementById('storage-warning-banner');
      if (existing) existing.remove();

      const banner = document.createElement('div');
      banner.id = 'storage-warning-banner';
      banner.setAttribute('role', 'alert');
      banner.setAttribute('aria-live', 'polite');
      banner.className = 'storage-warning-banner';

      const text = document.createElement('span');
      text.textContent = message;

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'storage-warning-close';
      closeBtn.setAttribute('aria-label', 'Dismiss warning');
      closeBtn.textContent = '✕';
      closeBtn.addEventListener('click', function () {
        banner.remove();
      });

      banner.appendChild(text);
      banner.appendChild(closeBtn);

      // Insert at the top of <main>, or before the first child of <body> as fallback
      const main = document.querySelector('main');
      if (main) {
        main.insertBefore(banner, main.firstChild);
      } else {
        document.body.insertBefore(banner, document.body.firstChild);
      }
    },

    /**
     * Rebuilds the category <select> with DEFAULT_CATEGORIES followed by
     * custom categories in creation order.
     * Preserves the current selection if the value still exists.
     * @param {string[]} categories  — custom categories only (in creation order)
     */
    renderCategoryDropdown(categories) {
      const select = document.getElementById('category-select');
      if (!select) return;

      const currentValue = select.value;

      // Build option HTML: placeholder + defaults + custom
      const defaultOptions = DEFAULT_CATEGORIES.map(function (cat) {
        return '<option value="' + cat + '">' + cat + '</option>';
      }).join('');

      const customOptions = (categories || []).map(function (cat) {
        return '<option value="' + cat + '">' + cat + '</option>';
      }).join('');

      select.innerHTML =
        '<option value="">-- Select a category --</option>' +
        defaultOptions +
        customOptions;

      // Restore previous selection if it still exists
      if (currentValue) {
        select.value = currentValue;
      }
    },

    /**
     * Renders the inline category management list.
     * Default categories appear as read-only labels (no delete button).
     * Custom categories each get a delete button with class "category-delete-btn"
     * and data-category attribute.
     * @param {string[]} customCats  — custom categories only (in creation order)
     */
    renderCategoryManager(customCats) {
      const list = document.getElementById('custom-category-list');
      if (!list) return;

      const defaultItems = DEFAULT_CATEGORIES.map(function (cat) {
        return (
          '<li class="category-item category-item--default">' +
            '<span class="category-item-name">' + cat + '</span>' +
          '</li>'
        );
      }).join('');

      const customItems = (customCats || []).map(function (cat) {
        return (
          '<li class="category-item category-item--custom">' +
            '<span class="category-item-name">' + cat + '</span>' +
            '<button type="button" class="category-delete-btn" data-category="' + cat + '" aria-label="Delete category ' + cat + '">Delete</button>' +
          '</li>'
        );
      }).join('');

      list.innerHTML = defaultItems + customItems;
    },

    /**
     * Renders the monthly summary panel for the given YYYY-MM month.
     * Shows a human-readable month label (e.g. "May 2024"), total formatted
     * as $X.XX, count as "N transaction(s)", a sorted transaction list, and
     * a placeholder when there are no transactions.
     * @param {string}   yyyyMM        — e.g. "2024-05"
     * @param {Array}    transactions  — already-sorted transactions for this month
     */
    renderMonthlySummary(yyyyMM, transactions) {
      // Update the month label with a human-readable string
      const monthLabel = document.getElementById('month-label');
      if (monthLabel) {
        if (yyyyMM) {
          const parts = yyyyMM.split('-');
          const year  = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const d = new Date(year, month, 1);
          monthLabel.textContent = d.toLocaleString('default', { month: 'long', year: 'numeric' });
        } else {
          monthLabel.textContent = '';
        }
      }

      const txs = transactions || [];

      // Total and count
      const total = txs.reduce(function (sum, t) { return sum + t.amount; }, 0);
      const monthlyTotal = document.getElementById('monthly-total');
      if (monthlyTotal) {
        monthlyTotal.textContent = 'Total: $' + total.toFixed(2);
      }

      const monthlyCount = document.getElementById('monthly-count');
      if (monthlyCount) {
        monthlyCount.textContent = txs.length + ' transaction' + (txs.length === 1 ? '' : 's');
      }

      // Category breakdown instead of transaction list
      const monthlyList = document.getElementById('monthly-transaction-list');
      if (!monthlyList) return;

      if (txs.length === 0) {
        monthlyList.innerHTML = '<li><p class="placeholder">No expenses recorded for this month. 🌸</p></li>';
        return;
      }

      // Group by category
      var categoryTotals = {};
      txs.forEach(function (tx) {
        if (!categoryTotals[tx.category]) {
          categoryTotals[tx.category] = 0;
        }
        categoryTotals[tx.category] += tx.amount;
      });

      // Render category breakdown as table
      var categories = Object.keys(categoryTotals).sort();
      var tableHTML = '<table class="monthly-table">' +
        '<thead><tr><th>Category</th><th>Amount Spent</th></tr></thead>' +
        '<tbody>';
      tableHTML += categories.map(function (cat) {
        return '<tr><td>' + cat + '</td><td>$' + categoryTotals[cat].toFixed(2) + '</td></tr>';
      }).join('');
      tableHTML += '</tbody></table>';
      monthlyList.innerHTML = tableHTML;
    },

    /**
     * Adds/removes `transaction--over-limit` and `balance--over-limit` CSS classes.
     *
     * When limit is a number:
     *   - Sorts transactions by date ascending (oldest first).
     *   - Accumulates a running total; the FIRST transaction whose addition causes
     *     the running total to meet or exceed the limit gets `transaction--over-limit`.
     *     All subsequent transactions also get the class; all prior ones do not.
     *   - Adds `balance--over-limit` to the balance element when
     *     Model.getBalance() >= limit; removes it otherwise.
     *
     * When limit is null:
     *   - Removes all `transaction--over-limit` and `balance--over-limit` classes.
     *
     * @param {Array}         transactions  — all transactions (any order; sorted internally)
     * @param {number|null}   limit
     */
    applyLimitHighlights(transactions, limit) {
      const balanceSection = document.getElementById('balance-section');
      const txList    = document.getElementById('transaction-list');

      // Helper: remove all over-limit classes from the transaction list
      function clearAllHighlights() {
        if (txList) {
          txList.querySelectorAll('.transaction--over-limit').forEach(function (el) {
            el.classList.remove('transaction--over-limit');
          });
        }
        if (balanceSection) {
          balanceSection.classList.remove('balance--over-limit');
          var notice = balanceSection.querySelector('.over-budget-notice');
          if (notice) notice.remove();
        }
      }

      if (limit === null || limit === undefined) {
        clearAllHighlights();
        return;
      }

      // Sort transactions by date ascending (oldest first) to compute running total
      const sorted = (transactions || []).slice().sort(function (a, b) {
        return a.date.localeCompare(b.date);
      });

      // Determine which transaction IDs are over-limit
      const overLimitIds = new Set();
      let running = 0;
      let limitReached = false;
      for (var i = 0; i < sorted.length; i++) {
        running += sorted[i].amount;
        if (!limitReached && running >= limit) {
          limitReached = true;
        }
        if (limitReached) {
          overLimitIds.add(sorted[i].id);
        }
      }

      // Apply/remove classes on rendered list items
      if (txList) {
        txList.querySelectorAll('li[data-id]').forEach(function (li) {
          const id = li.getAttribute('data-id');
          if (overLimitIds.has(id)) {
            li.classList.add('transaction--over-limit');
          } else {
            li.classList.remove('transaction--over-limit');
          }
        });
      }

      // Balance highlight: based on Model.getBalance() vs limit
      if (balanceSection) {
        if (Model.getBalance() >= limit) {
          balanceSection.classList.add('balance--over-limit');
          // Show over-budget notification
          var existingNotice = balanceSection.querySelector('.over-budget-notice');
          if (!existingNotice) {
            var notice = document.createElement('div');
            notice.className = 'over-budget-notice';
            notice.innerHTML = '<span class="notice-icon">⚠️</span> You\'ve exceeded your spending limit of $' + limit.toFixed(2) + '!';
            balanceSection.appendChild(notice);
          }
        } else {
          balanceSection.classList.remove('balance--over-limit');
          // Remove over-budget notification
          var notice = balanceSection.querySelector('.over-budget-notice');
          if (notice) notice.remove();
        }
      }
    },

    /**
     * Sets the data-theme attribute on <html> to apply the given theme.
     * @param {string} theme  'light' | 'dark'
     */
    applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
    },

    /**
     * Updates the #theme-toggle button text to indicate the NEXT theme:
     *   🌙  when current theme is 'light'  (clicking will switch to dark)
     *   ☀️  when current theme is 'dark'   (clicking will switch to light)
     * @param {string} theme  'light' | 'dark'
     */
    updateThemeToggleLabel(theme) {
      const btn = document.getElementById('theme-toggle');
      if (!btn) return;
      if (theme === 'dark') {
        btn.textContent = '☀️';
        btn.setAttribute('aria-label', 'Switch to light mode');
      } else {
        btn.textContent = '🌙';
        btn.setAttribute('aria-label', 'Switch to dark mode');
      }
    }
  };

  // ── Controller module ──────────────────────────────────────────────────────
  const Controller = {

    /**
     * Bootstraps the app on DOMContentLoaded.
     * 1. Checks browser compatibility (localStorage + ES6 features).
     * 2. Loads persisted state into module-level variables.
     * 3. Applies persisted theme.
     * 4. Renders all UI components.
     * 5. Binds all event listeners.
     */
    init() {
      // ── 1. Browser compatibility check ──────────────────────────────────
      var compatible = true;

      // Check localStorage availability
      if (typeof localStorage === 'undefined') {
        compatible = false;
      }

      // Check ES6 feature availability
      if (compatible) {
        try {
          // Arrow functions
          new Function('return () => {}')();
          // const / let
          new Function('"use strict"; const x = 1; let y = 2;')();
          // Template literals
          new Function('const a = 1; return `${a}`;')();
          // Destructuring
          new Function('const {a} = {a:1}; const [b] = [2];')();
          // Promise
          new Function('return typeof Promise !== "undefined" && typeof Promise.resolve === "function";')();
        } catch (e) {
          compatible = false;
        }
      }

      if (!compatible) {
        var warning = document.getElementById('compat-warning');
        if (warning) {
          warning.style.display = '';
        }
        return;
      }

      // ── 2. Load persisted state ──────────────────────────────────────────
      _sortKey      = Storage.loadSort();
      _limit        = Storage.loadLimit();
      _categories   = Storage.loadCategories();
      _transactions = Storage.load();
      _currentMonth = new Date().toISOString().slice(0, 7);

      // ── 3. Apply persisted theme ─────────────────────────────────────────
      var theme = Storage.loadTheme() || 'light';
      View.applyTheme(theme);
      View.updateThemeToggleLabel(theme);

      // ── 4. Set sort-control select value ────────────────────────────────
      var sortControl = document.getElementById('sort-control');
      if (sortControl) {
        sortControl.value = _sortKey;
      }

      // ── 4b. Populate spending limit input from persisted value ───────────
      if (_limit !== null) {
        var limitInput = document.getElementById('limit-input');
        if (limitInput) {
          limitInput.value = _limit;
        }
      }

      // ── 5. Initial renders ───────────────────────────────────────────────
      View.renderCategoryDropdown(_categories);
      View.renderCategoryManager(_categories);
      View.renderList(Model.getSortedTransactions(_sortKey));
      View.renderBalance(Model.getBalance());
      View.renderChart(Model.getCategoryTotals());
      View.renderMonthlySummary(
        _currentMonth,
        Model.getSortedTransactions(_sortKey, Model.getTransactionsByMonth(_currentMonth))
      );
      View.applyLimitHighlights(_transactions, _limit);

      // ── 6. Bind event listeners ──────────────────────────────────────────
      var expenseForm = document.getElementById('expense-form');
      if (expenseForm) {
        expenseForm.addEventListener('submit', Controller.handleSubmit.bind(Controller));
      }

      var listSection = document.getElementById('list-section');
      if (listSection) {
        listSection.addEventListener('click', Controller.handleDelete.bind(Controller));
      }

      var addCategoryBtn = document.getElementById('add-category-btn');
      if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', Controller.handleAddCategory.bind(Controller));
      }

      var categoryManager = document.getElementById('category-manager');
      if (categoryManager) {
        categoryManager.addEventListener('click', Controller.handleDeleteCategory.bind(Controller));
      }

      if (sortControl) {
        sortControl.addEventListener('change', Controller.handleSortChange.bind(Controller));
      }

      var setLimitBtn = document.getElementById('set-limit-btn');
      if (setLimitBtn) {
        setLimitBtn.addEventListener('click', Controller.handleSetLimit.bind(Controller));
      }

      var clearLimitBtn = document.getElementById('clear-limit-btn');
      if (clearLimitBtn) {
        clearLimitBtn.addEventListener('click', Controller.handleClearLimit.bind(Controller));
      }

      var themeToggle = document.getElementById('theme-toggle');
      if (themeToggle) {
        themeToggle.addEventListener('click', Controller.handleThemeToggle.bind(Controller));
      }

      var prevMonthBtn = document.getElementById('prev-month-btn');
      if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', function () {
          Controller.handleMonthNav('prev');
        });
      }

      var nextMonthBtn = document.getElementById('next-month-btn');
      if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', function () {
          Controller.handleMonthNav('next');
        });
      }
    },

    /**
     * Validates and processes form submission.
     * @param {Event} e
     */
    handleSubmit(e) {
      e.preventDefault();
      View.clearErrors();

      var nameInput     = document.getElementById('name-input');
      var amountInput   = document.getElementById('amount-input');
      var categorySelect = document.getElementById('category-select');

      var name     = nameInput     ? nameInput.value.trim()     : '';
      var amountRaw = amountInput  ? amountInput.value.trim()   : '';
      var category = categorySelect ? categorySelect.value      : '';

      var valid = true;

      if (!name) {
        View.showError('name-input', 'Item name is required.');
        valid = false;
      } else if (name.length > 100) {
        View.showError('name-input', 'Item name must be 100 characters or fewer.');
        valid = false;
      }

      var amount = parseFloat(amountRaw);
      if (!amountRaw || isNaN(amount)) {
        View.showError('amount-input', 'Amount is required.');
        valid = false;
      } else if (amount < 0.01 || amount > 999999999.99) {
        View.showError('amount-input', 'Amount must be between $0.01 and $999,999,999.99.');
        valid = false;
      } else {
        // Check max 2 decimal places
        var rounded = Math.round(amount * 100) / 100;
        if (Math.abs(rounded - amount) > 1e-9) {
          View.showError('amount-input', 'Amount may have at most 2 decimal places.');
          valid = false;
        }
      }

      var validCategories = new Set([...DEFAULT_CATEGORIES, ..._categories]);
      if (!category) {
        View.showError('category-select', 'Please select a category.');
        valid = false;
      } else if (!validCategories.has(category)) {
        View.showError('category-select', 'Please select a valid category.');
        valid = false;
      }

      if (!valid) return;

      // Requirement 1.6: check storage availability before adding
      if (!Storage.isAvailable()) {
        View.showError('form-global', 'Unable to save: Local Storage is not available in your browser.');
        return;
      }

      var id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : Date.now().toString();

      var tx = {
        id:       id,
        name:     name,
        amount:   Math.round(amount * 100) / 100,
        category: category,
        date:     new Date().toISOString().slice(0, 10)
      };

      Model.add(tx);

      // Reset form
      if (nameInput)      nameInput.value     = '';
      if (amountInput)    amountInput.value   = '';
      if (categorySelect) categorySelect.value = '';

      // Re-render
      View.renderList(Model.getSortedTransactions(_sortKey));
      View.renderBalance(Model.getBalance());
      View.renderChart(Model.getCategoryTotals());
      View.renderMonthlySummary(
        _currentMonth,
        Model.getSortedTransactions(_sortKey, Model.getTransactionsByMonth(_currentMonth))
      );
      View.applyLimitHighlights(Model.getAll(), _limit);
    },

    /**
     * Processes delete via event delegation on #list-section.
     * Reads data-id from the clicked delete button's closest list item.
     * If Storage is unavailable, shows an error and does not remove.
     * @param {Event} e
     */
    handleDelete(e) {
      var btn = e.target.closest('.delete-btn');
      if (!btn) return;

      var li = btn.closest('li');
      if (!li) return;

      var id = li.getAttribute('data-id');
      if (!id) return;

      // Requirement 2.6: check storage availability before deleting
      if (!Storage.isAvailable()) {
        View.showError('list-global', 'Unable to delete: Local Storage is not available in your browser.');
        return;
      }

      Model.remove(id);

      View.renderList(Model.getSortedTransactions(_sortKey));
      View.renderBalance(Model.getBalance());
      View.renderChart(Model.getCategoryTotals());
      View.renderMonthlySummary(
        _currentMonth,
        Model.getSortedTransactions(_sortKey, Model.getTransactionsByMonth(_currentMonth))
      );
      View.applyLimitHighlights(Model.getAll(), _limit);
    },

    /**
     * Validates and adds a new custom category.
     * Validates: non-empty after trim, max 50 chars, case-insensitive unique
     * across DEFAULT_CATEGORIES + _categories.
     * If Storage unavailable, shows error and returns.
     * On valid: adds category, re-renders dropdown and manager, clears input.
     * @param {Event} e
     */
    handleAddCategory(e) {
      var input = document.getElementById('new-category-input');
      var name  = input ? input.value.trim() : '';

      // Clear previous category error
      var errorSpan = document.getElementById('new-category-error');
      if (errorSpan) errorSpan.textContent = '';

      // Validation: non-empty
      if (!name) {
        View.showError('new-category-input', 'Category name is required.');
        return;
      }

      // Validation: max 50 characters
      if (name.length > 50) {
        View.showError('new-category-input', 'Category name must be 50 characters or fewer.');
        return;
      }

      // Validation: case-insensitive uniqueness across all categories
      var allCategories = DEFAULT_CATEGORIES.concat(_categories);
      var duplicate = allCategories.some(function (c) {
        return c.toLowerCase() === name.toLowerCase();
      });
      if (duplicate) {
        View.showError('new-category-input', 'A category with that name already exists.');
        return;
      }

      // Requirement 8.8: check storage availability before modifying categories
      if (!Storage.isAvailable()) {
        View.showError('new-category-input', 'Unable to save: Local Storage is not available in your browser.');
        return;
      }

      Model.addCategory(name);

      // Clear input
      if (input) input.value = '';

      // Re-render category UI
      View.renderCategoryDropdown(Model.getCategories());
      View.renderCategoryManager(Model.getCategories());
    },

    /**
     * Initiates category deletion with inline confirm/cancel flow.
     * Reads data-category from clicked delete button; counts affected transactions.
     * If zero affected: calls handleConfirmDeleteCategory immediately.
     * If one or more: replaces delete button with inline warning showing count
     * + [Confirm] and [Cancel] buttons.
     * @param {Event} e
     */
    handleDeleteCategory(e) {
      var btn = e.target.closest('.category-delete-btn');
      if (!btn) return;

      var categoryName = btn.getAttribute('data-category');
      if (!categoryName) return;

      // Count affected transactions
      var affectedCount = _transactions.filter(function (t) {
        return t.category === categoryName;
      }).length;

      // If no transactions use this category, delete immediately
      if (affectedCount === 0) {
        Controller.handleConfirmDeleteCategory(categoryName);
        return;
      }

      // One or more transactions affected: show inline warning with confirm/cancel
      var li = btn.closest('li');
      if (!li) return;

      // Hide the delete button
      btn.style.display = 'none';

      var warningSpan = document.createElement('span');
      warningSpan.className = 'category-delete-confirm-msg';
      warningSpan.textContent = affectedCount + ' transaction' + (affectedCount === 1 ? '' : 's') + ' use this category. ';

      var confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'category-delete-confirm-btn';
      confirmBtn.textContent = 'Confirm';
      confirmBtn.addEventListener('click', function () {
        Controller.handleConfirmDeleteCategory(categoryName);
      });

      var cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'category-delete-cancel-btn';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', function () {
        // Restore original state
        btn.style.display = '';
        warningSpan.remove();
        confirmBtn.remove();
        cancelBtn.remove();
      });

      li.appendChild(warningSpan);
      li.appendChild(confirmBtn);
      li.appendChild(cancelBtn);
    },

    /**
     * Confirms category deletion, updates storage and UI.
     * If Storage unavailable, shows error and returns without modifying.
     * Otherwise: removes category from Model, re-renders dropdown, manager, and chart.
     * @param {string} name
     */
    handleConfirmDeleteCategory(name) {
      // Requirement 8.8: check storage availability before deleting category
      if (!Storage.isAvailable()) {
        View.showError('new-category-input', 'Unable to delete: Local Storage is not available in your browser.');
        return;
      }

      Model.removeCategory(name);
      View.renderCategoryDropdown(Model.getCategories());
      View.renderCategoryManager(Model.getCategories());
      View.renderChart(Model.getCategoryTotals());
    },

    /**
     * Navigates the Monthly_Summary by one month.
     * Clamps to the earliest transaction month (prev) and current calendar month (next).
     * @param {'prev'|'next'} direction
     */
    handleMonthNav(direction) {
      var parts = _currentMonth.split('-');
      var year  = parseInt(parts[0], 10);
      var month = parseInt(parts[1], 10); // 1-indexed

      if (direction === 'prev') {
        month -= 1;
        if (month < 1) { month = 12; year -= 1; }
      } else {
        month += 1;
        if (month > 12) { month = 1; year += 1; }
      }

      var newMonth = year + '-' + (month < 10 ? '0' + month : '' + month);
      var today = new Date().toISOString().slice(0, 7);

      // Clamp: cannot go beyond current calendar month (next)
      if (newMonth > today) {
        newMonth = today;
      }

      // Clamp: cannot go before the earliest transaction month (prev)
      var allMonths = Model.getAllMonths(); // sorted ascending
      var earliest = allMonths.length > 0 ? allMonths[0] : today;
      if (newMonth < earliest) {
        newMonth = earliest;
      }

      _currentMonth = newMonth;

      View.renderMonthlySummary(
        _currentMonth,
        Model.getSortedTransactions(_sortKey, Model.getTransactionsByMonth(_currentMonth))
      );

      // Update disabled state of prev/next buttons
      var prevBtn = document.getElementById('prev-month-btn');
      var nextBtn = document.getElementById('next-month-btn');

      if (prevBtn) prevBtn.disabled = (_currentMonth <= earliest);
      if (nextBtn) nextBtn.disabled = (_currentMonth >= today);
    },

    /**
     * Persists sort preference and re-renders the transaction list.
     * @param {Event} e
     */
    handleSortChange(e) {
      _sortKey = e.target.value;
      Storage.saveSort(_sortKey);
      View.renderList(Model.getSortedTransactions(_sortKey));
      View.renderMonthlySummary(
        _currentMonth,
        Model.getSortedTransactions(_sortKey, Model.getTransactionsByMonth(_currentMonth))
      );
    },

    /**
     * Validates and sets the spending limit.
     * @param {Event} e
     */
    handleSetLimit(e) {
      var input = document.getElementById('limit-input');
      var raw   = input ? input.value.trim() : '';

      // Clear previous error
      var errorSpan = document.getElementById('limit-error');
      if (errorSpan) errorSpan.textContent = '';

      var value = parseFloat(raw);
      if (!raw || isNaN(value)) {
        View.showError('limit-input', 'Please enter a valid spending limit.');
        return;
      }
      if (value <= 0 || value > 999999999.99) {
        View.showError('limit-input', 'Limit must be between $0.01 and $999,999,999.99.');
        return;
      }
      var rounded = Math.round(value * 100) / 100;
      if (Math.abs(rounded - value) > 1e-9) {
        View.showError('limit-input', 'Limit may have at most 2 decimal places.');
        return;
      }

      Model.setLimit(rounded);
      View.applyLimitHighlights(Model.getSortedTransactions('date-asc'), Model.getLimit());
    },

    /**
     * Clears the spending limit and removes highlights.
     * @param {Event} e
     */
    handleClearLimit(e) {
      _limit = null;
      Model.clearLimit();
      var input = document.getElementById('limit-input');
      if (input) input.value = '';
      var errorSpan = document.getElementById('limit-error');
      if (errorSpan) errorSpan.textContent = '';
      View.applyLimitHighlights(Model.getAll(), null);
    },

    /**
     * Toggles the theme, persists to Storage, and updates the UI.
     */
    handleThemeToggle() {
      var current = document.documentElement.getAttribute('data-theme') || 'light';
      var next    = current === 'dark' ? 'light' : 'dark';
      View.applyTheme(next);
      Storage.saveTheme(next);
      View.updateThemeToggleLabel(next);
    }

  };

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', Controller.init.bind(Controller));

})();

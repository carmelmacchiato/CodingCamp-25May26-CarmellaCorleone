# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that allows users to track personal expenses, view a running balance, and visualize spending distribution by category through an interactive pie chart. The app runs entirely in the browser with no backend server, persists data using the browser's Local Storage API, and is built with HTML, CSS, and Vanilla JavaScript only. It is designed to be simple, fast, and visually clear — suitable for use as a standalone web page or browser extension.

## Glossary

- **App**: The Expense & Budget Visualizer web application.
- **Transaction**: A single expense entry consisting of an item name, a monetary amount, and a category.
- **Transaction_List**: The scrollable UI component that displays all recorded transactions.
- **Input_Form**: The UI form component used to enter and submit new transactions.
- **Balance_Display**: The UI component at the top of the page that shows the current total of all transaction amounts.
- **Chart**: The pie chart UI component that visualizes spending distribution by category.
- **Storage**: The browser's Local Storage API used to persist transaction data client-side.
- **Category**: One of three predefined expense classifications: Food, Transport, or Fun, or any user-defined Custom_Category.
- **Validator**: The client-side logic responsible for checking that all required form fields are filled before submission.
- **Custom_Category**: A user-defined expense classification created beyond the three default categories (Food, Transport, Fun), stored in Local Storage and available alongside defaults in the Input_Form category dropdown.
- **Monthly_Summary**: A view or panel that groups and displays transactions by calendar month (YYYY-MM format), showing total spending and transaction count per month with month navigation controls.
- **Sort_Control**: The UI control (dropdown or button group) that allows the user to select the sort order applied to the Transaction_List.
- **Spending_Limit**: A user-defined positive monetary threshold stored in Local Storage; when total spending meets or exceeds this value, the Balance_Display and qualifying transactions in the Transaction_List are visually highlighted.
- **Theme_Toggle**: The button in the application header that switches the App between light mode (soft girl pastel palette) and dark mode (deep plum/charcoal backgrounds with muted pastel accents), with the preference persisted in Local Storage.

---

## Requirements

### Requirement 1: Add a Transaction via Input Form

**User Story:** As a user, I want to fill in an expense form and submit it, so that I can record a new transaction quickly.

#### Acceptance Criteria

1. THE Input_Form SHALL provide a text field for Item Name (maximum 100 characters), a numeric field for Amount, and a dropdown selector for Category containing the options Food, Transport, and Fun.
2. WHEN the user submits the Input_Form with all fields filled, THE App SHALL add the transaction to the Transaction_List and persist it to Storage.
3. WHEN the user submits the Input_Form with all fields filled, THE Input_Form SHALL reset all fields to their default empty/unselected state after successful submission.
4. IF the user submits the Input_Form with one or more fields empty or unselected, THEN THE Validator SHALL display an inline error message indicating which fields are missing and SHALL NOT add any transaction.
5. IF the Amount field contains a value outside the range 0.01 to 999,999,999.99 or is not a number with at most two decimal places, THEN THE Validator SHALL display an inline error message and SHALL NOT add any transaction.
6. IF Storage is unavailable when the user submits the Input_Form, THEN THE App SHALL display an inline error message indicating the transaction could not be saved and SHALL NOT add the transaction to the Transaction_List.

---

### Requirement 2: View and Delete Transactions

**User Story:** As a user, I want to see all my recorded expenses in a list and remove ones I no longer need, so that I can keep my records accurate.

#### Acceptance Criteria

1. THE Transaction_List SHALL display all persisted transactions, each showing the item name, monetary amount formatted as a currency value with two decimal places and a currency symbol, and category.
2. THE Transaction_List SHALL be scrollable when the number of transactions exceeds the visible area.
3. WHEN the App loads in the browser, THE Transaction_List SHALL populate from Storage and display all previously saved transactions.
4. WHEN the user clicks the delete control on a transaction, THE App SHALL remove that transaction from the Transaction_List and from Storage.
5. WHEN there are no transactions, THE Transaction_List SHALL display a placeholder message indicating that no expenses have been recorded.
6. IF Storage is unavailable when the user attempts to delete a transaction, THEN THE App SHALL display an inline error message and SHALL NOT remove the transaction from the Transaction_List.

---

### Requirement 3: Display Total Balance

**User Story:** As a user, I want to see my total spending at a glance, so that I can understand how much I have spent overall.

#### Acceptance Criteria

1. THE Balance_Display SHALL show the sum of all transaction amounts at the top of the page, formatted as a currency value with two decimal places and a currency symbol (e.g., $0.00).
2. WHEN a transaction is added, THE Balance_Display SHALL update automatically within 100 milliseconds to reflect the new total without requiring a page reload.
3. WHEN a transaction is deleted, THE Balance_Display SHALL update automatically within 100 milliseconds to reflect the new total without requiring a page reload.
4. WHEN there are no transactions, THE Balance_Display SHALL show a total of $0.00.
5. THE Balance_Display SHALL treat all transaction amounts as positive values representing expenses, and the displayed total SHALL be the arithmetic sum of those values.

---

### Requirement 4: Visualize Spending by Category

**User Story:** As a user, I want to see a pie chart of my spending by category, so that I can understand where my money is going.

#### Acceptance Criteria

1. THE Chart SHALL display a pie chart showing the proportional spending for each Category that has at least one transaction, with each slice labeled with the category name and its percentage of total spending.
2. WHEN a transaction is added, THE Chart SHALL update automatically to reflect the new spending distribution without requiring a page reload.
3. WHEN a transaction is deleted, THE Chart SHALL update automatically to reflect the new spending distribution without requiring a page reload.
4. WHEN all transactions are removed, THE Chart SHALL display a text placeholder message indicating no spending data is available.
5. THE Chart SHALL visually distinguish each Category using a distinct color, supporting the three defined categories (Food, Transport, Fun) each with a unique, consistently applied color.

---

### Requirement 5: Persist Data Across Sessions

**User Story:** As a user, I want my expense data to be saved between browser sessions, so that I do not lose my records when I close and reopen the app.

#### Acceptance Criteria

1. WHEN a transaction is added, THE Storage SHALL save the updated transaction list to Local Storage synchronously before the UI reflects the addition, such that a page reload immediately after the add shows the new transaction.
2. WHEN a transaction is deleted, THE Storage SHALL save the updated transaction list to Local Storage synchronously before the UI reflects the deletion, such that a page reload immediately after the delete does not show the removed transaction.
3. WHEN the App loads, THE Storage SHALL read all previously saved transactions from Local Storage and restore them to the Transaction_List; THE Balance_Display and Chart SHALL be recalculated from the restored data.
4. IF Local Storage is unavailable or returns data that cannot be parsed as a valid JSON array of transaction objects, THEN THE App SHALL initialize with an empty transaction list and display a dismissible inline warning message that does not prevent further interaction.

---

### Requirement 6: Browser Compatibility and Performance

**User Story:** As a user, I want the app to work reliably in any modern browser and respond instantly to my interactions, so that I have a smooth experience regardless of my environment.

#### Acceptance Criteria

1. THE App SHALL render and operate without JavaScript errors or visual layout breakage in the current stable release versions of Chrome, Firefox, Edge, and Safari, without requiring any browser plugins or extensions.
2. THE App SHALL complete initial page load — defined as the point at which the Transaction_List, Balance_Display, and Chart are visible and populated from Storage — within 2 seconds on a connection with at least 10 Mbps download speed.
3. WHEN the user adds or deletes a transaction, THE App SHALL complete all DOM updates to the Transaction_List, Balance_Display, and Chart within 100 milliseconds of the triggering user action.
4. THE App SHALL use only one CSS file located in the `css/` directory and one JavaScript file located in the `js/` directory.
5. THE App SHALL require no backend server and SHALL operate entirely client-side.
6. IF the App is opened in a browser that does not support the Local Storage API or ES6 JavaScript features used by the App, THEN THE App SHALL display a visible, non-dismissible message informing the user that their browser is not supported.

---

### Requirement 7: Visual Design and Usability

**User Story:** As a user, I want the interface to be clean and easy to read, so that I can use the app without confusion or visual clutter.

#### Acceptance Criteria

1. THE App SHALL apply a consistent visual hierarchy using at least three distinct typographic levels (e.g., page title, section heading, body/data text) with visually differentiated font sizes or weights.
2. THE App SHALL use a color scheme where all text-to-background color pairings meet a minimum contrast ratio of 4.5:1 as defined by WCAG 2.1 AA for normal text.
3. THE Input_Form, Transaction_List, Balance_Display, and Chart SHALL each be rendered in visually distinct sections separated by whitespace, borders, or background color differences.
4. THE App SHALL be usable on viewport widths from 320px to 1920px without horizontal scrolling or content overflow, achieved through responsive layout techniques such as fluid widths or CSS media queries.
5. THE App SHALL not display any modal dialogs or blocking overlays during normal add, delete, or load operations; all feedback SHALL be delivered via inline messages within the relevant section.

---

### Requirement 8: Custom Categories

**User Story:** As a user, I want to create my own expense categories beyond the defaults, so that I can classify transactions in a way that reflects my personal spending habits.

#### Acceptance Criteria

1. THE App SHALL provide a UI control that allows the user to create a Custom_Category with a name that is non-empty, at most 50 characters, and not a duplicate of any existing category name (comparison is case-insensitive).
2. WHEN the user creates a Custom_Category, THE Storage SHALL persist the updated category list to Local Storage synchronously before the UI reflects the addition, so that a page reload immediately after creation shows the new category.
3. WHEN the App loads, THE Input_Form category dropdown SHALL include all default categories (Food, Transport, Fun) followed by all persisted Custom_Category entries in the order they were created.
4. WHEN the user attempts to create a Custom_Category with an empty name, a name exceeding 50 characters, or a name that duplicates an existing category (case-insensitive), THEN THE Validator SHALL display an inline error message and SHALL NOT create the category.
5. THE App SHALL provide a delete control for each Custom_Category in the category management UI.
6. WHEN the user activates the delete control for a Custom_Category that has one or more associated transactions, THE App SHALL display an inline warning message identifying the count of affected transactions and SHALL render inline confirm and cancel controls; the category SHALL NOT be deleted until the user activates the confirm control.
7. WHEN the user confirms deletion of a Custom_Category, THE App SHALL remove the category from Storage and from the Input_Form dropdown, persist the updated category list to Local Storage synchronously, and update the Chart to exclude that category's slice; transactions previously assigned to that category SHALL retain their stored category value as a display-only label no longer available for new entries.
8. IF Storage is unavailable when the user creates or deletes a Custom_Category, THEN THE App SHALL display an inline error message and SHALL NOT modify the category list.

---

### Requirement 9: Monthly Summary View

**User Story:** As a user, I want to view my transactions grouped by month, so that I can understand my spending patterns over time.

#### Acceptance Criteria

1. THE App SHALL provide a Monthly_Summary panel that groups all transactions by calendar month using the YYYY-MM format derived from each transaction's recorded date field (stored as YYYY-MM-DD at the time the transaction is added).
2. WHILE the Monthly_Summary is displaying a selected month, THE Monthly_Summary SHALL show the total spending amount for that month formatted as $X.XX and the count of transactions in that month.
3. WHEN the App loads, THE Monthly_Summary SHALL default to displaying the current calendar month (derived from the client's local date at load time).
4. WHEN the user activates the previous-month control, THE Monthly_Summary SHALL navigate to the immediately preceding calendar month, down to the earliest month that contains at least one transaction.
5. IF the currently displayed month is the current calendar month, THEN the next-month control SHALL be disabled and SHALL NOT respond to user interaction.
6. WHEN the user navigates to a month that has no transactions, THE Monthly_Summary SHALL display a placeholder message indicating no expenses were recorded for that month.
7. WHEN a transaction is added or deleted, THE Monthly_Summary SHALL update automatically within 100 milliseconds to reflect the change in the affected month's total and count without requiring a page reload.

---

### Requirement 10: Sort Transactions

**User Story:** As a user, I want to sort my transaction list by different criteria, so that I can find and review expenses more easily.

#### Acceptance Criteria

1. THE Sort_Control SHALL offer the following sort options: amount ascending, amount descending, category name A→Z, category name Z→A, date newest first, and date oldest first.
2. IF no sort preference is persisted in Local Storage under the key `"expense_visualizer_sort"`, THEN THE Transaction_List SHALL default to the date newest first sort order on load.
3. WHEN the user selects a sort option from the Sort_Control, THE Transaction_List SHALL re-render in the selected order within 100 milliseconds without requiring a page reload.
4. WHEN the user selects a sort option, THE Storage SHALL persist the selected sort preference to Local Storage under the key `"expense_visualizer_sort"` synchronously before the list re-renders.
5. WHEN the App loads with a persisted sort preference under `"expense_visualizer_sort"`, THE Sort_Control SHALL reflect the saved option.
6. WHEN the App loads with a persisted sort preference under `"expense_visualizer_sort"`, THE Transaction_List SHALL be rendered in that saved order.
7. WHEN two or more transactions are equal under the selected sort criterion, those transactions SHALL be ordered by date newest first as a tiebreaker.
8. WHILE the Monthly_Summary is the active view, THE Sort_Control SHALL apply the selected sort order to the transactions displayed within that month's view.

---

### Requirement 11: Spending Limit Highlight

**User Story:** As a user, I want to set a spending limit and see a visual warning when I approach or exceed it, so that I can stay within my budget.

#### Acceptance Criteria

1. THE App SHALL provide a Spending_Limit input field that accepts a positive number with at most two decimal places and a maximum value of 999,999,999.99, following the same validation rules as the Amount field.
2. WHEN the user sets a Spending_Limit, THE Storage SHALL persist the value to Local Storage so that it is restored after a page reload.
3. WHEN the total of all transaction amounts meets or exceeds the Spending_Limit, THE Balance_Display SHALL add the CSS class `balance--over-limit`, which applies a visually distinct background color or border that differs from its default appearance.
4. WHEN the total of all transaction amounts is below the Spending_Limit, THE Balance_Display SHALL remove the CSS class `balance--over-limit` within 100 milliseconds of the change.
5. WHEN a transaction is added, deleted, the Spending_Limit is changed, or the App loads with a persisted Spending_Limit, THE Transaction_List SHALL re-evaluate each transaction's running cumulative total (calculated in date oldest-first order) and add the CSS class `transaction--over-limit` to each transaction item whose addition causes that running total to meet or exceed the Spending_Limit, and remove that class from all other transaction items.
6. THE App SHALL provide a dedicated clear button for the Spending_Limit.
7. WHEN the user activates the clear button, THE Storage SHALL remove the persisted Spending_Limit value from Local Storage.
8. WHEN the user activates the clear button, THE Balance_Display SHALL remove the CSS class `balance--over-limit` and THE Transaction_List SHALL remove the CSS class `transaction--over-limit` from all transaction items within 100 milliseconds.
9. IF the Spending_Limit input contains a value that is not a positive number, exceeds 999,999,999.99, or has more than two decimal places, THEN THE Validator SHALL display an inline error message and SHALL NOT update the Spending_Limit.

---

### Requirement 12: Dark/Light Mode Toggle

**User Story:** As a user, I want to switch between light and dark mode, so that I can use the app comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE App SHALL provide a Theme_Toggle button in the application header that switches the App between light mode and dark mode.
2. WHEN the App loads without a persisted theme preference under the key `"expense_visualizer_theme"`, THE App SHALL default to light mode using the existing soft girl pastel palette.
3. WHEN the user activates the Theme_Toggle, THE App SHALL switch to the opposite theme and apply the new styles to the Input_Form, Transaction_List, Balance_Display, Chart, Monthly_Summary, and header within 100 milliseconds without requiring a page reload.
4. WHEN the user activates the Theme_Toggle, THE Storage SHALL persist the selected theme value (`"light"` or `"dark"`) to Local Storage under the key `"expense_visualizer_theme"` synchronously.
5. WHEN the App loads with a persisted theme preference, THE App SHALL set the `data-theme` attribute on the root `<html>` element to the persisted value before the first paint, so that the correct theme styles are applied before any content is rendered.
6. WHILE dark mode is active, THE App SHALL apply CSS custom property overrides that set page and card backgrounds to deep plum or charcoal tones (e.g., `#2A1A2E`, `#1E1E2E`), accent colors to muted pastel pink and sage green, and body text to a light neutral tone, preserving the soft girl aesthetic.
7. THE App SHALL ensure that all text-to-background color pairings in both light mode and dark mode meet a minimum contrast ratio of 4.5:1 as defined by WCAG 2.1 AA for normal text.
8. THE Theme_Toggle SHALL display a visible label or icon indicating the mode that will be activated upon the next click (i.e., it shows the inactive mode as the action target).

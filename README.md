# Lancaster Steel Estimator

A comprehensive, web-based quotation and estimation engine designed for Lancaster Steel. This application allows users to generate professional steel fabrication and erection quotes through CSV uploads, AI-powered floor plan analysis, or a dynamic preset builder.

## Features & Modules

1. **Input Methods:**
   - **CSV / BOM Upload:** Parses standard Bill of Materials (BOM) CSV files and uses a local, deterministic pricing engine to generate highly accurate quotes based on weight and material grade.
   - **Floor Plan Analysis (AI):** Users can upload architectural drawings. The app sends the image via a local proxy to an AI model (Gemini 2.0 Flash / HuggingFace) constrained by strict calibration rules to estimate steel requirements based on square footage and structural typologies.
   - **Quick Presets:** A dynamic autocomplete builder that allows users to search an internal database of 19+ structural steel materials, add quantities, and generate an itemised quote instantly.

2. **Cost Modules Output:**
   - **Module 1:** Material & Fabrication (Variable costs based on steel type and weight)
   - **Module 2:** Logistics & Freight (Calculated via delivery mileage and truckloads)
   - **Module 3:** Erection & Field Work (Optional crane & labor costs)
   - **Module 4:** Contingency & Tax Compliance (Standard 6% buffer)

3. **Backend Proxy (`proxy.js`):**
   - Secures API keys and sensitive logic away from the client.
   - Handles communication with the HuggingFace AI Router API.
   - Manages EmailJS server-side dispatch logic for sending official quotes to clients.

## Parsing Workflow

The deterministic quote engine lives in `js/engine-local.js`. It accepts freeform text, CSV rows, or preset selections and converts them into quote lines only when the item can be matched to a known steel/material alias.

### 1. Freeform text parsing

The text parser is designed for pasted requirements such as:

```text
1400 lbs HSFG bolts
steel decking 2200 lbs
purlins - 1850 lbs
```

How it works:
- The engine splits the pasted text into lines.
- Each line is further split on common separators such as commas, semicolons, and tabs.
- It extracts a quantity plus unit pair such as lbs, tons, kg, pieces, sq ft, or ft.
- It then tries to identify the material name around that quantity.
- The material is only quoted if the full phrase matches a known preset alias or a supported classifier alias.

Important matching rule:
- Partial word hits are rejected.
- A single word like anchor will not match anchor bolts.
- A generic phrase like wire rope will not be forced into a different quoted item unless it exactly matches a supported alias.

If an item does not match the catalog, it is added to the unavailable list instead of being quoted.

### 2. CSV parsing

CSV input is parsed by header name rather than fixed column order.

Supported headers include:
- item, description, material, name
- qty, quantity, amount, count
- unit, uom, units
- grade, spec, standard
- weight_lbs, weight_tons
- unit_price

CSV rows are processed in this order:
1. Read the item name.
2. Resolve weight from explicit weight columns if present.
3. Otherwise convert qty + unit into pounds.
4. Match the item against exact preset aliases.
5. If no exact preset match exists, try the classifier aliases.
6. If still unmatched, add the row to the unavailable list.

### 3. Preset matching rules

Preset items are intentionally strict:
- Exact alias matches are preferred.
- The engine does not quote based on loose substring matches.
- This prevents false positives like teddy bear, football, or sheet pile accidentally mapping to rebar, plate, or another steel item.

Examples:
- HSFG bolts matches the HSFG bolt preset.
- Tread plates matches the tread plate preset.
- C-channels matches the channel preset when explicitly supported.
- Sheet pile stays unavailable unless a sheet pile preset is added.

### 4. Unavailable items list

When at least one item is not recognized, the engine returns the normal quote object plus an `_meta.unavailable` array.

That list is used by the UI to show the “Unavailable items — not quoted” modal.

If all items are unavailable, the engine still returns a quote shell with the missing items listed so the user can see what failed to match.

### 5. Why this design

This parser is meant to be conservative.
- It avoids over-quoting unknown objects.
- It keeps pricing deterministic and explainable.
- It makes it obvious when a user needs to rename an item or add a new catalog alias.

## Architecture

- **Frontend:** Vanilla HTML, CSS (Custom Apple-inspired Tokens), and JavaScript.
  - `ui.js`: State management, DOM manipulation, drag-and-drop file handling, and UI interactions.
  - `engine-local.js`: The pure deterministic pricing logic (offline-first). Contains the material database and rate cards.
  - `engine.js`: The router that handles AI requests and triggers local calculations based on the selected mode.
  - `quote.js`: Renders the final 5-module quote UI.
  - `email.js`: Handles sending quote payload requests to the proxy for EmailJS dispatch.
- **Backend:** Node.js Express server (`proxy.js`).

## Instructions for Scaling & Maintenance

As Lancaster Steel grows or market conditions change, the application will need to be updated. Here is how to scale and maintain the core logic:

### 1. Updating Prices & Rates
All fundamental pricing is stored locally in `js/engine-local.js`.
- **Global Rates:** Update `PRICE_BANDS` (budget, mid, premium) to reflect current mill prices.
- **Service Rates:** Update `FAB_RATE` (shop fabrication), `INSTALL_RATE` (erection), and `LOGISTICS_RATE` (freight).

### 2. Expanding the Material Database (Presets)
To add new materials to the Quick Presets autocomplete dropdown:
1. Open `js/engine-local.js`.
2. Locate the `PRESET_CONFIGS` object.
3. Add a new numeric key with the material details:
   ```javascript
   20: { 
     name: 'New Material Name', 
     grade: 'ASTM Standard', 
     priceLb: 0.85,  // Base price per lb
     fabLb: 0.10,    // Fabrication cost per lb
     note: 'Description for the quote line item' 
   }
   ```
The autocomplete UI in the preset module will automatically pick up and suggest any new entries added here.

### 3. Tuning the AI Estimator
If the AI floor plan estimates begin deviating from reality, update the `CALIBRATION_CONTEXT` prompt located at the top of `js/engine.js`.
- You can adjust the `lbs/sq ft` intensities, the element split percentages (e.g., Foundation vs. Columns), and specific pricing rules. This context acts as the strict "brain" for the AI model.

### 4. Deploying to Production
Currently, the proxy is run locally. For a live deployment:
- **Frontend Hosting:** Host the static files (HTML, CSS, JS) on a CDN like Vercel, Netlify, or AWS S3.
- **Backend Hosting:** Deploy `proxy.js` to a Node.js hosting environment (Render, Heroku, AWS EC2, or DigitalOcean).
- **Environment Variables:** Ensure that `HF_TOKEN` (HuggingFace) and `EMAILJS_PRIVATE_KEY` are securely injected into the backend host's environment, **never** exposed in the public frontend repository.
- **CORS Configuration:** Update the `cors()` settings in `proxy.js` to only allow requests from your verified frontend production domain.

## Requirements to Run Locally
1. Node.js installed.
2. Run the proxy server: 
   ```bash
   $env:HF_TOKEN="your_hf_token"
   node proxy.js
   ```
3. Open `index.html` in any modern web browser.

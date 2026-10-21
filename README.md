# LoadClarity

Load review, profitability, and exception management for independent truck dispatchers and small carriers.
This is a self-contained website plus a small local server. It does not depend on any outside app builder.

## What you need
- **Node.js 20.19 or newer** (download the LTS version from https://nodejs.org)
- **VS Code** (optional, any editor works)

## Run it on your PC
1. Unzip the folder and open it in VS Code (File, Open Folder).
2. Open a terminal in VS Code (Terminal, New Terminal) and run:
   ```
   npm install
   npm run dev
   ```
3. Open **http://localhost:5173** in your browser.
4. Click "Create one", register, then set up your workspace (company name and cost defaults).

`npm run dev` starts two things together: the website (port 5173) and the server (port 5000). Press `Ctrl+C` to stop both.

### Run it as one program (no hot reload)
```
npm run build
npm start
```
Then open **http://localhost:5000**.

## Where your data is stored
In the `data` folder: `data/db.json` holds accounts and loads, `data/files/` holds uploaded documents, and `data/session-secret.txt` signs logins.
Back up that folder to keep your data. Deleting it resets the app. Passwords are stored hashed, never as plain text.

## Optional settings (.env file)
Copy `.env.example` to `.env`. Everything is optional.
- `ANTHROPIC_API_KEY`: lets **Quick check** read pasted broker offers with AI. Without it, type the numbers by hand.
- `PORT`, `APP_URL`, `SESSION_SECRET`: advanced.

## Password reset
No email service is connected in this build. When someone requests a reset, the link is printed in the server terminal window. Configure a transactional email provider before public launch.

## Project layout
```
server/            Local API: login, data storage, AI route
  documents.js     Private file upload, download and delete
  schemas/         Field definitions for each record type (Load, Carrier, Broker, Document, ...)
src/
  api/client.js    How the website talks to the server
  pages/           Dashboard, Loads, Quick check, Exceptions, Carriers, Fleet, Brokers, Detention, Payments, Reports, ...
  components/      Screens' building blocks (ui/ = buttons, dialogs, etc.)
  lib/             Calculations, risk rules, payments, reports, login state
tests/             Automated tests (npm test)
scripts/dev.js     Starts server and website together
```

## Commands
| Command | What it does |
|---|---|
| `npm run dev` | Website + server for development |
| `npm run build` | Build the website into `dist` |
| `npm start` | Run the server (serves `dist` if built) |
| `npm test` | Run the automated tests |
| `npm run lint` | Check code style |

## What changed from the old version
- Removed every outside app-builder dependency, folder, and setting (its folder, SDK, plugin, and `.env` entries are all gone).
- Added a local server with real accounts: hashed passwords, signed logins, login attempt limits.
- **Each company's data is isolated on the server.** One company cannot read or change another's records, even by sending crafted requests (covered by tests).
- Replaced the placeholder backend (plain-text passwords, fake Google login) with the new one.
- Added document uploads, BOL/POD checks, and a billing-readiness checklist on every load.
- Removed Google sign-in and the AI-tool-only pages. Removed unused packages (install is much smaller).
- Renamed the layout folder and cleaned the code. Fixed the dashboard "At risk" card so it counts loads with open Critical or High issues, not every issue.

## Known limits (read before selling this)
- Data is a single JSON file. That is fine for local use and a small pilot, not concurrent production workloads. Before a public multi-customer launch, migrate to PostgreSQL (or another managed database), add transactional migrations, and test backup restoration.
- Lemon Squeezy overlay checkout links are configured in the Pricing page. Subscription activation requires a verified webhook and the real six variant IDs in `.env`; until configured and tested, do not treat paid plans as active. The frontend never activates a paid plan by itself. The Free RateCon upload limit is enforced by an authenticated server endpoint.
- Fonts load from Google Fonts. Offline, the site falls back to system fonts.
- Documents (RateCon, BOL, POD, and others) can be uploaded as PDF, JPG or PNG up to 15 MB. Files are checked by their real content, stored privately on your computer, and visible only to the owning company. The BOL/POD check compares values you type with the load; it does not read the file.
- A load can only be set to **Billing Ready** when its checklist is complete (RateCon, BOL, and an approved POD attached; load number, broker, reference and rate filled in; no open Critical issue).
- Run it behind HTTPS if you put it on the internet, and set a strong `SESSION_SECRET`.

## Advanced load intake tools

- **Rate Confirmation import:** In the New Load/Edit Load form, drop or select a broker Rate Confirmation PDF or image. Text-based PDFs are parsed with PDF.js; scanned PDFs and images use Tesseract.js OCR. Extracted values are populated into the form for review before saving. OCR and extraction are best-effort and should be verified against the source document.
- **Broker email generator:** The load form surfaces common missing-term, appointment, and low-rate warnings with one-click editable email drafts. Copy the draft or open it in the device's configured email application. The app does not send messages automatically.

Install dependencies with `npm install` before running `npm run dev` or building with `npm run build`.


## SaaS launch additions (current build)

- Free workspaces receive five lifetime Rate Confirmation parses. The counter is stored on the workspace (`Company.ratecon_upload_count`) and the importer blocks additional parsing when the Free quota is exhausted. Paid plans are Starter ($29/month) and Pro Dispatcher ($79/month), mapped to the existing stable plan IDs (`solo` and `pro`).
- Pricing selection is currently a mock upgrade only. Stripe keys, webhook handling, subscription lifecycle, tax, refunds, and global first-50-user enforcement are not configured. Do not accept real payments until those server-side flows are implemented and tested. The Early Bird banner communicates the intended launch offer but does not currently enforce a global seat count or lifetime rate lock.
- Completed/delivered/billing-stage loads offer invoice and BOL print layouts. Choose “Save as PDF” in the browser print dialog to create a PDF. Review the invoice and attach approved POD/receipts before sending.
- Dashboard monthly performance estimates gross, net, gross per loaded mile, and driver pay using company settings. Confirm actual fuel, accessorial, driver pay, and cost data before using these estimates for settlement.
- Fleet already supports trucks and drivers and loads support driver/truck assignments.


## Payment integration and launch configuration

The existing Lemon Squeezy checkout overlay and six checkout links are preserved. To synchronize subscription status securely:

1. Copy `.env.example` to `.env` and set `LEMON_SQUEEZY_WEBHOOK_SECRET` to the signing secret shown for your Lemon Squeezy webhook.
2. Add a webhook endpoint at `https://YOUR_DOMAIN/api/billing/lemonsqueezy-webhook`. Subscribe to subscription created/updated/resumed/cancelled/expired/paused and subscription payment success/recovered/failed events.
3. Set `LEMON_VARIANT_SOLO_MONTHLY`, `LEMON_VARIANT_SOLO_YEARLY`, `LEMON_VARIANT_PRO_MONTHLY`, `LEMON_VARIANT_PRO_YEARLY`, `LEMON_VARIANT_TEAM_MONTHLY`, and `LEMON_VARIANT_TEAM_YEARLY` to the real numeric variant IDs from your store. Do not use the checkout link UUIDs as variant IDs.
4. Checkout buttons pass workspace/plan custom data when a workspace is selected. The webhook validates the signature and checks the checkout customer email against the workspace owner before updating the plan. Events that cannot be matched are acknowledged but not applied.
5. Test with Lemon Squeezy test mode and verify renewal, cancellation, expiry, failed-payment recovery, and the workspace plan before going live.

The project still needs a production database migration, transactional email delivery, deployment-specific CSP/HTTPS configuration, and a full live browser test before public commercial launch.

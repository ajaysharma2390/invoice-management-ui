# Invoice UI

A React 19 and Vite frontend for invoice listing and detail pages. The listing
definition is authored in `src/data/invoice_list_envelope.json` and rendered
through the document node registry. Selecting an invoice opens
`/invoice-document/:recordId`, which loads the detail template and invoice data
along with line items, linked records, options, and activity. The **New invoice**
action opens `/invoice-new`, a form driven by the invoice-create template and data
API.

## Development

```sh
npm install
npm run dev
```

By default, Vite provides a development-only mock API with 120 deterministic
invoice records. It implements the list, filter, search, sort, pagination,
counts, saved-view, filter-options, bulk-action, and invoice-detail endpoints,
including amendment, attachment, and invoice-create flows, so the UI can be
tried without a running backend. Saved views and invoice changes in the mock
are held in memory and reset when the dev server restarts.

The page uses:

- `GET /api/p2p/template?id=tpl_invoice_list_default`
- `GET /api/p2p/data?id=tpl_invoice_list_default`
- `GET /api/p2p/counts?id=tpl_invoice_list_default`
- `GET /api/p2p/saved_views?id=tpl_invoice_list_default`
- `GET /api/p2p/filter_options?id=tpl_invoice_list_default`
- `POST /api/p2p/bulk_action?id=tpl_invoice_list_default`
- `POST /api/p2p/saved_views?id=tpl_invoice_list_default`
- `GET /api/p2p/template?id=tpl_invoice_default`
- `GET /api/p2p/data?id=tpl_invoice_default&record_id=<invoice-id>`
- `GET /api/p2p/line_items?id=tpl_invoice_default&record_id=<invoice-id>`
- `GET /api/p2p/links?id=tpl_invoice_default&record_id=<invoice-id>&kind=<kind>`
- `GET /api/p2p/activity?id=tpl_invoice_default&record_id=<invoice-id>`
- `GET /api/p2p/options?id=tpl_invoice_default&record_id=<invoice-id>`
- `POST /api/p2p/amendments?id=tpl_invoice_default&record_id=<invoice-id>`
- `POST /api/trade/upload_file` and
  `POST /api/p2p/attachments?id=tpl_invoice_default&record_id=<invoice-id>`
- `GET /api/p2p/template?id=tpl_invoice_create_v1`
- `GET /api/p2p/data?id=tpl_invoice_create_v1`
- `GET /api/p2p/options?id=tpl_invoice_create_v1&field=purchaseOrder.id`
- `POST /api/p2p/data?id=tpl_invoice_create_v1` (requires `Idempotency-Key`)

To use a real backend instead, set `VITE_API_PROXY_TARGET` to its origin (for
example, `http://localhost:3000`) in an untracked `.env.local` file. Vite
forwards `/api` requests to that origin and disables the mock API.
The frontend sends the `access-token` and `app-version` headers from session
storage (the app version defaults to `20.0.0`) and sends `lightspeed-token:
null` on every request.

## Checks

```sh
npm run lint
npm run build
```

## Deploying to Netlify

Import the GitHub repository into Netlify and use the build settings from
`netlify.toml` (`npm run build`, with `dist` as the publish directory). The
redirect rule serves the app entry point for invoice routes on direct visits.

The development mock API is not included in production builds. A production
backend must be available at the same origin's `/api` paths for invoice data
operations to work; the default Netlify settings only publish the frontend.

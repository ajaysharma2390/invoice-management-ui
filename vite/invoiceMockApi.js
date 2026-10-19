import envelope from '../src/data/invoice_list_envelope.json' with { type: 'json' }
import detailEnvelope from '../src/data/invoice_detail_envelope.json' with {
  type: 'json',
}
import createEnvelope from '../src/data/invoice_create_envelope.json' with {
  type: 'json',
}
const statuses = [
  'UNDER_REVIEW',
  'APPROVED',
  'PAID',
  'PARTIALLY_PAID',
  'OVERDUE',
  'DISPUTED',
  'REJECTED',
]
const vendors = [
  { id: 'ven-9491326', name: 'Oceanic Systems', code: '9491326' },
  { id: 'ven-2841075', name: 'Aster Labs', code: '2841075' },
  { id: 'ven-6304912', name: 'Bluebird Logistics', code: '6304912' },
  { id: 'ven-5172038', name: 'Cedar Cloud Services', code: '5172038' },
  { id: 'ven-8026149', name: 'Meridian Office Supply', code: '8026149' },
  { id: 'ven-1367802', name: 'Summit Manufacturing', code: '1367802' },
]
const departments = [
  { id: 'dept-finance', name: 'Finance' },
  { id: 'dept-ops', name: 'Operations' },
  { id: 'dept-technology', name: 'Technology' },
  { id: 'dept-people', name: 'People' },
]
const users = [
  { id: 'usr-divya-iyer', name: 'Divya Iyer' },
  { id: 'usr-anita-rao', name: 'Anita Rao' },
  { id: 'usr-rahul-mehta', name: 'Rahul Mehta' },
  { id: 'usr-sana-khan', name: 'Sana Khan' },
]
const matchStatuses = ['MATCHED', 'DISCREPANCY']
const invoices = Array.from({ length: 120 }, (_, index) => {
  const invoiceNumber = index + 1
  const vendor = vendors[index % vendors.length]
  const department = departments[Math.floor(index / 2) % departments.length]
  const status = statuses[index % statuses.length]
  const invoiceDate = new Date(Date.UTC(2026, 9, 1 + index))
    .toISOString()
    .slice(0, 10)

  return {
    id: `inv-${String(1001 + index)}`,
    number: `INV-2026-${String(1001 + index)}`,
    isNew: index % 9 === 0,
    purchaseOrder: {
      id: `po-${600 + invoiceNumber}`,
      number: `PO - ${600 + invoiceNumber}`,
      additionalCount: index % 7 === 0 ? (index % 3) + 1 : 0,
    },
    status,
    vendor,
    invoiceDate,
    dueDate: new Date(Date.UTC(2026, 10, 15 + (index % 45)))
      .toISOString()
      .slice(0, 10),
    amount: 12450 + ((index * 73829) % 2450000),
    currency: 'INR',
    matchStatus: matchStatuses[index % matchStatuses.length],
    department,
    createdBy: users[index % users.length],
  }
})

function createInvoiceDetail(invoice) {
  const invoiceIndex = Number(invoice.id.slice(4)) - 1001
  const lineItems = Array.from({ length: 3 }, (_, lineIndex) => {
    const invoiceQuantity = 2 + ((invoiceIndex + lineIndex) % 12)
    const unitPrice = 850 + ((invoiceIndex * 97 + lineIndex * 1350) % 26000)
    const totalAmount = invoiceQuantity * unitPrice

    return {
      id: `line-${invoice.id}-${lineIndex + 1}`,
      materialCode: `MAT-${String(20021 + invoiceIndex * 3 + lineIndex)}`,
      materialName: [
        'Industrial bearing assembly',
        'Precision mounting bracket',
        'Electrical control unit',
      ][lineIndex],
      description: [
        'Heavy-duty sealed roller bearing',
        'Powder-coated steel mounting set',
        'Three-phase motor control module',
      ][lineIndex],
      uom: 'EA',
      hsnCode: ['848210', '732690', '853710'][lineIndex],
      poQuantity: invoiceQuantity + (lineIndex === 0 ? 2 : 0),
      invoiceQuantity,
      receivedQuantity: invoiceQuantity - (lineIndex === 2 ? 1 : 0),
      unitPrice,
      totalAmount,
      taxPercent: 18,
      taxAmount: Math.round(totalAmount * 0.18),
      matchStatus:
        invoice.matchStatus === 'DISCREPANCY' && lineIndex === 1
          ? 'DISCREPANCY'
          : 'MATCHED',
    }
  })
  const subtotal = lineItems.reduce((sum, item) => sum + item.totalAmount, 0)
  const taxAmount = lineItems.reduce((sum, item) => sum + item.taxAmount, 0)
  const purchaseOrderId = invoice.purchaseOrder.id

  return {
    data: {
      document: {
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        type: 'INVOICE',
        invoiceType: 'STANDARD',
        currency: invoice.currency,
        version: '1.0',
        versions: [{ version: '1.0', updatedAt: `${invoice.invoiceDate}T09:30:00+05:30` }],
        versionNote: null,
        date: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        department: invoice.department.id,
        purchaseOrder: {
          id: purchaseOrderId,
          number: invoice.purchaseOrder.number,
        },
        reference: `REF-${String(2026000 + invoiceIndex)}`,
      },
      collaboration: {
        openCommentCount: invoiceIndex % 3,
      },
      workflow: {
        steps: [
          { id: 'submitted', label: 'Submitted', status: 'done' },
          {
            id: 'matching',
            label: 'PO match',
            status: invoice.matchStatus === 'DISCREPANCY' ? 'current' : 'done',
          },
          {
            id: 'approval',
            label: 'Approval',
            status:
              invoice.status === 'UNDER_REVIEW' ? 'current' : 'upcoming',
          },
          {
            id: 'payment',
            label: 'Payment',
            status: ['PAID', 'PARTIALLY_PAID'].includes(invoice.status)
              ? 'done'
              : 'upcoming',
          },
        ],
      },
      vendor: {
        ...invoice.vendor,
        legalName: invoice.vendor.name,
        gstin: `27AAAC${String(invoiceIndex + 1).padStart(4, '0')}1Z${invoiceIndex % 9}`,
        officeAddress: `${120 + invoiceIndex % 40}, Maker Chambers, Mumbai, Maharashtra`,
        email: `ap@${invoice.vendor.name.toLowerCase().replaceAll(' ', '')}.example`,
        phone: '+91 22 4000 2180',
      },
      buyer: {
        legalName: 'Northstar Industries Private Limited',
        gstin: '27AABCN2045F1Z6',
        billingAddress: '8th Floor, Trade Centre, Bandra Kurla Complex, Mumbai 400051',
      },
      shipTo: {
        name: invoice.department.name,
        address: 'Northstar Distribution Centre, Navi Mumbai, Maharashtra',
      },
      totals: {
        subtotal,
        discount: 0,
        taxAmount,
        taxLabel: 'GST (18%)',
        grandTotal: subtotal + taxAmount,
        committed: subtotal + taxAmount,
      },
      terms: {
        payment: 'NET_30',
      },
      notes:
        invoiceIndex % 4 === 0
          ? 'Please include the purchase order number on all payment correspondence.'
          : null,
      threeWayMatch: {
        comparison: [
          { key: 'quantity', label: 'Quantity', status: invoice.matchStatus },
          { key: 'unitPrice', label: 'Unit price', status: 'MATCHED' },
          { key: 'tax', label: 'Tax details', status: 'MATCHED' },
        ],
        discrepancies:
          invoice.matchStatus === 'DISCREPANCY'
            ? [
                {
                  id: `disc-${invoice.id}`,
                  field: 'Quantity',
                  invoiceValue: lineItems[1].invoiceQuantity,
                  orderValue: lineItems[1].poQuantity,
                  message: 'Invoice quantity differs from the purchase order.',
                },
              ]
            : [],
      },
      accounting: {
        costCenter: `CC-${String(4100 + (invoiceIndex % 12))}`,
        glAccount: '510200 - Operating supplies',
        taxId: 'GST input tax',
      },
      statutory: {
        irn: `IRN${String(invoiceIndex + 1).padStart(8, '0')}2026`,
        eInvoice: {
          verificationStatus: 'VERIFIED',
          irnGeneratedAt: `${invoice.invoiceDate}T10:15:00+05:30`,
          taxableAmount: subtotal,
          cgstAmount: Math.round(taxAmount / 2),
          sgstAmount: taxAmount - Math.round(taxAmount / 2),
          totalTaxAmount: taxAmount,
        },
      },
      payment: {
        status: ['PAID', 'PARTIALLY_PAID'].includes(invoice.status)
          ? invoice.status
          : 'SCHEDULED',
        method: 'BANK_TRANSFER',
      },
      beneficiary: {
        name: invoice.vendor.name,
        accountLast4: String(1200 + (invoiceIndex % 8700)).slice(-4),
      },
      links: {
        payments:
          invoice.status === 'PAID'
            ? [
                {
                  id: `pay-${invoice.id}`,
                  number: `PAY-${String(invoiceIndex + 8001)}`,
                  status: 'COMPLETED',
                  amount: subtotal + taxAmount,
                  currency: invoice.currency,
                },
              ]
            : [],
        documents: [
          {
            id: `doc-${invoice.id}-1`,
            name: `${invoice.number}.pdf`,
            meta: 'Original invoice · PDF',
            url: '#',
          },
          {
            id: `doc-${invoice.id}-2`,
            name: 'Purchase order confirmation.pdf',
            meta: 'Supporting document · PDF',
            url: '#',
          },
        ],
      },
      permissions: {
        amend: !['CANCELLED', 'CLOSED'].includes(invoice.status),
        attach: true,
      },
    },
    lineItems,
    activity: [
      {
        id: `act-${invoice.id}-3`,
        kind: 'APPROVAL_REQUESTED',
        actor: users[invoiceIndex % users.length],
        at: `${invoice.invoiceDate}T11:30:00+05:30`,
        subject: 'Invoice approval',
        approvalId: `APR-${String(invoiceIndex + 601).padStart(4, '0')}`,
      },
      {
        id: `act-${invoice.id}-2`,
        kind: 'MODIFIED',
        actor: users[(invoiceIndex + 1) % users.length],
        at: `${invoice.invoiceDate}T10:15:00+05:30`,
        changeCount: 1,
      },
      {
        id: `act-${invoice.id}-1`,
        kind: 'CREATED',
        actor: users[invoiceIndex % users.length],
        at: `${invoice.invoiceDate}T09:30:00+05:30`,
        message: 'Invoice received and added to the workspace.',
      },
    ],
  }
}

const invoiceDetails = new Map(
  invoices.map((invoice) => [invoice.id, createInvoiceDetail(invoice)]),
)
const savedViews = new Map()
let nextActionId = 1
let nextAttachmentId = 1
let nextAmendmentId = 1
let nextCreatedInvoiceId = 1121
const idempotentCreates = new Map()

function sendJson(response, status, payload) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(payload))
}

function sendError(response, status, code, message, details = []) {
  sendJson(response, status, { error: { code, message, details } })
}

async function readBody(request) {
  const chunks = []
  let size = 0

  for await (const chunk of request) {
    size += chunk.length
    if (size > 1024 * 1024) {
      throw new Error('Request body exceeds the 1 MB development limit.')
    }
    chunks.push(chunk)
  }

  if (size === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function readJsonParameter(params, name, fallback) {
  const value = params.get(name)
  if (value === null) return fallback

  try {
    return JSON.parse(value)
  } catch {
    throw new Error(`Query parameter "${name}" must contain valid JSON.`)
  }
}

function getFieldValue(row, field) {
  return field.split('.').reduce((value, key) => value?.[key], row)
}

function matchesFilter(row, filter) {
  const actual = getFieldValue(row, filter.field)
  const expected = filter.value

  switch (filter.operator) {
    case 'eq':
      return actual === expected
    case 'neq':
      return actual !== expected
    case 'gt':
      return actual > expected
    case 'gte':
      return actual >= expected
    case 'lt':
      return actual < expected
    case 'lte':
      return actual <= expected
    case 'contains':
      return String(actual ?? '').toLowerCase().includes(String(expected).toLowerCase())
    case 'starts_with':
      return String(actual ?? '').toLowerCase().startsWith(String(expected).toLowerCase())
    case 'ends_with':
      return String(actual ?? '').toLowerCase().endsWith(String(expected).toLowerCase())
    case 'in':
      return expected.includes(actual)
    case 'not_in':
      return !expected.includes(actual)
    case 'is_empty':
      return actual === undefined || actual === null || actual === ''
    case 'is_not_empty':
      return actual !== undefined && actual !== null && actual !== ''
    default:
      throw new Error(`Unsupported filter operator "${filter.operator}".`)
  }
}

function applyQuery(query) {
  let result = [...invoices]

  if (query.search) {
    const search = String(query.search).toLowerCase()
    result = result.filter((invoice) =>
      [
        invoice.number,
        invoice.purchaseOrder.number,
        invoice.vendor.name,
        invoice.vendor.code,
      ].some((value) => value.toLowerCase().includes(search)),
    )
  }

  for (const filter of query.filters) {
    result = result.filter((row) => matchesFilter(row, filter))
  }

  if (query.sort.length === 0) {
    result.sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate))
  } else {
    result.sort((a, b) => {
      for (const item of query.sort) {
        const left = getFieldValue(a, item.field)
        const right = getFieldValue(b, item.field)
        if (left === right) continue
        if (left === undefined || left === null || left === '') return 1
        if (right === undefined || right === null || right === '') return -1
        const comparison =
          typeof left === 'number' && typeof right === 'number'
            ? left - right
            : String(left).localeCompare(String(right))
        return item.order === 'asc' ? comparison : -comparison
      }
      return 0
    })
  }

  return result
}

function parseListQuery(params) {
  const page = Number(params.get('page') ?? 1)
  const pageSize = Number(params.get('pageSize') ?? 20)
  const search = params.get('search') ?? ''
  const sort = readJsonParameter(params, 'sort', [])
  const filters = readJsonParameter(params, 'filters', [])

  if (!Number.isInteger(page) || page < 1) {
    throw new Error('Query parameter "page" must be a positive integer.')
  }
  if (![20, 50, 100].includes(pageSize)) {
    throw new Error('Query parameter "pageSize" must be 20, 50, or 100.')
  }
  if (!Array.isArray(sort) || !Array.isArray(filters)) {
    throw new Error('Query parameters "sort" and "filters" must be arrays.')
  }
  for (const item of sort) {
    if (
      typeof item?.field !== 'string' ||
      !['asc', 'desc'].includes(item.order)
    ) {
      throw new Error('A sort entry must include a field and asc/desc order.')
    }
  }
  for (const filter of filters) {
    if (
      typeof filter?.field !== 'string' ||
      typeof filter.operator !== 'string'
    ) {
      throw new Error('Each filter must include a field and operator.')
    }
    if (
      filter.operator === 'in' &&
      (!Array.isArray(filter.value) || filter.value.length === 0)
    ) {
      throw new Error('An "in" filter must have at least one value.')
    }
  }

  return { page, pageSize, search, sort, filters }
}

function parseDetailPageQuery(params, fallbackPageSize) {
  const page = Number(params.get('page') ?? 1)
  const pageSize = Number(params.get('pageSize') ?? fallbackPageSize)
  const search = params.get('search') ?? ''
  const sort = readJsonParameter(params, 'sort', [])
  const filters = readJsonParameter(params, 'filters', [])

  if (!Number.isInteger(page) || page < 1) {
    throw new Error('Query parameter "page" must be a positive integer.')
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new Error('Query parameter "pageSize" must be between 1 and 100.')
  }
  if (!Array.isArray(sort) || !Array.isArray(filters)) {
    throw new Error('Query parameters "sort" and "filters" must be arrays.')
  }
  return { page, pageSize, search, sort, filters }
}

function paginateDetailRows(rows, query) {
  let result = rows
  if (query.search) {
    const search = query.search.toLowerCase()
    result = result.filter((row) =>
      Object.values(row).some((value) =>
        String(value ?? '').toLowerCase().includes(search),
      ),
    )
  }
  for (const filter of query.filters) {
    result = result.filter((row) => matchesFilter(row, filter))
  }
  if (query.sort.length > 0) {
    result = [...result].sort((left, right) => {
      for (const item of query.sort) {
        const a = getFieldValue(left, item.field)
        const b = getFieldValue(right, item.field)
        if (a === b) continue
        const comparison = String(a ?? '').localeCompare(String(b ?? ''), undefined, {
          numeric: true,
        })
        return item.order === 'asc' ? comparison : -comparison
      }
      return 0
    })
  }
  const start = (query.page - 1) * query.pageSize
  return {
    rows: result.slice(start, start + query.pageSize),
    total: result.length,
    hasMore: start + query.pageSize < result.length,
  }
}

function linkedRows(invoice, kind, detail) {
  if (kind === 'purchase_orders') {
    if (!invoice.purchaseOrder?.id) return []
    return [
      {
        id: invoice.purchaseOrder.id,
        number: invoice.purchaseOrder.number,
        status: 'APPROVED',
        date: invoice.invoiceDate,
        value: detail.data.totals.grandTotal,
      },
    ]
  }
  if (kind === 'goods_receipts') {
    if (!invoice.purchaseOrder?.id) return []
    return [
      {
        id: `grn-${invoice.id}`,
        number: `GRN-${String(Number(invoice.id.slice(4)) + 4000)}`,
        status: 'RECEIVED',
        date: invoice.invoiceDate,
        itemsCovered: `${detail.lineItems.length} items`,
      },
    ]
  }
  return null
}

function createInvoiceFormDefaults() {
  return {
    record: { id: null, number: null, status: null, version: null, updatedAt: null },
    document: {
      title: 'New Invoice',
      statusNote: 'Draft — upload an invoice on the left to auto-fill, or enter details manually',
      breadcrumb: 'New Invoice',
      number: null,
      invoiceType: 'Non-PO Invoice',
      date: null,
      dueDate: null,
      department: 'Procurement',
      currency: 'INR',
      sourceFile: null,
    },
    purchaseOrder: { id: null },
    vendor: { legalName: null, gstin: null, registeredAddress: null },
    buyer: { legalName: 'Reliance Industries Limited', gstin: '24AAACR5055K1ZS' },
    lineItems: [],
    notes: null,
    totals: { grandTotal: 0, subtotal: 0, taxAmount: 0 },
    statutory: {
      irn: null,
      eInvoice: {
        taxableAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        totalTaxAmount: 0,
      },
    },
    terms: { payment: 'Net 30 Days' },
    beneficiary: { bankName: null, accountNumber: null, ifsc: null },
  }
}

function createPurchaseOrderOptions() {
  const seen = new Set()
  return invoices.flatMap((invoice) => {
    const id = invoice.purchaseOrder.id
    if (seen.has(id)) return []
    seen.add(id)
    return [{
      value: id,
      label: `${invoice.purchaseOrder.number} — ${invoice.vendor.name}`,
      description: `Released · ${new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: invoice.currency,
        maximumFractionDigits: 0,
      }).format(invoice.amount)}`,
    }]
  })
}

function createInvoiceFromPayload(payload) {
  const invoiceId = `inv-${nextCreatedInvoiceId++}`
  const number = payload.document.number
  const selectedOrder = invoices.find(
    (invoice) => invoice.purchaseOrder.id === payload.purchaseOrder,
  )
  const vendor = selectedOrder?.vendor ?? {
    id: `ven-new-${invoiceId}`,
    name: 'Invoice supplier',
    code: String(payload.vendor.gstin ?? '').slice(-7),
  }
  const department =
    departments.find((item) => item.name === payload.document.department) ?? {
      id: `dept-${String(payload.document.department).toLowerCase().replaceAll(' ', '-')}`,
      name: payload.document.department,
    }
  const lineItems = payload.lineItems.map((item, index) => {
    const totalAmount = Number(item.invoiceQuantity) * Number(item.unitPrice)
    const taxAmount = Math.round(totalAmount * (Number(item.taxPercent) / 100))
    return {
      id: `line-${invoiceId}-${index + 1}`,
      materialCode: item.materialCode,
      materialName: item.description,
      description: item.description,
      uom: item.uom,
      hsnCode: '',
      poQuantity: item.invoiceQuantity,
      invoiceQuantity: Number(item.invoiceQuantity),
      receivedQuantity: Number(item.invoiceQuantity),
      unitPrice: Number(item.unitPrice),
      totalAmount,
      taxPercent: Number(item.taxPercent),
      taxAmount,
      matchStatus: 'MATCHED',
    }
  })
  const subtotal = lineItems.reduce((sum, item) => sum + item.totalAmount, 0)
  const taxAmount = lineItems.reduce((sum, item) => sum + item.taxAmount, 0)
  const amount = subtotal + taxAmount
  const invoice = {
    id: invoiceId,
    number,
    isNew: true,
    purchaseOrder: selectedOrder?.purchaseOrder ?? {
      id: null,
      number: '—',
      additionalCount: 0,
    },
    status: 'SUBMITTED',
    vendor,
    invoiceDate: payload.document.date,
    dueDate: payload.document.dueDate ?? payload.document.date,
    amount,
    currency: payload.document.currency ?? 'INR',
    matchStatus: 'MATCHED',
    department,
    createdBy: users[0],
  }
  const detail = createInvoiceDetail(invoice)
  detail.data.document = {
    ...detail.data.document,
    id: invoiceId,
    number,
    status: 'SUBMITTED',
    invoiceType: payload.document.invoiceType,
    currency: invoice.currency,
    version: '1.0',
    date: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    department: department.id,
    purchaseOrder: selectedOrder
      ? { ...selectedOrder.purchaseOrder }
      : null,
  }
  detail.data.vendor = {
    ...detail.data.vendor,
    legalName: vendor.name,
    gstin: payload.vendor.gstin,
    officeAddress: selectedOrder
      ? 'Supplier address on file'
      : '',
  }
  detail.data.terms = { payment: payload.terms.payment }
  detail.data.beneficiary = {
    name: vendor.name,
    accountLast4: String(payload.beneficiary.accountNumber ?? '').slice(-4),
  }
  detail.data.totals = {
    subtotal,
    discount: 0,
    taxAmount,
    taxLabel: 'GST',
    grandTotal: amount,
    committed: amount,
  }
  detail.data.notes = payload.notes
  detail.data.statutory.eInvoice = {
    verificationStatus: 'PENDING',
    taxableAmount: subtotal,
    cgstAmount: Math.round(taxAmount / 2),
    sgstAmount: taxAmount - Math.round(taxAmount / 2),
    totalTaxAmount: taxAmount,
  }
  detail.data.links.documents = []
  detail.lineItems = lineItems
  detail.activity = [{
    id: `act-${invoiceId}-created`,
    kind: 'CREATED',
    actor: users[0],
    at: new Date().toISOString(),
    message: 'Invoice created and submitted.',
  }]
  invoices.push(invoice)
  invoiceDetails.set(invoiceId, detail)
  return {
    id: invoiceId,
    number,
    status: 'SUBMITTED',
    version: 1,
  }
}

async function handleRequest(request, response, url) {
  const { pathname, searchParams } = url
  const method = request.method ?? 'GET'

  if (pathname === '/api/trade/upload_file' && method === 'POST') {
    const file = await readBody(request)
    if (
      typeof file.name !== 'string' ||
      typeof file.type !== 'string' ||
      typeof file.data !== 'string'
    ) {
      sendError(response, 400, 'INVALID_UPLOAD', 'An upload requires name, type, and base64 data.')
      return
    }
    sendJson(response, 200, {
      id: `upload-${nextAttachmentId}`,
      name: file.name,
      type: file.type,
      url: `/mock-files/${encodeURIComponent(file.name)}`,
    })
    return
  }

  const templateId = searchParams.get('id')
  if (
    pathname === '/api/p2p/template' &&
    method === 'GET' &&
    templateId === 'tpl_invoice_create_v1'
  ) {
    sendJson(response, 200, createEnvelope)
    return
  }

  if (templateId === 'tpl_invoice_create_v1') {
    if (pathname === '/api/p2p/data' && method === 'GET') {
      if (searchParams.has('record_id')) {
        sendError(response, 404, 'NOT_FOUND', 'Invoice draft was not found.')
        return
      }
      sendJson(response, 200, createInvoiceFormDefaults())
      return
    }

    if (pathname === '/api/p2p/options' && method === 'GET') {
      if (searchParams.get('field') !== 'purchaseOrder.id') {
        sendError(response, 400, 'UNKNOWN_OPTION_FIELD', 'No options are available for this field.')
        return
      }
      sendJson(response, 200, { values: createPurchaseOrderOptions() })
      return
    }

    if (pathname === '/api/p2p/data' && method === 'POST') {
      if (searchParams.has('record_id')) {
        sendError(response, 409, 'INVALID_TRANSITION', 'A submitted invoice cannot be edited on the create page.')
        return
      }
      const idempotencyKey = request.headers['idempotency-key']
      if (typeof idempotencyKey !== 'string' || idempotencyKey.length === 0) {
        sendError(response, 400, 'INVALID_REQUEST', 'An Idempotency-Key header is required.')
        return
      }
      const payload = await readBody(request)
      const serializedPayload = JSON.stringify(payload)
      const priorRequest = idempotentCreates.get(idempotencyKey)
      if (priorRequest) {
        if (priorRequest.payload !== serializedPayload) {
          sendError(response, 422, 'IDEMPOTENCY_MISMATCH', 'The Idempotency-Key was already used with a different invoice.')
          return
        }
        sendJson(response, priorRequest.status, priorRequest.result)
        return
      }
      if (
        payload.documentType !== 'INVOICE' ||
        payload.status !== 'SUBMITTED' ||
        !payload.document ||
        !Array.isArray(payload.lineItems)
      ) {
        sendError(response, 400, 'INVALID_REQUEST', 'The invoice submission does not match the create contract.')
        return
      }
      const validationDetails = []
      if (typeof payload.document.number !== 'string' || !payload.document.number.trim()) {
        validationDetails.push({
          path: 'document.number',
          message: 'Enter an invoice number.',
        })
      } else if (invoices.some((invoice) => invoice.number === payload.document.number)) {
        validationDetails.push({
          path: 'document.number',
          message: 'This invoice number is already in use.',
        })
      }
      if (!payload.document.date) {
        validationDetails.push({
          path: 'document.date',
          message: 'Select an invoice date.',
        })
      }
      if (validationDetails.length > 0) {
        sendError(
          response,
          422,
          'VALIDATION_FAILED',
          'Please correct the highlighted invoice fields.',
          validationDetails,
        )
        return
      }

      const result = createInvoiceFromPayload(payload)
      idempotentCreates.set(idempotencyKey, {
        payload: serializedPayload,
        result,
        status: 201,
      })
      sendJson(response, 201, result)
      return
    }
  }

  if (
    pathname === '/api/p2p/template' &&
    method === 'GET' &&
    templateId === 'tpl_invoice_default'
  ) {
    sendJson(response, 200, detailEnvelope)
    return
  }

  if (
    templateId === 'tpl_invoice_default' &&
    pathname.startsWith('/api/p2p/')
  ) {
    const recordId = searchParams.get('record_id')
    const invoice = invoices.find((item) => item.id === recordId)
    const detail = invoiceDetails.get(recordId)
    if (!invoice || !detail) {
      sendError(response, 404, 'INVOICE_NOT_FOUND', 'Invoice record was not found.')
      return
    }

    if (pathname === '/api/p2p/data' && method === 'GET') {
      sendJson(response, 200, detail.data)
      return
    }

    if (pathname === '/api/p2p/line_items' && method === 'GET') {
      const query = parseDetailPageQuery(searchParams, 10)
      sendJson(response, 200, paginateDetailRows(detail.lineItems, query))
      return
    }

    if (pathname === '/api/p2p/links' && method === 'GET') {
      const rows = linkedRows(invoice, searchParams.get('kind'), detail)
      if (!rows) {
        sendError(response, 400, 'UNKNOWN_LINK_KIND', 'Unsupported invoice link kind.')
        return
      }
      const query = parseDetailPageQuery(searchParams, 5)
      sendJson(response, 200, paginateDetailRows(rows, query))
      return
    }

    if (pathname === '/api/p2p/activity' && method === 'GET') {
      sendJson(response, 200, {
        items: detail.activity,
        total: detail.activity.length,
      })
      return
    }

    if (pathname === '/api/p2p/options' && method === 'GET') {
      sendJson(response, 200, {
        values: {
          'document.invoiceType': [
            { value: 'STANDARD', label: 'Standard invoice' },
            { value: 'CREDIT_NOTE', label: 'Credit note' },
            { value: 'DEBIT_NOTE', label: 'Debit note' },
          ],
          'document.department': [
            ...new Map(
              invoices.map((row) => [
                row.department.id,
                { value: row.department.id, label: row.department.name },
              ]),
            ).values(),
          ],
          'vendor.legalName': [
            ...new Map(
              invoices.map((row) => [
                row.vendor.name,
                { value: row.vendor.name, label: row.vendor.name },
              ]),
            ).values(),
          ],
        },
      })
      return
    }

    if (pathname === '/api/p2p/amendments' && method === 'POST') {
      const amendment = await readBody(request)
      if (
        amendment.documentId !== recordId ||
        amendment.documentType !== 'INVOICE' ||
        amendment.intent !== 'amend' ||
        !Array.isArray(amendment.changedFields) ||
        amendment.changedFields.length === 0
      ) {
        sendError(response, 400, 'INVALID_AMENDMENT', 'The amendment payload is invalid.')
        return
      }
      for (const change of amendment.changedFields) {
        if (
          typeof change.field !== 'string' ||
          !['document.dueDate', 'document.invoiceType', 'document.department', 'vendor.legalName'].includes(change.field)
        ) {
          sendError(response, 400, 'INVALID_AMENDMENT_FIELD', 'The amendment contains an unsupported field.')
          return
        }
        const parts = change.field.split('.')
        const target = parts.slice(0, -1).reduce((value, key) => value[key], detail.data)
        target[parts.at(-1)] = change.value
        if (change.field === 'document.dueDate') {
          invoice.dueDate = change.value
        }
        if (change.field === 'document.department') {
          const department = invoices.find(
            (row) => row.department.id === change.value,
          )?.department
          if (department) {
            invoice.department = { ...department }
            detail.data.document.department = department.id
          }
        }
        if (change.field === 'vendor.legalName') {
          invoice.vendor.name = change.value
          detail.data.vendor.name = change.value
        }
      }
      const versionNumber = Number.parseFloat(detail.data.document.version) + 1
      detail.data.document.version = versionNumber.toFixed(1)
      detail.data.document.versions.push({
        version: detail.data.document.version,
        updatedAt: new Date().toISOString(),
      })
      detail.activity.unshift({
        id: `act-${recordId}-amendment-${nextAmendmentId}`,
        kind: 'AMENDED',
        actor: users[0],
        at: new Date().toISOString(),
        changeCount: amendment.changedFields.length,
        reason: amendment.reason ?? '',
      })
      sendJson(response, 200, {
        id: `AMD-${String(nextAmendmentId++).padStart(4, '0')}`,
        status: 'AMENDED',
        version: detail.data.document.version,
      })
      return
    }

    if (pathname === '/api/p2p/attachments' && method === 'POST') {
      const attachment = await readBody(request)
      if (
        typeof attachment.name !== 'string' ||
        typeof attachment.url !== 'string' ||
        typeof attachment.type !== 'string'
      ) {
        sendError(response, 400, 'INVALID_ATTACHMENT', 'An attachment requires name, url, and type.')
        return
      }
      const id = `doc-${recordId}-${nextAttachmentId++}`
      detail.data.links.documents.push({
        id,
        name: attachment.name,
        meta: 'Supporting document',
        url: attachment.url,
      })
      detail.activity.unshift({
        id: `act-${recordId}-attachment-${nextAttachmentId}`,
        kind: 'ATTACHED',
        actor: users[0],
        at: new Date().toISOString(),
        message: `${attachment.name} attached.`,
      })
      sendJson(response, 200, { id, ...attachment })
      return
    }
  }

  if (searchParams.get('id') !== 'tpl_invoice_list_default') {
    sendError(response, 404, 'UNKNOWN_LIST', 'Unknown invoice list id.')
    return
  }

  if (pathname === '/api/p2p/template' && method === 'GET') {
    sendJson(response, 200, envelope)
    return
  }

  if (pathname === '/api/p2p/data' && method === 'GET') {
    const query = parseListQuery(searchParams)
    const matched = applyQuery(query)
    const start = (query.page - 1) * query.pageSize
    sendJson(response, 200, {
      rows: matched.slice(start, start + query.pageSize),
      total: matched.length,
      hasMore: start + query.pageSize < matched.length,
    })
    return
  }

  if (pathname === '/api/p2p/counts' && method === 'GET') {
    const views = readJsonParameter(searchParams, 'views', {})
    if (!views || typeof views !== 'object' || Array.isArray(views)) {
      throw new Error('Query parameter "views" must be a JSON object.')
    }
    const counts = Object.fromEntries(
      Object.entries(views).map(([id, filters]) => {
        if (!Array.isArray(filters)) {
          throw new Error(`Filters for view "${id}" must be an array.`)
        }
        const matched = applyQuery({ search: '', sort: [], filters })
        return [id, matched.length]
      }),
    )
    sendJson(response, 200, { counts })
    return
  }

  if (pathname === '/api/p2p/saved_views' && method === 'GET') {
    sendJson(response, 200, { views: [...savedViews.values()] })
    return
  }

  if (pathname === '/api/p2p/saved_views' && method === 'POST') {
    const view = await readBody(request)
    if (
      typeof view.id !== 'string' ||
      typeof view.name !== 'string' ||
      !Array.isArray(view.filters)
    ) {
      sendError(
        response,
        400,
        'INVALID_SAVED_VIEW',
        'A saved view requires an id, name, and filters array.',
      )
      return
    }
    if (!savedViews.has(view.id)) savedViews.set(view.id, view)
    sendJson(response, 200, savedViews.get(view.id))
    return
  }

  if (pathname === '/api/p2p/filter_options' && method === 'GET') {
    if (searchParams.get('field') !== 'department.id') {
      sendError(
        response,
        400,
        'UNKNOWN_FILTER_FIELD',
        'Only department.id filter options are available.',
      )
      return
    }
    const limit = Number(searchParams.get('limit') ?? 100)
    const values = [
      ...new Map(
        invoices.map((invoice) => [
          invoice.department.id,
          { value: invoice.department.id, label: invoice.department.name },
        ]),
      ).values(),
    ]
    sendJson(response, 200, { values: values.slice(0, limit) })
    return
  }

  if (pathname === '/api/p2p/bulk_action' && method === 'POST') {
    const action = await readBody(request)
    if (!['approve', 'remind', 'export'].includes(action.operation)) {
      sendError(
        response,
        400,
        'UNKNOWN_OPERATION',
        'Operation must be approve, remind, or export.',
      )
      return
    }
    if (!Array.isArray(action.ids) || !Array.isArray(action.query?.filters)) {
      sendError(
        response,
        400,
        'INVALID_BULK_ACTION',
        'Bulk actions require ids and a query with filters.',
      )
      return
    }

    if (action.operation === 'approve') {
      const selectedIds = new Set(
        action.target === 'selected'
          ? action.ids
          : applyQuery({
              search: action.query.search ?? '',
              sort: action.query.sort ?? [],
              filters: action.query.filters,
            }).map((invoice) => invoice.id),
      )
      for (const invoice of invoices) {
        if (selectedIds.has(invoice.id)) {
          invoice.status = 'APPROVED'
          const detail = invoiceDetails.get(invoice.id)
          if (detail) detail.data.document.status = invoice.status
        }
      }
    }

    const id = `mock-action-${nextActionId++}`
    sendJson(response, 200, { id })
    return
  }

  sendError(response, 404, 'NOT_FOUND', 'Mock invoice API endpoint not found.')
}

export async function handleMockApiRequest(request, response, url) {
  try {
    await handleRequest(request, response, url)
  } catch (error) {
    if (response.headersSent) throw error
    sendError(response, 400, 'INVALID_REQUEST', error.message)
  }
}

export function invoiceMockApi() {
  return {
    name: 'invoice-list-mock-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (
          !request.url?.startsWith('/api/p2p/') &&
          !request.url?.startsWith('/api/trade/')
        ) {
          next()
          return
        }

        let url
        try {
          url = new URL(request.url, 'http://localhost')
          await handleMockApiRequest(request, response, url)
        } catch (error) {
          if (response.headersSent) {
            server.config.logger.error(error)
            response.destroy(error)
            return
          }
          server.config.logger.error(error)
          sendError(response, 500, 'INTERNAL_ERROR', 'The mock API request failed.')
        }
      })
      server.config.logger.info(
        `Invoice mock API ready (${invoices.length} sample invoices).`,
        { timestamp: true },
      )
    },
  }
}

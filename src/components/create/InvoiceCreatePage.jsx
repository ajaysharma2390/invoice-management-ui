import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Row,
  Select,
  Skeleton,
  Space,
  Table,
  Typography,
} from 'antd'
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  FilePdfOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { requestApi, resolvePath } from '../../services/xhr.js'
import './InvoiceCreatePage.css'

const TEMPLATE_ID = 'tpl_invoice_create_v1'
const { Text, Title } = Typography
const inlineOptions = {
  'document.invoiceType': [
    { value: 'Non-PO Invoice', label: 'Non-PO Invoice' },
    { value: 'PO Invoice', label: 'PO Invoice' },
  ],
  'document.department': [
    { value: 'Procurement', label: 'Procurement' },
    { value: 'Finance', label: 'Finance' },
    { value: 'Operations', label: 'Operations' },
    { value: 'Technology', label: 'Technology' },
  ],
  'terms.payment': [
    { value: 'Net 15 Days', label: 'Net 15 Days' },
    { value: 'Net 30 Days', label: 'Net 30 Days' },
    { value: 'Net 45 Days', label: 'Net 45 Days' },
    { value: 'Net 60 Days', label: 'Net 60 Days' },
  ],
  'lineItems.uom': [
    { value: 'EA', label: 'EA' },
    { value: 'Nos', label: 'Nos' },
    { value: 'KG', label: 'KG' },
    { value: 'LTR', label: 'LTR' },
    { value: 'SET', label: 'Set' },
  ],
}

function getAtPath(source, path) {
  return path.split('.').reduce((value, key) => value?.[key], source)
}

function hasAtPath(source, path) {
  let value = source
  for (const key of path.split('.')) {
    if (!value || !Object.hasOwn(value, key)) return false
    value = value[key]
  }
  return true
}

function setAtPath(target, path, value) {
  const parts = path.split('.')
  const last = parts.pop()
  const parent = parts.reduce((current, key) => {
    if (!current[key] || typeof current[key] !== 'object') current[key] = {}
    return current[key]
  }, target)
  parent[last] = value
}

function makeIdempotencyKey() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Secure request IDs are not available in this browser.')
  }
  return globalThis.crypto.randomUUID()
}

function collectTouchedFields(initial, current, path = '') {
  if (Object.is(initial, current)) return []
  if (
    initial &&
    current &&
    typeof initial === 'object' &&
    typeof current === 'object'
  ) {
    const keys = new Set([...Object.keys(initial), ...Object.keys(current)])
    return [...keys].flatMap((key) => {
      if (!path && ['record', 'totals', 'statutory', 'buyer'].includes(key)) {
        return []
      }
      if (!path && key === '__initial') return []
      if (
        path === 'document' &&
        ['title', 'statusNote', 'breadcrumb', 'sourceFile'].includes(key)
      ) {
        return []
      }
      const childPath = path ? `${path}.${key}` : key
      return collectTouchedFields(initial[key], current[key], childPath)
    })
  }
  return path ? [path] : []
}

function buildPayload(template, data, intent) {
  const payload = {}
  const payloadMap = template.submit?.payloadMap ?? {}
  const touchedFields = collectTouchedFields(data.__initial, data)
  const sourceValues = {
    documentType: template.documentType,
    status: template.submit?.statusByIntent?.[intent],
    touchedFields,
  }

  for (const [bodyPath, mapping] of Object.entries(payloadMap)) {
    let value
    let exists = true
    if (typeof mapping === 'string') {
      exists = hasAtPath(data, mapping)
      value = getAtPath(data, mapping)
    } else if (mapping?.source) {
      value = sourceValues[mapping.source]
    } else if (mapping?.binding && mapping?.itemMap) {
      const rows = getAtPath(data, mapping.binding) ?? []
      value = rows.map((row) =>
        Object.fromEntries(
          Object.entries(mapping.itemMap)
            .filter(([, sourcePath]) => getAtPath(row, sourcePath) !== undefined)
            .map(([targetPath, sourcePath]) => [
              targetPath,
              getAtPath(row, sourcePath),
            ]),
        ),
      )
    } else {
      exists = false
    }

    if (exists && value !== undefined) setAtPath(payload, bodyPath, value)
  }

  return payload
}

function mapServerPath(payloadMap, serverPath) {
  const parts = serverPath.split('.')
  let bestMatch = null

  for (const [targetPath, mapping] of Object.entries(payloadMap)) {
    if (typeof mapping === 'string') {
      if (targetPath === serverPath) bestMatch = mapping
      else if (serverPath.startsWith(`${targetPath}.`)) {
        bestMatch = `${mapping}.${serverPath.slice(targetPath.length + 1)}`
      }
      continue
    }
    if (mapping?.binding && mapping?.itemMap) {
      const [arrayPath, index, ...rowPath] = parts
      if (arrayPath !== targetPath || !/^\d+$/.test(index ?? '')) continue
      for (const [targetField, sourceField] of Object.entries(mapping.itemMap)) {
        if (rowPath.join('.') === targetField) {
          bestMatch = `${mapping.binding}.${index}.${sourceField}`
        }
      }
      continue
    }
    if (mapping?.source) continue
    if (mapping && typeof mapping === 'object') {
      const prefix = `${targetPath}.`
      if (serverPath.startsWith(prefix)) {
        const suffix = serverPath.slice(prefix.length)
        bestMatch = mapping.binding
          ? `${mapping.binding}.${suffix}`
          : suffix
      }
    }
  }

  return bestMatch
}

function interpolate(value, data, idempotencyKey) {
  if (typeof value !== 'string') return value
  const match = value.match(/^\{\{(.+)\}\}$/)
  if (!match) return value
  if (match[1] === 'idempotencyKey') return idempotencyKey
  const resolved = getAtPath({ data }, match[1])
  return resolved ?? null
}

function formatCurrency(value, currency) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    maximumFractionDigits: 2,
  }).format(typeof value === 'number' ? value : 0)
}

function getInitialValues(data) {
  return {
    ...data,
    lineItems: data.lineItems ?? [],
  }
}

function toDateString(value) {
  if (value && typeof value.format === 'function') {
    return value.format('YYYY-MM-DD')
  }
  return value
}

function InvoiceCreatePage() {
  const [form] = Form.useForm()
  const [template, setTemplate] = useState(null)
  const [initialData, setInitialData] = useState(null)
  const [purchaseOrderOptions, setPurchaseOrderOptions] = useState([])
  const [sourceFile, setSourceFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [activeSection, setActiveSection] = useState('invoiceDetails')
  const [loadError, setLoadError] = useState(null)
  const [messageApi, contextHolder] = message.useMessage()
  const [idempotencyKey] = useState(makeIdempotencyKey)

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    async function loadForm() {
      try {
        const templateResponse = await requestApi('/p2p/template', {
          query: { id: TEMPLATE_ID },
          signal: controller.signal,
        })
        const formTemplate = templateResponse?.template ?? templateResponse
        if (
          !formTemplate?.apis?.create ||
          !formTemplate?.apis?.purchaseOrderOptions ||
          !formTemplate?.submit?.payloadMap ||
          !Array.isArray(formTemplate?.zones?.body)
        ) {
          throw new Error('The invoice form template is missing required sections or API definitions.')
        }

        const dataResponse = await requestApi('/p2p/data', {
          query: { id: TEMPLATE_ID },
          signal: controller.signal,
        })
        if (!dataResponse?.document || !dataResponse?.record || !Array.isArray(dataResponse.lineItems)) {
          throw new Error('The invoice form data response is incomplete.')
        }
        if (!active) return
        setTemplate(formTemplate)
        setInitialData(dataResponse)
        form.setFieldsValue(getInitialValues(dataResponse))

        const optionsSpec = formTemplate.apis.purchaseOrderOptions
        const optionResponse = await requestApi(optionsSpec.url, {
          method: optionsSpec.method ?? 'GET',
          query: optionsSpec.query,
          signal: controller.signal,
        })
        const values = resolvePath(
          optionResponse,
          optionsSpec.config?.listPath ?? 'values',
        )
        if (
          !Array.isArray(values) ||
          values.some(
            (option) =>
              option?.value === undefined ||
              typeof option?.label !== 'string',
          )
        ) {
          throw new Error('The purchase order options response is invalid.')
        }
        if (active) setPurchaseOrderOptions(values)
      } catch (error) {
        if (active && error.name !== 'AbortError') setLoadError(error)
      }
    }

    loadForm()
    return () => {
      active = false
      controller.abort()
    }
  }, [form])

  const filePreviewUrl = useMemo(
    () => (sourceFile ? URL.createObjectURL(sourceFile) : null),
    [sourceFile],
  )

  useEffect(
    () => () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl)
    },
    [filePreviewUrl],
  )

  function selectSourceFile(file) {
    const supported =
      file.type === 'application/pdf' || file.type.startsWith('image/')
    if (!supported) {
      messageApi.error('Choose a PDF or image file.')
      return
    }
    setSourceFile(file)
  }

  function navigateToSection(sectionId) {
    setActiveSection(sectionId)
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  async function submitInvoice() {
    if (!template || !initialData) return
    try {
      await form.validateFields()
    } catch {
      messageApi.error('Complete the highlighted required fields before creating the invoice.')
      return
    }

    setSubmitting(true)
    try {
      const currentValues = form.getFieldsValue(true)
      const currentData = {
        ...currentValues,
        document: {
          ...currentValues.document,
          date: toDateString(currentValues.document?.date),
          dueDate: toDateString(currentValues.document?.dueDate),
        },
      }
      const requestData = {
        ...currentData,
        __initial: initialData,
        record: initialData.record,
        totals: initialData.totals,
        statutory: initialData.statutory,
        buyer: initialData.buyer,
      }
      const spec = template.apis.create
      const query = Object.fromEntries(
        Object.entries(spec.query ?? {})
          .map(([key, value]) => [
            key,
            interpolate(value, requestData, idempotencyKey),
          ])
          .filter(([, value]) => value !== null && value !== undefined),
      )
      const headers = Object.fromEntries(
        Object.entries(spec.headers ?? {}).map(([key, value]) => [
          key,
          interpolate(value, requestData, idempotencyKey),
        ]),
      )
      const payload = buildPayload(template, requestData, 'submit')
      const result = await requestApi(spec.url, {
        method: spec.method ?? 'POST',
        query,
        headers,
        body: payload,
      })
      const notification = template.submit.notifications?.submit
      messageApi.success(
        notification?.message ?? `Invoice ${result.number ?? 'created'} successfully.`,
      )
      window.location.assign(
        `/invoice-document/${encodeURIComponent(result.id)}`,
      )
    } catch (error) {
      const mappedErrors = (error.details ?? [])
        .map((detail) => {
          const binding = mapServerPath(
            template.submit.payloadMap,
            detail.path,
          )
          if (!binding) return null
          const name = binding
            .split('.')
            .map((part) => (/^\d+$/.test(part) ? Number(part) : part))
          return { name, errors: [detail.message] }
        })
        .filter(Boolean)
      if (mappedErrors.length) form.setFields(mappedErrors)
      messageApi.error(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loadError) {
    return (
      <main className="invoice-create-shell">
        <Alert
          type="error"
          showIcon
          title="Unable to open the new invoice form"
          description={loadError.message}
          action={<Button onClick={() => window.location.reload()}>Try again</Button>}
        />
      </main>
    )
  }

  if (!template || !initialData) {
    return (
      <main className="invoice-create-shell">
        <Skeleton active paragraph={{ rows: 9 }} />
      </main>
    )
  }

  const currency = initialData.document.currency ?? 'INR'
  const sections = template.zones.body
  const lineItemColumns = [
    {
      title: 'S.No',
      key: 'index',
      width: 62,
      render: (_value, _row, index) => index + 1,
    },
    {
      title: 'Material code',
      key: 'materialCode',
      width: 150,
      render: (_value, field) => (
        <Form.Item
          name={[field.name, 'materialCode']}
          className="invoice-create-table-field"
          rules={[{ required: true, message: 'Enter a material code.' }]}
        >
          <Input placeholder="Code" />
        </Form.Item>
      ),
    },
    {
      title: 'Description',
      key: 'description',
      width: 210,
      render: (_value, field) => (
        <Form.Item
          name={[field.name, 'description']}
          className="invoice-create-table-field"
          rules={[{ required: true, message: 'Enter an item description.' }]}
        >
          <Input placeholder="Item description" />
        </Form.Item>
      ),
    },
    {
      title: 'Qty',
      key: 'invoiceQuantity',
      width: 120,
      render: (_value, field) => (
        <Form.Item
          name={[field.name, 'invoiceQuantity']}
          className="invoice-create-table-field"
          rules={[{ required: true, message: 'Enter a quantity.' }]}
        >
          <InputNumber min={0.01} placeholder="0" />
        </Form.Item>
      ),
    },
    {
      title: 'UOM',
      key: 'uom',
      width: 120,
      render: (_value, field) => (
        <Form.Item
          name={[field.name, 'uom']}
          className="invoice-create-table-field"
          rules={[{ required: true, message: 'Choose a unit.' }]}
        >
          <Select options={inlineOptions['lineItems.uom']} placeholder="Unit" />
        </Form.Item>
      ),
    },
    {
      title: 'Unit price',
      key: 'unitPrice',
      width: 145,
      render: (_value, field) => (
        <Form.Item
          name={[field.name, 'unitPrice']}
          className="invoice-create-table-field"
          rules={[{ required: true, message: 'Enter a unit price.' }]}
        >
          <InputNumber min={0} placeholder="0.00" />
        </Form.Item>
      ),
    },
    {
      title: 'Tax %',
      key: 'taxPercent',
      width: 110,
      render: (_value, field) => (
        <Form.Item
          name={[field.name, 'taxPercent']}
          className="invoice-create-table-field"
          rules={[{ required: true, message: 'Enter the tax rate.' }]}
        >
          <InputNumber min={0} max={100} placeholder="18" />
        </Form.Item>
      ),
    },
    {
      title: '',
      key: 'remove',
      width: 54,
      render: (_value, field, _index, action) => (
        <Button
          type="text"
          danger
          aria-label="Remove line item"
          icon={<DeleteOutlined />}
          onClick={() => action.remove(field.name)}
        />
      ),
    },
  ]

  return (
    <main className="invoice-create-shell">
      {contextHolder}
      <header className="invoice-create-topbar">
        <div className="invoice-create-breadcrumb">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => window.location.assign('/')}
          >
            Invoices
          </Button>
          <span>/</span>
          <Text strong>{initialData.document.breadcrumb ?? 'New Invoice'}</Text>
        </div>
        <Space>
          <Button onClick={() => window.location.assign('/')}>Cancel</Button>
          <Button
            type="primary"
            loading={submitting}
            onClick={submitInvoice}
          >
            {template.labels?.submit ?? 'Create Invoice'}
          </Button>
        </Space>
      </header>

      <div className="invoice-create-layout">
        <aside className="invoice-create-source-pane">
          <input
            id="invoice-source-file"
            type="file"
            accept="application/pdf,image/*"
            className="invoice-create-file-input"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) selectSourceFile(file)
              event.target.value = ''
            }}
          />
          <button
            type="button"
            className={`invoice-create-dropzone${sourceFile ? ' has-file' : ''}`}
            onClick={() => document.getElementById('invoice-source-file')?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const file = event.dataTransfer.files?.[0]
              if (file) selectSourceFile(file)
            }}
          >
            {filePreviewUrl && sourceFile.type.startsWith('image/') ? (
              <img src={filePreviewUrl} alt="Invoice source preview" />
            ) : filePreviewUrl && sourceFile.type === 'application/pdf' ? (
              <iframe title="Invoice source preview" src={filePreviewUrl} />
            ) : (
              <>
                {sourceFile ? <FilePdfOutlined /> : <UploadOutlined />}
                <Text strong>
                  {sourceFile?.name ??
                    template.zones.aside?.[0]?.content?.placeholder ??
                    'Drag & drop the invoice here'}
                </Text>
                <Text type="secondary">
                  {template.zones.aside?.[0]?.content?.helpText ??
                    'or click to browse — PDF, PNG, JPG'}
                </Text>
              </>
            )}
          </button>
          {sourceFile && (
            <Button
              type="link"
              onClick={() => setSourceFile(null)}
              className="invoice-create-remove-file"
            >
              Remove file
            </Button>
          )}
        </aside>

        <section className="invoice-create-content">
          <nav className="invoice-create-section-tabs" aria-label="Invoice sections">
            {sections.map((section) => (
              <button
                type="button"
                key={section.id}
                className={activeSection === section.key ? 'is-active' : ''}
                onClick={() => navigateToSection(section.key)}
              >
                {section.nav?.label ?? section.key}
              </button>
            ))}
          </nav>

          <Form
            form={form}
            layout="vertical"
            requiredMark
            onFinish={submitInvoice}
            className="invoice-create-form"
          >
            <section id="invoiceDetails" className="invoice-create-section">
              <Card className="invoice-create-card">
                <div className="invoice-create-heading">
                  <Title level={4}>{initialData.document.title ?? 'New Invoice'}</Title>
                  <Text type="secondary">{initialData.document.statusNote}</Text>
                </div>

                <Row gutter={[18, 0]}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Invoice Number"
                      name={['document', 'number']}
                      rules={[{ required: true, whitespace: true, message: 'Enter an invoice number.' }]}
                    >
                      <Input placeholder="e.g. INV-2027-9001" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="Invoice Type" name={['document', 'invoiceType']}>
                      <Select options={inlineOptions['document.invoiceType']} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Invoice Date"
                      name={['document', 'date']}
                      rules={[{ required: true, message: 'Select an invoice date.' }]}
                    >
                      <DatePicker className="invoice-create-full-width" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="Due Date" name={['document', 'dueDate']}>
                      <DatePicker className="invoice-create-full-width" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="Linked PO" name={['purchaseOrder', 'id']}>
                      <Select
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        options={purchaseOrderOptions}
                        placeholder="Select a PO..."
                        onChange={(purchaseOrderId) => {
                          const option = purchaseOrderOptions.find(
                            (item) => item.value === purchaseOrderId,
                          )
                          const supplier = option?.label.split(' — ').at(-1)
                          if (supplier) {
                            form.setFieldValue('vendor.legalName', supplier)
                          } else {
                            form.setFieldValue('vendor.legalName', null)
                          }
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="Department" name={['document', 'department']}>
                      <Select options={inlineOptions['document.department']} />
                    </Form.Item>
                  </Col>
                </Row>

                <Divider />
                <Row gutter={[24, 12]} className="invoice-create-parties">
                  <Col xs={24} md={12}>
                    <Text className="invoice-create-label">SUPPLIER / FROM</Text>
                    <Form.Item
                      name={['vendor', 'legalName']}
                      className="invoice-create-vendor-display"
                    >
                      <Input
                        variant="borderless"
                        readOnly
                        placeholder="Vendor details appear when a PO is linked."
                      />
                    </Form.Item>
                    {initialData.vendor.registeredAddress && (
                      <Text type="secondary">{initialData.vendor.registeredAddress}</Text>
                    )}
                  </Col>
                  <Col xs={24} md={12}>
                    <Text className="invoice-create-label">BUYER / BILL TO</Text>
                    <Text strong>{initialData.buyer.legalName}</Text>
                    <Text type="secondary">GSTIN: {initialData.buyer.gstin}</Text>
                  </Col>
                </Row>

                <Card
                  size="small"
                  className="invoice-create-line-card"
                  title="Line Items"
                  extra={
                    <Space wrap>
                      <Button
                        size="small"
                        onClick={() =>
                          messageApi.info('Quick fill is not connected yet. Add line items manually.')
                        }
                      >
                        Quick fill
                      </Button>
                      <Button
                        size="small"
                        type="primary"
                        ghost
                        icon={<PlusOutlined />}
                        onClick={() =>
                          form.setFieldValue('lineItems', [
                            ...(form.getFieldValue('lineItems') ?? []),
                            {
                              materialCode: null,
                              description: null,
                              invoiceQuantity: null,
                              uom: null,
                              unitPrice: null,
                              taxPercent: 18,
                            },
                          ])
                        }
                      >
                        Add Line Item
                      </Button>
                    </Space>
                  }
                >
                  <Form.List name="lineItems">
                    {(fields, action) => (
                      <Table
                        className="invoice-create-line-table"
                        size="small"
                        rowKey="key"
                        columns={lineItemColumns.map((column) => ({
                          ...column,
                          render:
                            column.key === 'remove'
                              ? (value, field, index) =>
                                  column.render(value, field, index, action)
                              : column.render,
                        }))}
                        dataSource={fields}
                        pagination={false}
                        scroll={{ x: 920 }}
                        locale={{
                          emptyText: <Empty description="No line items yet. Add a line item to get started." />,
                        }}
                      />
                    )}
                  </Form.List>
                  <div className="invoice-create-line-footer">
                    <Text type="secondary">
                      Line amounts and tax totals are provided by the invoice service.
                    </Text>
                  </div>
                </Card>

                <Row gutter={[20, 16]} className="invoice-create-notes-totals">
                  <Col xs={24} md={13}>
                    <Form.Item label="Notes" name="notes">
                      <Input.TextArea rows={4} placeholder="Additional notes, if any" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={11}>
                    <div className="invoice-create-totals">
                      <Text className="invoice-create-label">INVOICE VALUE</Text>
                      <div><Text>Subtotal</Text><Text>{formatCurrency(initialData.totals.subtotal, currency)}</Text></div>
                      <div><Text>Tax</Text><Text>{formatCurrency(initialData.totals.taxAmount, currency)}</Text></div>
                      <Divider />
                      <div className="invoice-create-grand-total">
                        <Text strong>Total</Text>
                        <Text strong>{formatCurrency(initialData.totals.grandTotal, currency)}</Text>
                      </div>
                    </div>
                  </Col>
                </Row>
              </Card>
            </section>

            <section id="taxAndEInvoice" className="invoice-create-section">
              <Card className="invoice-create-card">
                <Title level={5}>Tax & E-Invoice</Title>
                <Form.Item label="Vendor GSTIN" name={['vendor', 'gstin']}>
                  <Input placeholder="e.g. 27AABCE1234F1Z5" />
                </Form.Item>
                <div className="invoice-create-tax-grid">
                  <div><Text type="secondary">Taxable amount</Text><Text>{formatCurrency(initialData.statutory.eInvoice.taxableAmount, currency)}</Text></div>
                  <div><Text type="secondary">CGST</Text><Text>{formatCurrency(initialData.statutory.eInvoice.cgstAmount, currency)}</Text></div>
                  <div><Text type="secondary">SGST</Text><Text>{formatCurrency(initialData.statutory.eInvoice.sgstAmount, currency)}</Text></div>
                  <div><Text type="secondary">Total tax</Text><Text>{formatCurrency(initialData.statutory.eInvoice.totalTaxAmount, currency)}</Text></div>
                </div>
                <Divider />
                <Text type="secondary">
                  The IRN will be generated after the invoice is submitted and validated.
                </Text>
              </Card>
            </section>

            <section id="paymentInformation" className="invoice-create-section">
              <Card className="invoice-create-card">
                <Title level={5}>Payment Information</Title>
                <Row gutter={[18, 0]}>
                  <Col xs={24} md={6}>
                    <Form.Item label="Payment Terms" name={['terms', 'payment']}>
                      <Select options={inlineOptions['terms.payment']} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item label="Bank Name" name={['beneficiary', 'bankName']}>
                      <Input placeholder="Bank name" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item label="Account Number" name={['beneficiary', 'accountNumber']}>
                      <Input placeholder="Account number" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item label="IFSC Code" name={['beneficiary', 'ifsc']}>
                      <Input placeholder="IFSC code" />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </section>
          </Form>
        </section>
      </div>
    </main>
  )
}

export default InvoiceCreatePage

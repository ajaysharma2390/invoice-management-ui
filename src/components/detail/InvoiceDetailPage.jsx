import { isValidElement, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Form,
  Input,
  Row,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  EditOutlined,
  PaperClipOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { requestApi, resolvePath } from '../../services/xhr.js'
import './InvoiceDetail.css'

const TEMPLATE_ID = 'tpl_invoice_default'
const { Text, Title } = Typography

function readInvoice(payload) {
  return payload?.invoice ?? payload?.data ?? payload
}

function formatCurrency(value, currency = 'INR') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(date)
}

function formatLabel(value) {
  if (!value) return '—'
  return String(value)
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function statusColor(value) {
  const status = String(value ?? '').toUpperCase()
  if (['PAID', 'APPROVED', 'COMPLETED', 'RECEIVED', 'MATCHED', 'VERIFIED'].includes(status)) {
    return 'green'
  }
  if (['DISCREPANCY', 'REJECTED', 'OVERDUE', 'FAILED'].includes(status)) {
    return 'red'
  }
  if (['UNDER_REVIEW', 'PENDING', 'SCHEDULED', 'CURRENT'].includes(status)) {
    return 'gold'
  }
  return 'default'
}

function StatusTag({ value }) {
  if (!value) return <Text type="secondary">—</Text>
  return <Tag color={statusColor(value)}>{formatLabel(value)}</Tag>
}

function SectionHeading({ title, extra }) {
  return (
    <div className="invoice-detail-section-heading">
      <Title level={5}>{title}</Title>
      {extra}
    </div>
  )
}

function FieldGrid({
  entries,
  currency,
  wideKeys = [],
  columns = { xs: 1, sm: 2, lg: 2 },
  layout,
  className,
}) {
  return (
    <Descriptions
      className={`invoice-detail-descriptions ${className ?? ''}`}
      column={columns}
      layout={layout}
      size="small"
      colon={false}
    >
      {entries.map(([label, value, key]) => (
        <Descriptions.Item
          key={key ?? label}
          label={label}
          className={wideKeys.includes(key) ? 'invoice-detail-wide-field' : ''}
        >
          {isValidElement(value)
            ? value
            : key?.toLowerCase().includes('date')
            ? formatDate(value)
            : key?.toLowerCase().includes('amount') ||
                key?.toLowerCase().includes('total') ||
                key === 'committed'
              ? formatCurrency(value, currency)
              : value || '—'}
        </Descriptions.Item>
      ))}
    </Descriptions>
  )
}

function ActivityText({ item }) {
  switch (item.kind) {
    case 'CREATED':
      return item.message || 'Invoice received'
    case 'MODIFIED':
      return `Invoice updated${item.changeCount ? ` · ${item.changeCount} change${item.changeCount === 1 ? '' : 's'}` : ''}`
    case 'APPROVAL_REQUESTED':
      return `Approval requested${item.approvalId ? ` · ${item.approvalId}` : ''}`
    case 'AMENDED':
      return `Invoice amended${item.reason ? ` · ${item.reason}` : ''}`
    case 'ATTACHED':
      return item.message || 'A document was attached'
    default:
      return item.message || formatLabel(item.kind)
  }
}

function activityTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getOptions(values, path) {
  const options = resolvePath(values, path)
  return Array.isArray(options) ? options : []
}

function InvoiceDetailPage({ recordId }) {
  const [invoice, setInvoice] = useState(null)
  const [lineItems, setLineItems] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [goodsReceipts, setGoodsReceipts] = useState([])
  const [activity, setActivity] = useState([])
  const [options, setOptions] = useState({})
  const [loading, setLoading] = useState(true)
  const [sectionErrors, setSectionErrors] = useState([])
  const [reload, setReload] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const [amendSubmitting, setAmendSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [form] = Form.useForm()
  const [messageApi, contextHolder] = message.useMessage()

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    async function load() {
      setLoading(true)
      setSectionErrors([])
      try {
        const [templatePayload, dataPayload] = await Promise.all([
          requestApi('/p2p/template', {
            query: { id: TEMPLATE_ID },
            signal: controller.signal,
          }),
          requestApi('/p2p/data', {
            query: { id: TEMPLATE_ID, record_id: recordId },
            signal: controller.signal,
          }),
        ])
        if (!active) return
        const detailTemplate = templatePayload?.template ?? templatePayload
        const detailData = readInvoice(dataPayload)
        if (!detailTemplate?.apis || !detailData?.document) {
          throw new Error('The invoice detail response is missing its template or document.')
        }
        setInvoice(detailData)

        const makeUrl = (endpoint) =>
          endpoint.url.replace(':documentId', encodeURIComponent(recordId))
        const sectionRequests = [
          ['Line items', () =>
            requestApi(makeUrl(detailTemplate.apis.lineItems), {
              query: { page: 1, pageSize: detailTemplate.lineItems?.pageSize ?? 10 },
              signal: controller.signal,
            }).then((result) => setLineItems(result.rows ?? []))],
          ['Purchase orders', () =>
            requestApi(makeUrl(detailTemplate.apis.purchaseOrders), {
              query: { page: 1, pageSize: 5 },
              signal: controller.signal,
            }).then((result) => setPurchaseOrders(result.rows ?? []))],
          ['Goods receipts', () =>
            requestApi(makeUrl(detailTemplate.apis.goodsReceipts), {
              query: { page: 1, pageSize: 5 },
              signal: controller.signal,
            }).then((result) => setGoodsReceipts(result.rows ?? []))],
          ['Activity', () =>
            requestApi(makeUrl(detailTemplate.apis.activity), {
              signal: controller.signal,
            }).then((result) => setActivity(result.items ?? result.rows ?? []))],
          ['Edit options', () =>
            requestApi(makeUrl(detailTemplate.apis.options), {
              signal: controller.signal,
            }).then((result) => setOptions(result.values ?? result))],
        ]
        const results = await Promise.allSettled(
          sectionRequests.map(([, request]) => request()),
        )
        if (!active) return
        setSectionErrors(
          results.flatMap((result, index) =>
            result.status === 'rejected'
              ? [`${sectionRequests[index][0]}: ${result.reason.message}`]
              : [],
          ),
        )
      } catch (error) {
        if (active && error.name !== 'AbortError') {
          setInvoice(null)
          setSectionErrors([error.message])
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
      controller.abort()
    }
  }, [recordId, reload])

  const currency = invoice?.document?.currency ?? 'INR'
  const departmentLabels = useMemo(
    () =>
      Object.fromEntries(
        getOptions(options, 'document.department').map((option) => [
          option.value,
          option.label,
        ]),
      ),
    [options],
  )

  function goBack() {
    if (window.history.length > 1) window.history.back()
    else window.location.assign('/')
  }

  function startEditing() {
    form.setFieldsValue({
      invoiceType: invoice.document.invoiceType,
      dueDate: invoice.document.dueDate,
      department: invoice.document.department,
      vendor: invoice.vendor.legalName,
      reason: '',
    })
    setIsEditing(true)
  }

  function cancelEditing() {
    form.resetFields()
    setIsEditing(false)
  }

  async function submitAmendment() {
    try {
      const values = await form.validateFields()
      const changedFields = [
        ['document.invoiceType', values.invoiceType, invoice.document.invoiceType],
        ['document.dueDate', values.dueDate, invoice.document.dueDate],
        ['document.department', values.department, invoice.document.department],
        ['vendor.legalName', values.vendor, invoice.vendor.legalName],
      ]
        .filter(([, value, original]) => value !== original)
        .map(([field, value]) => ({ field, value }))
      if (changedFields.length === 0) {
        messageApi.info('No invoice fields were changed.')
        return
      }
      setAmendSubmitting(true)
      await requestApi('/p2p/amendments', {
        method: 'POST',
        query: { id: TEMPLATE_ID, record_id: recordId },
        body: {
          documentId: recordId,
          documentType: 'INVOICE',
          intent: 'amend',
          status: 'AMENDED',
          reason: values.reason,
          baseVersion: invoice.document.version,
          changedFields,
        },
      })
      setIsEditing(false)
      form.resetFields()
      messageApi.success('Invoice amendment submitted.')
      setReload((value) => value + 1)
    } catch (error) {
      if (error?.errorFields) return
      messageApi.error(`Could not amend invoice: ${error.message}`)
    } finally {
      setAmendSubmitting(false)
    }
  }

  async function uploadAttachment() {
    if (!selectedFile) {
      messageApi.info('Choose a file to attach first.')
      return
    }
    setUploading(true)
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = String(reader.result ?? '')
          const base64 = result.slice(result.indexOf(',') + 1)
          if (!base64) reject(new Error('The selected file could not be read.'))
          else resolve(base64)
        }
        reader.onerror = () => reject(reader.error ?? new Error('The selected file could not be read.'))
        reader.readAsDataURL(selectedFile)
      })
      const uploaded = await requestApi('/trade/upload_file', {
        method: 'POST',
        body: {
          type: selectedFile.type || 'application/octet-stream',
          name: selectedFile.name,
          data,
        },
      })
      await requestApi('/p2p/attachments', {
        method: 'POST',
        query: { id: TEMPLATE_ID, record_id: recordId },
        body: {
          name: selectedFile.name,
          url: uploaded.url,
          type: selectedFile.type || 'application/octet-stream',
        },
      })
      setSelectedFile(null)
      messageApi.success('Attachment uploaded.')
      setReload((value) => value + 1)
    } catch (error) {
      messageApi.error(`Could not upload attachment: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <main className="invoice-detail-shell">
        <Skeleton active paragraph={{ rows: 8 }} />
      </main>
    )
  }

  if (!invoice) {
    return (
      <main className="invoice-detail-shell">
        <Button icon={<ArrowLeftOutlined />} onClick={goBack}>
          Back to invoices
        </Button>
        <Alert
          className="invoice-detail-load-error"
          type="error"
          showIcon
          title="Unable to load invoice"
          description={sectionErrors.join(' ')}
        />
      </main>
    )
  }

  const document = invoice.document
  const amountColumns = [
    {
      title: 'Item',
      dataIndex: 'materialName',
      key: 'materialCode',
      render: (name, row) => (
        <div>
          <Text strong>{name || '—'}</Text>
          <div><Text type="secondary">{row.materialCode}</Text></div>
        </div>
      ),
    },
    { title: 'Description', dataIndex: 'description', key: 'description' },
    { title: 'HSN / SAC', dataIndex: 'hsnCode', key: 'hsnCode' },
    {
      title: 'Qty',
      dataIndex: 'invoiceQuantity',
      key: 'invoiceQuantity',
      align: 'right',
      render: (value, row) => `${value} ${row.uom ?? ''}`,
    },
    {
      title: 'Unit price',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      align: 'right',
      render: (value) => formatCurrency(value, currency),
    },
    {
      title: 'Match',
      dataIndex: 'matchStatus',
      key: 'matchStatus',
      render: (value) => <StatusTag value={value} />,
    },
    {
      title: 'Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right',
      render: (value) => <Text strong>{formatCurrency(value, currency)}</Text>,
    },
  ]
  const linkedColumns = (kind) => [
    { title: kind === 'purchase' ? 'PO number' : 'GRN number', dataIndex: 'number', key: 'number' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (value) => <StatusTag value={value} />,
    },
    {
      title: kind === 'purchase' ? 'PO date' : 'Received',
      dataIndex: 'date',
      key: 'date',
      render: formatDate,
    },
    ...(kind === 'purchase'
      ? [{
          title: 'Value',
          dataIndex: 'value',
          key: 'value',
          render: (value) => formatCurrency(value, currency),
        }]
      : [{ title: 'Items', dataIndex: 'itemsCovered', key: 'itemsCovered' }]),
  ]
  const lineColumns = amountColumns.map((column) => ({ ...column, responsive: ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'] }))
  const docs = invoice.links?.documents ?? []

  return (
    <Form form={form} component={false}>
    <main className={`invoice-detail-shell${isEditing ? ' is-editing' : ''}`}>
      {contextHolder}
      <div className="invoice-detail-topbar">
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={goBack}>
          All invoices
        </Button>
        <Text type="secondary">Accounts payable <span className="invoice-detail-crumb-separator">/</span> Invoices</Text>
      </div>

      <section className="invoice-detail-header">
        <div>
          <Space size={10} wrap>
            <Title level={3}>{document.number}</Title>
            <StatusTag value={document.status} />
            {invoice.threeWayMatch?.discrepancies?.length > 0 && (
              <Tag color="orange">Match discrepancy</Tag>
            )}
          </Space>
          <Text type="secondary">
            {formatLabel(document.invoiceType)} invoice
            {document.version ? ` · Version ${document.version}` : ''}
          </Text>
        </div>
        <Space wrap>
          {invoice.permissions?.attach && (
            <Button icon={<PaperClipOutlined />} onClick={() => window.document.getElementById('invoice-file-input')?.click()}>
              Attach file
            </Button>
          )}
          {invoice.permissions?.amend &&
            (isEditing ? (
              <Space>
                <Button onClick={cancelEditing} disabled={amendSubmitting}>
                  Cancel
                </Button>
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  loading={amendSubmitting}
                  onClick={submitAmendment}
                >
                  Submit amendment
                </Button>
              </Space>
            ) : (
              <Button type="primary" icon={<EditOutlined />} onClick={startEditing}>
                Amend invoice
              </Button>
            ))}
        </Space>
      </section>

      {isEditing && (
        <Card className="invoice-detail-edit-panel">
          <div>
            <Text strong>Amend invoice</Text>
            <Text type="secondary">Edit the highlighted fields and provide a reason for this amendment.</Text>
          </div>
          <Form.Item
            label="Reason for amendment"
            name="reason"
            rules={[{ required: true, whitespace: true, message: 'Enter a reason for this amendment.' }]}
          >
            <Input.TextArea rows={2} maxLength={500} showCount placeholder="Enter the reason for changing this invoice" />
          </Form.Item>
        </Card>
      )}

      {sectionErrors.length > 0 && (
        <Alert
          className="invoice-detail-section-alert"
          type="warning"
          showIcon
          title="Some invoice details could not be loaded"
          description={sectionErrors.join(' · ')}
        />
      )}

      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} xl={16}>
          <Card className="invoice-detail-card">
            <SectionHeading title="Invoice overview" />
            <Row gutter={[24, 16]}>
              <Col xs={24} md={12}>
                <div className="invoice-detail-party-label">SUPPLIER</div>
                {isEditing ? (
                  <>
                    <div className="invoice-detail-party-title-label">Supplier name</div>
                    <Form.Item name="vendor" className="invoice-detail-inline-field">
                      <Select
                        options={getOptions(options, 'vendor.legalName')}
                        showSearch
                        optionFilterProp="label"
                      />
                    </Form.Item>
                  </>
                ) : (
                  <Title level={5}>{invoice.vendor?.legalName || invoice.vendor?.name}</Title>
                )}
                <Text>{invoice.vendor?.officeAddress || '—'}</Text>
                <div><Text type="secondary">{invoice.vendor?.email}</Text></div>
                <div><Text type="secondary">{invoice.vendor?.phone}</Text></div>
                <div className="invoice-detail-party-meta">GSTIN: {invoice.vendor?.gstin || '—'}</div>
              </Col>
              <Col xs={24} md={12}>
                <div className="invoice-detail-party-label">BILL TO</div>
                <Title level={5}>{invoice.buyer?.legalName || '—'}</Title>
                <Text>{invoice.buyer?.billingAddress || '—'}</Text>
                <div className="invoice-detail-party-meta">GSTIN: {invoice.buyer?.gstin || '—'}</div>
              </Col>
            </Row>
            <Divider />
            <Row gutter={[24, 12]}>
              <Col xs={24} md={isEditing ? 24 : 14}>
                <FieldGrid
                  currency={currency}
                  entries={[
                    ['Invoice date', document.date, 'date'],
                    [
                      'Due date',
                      isEditing ? (
                        <Form.Item key="due-date-editor" name="dueDate" className="invoice-detail-inline-field">
                          <Input type="date" />
                        </Form.Item>
                      ) : document.dueDate,
                      'dueDate',
                    ],
                    [
                      'Invoice type',
                      isEditing ? (
                        <Form.Item key="invoice-type-editor" name="invoiceType" className="invoice-detail-inline-field">
                          <Select options={getOptions(options, 'document.invoiceType')} />
                        </Form.Item>
                      ) : formatLabel(document.invoiceType),
                      'invoiceType',
                    ],
                    [
                      'Department',
                      isEditing ? (
                        <Form.Item key="department-editor" name="department" className="invoice-detail-inline-field">
                          <Select options={getOptions(options, 'document.department')} />
                        </Form.Item>
                      ) : departmentLabels[document.department] ?? document.department,
                      'department',
                    ],
                    ['Purchase order', document.purchaseOrder?.number, 'purchaseOrder'],
                    ['Reference', document.reference, 'reference'],
                  ]}
                />
              </Col>
              <Col
                xs={24}
                md={isEditing ? 24 : 10}
                className={isEditing ? 'invoice-detail-total-column-editing' : undefined}
              >
                <div className="invoice-detail-total-box">
                  <Text type="secondary">INVOICE TOTAL</Text>
                  <Title level={3}>{formatCurrency(invoice.totals?.grandTotal, currency)}</Title>
                  <div className="invoice-detail-total-row">
                    <Text>Subtotal</Text>
                    <Text>{formatCurrency(invoice.totals?.subtotal, currency)}</Text>
                  </div>
                  <div className="invoice-detail-total-row">
                    <Text>{invoice.totals?.taxLabel || 'Tax'}</Text>
                    <Text>{formatCurrency(invoice.totals?.taxAmount, currency)}</Text>
                  </div>
                  {invoice.totals?.discount > 0 && (
                    <div className="invoice-detail-total-row">
                      <Text>Discount</Text>
                      <Text>-{formatCurrency(invoice.totals.discount, currency)}</Text>
                    </div>
                  )}
                </div>
              </Col>
            </Row>
            {invoice.notes && (
              <>
                <Divider />
                <Text strong>Notes</Text>
                <p className="invoice-detail-note">{invoice.notes}</p>
              </>
            )}
          </Card>

          <Card className="invoice-detail-card">
            <SectionHeading
              title="Line items"
              extra={<Text type="secondary">{lineItems.length} items</Text>}
            />
            <Table
              className="invoice-detail-table"
              columns={lineColumns}
              dataSource={lineItems}
              rowKey="id"
              pagination={false}
              scroll={{ x: 850 }}
              locale={{ emptyText: <Empty description="No line items" /> }}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={6}>
                    <Text strong>Invoice total</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6} align="right">
                    <Text strong>{formatCurrency(invoice.totals?.grandTotal, currency)}</Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
          </Card>

          <Card className="invoice-detail-card">
            <SectionHeading title="Three-way match" />
            <div className="invoice-detail-match-grid">
              {(invoice.threeWayMatch?.comparison ?? []).map((comparison) => (
                <div className="invoice-detail-match-item" key={comparison.key}>
                  <Text>{comparison.label}</Text>
                  <StatusTag value={comparison.status} />
                </div>
              ))}
            </div>
            {invoice.threeWayMatch?.discrepancies?.map((discrepancy) => (
              <Alert
                key={discrepancy.id}
                className="invoice-detail-discrepancy"
                type="warning"
                showIcon
                title={discrepancy.message}
                description={`${discrepancy.field}: invoice ${discrepancy.invoiceValue} · PO ${discrepancy.orderValue}`}
              />
            ))}
          </Card>

          <Card className="invoice-detail-card">
            <SectionHeading title="Linked records" />
            <Title level={5}>Purchase orders</Title>
            <Table
              columns={linkedColumns('purchase')}
              dataSource={purchaseOrders}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: 'No linked purchase orders' }}
            />
            <Divider />
            <Title level={5}>Goods receipts</Title>
            <Table
              columns={linkedColumns('receipt')}
              dataSource={goodsReceipts}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: 'No linked goods receipts' }}
            />
          </Card>

          <Card className="invoice-detail-card">
            <SectionHeading title="Documents" />
            <div className="invoice-detail-doc-list">
              {docs.map((file) => (
                <div className="invoice-detail-doc-row" key={file.id}>
                  <PaperClipOutlined />
                  <div className="invoice-detail-doc-info">
                    <Text strong>{file.name}</Text>
                    <Text type="secondary">{file.meta || 'Supporting document'}</Text>
                  </div>
                  {file.url && file.url !== '#' && (
                    <a href={file.url} target="_blank" rel="noreferrer">Open</a>
                  )}
                </div>
              ))}
              {docs.length === 0 && <Empty description="No documents attached" />}
            </div>
            {invoice.permissions?.attach && (
              <div className="invoice-detail-upload-row">
                <Upload
                  beforeUpload={(file) => {
                    setSelectedFile(file)
                    return false
                  }}
                  maxCount={1}
                  fileList={selectedFile ? [{ uid: selectedFile.uid, name: selectedFile.name, status: 'done' }] : []}
                  onRemove={() => setSelectedFile(null)}
                  showUploadList={{ showRemoveIcon: true }}
                >
                  <Button icon={<UploadOutlined />}>Choose file</Button>
                </Upload>
                <Button
                  type="primary"
                  disabled={!selectedFile}
                  loading={uploading}
                  onClick={uploadAttachment}
                >
                  Upload and attach
                </Button>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card className="invoice-detail-card">
            <SectionHeading title="Workflow" />
            <div className="invoice-detail-workflow">
              {(invoice.workflow?.steps ?? []).map((step, index) => (
                <div className="invoice-detail-workflow-step" key={step.id}>
                  <span className={`invoice-detail-workflow-dot ${step.status}`} />
                  {index < invoice.workflow.steps.length - 1 && <span className="invoice-detail-workflow-line" />}
                  <div>
                    <Text strong={step.status === 'current'}>{step.label}</Text>
                    <div><Text type="secondary">{formatLabel(step.status)}</Text></div>
                  </div>
                </div>
              ))}
              {(!invoice.workflow?.steps || invoice.workflow.steps.length === 0) && (
                <Text type="secondary">No workflow information available.</Text>
              )}
            </div>
          </Card>

          <Card className="invoice-detail-card">
            <SectionHeading title="Payments" />
            <FieldGrid
              className="invoice-detail-sidebar-fields"
              columns={1}
              currency={currency}
              layout="vertical"
              entries={[
                ['Payment status', <StatusTag key="payment-status" value={invoice.payment?.status} />, 'status'],
                ['Payment method', formatLabel(invoice.payment?.method), 'method'],
                ['Payment terms', formatLabel(invoice.terms?.payment), 'terms'],
                ['Beneficiary', invoice.beneficiary?.name, 'beneficiary'],
                ['Account ending', invoice.beneficiary?.accountLast4, 'account'],
                ['Committed amount', invoice.totals?.committed, 'committed'],
              ]}
            />
            {(invoice.links?.payments ?? []).length > 0 && (
              <>
                <Divider />
                <Text strong>Payment records</Text>
                {invoice.links.payments.map((payment) => (
                  <div className="invoice-detail-payment-row" key={payment.id}>
                    <div>
                      <Text strong>{payment.number}</Text>
                      <div><StatusTag value={payment.status} /></div>
                    </div>
                    <Text>{formatCurrency(payment.amount, payment.currency || currency)}</Text>
                  </div>
                ))}
              </>
            )}
          </Card>

          <Card className="invoice-detail-card">
            <SectionHeading title="Accounting & Tax" />
            <FieldGrid
              className="invoice-detail-sidebar-fields"
              columns={1}
              currency={currency}
              layout="vertical"
              entries={[
                ['Cost center', invoice.accounting?.costCenter, 'costCenter'],
                ['GL account', invoice.accounting?.glAccount, 'glAccount'],
                ['Tax ID', invoice.accounting?.taxId, 'taxId'],
                ['IRN', invoice.statutory?.irn, 'irn'],
                ['Verification', <StatusTag key="verification-status" value={invoice.statutory?.eInvoice?.verificationStatus} />, 'verification'],
                ['Taxable amount', invoice.statutory?.eInvoice?.taxableAmount, 'taxableAmount'],
                ['CGST', invoice.statutory?.eInvoice?.cgstAmount, 'cgstAmount'],
                ['SGST', invoice.statutory?.eInvoice?.sgstAmount, 'sgstAmount'],
              ]}
            />
          </Card>

          <Card className="invoice-detail-card">
            <SectionHeading title="Activity" />
            {activity.length === 0 ? (
              <Empty description="No activity recorded" />
            ) : (
              <div className="invoice-detail-activity">
                {activity.map((item) => (
                  <div className="invoice-detail-activity-row" key={item.id}>
                    <span className="invoice-detail-activity-dot" />
                    <div>
                      <Text strong>{item.actor?.name || 'System'}</Text>
                      <div><Text><ActivityText item={item} /></Text></div>
                      <Text type="secondary">{activityTime(item.at)}</Text>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {invoice.permissions?.attach && (
        <input
          id="invoice-file-input"
          className="invoice-detail-hidden-input"
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) setSelectedFile(file)
          }}
        />
      )}
    </main>
    </Form>
  )
}

export default InvoiceDetailPage

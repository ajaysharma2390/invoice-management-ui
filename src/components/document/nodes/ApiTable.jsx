import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Checkbox,
  Dropdown,
  Empty,
  Input,
  message,
  Modal,
  Popover,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  BellOutlined,
  CheckOutlined,
  ClearOutlined,
  DownloadOutlined,
  FilterOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  SortAscendingOutlined,
  UpOutlined,
  DownOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import { nanoid } from 'nanoid'
import { resolveBinding, resolveLabel } from '../../../engine/bindingResolver.js'
import { readRecordPage, requestApi, resolvePath } from '../../../services/xhr.js'

const statusColors = {
  warning: 'gold',
  success: 'green',
  danger: 'red',
  info: 'blue',
}
const EMPTY_COLUMNS = []

function formatDate(value, locale) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatCurrency(value, currency, locale) {
  if (typeof value !== 'number') return '—'
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
    }).format(value)
  }
}

function ApiTable({ node, envelope }) {
  const [messageApi, contextHolder] = message.useMessage()
  const props = node.props ?? {}
  const template = envelope.template
  const apiSpecs = template.apis ?? {}
  const columns = node.columns ?? EMPTY_COLUMNS
  const viewSpec = props.views ?? { items: [], default: 'all' }
  const staticViews = useMemo(
    () =>
      (viewSpec.items ?? []).map((view) => ({
        ...view,
        label: resolveLabel(view.id, view.label),
        filters: view.filters ?? [],
      })),
    [viewSpec.items],
  )
  const [savedViews, setSavedViews] = useState([])
  const [viewId, setViewId] = useState(viewSpec.default ?? staticViews[0]?.id)
  const allViews = useMemo(
    () => [...staticViews, ...savedViews],
    [staticViews, savedViews],
  )
  const activeView =
    allViews.find((view) => view.id === viewId) ??
    allViews.find((view) => view.id === viewSpec.default) ??
    allViews[0]
  const [counts, setCounts] = useState({})
  const [filterOptions, setFilterOptions] = useState([])
  const [columnFilters, setColumnFilters] = useState([])
  const [sort, setSort] = useState([])
  const [visibleColumnIds, setVisibleColumnIds] = useState(
    () => columns.map((column) => column.id),
  )
  const [searchText, setSearchText] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(props.pagination?.pageSize ?? 20)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loadedRequestKey, setLoadedRequestKey] = useState(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [savedViewName, setSavedViewName] = useState('')
  const [savingView, setSavingView] = useState(false)
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [fieldsPopoverOpen, setFieldsPopoverOpen] = useState(false)
  const [sortPopoverOpen, setSortPopoverOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const listApi = apiSpecs[props.api]
  const countsApi = apiSpecs[viewSpec.counts?.api]
  const savedViewsApi = apiSpecs.savedViews
  const saveViewApi = apiSpecs.createSavedView
  const bulkActionApi = apiSpecs.bulkAction
  const filterOptionsApi = apiSpecs.invoiceFilterOptions
  const tableFilters = useMemo(
    () => [...(activeView?.filters ?? []), ...columnFilters],
    [activeView?.filters, columnFilters],
  )
  const requestQuery = useMemo(
    () => ({
      ...(search ? { search } : {}),
      sort,
      filters: tableFilters,
    }),
    [search, sort, tableFilters],
  )
  const dataRequestKey = JSON.stringify({
    page,
    pageSize,
    requestQuery,
    refreshKey,
  })
  const loading = Boolean(listApi) && loadedRequestKey !== dataRequestKey
  const filterableColumns = useMemo(
    () => columns.filter((column) => column.filterable),
    [columns],
  )
  const sortableColumns = useMemo(
    () => columns.filter((column) => column.sortable),
    [columns],
  )
  const visibleColumns = useMemo(
    () => columns.filter((column) => visibleColumnIds.includes(column.id)),
    [columns, visibleColumnIds],
  )

  const fetchCounts = useCallback(
    async (views) => {
      if (!countsApi) return {}
      const viewFilters = Object.fromEntries(
        views.map((view) => [view.id, view.filters ?? []]),
      )
      const response = await requestApi(countsApi.url, {
        query: { views: viewFilters },
      })
      const nextCounts = resolvePath(response, countsApi.config?.path)
      if (!nextCounts || typeof nextCounts !== 'object' || Array.isArray(nextCounts)) {
        throw new Error('The counts response is missing its counts object.')
      }
      if (
        Object.values(nextCounts).some(
          (count) => typeof count !== 'number' || !Number.isFinite(count),
        )
      ) {
        throw new Error('The counts response contains a non-numeric count.')
      }
      return nextCounts
    },
    [countsApi],
  )

  useEffect(() => {
    if (!savedViewsApi) return undefined
    let cancelled = false

    async function loadViewData() {
      try {
        const response = await requestApi(savedViewsApi.url)
        if (!Array.isArray(response?.views)) {
          throw new Error('The saved views response is missing its views array.')
        }
        if (
          response.views.some(
            (view) =>
              typeof view?.id !== 'string' ||
              typeof view?.name !== 'string' ||
              (view.filters !== undefined && !Array.isArray(view.filters)),
          )
        ) {
          throw new Error('The saved views response contains an invalid view.')
        }
        if (cancelled) return
        const views = response.views.map((view) => ({
          ...view,
          filters: Array.isArray(view.filters) ? view.filters : [],
        }))
        setSavedViews(views)

        try {
          const nextCounts = await fetchCounts([...staticViews, ...views])
          if (!cancelled) setCounts(nextCounts)
        } catch (error) {
          if (!cancelled) messageApi.error(error.message)
        }
      } catch (error) {
        if (!cancelled) messageApi.error(error.message)
      }
    }

    loadViewData()
    return () => {
      cancelled = true
    }
  }, [fetchCounts, messageApi, savedViewsApi, staticViews])

  useEffect(() => {
    if (!filterOptionsApi || filterableColumns.length === 0) return undefined
    let cancelled = false
    const departmentFilter = filterableColumns.find(
      (column) => column.filterable.optionsSource?.api,
    )
    if (!departmentFilter) return undefined

    async function loadFilterOptions() {
      try {
        const response = await requestApi(filterOptionsApi.url, {
          query: {
            field: departmentFilter.filterable.field ?? departmentFilter.binding,
            limit: 100,
          },
        })
        if (!Array.isArray(response?.values)) {
          throw new Error('The filter options response is missing its values array.')
        }
        if (
          response.values.some(
            (option) =>
              option?.value === undefined || typeof option?.label !== 'string',
          )
        ) {
          throw new Error('The filter options response contains an invalid option.')
        }
        if (!cancelled) setFilterOptions(response.values)
      } catch (error) {
        if (!cancelled) messageApi.error(error.message)
      }
    }

    loadFilterOptions()
    return () => {
      cancelled = true
    }
  }, [filterOptionsApi, filterableColumns, messageApi])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchText)
      setPage(1)
    }, 400)

    return () => window.clearTimeout(timeout)
  }, [searchText])

  useEffect(() => {
    if (!listApi) {
      messageApi.error(`The template does not define the "${props.api}" data API.`)
      return undefined
    }

    const controller = new AbortController()

    requestApi(listApi.url, {
      query: {
        page,
        pageSize,
        ...requestQuery,
      },
      signal: controller.signal,
    })
      .then((response) => readRecordPage(response, listApi.config ?? {}))
      .then((recordPage) => {
        if (controller.signal.aborted) return
        setRows(recordPage.rows)
        setTotal(recordPage.total)
        setLoadedRequestKey(dataRequestKey)
      })
      .catch((error) => {
        if (error.name !== 'AbortError' && !controller.signal.aborted) {
          messageApi.error(error.message)
          setLoadedRequestKey(dataRequestKey)
        }
      })

    return () => controller.abort()
  }, [dataRequestKey, listApi, messageApi, page, pageSize, props.api, requestQuery])

  function setFilter(field, values) {
    setColumnFilters((current) => {
      const next = current.filter((filter) => filter.field !== field)
      if (values?.length) {
        next.push({ field, operator: 'in', value: values })
      }
      return next
    })
    setSelectedRowKeys([])
    setPage(1)
  }

  function setSortFields(fields) {
    setSort((current) =>
      fields.map(
        (field) =>
          current.find((entry) => entry.field === field) ?? {
            field,
            order: 'desc',
          },
      ),
    )
    setSelectedRowKeys([])
    setPage(1)
  }

  function updateSortOrder(field, order) {
    setSort((current) =>
      current.map((entry) =>
        entry.field === field ? { ...entry, order } : entry,
      ),
    )
    setSelectedRowKeys([])
    setPage(1)
  }

  function moveSort(field, direction) {
    setSort((current) => {
      const index = current.findIndex((entry) => entry.field === field)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current
      const next = [...current]
      ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
      return next
    })
    setSelectedRowKeys([])
    setPage(1)
  }

  function changeView(nextViewId) {
    setViewId(nextViewId)
    setPage(1)
    setSelectedRowKeys([])
  }

  function handleTableChange(_pagination, _filters, sorter, extra) {
    if (extra.action !== 'sort') return

    const sortedItems = (Array.isArray(sorter) ? sorter : [sorter])
      .filter((item) => item.order)
      .sort((a, b) => (b.column?.sorter?.multiple ?? 0) - (a.column?.sorter?.multiple ?? 0))
    setSort(
      sortedItems.map((item) => ({
        field: item.column?.dataIndex?.join?.('.') ?? item.field,
        order: item.order === 'ascend' ? 'asc' : 'desc',
      })),
    )
    setSelectedRowKeys([])
    setPage(1)
  }

  async function updateCounts(views) {
    try {
      setCounts(await fetchCounts(views))
    } catch (error) {
      messageApi.error(error.message)
    }
  }

  async function saveView() {
    const name = savedViewName.trim()
    if (!name) {
      messageApi.warning('Enter a name for this view.')
      return
    }
    if (!saveViewApi) {
      messageApi.error('The template does not define the saved view API.')
      return
    }

    const newView = {
      id: `savedView_${nanoid()}`,
      name,
      filters: tableFilters,
    }
    setSavingView(true)
    try {
      await requestApi(saveViewApi.url, {
        method: 'POST',
        body: newView,
      })
      const nextViews = [...savedViews, newView]
      setSavedViews(nextViews)
      setViewId(newView.id)
      setPage(1)
      setSavedViewName('')
      setSaveModalOpen(false)
      setSelectedRowKeys([])
      await updateCounts([...staticViews, ...nextViews])
      messageApi.success('View saved.')
    } catch (error) {
      messageApi.error(error.message)
    } finally {
      setSavingView(false)
    }
  }

  async function runBulkAction(operation) {
    if (!bulkActionApi) {
      messageApi.error('The template does not define the bulk action API.')
      return
    }
    const ids = selectedRowKeys
    if (operation !== 'export' && ids.length === 0) return

    const body = {
      operation,
      target: ids.length ? 'selected' : 'query',
      ids,
      query: requestQuery,
      ...(operation === 'export'
        ? {
            columns: visibleColumns.map((column) => ({
              field: column.binding,
              header: column.label,
              ...(column.valueType === 'status'
                ? {
                    labels: Object.fromEntries(
                      (column.options ?? []).map((option) => [
                        option.value,
                        option.label,
                      ]),
                    ),
                  }
                : {}),
            })),
          }
        : {}),
    }

    try {
      const response = await requestApi(bulkActionApi.url, {
        method: 'POST',
        body,
      })
      if (typeof response?.id !== 'string' || !response.id) {
        throw new Error('The bulk action response is missing its id.')
      }
      if (
        response.failed !== undefined &&
        (!Array.isArray(response.failed) ||
          response.failed.some((failure) => typeof failure?.message !== 'string'))
      ) {
        throw new Error('The bulk action response contains invalid failure details.')
      }
      if (Array.isArray(response?.failed) && response.failed.length > 0) {
        messageApi.warning(
          `${response.failed.length} item(s) failed: ${response.failed[0].message}`,
        )
      } else {
        const actionLabel = {
          approve: 'Approval completed',
          remind: 'Reminder sent',
          export: 'Export started',
        }[operation]
        const requestId =
          operation === 'approve' || operation === 'export'
            ? ` (${response.id})`
            : ''
        messageApi.success(`${actionLabel}${requestId}.`)
      }

      setSelectedRowKeys([])
      if (operation === 'approve') {
        setRefreshKey((current) => current + 1)
        await updateCounts(allViews)
      }
    } catch (error) {
      messageApi.error(error.message)
    }
  }

  const antdColumns = visibleColumns.map((column, index) => {
    const sortEntry = sort.find((entry) => entry.field === column.binding)

    return {
      title: column.label,
      key: column.key ?? column.id,
      dataIndex: column.binding.split('.'),
      width: column.width,
      ellipsis: column.ellipsis ?? false,
      fixed: column.pin === 'left' ? 'left' : undefined,
      align: column.align,
      sorter: column.sortable ? { multiple: columns.length - index } : undefined,
      sortOrder: sortEntry
        ? sortEntry.order === 'asc'
          ? 'ascend'
          : 'descend'
        : null,
      render: (_value, row) => {
        const value = resolveBinding(row, column.binding)
        if (value === undefined || value === null || value === '') {
          return <span className="cell-muted">—</span>
        }

        if (column.valueType === 'status') {
          const option = (column.options ?? []).find(
            (candidate) => candidate.value === value,
          )
          return (
            <Tag color={statusColors[option?.tone] ?? 'default'}>
              {option?.label ?? value}
            </Tag>
          )
        }

        if (column.valueType === 'date') {
          const formattedDate = formatDate(value, envelope.meta?.locale)
          return (
            <span className="invoice-cell-text" title={formattedDate}>
              {formattedDate}
            </span>
          )
        }

        if (column.valueType === 'currency') {
          const currency = resolveBinding(
            row,
            column.format?.currencyBinding ?? 'currency',
          )
          return (
            <span className="amount-cell">
              {formatCurrency(value, currency, envelope.meta?.locale)}
            </span>
          )
        }

        if (column.binding === 'number') {
          const route = props.rowAction?.route?.replace(
            '{{$row.id}}',
            encodeURIComponent(row[props.rowKey ?? 'id']),
          )
          return (
            <Space size={8}>
              <a
                className="invoice-link"
                href={route}
                onClick={(event) => event.stopPropagation()}
              >
                {value}
              </a>
              {column.badge && resolveBinding(row, column.badge.binding) ? (
                <Tag className="new-badge">{column.badge.label}</Tag>
              ) : null}
            </Space>
          )
        }

        if (column.binding === 'purchaseOrder.number') {
          return (
            <Space size={8}>
              <a
                href={`/purchase-order/${encodeURIComponent(row.purchaseOrder?.id ?? '')}`}
                onClick={(event) => event.stopPropagation()}
              >
                {value}
              </a>
              {row.purchaseOrder?.additionalCount > 0 ? (
                <Tag className="count-badge">
                  +{row.purchaseOrder.additionalCount}
                </Tag>
              ) : null}
            </Space>
          )
        }

        return (
          <span className="invoice-cell-text" title={String(value)}>
            {String(value)}
          </span>
        )
      },
    }
  })

  const filterContent = (
    <div className="popover-content filter-popover">
      {filterableColumns.map((column) => {
        const field = column.filterable.field ?? column.binding
        const isRemoteOptions = Boolean(column.filterable.optionsSource)
        const selectedValues = columnFilters.find(
          (filter) => filter.field === field,
        )?.value
        const values = isRemoteOptions
          ? [
              ...new Set(filterOptions.map((option) => option.label)),
            ].map((label) => ({ value: label, label }))
          : (column.options ?? []).map((option) => ({
              value: option.value,
              label: option.label,
            }))
        const selected = isRemoteOptions
          ? [
              ...new Set(
                filterOptions
                  .filter((option) => selectedValues?.includes(option.value))
                  .map((option) => option.label),
              ),
            ]
          : selectedValues

        return (
          <label className="filter-field" key={column.id}>
            <span>{column.label}</span>
            <Select
              allowClear
              mode="multiple"
              maxTagCount="responsive"
              placeholder="All"
              options={values}
              value={selected}
              onChange={(next) =>
                setFilter(
                  field,
                  isRemoteOptions
                    ? filterOptions
                        .filter((option) => next.includes(option.label))
                        .map((option) => option.value)
                    : next,
                )
              }
            />
          </label>
        )
      })}
      {filterableColumns.length === 0 ? (
        <Typography.Text type="secondary">No filters are configured.</Typography.Text>
      ) : null}
      {columnFilters.length > 0 ? (
        <Button
          type="link"
          icon={<ClearOutlined />}
          onClick={() => {
            setColumnFilters([])
            setPage(1)
          }}
        >
          Clear filters
        </Button>
      ) : null}
    </div>
  )

  const fieldsContent = (
    <div className="popover-content fields-popover">
      <Checkbox.Group
        value={visibleColumnIds}
        options={columns.map((column) => ({
          label: column.label,
          value: column.id,
        }))}
        onChange={(next) => setVisibleColumnIds(next)}
      />
    </div>
  )

  const sortFieldOptions = sortableColumns.map((column) => ({
    label: column.label,
    value: column.binding,
  }))
  const sortContent = (
    <div className="popover-content sort-popover">
      <Select
        mode="multiple"
        value={sort.map((entry) => entry.field)}
        options={sortFieldOptions}
        placeholder="Choose sort fields"
        onChange={setSortFields}
      />
      {sort.map((entry, index) => {
        const column = sortableColumns.find(
          (candidate) => candidate.binding === entry.field,
        )
        return (
          <div className="sort-rule" key={entry.field}>
            <Typography.Text ellipsis>{column?.label ?? entry.field}</Typography.Text>
            <Select
              aria-label={`Sort ${column?.label ?? entry.field}`}
              value={entry.order}
              options={[
                { label: 'Descending', value: 'desc' },
                { label: 'Ascending', value: 'asc' },
              ]}
              onChange={(value) => updateSortOrder(entry.field, value)}
            />
            <Space size={0}>
              <Tooltip title="Move up in sort priority">
                <Button
                  type="text"
                  size="small"
                  icon={<UpOutlined />}
                  disabled={index === 0}
                  onClick={() => moveSort(entry.field, -1)}
                />
              </Tooltip>
              <Tooltip title="Move down in sort priority">
                <Button
                  type="text"
                  size="small"
                  icon={<DownOutlined />}
                  disabled={index === sort.length - 1}
                  onClick={() => moveSort(entry.field, 1)}
                />
              </Tooltip>
            </Space>
          </div>
        )
      })}
      {sort.length > 0 ? (
        <Button type="link" onClick={() => setSort([])}>
          Clear sort
        </Button>
      ) : null}
    </div>
  )

  const newAction = props.toolbar?.actions?.find((action) => action.id === 'new')
  const canCreate =
    newAction?.visibleWhen?.operator === 'equals'
      ? resolveBinding(envelope.data ?? {}, newAction.visibleWhen.binding) ===
        newAction.visibleWhen.value
      : false
  const permittedBulkActions = [
    {
      key: 'export',
      id: 'exportReport',
      label: 'Export report',
      icon: <DownloadOutlined />,
      permission: 'export',
    },
    {
      key: 'approve',
      id: 'bulkApprove',
      label: 'Approve selected',
      icon: <CheckOutlined />,
      permission: 'approve',
    },
    {
      key: 'remind',
      id: 'sendReminder',
      label: 'Send reminder',
      icon: <BellOutlined />,
      permission: 'remind',
    },
  ].filter(
    (action) =>
      props.toolbar?.actions
        ?.find((item) => item.id === 'bulkActions')
        ?.props?.items?.includes(action.id) &&
      envelope.data?.permissions?.[action.permission] === true,
  )

  const tabs = allViews.map((view) => ({
    key: view.id,
    label: (
      <span className="view-tab">
        {view.label ?? view.name}
        {Object.hasOwn(counts, view.id) && typeof counts[view.id] === 'number' ? (
          <Badge count={counts[view.id]} showZero className="view-tab__count" />
        ) : null}
      </span>
    ),
  }))

  return (
    <section className="invoice-list-card">
      {contextHolder}
      <nav className="view-tabs" aria-label="Invoice views">
        {tabs.map((tab) => (
          <button
            className={`view-tab-button${viewId === tab.key ? ' is-active' : ''}`}
            key={tab.key}
            type="button"
            onClick={() => changeView(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="list-toolbar">
        <div className="list-toolbar__left">
          {props.toolbar?.search ? (
            <Input
              allowClear
              className="invoice-search"
              prefix={<SearchOutlined />}
              placeholder="Search invoices, vendors, PO…"
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value)
                setSelectedRowKeys([])
              }}
            />
          ) : null}
          {props.toolbar?.fields ? (
            <Popover
              content={fieldsContent}
              open={fieldsPopoverOpen}
              onOpenChange={setFieldsPopoverOpen}
              trigger="click"
              placement="bottomLeft"
            >
              <Button icon={<SettingOutlined />}>Fields</Button>
            </Popover>
          ) : null}
          {props.toolbar?.filter ? (
            <Popover
              content={filterContent}
              title="Filter invoices"
              open={filterPopoverOpen}
              onOpenChange={setFilterPopoverOpen}
              trigger="click"
              placement="bottomLeft"
            >
              <Button icon={<FilterOutlined />}>
                Filter
                {columnFilters.length > 0 ? (
                  <span className="toolbar-count">{columnFilters.length}</span>
                ) : null}
              </Button>
            </Popover>
          ) : null}
          {props.toolbar?.sortBy ? (
            <Popover
              content={sortContent}
              title="Sort by"
              open={sortPopoverOpen}
              onOpenChange={setSortPopoverOpen}
              trigger="click"
              placement="bottomLeft"
            >
              <Button icon={<SortAscendingOutlined />}>Sort by</Button>
            </Popover>
          ) : null}
        </div>

        <div className="list-toolbar__right">
          {savedViewsApi ? (
            <Button icon={<SaveOutlined />} onClick={() => setSaveModalOpen(true)}>
              Save view
            </Button>
          ) : null}
          {canCreate ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() =>
                window.location.assign(newAction.props?.action?.route ?? '/invoice-new')
              }
            >
              {newAction.props?.label?.static ?? 'New invoice'}
            </Button>
          ) : null}
          {permittedBulkActions.length > 0 ? (
            <Dropdown
              trigger={['click']}
              menu={{
                items: permittedBulkActions.map((action) => ({
                  key: action.key,
                  icon: action.icon,
                  label: action.label,
                  disabled:
                    action.key !== 'export' && selectedRowKeys.length === 0,
                })),
                onClick: ({ key }) => runBulkAction(key),
              }}
            >
              <Button>
                Bulk actions <DownOutlined />
              </Button>
            </Dropdown>
          ) : null}
          <Tooltip title="Reload invoices">
            <Button
              aria-label="Reload invoices"
              icon={<ReloadOutlined />}
              onClick={() => setRefreshKey((current) => current + 1)}
            />
          </Tooltip>
        </div>
      </div>

      <div className="table-summary">
        <Typography.Text type="secondary">
          {loading && rows.length === 0
            ? 'Loading invoices…'
            : `${total.toLocaleString(envelope.meta?.locale)} invoices`}
        </Typography.Text>
        {selectedRowKeys.length > 0 ? (
          <Typography.Text className="selection-summary">
            {selectedRowKeys.length} selected
          </Typography.Text>
        ) : null}
      </div>

      <Table
        className="invoice-table"
        rowKey={props.rowKey ?? 'id'}
        columns={antdColumns}
        dataSource={rows}
        loading={loading}
        rowSelection={
          props.selectable
            ? {
                selectedRowKeys,
                preserveSelectedRowKeys: true,
                onChange: setSelectedRowKeys,
              }
            : undefined
        }
        onChange={handleTableChange}
        onRow={(row) => ({
          onClick: (event) => {
            if (event.target.closest('a, button, input, label')) return
            const route = props.rowAction?.route?.replace(
              '{{$row.id}}',
              encodeURIComponent(row[props.rowKey ?? 'id']),
            )
            if (route) window.location.assign(route)
          },
        })}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={props.emptyText ?? 'No invoices match this view'}
            />
          ),
        }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: props.pagination?.pageSizeChangeable,
          pageSizeOptions: props.pagination?.pageSizeOptions?.map(String),
          showTotal: (count, range) =>
            count === 0 ? 'No results' : `${range[0]}–${range[1]} of ${count}`,
          onChange: (nextPage, nextPageSize) => {
            if (nextPageSize !== pageSize) {
              setPageSize(nextPageSize)
              setPage(1)
            } else {
              setPage(nextPage)
            }
          },
        }}
        scroll={{ x: 1260 }}
      />

      <Modal
        title="Save this view"
        open={saveModalOpen}
        okText="Save view"
        confirmLoading={savingView}
        onOk={saveView}
        onCancel={() => {
          setSaveModalOpen(false)
          setSavedViewName('')
        }}
      >
        <Typography.Paragraph type="secondary">
          Save the current filters as a tab you can return to later.
        </Typography.Paragraph>
        <Input
          autoFocus
          maxLength={80}
          placeholder="e.g. Finance team"
          value={savedViewName}
          onChange={(event) => setSavedViewName(event.target.value)}
          onPressEnter={saveView}
        />
      </Modal>
    </section>
  )
}

export default ApiTable

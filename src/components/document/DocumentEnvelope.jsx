import { Button, Space, Typography, message } from 'antd'
import { StarOutlined } from '@ant-design/icons'
import NodeRenderer from './NodeRenderer.jsx'

function DocumentEnvelope({ envelope }) {
  const [messageApi, contextHolder] = message.useMessage()
  const { template } = envelope
  const appBar = template.appBar ?? {}
  const title = appBar.title?.static ?? template.name

  function dispatchAction(action) {
    if (action?.type === 'navigate' && action.route) {
      window.location.assign(action.route)
      return
    }

    if (action?.type === 'callback' && action.payload?.action === 'askClara') {
      messageApi.info('Ask Clara is not connected yet.')
    }
  }

  return (
    <main className="page-shell">
      {contextHolder}
      <header className="app-header">
        <div className="app-brand">
          <div className="app-brand__mark" aria-hidden="true">
            P
          </div>
          <div>
            <Typography.Text className="app-brand__name">Payables</Typography.Text>
            <Typography.Text className="app-brand__caption">
              Finance workspace
            </Typography.Text>
          </div>
        </div>
      </header>

      <section className="document-heading">
        <div>
          <Typography.Text className="eyebrow">ACCOUNTS PAYABLE</Typography.Text>
          <Typography.Title level={1}>{title}</Typography.Title>
          <Typography.Paragraph className="document-heading__subtitle">
            Review, track and manage invoices from your vendors.
          </Typography.Paragraph>
        </div>
        <Space>
          {(appBar.actions ?? []).map((action) => (
            <Button
              key={action.id}
              icon={<StarOutlined />}
              onClick={() => dispatchAction(action.props?.action)}
            >
              {action.props?.label?.static ?? action.id}
            </Button>
          ))}
        </Space>
      </section>

      <NodeRenderer
        nodes={template.zones?.body ?? []}
        envelope={envelope}
        unknownNodePolicy={template.theme?.tokens?.unknownNodePolicy}
      />
    </main>
  )
}

export default DocumentEnvelope

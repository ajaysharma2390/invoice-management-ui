import ApiTable from './nodes/ApiTable.jsx'

const nodeRegistry = new Map([['table', ApiTable]])

function NodeRenderer({ nodes, envelope, unknownNodePolicy }) {
  return nodes.map((node) => {
    const Node = nodeRegistry.get(node.type)
    if (!Node && unknownNodePolicy === 'skip') return null
    if (!Node) {
      return (
        <div className="schema-error" key={node.id}>
          Unsupported page element: {node.type}
        </div>
      )
    }

    return <Node key={node.id} node={node} envelope={envelope} />
  })
}

export default NodeRenderer

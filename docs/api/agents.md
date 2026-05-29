# API: Agents

<div class="cic-panel">

## Endpoint
```
GET /api/agents
```

## Description
List all active intelligence agents in the CIC cluster.

## Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| status | string | No | Filter by agent status (active, idle, error) |

## Request Example
```json
{
  "status": "active"
}
```

## Response Example
```json
[
  {
    "id": "agent_alpha",
    "name": "Research Agent",
    "status": "active"
  }
]
```

</div>

<div class="cic-alert cic-alert-warn">
<strong>Note:</strong> All CIC API endpoints require authentication via the CIC Operator Token.
</div>
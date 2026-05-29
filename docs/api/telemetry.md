# API: Telemetry

<div class="cic-panel">

## Endpoint
```
GET /api/telemetry
```

## Description
Retrieve system health and performance telemetry from the CIC node.

## Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| range | string | No | Time range for metrics (e.g., 1h, 24h) |

## Request Example
```json
{
  "range": "1h"
}
```

## Response Example
```json
{
  "cpu_usage": 12.5,
  "memory_usage": "2.4GB",
  "status": "healthy"
}
```

</div>

<div class="cic-alert cic-alert-warn">
<strong>Note:</strong> All CIC API endpoints require authentication via the CIC Operator Token.
</div>
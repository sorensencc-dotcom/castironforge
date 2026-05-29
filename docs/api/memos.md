# API: Memos

<div class="cic-panel">

## Endpoint
```
GET /api/memos
```

## Description
Retrieve a list of captured memos from the intelligence surface.

## Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| limit | integer | No | Max number of memos to return (default: 20) |
| offset | integer | No | Number of memos to skip |

## Request Example
```json
{
  "limit": 10
}
```

## Response Example
```json
[
  {
    "id": "memo_001",
    "content": "Captured a new insight on iron forging.",
    "timestamp": "2026-05-23T10:00:00Z"
  }
]
```

</div>

<div class="cic-alert cic-alert-warn">
<strong>Note:</strong> All CIC API endpoints require authentication via the CIC Operator Token.
</div>
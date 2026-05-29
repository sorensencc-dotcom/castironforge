# API: Authentication

<div class="cic-panel">

## Endpoint
```
POST /api/auth
```

## Description
Authenticate an operator session and retrieve a CIC Operator Token.

## Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| username | string | Yes | Operator username |
| password | string | Yes | Operator password |

## Request Example
```json
{
  "username": "operator_one",
  "password": "[REDACTED_PASSWORD]"
}
```

## Response Example
```json
{
  "token": "[CIC_OPERATOR_TOKEN]",
  "expires_in": 3600
}
```

</div>

<div class="cic-alert cic-alert-warn">
<strong>Note:</strong> All CIC API endpoints require authentication via the CIC Operator Token.
</div>
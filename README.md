# API Testing Guide

This guide covers the three auth-related API flows used in this project:

- CSRF token retrieval
- Log in
- Log out
- Audit logs access

These endpoints are useful for testing in Postman or any REST client.

## Base URL

```text
https://linepoint.vercel.app
```

## 1. Get CSRF Token

Use this request first when testing login or logout.

### Request

```http
GET /api/auth/csrf
```

### Full URL

```text
https://linepoint.vercel.app/api/auth/csrf
```

### Expected Response

```json
{
  "csrfToken": "string"
}
```

### Notes

- Keep cookies enabled in Postman.
- The CSRF token is tied to the current session/cookie state.

## 2. Log In

Use the custom JSON login endpoint.

### Request

```http
POST /api/v1/auth/login
```

### Full URL

```text
https://linepoint.vercel.app/api/v1/auth/login
```

### Body Type

`x-www-form-urlencoded`

### Fields

```text
username=your_username
password=your_password
callbackUrl=/dashboard
subsystem=Customer
loginAs=(admin/staff)
```

Use `loginAs=admin` for administrator accounts.

### Expected Success Response

```json
{
  "success": true,
  "message": "Logged in successfully",
  "redirectTo": "/dashboard"
}
```

### Expected Failure Response

```json
{
  "success": false,
  "error": "Login failed"
}
```

### Notes

- Postman must preserve cookies so the session persists after login.
- The custom login route handles CSRF internally.
- For external-system accounts, the backend will prompt for `loginAs` and verify the role before completing login.
- For local MongoDB accounts, leave the flow as-is and log in with the same endpoint.

## 3. Log Out

Use the custom JSON logout endpoint.

### Request

```http
POST /api/v1/auth/logout
```

### Full URL

```text
https://linepoint.vercel.app/api/v1/auth/logout
```

### Body Type

`x-www-form-urlencoded`

### Fields

```text
csrfToken=csrf_token_from_step_1
callbackUrl=/auth/login
```

### Expected Success Response

```json
{
  "success": true,
  "message": "You have successfully logged out",
  "redirectTo": "/auth/login"
}
```

### Expected Failure Response

```json
{
  "success": false,
  "error": "Logout failed"
}
```

### Notes

- Make sure cookies are enabled.
- Logout clears the session cookie through NextAuth.
- CSRF is handled automatically by the custom logout route.

## 4. Get Audit Logs

Use this request to inspect audit logs.

### Request

```http
GET /api/v1/audit-logs
```

### Full URL

```text
https://linepoint.vercel.app/api/v1/audit-logs
```

### Required Header

```http
x-api-key: your_api_key_from_env
```

### Expected Success Response

```json
{
  "success": true,
  "count": 0,
  "data": []
}
```

### Notes

- The route accepts either a valid `x-api-key` header or an authenticated admin session.
- For API testing, include the key from your environment variables in the request header.

## Recommended Test Flow

1. Send `GET /api/auth/csrf`
2. Send `POST /api/v1/auth/login`
3. Verify the JSON success response
4. Send `GET /api/v1/audit-logs` with `x-api-key` if testing the protected audit endpoint
5. Send any authenticated `GET` request if needed
6. Send `POST /api/v1/auth/logout`
7. Verify the JSON logout response

## Common Issues

- `csrf=true` response:
  - The CSRF token or cookie was missing or invalid.
- `401 Unauthorized`:
  - You are not logged in or the session cookie was not preserved.
- `403 Forbidden`:
  - You are logged in, but the route does not allow your role.

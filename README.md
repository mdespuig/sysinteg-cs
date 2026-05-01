# API Testing Guide

This guide covers the three auth-related API flows used in this project:

- CSRF token retrieval
- Log in
- Log out

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
csrfToken=csrf_token_from_step_1
callbackUrl=/dashboard
```

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

- If `csrfToken` is omitted, the endpoint tries to fetch one automatically.
- Postman must preserve cookies so the session persists after login.

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

## Recommended Test Flow

1. Send `GET /api/auth/csrf`
2. Send `POST /api/v1/auth/login`
3. Verify the JSON success response
4. Send any authenticated `GET` request if needed
5. Send `POST /api/v1/auth/logout`
6. Verify the JSON logout response

## Common Issues

- `csrf=true` response:
  - The CSRF token or cookie was missing or invalid.
- `401 Unauthorized`:
  - You are not logged in or the session cookie was not preserved.
- `403 Forbidden`:
  - You are logged in, but the route does not allow your role.

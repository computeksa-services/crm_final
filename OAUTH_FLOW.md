# OAuth 2.0 Authorization Code Flow - CRM Implementation

## 📋 Overview

The CRM now uses OAuth 2.0 (Google) for authentication instead of email/password. The implementation follows the Authorization Code Flow, which is the secure OAuth 2.0 pattern for web applications.

## 🔐 Complete OAuth Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER AUTHENTICATION FLOW                            │
└─────────────────────────────────────────────────────────────────────────────┘

1. USER CLICKS LOGIN BUTTON
   ↓
   Frontend: LoginPage.tsx - handleGoogleLogin()
   - Constructs Google OAuth URL with client_id, redirect_uri, scopes
   - Redirects to: https://accounts.google.com/o/oauth2/v2/auth?...

2. GOOGLE LOGIN
   ↓
   User: Enters email/password on Google's login page
   User: Grants permission to access profile & email
   
3. GOOGLE REDIRECTS BACK TO APP WITH CODE
   ↓
   Google: Redirects to http://localhost:5173/auth/callback?code=xyz&state=abc
   
4. CALLBACK HANDLER
   ↓
   Frontend: AuthCallbackPage.tsx
   - Captures URL params: code, state
   - Sends code to backend: POST /webhook/api/auth/callback {code, state}
   
5. BACKEND EXCHANGES CODE FOR TOKEN
   ↓
   Backend: /webhook/api/auth/callback endpoint (n8n webhook)
   - Verifies code with Google
   - Creates/retrieves user record
   - Returns: { user, token, ... }
   
6. LOGIN COMPLETE
   ↓
   Frontend: AuthCallbackPage saves user to localStorage via AuthContext.login()
   Frontend: Redirects to /dashboard
   
7. USER AUTHENTICATED
   ↓
   Frontend: ProtectedRoute checks for user, allows access to app
   
```

## 🔧 Configuration

### Environment Variables (.env.local)
```
VITE_GOOGLE_CLIENT_ID=899972315510-9dslu4ia72bjvlmces8rj1d6277noog0.apps.googleusercontent.com
VITE_MICROSOFT_CLIENT_ID=f313a15a-a78b-4d15-ae88-9e236e62da04
VITE_REDIRECT_URI=http://localhost:5173/auth/callback
```

### Google OAuth App Setup
- **Client ID**: 899972315510-9dslu4ia72bjvlmces8rj1d6277noog0.apps.googleusercontent.com
- **Authorized Redirect URIs**: http://localhost:5173/auth/callback
- **Scopes Requested**: openid, profile, email

## 📁 File Structure

```
services/
  └─ oauthConfig.ts          # Centralized OAuth configuration
     - Exports: googleClientId, microsoftClientId, oauthRedirectUri, enabledProviders

pages/
  ├─ LoginPage.tsx           # OAuth provider selection
  │  └─ handleGoogleLogin()  # Initiates Google OAuth flow
  │  └─ handleMicrosoftLogin() # Placeholder for Microsoft (not implemented)
  │
  └─ AuthCallbackPage.tsx    # Handles OAuth redirect callback
     └─ Exchanges code for token/user with backend

contexts/
  └─ AuthContext.tsx         # User authentication state management
     └─ login(userData)      # Saves user to localStorage

App.tsx                       # Route configuration
  └─ <Route path="/auth/callback" element={<AuthCallbackPage />} />

.env.local                    # OAuth credentials
  └─ VITE_GOOGLE_CLIENT_ID
  └─ VITE_MICROSOFT_CLIENT_ID
  └─ VITE_REDIRECT_URI
```

## 🚀 Frontend Implementation Details

### 1. LoginPage.tsx - Initiate OAuth

```typescript
const handleGoogleLogin = () => {
  const params = new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: oauthRedirectUri || `${window.location.origin}/auth/callback`,
    response_type: 'code',                    // Request authorization code
    scope: 'openid profile email',            // Required permissions
    access_type: 'offline',                   // Needed for refresh tokens
    prompt: 'consent',                        // Show consent screen
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  window.location.href = googleAuthUrl;       // Redirect to Google
};
```

**Key Points:**
- `response_type: 'code'` = Authorization Code Flow (not Implicit or Password Grant)
- `access_type: 'offline'` = Request refresh token for long-lived sessions
- `redirect_uri` = Must match registered URI in Google Console
- User is redirected to Google, not backend

### 2. AuthCallbackPage.tsx - Handle Callback

```typescript
useEffect(() => {
  const code = searchParams.get('code');      // Google's authorization code
  const state = searchParams.get('state');    // CSRF protection token
  
  // Send code to backend to exchange for token/user
  const response = await fetch('https://service.computeksa.com/webhook/api/auth/callback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state }),
  });
  
  const data = await response.json();         // { user, token, ... }
  login(data.user);                            // Save to AuthContext
  navigate('/dashboard');                      // Redirect to app
}, []);
```

**Expected Backend Response:**
```json
{
  "user": {
    "id_user": "123",
    "email": "user@example.com",
    "name_user": "John Doe",
    "rol_user": "admin",
    "id_tenant": "456"
  },
  "token": "jwt.token.here"
}
```

### 3. AuthContext.tsx - Manage Authentication State

```typescript
const login = (userData: User) => {
  localStorage.setItem('user', JSON.stringify(userData));
  setUser(userData);
};

const logout = () => {
  localStorage.removeItem('user');
  setUser(null);
};
```

- User data persists in `localStorage` for page refreshes
- Authentication state available via `useAuth()` hook throughout app

### 4. App.tsx - Route Protection

```typescript
const ProtectedRoute = () => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <div>Cargando sesión...</div>;
  return user ? <Layout><Outlet /></Layout> : <Navigate to="/login" />;
};

<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/auth/callback" element={<AuthCallbackPage />} />
  <Route path="/" element={<ProtectedRoute />}>
    {/* Protected routes */}
  </Route>
</Routes>
```

## ⚙️ Backend Requirements

Your n8n webhook at `https://service.computeksa.com/webhook/api/auth/callback` must:

1. **Receive POST request with:**
   ```json
   {
     "code": "4/0AY0e-g...",
     "state": "random_state_value"
   }
   ```

2. **Exchange code with Google:**
   - Call Google's token endpoint: `https://oauth2.googleapis.com/token`
   - Send: client_id, client_secret, code, redirect_uri, grant_type=authorization_code
   - Receive: access_token, id_token, refresh_token

3. **Decode ID Token** (JWT):
   - Extract user info: email, name, picture
   - Usually contains: sub (user ID), email, name

4. **Create or retrieve user**:
   - Check if user exists by email
   - If not, create new user record
   - Return user object with: id_user, email, name_user, rol_user, id_tenant

5. **Return response:**
   ```json
   {
     "user": {
       "id_user": "google_sub_id_or_db_id",
       "email": "user@gmail.com",
       "name_user": "John Doe",
       "rol_user": "admin",
       "id_tenant": "tenant_123"
     },
     "token": "jwt_or_session_token"
   }
   ```

## 🧪 Testing

### 1. Start the app
```bash
npm run dev
# App should be running at http://localhost:5173
```

### 2. Click "Continuar con Google"
- Should redirect to accounts.google.com
- Check browser console for the OAuth URL (logged with 🔐 emoji)

### 3. Login with Google account
- Enter email/password
- Grant permission to access profile & email

### 4. Check callback
- Should redirect to http://localhost:5173/auth/callback?code=...&state=...
- Check browser console for:
  - `🔐 OAuth callback recibido: {code, state}`
  - `📤 Enviando código al backend...`

### 5. Verify login
- If successful: redirects to dashboard
- Check localStorage: `localStorage.getItem('user')` should return user object
- Check AuthContext: `useAuth().user` should have user data

### 6. Verify protected routes
- Try accessing pages without being logged in
- Should redirect to /login
- After login, all routes should be accessible

## 🔍 Debugging

### Browser Console Logs
- `🔐 Iniciando flujo OAuth con Google` - OAuth started
- `📍 URL de redireccionamiento: https://accounts.google.com/...` - OAuth URL
- `🔐 OAuth callback recibido: {code, state}` - Callback received
- `📤 Enviando código al backend...` - Sending to backend
- `✅ Respuesta del backend: {user, token}` - Backend response
- `✅ Login completado...` - Login successful
- `❌ Error en callback: ...` - Error occurred

### Common Issues

**1. "Google Client ID no está configurado"**
- Check .env.local has VITE_GOOGLE_CLIENT_ID
- Ensure Vite server is restarted after .env changes

**2. "Redirect URI mismatch"**
- OAuth URL in code must match registered URI in Google Console
- Registered: http://localhost:5173/auth/callback
- In code: oauthRedirectUri from .env

**3. "No se recibió el código de autorización"**
- Check if Google redirected back to correct URL
- Check browser's Network tab for redirect response
- Verify state parameter matches

**4. Backend returns 500 error**
- Check n8n webhook logs
- Verify Google's token endpoint response
- Ensure user creation logic works

**5. "El servidor no devolvió información del usuario"**
- Backend didn't include `user` object in response
- Verify backend response format matches expected structure

## 📚 References

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Authorization Code Flow](https://datatracker.ietf.org/doc/html/rfc6749#section-1.3.1)
- [PKCE Extension (optional for SPAs)](https://tools.ietf.org/html/rfc7636)

## 🚀 Future Enhancements

1. **Microsoft OAuth** - Complete implementation (currently placeholder)
2. **PKCE** - Add Proof Key for Code Exchange for extra security
3. **Refresh Token** - Handle token refresh for long-lived sessions
4. **Token Storage** - Store JWT in secure httpOnly cookie
5. **Logout** - Revoke tokens with Google on logout
6. **Social Login** - Add more providers (GitHub, LinkedIn, etc.)

## 📝 Important Notes

- **Tokens are NOT stored** - Only user data in localStorage
- **Session expires** - User will need to login again on page refresh if token expires
- **State parameter** - Used for CSRF protection, currently not validated (should be validated on backend)
- **HTTPS required** - OAuth requires HTTPS in production
- **localhost allowed** - Google's OAuth allows HTTP for localhost testing

---

**Implementation Date**: 2024
**Status**: OAuth flow complete, ready for testing

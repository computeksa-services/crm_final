# 🧪 OAuth Implementation - Testing Checklist

## ✅ What's Ready

- [x] **OAuth Configuration** (`services/oauthConfig.ts`)
  - Google Client ID loaded from .env
  - Redirect URI configured
  
- [x] **Login Page** (`pages/LoginPage.tsx`)
  - "Continuar con Google" button
  - Redirects directly to accounts.google.com/o/oauth2/v2/auth
  - Passes: client_id, redirect_uri, response_type=code, scopes
  
- [x] **Callback Handler** (`pages/AuthCallbackPage.tsx`)
  - Captures authorization code from URL
  - Sends code to backend: POST /webhook/api/auth/callback
  - Saves user to AuthContext on success
  - Redirects to /dashboard
  
- [x] **Route Configuration** (`App.tsx`)
  - /auth/callback route added
  - Protected routes configured

- [x] **Environment Variables** (`.env.local`)
  ```
  VITE_GOOGLE_CLIENT_ID=899972315510-9dslu4ia72bjvlmces8rj1d6277noog0.apps.googleusercontent.com
  VITE_REDIRECT_URI=http://localhost:5173/auth/callback
  ```

## 🚀 How to Test

### Step 1: Start the Application
```bash
npm run dev
```
App runs at: http://localhost:5173

### Step 2: Navigate to Login
- Go to http://localhost:5173
- Should redirect to /login automatically (no user)

### Step 3: Click "Continuar con Google"
- **Expected**: Browser redirects to Google login
- **Check Console**: Should see logs:
  ```
  🔐 Iniciando flujo OAuth con Google
  📍 URL de redireccionamiento: https://accounts.google.com/o/oauth2/v2/auth?client_id=...
  ```

### Step 4: Authenticate with Google
- Enter your Google email/password
- Grant permission to "Computeksa 360"
- Google should redirect back to: http://localhost:5173/auth/callback?code=abc123&state=xyz

### Step 5: Callback Processing
- **Expected**: AuthCallbackPage shows "Completando autenticación..." spinner
- **Check Console**: Should see logs:
  ```
  🔐 OAuth callback recibido: {code, state}
  📤 Enviando código al backend para intercambio...
  ```

### Step 6: Wait for Backend Response
The backend at `https://service.computeksa.com/webhook/api/auth/callback` should:
1. Receive POST with { code, state }
2. Exchange code with Google for tokens
3. Get user info from Google
4. Return response with user data

**Expected Success Logs**:
```
✅ Respuesta del backend: {user, token}
✅ Login completado. Redirigiendo al dashboard...
```

### Step 7: Verify Login Success
- Should redirect to http://localhost:5173/dashboard
- Check localStorage:
  ```javascript
  // In browser console:
  localStorage.getItem('user')
  // Should return: {"id_user":"...","email":"...","name_user":"..."}
  ```

## 🔍 Debugging Steps

### If stuck on "Completando autenticación..."

1. **Check Network Tab**
   - Look for POST to `service.computeksa.com/webhook/api/auth/callback`
   - Status should be 200
   - Response should have `user` and `token`

2. **Check Browser Console**
   - Look for error messages (red text)
   - Look for emoji logs (🔐, 📤, ✅, ❌)

3. **Check Backend Logs**
   - Go to n8n dashboard
   - View logs for /webhook/api/auth/callback endpoint
   - Look for errors in code or Google API call

### If Google login page doesn't appear

1. **Verify Client ID**
   - Check .env.local has VITE_GOOGLE_CLIENT_ID
   - Copy value from: 899972315510-9dslu4ia72bjvlmces8rj1d6277noog0.apps.googleusercontent.com

2. **Verify Redirect URI**
   - Check .env.local has VITE_REDIRECT_URI=http://localhost:5173/auth/callback
   - Must match exactly (case-sensitive)

3. **Restart Dev Server**
   - Vite needs to reload .env changes
   - Stop `npm run dev`
   - Start again with `npm run dev`

### If redirects to /auth/callback but shows error

1. **Check error message** - It should tell you what's wrong
2. **Check backend response**
   - Is the code being sent to backend?
   - Is backend responding?
   - Is response in correct format?

3. **Check browser console**
   - Any JavaScript errors?
   - Any 404 errors for API calls?

## 📋 Checklist for Successful Flow

- [ ] Dev server running at http://localhost:5173
- [ ] .env.local has VITE_GOOGLE_CLIENT_ID
- [ ] .env.local has VITE_REDIRECT_URI=http://localhost:5173/auth/callback
- [ ] Click "Continuar con Google" redirects to accounts.google.com
- [ ] Can login with Google account
- [ ] Google redirects back with ?code= parameter
- [ ] See "Completando autenticación..." spinner
- [ ] Backend receives POST to /webhook/api/auth/callback
- [ ] Backend returns user data
- [ ] Redirects to /dashboard
- [ ] localStorage has user data
- [ ] Can access protected pages

## 🎯 What Happens Next

### If Everything Works ✅
- Congratulations! OAuth flow is complete
- Users can now login with Google
- Session persists via localStorage
- Protected routes prevent unauthorized access

### If Backend Hasn't Been Updated ⏳
You need to implement the `/webhook/api/auth/callback` endpoint that:
1. Receives: { code, state }
2. Exchanges code with Google for tokens
3. Gets user info from Google
4. Creates/retrieves user in database
5. Returns: { user: {...}, token: "..." }

### To Implement Microsoft OAuth
1. Uncomment `handleMicrosoftLogin()` in LoginPage.tsx
2. Build OAuth URL for Microsoft: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
3. Create backend endpoint: `/webhook/api/auth/microsoft`
4. Same flow but with Microsoft's OAuth endpoints

## 📞 Support

If you encounter issues:
1. Check browser console for error messages
2. Check network tab for API responses
3. Check backend logs in n8n
4. Verify all .env variables are set correctly
5. Ensure backend endpoint is implemented correctly

---

**Ready to test!** 🚀

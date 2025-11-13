# Authentication Setup Guide

This document explains how to set up Supabase authentication for the Reeva application.

## Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Alternative variable names (also supported)
SUPABASE_PROJECT_URL=your_supabase_project_url
SUPABASE_ANON_PUBLIC_KEY=your_supabase_anon_key
```

## Supabase Auth Configuration

### Email Confirmation Setup

1. Go to **Supabase Dashboard** → **Authentication** → **Settings** → **Auth Providers** → **Email**
2. Ensure **"Enable email confirmations"** is enabled
3. Configure the **"Confirm signup"** email template to include a clear confirmation link
4. The magic link in the confirmation email will be used to verify the user's email address

### Email Templates

The default Supabase email templates work out of the box. You can customize them in:
- **Authentication** → **Email Templates**
- The confirmation email uses `{{ .ConfirmationURL }}` for the magic link

## Database Setup

The `profiles` table has already been created in Supabase with the following schema:

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

Row-level security (RLS) is enabled with the following policies:
- Users can view their own profile
- Users can update their own profile
- Only service role can insert profiles (handled by backend)

## Authentication Flows

### Email + Password

1. **Sign Up**: User enters full name, email, and password → Account created → Confirmation email sent with magic link → User clicks link to confirm email → Can login
2. **Login**: User enters email and password → Authenticated → Redirected to profile

### Google OAuth

1. User clicks "Continue with Google" → Redirected to Google → Callback creates profile → Redirected to profile page

### Email Confirmation

- Magic links are **only** used for email confirmation after signup
- Users receive a confirmation email with a magic link
- Clicking the link confirms the email address
- After confirmation, users can login with email and password

## API Endpoints

### POST `/api/auth/signup`
- Creates a new user account with email and password
- Sends confirmation email with magic link
- Body: `{ email: string, password: string, full_name: string, provider?: 'email' | 'google' }`

### POST `/api/auth/login`
- Logs in existing user with email and password
- Body: `{ email: string, password: string, provider?: 'email' | 'google' }`

### GET `/api/auth/profile`
- Fetches authenticated user's profile
- Requires authentication

### PATCH `/api/auth/profile`
- Updates authenticated user's profile
- Body: `{ full_name: string }`
- Requires authentication

### POST `/api/auth/logout`
- Logs out the current user

### GET `/api/auth/callback`
- Handles email confirmation magic links (type=signup)
- Handles OAuth callback from Google
- Creates profile if user is new
- Redirects to `/login` (for email confirmation) or `/profile` (for OAuth)

## Pages

### `/login`
- Login page with email+password and Google OAuth options
- Shows success message after email confirmation

### `/signup`
- Signup page with full name, email, password, and Google OAuth options
- Redirects to login after successful signup
- User must confirm email via magic link before logging in

### `/profile`
- Profile dashboard
- Displays user profile information
- Allows updating full name
- Requires authentication (redirects to login if not authenticated)

## Profile Creation

Profiles are automatically created:
1. After successful email+OTP login (if profile doesn't exist)
2. After Google OAuth callback (if profile doesn't exist)
3. Default `full_name` is set to email username (part before @) or Google name

## Access Control

- Row-level security ensures users can only access their own profile
- API endpoints verify authentication before allowing access
- Profile page redirects to login if user is not authenticated


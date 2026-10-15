# ACES Connect

Voice, video, chat and file sharing for the **Alliance of Computing Education Students**.
React + Vite · Supabase (auth, database, realtime, storage) · LiveKit (voice/video) · Vercel (hosting + token API) · installable PWA.

## Layout (from your wireframe)

- **Left column:** your profile circle on top (tap to edit profile, install the app, sign out), rooms below.
- **Top bar:** scrolling circles with arrows. Shows the class roster with online dots, and switches to voice participants (speaking ring, muted badge) while you're in a call.
- **Center:** room header with Join voice / camera / mute / leave, camera tiles when anyone has video on, then the chat.
- **Bottom bar:** chat bubble (focus the message box), media button (photos, videos, any file), message box, and the up-arrow send button.

On phones and iPad portrait the left column slides in as a drawer. On iPad landscape and desktop it stays visible.

## 1. Supabase

1. Create a project at supabase.com.
2. **SQL Editor** → paste all of `supabase/schema.sql` → Run.
3. Change the invite code (members must enter it to register):
   `update public.app_settings set value = 'YOUR-CODE' where key = 'invite_code';`
4. **Authentication → URL Configuration:** set Site URL to your Vercel URL and add `http://localhost:3000` to Redirect URLs.
5. **Authentication → SMTP:** set up a custom SMTP provider (Resend, Brevo, Gmail SMTP). Supabase's built-in email is limited to a few emails per hour, which will block a class registering together.
6. **Project Settings → API:** copy the Project URL and the anon public key.
7. Register your own account in the app, then make yourself an officer (admin):
   `update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'YOUR_EMAIL');`

Upload size: Supabase's free plan caps each file at 50 MB (**Storage → Settings** on paid plans raises it). Set `VITE_MAX_UPLOAD_MB` to match. Files are stored untouched, so photo and video quality is original.

## 2. LiveKit

1. Create a project at cloud.livekit.io (free tier works).
2. Copy the WebSocket URL (`wss://...livekit.cloud`), API key and API secret.

## 3. Environment variables

Copy `.env.example` to `.env.local` and fill it in. On Vercel add the same variables under **Project → Settings → Environment Variables**.

## 4. Run locally

```bash
npm install
npm i -g vercel
vercel dev        # runs the app AND the /api/livekit-token function
```

`npm run dev` runs only the UI. Chat works, voice needs `vercel dev` or a deployed build.

## 5. Deploy

Push to GitHub → import the repo in Vercel (framework preset: Vite) → add the env vars → Deploy.

## Using it on phones and iPads

- **iPhone / iPad:** open in Safari → Share → Add to Home Screen. Voice and video need HTTPS (Vercel provides it).
- **Android / desktop Chrome:** use Install in the profile panel, or the browser menu.
- **Saving media:** on iPhone/iPad, Save opens the share sheet so you can pick Save Image / Save Video (goes to Photos). Elsewhere it downloads the original file.
- iOS tip for senders: choosing **Photo Library** may re-encode videos. Choose **Choose Files** to send the untouched original.

## Branding

The ACES crest lives in `public/logo.png` (in-app) and the PWA/home-screen icons (`public/pwa-*.png`, `apple-touch-icon.png`, `favicon.png`). Colors are CSS variables at the top of `src/styles.css` (green `--ink`/`--accent`, gold `--gold`).

## Notes and next steps

- Attachments sit in a private bucket and are served through signed links, so only signed-in members can open them.
- Standard uploads are reliable up to roughly 50 MB. For multi-hundred-MB videos, switch to Supabase resumable (TUS) uploads.
- Not included yet: push notifications, direct messages, reactions, screen sharing, password reset page (members can use "Email me a sign-in link").
- Rename the app in `index.html`, `vite.config.ts` and `src/components/AuthScreen.tsx`.

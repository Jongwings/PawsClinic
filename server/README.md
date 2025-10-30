# PawsClinic — Node/Express + Twilio (SMS + optional WhatsApp)

## What’s inside
- `web/` — appointment form posting to `/api/send-sms`
- `server/` — Node.js/Express + Twilio
  - Sends SMS using `TWILIO_FROM_NUMBER` (your Twilio phone)
  - Optional fallback to Messaging Service SID
  - Optional WhatsApp mode via `WHATSAPP_ENABLED` + `WHATSAPP_FROM`
- `.env` — **prefilled** with your Account SID and Twilio number (paste only your Auth Token)
- `.env.example` — placeholders
- `README.md` — quick start + notes

## Quick start
```bash
cd server
# Open .env and replace __PASTE_YOUR_AUTH_TOKEN_HERE__ with your real Auth Token
npm install
npm start
```
Then open `http://localhost:3000`, fill the form, and submit.

> Trial accounts can only send to **verified numbers**. Verify the clinic number or upgrade your Twilio account.

## Switch to WhatsApp (optional)
1. Join the Twilio WhatsApp Sandbox (Console → Messaging → Try it out).
2. In `.env`, set:
```
WHATSAPP_ENABLED=true
WHATSAPP_FROM=whatsapp:+14155238886
```
3. Restart the server and submit the form again.

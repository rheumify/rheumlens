# RheumLens

A **free**, image-based rheumatology question bank built on the ACR Rheumatology Image Library
(used with written permission for non-commercial educational purposes). Separate from Rheumify:
no paywall, no ads, no funnel.

- **Anonymous by default** — progress saves in the browser, no login needed.
- **Optional accounts** — sign in (Clerk) only to sync progress across devices. Login never gates a question.
- Stack: Next.js 15 (App Router) · Airtable (content) · Vercel Blob (images) · optional Clerk (auth).

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in AIRTABLE_API_KEY at minimum
npm run dev
```

Visit http://localhost:3000.

## Environment variables

| Var | Required? | Notes |
|---|---|---|
| `AIRTABLE_API_KEY` | yes | Personal access token with read on the RheumLens base |
| `AIRTABLE_BASE_ID` | yes | `appTFkAe9KWVMP3It` |
| `AIRTABLE_QUESTIONS_TABLE` | optional | defaults to `Image Questions` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | optional | set to enable the optional "Save progress" sign-in |
| `CLERK_SECRET_KEY` | optional | pairs with the above |
| `BLOB_READ_WRITE_TOKEN` | optional | auto-added when you create a Vercel Blob store; used by the image upload script |
| `NEXT_PUBLIC_SHOW_DRAFTS` | optional | `true` to preview unpublished `[DRAFT]` questions (use on a preview deploy only) |

> The app runs fully anonymous with **no Clerk keys** — Clerk is purely additive.

## How content works

Questions live in Airtable (**Image Questions** table). A question shows up in the app when its
`Published` box is checked. Each question’s image comes from the `Image` attachment field (or the
`Hosted URL` text field as a fallback).

### Getting images live (after you create a Vercel Blob store)

```bash
npm i
# put labeled images in ./images-to-upload/ named <QuestionID>.jpg  (e.g. RL-001.jpg)
export BLOB_READ_WRITE_TOKEN=...   # from the Blob store
export AIRTABLE_API_KEY=...  AIRTABLE_BASE_ID=appTFkAe9KWVMP3It
npm run upload-images
```

## Deploy

Push to the `rheumlens` GitHub repo → Vercel auto-deploys. Set the env vars above in the Vercel
project. Point `rheumlens.org` at the project in Vercel → Domains.

## Image rights

Every image carries `Copyright (year) ACR` and credits the ACR Rheumatology Image Library.
Keep the app non-commercial (no ads, no paywall) — that is the basis of the usage permission.
Do not host ACR images anywhere other than infrastructure you control.

# BuildCRM web

Next.js 16 / React 19 / Tailwind 4 frontend. Run `./pandacode-run.sh` from the repository root for the complete local app at `http://127.0.0.1:3010`; the API runs on 8010. From this directory use `npx tsc --noEmit`, `npm run lint`, and `npm run build` for checks.

`API_URL` is server-only and controls `/api/*` rewrites plus server-side marketing/public-site reads. Set it when building and running the production server. Dynamic tenant sites and document routes require a supported Next.js server; the current app is not a static export.

Deployment remains pending until Bluehost provides Node support. The reserved frontend address is `buildcrm.justsmartchoice.com`; do not replace Next.js to work around the current host limitation. Backend scheduler, worker, secrets, and integration requirements are recorded in `../api/README.md`.

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

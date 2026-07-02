# Express.Inc — API

REST API powering **Express.Inc**, an open service marketplace connecting verified Nigerian professionals — tradespeople, creatives, consultants, and everything in between — with customers who need reliable, bookable help. Built as the backend for a full-stack marketplace project, with escrow-style payments, role-based access control, and a category system that grows with the providers who join it.

**Live demo:** [link to deployed API or Postman collection]
**Frontend repo:** [link to frontend repo]

## Why this exists

Finding reliable help in most Nigerian cities still runs on word-of-mouth and luck — whether that's a plumber, a wedding photographer, a tutor, or a personal trainer. Express.Inc's goal is to make booking any of them as simple and low-risk as booking a ride: browse verified providers, see real reviews, pay securely, and only release payment once the work is actually done. This repo is the API layer that makes that possible — authentication, listings, bookings, payments, and the admin tools to keep the marketplace healthy.

The platform is deliberately **not** limited to a fixed list of service types. Categories aren't hardcoded — they're a living collection that grows as providers join with services the platform didn't anticipate.

## Architecture decisions worth knowing about

- **Listings are separate from accounts.** A provider's account and their actual service offerings (price, description, photos) are different collections. This means a single provider can list multiple services, pause one without deleting their account, and add or update listings any time — not just at signup.
- **Categories are open, not a fixed enum.** Service categories live in their own collection rather than a hardcoded list. When a provider's service doesn't fit anything that exists yet, they can name a new category at the point of creating their listing — it's created automatically (case-insensitive deduping so "Photography" and "photography" don't fork into two categories) and immediately becomes available to every other provider on the platform.
- **Bookings carry an explicit status machine.** `pending → accepted/declined → in-progress → completed/cancelled`, enforced server-side so a customer can't mark their own booking "completed" and a provider can't skip straight to "completed" without ever starting the job.
- **Payments are escrow-style.** When a customer pays via Paystack, funds are marked `paid` but not released. Only once a booking is confirmed `completed` does an admin trigger payout to the provider's bank account — protecting customers from paying for work that never happens.
- **Roles can't be self-assigned.** Registration only ever creates `user` or `provider` accounts; `admin`/`owner` privileges can only be granted by an existing owner through a dedicated endpoint. This is enforced in request validation, not just hidden in the UI, so it holds even if someone calls the API directly.

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js (ES modules) |
| Framework | Express 5 |
| Database | MongoDB + Mongoose |
| Auth | JWT, bcrypt password hashing |
| Validation | Joi |
| Payments | Paystack (initialize, verify, webhook, transfers) |
| File uploads | Multer (local disk, swappable for S3/Cloudinary) |

## API surface

| Resource | Base path | What it covers |
|---|---|---|
| Users | `/api/users` | Registration, login, profile, admin user management |
| Categories | `/api/categories` | Service categories — admin-curated initially, but extensible by any provider when they list a service that doesn't fit an existing one |
| Listings | `/api/listings` | Provider service listings — create, update, media upload, public browsing |
| Bookings | `/api/bookings` | Booking creation and status transitions, scoped per role |
| Reviews | `/api/reviews` | Post-completion reviews tied to a specific booking |
| Payments | `/api/payments` | Paystack initialize/verify/webhook, payout release |
| Payouts | `/api/payouts` | Provider bank account setup for receiving payouts |
| Admin | `/api/admin` | Platform stats, recent activity (admin/owner only) |

All protected routes expect `Authorization: Bearer <token>`, issued on login or registration.

## Getting started

```bash
git clone <repo-url>
cd backend
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | What it's for |
|---|---|
| `PORT` | Port the API listens on |
| `MONGODB_URL` | MongoDB connection string (Atlas or self-hosted) |
| `SECRET_KEY` | Random string used to sign JWTs |
| `ORIGIN_LOCAL` / `ORIGIN_VERCEL` / `ORIGIN_RENDER` / `ORIGIN_HOSTED_FRONTEND` | Allowed frontend origins for CORS |
| `PAYSTACK_SECRET_KEY` / `PAYSTACK_PUBLIC_KEY` | From your Paystack dashboard |
| `PAYSTACK_CALLBACK_URL` | Where Paystack redirects after payment |

Seed sample data (starter categories, an admin/owner account, sample providers, listings, and bookings):

```bash
npm run seed
```

Run it:

```bash
npm run dev     # development, auto-restarts on change
npm start       # production
```

## Roadmap

- [ ] Email verification on signup
- [ ] In-app messaging between customer and provider
- [ ] Dispute resolution flow for contested bookings
- [ ] Cloud storage for listing media (currently local disk)
- [ ] Category moderation tools (merge duplicates, admin review of provider-created categories)

## Author

Built by **Ozomamelu Chimaobi** as part of an independent blockchain & full-stack development track. Get in touch: ozomameluchimaobi123@gmail.com · [your LinkedIn] · [your portfolio site]

## License

Proprietary — all rights reserved. See [LICENSE](./LICENSE).
# AeroSend - High-Performance Bulk Email Outreach Platform

AeroSend is a modern bulk email sending and campaign management application built with Next.js 14 (App Router), Prisma, TypeScript, and Tailwind CSS.

## Features

- **Multi-Provider Support**: Seamlessly send via SMTP, Resend, Microsoft Outlook / Office 365, Google Workspace, and Zoho.
- **Campaign Management**: Compose, schedule, draft, and track email campaigns.
- **Audience & Contact Lists**: Contact segmentation, CSV import modal with column mapping, and contact metadata.
- **Intelligent Queue Engine**: Rate limiting, retry mechanics, backoff logic, and provider throttling.
- **Analytics & Tracking**: Real-time event tracking for opens, clicks, deliveries, bounces, and unsubscribes.
- **Modern UI**: Polished dashboard with Tailwind CSS and Lucide icons.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database / ORM**: SQLite (development) / PostgreSQL compatible via Prisma ORM
- **Email Engines**: Nodemailer, Resend SDK

## Getting Started

### Prerequisites

- Node.js (v18 or later recommended)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/1972001raj-droid/bulk-mail-sender.git
   cd bulk-mail-sender
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Copy `.env.example` to `.env` and fill in your keys:
   ```bash
   cp .env.example .env
   ```

4. Initialize the Database:
   ```bash
   npm run db:push
   npm run db:seed
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

## Project Structure

```
├── prisma/               # Prisma schema & database
├── scripts/              # Database seed & test scripts
├── src/
│   ├── app/              # Next.js App Router routes & API endpoints
│   ├── components/       # Reusable UI components
│   └── lib/              # Providers, queue engine, database client, & utilities
└── public/               # Static assets
```

## License

MIT License.

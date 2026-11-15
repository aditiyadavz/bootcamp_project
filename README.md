# SubmitTrack: Student Document Submission Portal

A full stack cloud application for internship document submission. Students upload their final report, plagiarism report and completion certificate. Mentors review them, and coordinators manage batches, deadlines and people, with live analytics.

**Stack:** React (Vite) · Node.js · Express · MongoDB Atlas with GridFS · Socket.IO · Render · GitHub Actions · Docker. Everything runs on free plans.

## Features

| Role | What they can do |
|---|---|
| Student | Register with a batch, upload PDFs by drag and drop, keep up to 5 versions, preview files in the page, message the mentor, see a live countdown and instant decisions |
| Mentor | See only assigned students, filter and search, open a review queue, preview every version, approve or reject with feedback, enter the plagiarism score (must be below 10%) |
| Coordinator (admin) | Live charts, CSV export, create batches and deadlines, add mentors and coordinators, assign mentors, give extensions, deactivate accounts, audit log |

Also included:

- **Instant updates:** notifications over WebSockets, with an unread badge.
- **Reminders:** a daily deadline reminder, triggered by GitHub Actions.
- **API documentation:** an interactive page at `/api/docs`.
- **Interface:** dark mode, and layouts that work on phones.

## Project structure

```
client/src/
  App.jsx            Routes, and which roles may open each page
  context/           Login session, live updates (Socket.IO), theme
  hooks/useLiveData  Loads data and reloads it when the server reports a change
  components/        Layout, drop zone, PDF preview, messages, icons
  pages/             Home, About, Login, Register, Notifications, Profile
  pages/student/     Dashboard, document page
  pages/mentor/      Student list, review page
  pages/admin/       Overview (charts), users, batches, audit log
server/
  index.js           Connects to MongoDB Atlas and starts the server and Socket.IO
  app.js             Security headers, request log, API routes, API docs, React site
  routes/            auth, batches, documents, mentor, admin, notifications, reminders
  models/            User, Batch, Document, Comment, Notification, AuditLog
  lib/               Access rules, real-time messages, notifications, audit log
  middleware/        Login and role checks, input validation (Zod)
  fileStorage.js     Saves PDFs in GridFS
  createAdmin.js     Creates the first coordinator account
  tests/             API and real-time tests, test server and test data
e2e/                 Browser tests (Playwright)
.github/workflows/   CI pipeline and daily reminders
Dockerfile, docker-compose.yml, render.yaml
```

## 1. Create the database (MongoDB Atlas, free)

1. Sign up at https://www.mongodb.com/cloud/atlas/register and create a **Free** cluster.
2. Under **Database Access**, add a database user with a strong password made of letters and numbers.
3. Under **Network Access**, add `0.0.0.0/0`. Render's free plan has no fixed address.
4. Under **Connect > Drivers**, copy the connection string. Replace `<password>` and add `/portal` before the `?`.

## 2. Run it on your laptop

You need [Node.js](https://nodejs.org/) 20 or newer. Copy `.env.example` to `.env` and fill in the three values. Then run:

```bash
npm install
```

```bash
npm run build
```

```bash
npm run create-admin
```

```bash
npm start
```

Open http://localhost:5000 and log in as the admin you just created. Then:

1. Create a batch.
2. Add mentors.
3. Share the link so students can register.

### Demo data for presentations (optional)

The command below adds demo accounts to your real database:

- A coordinator, three mentors and a demo student.
- Five batches across different streams and years.
- 22 sample students with documents.

```bash
npm run create-demo
```

The login passwords are saved to `demo-accounts.txt`, which Git ignores. To recreate the sample students, add `-- --reset-samples`. To delete all demo data, add `-- --remove`.

## 3. Deploy on Render (free)

1. Push this project to GitHub.
2. In Render, choose **New > Blueprint** and select the repository. Render reads `render.yaml`.
3. When asked, paste your `MONGODB_URI`, and choose a long random `CRON_SECRET`. Render creates `JWT_SECRET` itself.
4. Render builds the app and gives you an `https://….onrender.com` link. From then on, it deploys automatically after the GitHub checks pass.

**Daily reminders:** in GitHub, go to **Settings > Secrets and variables > Actions** and add these secrets:

- `APP_URL`: your Render link.
- `CRON_SECRET`: the same value you gave Render.

The free Render service sleeps after 15 minutes without visitors and takes about a minute to wake. Open the link a minute early before a demonstration.

## Tests

| Command | What it checks |
|---|---|
| `npm test` | 36 API and real-time tests on a temporary database |
| `npm run test:e2e` | 9 browser tests in Microsoft Edge, including two users at once |
| `npm run test:server` | Starts a test server with sample data on http://localhost:5100 (test password `Test@12345`) |

The tests never touch your Atlas database. GitHub Actions runs all of them on every push, and also builds the Docker image.

## Docker (optional)

With Docker installed, `docker compose up --build` runs the app with its own MongoDB container on http://localhost:5000.

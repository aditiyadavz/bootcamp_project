# Viva Guide

Practise these answers out loud, then open the files named below and explain them in your own words.

## Your one-minute explanation

"SubmitTrack is a full stack cloud application for internship document submission, built with the MERN stack. It has three roles:

- Students upload their three documents and track each decision.
- Mentors review only their assigned students' files, and approve or reject them with feedback.
- Coordinators create batches and deadlines, assign mentors, and see live analytics.

Decisions and messages arrive instantly through WebSockets. The app runs on Render, which is a Platform as a Service, and the data and PDF files are stored in MongoDB Atlas. Every push to GitHub runs automated tests in GitHub Actions, and Render deploys only if they pass. It all runs on free plans."

## Demo order (about 5 minutes)

1. **Home and About pages:** the three roles, and the architecture.
2. **Coordinator:**
   - Show the Overview charts.
   - Create a batch.
   - Add a mentor and assign a student to them.
   - Export the CSV.
3. **Live update, using two windows:**
   - Log in as the student in one window and the mentor in the other.
   - The student uploads a file, and the mentor gets a pop-up instantly.
   - The mentor rejects it with feedback, and the student sees it instantly.
4. **Student's document page:** versions, preview and the message thread.
5. **Plagiarism rule:** approving at 12% similarity is refused, and 6% works.
6. **Audit log, API docs, dark mode and phone layout.**
7. **GitHub Actions page:** show the green checks.

## How a request flows

When a mentor rejects a document:

1. **React:** `MentorStudent.jsx` sends `PATCH /api/mentor/documents/:id`.
2. **Login check:** `requireLogin` reads the JWT cookie, and `requireRole` allows only mentors and coordinators.
3. **Validation:** Zod (`validate.js`) checks the request body.
4. **Access check:** `canAccessStudent` checks that this mentor is assigned to the student.
5. **Saving:** the route saves the status, adds a history entry and the comment, and writes the audit log.
6. **Notifying:** `notify()` saves a notification and pushes it to the student's Socket.IO room.
7. **Live update:** the student's browser shows a pop-up, and `useLiveData` reloads the page data.

## Likely questions

### Architecture and cloud

**Which cloud service models does the project use?**
- Render is PaaS: I give it code, and it runs and scales it.
- MongoDB Atlas is a managed database, often called DBaaS.
- GitHub Actions is a hosted CI service.
- It all runs on the public cloud.

**Why store PDFs in the database instead of on the server?**
Render's free disk is temporary: files are lost when the service restarts or redeploys. GridFS stores each file in MongoDB Atlas in small chunks, so the files stay safe.

**What is CI/CD here?**
On every push, GitHub Actions runs four checks:

1. Installs the packages and builds the site.
2. Runs 36 API and real-time tests.
3. Runs 9 browser tests.
4. Builds the Docker image.

Render is set to "deploy after checks pass" in `render.yaml`, so broken code never goes live.

**What is `render.yaml`?**
Infrastructure as code. It describes the service: free plan, Singapore region, build and start commands, health check path and settings. Render creates the service from this file.

**What does the health check do?**
`/api/health` reports whether the database is connected. Render uses it to decide whether a new version is healthy.

**How do deadline reminders work?**
A scheduled GitHub Actions job (`reminders.yml`) runs every day at 09:00 IST. It calls `/api/reminders/run` with a secret key. The server reminds students whose deadline is within 3 days and who still have documents to submit, at most once a day.

**Why Docker if Render runs Node directly?**
The Dockerfile makes the app portable to any container platform, such as AWS, Azure or Google Cloud. The two-stage build first builds the React site, then copies only what is needed into a small image that runs as a non-root user. CI checks that the image builds and starts.

**What are the limits of the free plans?**
- **Render:** sleeps after 15 minutes without visitors and takes about a minute to wake.
- **Atlas:** 0.5 GB of storage, which is why only the last 5 versions of each file are kept.

### Real-time updates

**How do instant updates work?**
Socket.IO keeps a WebSocket connection open between the browser and the server. When a user connects, the server checks the same JWT cookie used for login and puts them in a room named after their user ID. To notify someone, the server sends a message to their room.

**Why WebSockets and not refreshing every few seconds?**
Polling wastes requests and still has a delay. WebSockets push changes the moment they happen.

### Security

**How are passwords stored?**
As bcrypt hashes. A hash can't be turned back into the password.

**How does login work?**
A signed JWT is stored in an HttpOnly cookie:

- **Signed:** it can't be faked.
- **HttpOnly:** page scripts can't read it.
- **Secure:** it is sent only over HTTPS when live.
- **SameSite=Lax:** other websites can't use it in form submissions.

**How are roles enforced?**
On the server, with `requireRole('mentor', 'admin')`. Hiding buttons in React isn't security, so every route checks again.

**What is input validation?**
Zod checks every request body. This also blocks NoSQL injection, where someone sends `{ "$ne": null }` instead of a System ID.

**What else protects the app?**
- **Helmet:** adds security headers.
- **Rate limiting:** limits login attempts to 20 in 15 minutes.
- **File check:** reads a file's first bytes (`%PDF-`), not only its name.
- **CSV export:** cells starting with `=` are made safe, so they can't run as spreadsheet formulas.
- **Secret key comparison:** the reminder key is compared in constant time.

### Database

**What collections are there?**
users, batches, documents, comments, notifications and auditlogs, plus GridFS's `pdfs.files` and `pdfs.chunks`.

**How are versions kept?**
Each document has a `versions` array. A new upload adds version n+1. After 5 versions, the oldest file is deleted from GridFS.

**What does `toPublic()` do?**
It shapes a document for the browser and leaves out internal file IDs.

### Frontend

**How are pages protected?**
`App.jsx` wraps routes in `Protected` (must be logged in) and `Only roles={[...]}` (must have the right role).

**What is `useLiveData`?**
A custom hook. It loads data from the API and loads it again whenever the real-time "changed" message arrives.

**What is React Context used for?**
To share three things across all pages: the login session, the live connection with its unread count, and the theme.

**Why is the Overview page loaded separately?**
The charts library is large. `React.lazy` loads it only when a coordinator opens that page, so other pages load faster.

### Testing

**How did you test it?**
In three layers:

1. **36 API and real-time tests:** Node's test runner and Supertest, with an in-memory MongoDB.
2. **9 browser tests:** Playwright, including two users at once to prove live updates.
3. **Production build simulation:** checks Render's exact build command.

**Why a temporary database for tests?**
So tests never change real data, and each test starts clean.

## Before the viva

- [ ] Deploy and open your live link a minute early.
- [ ] Practise the two-window live demo.
- [ ] Run `npm test` and `npm run test:e2e` once.
- [ ] Open `server/routes/mentor.js`, `server/lib/realtime.js` and `client/src/context/Realtime.jsx` and explain them.
- [ ] Keep `npm run test:server` ready as a backup if the internet fails.

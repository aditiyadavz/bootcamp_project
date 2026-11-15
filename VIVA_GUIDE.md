# Viva Guide

Read this aloud a few times, then open the code files named below so you can explain them yourself.

## Your 30-second explanation

"I built a Student Document Submission Portal using the MERN stack and cloud services. Students upload three PDF documents and see whether each is pending, approved or rejected. A mentor reviews them on a dashboard and can leave a comment. The app runs on Render, which is a Platform as a Service, and the data and files are stored in MongoDB Atlas. It uses free plans, so it costs nothing to run."

## How a request flows

Example: a student uploads a report.

1. **React** (`Dashboard.jsx`) sends the file to the API.
2. **Express** (`routes/documents.js`) checks that the student is logged in.
3. It checks the deadline, that the file isn't already approved, the 5 MB size limit, and that it is really a PDF.
4. **GridFS** (`fileStorage.js`) saves the PDF in MongoDB Atlas.
5. A **document record** is saved with the status Pending.
6. React reloads the list and shows the new status.

## Likely questions

### About the project

**Why did you build this?**
Our department's submission process involves several people, and its notice doesn't describe a way to see whether a document was accepted. The portal shows this clearly.

**What are the two user roles?**
Student and admin (the mentor). The role is stored in the user's record and is checked on the server.

**Does the college actually use it?**
No. It is a working proof of concept built for this internship.

**What are its limitations?**
It sleeps when idle, has 0.5 GB of free storage, sends no email reminders, and doesn't verify System IDs against university records.

### About the cloud

**What is cloud computing?**
Using computing resources such as servers and storage over the internet, when needed, instead of owning the hardware.

**What is the difference between IaaS, PaaS and SaaS?**
- **IaaS:** you rent virtual machines and manage the operating system. Example: AWS EC2.
- **PaaS:** you give your code and the provider runs it. Example: Render.
- **SaaS:** you simply use a finished application. Example: Gmail.

**Which models does your project use?**
Render is PaaS. MongoDB Atlas is a managed database, often called DBaaS. It runs on the public cloud deployment model.

**Why did you store the PDFs in the database instead of on the server's disk?**
Render's free disk is temporary. Files on it are lost whenever the service restarts or redeploys. Atlas keeps them safe.

**What is GridFS?**
A MongoDB feature that stores files by splitting them into small chunks. The details are in `pdfs.files` and the pieces are in `pdfs.chunks`.

**How does deployment work?**
I push code to GitHub. Render takes it, runs the build command, then starts the app. It gives me a public HTTPS link.

**What is an environment variable, and why use one?**
It is a setting kept outside the code. The database password and JWT secret are kept there, so they never end up on GitHub.

**What does the health check do?**
`/api/health` reports whether the database is connected. Render uses it to check that the app is working.

**Why is the first load sometimes slow?**
Render's free plan puts the service to sleep after 15 minutes without traffic, and it takes about a minute to wake up.

**Why does Atlas allow access from `0.0.0.0/0`?**
Render's free plan has no fixed address, so I can't list just one. This is a limitation, and a strong password protects the database. A paid plan could restrict it.

**How would you scale it?**
Move to paid Render and Atlas plans, run more app instances, and move the PDFs to object storage such as Amazon S3.

### About the MERN stack

**What does MERN stand for?**
MongoDB (database), Express (backend framework), React (frontend) and Node.js (runs JavaScript on the server).

**What is an API?**
A set of addresses the frontend calls to get or change data, such as `POST /api/auth/login`.

**What do GET, POST and PATCH mean?**
GET reads data, POST creates data, and PATCH changes part of existing data.

**What is a React component and state?**
A component is a reusable piece of the page, such as `DocumentCard`. State is data that makes the page update when it changes, set with `useState`.

**What does `useEffect` do?**
It runs code after a component appears. I use it to load data from the API.

**What is middleware?**
A function that runs before a route. `requireLogin` checks the user is logged in, and `requireRole` checks they have the right role.

**What is Mongoose?**
A library that defines the shape of the data as models, such as `User` and `Document`, and makes database queries simple.

**Why MongoDB and not SQL?**
Its flexible JSON-like documents work naturally with JavaScript, and Atlas has a free managed plan. A SQL database would also have worked.

### About the interactive features

**How does a decision appear without refreshing?**
The student's page asks the server for new data every 15 seconds. This is called polling. If a status has changed, it shows a pop-up. See `load` and `setInterval` in `Dashboard.jsx`.

**Why polling and not WebSockets?**
Polling is simple and enough here, because a 15-second delay doesn't matter. WebSockets would make it instant, and that is in my future scope.

**How does the countdown work?**
`Countdown.jsx` uses `setInterval` to update the time every second. React redraws the numbers when the state changes. `clearInterval` stops the timer when the page closes.

**How does drag and drop work?**
`DropZone.jsx` listens for the browser's `onDragOver` and `onDrop` events and reads the file from `event.dataTransfer.files`.

**How does the upload progress bar work?**
`fetch` can't report upload progress, so `uploadFile` in `api.js` uses `XMLHttpRequest`, and its `upload.onprogress` event gives the percentage.

**You check the file in the browser. Why check it on the server too?**
Browser checks only give quick feedback, and they can be bypassed. The server check is the one that protects the system.

**How does the progress ring work?**
`ProgressRing.jsx` draws an SVG circle. `strokeDasharray` sets how much of the circle is filled, based on approved documents out of three.

**How do the mentor's filters work?**
Each summary card has a rule in `FILTERS` in `Admin.jsx`. The page uses `.filter()` with that rule and the search text. No extra server request is needed.

**How does the activity history work?**
Each upload and review adds an entry to the document's `history` array in MongoDB using `$push`. The page lists the entries, newest first.

**How does dark mode work?**
All colours are CSS variables. Dark mode sets `data-theme="dark"` on the page, which changes those variables. The choice is saved in `localStorage`.

**What is a toast?**
A small pop-up message that disappears by itself. `Toast.jsx` uses React Context, so any page can show one.

### About security

**How do you protect passwords?**
They are hashed with bcrypt. A hash can't be turned back into the password. At login, bcrypt compares the typed password with the stored hash.

**What is a JWT?**
A signed token that proves who the user is. The server creates it at login, and the signature shows it hasn't been changed.

**Why keep it in an HttpOnly cookie?**
Scripts on the page can't read it, which reduces the risk if a script is injected.

**How do you stop a student opening someone else's file?**
The download route compares the file's owner with the logged-in user. If they don't match and the user isn't a mentor, it returns 403 Access denied.

**How do you check an upload is really a PDF?**
I check that the name ends in `.pdf` and that the first bytes of the file are `%PDF-`, because a name alone can be faked.

**What is NoSQL injection, and how do you prevent it?**
It is sending a database command instead of normal text at login. I convert the input with `String()`, and test 6 confirms this attack fails.

### About testing

**How did you test it?**
I have 24 automatic tests using Node's test runner and Supertest, with a temporary database. I also ran 31 scripted checks in a real browser, including a student and a mentor logged in at the same time.

**Did testing find any bugs?**
Yes, two. The page could crash when an upload finished, and an old comment stayed in the mentor's box after a student uploaded a new file. Both were fixed.

**Show me the tests.**
Run `npm test`. They should all pass.

## Before the viva

- [ ] Run the app and go through the whole journey yourself.
- [ ] Open each file in `server/routes` and explain it out loud.
- [ ] Open `Dashboard.jsx` and explain `load`, `useEffect` and `setInterval`.
- [ ] Open `DropZone.jsx` and explain how a file gets uploaded.
- [ ] Practise showing the live update with two browser windows.
- [ ] Run `npm test`.
- [ ] Open the live link early so the service has time to wake up.
- [ ] Keep `npm run demo` ready in case the internet fails.

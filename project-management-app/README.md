# Parallel

A portfolio-ready project management application built with React, TypeScript,
Node.js, Express, PostgreSQL, and Prisma.

## First-time database setup

Prisma can run a lightweight local PostgreSQL-compatible development server,
so Docker is not required:

```bash
npm install
cd server
npx prisma@7.10.0 dev --detach --name taskflow
```

Copy the connection URL printed by that command into `server/.env`. Append the
two compatibility parameters shown below:

```env
PORT=3001
DATABASE_URL="the-printed-connection-url&pgbouncer=true&connection_limit=1"
```

Then return to the project root and prepare the database:

```bash
cd ..
npm run db:migrate
npm run db:seed
npm run dev:full
```

Open `http://localhost:5173`. The command starts the React client, Express API,
and Firebase Auth emulator. The API runs at `http://localhost:3001`, and the
emulator UI runs at `http://localhost:4000`.

You can alternatively use any PostgreSQL provider by putting its connection
string in `server/.env`.

When the Auth emulator is enabled, the login screen includes a **Use developer
account** button. It creates or signs into a dummy local account, so no real
email address or personal information is required. This button is hidden in
production.

## Project structure

```text
project-management-app/
├── client/                 React user interface
│   └── src/
│       ├── components/     Reusable UI components
│       ├── data/           Board column configuration
│       ├── lib/            Firebase client setup
│       ├── services/       HTTP requests to the API
│       ├── types/          Shared front-end TypeScript types
│       ├── App.tsx         Main page and task state
│       └── styles.css      Application styles
├── server/                 Node.js API
│   ├── prisma/             Database schema and migrations
│   └── src/
│       ├── routes/         REST API endpoints
│       ├── seed.ts         Starter database records
│       └── index.ts        Express setup and middleware
└── package.json            Commands for the whole application
```

## How this milestone works

1. Firebase signs the user in and issues an ID token.
2. Express verifies the token and synchronizes the user with PostgreSQL.
3. Project memberships determine which projects and tasks the user can access.
4. Owners can create projects and add existing Parallel users by email.
5. Tasks can be assigned only to members of their project.
6. React switches projects without reloading the page.
7. Tasks can be dragged between status columns or moved with arrow buttons.
8. Prisma persists projects, memberships, assignments, and tasks.

## Useful commands

- `npm run dev` — run the client and API without starting Auth
- `npm run dev:full` — run the client, API, and Auth emulator
- `npm run auth:emulator` — run only the Firebase Auth emulator
- `npm run build` — create production builds
- `npm run lint` — lint the client and type-check the API
- `npm test` — run the client and API test suites
- `npm run db:migrate` — apply schema migrations
- `npm run db:generate` — regenerate the type-safe Prisma client
- `npm run db:seed` — add the starter project and tasks
- `npm run db:studio` — inspect database records visually

## Deployment

The live app is at https://taskflow-project-fb.web.app. The API is at
https://taskflow-api-production-04fe.up.railway.app, with PostgreSQL on Railway.

The client is hosted on Firebase Hosting. The API is a separate Node service
because Firebase Hosting only serves the built React app.

### Client

1. Create a Firebase project and enable Email/Password authentication.
2. Create a Web app and copy its config into `client/.env.production`.
   Set `VITE_USE_FIREBASE_EMULATOR` to `false`.
3. Set `VITE_API_URL` to the deployed API origin, with no trailing slash.
4. From the project root, build and deploy:

```bash
npm run build --workspace client
firebase deploy --only hosting
```

Local development still uses `client/.env.local` and the Auth emulator. The
developer-account button stays hidden in the production build.

### API and database

`render.yaml` describes a Render web service for the API. Create a hosted
PostgreSQL database (Neon, Supabase, or Render Postgres) and set these
environment variables on the API service:

- `DATABASE_URL` — the hosted Postgres connection string
- `FIREBASE_PROJECT_ID` — the Firebase project id
- `CLIENT_ORIGIN` — the Firebase Hosting origin, such as
  `https://taskflow-project-fb.web.app`

The production start command applies Prisma migrations before the API listens.
Do not set `FIREBASE_AUTH_EMULATOR_HOST` in production. A service-account file
is not required for sign-in checks.

The same API image can be built from `server/Dockerfile` on any host that
provides those variables and a public `PORT`.

# School Space — Setup Guide

## Prerequisites

- **Node.js** v18+ (check: `node -v`)
- **MySQL** 8.0+ (check: `mysql --version`)
- **npm** (comes with Node.js)

## Step 1: Create MySQL Database

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS schooldb;"
```

## Step 2: Configure Environment

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and set:

```
DATABASE_URL="mysql://root:YOUR_MYSQL_PASSWORD@localhost:3306/schooldb"
JWT_SECRET="any-random-string-at-least-32-characters-long"
```

**Important:** If your MySQL password has special characters, URL-encode them:
- `@` → `%40`
- `#` → `%23`

Email and Cloudinary are optional for development.

## Step 3: Install Dependencies

```bash
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

## Step 4: Setup Database & Seed

```bash
cd backend
npx prisma generate
npx prisma db push
node prisma/seed.js
cd ..
```

## Step 5: Start All Servers

```bash
./start.sh
```

Or manually:
```bash
cd backend && npm run dev &       # Port 8080
cd frontend && npm run dev &      # Port 3000
cd backend && npx prisma studio & # Port 5555
```

## Step 6: Open in Browser

- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- Database GUI: http://localhost:5555

## Login Credentials

All users use the same password and school code:
- **Password:** `Demo@1234`
- **School Code:** `SS01`

| Role | Username |
|------|----------|
| Admin | `admin_demo` |
| Teacher (Math) | `teacher_math` |
| Teacher (Science) | `teacher_science` |
| Student | `student_rahul` |
| Parent | `parent_sharma` |

## Troubleshooting

**"Can't connect to MySQL"**
- Make sure MySQL is running: `mysql -u root -p -e "SELECT 1"`
- Check your DATABASE_URL password is correct

**"Table doesn't exist"**
- Run: `cd backend && npx prisma db push`

**"Cannot find module '@prisma/client'"**
- Run: `cd backend && npx prisma generate`

**Port already in use**
- Kill existing: `./stop.sh` or `lsof -ti:8080 | xargs kill`

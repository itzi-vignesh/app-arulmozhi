# NerdShive Workspace Management Platform

A modern, containerized workspace management portal featuring user registration approvals, attendance tracking, biometric query integrations, and bulk employee CSV enrollment.

---

## Prerequisites
To run this application locally, you will need the following tools installed on your host machine:
* **Node.js** (v18 or higher) & **npm** (v9 or higher)
* **Python** (v3.10 or higher)
* **PostgreSQL** (v15 or higher)
* **Docker** & **Docker Compose** (Optional, recommended for quick start)

---

## Default Credentials

### 1. Default Superuser Credentials
* **Username / Email:** `superuser@example.com`
* **Password:** `password123`
* *Role capabilities:* Manage administrators, approve customer registrations, edit global workspace pricing/rules, view global activity logs.

### 2. Default Admin Credentials
* **Username / Email:** `admin@example.com`
* **Password:** `password123`
* *Role capabilities:* Toggle member active states, respond to user query logs, approve member check-ins.

---

## Environment Variables

### Frontend Environment Variables (`.env` in the root folder)
* **Docker mode (Default):**
  ```env
  VITE_API_URL="http://127.0.0.1:8001/api/v1"
  ```
* **Non-Docker mode (Direct):**
  ```env
  VITE_API_URL="http://127.0.0.1:8000/api/v1"
  ```

### Backend Environment Variables (`backend/.env` or system environment)
```env
PROJECT_NAME="NerdShive App"
DATABASE_URL="postgresql://app_user:password123@localhost:5432/app_db"
SECRET_KEY="generate-a-secure-random-jwt-signing-key-here"
ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=10080
```

---

## Docker Setup (Quick Start)

Deploy the entire stack (PostgreSQL + FastAPI Backend + React Nginx Frontend) in one command:

```bash
# 1. Start the Docker services
docker compose up --build -d

# 2. Check service status
docker compose ps
```

* **Frontend URL:** [http://localhost/](http://localhost/)
* **Backend API Documentation:** [http://localhost:8001/docs](http://localhost:8001/docs)

*(Note: The database seeds automatically during container startup).*

---

## Non-Docker Setup (Bare-Metal Local Development)

### Step 1: PostgreSQL Setup
Ensure PostgreSQL is running on port `5432` on your machine, then create the database and user credentials:
```bash
# Connect as postgres superuser
psql -U postgres
```
```sql
-- Create database user
CREATE USER app_user WITH PASSWORD 'password123';

-- Create database owned by the user
CREATE DATABASE app_db OWNER app_user;
```

### Step 2: Backend Setup
1. Navigate to the backend directory and set up a virtual environment:
   ```bash
   cd backend
   python -m venv .venv
   ```
2. Activate the virtual environment:
   * **Windows:** `.venv\Scripts\activate`
   * **macOS / Linux:** `source .venv/bin/activate`
3. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```
4. Run Database Schema Migrations:
   ```bash
   alembic upgrade head
   ```
5. Seed initial users (Superuser, Admin, pricing configurations):
   ```bash
   python storage/seed_in_docker.py
   ```
6. Start the Uvicorn local development server:
   ```bash
   uvicorn app.main:app --port 8000 --reload
   ```

### Step 3: Frontend Setup
1. Open a new terminal in the project root folder.
2. Install Node.js dependencies:
   ```bash
   npm install
   ```
3. Configure the local environment file. Create a file named `.env` in the root directory:
   ```env
   VITE_API_URL="http://127.0.0.1:8000/api/v1"
   ```
4. Start the Vite development server:
   ```bash
   npm run dev
   ```

* **Local Frontend URL:** `http://localhost:5173/`
* **Local Backend URL:** `http://localhost:8000/api/v1`

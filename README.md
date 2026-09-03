# 🎬 MovieBook — Full-Stack Movie Ticket Booking Platform

A complete cinema ticket booking platform built with **Django + MongoDB Atlas + Vanilla JavaScript**.

---

## ✨ Features

### Customer
- Browse movies by genre, language, search
- Movie detail page with trailer, cast, and showtimes
- Interactive cinema seat selection (visual layout)
- Secure booking with duplicate-seat prevention
- Digital ticket with barcode
- View/cancel bookings
- Profile management

### Admin
- Dashboard with statistics (revenue, bookings, top movies)
- Full CRUD for Movies, Theatres, Screens, Shows
- Booking management and cancellation
- User management (block/activate)

---

## 🗂 Project Structure

```
/
├── backend/
│   ├── manage.py
│   ├── movie_booking/
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── ...
│   └── api/
│       ├── db.py           ← PyMongo connection
│       ├── auth_helpers.py ← Token auth
│       ├── views.py        ← All API handlers
│       └── urls.py
├── frontend/
│   ├── index.html          ← Customer SPA
│   ├── admin.html          ← Admin dashboard
│   ├── css/
│   │   ├── styles.css
│   │   └── admin.css
│   └── js/
│       ├── config.js       ← API URL config
│       ├── app.js          ← Customer SPA logic
│       └── admin.js        ← Admin dashboard logic
├── .env                    ← Environment variables (NOT committed)
├── requirements.txt
├── seed.py                 ← Database seeder
└── README.md
```

---

## ⚙️ Installation & Setup

### 1. Prerequisites
- Python 3.10+
- pip
- MongoDB Atlas account (cluster already configured in `.env`)

### 2. Create virtual environment

```bash
python -m venv venv
```

**Windows:**
```bash
venv\Scripts\activate
```

**macOS/Linux:**
```bash
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

> If you encounter a Django version issue, the requirements.txt uses `Django>=4.2` which is widely compatible. Django 6.x will also work.

---

## 🗄️ Database Setup

### Configure MongoDB Atlas

The `.env` file already contains the MongoDB Atlas credentials:

```env
MONGO_DB_NAME=movie_booking
```

> **Important:** Make sure your IP address is whitelisted in MongoDB Atlas Network Access settings. You can allow access from anywhere (`0.0.0.0/0`) for development.

### Seed the database

From the **project root** (not the backend folder):

```bash
python seed.py
```

This creates:
- Admin user
- 2 demo customers
- 10 movies (various genres and languages)
- 3 theatres (PVR Mumbai, INOX Bangalore, Cinepolis Gurgaon)
- Multiple screens per theatre
- Shows for the next 8 days

The seeder is **idempotent** — safe to run multiple times.

---

## 🚀 Running the Application

### Start Backend

```bash
cd backend
python manage.py runserver
```

The API will be available at: `http://127.0.0.1:8000/api/`

### Start Frontend

Open a **new terminal** and from the project root:

```bash
cd frontend
python -m http.server 5000
```

### Open in Browser

| Page | URL |
|------|-----|
| Customer Site | http://localhost:5000 |
| Admin Dashboard | http://localhost:5000/admin.html |

---

## 🔑 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@movies.com` | `admin123` |
| Customer | `john@example.com` | `john123` |
| Customer | `jane@example.com` | `jane123` |

---

## 🔌 API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register/` | Register new user |
| POST | `/api/auth/login/` | Login |
| POST | `/api/auth/logout/` | Logout |
| GET | `/api/auth/profile/` | Get profile |
| PUT | `/api/auth/profile/` | Update profile |

### Movies
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/movies/` | List movies (supports `?search=`, `?genre=`, `?language=`, `?status=`) |
| GET | `/api/movies/<id>/` | Movie detail |
| POST | `/api/movies/` | Create movie (admin) |
| PUT | `/api/movies/<id>/` | Update movie (admin) |
| DELETE | `/api/movies/<id>/` | Delete movie (admin) |

### Theatres
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/theatres/` | List theatres |
| GET | `/api/theatres/<id>/` | Theatre detail |
| POST | `/api/theatres/` | Create (admin) |
| PUT | `/api/theatres/<id>/` | Update (admin) |
| DELETE | `/api/theatres/<id>/` | Delete (admin) |

### Screens
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/screens/` | List screens (supports `?theatre_id=`) |
| GET | `/api/screens/<id>/` | Screen detail |
| POST | `/api/screens/` | Create (admin) |
| PUT | `/api/screens/<id>/` | Update (admin) |
| DELETE | `/api/screens/<id>/` | Delete (admin) |

### Shows
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/shows/` | List shows (supports `?movie_id=`, `?theatre_id=`, `?date=`) |
| GET | `/api/shows/<id>/` | Show detail |
| GET | `/api/shows/movie/<id>/` | Shows for a movie |
| GET | `/api/shows/theatre/<id>/` | Shows for a theatre |
| POST | `/api/shows/` | Create (admin) |
| PUT | `/api/shows/<id>/` | Update (admin) |
| DELETE | `/api/shows/<id>/` | Delete (admin) |

### Seats & Bookings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/seats/<show_id>/` | Get seat layout |
| POST | `/api/seats/book/` | Book seats (auth required) |
| GET | `/api/bookings/` | List user's bookings (auth required) |
| GET | `/api/bookings/<id>/` | Booking detail |
| POST | `/api/bookings/<id>/cancel/` | Cancel booking |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard/` | Dashboard statistics |
| GET | `/api/admin/users/` | All users |
| GET | `/api/admin/users/<id>/` | User detail + bookings |
| PUT | `/api/admin/users/<id>/` | Update user status/role |

---

## 🔒 Security

- Passwords hashed with Django's PBKDF2-SHA256
- Bearer token authentication stored in MongoDB sessions
- Tokens expire after 30 days
- Admin endpoints protected by `require_admin` decorator
- User endpoints protected by `require_auth` decorator
- MongoDB credentials only in `.env` — never in source code
- `.env` excluded from Git via `.gitignore`

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|------------|
| Backend | Python, Django 4.2+, Django REST Framework |
| Database | MongoDB Atlas (via PyMongo) |
| Auth | Custom token auth (no Django ORM) |
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Styling | Dark theme, Glassmorphism, CSS animations |

---

## ❗ Troubleshooting

### MongoDB connection fails
1. Check your IP is whitelisted in Atlas → Network Access
2. Verify `.env` file exists in project root with correct `MONGO_URI`
3. Test: `python -c "from pymongo import MongoClient; MongoClient('your_uri').admin.command('ping')"`

### CORS errors in browser
- Make sure Django is running on port 8000
- Frontend must be served from port 5000 (not opened directly as a file)
- Use `python -m http.server 5000` from the frontend folder

### `django-insecure` warning
- Change the `SECRET_KEY` in `.env` before deploying to production
- Set `DEBUG=False` in production

### Seats not loading
- Ensure the show exists and has an associated screen with `rows` and `seats_per_row` set
- Re-run `seed.py` if data is missing

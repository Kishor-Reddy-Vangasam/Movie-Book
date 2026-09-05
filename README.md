# 🎬 MovieBook — Movie Ticket Booking System

**MovieBook** is a full-stack movie ticket booking web application where users can browse movies, view showtimes, select seats, and book tickets. It also includes an admin dashboard for managing movies, theatres, shows, users, and bookings.

🌐 **Live Demo:** https://movie-book-omega.vercel.app/

## ✨ Features

### 👤 User

* 🎬 Browse and search movies
* 🎭 Filter movies by genre and language
* 📄 View movie details and showtimes
* 💺 Select seats and book tickets
* 🎫 Generate digital tickets
* 📋 View and cancel bookings
* 👤 Manage profile

### 🛠️ Admin

* 📊 Dashboard with statistics
* 🎬 Manage movies
* 🏢 Manage theatres and screens
* 🕐 Manage shows
* 🎟️ Manage bookings
* 👥 Manage users

## 🛠️ Tech Stack

* **Frontend:** HTML, CSS, JavaScript
* **Backend:** Python, Django
* **Database:** MongoDB Atlas
* **API:** Django REST Framework
* **Deployment:** Vercel

## 📁 Project Structure

```text
Movie-Book/
├── backend/
├── frontend/
│   ├── index.html
│   ├── admin.html
│   ├── css/
│   └── js/
│       ├── app.js
│       ├── admin.js
│       ├── config.js
│       └── movies-data.js
├── requirements.txt
├── seed.py
└── README.md
```

## 🚀 Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/Kishor-Reddy-Vangasam/Movie-Book.git
cd Movie-Book
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

Create a `.env` file:

```env
MONGO_URI=your_mongodb_connection_string
MONGO_DB_NAME=movie_booking
SECRET_KEY=your_secret_key
```

### 4. Start the backend

```bash
cd backend
python manage.py runserver
```

### 5. Start the frontend

```bash
cd frontend
python -m http.server 5000
```

Open:

```text
http://localhost:5000
```

## 🎟️ Booking Flow

```text
Movie → Show → Theatre → Seats → Booking → Digital Ticket
```

## 🌐 Deployment

The application is deployed using **Vercel** and connected to GitHub for automatic deployments.

**Live Website:** https://movie-book-omega.vercel.app/

## 👨‍💻 Author

**Kishor Reddy Vangasam**

GitHub: https://github.com/Kishor-Reddy-Vangasam

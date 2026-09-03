"""
seed.py — Populates MongoDB with realistic demo data.

Run from project root:
    python seed.py

Idempotent: checks for existing records before inserting to avoid duplicates.
"""
import os
import sys
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Load .env
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / '.env')

# Add backend to path so we can use auth helpers
sys.path.insert(0, str(Path(__file__).parent / 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'movie_booking.settings')

import django
django.setup()

from django.contrib.auth.hashers import make_password
from pymongo import MongoClient
from bson import ObjectId

MONGO_URI = os.environ.get('MONGO_URI')
MONGO_DB_NAME = os.environ.get('MONGO_DB_NAME', 'movie_booking')

if not MONGO_URI:
    print(" MONGO_URI not found in .env file")
    sys.exit(1)

print(f"[*] Connecting to MongoDB ({MONGO_DB_NAME})...")
try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10000)
    client.admin.command('ping')
    db = client[MONGO_DB_NAME]
    print("[OK] Connected to MongoDB Atlas")
except Exception as e:
    print(f" MongoDB connection failed: {e}")
    sys.exit(1)

# Collections
users_col = db['users']
movies_col = db['movies']
theatres_col = db['theatres']
screens_col = db['screens']
shows_col = db['shows']
bookings_col = db['bookings']
sessions_col = db['sessions']

now = datetime.now(timezone.utc)


def upsert_user(email, data):
    existing = users_col.find_one({'email': email})
    if existing:
        print(f"    User already exists: {email}")
        return str(existing['_id'])
    result = users_col.insert_one(data)
    print(f"   Created user: {email}")
    return str(result.inserted_id)


#  Users 

print("\n Seeding users...")

admin_id = upsert_user('admin@movies.com', {
    'name': 'Admin User',
    'email': 'admin@movies.com',
    'password_hash': make_password('admin123'),
    'role': 'admin',
    'status': 'active',
    'created_at': now,
    'updated_at': now,
})

customer_id = upsert_user('john@example.com', {
    'name': 'John Doe',
    'email': 'john@example.com',
    'password_hash': make_password('john123'),
    'role': 'customer',
    'status': 'active',
    'created_at': now,
    'updated_at': now,
})

customer2_id = upsert_user('jane@example.com', {
    'name': 'Jane Smith',
    'email': 'jane@example.com',
    'password_hash': make_password('jane123'),
    'role': 'customer',
    'status': 'active',
    'created_at': now,
    'updated_at': now,
})

#  Movies 

print("\n Seeding movies...")

movies_data = [
    {
        'title': 'Interstellar Odyssey',
        'description': 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity\'s survival. Stunning visuals and a mind-bending plot make this an unforgettable journey.',
        'genre': 'Sci-Fi',
        'language': 'English',
        'duration': 169,
        'rating': 8.7,
        'release_date': '2024-11-07',
        'poster': 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400&q=80',
        'banner': 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1200&q=80',
        'trailer': 'https://www.youtube.com/embed/zSWdZVtXT7E',
        'cast': ['Matthew McConaughey', 'Anne Hathaway', 'Jessica Chastain', 'Michael Caine'],
        'director': 'Christopher Nolan',
        'status': 'popular',
    },
    {
        'title': 'Shadow Realm',
        'description': 'A detective with supernatural abilities hunts a serial killer who can walk between dimensions. A thrilling neo-noir experience blending horror and mystery.',
        'genre': 'Thriller',
        'language': 'English',
        'duration': 132,
        'rating': 7.9,
        'release_date': '2025-01-15',
        'poster': 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=400&q=80',
        'banner': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=80',
        'trailer': 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        'cast': ['Oscar Isaac', 'Lupita Nyong\'o', 'Idris Elba'],
        'director': 'Jordan Peele',
        'status': 'latest',
    },
    {
        'title': 'Love in Paris',
        'description': 'Two strangers meet by chance at a Parisian café and fall deeply in love, only to discover they are rivals in the same art competition. A heartwarming romantic drama.',
        'genre': 'Romance',
        'language': 'English',
        'duration': 115,
        'rating': 7.2,
        'release_date': '2024-12-20',
        'poster': 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=400&q=80',
        'banner': 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&q=80',
        'trailer': 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        'cast': ['Timothée Chalamet', 'Zendaya', 'Florence Pugh'],
        'director': 'Greta Gerwig',
        'status': 'popular',
    },
    {
        'title': 'Iron Uprising',
        'description': 'In a future where machines have enslaved humanity, one engineer discovers the secret to defeating them. An explosive action-packed blockbuster with breathtaking set pieces.',
        'genre': 'Action',
        'language': 'English',
        'duration': 148,
        'rating': 8.1,
        'release_date': '2025-03-28',
        'poster': 'https://images.unsplash.com/photo-1535016120720-40c646be5580?w=400&q=80',
        'banner': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80',
        'trailer': 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        'cast': ['Dwayne Johnson', 'Margot Robbie', 'Ryan Reynolds'],
        'director': 'Michael Bay',
        'status': 'upcoming',
    },
    {
        'title': 'The Last Laugh',
        'description': 'A washed-up comedian gets one final shot at fame during his hometown\'s annual festival — if he can survive his chaotic family reunion first. A hilarious and heartfelt comedy.',
        'genre': 'Comedy',
        'language': 'English',
        'duration': 102,
        'rating': 7.6,
        'release_date': '2024-10-05',
        'poster': 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&q=80',
        'banner': 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=1200&q=80',
        'trailer': 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        'cast': ['Adam Sandler', 'Jennifer Aniston', 'Kevin Hart'],
        'director': 'Judd Apatow',
        'status': 'latest',
    },
    {
        'title': 'Raat Ka Raaz',
        'description': 'Ek andheri raat mein ek parivar ek haunted haveli mein phase jaata hai. Unhe apni zindagi bachane ke liye raaz suljhana hai. Darr, suspense aur twist ka behtareen combination.',
        'genre': 'Horror',
        'language': 'Hindi',
        'duration': 125,
        'rating': 7.4,
        'release_date': '2025-02-14',
        'poster': 'https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?w=400&q=80',
        'banner': 'https://images.unsplash.com/photo-1601513237763-10aaaa60fbcf?w=1200&q=80',
        'trailer': 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        'cast': ['Rajkummar Rao', 'Taapsee Pannu', 'Nawazuddin Siddiqui'],
        'director': 'Anurag Kashyap',
        'status': 'latest',
    },
    {
        'title': 'Dragon\'s Blood',
        'description': 'An epic fantasy saga where a young warrior discovers she is the last descendant of dragon riders. She must unite warring kingdoms before an ancient evil destroys the realm.',
        'genre': 'Fantasy',
        'language': 'English',
        'duration': 162,
        'rating': 8.4,
        'release_date': '2025-05-10',
        'poster': 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=400&q=80',
        'banner': 'https://images.unsplash.com/photo-1518544801976-3e159e50e5bb?w=1200&q=80',
        'trailer': 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        'cast': ['Anya Taylor-Joy', 'Henry Cavill', 'Cate Blanchett'],
        'director': 'Peter Jackson',
        'status': 'upcoming',
    },
    {
        'title': 'Chennai Express 2',
        'description': 'Rahul aur Meena ki ek nayi adventure comedy. Is baar unka safar aur bhi zyada mast aur dhamakedar hai! Full paisa vasool entertainer.',
        'genre': 'Comedy',
        'language': 'Hindi',
        'duration': 138,
        'rating': 7.0,
        'release_date': '2024-11-22',
        'poster': 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=400&q=80',
        'banner': 'https://images.unsplash.com/photo-1543253687-c931c8e01820?w=1200&q=80',
        'trailer': 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        'cast': ['Shah Rukh Khan', 'Deepika Padukone', 'Sathyaraj'],
        'director': 'Rohit Shetty',
        'status': 'popular',
    },
    {
        'title': 'Quantum Break',
        'description': 'A quantum physicist accidentally fractures time itself during a failed experiment. Now hunted by a corporation that wants to weaponize the anomaly, he has 48 hours to fix everything.',
        'genre': 'Sci-Fi',
        'language': 'English',
        'duration': 141,
        'rating': 8.0,
        'release_date': '2025-04-18',
        'poster': 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=400&q=80',
        'banner': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80',
        'trailer': 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        'cast': ['Tom Holland', 'Brie Larson', 'Jeff Bridges'],
        'director': 'Denis Villeneuve',
        'status': 'upcoming',
    },
    {
        'title': 'Neon Nights',
        'description': 'In a cyberpunk Mumbai of 2047, a street artist discovers a conspiracy that could topple the city\'s mega-corporations. Visually stunning with a powerful message about identity and freedom.',
        'genre': 'Action',
        'language': 'Hindi',
        'duration': 145,
        'rating': 8.3,
        'release_date': '2025-01-26',
        'poster': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80',
        'banner': 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=1200&q=80',
        'trailer': 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        'cast': ['Ranveer Singh', 'Alia Bhatt', 'Prabhas'],
        'director': 'SS Rajamouli',
        'status': 'latest',
    },
]

movie_ids = []
for m in movies_data:
    existing = movies_col.find_one({'title': m['title']})
    if existing:
        print(f"    Movie already exists: {m['title']}")
        movie_ids.append(str(existing['_id']))
    else:
        m['created_at'] = now
        m['updated_at'] = now
        result = movies_col.insert_one(m)
        movie_ids.append(str(result.inserted_id))
        print(f"   Created movie: {m['title']}")

#  Theatres 

print("\n  Seeding theatres...")

theatres_data = [
    {
        'name': 'PVR Cinemas',
        'location': 'Phoenix Mall',
        'city': 'Mumbai',
        'address': 'Lower Parel, Mumbai, Maharashtra 400013',
        'screens': 5,
        'status': 'active',
    },
    {
        'name': 'INOX Multiplex',
        'location': 'Forum Mall',
        'city': 'Bangalore',
        'address': 'Koramangala, Bangalore, Karnataka 560034',
        'screens': 4,
        'status': 'active',
    },
    {
        'name': 'Cinepolis',
        'location': 'DLF CyberHub',
        'city': 'Gurgaon',
        'address': 'DLF CyberHub, Gurgaon, Haryana 122002',
        'screens': 6,
        'status': 'active',
    },
]

theatre_ids = []
for t in theatres_data:
    existing = theatres_col.find_one({'name': t['name'], 'city': t['city']})
    if existing:
        print(f"    Theatre already exists: {t['name']}")
        theatre_ids.append(str(existing['_id']))
    else:
        t['created_at'] = now
        t['updated_at'] = now
        result = theatres_col.insert_one(t)
        theatre_ids.append(str(result.inserted_id))
        print(f"   Created theatre: {t['name']}")

#  Screens 

print("\n  Seeding screens...")

screens_data = []
screen_configs = [
    {'name': 'Screen 1', 'rows': 10, 'seats_per_row': 10, 'screen_type': 'Standard'},
    {'name': 'Screen 2', 'rows': 8, 'seats_per_row': 10, 'screen_type': '4DX'},
    {'name': 'Screen 3', 'rows': 12, 'seats_per_row': 12, 'screen_type': 'IMAX'},
    {'name': 'Screen 4', 'rows': 6, 'seats_per_row': 8, 'screen_type': 'Gold'},
    {'name': 'Screen 5', 'rows': 10, 'seats_per_row': 10, 'screen_type': 'Standard'},
]

screen_ids_by_theatre = {}
for theatre_id in theatre_ids:
    theatre = theatres_col.find_one({'_id': ObjectId(theatre_id)})
    num_screens = min(theatre.get('screens', 3), 5)
    screen_ids_by_theatre[theatre_id] = []

    for i in range(num_screens):
        cfg = screen_configs[i % len(screen_configs)]
        existing = screens_col.find_one({'theatre_id': theatre_id, 'name': cfg['name']})
        if existing:
            print(f"    Screen already exists: {theatre['name']} / {cfg['name']}")
            screen_ids_by_theatre[theatre_id].append(str(existing['_id']))
        else:
            screen_doc = {
                'theatre_id': theatre_id,
                'name': cfg['name'],
                'rows': cfg['rows'],
                'seats_per_row': cfg['seats_per_row'],
                'total_seats': cfg['rows'] * cfg['seats_per_row'],
                'screen_type': cfg['screen_type'],
                'created_at': now,
                'updated_at': now,
            }
            result = screens_col.insert_one(screen_doc)
            screen_ids_by_theatre[theatre_id].append(str(result.inserted_id))
            print(f"   Created screen: {theatre['name']} / {cfg['name']}")

#  Shows 

print("\n  Seeding shows...")

show_times = ['10:00', '13:30', '16:30', '19:30', '22:00']
prices_by_type = {
    'Standard': 250,
    '4DX': 450,
    'IMAX': 550,
    'Gold': 700,
}

shows_created = 0
# Create shows for the next 14 days for each movie × theatre combination
for day_offset in range(0, 8):
    show_date = (now + timedelta(days=day_offset)).strftime('%Y-%m-%d')

    # Each movie gets shows at 2-3 theatres per day
    for movie_idx, movie_id in enumerate(movie_ids[:8]):
        theatre_id = theatre_ids[movie_idx % len(theatre_ids)]
        theatre_screens = screen_ids_by_theatre.get(theatre_id, [])
        if not theatre_screens:
            continue
        screen_id = theatre_screens[movie_idx % len(theatre_screens)]

        screen = screens_col.find_one({'_id': ObjectId(screen_id)})
        screen_type = screen.get('screen_type', 'Standard') if screen else 'Standard'
        price = prices_by_type.get(screen_type, 250)

        # 3 showtimes per movie per theatre per day
        for time_slot in show_times[:3]:
            movie = movies_col.find_one({'_id': ObjectId(movie_id)})
            duration = movie.get('duration', 120) if movie else 120
            start_h, start_m = map(int, time_slot.split(':'))
            total_end_m = start_h * 60 + start_m + duration
            end_h, end_m = divmod(total_end_m, 60)
            end_time = f"{end_h:02d}:{end_m:02d}"

            existing = shows_col.find_one({
                'movie_id': movie_id,
                'theatre_id': theatre_id,
                'screen_id': screen_id,
                'date': show_date,
                'start_time': time_slot,
            })
            if existing:
                continue

            show_doc = {
                'movie_id': movie_id,
                'theatre_id': theatre_id,
                'screen_id': screen_id,
                'date': show_date,
                'start_time': time_slot,
                'end_time': end_time,
                'price': price,
                'status': 'active',
                'booked_seats': [],
                'created_at': now,
                'updated_at': now,
            }
            shows_col.insert_one(show_doc)
            shows_created += 1

print(f"   Created {shows_created} new shows")

#  Indexes 

print("\n Creating indexes...")
try:
    from pymongo import ASCENDING
    users_col.create_index([('email', ASCENDING)], unique=True)
    sessions_col.create_index([('token', ASCENDING)], unique=True)
    movies_col.create_index([('title', ASCENDING)])
    movies_col.create_index([('genre', ASCENDING)])
    shows_col.create_index([('movie_id', ASCENDING)])
    shows_col.create_index([('theatre_id', ASCENDING)])
    bookings_col.create_index([('user_id', ASCENDING)])
    bookings_col.create_index([('booking_reference', ASCENDING)], unique=True, sparse=True)
    print("   Indexes created")
except Exception as e:
    print(f"    Index creation warning: {e}")

#  Summary 

print("\n" + "="*50)
print(" Database seeded successfully!")
print("="*50)
print(f"  Users:     {users_col.count_documents({})}")
print(f"  Movies:    {movies_col.count_documents({})}")
print(f"  Theatres:  {theatres_col.count_documents({})}")
print(f"  Screens:   {screens_col.count_documents({})}")
print(f"  Shows:     {shows_col.count_documents({})}")
print(f"  Bookings:  {bookings_col.count_documents({})}")
print()
print(" Demo Credentials:")
print("   Admin:    admin@movies.com / admin123")
print("   Customer: john@example.com / john123")
print("   Customer: jane@example.com / jane123")
print()
print(" Start the app:")
print("   cd backend && python manage.py runserver")
print("   cd frontend && python -m http.server 5000")
print("   Open: http://localhost:5000")

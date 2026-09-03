"""
views.py — All API endpoint handlers for the Movie Booking platform.

Endpoints:
  Auth:      /api/auth/register/, /api/auth/login/, /api/auth/logout/, /api/auth/profile/
  Movies:    /api/movies/, /api/movies/<id>/
  Theatres:  /api/theatres/, /api/theatres/<id>/
  Screens:   /api/screens/, /api/screens/<id>/
  Shows:     /api/shows/, /api/shows/<id>/, /api/shows/movie/<id>/, /api/shows/theatre/<id>/
  Seats:     /api/seats/<show_id>/, /api/seats/book/
  Bookings:  /api/bookings/, /api/bookings/<id>/, /api/bookings/<id>/cancel/
  Admin:     /api/admin/dashboard/, /api/admin/users/, /api/admin/users/<id>/
"""
import json
import re
import string
import random
import logging
from datetime import datetime, timezone

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from bson import ObjectId

from .db import (
    users_col, movies_col, theatres_col, screens_col,
    shows_col, bookings_col, sessions_col,
    serialize_doc, is_valid_object_id, to_object_id, create_indexes,
)
from .auth_helpers import (
    make_password, check_password, create_session,
    get_user_from_token, require_auth, require_admin,
)

logger = logging.getLogger(__name__)

# Ensure indexes exist (called when module is first imported)
try:
    create_indexes()
except Exception as e:
    logger.warning(f"Could not create indexes on startup: {e}")


# ── Utility helpers ───────────────────────────────────────────────────────────

def ok(data=None, message='Success', status=200, **extra):
    payload = {'success': True, 'message': message}
    if data is not None:
        payload['data'] = data
    payload.update(extra)
    return JsonResponse(payload, status=status)


def err(message='An error occurred', status=400, **extra):
    payload = {'success': False, 'message': message}
    payload.update(extra)
    return JsonResponse(payload, status=status)


def parse_body(request):
    try:
        return json.loads(request.body or '{}')
    except (json.JSONDecodeError, ValueError):
        return {}


def validate_email(email: str) -> bool:
    pattern = r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def generate_booking_ref() -> str:
    year = datetime.now().year
    letters = ''.join(random.choices(string.ascii_uppercase, k=2))
    digits = ''.join(random.choices(string.digits, k=4))
    return f"MB-{year}-{letters}{digits}"


# ═══════════════════════════════════════════════════════════════════════════════
# AUTH VIEWS
# ═══════════════════════════════════════════════════════════════════════════════

@csrf_exempt
def auth_register(request):
    if request.method != 'POST':
        return err('Method not allowed', 405)

    body = parse_body(request)
    name = body.get('name', '').strip()
    email = body.get('email', '').strip().lower()
    password = body.get('password', '')

    if not name:
        return err('Name is required')
    if not email:
        return err('Email is required')
    if not validate_email(email):
        return err('Invalid email address')
    if not password or len(password) < 6:
        return err('Password must be at least 6 characters')

    if users_col().find_one({'email': email}):
        return err('An account with this email already exists', 409)

    now = datetime.now(timezone.utc)
    user_doc = {
        'name': name,
        'email': email,
        'password_hash': make_password(password),
        'role': 'customer',
        'status': 'active',
        'created_at': now,
        'updated_at': now,
    }

    result = users_col().insert_one(user_doc)
    user_doc['_id'] = result.inserted_id

    token = create_session(str(result.inserted_id))
    user_safe = serialize_doc(user_doc)
    user_safe.pop('password_hash', None)

    return ok({'token': token, 'user': user_safe}, 'Registration successful', 201)


@csrf_exempt
def auth_login(request):
    if request.method != 'POST':
        return err('Method not allowed', 405)

    body = parse_body(request)
    email = body.get('email', '').strip().lower()
    password = body.get('password', '')

    if not email or not password:
        return err('Email and password are required')

    user = users_col().find_one({'email': email})
    if not user:
        return err('Invalid email or password', 401)

    if not check_password(password, user.get('password_hash', '')):
        return err('Invalid email or password', 401)

    if user.get('status') == 'blocked':
        return err('Your account has been blocked. Please contact support.', 403)

    token = create_session(str(user['_id']))
    user_safe = serialize_doc(user)
    user_safe.pop('password_hash', None)

    return ok({'token': token, 'user': user_safe}, 'Login successful')


@csrf_exempt
@require_auth
def auth_logout(request):
    if request.method != 'POST':
        return err('Method not allowed', 405)

    sessions_col().delete_one({'token': request.token})
    return ok(message='Logged out successfully')


@csrf_exempt
@require_auth
def auth_profile(request):
    if request.method == 'GET':
        user = serialize_doc(
            users_col().find_one({'_id': to_object_id(request.user['_id'])})
        )
        if not user:
            return err('User not found', 404)
        user.pop('password_hash', None)
        return ok(user)

    elif request.method == 'PUT':
        body = parse_body(request)
        update_fields = {}

        if 'name' in body and body['name'].strip():
            update_fields['name'] = body['name'].strip()
        if 'email' in body:
            new_email = body['email'].strip().lower()
            if not validate_email(new_email):
                return err('Invalid email address')
            existing = users_col().find_one({'email': new_email})
            if existing and str(existing['_id']) != request.user['_id']:
                return err('Email already in use by another account', 409)
            update_fields['email'] = new_email
        if 'password' in body and body['password']:
            if len(body['password']) < 6:
                return err('Password must be at least 6 characters')
            update_fields['password_hash'] = make_password(body['password'])

        if not update_fields:
            return err('No valid fields to update')

        update_fields['updated_at'] = datetime.now(timezone.utc)
        users_col().update_one(
            {'_id': to_object_id(request.user['_id'])},
            {'$set': update_fields}
        )
        updated = serialize_doc(
            users_col().find_one({'_id': to_object_id(request.user['_id'])})
        )
        updated.pop('password_hash', None)
        return ok(updated, 'Profile updated successfully')

    return err('Method not allowed', 405)


# ═══════════════════════════════════════════════════════════════════════════════
# MOVIES
# ═══════════════════════════════════════════════════════════════════════════════

@csrf_exempt
def movies_list(request):
    if request.method == 'GET':
        query = {}
        search = request.GET.get('search', '').strip()
        genre = request.GET.get('genre', '').strip()
        language = request.GET.get('language', '').strip()
        status = request.GET.get('status', '').strip()

        if search:
            query['$or'] = [
                {'title': {'$regex': search, '$options': 'i'}},
                {'director': {'$regex': search, '$options': 'i'}},
                {'cast': {'$regex': search, '$options': 'i'}},
            ]
        if genre:
            query['genre'] = {'$regex': f'^{genre}$', '$options': 'i'}
        if language:
            query['language'] = {'$regex': f'^{language}$', '$options': 'i'}
        if status:
            query['status'] = status

        movies = list(movies_col().find(query).sort('created_at', -1))
        return ok(serialize_doc(movies))

    elif request.method == 'POST':
        # Admin-only
        token = request.headers.get('Authorization', '')[7:]
        user = get_user_from_token(token)
        if not user or user.get('role') != 'admin':
            return err('Admin access required', 403)

        body = parse_body(request)
        required = ['title', 'genre', 'language', 'duration']
        for field in required:
            if not body.get(field):
                return err(f'{field} is required')

        now = datetime.now(timezone.utc)
        movie_doc = {
            'title': body.get('title', '').strip(),
            'description': body.get('description', '').strip(),
            'genre': body.get('genre', '').strip(),
            'language': body.get('language', '').strip(),
            'duration': int(body.get('duration', 0)),
            'rating': float(body.get('rating', 0)),
            'release_date': body.get('release_date', ''),
            'poster': body.get('poster', ''),
            'banner': body.get('banner', ''),
            'trailer': body.get('trailer', ''),
            'cast': body.get('cast', []),
            'director': body.get('director', ''),
            'status': body.get('status', 'latest'),
            'created_at': now,
            'updated_at': now,
        }
        result = movies_col().insert_one(movie_doc)
        movie_doc['_id'] = result.inserted_id
        return ok(serialize_doc(movie_doc), 'Movie created successfully', 201)

    return err('Method not allowed', 405)


@csrf_exempt
def movie_detail(request, movie_id):
    if not is_valid_object_id(movie_id):
        return err('Invalid movie ID', 400)

    movie = movies_col().find_one({'_id': to_object_id(movie_id)})
    if not movie:
        return err('Movie not found', 404)

    if request.method == 'GET':
        return ok(serialize_doc(movie))

    # PUT / DELETE require admin
    token = request.headers.get('Authorization', '')[7:]
    user = get_user_from_token(token)
    if not user or user.get('role') != 'admin':
        return err('Admin access required', 403)

    if request.method == 'PUT':
        body = parse_body(request)
        update_fields = {}
        editable = ['title', 'description', 'genre', 'language', 'duration',
                    'rating', 'release_date', 'poster', 'banner', 'trailer',
                    'cast', 'director', 'status']
        for field in editable:
            if field in body:
                update_fields[field] = body[field]
        update_fields['updated_at'] = datetime.now(timezone.utc)
        movies_col().update_one({'_id': to_object_id(movie_id)}, {'$set': update_fields})
        updated = serialize_doc(movies_col().find_one({'_id': to_object_id(movie_id)}))
        return ok(updated, 'Movie updated successfully')

    elif request.method == 'DELETE':
        movies_col().delete_one({'_id': to_object_id(movie_id)})
        return ok(message='Movie deleted successfully')

    return err('Method not allowed', 405)


# ═══════════════════════════════════════════════════════════════════════════════
# THEATRES
# ═══════════════════════════════════════════════════════════════════════════════

@csrf_exempt
def theatres_list(request):
    if request.method == 'GET':
        theatres = list(theatres_col().find({}).sort('name', 1))
        return ok(serialize_doc(theatres))

    token = request.headers.get('Authorization', '')[7:]
    user = get_user_from_token(token)
    if not user or user.get('role') != 'admin':
        return err('Admin access required', 403)

    if request.method == 'POST':
        body = parse_body(request)
        if not body.get('name') or not body.get('city'):
            return err('Name and city are required')

        now = datetime.now(timezone.utc)
        theatre_doc = {
            'name': body.get('name', '').strip(),
            'location': body.get('location', '').strip(),
            'city': body.get('city', '').strip(),
            'address': body.get('address', '').strip(),
            'screens': int(body.get('screens', 1)),
            'status': body.get('status', 'active'),
            'created_at': now,
            'updated_at': now,
        }
        result = theatres_col().insert_one(theatre_doc)
        theatre_doc['_id'] = result.inserted_id
        return ok(serialize_doc(theatre_doc), 'Theatre created successfully', 201)

    return err('Method not allowed', 405)


@csrf_exempt
def theatre_detail(request, theatre_id):
    if not is_valid_object_id(theatre_id):
        return err('Invalid theatre ID', 400)

    theatre = theatres_col().find_one({'_id': to_object_id(theatre_id)})
    if not theatre:
        return err('Theatre not found', 404)

    if request.method == 'GET':
        return ok(serialize_doc(theatre))

    token = request.headers.get('Authorization', '')[7:]
    user = get_user_from_token(token)
    if not user or user.get('role') != 'admin':
        return err('Admin access required', 403)

    if request.method == 'PUT':
        body = parse_body(request)
        update_fields = {}
        for field in ['name', 'location', 'city', 'address', 'screens', 'status']:
            if field in body:
                update_fields[field] = body[field]
        update_fields['updated_at'] = datetime.now(timezone.utc)
        theatres_col().update_one({'_id': to_object_id(theatre_id)}, {'$set': update_fields})
        updated = serialize_doc(theatres_col().find_one({'_id': to_object_id(theatre_id)}))
        return ok(updated, 'Theatre updated successfully')

    elif request.method == 'DELETE':
        theatres_col().delete_one({'_id': to_object_id(theatre_id)})
        return ok(message='Theatre deleted successfully')

    return err('Method not allowed', 405)


# ═══════════════════════════════════════════════════════════════════════════════
# SCREENS
# ═══════════════════════════════════════════════════════════════════════════════

@csrf_exempt
def screens_list(request):
    if request.method == 'GET':
        theatre_id = request.GET.get('theatre_id', '')
        query = {}
        if theatre_id and is_valid_object_id(theatre_id):
            query['theatre_id'] = theatre_id
        screens = list(screens_col().find(query).sort('name', 1))
        return ok(serialize_doc(screens))

    token = request.headers.get('Authorization', '')[7:]
    user = get_user_from_token(token)
    if not user or user.get('role') != 'admin':
        return err('Admin access required', 403)

    if request.method == 'POST':
        body = parse_body(request)
        required = ['theatre_id', 'name', 'rows', 'seats_per_row']
        for field in required:
            if not body.get(field):
                return err(f'{field} is required')

        if not is_valid_object_id(body['theatre_id']):
            return err('Invalid theatre_id')
        if not theatres_col().find_one({'_id': to_object_id(body['theatre_id'])}):
            return err('Theatre not found', 404)

        rows = int(body.get('rows', 10))
        seats_per_row = int(body.get('seats_per_row', 10))
        now = datetime.now(timezone.utc)
        screen_doc = {
            'theatre_id': body['theatre_id'],
            'name': body['name'].strip(),
            'rows': rows,
            'seats_per_row': seats_per_row,
            'total_seats': rows * seats_per_row,
            'screen_type': body.get('screen_type', 'Standard'),
            'created_at': now,
            'updated_at': now,
        }
        result = screens_col().insert_one(screen_doc)
        screen_doc['_id'] = result.inserted_id
        return ok(serialize_doc(screen_doc), 'Screen created successfully', 201)

    return err('Method not allowed', 405)


@csrf_exempt
def screen_detail(request, screen_id):
    if not is_valid_object_id(screen_id):
        return err('Invalid screen ID', 400)

    screen = screens_col().find_one({'_id': to_object_id(screen_id)})
    if not screen:
        return err('Screen not found', 404)

    if request.method == 'GET':
        return ok(serialize_doc(screen))

    token = request.headers.get('Authorization', '')[7:]
    user = get_user_from_token(token)
    if not user or user.get('role') != 'admin':
        return err('Admin access required', 403)

    if request.method == 'PUT':
        body = parse_body(request)
        update_fields = {}
        for field in ['name', 'rows', 'seats_per_row', 'screen_type']:
            if field in body:
                update_fields[field] = body[field]
        if 'rows' in update_fields or 'seats_per_row' in update_fields:
            rows = int(update_fields.get('rows', screen['rows']))
            spr = int(update_fields.get('seats_per_row', screen['seats_per_row']))
            update_fields['rows'] = rows
            update_fields['seats_per_row'] = spr
            update_fields['total_seats'] = rows * spr
        update_fields['updated_at'] = datetime.now(timezone.utc)
        screens_col().update_one({'_id': to_object_id(screen_id)}, {'$set': update_fields})
        updated = serialize_doc(screens_col().find_one({'_id': to_object_id(screen_id)}))
        return ok(updated, 'Screen updated successfully')

    elif request.method == 'DELETE':
        screens_col().delete_one({'_id': to_object_id(screen_id)})
        return ok(message='Screen deleted successfully')

    return err('Method not allowed', 405)


# ═══════════════════════════════════════════════════════════════════════════════
# SHOWS
# ═══════════════════════════════════════════════════════════════════════════════

@csrf_exempt
def shows_list(request):
    if request.method == 'GET':
        query = {}
        movie_id = request.GET.get('movie_id', '')
        theatre_id = request.GET.get('theatre_id', '')
        date = request.GET.get('date', '')
        if movie_id and is_valid_object_id(movie_id):
            query['movie_id'] = movie_id
        if theatre_id and is_valid_object_id(theatre_id):
            query['theatre_id'] = theatre_id
        if date:
            query['date'] = date
        shows = list(shows_col().find(query).sort('date', 1))
        return ok(serialize_doc(shows))

    token = request.headers.get('Authorization', '')[7:]
    user = get_user_from_token(token)
    if not user or user.get('role') != 'admin':
        return err('Admin access required', 403)

    if request.method == 'POST':
        body = parse_body(request)
        required = ['movie_id', 'theatre_id', 'screen_id', 'date', 'start_time', 'price']
        for field in required:
            if not body.get(field):
                return err(f'{field} is required')

        for ref_field, col, label in [
            ('movie_id', movies_col(), 'Movie'),
            ('theatre_id', theatres_col(), 'Theatre'),
            ('screen_id', screens_col(), 'Screen'),
        ]:
            ref_id = body[ref_field]
            if not is_valid_object_id(ref_id):
                return err(f'Invalid {ref_field}')
            if not col.find_one({'_id': to_object_id(ref_id)}):
                return err(f'{label} not found', 404)

        now = datetime.now(timezone.utc)
        show_doc = {
            'movie_id': body['movie_id'],
            'theatre_id': body['theatre_id'],
            'screen_id': body['screen_id'],
            'date': body['date'],
            'start_time': body['start_time'],
            'end_time': body.get('end_time', ''),
            'price': float(body['price']),
            'status': body.get('status', 'active'),
            'booked_seats': [],
            'created_at': now,
            'updated_at': now,
        }
        result = shows_col().insert_one(show_doc)
        show_doc['_id'] = result.inserted_id
        return ok(serialize_doc(show_doc), 'Show created successfully', 201)

    return err('Method not allowed', 405)


@csrf_exempt
def show_detail(request, show_id):
    if not is_valid_object_id(show_id):
        return err('Invalid show ID', 400)

    show = shows_col().find_one({'_id': to_object_id(show_id)})
    if not show:
        return err('Show not found', 404)

    if request.method == 'GET':
        return ok(serialize_doc(show))

    token = request.headers.get('Authorization', '')[7:]
    user = get_user_from_token(token)
    if not user or user.get('role') != 'admin':
        return err('Admin access required', 403)

    if request.method == 'PUT':
        body = parse_body(request)
        update_fields = {}
        for field in ['date', 'start_time', 'end_time', 'price', 'status']:
            if field in body:
                update_fields[field] = body[field]
        update_fields['updated_at'] = datetime.now(timezone.utc)
        shows_col().update_one({'_id': to_object_id(show_id)}, {'$set': update_fields})
        updated = serialize_doc(shows_col().find_one({'_id': to_object_id(show_id)}))
        return ok(updated, 'Show updated successfully')

    elif request.method == 'DELETE':
        shows_col().delete_one({'_id': to_object_id(show_id)})
        return ok(message='Show deleted successfully')

    return err('Method not allowed', 405)


@csrf_exempt
def shows_by_movie(request, movie_id):
    if not is_valid_object_id(movie_id):
        return err('Invalid movie ID', 400)
    shows = list(shows_col().find({'movie_id': movie_id, 'status': 'active'}).sort('date', 1))
    return ok(serialize_doc(shows))


@csrf_exempt
def shows_by_theatre(request, theatre_id):
    if not is_valid_object_id(theatre_id):
        return err('Invalid theatre ID', 400)
    shows = list(shows_col().find({'theatre_id': theatre_id, 'status': 'active'}).sort('date', 1))
    return ok(serialize_doc(shows))


# ═══════════════════════════════════════════════════════════════════════════════
# SEATS
# ═══════════════════════════════════════════════════════════════════════════════

ROW_LABELS = list('ABCDEFGHIJ')


@csrf_exempt
def seat_layout(request, show_id):
    if not is_valid_object_id(show_id):
        return err('Invalid show ID', 400)

    show = shows_col().find_one({'_id': to_object_id(show_id)})
    if not show:
        return err('Show not found', 404)

    screen = screens_col().find_one({'_id': to_object_id(show['screen_id'])})
    if not screen:
        return err('Screen configuration not found', 404)

    rows_count = int(screen.get('rows', 10))
    seats_per_row = int(screen.get('seats_per_row', 10))
    row_labels = ROW_LABELS[:rows_count]

    booked_seats = show.get('booked_seats', [])

    # Build all seat identifiers
    all_seats = []
    for row in row_labels:
        for col in range(1, seats_per_row + 1):
            all_seats.append(f"{row}{col}")

    available_seats = [s for s in all_seats if s not in booked_seats]

    return ok({
        'show_id': str(show['_id']),
        'rows': row_labels,
        'seats_per_row': seats_per_row,
        'total_seats': rows_count * seats_per_row,
        'booked_seats': booked_seats,
        'available_seats': available_seats,
        'price': show.get('price', 0),
    })


@csrf_exempt
@require_auth
def book_seats(request):
    if request.method != 'POST':
        return err('Method not allowed', 405)

    body = parse_body(request)
    show_id = body.get('show_id', '')
    seat_numbers = body.get('seat_numbers', [])

    if not show_id or not is_valid_object_id(show_id):
        return err('Valid show_id is required')
    if not seat_numbers or not isinstance(seat_numbers, list):
        return err('seat_numbers must be a non-empty list')
    if len(seat_numbers) == 0:
        return err('Select at least one seat')
    if len(seat_numbers) > 10:
        return err('Cannot book more than 10 seats at once')

    # Normalize seat numbers
    seat_numbers = [str(s).upper().strip() for s in seat_numbers]

    show = shows_col().find_one({'_id': to_object_id(show_id)})
    if not show:
        return err('Show not found', 404)

    if show.get('status') != 'active':
        return err('This show is not available for booking')

    screen = screens_col().find_one({'_id': to_object_id(show['screen_id'])})
    if not screen:
        return err('Screen not found', 404)

    # Validate seat identifiers against screen layout
    rows_count = int(screen.get('rows', 10))
    seats_per_row = int(screen.get('seats_per_row', 10))
    valid_row_labels = set(ROW_LABELS[:rows_count])

    for seat in seat_numbers:
        if len(seat) < 2:
            return err(f'Invalid seat: {seat}')
        row = seat[0]
        try:
            col = int(seat[1:])
        except ValueError:
            return err(f'Invalid seat number: {seat}')
        if row not in valid_row_labels or col < 1 or col > seats_per_row:
            return err(f'Seat {seat} does not exist in this screen')

    # Atomic check-and-book to prevent double booking
    # Use $addToSet-style atomic update with a condition
    current_show = shows_col().find_one({'_id': to_object_id(show_id)})
    already_booked = set(current_show.get('booked_seats', []))
    conflicts = [s for s in seat_numbers if s in already_booked]
    if conflicts:
        return err(f'Seats already booked: {", ".join(conflicts)}', 409)

    # Atomic update — only succeeds if none of the seats are in booked_seats
    result = shows_col().update_one(
        {
            '_id': to_object_id(show_id),
            'booked_seats': {'$not': {'$elemMatch': {'$in': seat_numbers}}},
        },
        {'$addToSet': {'booked_seats': {'$each': seat_numbers}}}
    )

    if result.modified_count == 0:
        return err('One or more seats were just booked by another user. Please refresh and try again.', 409)

    # Create booking record
    price_per_ticket = float(show.get('price', 0))
    total_amount = price_per_ticket * len(seat_numbers)
    now = datetime.now(timezone.utc)

    booking_ref = generate_booking_ref()
    # Ensure uniqueness
    while bookings_col().find_one({'booking_reference': booking_ref}):
        booking_ref = generate_booking_ref()

    booking_doc = {
        'user_id': request.user['_id'],
        'movie_id': show['movie_id'],
        'theatre_id': show['theatre_id'],
        'screen_id': show['screen_id'],
        'show_id': show_id,
        'seat_numbers': seat_numbers,
        'ticket_count': len(seat_numbers),
        'price_per_ticket': price_per_ticket,
        'total_amount': total_amount,
        'booking_date': now,
        'status': 'confirmed',
        'booking_reference': booking_ref,
        'created_at': now,
        'updated_at': now,
    }

    booking_result = bookings_col().insert_one(booking_doc)
    booking_doc['_id'] = booking_result.inserted_id

    # Enrich with movie/theatre/screen/show details
    movie = movies_col().find_one({'_id': to_object_id(show['movie_id'])}) or {}
    theatre = theatres_col().find_one({'_id': to_object_id(show['theatre_id'])}) or {}
    screen_doc = screens_col().find_one({'_id': to_object_id(show['screen_id'])}) or {}

    enriched = serialize_doc(booking_doc)
    enriched['movie'] = {'title': movie.get('title', ''), 'poster': movie.get('poster', '')}
    enriched['theatre'] = {'name': theatre.get('name', ''), 'city': theatre.get('city', '')}
    enriched['screen'] = {'name': screen_doc.get('name', '')}
    enriched['show'] = {'date': show.get('date', ''), 'start_time': show.get('start_time', '')}

    return ok(enriched, 'Booking confirmed successfully', 201)


# ═══════════════════════════════════════════════════════════════════════════════
# BOOKINGS
# ═══════════════════════════════════════════════════════════════════════════════

@csrf_exempt
@require_auth
def bookings_list(request):
    if request.method == 'GET':
        user = request.user
        if user['role'] == 'admin':
            bookings = list(bookings_col().find({}).sort('created_at', -1))
        else:
            bookings = list(bookings_col().find({'user_id': user['_id']}).sort('created_at', -1))

        # Enrich bookings with movie/theatre info
        enriched = []
        for b in bookings:
            b_s = serialize_doc(b)
            try:
                movie = movies_col().find_one({'_id': to_object_id(b['movie_id'])}) or {}
                theatre = theatres_col().find_one({'_id': to_object_id(b['theatre_id'])}) or {}
                screen = screens_col().find_one({'_id': to_object_id(b['screen_id'])}) or {}
                show = shows_col().find_one({'_id': to_object_id(b['show_id'])}) or {}
                b_s['movie'] = {'title': movie.get('title', ''), 'poster': movie.get('poster', ''), 'genre': movie.get('genre', '')}
                b_s['theatre'] = {'name': theatre.get('name', ''), 'city': theatre.get('city', '')}
                b_s['screen'] = {'name': screen.get('name', '')}
                b_s['show'] = {'date': show.get('date', ''), 'start_time': show.get('start_time', '')}
            except Exception:
                pass
            enriched.append(b_s)

        return ok(enriched)

    return err('Method not allowed', 405)


@csrf_exempt
@require_auth
def booking_detail(request, booking_id):
    if not is_valid_object_id(booking_id):
        return err('Invalid booking ID', 400)

    booking = bookings_col().find_one({'_id': to_object_id(booking_id)})
    if not booking:
        return err('Booking not found', 404)

    # Customers can only view their own bookings
    if request.user['role'] != 'admin' and booking['user_id'] != request.user['_id']:
        return err('Access denied', 403)

    if request.method == 'GET':
        b_s = serialize_doc(booking)
        try:
            movie = movies_col().find_one({'_id': to_object_id(booking['movie_id'])}) or {}
            theatre = theatres_col().find_one({'_id': to_object_id(booking['theatre_id'])}) or {}
            screen = screens_col().find_one({'_id': to_object_id(booking['screen_id'])}) or {}
            show = shows_col().find_one({'_id': to_object_id(booking['show_id'])}) or {}
            b_s['movie'] = serialize_doc(movie)
            b_s['theatre'] = serialize_doc(theatre)
            b_s['screen'] = serialize_doc(screen)
            b_s['show'] = serialize_doc(show)
        except Exception:
            pass
        return ok(b_s)

    if request.method == 'PUT':
        if request.user['role'] != 'admin':
            return err('Admin access required', 403)
        body = parse_body(request)
        update_fields = {}
        if 'status' in body:
            update_fields['status'] = body['status']
        update_fields['updated_at'] = datetime.now(timezone.utc)
        bookings_col().update_one({'_id': to_object_id(booking_id)}, {'$set': update_fields})
        updated = serialize_doc(bookings_col().find_one({'_id': to_object_id(booking_id)}))
        return ok(updated, 'Booking updated successfully')

    if request.method == 'DELETE':
        if request.user['role'] != 'admin':
            return err('Admin access required', 403)
        bookings_col().delete_one({'_id': to_object_id(booking_id)})
        return ok(message='Booking deleted successfully')

    return err('Method not allowed', 405)


@csrf_exempt
@require_auth
def cancel_booking(request, booking_id):
    if request.method != 'POST':
        return err('Method not allowed', 405)

    if not is_valid_object_id(booking_id):
        return err('Invalid booking ID', 400)

    booking = bookings_col().find_one({'_id': to_object_id(booking_id)})
    if not booking:
        return err('Booking not found', 404)

    if request.user['role'] != 'admin' and booking['user_id'] != request.user['_id']:
        return err('Access denied', 403)

    if booking.get('status') == 'cancelled':
        return err('Booking is already cancelled')

    if booking.get('status') == 'completed':
        return err('Completed bookings cannot be cancelled')

    # Release seats back to show
    seat_numbers = booking.get('seat_numbers', [])
    if seat_numbers:
        shows_col().update_one(
            {'_id': to_object_id(booking['show_id'])},
            {'$pull': {'booked_seats': {'$in': seat_numbers}}}
        )

    now = datetime.now(timezone.utc)
    bookings_col().update_one(
        {'_id': to_object_id(booking_id)},
        {'$set': {'status': 'cancelled', 'cancelled_at': now, 'updated_at': now}}
    )

    return ok(message='Booking cancelled successfully. Seats have been released.')


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN
# ═══════════════════════════════════════════════════════════════════════════════

@csrf_exempt
@require_admin
def admin_dashboard(request):
    if request.method != 'GET':
        return err('Method not allowed', 405)

    now = datetime.now(timezone.utc)
    today_str = now.strftime('%Y-%m-%d')
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Revenue aggregation
    pipeline_today = [
        {'$match': {'status': 'confirmed', 'booking_date': {'$gte': datetime(now.year, now.month, now.day, tzinfo=timezone.utc)}}},
        {'$group': {'_id': None, 'total': {'$sum': '$total_amount'}}}
    ]
    pipeline_monthly = [
        {'$match': {'status': 'confirmed', 'booking_date': {'$gte': month_start}}},
        {'$group': {'_id': None, 'total': {'$sum': '$total_amount'}}}
    ]

    today_result = list(bookings_col().aggregate(pipeline_today))
    monthly_result = list(bookings_col().aggregate(pipeline_monthly))

    today_revenue = today_result[0]['total'] if today_result else 0
    monthly_revenue = monthly_result[0]['total'] if monthly_result else 0

    # Top movies by booking count
    top_movies_pipeline = [
        {'$match': {'status': {'$in': ['confirmed', 'completed']}}},
        {'$group': {'_id': '$movie_id', 'count': {'$sum': '$ticket_count'}, 'revenue': {'$sum': '$total_amount'}}},
        {'$sort': {'count': -1}},
        {'$limit': 5},
    ]
    top_movies_raw = list(bookings_col().aggregate(top_movies_pipeline))
    top_movies = []
    for tm in top_movies_raw:
        movie = movies_col().find_one({'_id': to_object_id(tm['_id'])}) if is_valid_object_id(tm['_id']) else None
        top_movies.append({
            'movie_id': tm['_id'],
            'title': movie.get('title', 'Unknown') if movie else 'Unknown',
            'poster': movie.get('poster', '') if movie else '',
            'tickets_sold': tm['count'],
            'revenue': tm['revenue'],
        })

    data = {
        'total_movies': movies_col().count_documents({}),
        'total_theatres': theatres_col().count_documents({}),
        'total_screens': screens_col().count_documents({}),
        'total_shows': shows_col().count_documents({}),
        'total_bookings': bookings_col().count_documents({}),
        'total_users': users_col().count_documents({'role': 'customer'}),
        'today_revenue': today_revenue,
        'monthly_revenue': monthly_revenue,
        'top_movies': top_movies,
    }
    return ok(data)


@csrf_exempt
@require_admin
def admin_users(request):
    if request.method == 'GET':
        users = list(users_col().find({}).sort('created_at', -1))
        safe_users = []
        for u in users:
            u_s = serialize_doc(u)
            u_s.pop('password_hash', None)
            safe_users.append(u_s)
        return ok(safe_users)

    return err('Method not allowed', 405)


@csrf_exempt
@require_admin
def admin_user_detail(request, user_id):
    if not is_valid_object_id(user_id):
        return err('Invalid user ID', 400)

    user = users_col().find_one({'_id': to_object_id(user_id)})
    if not user:
        return err('User not found', 404)

    if request.method == 'GET':
        u_s = serialize_doc(user)
        u_s.pop('password_hash', None)
        bookings = list(bookings_col().find({'user_id': str(user['_id'])}).sort('created_at', -1))
        u_s['bookings'] = serialize_doc(bookings)
        return ok(u_s)

    if request.method == 'PUT':
        body = parse_body(request)
        update_fields = {}
        if 'status' in body and body['status'] in ['active', 'blocked']:
            update_fields['status'] = body['status']
        if 'role' in body and body['role'] in ['customer', 'admin']:
            update_fields['role'] = body['role']
        if not update_fields:
            return err('No valid fields to update')
        update_fields['updated_at'] = datetime.now(timezone.utc)
        users_col().update_one({'_id': to_object_id(user_id)}, {'$set': update_fields})
        updated = serialize_doc(users_col().find_one({'_id': to_object_id(user_id)}))
        updated.pop('password_hash', None)
        return ok(updated, 'User updated successfully')

    if request.method == 'DELETE':
        # Don't allow deleting yourself
        if str(user['_id']) == request.user['_id']:
            return err('Cannot delete your own account')
        users_col().delete_one({'_id': to_object_id(user_id)})
        sessions_col().delete_many({'user_id': str(user['_id'])})
        return ok(message='User deleted successfully')

    return err('Method not allowed', 405)

"""
auth_helpers.py — Authentication and authorization utilities.

Provides:
  - make_password / check_password  (Django hashing)
  - create_session                  (secure token generation)
  - get_user_from_token             (token → user lookup)
  - require_auth                    (decorator for protected views)
  - require_admin                   (decorator for admin-only views)
"""
import secrets
import logging
from datetime import datetime, timedelta, timezone
from functools import wraps

from django.contrib.auth.hashers import (
    make_password as django_make_password,
    check_password as django_check_password,
)
from django.http import JsonResponse

from .db import users_col, sessions_col, serialize_doc

logger = logging.getLogger(__name__)

# Token TTL — 30 days
SESSION_DURATION_DAYS = 30


# ── Password helpers ──────────────────────────────────────────────────────────

def make_password(plain_password: str) -> str:
    """Hash a plaintext password using Django's PBKDF2."""
    return django_make_password(plain_password)


def check_password(plain_password: str, hashed: str) -> bool:
    """Verify a plaintext password against a stored hash."""
    return django_check_password(plain_password, hashed)


# ── Session helpers ───────────────────────────────────────────────────────────

def create_session(user_id: str) -> str:
    """
    Generate a secure random token, store it in the sessions collection,
    and return the token string.
    """
    token = secrets.token_urlsafe(48)
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_DURATION_DAYS)

    sessions_col().insert_one({
        'token': token,
        'user_id': user_id,
        'created_at': datetime.now(timezone.utc),
        'expires_at': expires_at,
    })
    return token


def get_user_from_token(token: str):
    """
    Validate a Bearer token and return the corresponding user document.
    Returns None if the token is invalid, expired, or the user does not exist.
    """
    if not token:
        return None

    session = sessions_col().find_one({'token': token})
    if not session:
        return None

    # Check expiry
    expires_at = session.get('expires_at')
    if expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires_at:
            sessions_col().delete_one({'token': token})
            return None

    from bson import ObjectId
    user = users_col().find_one({'_id': ObjectId(session['user_id'])})
    return user


def _extract_token(request) -> str:
    """Extract Bearer token from Authorization header."""
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header[7:].strip()
    return ''


# ── View decorators ───────────────────────────────────────────────────────────

def require_auth(view_func):
    """
    Decorator that protects a view by requiring a valid Bearer token.
    Injects `request.user` (the MongoDB user document) on success.
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        token = _extract_token(request)
        user = get_user_from_token(token)

        if not user:
            return JsonResponse(
                {'success': False, 'message': 'Authentication required. Please login.'},
                status=401
            )

        if user.get('status') == 'blocked':
            return JsonResponse(
                {'success': False, 'message': 'Your account has been blocked. Contact support.'},
                status=403
            )

        request.user = serialize_doc(user)
        request.token = token
        return view_func(request, *args, **kwargs)

    return wrapper


def require_admin(view_func):
    """
    Decorator that protects a view, requiring a valid token AND admin role.
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        token = _extract_token(request)
        user = get_user_from_token(token)

        if not user:
            return JsonResponse(
                {'success': False, 'message': 'Authentication required. Please login.'},
                status=401
            )

        if user.get('status') == 'blocked':
            return JsonResponse(
                {'success': False, 'message': 'Your account has been blocked.'},
                status=403
            )

        if user.get('role') != 'admin':
            return JsonResponse(
                {'success': False, 'message': 'Admin access required.'},
                status=403
            )

        request.user = serialize_doc(user)
        request.token = token
        return view_func(request, *args, **kwargs)

    return wrapper

from django.urls import path
from . import views

urlpatterns = [
    # ── Auth ──────────────────────────────────────────────────────────────────
    path('auth/register/', views.auth_register, name='auth-register'),
    path('auth/login/', views.auth_login, name='auth-login'),
    path('auth/logout/', views.auth_logout, name='auth-logout'),
    path('auth/profile/', views.auth_profile, name='auth-profile'),

    # ── Movies ────────────────────────────────────────────────────────────────
    path('movies/', views.movies_list, name='movies-list'),
    path('movies/<str:movie_id>/', views.movie_detail, name='movie-detail'),

    # ── Theatres ──────────────────────────────────────────────────────────────
    path('theatres/', views.theatres_list, name='theatres-list'),
    path('theatres/<str:theatre_id>/', views.theatre_detail, name='theatre-detail'),

    # ── Screens ───────────────────────────────────────────────────────────────
    path('screens/', views.screens_list, name='screens-list'),
    path('screens/<str:screen_id>/', views.screen_detail, name='screen-detail'),

    # ── Shows ─────────────────────────────────────────────────────────────────
    path('shows/', views.shows_list, name='shows-list'),
    path('shows/movie/<str:movie_id>/', views.shows_by_movie, name='shows-by-movie'),
    path('shows/theatre/<str:theatre_id>/', views.shows_by_theatre, name='shows-by-theatre'),
    path('shows/<str:show_id>/', views.show_detail, name='show-detail'),

    # ── Seats ─────────────────────────────────────────────────────────────────
    path('seats/book/', views.book_seats, name='book-seats'),
    path('seats/<str:show_id>/', views.seat_layout, name='seat-layout'),

    # ── Bookings ──────────────────────────────────────────────────────────────
    path('bookings/', views.bookings_list, name='bookings-list'),
    path('bookings/<str:booking_id>/cancel/', views.cancel_booking, name='booking-cancel'),
    path('bookings/<str:booking_id>/', views.booking_detail, name='booking-detail'),

    # ── Admin ─────────────────────────────────────────────────────────────────
    path('admin/dashboard/', views.admin_dashboard, name='admin-dashboard'),
    path('admin/users/', views.admin_users, name='admin-users'),
    path('admin/users/<str:user_id>/', views.admin_user_detail, name='admin-user-detail'),
]

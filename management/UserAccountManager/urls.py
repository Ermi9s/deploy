'''URL configuration for UserAccountManager app.'''
from rest_framework_simplejwt.views import TokenRefreshView
from django.urls import path
from .views import (
    SignUPView,
    GoogleOAuth2RedirectView,
    GoogleOAuth2CallbackView,
    CustomTokenObtainPairView,
    ProfileView,
    ProfilePicUploadView,
    UserDetailView,
    UserMeView,
    ForgotPasswordView,
    ResetPasswordView,
    DepartmentListView,
    DepartmentDetailView,
)

urlpatterns = [
    # Authentication
    path('signup/', SignUPView.as_view(), name='sign-up'),
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset-password'),

    # Social authentication
    path('oauth/google/redirect/', GoogleOAuth2RedirectView.as_view(), name='google-oauth'),
    path('oauth/google/callback/', GoogleOAuth2CallbackView.as_view(), name='google-redirect'),

    # Profile management
    path('profile/', ProfileView.as_view(), name='profile'),
    path('profile/picture/', ProfilePicUploadView.as_view(), name='profile-picture'),

    # User management
    path('me/', UserMeView.as_view(), name='user-me'),
    path('user/', UserDetailView.as_view(), name='user-detail'),

    # MAC reference data — read-only for all authenticated users
    path('departments/', DepartmentListView.as_view(), name='department-list'),
    path('departments/<int:pk>/', DepartmentDetailView.as_view(), name='department-detail'),
]


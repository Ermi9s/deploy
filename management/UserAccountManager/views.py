'''User account management views with Swagger annotations'''
from rest_framework import generics, status, serializers
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes

from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str

import logging

from .serializers import (
    UserSerializer,
    UserUpdateSerializer,
    ProfileSerializer,
    ProfileUpdateSerializer,
    ProfilePicSerializer,
    CustomTokenObtainPairSerializer,
    DepartmentSerializer,
    SignupRequestSerializer,
    SignupResponseSerializer,
    LoginRequestSerializer,
    LoginResponseSerializer,
    ForgotPasswordRequestSerializer,
    ResetPasswordSerializer,
)
from .models import Department
from .permissions import IsOwnerOrSuperuser
from .services import GoogleOAuth2Service

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Auth Views
# ---------------------------------------------------------------------------

@extend_schema(
    summary='Create A New User (Signup)',
    description=(
        'Register a new user with email and password. '
        'A profile is automatically created for the user.'
    ),
    request=SignupRequestSerializer,
    responses={201: SignupResponseSerializer},
    tags=['Authentication'],
)
class SignUPView(generics.CreateAPIView):
    '''Local signup view – creates user + profile.'''
    authentication_classes = []
    permission_classes = [AllowAny]
    serializer_class = UserSerializer


@extend_schema(
    summary='Login User',
    description='Authenticate with email and password to receive JWT tokens and user information.',
    request=LoginRequestSerializer,
    responses={200: LoginResponseSerializer},
    tags=['Authentication'],
)
class CustomTokenObtainPairView(TokenObtainPairView):
    '''User login view – returns JWT tokens + user info.'''
    serializer_class = CustomTokenObtainPairSerializer


# ---------------------------------------------------------------------------
# User Me View
# ---------------------------------------------------------------------------

class UserMeView(APIView):
    """GET /auth/me/ – Return full details of the authenticated user."""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Get Current User',
        description='Returns all details of the authenticated user including their nested profile.',
        responses={200: UserSerializer},
        tags=['User'],
    )
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# Department Views (MAC — read-only reference data)
# ---------------------------------------------------------------------------

class DepartmentListView(generics.ListAPIView):
    """
    GET /auth/departments/
    Returns all departments with their nested permission levels.
    Used by the frontend to populate the DepartmentAccessPicker.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = DepartmentSerializer
    queryset = Department.objects.prefetch_related('permission_levels').order_by('name')

    @extend_schema(
        summary='List Departments',
        description=(
            'Returns all available departments with their nested permission levels. '
            'The department\'s `uuid` field is the key used in the `department_access` JSON map.'
        ),
        responses={200: DepartmentSerializer(many=True)},
        tags=['Departments'],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class DepartmentDetailView(generics.RetrieveAPIView):
    """
    GET /auth/departments/<id>/
    Returns a single department with its permission levels.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = DepartmentSerializer
    queryset = Department.objects.prefetch_related('permission_levels')

    @extend_schema(
        summary='Get Department',
        description='Returns a single department with its nested permission levels.',
        responses={200: DepartmentSerializer},
        tags=['Departments'],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


# ---------------------------------------------------------------------------
# Google OAuth2 Views
# ---------------------------------------------------------------------------

@extend_schema(
    summary='Google Login Redirect',
    description='Redirects the user to Google OAuth2 consent screen.',
    responses={302: None},
    tags=['Google Login'],
    parameters=[
        OpenApiParameter(
            name='Location',
            type=OpenApiTypes.URI,
            location=OpenApiParameter.HEADER,
            description='Google OAuth2 authorization URI',
            response=[302],
        )
    ],
)
class GoogleOAuth2RedirectView(APIView):
    '''Google OAuth login redirect.'''
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        google_oauth = GoogleOAuth2Service()
        authorization_uri = google_oauth.getAuthorizationUri()
        return Response(
            status=status.HTTP_302_FOUND,
            headers={'Location': authorization_uri},
        )


@extend_schema(exclude=True)
class GoogleOAuth2CallbackView(APIView):
    '''Google OAuth2 callback – exchanges code for tokens.'''
    permission_classes = [AllowAny]

    class InnerSerializer(serializers.Serializer):
        code = serializers.CharField(required=False)
        error = serializers.CharField(required=False)

    def get(self, request):
        serializer = self.InnerSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        code = data.get('code')

        if 'error' in data:
            return Response(
                {'error': data.get('error')},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not code:
            return Response(
                {'error': 'code is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        google_oauth = GoogleOAuth2Service()
        google_tokens = google_oauth.getTokens(code)
        try:
            user_info = google_oauth.decodeIdToken(google_tokens)
        except Exception:
            return Response(
                {'error': 'invalid token type'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        app_tokens = google_oauth.getTokenForUser(user_info)

        return Response({
            'access_token': str(app_tokens.access_token),
            'refresh_token': str(app_tokens),
        })


# ---------------------------------------------------------------------------
# Profile Views
# ---------------------------------------------------------------------------

class ProfileView(APIView):
    """
    GET    /auth/profile/  – Retrieve the current user's profile.
    PATCH  /auth/profile/  – Partial update of the profile.
    DELETE /auth/profile/  – Soft-delete the profile.
    """
    permission_classes = [IsAuthenticated, IsOwnerOrSuperuser]

    def get_object(self, request):
        """Return the profile for the authenticated user, checking permissions."""
        profile = request.user.profile
        self.check_object_permissions(request, profile)
        return profile

    @extend_schema(
        summary='Get Current User Profile',
        description='Returns the profile of the currently authenticated user.',
        responses={200: ProfileSerializer},
        tags=['Profile'],
    )
    def get(self, request):
        profile = self.get_object(request)
        serializer = ProfileSerializer(profile)
        return Response(serializer.data)

    @extend_schema(
        summary='Update Profile (Partial)',
        description='Partially update the current user\'s profile. Only provided fields are updated. Use /auth/profile/picture/ to update the profile picture.',
        request=ProfileUpdateSerializer,
        responses={200: ProfileSerializer},
        tags=['Profile'],
    )
    def patch(self, request):
        profile = self.get_object(request)
        serializer = ProfileUpdateSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @extend_schema(
        summary='Soft-Delete Profile',
        description='Marks the profile as deleted. The record is preserved in the database.',
        responses={204: None},
        tags=['Profile'],
    )
    def delete(self, request):
        profile = self.get_object(request)
        profile.delete()  # soft-delete via SoftDeleteMixin
        return Response(
            {'detail': 'Profile soft-deleted successfully.'},
            status=status.HTTP_204_NO_CONTENT,
        )


class ProfilePicUploadView(APIView):
    """
    PUT    /auth/profile/picture/  – Upload or replace the profile picture.
    DELETE /auth/profile/picture/  – Remove the profile picture.
    """
    permission_classes = [IsAuthenticated, IsOwnerOrSuperuser]
    parser_classes = [MultiPartParser, FormParser]

    def get_object(self, request):
        profile = request.user.profile
        self.check_object_permissions(request, profile)
        return profile

    @extend_schema(
        summary='Upload Profile Picture',
        description='Upload or replace the current user\'s profile picture.',
        request={'multipart/form-data': ProfilePicSerializer},
        responses={200: ProfileSerializer},
        tags=['Profile'],
    )
    def put(self, request):
        profile = self.get_object(request)
        serializer = ProfilePicSerializer(profile, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ProfileSerializer(profile).data)

    @extend_schema(
        summary='Remove Profile Picture',
        description='Remove the current user\'s profile picture.',
        responses={204: None},
        tags=['Profile'],
    )
    def delete(self, request):
        profile = self.get_object(request)
        if profile.profile_pic:
            profile.profile_pic.delete(save=True)
        return Response(
            {'detail': 'Profile picture removed.'},
            status=status.HTTP_204_NO_CONTENT,
        )


# ---------------------------------------------------------------------------
# User Detail Views
# ---------------------------------------------------------------------------

class UserDetailView(APIView):
    """
    PATCH  /auth/user/  – Partial update of the current user.
    DELETE /auth/user/  – Soft-delete the current user (and their profile).
    """
    permission_classes = [IsAuthenticated, IsOwnerOrSuperuser]

    def get_object(self, request):
        """Return the authenticated user, checking permissions."""
        user = request.user
        self.check_object_permissions(request, user)
        return user

    @extend_schema(
        summary='Update User (Partial)',
        description='Partially update the current user\'s information (first_name, last_name, email). Password cannot be changed here – use the forgot-password flow.',
        request=UserUpdateSerializer,
        responses={200: UserUpdateSerializer},
        tags=['User'],
    )
    def patch(self, request):
        user = self.get_object(request)
        serializer = UserUpdateSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @extend_schema(
        summary='Soft-Delete User',
        description='Marks the user and their profile as deleted. Records are preserved in the database.',
        responses={204: None},
        tags=['User'],
    )
    def delete(self, request):
        user = self.get_object(request)
        user.delete()  # soft-deletes user + profile via User.delete()
        return Response(
            {'detail': 'User soft-deleted successfully.'},
            status=status.HTTP_204_NO_CONTENT,
        )


# ---------------------------------------------------------------------------
# Forgot / Reset Password Views
# ---------------------------------------------------------------------------

class ForgotPasswordView(APIView):
    """
    POST /auth/forgot-password/
    Accepts an email address. If the user exists, generates a password-reset
    token and logs the reset link (in production, send this via email).
    Always returns 200 to avoid leaking whether the email is registered.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(
        summary='Request Password Reset',
        description=(
            'Send a password-reset link to the given email. '
            'For security, a 200 is always returned regardless of whether the email exists.'
        ),
        request=ForgotPasswordRequestSerializer,
        responses={200: None},
        tags=['Authentication'],
    )
    def post(self, request):
        serializer = ForgotPasswordRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        from .models import User
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            # Don't reveal that the user doesn't exist
            return Response(
                {'detail': 'If that email is registered, a reset link has been sent.'},
                status=status.HTTP_200_OK,
            )

        # Generate token
        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        # In production, send this via email. For now, log it.
        reset_link = f"/auth/reset-password/?uidb64={uidb64}&token={token}"
        print('Password reset link for %s: %s', email, reset_link)

        return Response(
            {'detail': 'If that email is registered, a reset link has been sent.'},
            status=status.HTTP_200_OK,
        )


class ResetPasswordView(APIView):
    """
    POST /auth/reset-password/
    Validates the uidb64 + token pair and sets a new password.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(
        summary='Reset Password',
        description='Validate the reset token and set a new password for the user.',
        request=ResetPasswordSerializer,
        responses={200: None},
        tags=['Authentication'],
    )
    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uidb64 = serializer.validated_data['uidb64']
        token = serializer.validated_data['token']
        new_password = serializer.validated_data['new_password']

        from .models import User
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            return Response(
                {'detail': 'Invalid or expired reset link.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not default_token_generator.check_token(user, token):
            return Response(
                {'detail': 'Invalid or expired reset link.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=['password'])

        return Response(
            {'detail': 'Password has been reset successfully.'},
            status=status.HTTP_200_OK,
        )

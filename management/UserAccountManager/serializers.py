'''Serializers for User, Profile, and auth endpoints with Swagger schema support'''
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User, Profile, Department, PermissionLevel


# ---------------------------------------------------------------------------
# MAC: Department & PermissionLevel Serializers
# ---------------------------------------------------------------------------

class PermissionLevelSerializer(serializers.ModelSerializer):
    '''Read-only serializer for PermissionLevel — exposed inside DepartmentSerializer.'''

    class Meta:
        model = PermissionLevel
        fields = ['id', 'name', 'ranking']
        read_only_fields = fields


class DepartmentSerializer(serializers.ModelSerializer):
    '''Read-only serializer for Department with nested permission levels.'''
    permission_levels = PermissionLevelSerializer(many=True, read_only=True)

    class Meta:
        model = Department
        fields = ['id', 'uuid', 'name', 'permission_levels']
        read_only_fields = fields


# ---------------------------------------------------------------------------
# Profile Serializer
# ---------------------------------------------------------------------------

class ProfileSerializer(serializers.ModelSerializer):
    '''Serializer for the Profile model including nested MAC fields.'''
    department = DepartmentSerializer(read_only=True)
    permission_level = PermissionLevelSerializer(read_only=True)

    class Meta:
        model = Profile
        fields = [
            'id', 'contact_info', 'firstname', 'lastname',
            'emergency_contact_name', 'emergency_number',
            'profile_pic', 'address',
            'department', 'permission_level',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'department', 'permission_level', 'created_at', 'updated_at']


class ProfileUpdateSerializer(serializers.ModelSerializer):
    '''Serializer for PATCH /auth/profile/ – excludes profile_pic.'''

    class Meta:
        model = Profile
        fields = [
            'id', 'contact_info', 'firstname', 'lastname',
            'emergency_contact_name', 'emergency_number',
            'address', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProfilePicSerializer(serializers.ModelSerializer):
    '''Serializer for PUT /auth/profile/picture/ – only profile_pic.'''

    class Meta:
        model = Profile
        fields = ['profile_pic']
        extra_kwargs = {'profile_pic': {'required': True}}


# ---------------------------------------------------------------------------
# User Serializer (with nested profile for read responses)
# ---------------------------------------------------------------------------

class UserSerializer(serializers.ModelSerializer):
    '''User serializer – nests ProfileSerializer in read responses.'''
    password = serializers.CharField(write_only=True, required=False)
    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'uuid', 'email', 'first_name', 'last_name',
            'password', 'provider', 'profile',
        ]
        read_only_fields = ['id', 'uuid', 'provider']

    def create(self, validated_data):
        """
        Create a user with a hashed password.
        Profile is created inline by UserManager.create(),
        but we guard against duplication for safety.
        """
        password = validated_data.pop('password', None)
        user = User.objects.create(password=password, **validated_data)
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    '''Serializer for PATCH /auth/user/ – password is excluded.'''
    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'uuid', 'email', 'first_name', 'last_name', 'provider', 'profile']
        read_only_fields = ['id', 'uuid', 'provider']


# ---------------------------------------------------------------------------
# Swagger-oriented request / response serializers for Auth endpoints
# ---------------------------------------------------------------------------

class SignupRequestSerializer(serializers.Serializer):
    """Schema for the signup request body (Swagger docs)."""
    email = serializers.EmailField()
    password = serializers.CharField()
    first_name = serializers.CharField(required=False)
    last_name = serializers.CharField(required=False)


class SignupResponseSerializer(serializers.Serializer):
    """Schema for the signup response (Swagger docs)."""
    id = serializers.IntegerField()
    uuid = serializers.UUIDField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    provider = serializers.CharField()


class LoginRequestSerializer(serializers.Serializer):
    """Schema for the login request body (Swagger docs)."""
    email = serializers.EmailField()
    password = serializers.CharField()


class LoginResponseSerializer(serializers.Serializer):
    """Schema for the login response (Swagger docs)."""
    access = serializers.CharField()
    refresh = serializers.CharField()


# ---------------------------------------------------------------------------
# Forgot / Reset Password Serializers
# ---------------------------------------------------------------------------

class ForgotPasswordRequestSerializer(serializers.Serializer):
    """Accepts the user's email to initiate a password reset."""
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    """Accepts the reset token (uidb64 + token) and a new password."""
    uidb64 = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8)


# ---------------------------------------------------------------------------
# Custom Token Serializer (provider check before auth)
# ---------------------------------------------------------------------------

def _get_public_mac_defaults() -> tuple[str | None, int]:
    """Return (public_dept_uuid_str, public_ranking) as a fallback for unassigned users.
    Returns (None, 1) if the seed data doesn't exist yet (first boot before migrate)."""
    try:
        pub_dept = Department.objects.get(name='Public')
        pub_level = PermissionLevel.objects.get(department=pub_dept, ranking=1)
        return str(pub_dept.uuid), pub_level.ranking
    except (Department.DoesNotExist, PermissionLevel.DoesNotExist):
        return None, 1


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    '''Validates the user's provider before issuing JWT tokens, returns user info
    and injects MAC department/ranking claims into the token payload.'''

    @classmethod
    def get_token(cls, user):
        """Embed MAC claims inside the signed JWT so downstream services can
        enforce access control without a cross-service database round-trip.
        Falls back to the Public department when the profile has no MAC assignment."""
        token = super().get_token(user)
        profile = getattr(user, 'profile', None)

        if profile and profile.department_id:
            token['department_id'] = str(profile.department.uuid)
        else:
            pub_uuid, _ = _get_public_mac_defaults()
            token['department_id'] = pub_uuid

        if profile and profile.permission_level_id:
            token['permission_ranking'] = profile.permission_level.ranking
        else:
            _, pub_ranking = _get_public_mac_defaults()
            token['permission_ranking'] = pub_ranking

        return token

    def validate(self, attrs):
        try:
            user = User.objects.get(email=attrs['email'])
            if user.provider != 'local':
                raise serializers.ValidationError(
                    f"Please use the {user.provider} provider to log in."
                )
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found.")

        data = super().validate(attrs)

        # Append full user info (with nested profile) to the token response
        data['user'] = UserSerializer(self.user).data

        # Also surface MAC context in the response body for convenience
        profile = getattr(self.user, 'profile', None)
        pub_uuid, pub_ranking = _get_public_mac_defaults()

        if profile and profile.department_id:
            data['department_id'] = str(profile.department.uuid)
        else:
            data['department_id'] = pub_uuid

        if profile and profile.permission_level_id:
            data['permission_ranking'] = profile.permission_level.ranking
        else:
            data['permission_ranking'] = pub_ranking

        return data
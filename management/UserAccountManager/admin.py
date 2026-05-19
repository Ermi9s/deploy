'''Admin configuration for User, Profile, Department, and PermissionLevel models.'''
from django import forms
from django.contrib import admin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from UserAccountManager.models import Department, PermissionLevel, User, Profile


# ---------------------------------------------------------------------------
# Department & PermissionLevel
# ---------------------------------------------------------------------------

class PermissionLevelInline(admin.TabularInline):
    """Show permission levels grouped beneath their parent department."""
    model = PermissionLevel
    extra = 1
    fields = ['name', 'ranking']
    ordering = ['ranking']


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ['name', 'level_count', 'created_at']
    search_fields = ['name']
    inlines = [PermissionLevelInline]
    readonly_fields = ['created_at', 'updated_at']

    @admin.display(description='Permission Levels')
    def level_count(self, obj):
        return obj.permission_levels.count()


@admin.register(PermissionLevel)
class PermissionLevelAdmin(admin.ModelAdmin):
    list_display = ['name', 'department', 'ranking', 'created_at']
    list_filter = ['department']
    search_fields = ['name', 'department__name']
    ordering = ['department', 'ranking']
    readonly_fields = ['created_at', 'updated_at']


# ---------------------------------------------------------------------------
# Profile (with MAC fields)
# ---------------------------------------------------------------------------

class ProfileAdminForm(forms.ModelForm):
    """
    Custom form that restricts the permission_level dropdown to only levels
    that belong to the currently selected department.
    When no department is chosen, the dropdown is empty.
    """
    class Meta:
        model = Profile
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Restrict permission_level choices to the profile's department
        if self.instance and self.instance.department_id:
            self.fields['permission_level'].queryset = PermissionLevel.objects.filter(
                department=self.instance.department
            )
        else:
            self.fields['permission_level'].queryset = PermissionLevel.objects.none()


class ProfileInline(admin.StackedInline):
    """Inline profile editor embedded inside the UserAdmin."""
    model = Profile
    form = ProfileAdminForm
    can_delete = False
    verbose_name_plural = 'Profile & Access Control'
    fieldsets = [
        ('Personal', {'fields': ['firstname', 'lastname', 'contact_info',
                                  'emergency_contact_name', 'emergency_number',
                                  'profile_pic', 'address']}),
        ('MAC — Access Control', {'fields': ['department', 'permission_level'],
                                   'description': 'Assign the user to a department and select '
                                                   'a permission level that belongs to that department.'}),
    ]
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    form = ProfileAdminForm
    list_display = ['user', 'firstname', 'lastname', 'department', 'permission_level', 'is_deleted']
    list_filter = ['is_deleted', 'department']
    search_fields = ['user__email', 'firstname', 'lastname', 'department__name']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = [
        ('User', {'fields': ['user']}),
        ('Personal Info', {'fields': ['firstname', 'lastname', 'contact_info',
                                       'emergency_contact_name', 'emergency_number',
                                       'profile_pic', 'address']}),
        ('MAC — Access Control', {
            'fields': ['department', 'permission_level'],
            'description': 'The permission level must belong to the selected department.',
        }),
        ('Timestamps', {'fields': ['created_at', 'updated_at'], 'classes': ['collapse']}),
        ('Soft Delete', {'fields': ['is_deleted', 'deleted_at'], 'classes': ['collapse']}),
    ]


# ---------------------------------------------------------------------------
# User (with inline Profile)
# ---------------------------------------------------------------------------

class UserAdmin(BaseUserAdmin):
    form = UserChangeForm
    add_form = UserCreationForm
    inlines = [ProfileInline]

    list_display = ['email', 'get_department', 'get_permission_level',
                    'is_staff', 'is_superuser', 'is_active', 'is_deleted']
    list_filter = ['is_staff', 'is_deleted', 'profile__department']

    fieldsets = [
        (None, {'fields': ['email', 'password']}),
        ('Personal info', {'fields': ['first_name', 'last_name', 'is_staff', 'is_superuser']}),
        ('Groups', {'fields': ('groups',)}),
        ('Permissions', {'fields': ['user_permissions', 'is_active']}),
        ('Soft Delete', {'fields': ['is_deleted', 'deleted_at']}),
    ]

    add_fieldsets = [
        (
            None,
            {
                'classes': ['wide'],
                'fields': ['email', 'password1', 'password2'],
            },
        ),
    ]

    search_fields = ['email']
    ordering = ['email']
    filter_horizontal = []

    @admin.display(description='Department')
    def get_department(self, obj):
        profile = getattr(obj, 'profile', None)
        return profile.department if profile else '—'

    @admin.display(description='Permission Level')
    def get_permission_level(self, obj):
        profile = getattr(obj, 'profile', None)
        return profile.permission_level if profile else '—'


admin.site.register(User, UserAdmin)

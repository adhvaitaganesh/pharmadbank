########################
#
# Delta project.
#
# Authors:
# Lexington Whalen (@lxaw)
#
# DataSet name: api.py
#
# Brief description: Defines the api for gathering organizations and organization data.
# Makes use of a Rest API framework
#
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from django.contrib.auth import get_user_model
from django.db import models as django_models
import secrets

from organizations.models import Organization
from data.serializers import SerializerDataSet
from .serializers import OrganizationSerializer

User = get_user_model()

class ViewsetOrganizations(viewsets.ModelViewSet):
    serializer_class = OrganizationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Organization.objects.filter(
            django_models.Q(is_public=True) |
            django_models.Q(following_users=user)
        ).distinct()

    # ── helpers ──────────────────────────────────────────────────────────────

    def _require_owner(self, org_obj, user):
        if org_obj.author_id != user.id:
            raise PermissionDenied("Only the organization owner can perform this action.")

    def _require_owner_or_admin(self, org_obj, user):
        is_owner = org_obj.author_id == user.id
        is_admin = org_obj.admins.filter(id=user.id).exists()
        if not is_owner and not is_admin:
            raise PermissionDenied("Only the owner or an admin can perform this action.")

    def _generate_org_key(self):
        while True:
            generated_key = secrets.token_urlsafe(18)
            if not Organization.objects.filter(key=generated_key).exists():
                return generated_key

    # ── standard CRUD ────────────────────────────────────────────────────────

    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        generated_key = self._generate_org_key()
        org = serializer.save(author=request.user, key=generated_key)
        org.following_users.add(request.user)
        org.save()

        response_data = self.get_serializer(org).data
        response_data["generated_key"] = generated_key
        return Response(response_data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        org_obj = self.get_object()
        self._require_owner(org_obj, request.user)
        return super().destroy(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        org_obj = self.get_object()
        self._require_owner(org_obj, request.user)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        org_obj = self.get_object()
        self._require_owner(org_obj, request.user)
        kwargs['partial'] = True
        return super().update(request, *args, **kwargs)

    # ── datasets ─────────────────────────────────────────────────────────────

    @action(methods=['get'], detail=True)
    def data_posts(self, request, *args, **kwargs):
        instance = self.get_object()
        user_in_org = instance.following_users.filter(id=request.user.id).exists()

        public_datasets = instance.uploaded_datasets.filter(is_public=True)
        org_datasets = instance.uploaded_datasets.filter(is_public_orgs=True)

        if user_in_org:
            csv_datasets = org_datasets.union(public_datasets)
        else:
            csv_datasets = public_datasets

        serializer = SerializerDataSet(csv_datasets, many=True, context={'request': request})
        return Response(serializer.data)

    # ── join / leave ─────────────────────────────────────────────────────────

    @action(methods=['post'], detail=False, url_path='join')
    def join(self, request):
        org_name = request.data.get('name', '').strip()
        org_key = request.data.get('key', '').strip()
        if not org_name or not org_key:
            return Response(
                {"detail": "Both organization name and key are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            org_obj = Organization.objects.get(name=org_name, key=org_key)
        except Organization.DoesNotExist:
            return Response(
                {"detail": "Invalid organization name or key."},
                status=status.HTTP_400_BAD_REQUEST
            )

        org_obj.following_users.add(request.user)
        org_obj.save()
        return Response(
            {"detail": "Successfully joined organization.", "organization": self.get_serializer(org_obj).data},
            status=status.HTTP_200_OK
        )

    @action(methods=['post'], detail=True, url_path='leave')
    def leave(self, request, pk=None):
        org_obj = self.get_object()
        if org_obj.author_id == request.user.id:
            return Response(
                {"detail": "Owner cannot leave organization without transfer/delete flow."},
                status=status.HTTP_400_BAD_REQUEST
            )

        org_obj.following_users.remove(request.user)
        org_obj.admins.remove(request.user)
        org_obj.save()
        return Response({"detail": "Successfully left organization."}, status=status.HTTP_200_OK)

    # ── member management (owner or admin) ───────────────────────────────────

    @action(methods=['get'], detail=True, url_path='members')
    def members(self, request, pk=None):
        org_obj = self.get_object()
        self._require_owner_or_admin(org_obj, request.user)
        members = []
        for member in org_obj.following_users.all().order_by('username'):
            members.append({
                "id": member.id,
                "username": member.username,
                "first_name": member.first_name,
                "last_name": member.last_name,
                "email": member.email,
                "is_owner": org_obj.author_id == member.id,
                "is_admin": org_obj.admins.filter(id=member.id).exists(),
            })
        return Response({"members": members}, status=status.HTTP_200_OK)

    @action(methods=['post'], detail=True, url_path='members/add')
    def members_add(self, request, pk=None):
        org_obj = self.get_object()
        self._require_owner_or_admin(org_obj, request.user)

        username = request.data.get('username', '').strip()
        if not username:
            return Response({"detail": "Username is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            member = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        org_obj.following_users.add(member)
        org_obj.save()
        return Response({"detail": f"Added {username} to organization."}, status=status.HTTP_200_OK)

    @action(methods=['post'], detail=True, url_path='members/remove')
    def members_remove(self, request, pk=None):
        org_obj = self.get_object()
        self._require_owner_or_admin(org_obj, request.user)

        username = request.data.get('username', '').strip()
        if not username:
            return Response({"detail": "Username is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            member = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if member.id == org_obj.author_id:
            return Response({"detail": "Owner cannot be removed from organization."}, status=status.HTTP_400_BAD_REQUEST)

        # Admins cannot remove other admins — only the owner can
        caller_is_owner = org_obj.author_id == request.user.id
        if not caller_is_owner and org_obj.admins.filter(id=member.id).exists():
            return Response({"detail": "Only the owner can remove admins."}, status=status.HTTP_403_FORBIDDEN)

        if not org_obj.following_users.filter(id=member.id).exists():
            return Response({"detail": "User is not a member of this organization."}, status=status.HTTP_404_NOT_FOUND)

        org_obj.following_users.remove(member)
        org_obj.admins.remove(member)
        org_obj.save()
        return Response({"detail": f"Removed {username} from organization."}, status=status.HTTP_200_OK)

    # ── admin management (owner only) ─────────────────────────────────────────

    @action(methods=['post'], detail=True, url_path='admins/add')
    def admins_add(self, request, pk=None):
        org_obj = self.get_object()
        self._require_owner(org_obj, request.user)

        username = request.data.get('username', '').strip()
        if not username:
            return Response({"detail": "Username is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            member = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if member.id == org_obj.author_id:
            return Response({"detail": "Owner is already the highest role."}, status=status.HTTP_400_BAD_REQUEST)

        if not org_obj.following_users.filter(id=member.id).exists():
            return Response({"detail": "User must be a member first."}, status=status.HTTP_400_BAD_REQUEST)

        org_obj.admins.add(member)
        return Response({"detail": f"Promoted {username} to admin."}, status=status.HTTP_200_OK)

    @action(methods=['post'], detail=True, url_path='admins/remove')
    def admins_remove(self, request, pk=None):
        org_obj = self.get_object()
        self._require_owner(org_obj, request.user)

        username = request.data.get('username', '').strip()
        if not username:
            return Response({"detail": "Username is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            member = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if not org_obj.admins.filter(id=member.id).exists():
            return Response({"detail": "User is not an admin."}, status=status.HTTP_400_BAD_REQUEST)

        org_obj.admins.remove(member)
        return Response({"detail": f"Demoted {username} from admin."}, status=status.HTTP_200_OK)

    # ── key management ────────────────────────────────────────────────────────

    @action(methods=['get'], detail=True, url_path='key')
    def key(self, request, pk=None):
        org_obj = self.get_object()
        self._require_owner_or_admin(org_obj, request.user)
        return Response({"key": org_obj.key}, status=status.HTTP_200_OK)

    @action(methods=['post'], detail=True, url_path='rotate_key')
    def rotate_key(self, request, pk=None):
        org_obj = self.get_object()
        self._require_owner(org_obj, request.user)
        new_key = self._generate_org_key()
        org_obj.key = new_key
        org_obj.save()
        return Response({"detail": "Key rotated successfully.", "key": new_key}, status=status.HTTP_200_OK)

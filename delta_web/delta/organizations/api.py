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
from rest_framework import status,viewsets
from organizations.models import Organization
from rest_framework.decorators import action
from itertools import chain
from rest_framework.exceptions import PermissionDenied
from django.contrib.auth import get_user_model
import secrets

from data.serializers import SerializerDataSet

from .serializers import OrganizationSerializer

User = get_user_model()

class ViewsetOrganizations(viewsets.ModelViewSet):
    queryset = Organization.objects.all()

    serializer_class = OrganizationSerializer

    permission_classes = [permissions.IsAuthenticated]

    # UTILITY: Returns the full queryset containing all organizations
    # INPUT: Current instance
    # OUTPUT: set of all Organizations
    def get_queryset(self):
        return Organization.objects.all()

    def _require_owner(self, org_obj, user):
        if org_obj.author_id != user.id:
            raise PermissionDenied("Only the organization owner can perform this action.")

    def _generate_org_key(self):
        while True:
            generated_key = secrets.token_urlsafe(18)
            if not Organization.objects.filter(key=generated_key).exists():
                return generated_key

    # UTILITY: Retrieves data from a request from a model
    # INPUT: Current instance, the request being made, and arguments made for the request
    # OUTPUT: Returns the response to the request
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

    # UTILITY: Gathers the data posts within an organization
    # INPUT: Current instance, the request for data being made, and arguments for the request
    # OUTPUT: Response of the serialized data containing csv files
    @action(methods=['get'],detail=True)
    def data_posts(self,request,*args,**kwargs):
        instance = self.get_object()

        user_in_org = False
        if request.user in instance.following_users.all():
            user_in_org = True
            
        PublicCsvDataSets = instance.uploaded_datasets.filter(is_public=True)
        PublicOrgCsvDataSets = instance.uploaded_datasets.filter(is_public_orgs=True)

        # if user in org, see all org data
        if user_in_org:
            csvDataSets = list(chain(PublicOrgCsvDataSets, PublicCsvDataSets))
        # if not in org, see only public data
        else:
            csvDataSets = PublicCsvDataSets
            print('here')
            print(csvDataSets)

        serializer = SerializerDataSet(csvDataSets,many=True)

        return Response(serializer.data)

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
        org_obj.save()
        return Response({"detail": "Successfully left organization."}, status=status.HTTP_200_OK)

    @action(methods=['get'], detail=True, url_path='members')
    def members(self, request, pk=None):
        org_obj = self.get_object()
        self._require_owner(org_obj, request.user)
        members = []
        for member in org_obj.following_users.all().order_by('username'):
            members.append({
                "id": member.id,
                "username": member.username,
                "first_name": member.first_name,
                "last_name": member.last_name,
                "email": member.email,
                "is_owner": org_obj.author_id == member.id,
            })
        return Response({"members": members}, status=status.HTTP_200_OK)

    @action(methods=['post'], detail=True, url_path='members/add')
    def members_add(self, request, pk=None):
        org_obj = self.get_object()
        self._require_owner(org_obj, request.user)

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
        self._require_owner(org_obj, request.user)

        username = request.data.get('username', '').strip()
        if not username:
            return Response({"detail": "Username is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            member = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if member.id == org_obj.author_id:
            return Response({"detail": "Owner cannot be removed from organization."}, status=status.HTTP_400_BAD_REQUEST)

        if not org_obj.following_users.filter(id=member.id).exists():
            return Response({"detail": "User is not a member of this organization."}, status=status.HTTP_404_NOT_FOUND)

        org_obj.following_users.remove(member)
        org_obj.save()
        return Response({"detail": f"Removed {username} from organization."}, status=status.HTTP_200_OK)

    @action(methods=['get'], detail=True, url_path='key')
    def key(self, request, pk=None):
        org_obj = self.get_object()
        self._require_owner(org_obj, request.user)
        return Response({"key": org_obj.key}, status=status.HTTP_200_OK)
    

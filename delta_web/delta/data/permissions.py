########################
#
# data/permissions.py
#
# Shared permission utilities for the data app.
# Provides a single source of truth for dataset access control.
#

from rest_framework.permissions import BasePermission
from rest_framework.exceptions import PermissionDenied


def user_can_access_dataset(user, dataset):
    """
    Returns True if the user has permission to view/download this dataset.

    Access rules (evaluated in order):
    1. Unauthenticated users → always denied
    2. Dataset author → always allowed
    3. Public dataset (is_public=True) → any authenticated user allowed
    4. Org-only dataset (is_public_orgs=True) → user must be a member of
       at least one of the dataset's registered organizations
    5. Private dataset → only the author (already covered by rule 2)
    """
    if not user or not user.is_authenticated:
        return False
    if dataset.author == user:
        return True
    if dataset.is_public:
        return True
    if dataset.is_public_orgs:
        user_org_ids = set(user.followed_organizations.values_list('id', flat=True))
        dataset_org_ids = set(dataset.registered_organizations.values_list('id', flat=True))
        if user_org_ids & dataset_org_ids:
            return True
    return False


class CanAccessDataSet(BasePermission):
    """
    Object-level DRF permission class for DataSet instances.
    Use on retrieve / download actions where the object is a DataSet.

    Usage:
        permission_classes = [IsAuthenticated, CanAccessDataSet]
    """

    message = "You do not have permission to access this dataset."

    def has_object_permission(self, request, view, obj):
        return user_can_access_dataset(request.user, obj)

########################
#
# Delta project.
#
# Lexington Whalen (@lxaw)
#
# urls.py
#
# This file is the configuration for the urls of the `data` Django app.
# This is mainly the csv, tags, and the viewablity of the csv
#
from django.urls import path
from rest_framework import routers

from .api import (
    DatasetTableView,
    ParseFileView,
    ViewsetDataSet,
    ViewsetFolder,
    ViewsetPublicDataSet,
    ViewsetTagDataset,
)

router = routers.DefaultRouter()
router.register('api/datasets',ViewsetDataSet,'DataSets')
router.register('api/public_datasets',ViewsetPublicDataSet,'Publics')
router.register('api/tags',ViewsetTagDataset,'TagDataset')
router.register('api/folder',ViewsetFolder,'Folders')


# for all non viewsets, need to add to regular urls
# IMPORTANT: Explicit paths must come BEFORE router.urls to avoid conflicts
urlpatterns  = [
    path('api/parse_file/', ParseFileView.as_view(), name='ParseFile'),
    path('api/dataset_table/<int:dataset_id>', DatasetTableView.as_view(), name='dataset-table-alt'),
    path('api/datasets/<int:dataset_id>', DatasetTableView.as_view(), name='dataset-table'),
]

urlpatterns += router.urls

########################
#
# Delta project.
#
# Authors:
# Lexington Whalen (@lxaw)
# Carter Marlowe (@Cmarlowe132)
# Vince Kolb-LugoVince (@vancevince) 
# Blake Seekings (@j-blake-s)
# Naveen Chithan (@nchithan)
#
# File name: serializers.py
#
# Brief description: Defines functions to be performed on organization models and serializes their data for 
# data transfer.
#
from rest_framework import serializers
from .models import Organization

class OrganizationSerializer(serializers.ModelSerializer):
    # extra fields
    following_user_count = serializers.SerializerMethodField()
    date_us_format = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    author_username = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            'timestamp', 'name', 'id', 'following_user_count', 'description',
            'date_us_format', 'is_owner', 'author_username'
        ]

    # UTILITY: Gets the follow count of users for an organization
    # INPUT: Current instance and organization object
    # OUTPUT: Count of following users
    def get_following_user_count(self, obj):
        return obj.following_users.count()

    # UTILITY: Gets the created date of an organization
    # INPUT: Current instance and organization object
    # OUTPUT: Formatted date
    def get_date_us_format(self,obj):
        return obj.timestamp.date()

    def get_is_owner(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        return obj.author_id == request.user.id

    def get_author_username(self, obj):
        if not obj.author:
            return None
        return obj.author.username

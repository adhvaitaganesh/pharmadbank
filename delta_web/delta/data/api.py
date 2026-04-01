########################
#
# Delta project.
#
# Authors:
# Lexington Whalen (@lxaw)
#
# api.py
#
# Is the API for the data app. It handles the logic for the data app of Django.
# This includes the logic for uploading, downloading, deleting csv files, and who can see them.

# json
import json
import logging
import os
import random

# zip the folder (dataset)
import shutil
import sqlite3
import string
import tempfile

# threading
import threading
import zipfile
from io import BytesIO
from pathlib import Path

# for parsing Excel and CSV files using pandas
import pandas as pd

# Get logger for this module
logger = logging.getLogger(__name__)

# files
from django.conf import settings as django_settings

# import necessary models
from django.http import FileResponse, HttpResponse

# import orgs
from organizations.models import Organization

# import necessary rest_framework stuff
from rest_framework import permissions, renderers, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FileUploadParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import DataSet, DatasetRow, File, Folder, TagDataset

# import necessary serializers
from .serializers import SerializerDataSet, SerializerFolder, SerializerTagDataset


#https://stackoverflow.com/questions/38697529/how-to-return-generated-file-download-with-django-rest-framework
# Passes the generated file to the browser
# This is used for downloading csv files
class PassthroughRenderer(renderers.BaseRenderer):
    media_type = 'text/csv'
    format = None
    def render(self,data,accepted_media_type=None,renderer_context=None):
        return data

class ViewsetFolder(viewsets.ModelViewSet):
    serializer_class = SerializerFolder
    permission_classes = [permissions.IsAuthenticated]

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}

        return Response(serializer.data)

    def get_queryset(self):
        return Folder.objects.filter(author=self.request.user)

    def perform_create(self, serializer):
        folder = serializer.save(author=self.request.user)

        # get the dataset ids
        dataset_ids= json.loads(self.request.data.get('dataset_ids', []))
        # then update the datasets
        datasets = DataSet.objects.filter(id__in=dataset_ids, author=self.request.user)
        for dataset in datasets:
            dataset.folder = folder
            dataset.save()

# Public CSV viewset api
# For dealing with public viewing of csv files
#
class ViewsetPublicDataSet(viewsets.ModelViewSet):
    queryset = DataSet.objects.all()

    permission_classes = [
        # permissions.IsAuthenticated
    ]

    serializer_class = SerializerDataSet

    def get_queryset(self):
        return DataSet.objects.filter(is_public=True)

    @action(methods=['get'],detail=True)
    def download(self,*args,**kwargs):
        instance = self.get_object()
        logger.info(f"Download requested for dataset: {instance.id} - {instance.name}")

        # increase the download count
        instance.download_count += 1
        instance.save()

        try:
            # Get the ZIP file path
            zip_path = instance.get_zip_path()
            logger.info(f"Looking for ZIP at: {zip_path}")
            
            # Try different path resolutions to find the actual file
            possible_paths = [
                zip_path,
                os.path.join(django_settings.BASE_DIR, zip_path),
                os.path.join(django_settings.MEDIA_ROOT, zip_path),
            ]
            
            resolved_path = None
            for path in possible_paths:
                logger.info(f"Trying: {path}")
                if os.path.exists(path) and os.path.isfile(path):
                    file_size = os.path.getsize(path)
                    logger.info(f"✓ Found file at {path}, size: {file_size} bytes")
                    if file_size > 0:
                        resolved_path = path
                        break
            
            if not resolved_path:
                logger.error(f"ZIP file not found or empty for dataset {instance.id}")
                return Response(
                    {'error': 'ZIP file not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Read ZIP file into memory to ensure data integrity
            logger.info(f"Reading ZIP file: {resolved_path}")
            with open(resolved_path, 'rb') as f:
                zip_data = f.read()
            
            logger.info(f"ZIP file read successfully. Size: {len(zip_data)} bytes")
            
            # Create response with file data
            response = HttpResponse(zip_data, content_type='application/zip')
            
            # Configure download headers
            filename = instance.name.replace(' ', '_').replace('/', '_')
            filename = ''.join(c for c in filename if c.isalnum() or c in ('_', '-'))
            response['Content-Disposition'] = f'attachment; filename="{filename}.zip"'
            response['Content-Length'] = len(zip_data)
            
            logger.info(f"Returning download response for {filename}.zip")
            return response
            
        except Exception as e:
            logger.exception(f"Error downloading dataset {instance.id}: {str(e)}")
            return Response(
                {'error': f'Error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _parse_dataset_files(self, dataset):
        """
        Parse all files in a dataset and combine them into a single DataFrame.
        Supports CSV and Excel files. 
        Files can be in original directory or zipped.
        """
        files = dataset.files.all()
        logger.info(f"Found {files.count()} files for dataset {dataset.id}")
        
        if not files.exists():
            logger.warning(f"No files found for dataset {dataset.id}")
            return None
        
        dataframes = []
        
        # First check if we need to read from ZIP
        zip_path = dataset.get_zip_path()
        logger.info(f"Checking for ZIP file: {zip_path}")
        
        if os.path.exists(zip_path):
            # Read from ZIP file
            logger.info(f"Found ZIP file, reading from: {zip_path}")
            return self._parse_from_zip(zip_path, dataset)
        
        # Otherwise try to read from original file paths
        for file_obj in files:
            file_path = file_obj.file_path
            logger.info(f"Processing file: {file_path}")
            
            if not os.path.exists(file_path):
                logger.error(f"File does not exist: {file_path}")
                continue
            
            try:
                if file_path.lower().endswith(('.xlsx', '.xls')):
                    logger.info(f"Reading Excel file: {file_path}")
                    df = pd.read_excel(file_path)
                elif file_path.lower().endswith('.csv'):
                    logger.info(f"Reading CSV file: {file_path}")
                    df = pd.read_csv(file_path)
                else:
                    logger.warning(f"Unsupported file format: {file_path}")
                    continue
                
                logger.info(f"Successfully loaded {len(df)} rows from {file_path}")
                dataframes.append(df)
            except Exception as e:
                logger.error(f'Error parsing file {file_path}: {str(e)}')
                continue
        
        if not dataframes:
            logger.warning(f"No dataframes could be loaded for dataset {dataset.id}")
            return None
        
        # Combine all dataframes if multiple files
        if len(dataframes) == 1:
            logger.info(f"Returning single dataframe with {len(dataframes[0])} rows")
            return dataframes[0]
        else:
            # Concatenate all dataframes
            combined = pd.concat(dataframes, ignore_index=True)
            logger.info(f"Combined {len(dataframes)} files into {len(combined)} total rows")
            return combined

    def _parse_from_zip(self, zip_path, dataset):
        """
        Extract and parse files from a ZIP archive.
        Returns combined DataFrame or None if no valid data found.
        """
        dataframes = []
        
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                # Create temporary directory to extract files
                with tempfile.TemporaryDirectory() as temp_dir:
                    logger.info(f"Extracting ZIP to temporary directory: {temp_dir}")
                    zip_ref.extractall(temp_dir)
                    
                    # Find all CSV and Excel files in the extracted contents
                    for root, dirs, filenames in os.walk(temp_dir):
                        for filename in filenames:
                            file_path = os.path.join(root, filename)
                            logger.info(f"Found file in ZIP: {filename}")
                            
                            try:
                                if filename.lower().endswith(('.xlsx', '.xls')):
                                    logger.info(f"Reading Excel from ZIP: {filename}")
                                    df = pd.read_excel(file_path)
                                    dataframes.append(df)
                                    logger.info(f"Loaded {len(df)} rows from {filename}")
                                elif filename.lower().endswith('.csv'):
                                    logger.info(f"Reading CSV from ZIP: {filename}")
                                    df = pd.read_csv(file_path)
                                    dataframes.append(df)
                                    logger.info(f"Loaded {len(df)} rows from {filename}")
                            except Exception as e:
                                logger.error(f"Error reading {filename} from ZIP: {str(e)}")
                                continue
        except Exception as e:
            logger.error(f"Error reading ZIP file {zip_path}: {str(e)}")
            return None
        
        if not dataframes:
            logger.warning(f"No valid data files found in ZIP: {zip_path}")
            return None
        
        if len(dataframes) == 1:
            logger.info(f"Returning single dataframe with {len(dataframes[0])} rows")
            return dataframes[0]
        else:
            combined = pd.concat(dataframes, ignore_index=True)
            logger.info(f"Combined {len(dataframes)} files from ZIP into {len(combined)} total rows")
            return combined

def write_file(file_path, file_data):
    with open(file_path, 'wb+') as f:
        f.write(file_data)

def process_files(file_data_list, dataset_path, dataset_zip_path):
    threads = []

    if not os.path.exists(dataset_path):
        os.makedirs(dataset_path)

    # Process the files
    for file_obj in file_data_list:
        file_data = file_obj['file_data']
        file_path = file_obj['file_path']
        print(f'FILE PATH: {file_path}')

        # create directory if not exists
        directory = os.path.dirname(file_path)
        if not os.path.exists(directory):
            os.makedirs(directory)

        # write the file
        thread = threading.Thread(
            target=write_file,
            args=(file_path, file_data),
        )
        thread.start()
        threads.append(thread)

    # wait for threads
    for thread in threads:
        thread.join()

    # zip the files
    shutil.make_archive(base_name=dataset_zip_path[:-4],
                        format='zip',
                        root_dir=dataset_path)

    # now delete the files you just zipped
    shutil.rmtree(dataset_path)
        

# DataSet viewset api
# Has the permission classes for the csv file viewset
# Makes viewable only if csv files are marked as public.
class ViewsetDataSet(viewsets.ModelViewSet):

    queryset = DataSet.objects.all()

    permission_classes = [
        permissions.IsAuthenticated
    ]

    serializer_class = SerializerDataSet

    parser_classes = (MultiPartParser,)

    @action(detail=True, methods=['post'], url_path='upload', parser_classes=[MultiPartParser])
    def upload(self, request, pk=None):
        """
        Upload a file to the dataset with id=pk.
        Expects a multipart/form-data POST with 'file'.
        """
        dataset = self.get_object()
        upload_file = request.FILES.get('file')
        if not upload_file:
            return Response({'error': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)

        # Save file to user's dataset directory
        user_dir = f'static/users/{request.user.username}/files/{dataset.name}'
        os.makedirs(user_dir, exist_ok=True)
        file_path = os.path.join(user_dir, upload_file.name)
        with open(file_path, 'wb+') as dest:
            for chunk in upload_file.chunks():
                dest.write(chunk)

        # Create File model entry
        file_obj = File(dataset=dataset, file_path=file_path, file_name=upload_file.name)
        file_obj.save()

        # Optionally: parse and add rows to DatasetRow, etc.

        return Response({'message': 'File uploaded successfully.'}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path=r'files/(?P<file_id>\d+)')
    def delete_file(self, request, pk=None, file_id=None):
        """
        Delete a specific file from a dataset.
        URL: /api/datasets/{dataset_id}/files/{file_id}/
        Only the dataset author can delete files.
        """
        try:
            dataset = self.get_object()
            
            # Check permissions - only author can delete files
            if dataset.author != request.user:
                return Response(
                    {'error': 'You do not have permission to delete files from this dataset'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            file_obj = File.objects.get(id=file_id, dataset=dataset)
            
            # Delete the physical file if it exists
            if file_obj.file_path and os.path.exists(file_obj.file_path):
                try:
                    os.remove(file_obj.file_path)
                    logger.info(f"Deleted physical file: {file_obj.file_path}")
                except Exception as e:
                    logger.warning(f"Could not delete physical file {file_obj.file_path}: {str(e)}")
            
            # Delete the File model entry
            file_obj.delete()
            logger.info(f"Deleted File object {file_id} from dataset {pk}")
            
            return Response({'message': f'File deleted successfully.'}, status=status.HTTP_204_NO_CONTENT)
        
        except File.DoesNotExist:
            return Response({'error': f'File not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.exception(f"Error deleting file {file_id}: {str(e)}")
            return Response({'error': f'Error deleting file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

    def get_queryset(self):
        return self.request.user.datasets.all()

    def create(self,request):
        author = self.request.user
        is_public = self.request.data.get("is_public")
        desc = self.request.data.get('description')
        is_public_orgs = self.request.data.get('is_public_orgs')
        name = self.request.data.get('name')

        # javascript sometimes uses "true" and "false", we need "True" and "False"
        if is_public == "true":
            is_public = True
        else:
            is_public = False
        if is_public_orgs == "true":
            is_public_orgs = True
        else:
            is_public_orgs = False

        # user file path
        strUserFilePath = f'static/users/{request.user.username}/files'
        # folder is the dataset
        strDataSetPath = os.path.join(strUserFilePath,name)
        # Create the directory if it doesn't exist
        os.makedirs(strDataSetPath,exist_ok=True)

        # step 1: create the dataset
        dataSet = DataSet(author=author,is_public=is_public,description=desc,
                          is_public_orgs=is_public_orgs,
                          name=name,original_name=name)
        dataSet.save()

        # Step 2: Create File objects with file paths
        fileDatas = []

        # create dataset tags first
        num_files = 0
        
        # NOTE!
        # As of (06/18/2024) have not found a better way to do this.
        # I know, I hate it too! But I cannot seem to find a better way using 
        # Django REST than to just loop through the items. Even if I try to send
        # the items as an array of dictionaries in JSON, I still receive indexed values
        # in Django. 
        for (k,v) in request.data.items():
            if k.startswith('tag'):
                t = TagDataset(text=v)
                t.dataset = dataSet
                t.save()
            elif k.endswith('relativePath'):
                # count the number of files
                num_files +=1
            # attach organizations
            elif k.startswith('registered_organizations'):
                org_id = int(v)
                # get the org 
                # Get the organization instance with the given id
                organization = Organization.objects.get(id=org_id)

                # Add the organization to the ManyToManyField
                dataSet.registered_organizations.add(organization)
        
        # then create the files
        for index in range(0,num_files):
                file_key = f"file.{index}"
                relative_path_key = file_key + '.relativePath'
                full_path= os.path.join(strDataSetPath,request.data[relative_path_key])
                file = request.data[file_key]
                file_name = str(file)
                
                file_obj = File(dataset=dataSet, 
                                file_path=full_path, 
                                file_name=file_name)
                file_obj.save()

                file_data = file.read()
                fileDatas.append({
                        'file_path': full_path,
                        'file_data': file_data
                    })

        # then attach the organizations

    

        # Step 4: Parse and save to SQLite BEFORE zipping (while files are still in memory)
        try:
            file_bytes = BytesIO(file_data)
            fname = file_name.lower()
    
            if fname.endswith('.csv'):
                df = pd.read_csv(file_bytes)
            elif fname.endswith(('.xlsx', '.xls')):
                df = pd.read_excel(file_bytes)
            else:
                df = None

            if df is not None:
                df = df.fillna('')
                rows = [
                    DatasetRow(dataset=dataSet, row_data=row, row_index=i)
                    for i, row in enumerate(df.to_dict('records'))
                ]
                DatasetRow.objects.bulk_create(rows)
                logger.info(f"Saved {len(rows)} rows to DB for dataset '{dataSet.name}'")

        except Exception as e:
            logger.error(f"Failed to parse {file_name}: {e}")


        # Step 5: Now zip the files (in background thread)
        thread = threading.Thread(target=process_files,args=(fileDatas,strDataSetPath,dataSet.get_zip_path()))
        thread.start()

        return Response(self.get_serializer(dataSet).data)
    
    def partial_update(self, request, *args, **kwargs):
        super().partial_update(request,*args,**kwargs) 
        obj = DataSet.objects.get(id=kwargs['pk'])

        # NOTE: likely a better way to do this
        # remove old tags
        obj.tag_set.all().delete()
        for k,v in request.data.items(): 
            if k.startswith('registered_organizations'):
                for orgId in v:
                    # check if org exists
                    try:
                        orgObj = Organization.objects.get(pk=orgId)
                        obj.registered_organizations.add(orgObj)
                        obj.save()
                    except Organization.DoesNotExist as e:
                        pass
            elif k.startswith('tags'):
                # create new tags
                tag = TagDataset(dataset=obj,text=v)
                tag.save()
    
        return Response(self.get_serializer(obj).data)
    
    def retrieve(self,request,*args,**kwargs):
        obj_id = kwargs['pk']
        obj = DataSet.objects.get(id=obj_id)
        # ONLY ALLOW USER TO SEE FILE IF THE FOLLOWING CONDITIONS ARE MEET
        # 1. DataSet is public OR
        # 2. User owns file OR
        # 3. User is part of org with file
        serialized = self.get_serializer(obj)
        return Response(serialized.data)

# tagviewset api
# Sets the view to the tag of a csv file
class ViewsetTagDataset(viewsets.ModelViewSet):
    permission_classes = [
        permissions.IsAuthenticated
    ]

    serializer_class = SerializerTagDataset

    # never use this, just need for api to work
    def get_queryset(self):
        return TagDataset.objects.all()
    
    def create(self,request):
        # file is file id
        file = DataSet.objects.get(pk=request.data.get('file'))
        # text is an array
        arrTags = request.data.get('tags')
        newTags = []
        for tag in arrTags:
            tag = TagDataset(file=file,text=tag)
            tag.save()
            newTags.append(tag)

        return Response(self.get_serializer(newTags,many=True).data)


# Parse file view
# Handles parsing of CSV and Excel files and returns data as JSON
class ParseFileView(APIView):
    permission_classes = [permissions.AllowAny]
    parser_classes = (MultiPartParser,)

    def post(self, request):
        """
        Parse an uploaded CSV or Excel file and return columns and rows.
        Automatically saves the parsed data to SQLite database and updates File model.
        
        Query parameters:
        - dataset_id: Optional, to associate the file with a dataset
        - file_id: Optional, to update an existing File object
        
        Expects: file parameter in multipart form data
        Returns: {headers: [...], rows: [...], table_name: '...', rows_saved: N}
        """
        try:
            file = request.FILES.get('file')
            
            if not file:
                return Response(
                    {'error': 'No file provided'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            file_name = file.name.lower()
            
            # Get optional parameters for File model association
            dataset_id = request.query_params.get('dataset_id') or request.data.get('dataset_id')
            file_id = request.query_params.get('file_id') or request.data.get('file_id')
            
            # Get or create File object if dataset_id is provided
            file_obj = None
            if file_id:
                try:
                    file_obj = File.objects.get(id=file_id)
                    logger.info(f"Found existing File object: {file_id}")
                except File.DoesNotExist:
                    logger.warning(f"File object {file_id} not found")
            elif dataset_id:
                try:
                    dataset = DataSet.objects.get(id=dataset_id)
                    # Create new File object
                    file_obj = File(
                        dataset=dataset,
                        file_name=file.name,
                        file_path=f'uploads/{dataset_id}/{file.name}'
                    )
                    file_obj.save()
                    logger.info(f"Created new File object for dataset {dataset_id}: {file_obj.id}")
                except DataSet.DoesNotExist:
                    logger.warning(f"Dataset {dataset_id} not found, continuing without File model update")
            
            # Check file extension
            if file_name.endswith('.xlsx') or file_name.endswith('.xls'):
                return self._parse_and_save_excel(file, file_obj=file_obj)
            elif file_name.endswith('.csv'):
                return self._parse_and_save_csv(file, file_obj=file_obj)
            else:
                return Response(
                    {'error': 'Unsupported file format. Please upload CSV or Excel file.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            logger.exception(f"Error in ParseFileView: {str(e)}")
            return Response(
                {'error': f'Error parsing file: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    def _generate_table_name(self, file_name):
        """Generate a valid SQLite table name from filename"""
        # Remove file extension
        table_name = os.path.splitext(file_name)[0]
        
        # Convert to lowercase, replace spaces and hyphens with underscores
        table_name = table_name.lower().replace(' ', '_').replace('-', '_')
        
        # Remove any special characters, keep only alphanumeric and underscores
        table_name = ''.join(c for c in table_name if c.isalnum() or c == '_')
        
        # Remove leading underscores/numbers and ensure it's a valid identifier
        table_name = 'tbl_' + table_name[-50:] if table_name else 'tbl_data'
        
        return table_name

    def _save_to_sqlite(self, df, file_name):
        """Save DataFrame to SQLite database and return table name"""
        try:
            table_name = self._generate_table_name(file_name)
            db_path = django_settings.DATABASES['default']['NAME']
            
            logger.info(f"Saving parsed data to SQLite: {db_path}, table: {table_name}")
            conn = sqlite3.connect(db_path)
            
            # Save DataFrame to SQLite, replace if exists
            df.to_sql(table_name, con=conn, if_exists='replace', index=False)
            conn.close()
            
            logger.info(f"Successfully saved {len(df)} rows to table {table_name}")
            return table_name, len(df)
            
        except Exception as e:
            logger.error(f"Error saving to SQLite: {str(e)}")
            raise

    def _parse_and_save_excel(self, file, file_obj=None):
        """Parse Excel file, save to SQLite and return data using pandas"""
        try:
            file_bytes = file.read()
            df = pd.read_excel(BytesIO(file_bytes))

            # Handle NaN values
            df = df.fillna('')

            # Save to SQLite
            table_name, rows_saved = self._save_to_sqlite(df, file.name)

            # Save table_name to File model if file_obj provided
            if file_obj:
                file_obj.table_name = table_name
                file_obj.save()
                logger.info(f"Updated File {file_obj.id} with table_name: {table_name}")
                
                # Also update dataset's table_name if not already set
                if file_obj.dataset and not file_obj.dataset.table_name:
                    file_obj.dataset.table_name = table_name
                    file_obj.dataset.save()
                    logger.info(f"Updated Dataset {file_obj.dataset.id} with default table_name: {table_name}")

            headers = list(df.columns)
            rows = df.to_dict('records')

            return Response({
                'headers': headers,
                'rows': rows,
                'shape': [len(rows), len(headers)],
                'table_name': table_name,
                'rows_saved': rows_saved,
                'file_id': file_obj.id if file_obj else None,
                'message': f'File parsed and saved to database table: {table_name}'
            })
        except Exception as e:
            logger.exception(f"Error parsing Excel file: {str(e)}")
            return Response(
                {'error': f'Error parsing Excel file: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    def _parse_and_save_csv(self, file, file_obj=None):
        """Parse CSV file, save to SQLite and return data using pandas"""
        try:
            file_bytes = file.read()
            df = pd.read_csv(BytesIO(file_bytes))

            # Handle NaN values
            df = df.fillna('')

            # Save to SQLite
            table_name, rows_saved = self._save_to_sqlite(df, file.name)

            # Save table_name to File model if file_obj provided
            if file_obj:
                file_obj.table_name = table_name
                file_obj.save()
                logger.info(f"Updated File {file_obj.id} with table_name: {table_name}")
                
                # Also update dataset's table_name if not already set
                if file_obj.dataset and not file_obj.dataset.table_name:
                    file_obj.dataset.table_name = table_name
                    file_obj.dataset.save()
                    logger.info(f"Updated Dataset {file_obj.dataset.id} with default table_name: {table_name}")

            headers = list(df.columns)
            rows = df.to_dict('records')

            return Response({
                'headers': headers,
                'rows': rows,
                'shape': [len(rows), len(headers)],
                'table_name': table_name,
                'rows_saved': rows_saved,
                'columns': headers,
                'file_id': file_obj.id if file_obj else None,
                'message': f'File parsed and saved to database table: {table_name}'
            })
        except Exception as e:
            logger.exception(f"Error parsing CSV file: {str(e)}")
            return Response(
                {'error': f'Error parsing CSV file: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )


# Batch Download View
# Allows users to download multiple datasets as a single ZIP file
class BatchDownloadDatasetsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """
        Download multiple datasets as a ZIP file.
        
        Request body: {
            "dataset_ids": [1, 2, 3, ...]
        }
        
        Returns: ZIP file containing all dataset files organized by dataset name
        """
        try:
            dataset_ids = request.data.get('dataset_ids', [])
            
            if not dataset_ids or not isinstance(dataset_ids, list):
                return Response(
                    {'error': 'Invalid or missing dataset_ids parameter'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get datasets - only public ones or ones owned by user
            datasets = DataSet.objects.filter(
                id__in=dataset_ids,
                is_public=True
            ) | DataSet.objects.filter(
                id__in=dataset_ids,
                author=request.user
            )
            datasets = datasets.distinct()
            
            if not datasets.exists():
                return Response(
                    {'error': 'No datasets found or you do not have permission to access them'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            logger.info(f"BatchDownloadDatasetsView: BASE_DIR = {django_settings.BASE_DIR}")
            logger.info(f"BatchDownloadDatasetsView: MEDIA_ROOT = {django_settings.MEDIA_ROOT}")
            
            # Increment download count for each dataset
            for dataset in datasets:
                dataset.download_count += 1
                dataset.save()
            
            # Create ZIP file in memory
            buffer = BytesIO()
            files_added = 0
            
            with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
                for dataset in datasets:
                    files = dataset.files.all()
                    logger.info(f"Dataset {dataset.id} ({dataset.name}): {files.count()} files")
                    
                    if not files.exists():
                        logger.warning(f"Dataset {dataset.id} has no files")
                        continue
                    
                    for file_obj in files:
                        logger.info(f"Processing file: {file_obj.file_name} (path: {file_obj.file_path})")
                        
                        # Resolve file path - try multiple strategies
                        resolved_path = None
                        file_from_zip = None  # Track if we're extracting from a ZIP
                        
                        # Strategy 1: Check if absolute path exists as-is
                        if os.path.isabs(file_obj.file_path) and os.path.isfile(file_obj.file_path):
                            resolved_path = file_obj.file_path
                            logger.info(f"✓ Found at absolute path: {resolved_path}")
                        
                        # Strategy 2: Try relative to BASE_DIR
                        if not resolved_path:
                            rel_path = os.path.join(django_settings.BASE_DIR, file_obj.file_path)
                            if os.path.isfile(rel_path):
                                resolved_path = rel_path
                                logger.info(f"✓ Found relative to BASE_DIR: {resolved_path}")
                        
                        # Strategy 3: Try relative to MEDIA_ROOT
                        if not resolved_path and hasattr(django_settings, 'MEDIA_ROOT'):
                            media_path = os.path.join(django_settings.MEDIA_ROOT, file_obj.file_path)
                            if os.path.isfile(media_path):
                                resolved_path = media_path
                                logger.info(f"✓ Found relative to MEDIA_ROOT: {resolved_path}")
                        
                        # Strategy 4: Try removing leading slashes and relative to BASE_DIR
                        if not resolved_path:
                            clean_path = file_obj.file_path.lstrip('/')
                            rel_path = os.path.join(django_settings.BASE_DIR, clean_path)
                            if os.path.isfile(rel_path):
                                resolved_path = rel_path
                                logger.info(f"✓ Found with cleaned path: {resolved_path}")
                        
                        # Strategy 5: Search for file in BASE_DIR/static/users
                        if not resolved_path:
                            filename = os.path.basename(file_obj.file_path)
                            static_users_path = os.path.join(django_settings.BASE_DIR, 'static', 'users')
                            if os.path.exists(static_users_path):
                                logger.info(f"Searching for {filename} in {static_users_path}")
                                for root, dirs, filenames in os.walk(static_users_path):
                                    if filename in filenames:
                                        found_path = os.path.join(root, filename)
                                        logger.info(f"✓ Found in directory search: {found_path}")
                                        resolved_path = found_path
                                        break
                        
                        # Strategy 6: Files were deleted after zipping - look for dataset ZIP
                        if not resolved_path:
                            # The dataset ZIP is stored as: static/users/{username}/files/{dataset_name}.zip
                            # But the files are stored as: static/users/{username}/files/{dataset_name}/{filename}
                            # So we need to find the ZIP by looking at the file path structure
                            file_path_parts = file_obj.file_path.replace('\\', '/').split('/')
                            
                            # Expected format: ['static', 'users', 'username', 'files', 'dataset_name', ...files...]
                            if len(file_path_parts) >= 5 and file_path_parts[0] == 'static' and file_path_parts[1] == 'users':
                                username = file_path_parts[2]
                                # Get the parent directory and look for ZIP
                                user_static_path = os.path.join(django_settings.BASE_DIR, 'static', 'users', username, 'files')
                                
                                # Find all ZIPs in that directory
                                if os.path.exists(user_static_path):
                                    for zip_file in os.listdir(user_static_path):
                                        if zip_file.endswith('.zip'):
                                            zip_path = os.path.join(user_static_path, zip_file)
                                            logger.info(f"Checking ZIP {zip_path} for {file_obj.file_name}")
                                            
                                            try:
                                                with zipfile.ZipFile(zip_path, 'r') as zf_src:
                                                    # Check if our file is in this ZIP
                                                    for name_in_zip in zf_src.namelist():
                                                        if os.path.basename(name_in_zip) == file_obj.file_name or name_in_zip.endswith(file_obj.file_name):
                                                            logger.info(f"✓ Found {file_obj.file_name} in ZIP: {zip_path}")
                                                            file_from_zip = {
                                                                'zip_path': zip_path,
                                                                'zip_name': name_in_zip,
                                                                'data': zf_src.read(name_in_zip)
                                                            }
                                                            break
                                            except zipfile.BadZipFile:
                                                logger.warning(f"Invalid ZIP file: {zip_path}")
                                                continue
                                            
                                            if file_from_zip:
                                                break
                        
                        if file_from_zip:
                            logger.info(f"Adding file from ZIP: {file_obj.file_name}")
                            try:
                                # Create folder structure: dataset_name/filename
                                arcname = os.path.join(dataset.name.replace('/', '_'), file_obj.file_name)
                                zf.writestr(arcname, file_from_zip['data'])
                                files_added += 1
                                logger.info(f"✓ Added to ZIP as {arcname}")
                            except Exception as e:
                                logger.error(f"Error adding file from ZIP {file_from_zip['zip_path']}: {str(e)}")
                                continue
                        elif resolved_path:
                            try:
                                file_size = os.path.getsize(resolved_path)
                                logger.info(f"Adding file: {file_obj.file_name} (size: {file_size} bytes)")
                                
                                # Create folder structure: dataset_name/filename
                                arcname = os.path.join(dataset.name.replace('/', '_'), file_obj.file_name)
                                zf.write(resolved_path, arcname=arcname)
                                files_added += 1
                                logger.info(f"✓ Added to ZIP as {arcname}")
                            except Exception as e:
                                logger.error(f"Error adding file {resolved_path} to ZIP: {str(e)}")
                                continue
                        else:
                            logger.error(f"✗ File not found: {file_obj.file_name}")
                            logger.error(f"  Original path: {file_obj.file_path}")
                            logger.error(f"  Tried (BASE_DIR): {os.path.join(django_settings.BASE_DIR, file_obj.file_path)}")
                            if hasattr(django_settings, 'MEDIA_ROOT'):
                                logger.error(f"  Tried (MEDIA_ROOT): {os.path.join(django_settings.MEDIA_ROOT, file_obj.file_path)}")
                            logger.error(f"  BASE_DIR: {django_settings.BASE_DIR}")
                            logger.error(f"  Current working dir: {os.getcwd()}")
            
            logger.info(f"ZIP creation complete. Total files added: {files_added}")
            
            buffer.seek(0)
            
            if files_added == 0:
                logger.warning(f"WARNING: ZIP contains no files for {len(datasets)} dataset(s)")
            
            # Create response
            zip_size = len(buffer.getvalue())
            response = HttpResponse(buffer.getvalue(), content_type='application/zip')
            response['Content-Disposition'] = 'attachment; filename="datasets.zip"'
            response['Content-Length'] = zip_size
            
            logger.info(f"Successfully created ZIP download: {zip_size} bytes, {files_added} files")
            return response
            
        except Exception as e:
            logger.exception(f"Error in BatchDownloadDatasetsView: {str(e)}")
            return Response(
                {'error': f'Error creating download: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# Dataset Table View
# Fetches table data from SQLite for displaying in the table viewer
class DatasetTableView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, dataset_id, file_id=None):
        """
        Parse and return data from a dataset's database table.
        
        URL patterns:
        - /api/dataset_table/{dataset_id}/{file_id}/ - specific file
        - /api/dataset_table/{dataset_id}/ - dataset default table
        
        Query params:
        - limit: Number of rows to return (default: 500, max: 10000)
        - offset: Number of rows to skip (default: 0)
        """
        try:
            # Validate and parse incoming parameters
            try:
                dataset_id = int(dataset_id)
                if file_id:
                    file_id = int(file_id)
            except (ValueError, TypeError):
                logger.warning(f"Invalid parameter types: dataset_id={dataset_id}, file_id={file_id}")
                return Response({'error': 'Invalid dataset_id or file_id format'}, status=400)
            
            # Get query parameters
            limit = min(int(request.query_params.get('limit', 500)), 10000)
            offset = int(request.query_params.get('offset', 0))
            
            # Fetch dataset
            try:
                dataset = DataSet.objects.get(id=dataset_id)
            except DataSet.DoesNotExist:
                logger.warning(f"Dataset {dataset_id} not found")
                return Response({'error': f'Dataset {dataset_id} not found'}, status=404)

            # Check permissions: owner, public, or org member
            if not (
                dataset.author == request.user or
                dataset.is_public or
                (request.user.organizations.exists() and
                 dataset.registered_organizations.filter(id__in=request.user.organizations.all()).exists())
            ):
                logger.warning(f"User {request.user.id} denied access to dataset {dataset_id}")
                return Response({'error': 'Permission denied'}, status=403)

            # Determine which table to query
            table_name = None
            file_obj = None
            
            if file_id:
                # Get specific file's table
                try:
                    file_obj = File.objects.get(id=file_id, dataset=dataset)
                    table_name = file_obj.table_name
                    logger.info(f"File {file_id} found for dataset {dataset_id}")
                except File.DoesNotExist:
                    logger.warning(f"File {file_id} not found in dataset {dataset_id}")
                    # List available files for debugging
                    available_files = list(dataset.files.values_list('id', 'file_name', 'table_name'))
                    return Response({
                        'error': f'File {file_id} not found in dataset {dataset_id}',
                        'available_files': [
                            {'id': f[0], 'name': f[1], 'table_name': f[2]} 
                            for f in available_files
                        ]
                    }, status=404)
            else:
                # Use dataset's default table
                table_name = dataset.table_name
                logger.info(f"Using dataset {dataset_id} default table: {table_name}")

            # Validate table_name
            if not table_name:
                logger.info(f"No cached table_name for file {file_id}, attempting auto-parse...")
                available_files = list(dataset.files.values('id', 'file_name', 'table_name'))
                
                files_with_tables = [f for f in available_files if f['table_name']]
                files_without_tables = [f for f in available_files if not f['table_name']]
                
                # Try to auto-parse the file if it has a parsable extension
                if file_obj and file_obj.file_path:
                    file_ext = file_obj.file_name.lower().split('.')[-1] if file_obj.file_name else ''
                    parsable_exts = ['csv', 'xlsx', 'xls']
                    
                    if file_ext in parsable_exts:
                        logger.info(f"Auto-parsing file {file_id}: {file_obj.file_name} ({file_ext})")
                        try:
                            # Parse the file
                            if file_ext == 'csv':
                                df = pd.read_csv(file_obj.file_path)
                            else:  # xlsx or xls
                                df = pd.read_excel(file_obj.file_path)
                            
                            # Handle NaN values
                            df = df.fillna('')
                            
                            # Generate table name (same logic as ParseFileView)
                            base_name = os.path.splitext(file_obj.file_name)[0]
                            table_name = base_name.lower().replace(' ', '_').replace('-', '_')
                            table_name = ''.join(c for c in table_name if c.isalnum() or c == '_')
                            table_name = 'tbl_' + table_name[-50:] if table_name else 'tbl_data'
                            
                            # Save to SQLite
                            db_path = django_settings.DATABASES['default']['NAME']
                            conn = sqlite3.connect(db_path)
                            df.to_sql(table_name, con=conn, if_exists='replace', index=False)
                            conn.close()
                            
                            # Update File object with table_name
                            file_obj.table_name = table_name
                            file_obj.save()
                            
                            # Update dataset's table_name if not set
                            if not dataset.table_name:
                                dataset.table_name = table_name
                                dataset.save()
                            
                            logger.info(f"Auto-parsed file {file_id} to table {table_name}")
                            # Continue with the normal flow
                        except Exception as e:
                            logger.error(f"Failed to auto-parse file {file_id}: {str(e)}")
                            # Continue to error response below
                
                # If still no table_name, return error
                if not table_name:
                    response_data = {
                        'error': 'No table data available for this dataset/file',
                        'dataset_id': dataset_id,
                        'file_id': file_id,
                        'details': {
                            'message': 'File needs to be re-uploaded or processed through the parser',
                            'files_with_data': files_with_tables,
                            'files_without_data': files_without_tables,
                            'action_required': len(files_without_tables) > 0
                        }
                    }
                    return Response(response_data, status=404)

            # Query database
            db_path = django_settings.DATABASES['default']['NAME']
            
            try:
                conn = sqlite3.connect(db_path)
                
                # Get total row count
                count_query = f'SELECT COUNT(*) as count FROM "{table_name}"'
                count_df = pd.read_sql(count_query, conn)
                total_count = count_df['count'].iloc[0] if len(count_df) > 0 else 0
                
                # Get data with limit and offset
                data_query = f'SELECT * FROM "{table_name}" LIMIT {limit} OFFSET {offset}'
                df = pd.read_sql(data_query, conn)
                conn.close()
                
                logger.info(f"Successfully retrieved {len(df)} rows from table '{table_name}' (total: {total_count})")
                
                return Response({
                    'success': True,
                    'headers': list(df.columns),
                    'rows': df.fillna('').to_dict('records'),
                    'row_count': len(df),
                    'total_rows': total_count,
                    'offset': offset,
                    'limit': limit,
                    'dataset_id': dataset_id,
                    'file_id': file_id,
                    'table_name': table_name
                }, status=200)
                
            except sqlite3.OperationalError as e:
                logger.error(f"Database query failed for table '{table_name}': {str(e)}")
                return Response({
                    'error': f'Table "{table_name}" does not exist or cannot be queried',
                    'details': str(e),
                    'dataset_id': dataset_id,
                    'table_name': table_name
                }, status=500)
            except Exception as e:
                logger.error(f"Unexpected error querying table '{table_name}': {str(e)}")
                raise
                
        except Exception as e:
            logger.exception(f"Unexpected error in DatasetTableView.get(): {str(e)}")
            return Response({
                'error': f'Server error: {str(e)}',
            }, status=500)
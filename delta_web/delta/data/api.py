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
            # Get all files in the dataset and parse them into a DataFrame
            logger.info(f"Parsing files for dataset {instance.id}")
            df = self._parse_dataset_files(instance)
            
            if df is None or df.empty:
                logger.error(f"No data found in dataset {instance.id}")
                return Response(
                    {'error': 'No data found in dataset'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            logger.info(f"Successfully parsed {len(df)} rows from dataset {instance.id}")
            
            # Table name: sanitize dataset name (remove special chars, use lowercase)
            table_name = instance.name.lower().replace(' ', '_').replace('-', '_')
            table_name = ''.join(c for c in table_name if c.isalnum() or c == '_')
            
            # Save to Django's existing SQLite database
            db_path = django_settings.DATABASES['default']['NAME']
            logger.info(f"Saving to database: {db_path}, table: {table_name}")
            conn = sqlite3.connect(db_path)
            
            # Save DataFrame to SQLite, replace if exists
            df.to_sql(table_name, con=conn, if_exists='replace', index=False)
            conn.close()
            
            # Save table_name to the DataSet model so it can be retrieved later
            instance.table_name = table_name
            instance.save()
            
            logger.info(f"Successfully saved dataset {instance.id} to table {table_name}")
            
            return Response({
                'message': 'Data successfully saved to SQLite',
                'table_name': table_name,
                'rows_saved': len(df),
                'columns': list(df.columns),
                'dataset_id': instance.id,
                'dataset_name': instance.name
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.exception(f"Error processing dataset {instance.id}: {str(e)}")
            return Response(
                {'error': f'Error processing dataset: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
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
        Automatically saves the parsed data to SQLite database.
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
            
            # Check file extension
            if file_name.endswith('.xlsx') or file_name.endswith('.xls'):
                return self._parse_and_save_excel(file)
            elif file_name.endswith('.csv'):
                return self._parse_and_save_csv(file)
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

    def _parse_and_save_excel(self, file):
        """Parse Excel file, save to SQLite and return data using pandas"""
        try:
            file_bytes = file.read()
            df = pd.read_excel(BytesIO(file_bytes))
            
            # Handle NaN values
            df = df.fillna('')
            
            # Save to SQLite
            table_name, rows_saved = self._save_to_sqlite(df, file.name)
            
            headers = list(df.columns)
            rows = df.to_dict('records')
            
            return Response({
                'headers': headers,
                'rows': rows,
                'shape': [len(rows), len(headers)],
                'table_name': table_name,
                'rows_saved': rows_saved,
                'message': f'File parsed and saved to database table: {table_name}'
            })
        except Exception as e:
            logger.exception(f"Error parsing Excel file: {str(e)}")
            return Response(
                {'error': f'Error parsing Excel file: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    def _parse_and_save_csv(self, file):
        """Parse CSV file, save to SQLite and return data using pandas"""
        try:
            file_bytes = file.read()
            df = pd.read_csv(BytesIO(file_bytes))
            
            # Handle NaN values
            df = df.fillna('')
            
            # Save to SQLite
            table_name, rows_saved = self._save_to_sqlite(df, file.name)
            
            headers = list(df.columns)
            rows = df.to_dict('records')
            
            return Response({
                'headers': headers,
                'rows': rows,
                'shape': [len(rows), len(headers)],
                'table_name': table_name,
                'rows_saved': rows_saved,
                'columns': headers,
                'message': f'File parsed and saved to database table: {table_name}'
            })
        except Exception as e:
            logger.exception(f"Error parsing CSV file: {str(e)}")
            return Response(
                {'error': f'Error parsing CSV file: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )


# Dataset Table View
# Fetches table data from SQLite for displaying in the table viewer
class DatasetTableView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, dataset_id):
        try:
            dataset = DataSet.objects.get(id=dataset_id, author=request.user)
            table_name = getattr(dataset, 'table_name', None)
            
            if not table_name:
                return Response({'error': 'No table data available'}, status=404)
            
            db_path = django_settings.DATABASES['default']['NAME']
            conn = sqlite3.connect(db_path)
            df = pd.read_sql(f'SELECT * FROM "{table_name}" LIMIT 500', conn)
            conn.close()

            return Response({
                'headers': list(df.columns),
                'rows': df.fillna('').to_dict('records'),
                'total_rows': len(df)
            })
        except Exception as e:
            return Response({'error': str(e)}, status=400)
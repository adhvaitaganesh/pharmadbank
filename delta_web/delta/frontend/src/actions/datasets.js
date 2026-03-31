import axios from 'axios';

import { createMessage, returnErrors } from "./messages";
import { fileTokenConfig, tokenConfig } from './auth';

import {
    ADD_DATASET,
    DELETE_DATASET,
    GET_DATASET,
    ADD_CART_ITEM,
    DELETE_CART_ITEM,
    DATASET_UPDATE_SUCCESS,
    GET_DATASETS_PUBLIC,
    USER_UPDATE_SUCCESS,
} from "./types";


// POST FILE 
export const addDataset = (dictData) => (dispatch, getState) => {
        return axios.post('/api/datasets/', dictData, fileTokenConfig(getState))
            .then((res) => {
                dispatch(createMessage({ addDatasetSuccess: "File Posted" }))
                dispatch({ type: ADD_DATASET, payload: res.data });
                return res;
            })
            .catch((err) => {
                console.log(err)
            })
    }
    // GET FILES
export const getDatasets = () => (dispatch, getState) => {
    axios.get('/api/datasets/', tokenConfig(getState))
        .then(res => {
            return res;
        })
        .catch(err => dispatch(
            returnErrors(err.response.data, err.response.status)
        ))
}

// GET FILE by ID
export const getDataset = (id) => (dispatch, getState) => {
        axios.get(`/api/datasets/${id}/`, tokenConfig(getState))
            .then(res => {
                dispatch({
                    type: GET_DATASET,
                    payload: res.data
                })
            })
            .catch(err => {
                dispatch(
                    returnErrors(err.response.data, err.response.status))
            })
    }
    // dict data expects:
    /*
    file_name
    description
    is_public
    is_public_orgs
    registered_organizations
    tags
    id (id of file)
    */
export const updateDataset = (dictData) => (dispatch, getState) => {
    axios.patch(`api/datasets/${dictData['id']}/`, dictData, fileTokenConfig(getState))
        .then(res => {
            dispatch(createMessage({ updateDatasetSuccess: "File successfully updated." }))
            dispatch({
                type: DATASET_UPDATE_SUCCESS,
                payload: res.data
            })
        })
        .catch((err) => {
            console.log(err)
        })
}

// DELETE FILE
export const deleteDataset = (id) => (dispatch, getState) => {
    axios.delete(`api/datasets/${id}/`, fileTokenConfig(getState))
        .then(res => {
            dispatch(createMessage({ deleteDataset: "dataset File Deleted" }));
            dispatch({
                type: DELETE_DATASET,
                payload: id
            });
        })
        .catch(err => { console.log(err) });
}

// GET PUBLIC FILES
export const getDatasetsPublic = () => (dispatch, getState) => {
    axios.get('/api/public_datasets/', tokenConfig(getState))
        .then(res => {
            dispatch({
                type: GET_DATASETS_PUBLIC,
                payload: res.data
            })
        })
        .catch(err => {})
}

// DOWNLOAD A FILE
//  id is of file object
// to do: 
// these should all be zips
export const downloadDataset = (id) => (dispatch, getState) => {
    var config = tokenConfig(getState)
    config['responseType'] = "arraybuffer"
    axios.get(`/api/public_datasets/${id}/download`, config)
        .then(res => {
            var fileContent = res.data;
            // Extract filename from Content-Disposition header
            var contentDisposition = res.headers['content-disposition'] || '';
            var fileName = 'dataset.zip'; // default fallback

            if (contentDisposition) {
                // Parse: attachment; filename="name.zip"
                var match = contentDisposition.match(/filename="?([^"]+)"?/);
                if (match && match[1]) {
                    fileName = match[1].replace(/"/g, ''); // Remove quotes
                }
            }

            console.log('Download filename:', fileName);

            var blob = new Blob([fileContent], { type: "application/zip" });
            // Create a link element and trigger the download
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob)
            link.download = fileName;
            link.click();

            // Clean up the URL object
            setTimeout(() => URL.revokeObjectURL(link.href), 100);
        })
        .catch(err => {
            console.error('Download error:', err);
            alert('Error downloading file. Check console for details.');
        })
}
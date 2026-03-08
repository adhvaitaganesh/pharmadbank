import axios from 'axios';
import {createMessage,returnErrors} from "./messages";
import {tokenConfig} from "./auth";

export const joinOrganization = (name, key) => (dispatch, getState) => {
    return axios.post('/api/organization/join/', { name, key }, tokenConfig(getState))
        .then((res) => {
            dispatch(createMessage({ joinOrganizationSuccess: res.data.detail || "Joined organization." }));
            return res.data;
        })
        .catch((err) => {
            if (err.response) {
                dispatch(returnErrors(err.response.data, err.response.status));
                dispatch(createMessage({ joinOrganizationFail: err.response.data.detail || "Failed to join organization." }));
            }
            throw err;
        });
};

export const leaveOrganization = (orgId) => (dispatch, getState) => {
    return axios.post(`/api/organization/${orgId}/leave/`, {}, tokenConfig(getState))
        .then((res) => {
            dispatch(createMessage({ leaveOrganizationSuccess: res.data.detail || "Left organization." }));
            return res.data;
        })
        .catch((err) => {
            if (err.response) {
                dispatch(returnErrors(err.response.data, err.response.status));
                dispatch(createMessage({ leaveOrganizationFail: err.response.data.detail || "Failed to leave organization." }));
            }
            throw err;
        });
};

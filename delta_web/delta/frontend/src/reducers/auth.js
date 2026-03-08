/*
###############################################################################

Delta project

File name:  auth.js

Brief description: 
    This file handles a variety of different actions relating to 
authentication. This is mostly with login/logout and registration.

###############################################################################
*/

import {
    USER_LOADED,
    USER_LOADING,
    USER_DELETE,
    AUTH_ERROR,
    LOGIN_SUCCESS,
    LOGIN_FAIL,
    LOGOUT_SUCCESS,
    REGISTER_SUCCESS,
    REGISTER_FAIL,
    USER_UPDATE_SUCCESS
} from "../actions/types"

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

const clearLegacySharedAuth = () => {
    // Never read token from localStorage: it is shared across tabs.
    // We only clear old values left by previous builds.
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
};

clearLegacySharedAuth();

const initialState = {
    // token stored in session storage (tab-scoped)
    token: sessionStorage.getItem(TOKEN_KEY),
    // this was originally null
    isAuthenticated: false, //localStorage.getItem('isAuthenticated') != undefined ? true : false,
    isLoading: false,
    // this was originally null
    user: null
}

export default function(state=initialState, action){
    switch(action.type){
        case USER_LOADING:
            return {...state, isLoading:true};
        case USER_LOADED:
            return {
                ...state,
                isAuthenticated: true,
                isLoading:false,
                user: action.payload
            }
        case USER_UPDATE_SUCCESS:
            return {
                ...state,
                ...action.payload,
                isAuthenticated:true,
                isLoading:false,
            }
        case LOGIN_SUCCESS:
        case REGISTER_SUCCESS:
            // when login successfully gives user a token
            sessionStorage.setItem(TOKEN_KEY, action.payload.token);
            sessionStorage.setItem(USER_KEY, JSON.stringify(action.payload.user));
            return {
                ...state,
                ...action.payload,
                isAuthenticated:true,
                isLoading:false,
            }
        // login fail and auth error do the same thing atm
        case AUTH_ERROR:
        case LOGIN_FAIL:
        case LOGOUT_SUCCESS:
        case USER_DELETE:
        case REGISTER_FAIL:
            // destroy token
            sessionStorage.removeItem(TOKEN_KEY);
            sessionStorage.removeItem(USER_KEY);
            return{
                ...state,
                token:null,
                user:null,
                isAuthenticated:false,
                isLoading:false
            }
        default:
            return state;
    }
}

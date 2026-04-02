/*
###############################################################################

Delta project

Authors:
Lexington Whalen (@lxaw)

File name:  DataDownload.js

Brief description: 
    This file defines the layout of the public data download page.

###############################################################################
*/




import React, {useState,useEffect} from 'react';
import { connect } from 'react-redux';
import DataSetTable from './DataSetTable';
import axios from "axios";

const DataDownload = (props) =>{
    // the csv files
    const [dataSets, setDataSets] = useState(undefined);

    // UTILITY: Grabs all public csv files
    const getCsvs = () =>{
        const headers = {'Content-Type':'application/json'};
        if (props.auth?.token) {
            headers['Authorization'] = `Token ${props.auth.token}`;
        }
        axios.get('/api/public_datasets/', { headers })
        .then(res=>{
        setDataSets(res.data);
        })
    }
    
    // on load call this
    useEffect(()=>{
        getCsvs()
    },[])

    if (dataSets == undefined) return <div data-testid="data_download-1"></div>;

    return(
        <div className="container" data-testid="data_download-1">
            <div>
                <h1>
                    Search Datasets
                </h1>
                <p>
                    Click on a dataset to view it. From viewing, you can also add the dataset to your downloads. You can search datasets by file name or by tags.
                </p>
            </div>
            <DataSetTable 
            dataSets= {dataSets}
            textMinLength = {3}
            refreshCsvs = {getCsvs}
            />
        </div>
    )
}
const mapStateToProps = state => ({
  auth:state.auth
});

export default connect(mapStateToProps,{})(DataDownload);

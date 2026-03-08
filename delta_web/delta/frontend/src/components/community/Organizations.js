/************************************************
 * Delta Project
 * 
 * Authors:
 * Lexington Whalen (@lxaw)
 * Carter Marlowe (@Cmarlowe123)
 * Vince Kolb-Lugo (@vancevince)
 * Blake Seekings (@j-blake-s)
 * Naveen Chithan (@nchithan)
 * 
 * Organizations.js
 * 
 * This page displays all organizations registered with the Delta project.
 * Just makes a call to the organizations api to retrieve data and displays it
 * in an OrganizationCard. This page jumps to more detailed pages for 
 * each organization.
 ***********************************************/

import axios from 'axios';
import React, { useEffect, useState } from 'react';
import OrganizationCard from './OrganizationCard';
import { connect } from 'react-redux';

const Organizations = (props) => {
    // grab oraganization information
    const [orgData, setOrgData] = useState(null);
    const [newOrg, setNewOrg] = useState({ name: '', description: '' });
    const [createMsg, setCreateMsg] = useState('');
    const [generatedKey, setGeneratedKey] = useState('');

    const buildHeaders = () => {
        const headers = { 'Content-Type': 'application/json' };
        if (props.auth?.token) {
            headers['Authorization'] = `Token ${props.auth.token}`;
        }
        return headers;
    };

    // check that data loads
    useEffect(() => {
        axios.get('/api/organization/', { headers: buildHeaders() }).then((res) => {
            setOrgData(res.data);
        })
            .catch(err => {
                console.log(err)
            })
    }, [])

    const onCreateChange = (e) => {
        setNewOrg({ ...newOrg, [e.target.name]: e.target.value });
    };

    const onCreateOrg = (e) => {
        e.preventDefault();
        setCreateMsg('');
        setGeneratedKey('');
        axios.post('/api/organization/', newOrg, { headers: buildHeaders() })
            .then((res) => {
                setOrgData((items) => [res.data, ...(items || [])]);
                setNewOrg({ name: '', description: '' });
                setCreateMsg('Organization created successfully.');
                setGeneratedKey(res?.data?.generated_key || '');
            })
            .catch((err) => {
                const errText = err?.response?.data?.key?.[0] || err?.response?.data?.name?.[0] || 'Failed to create organization.';
                setCreateMsg(errText);
            });
    };

    if (orgData == null) return <div data-testid="organizations-1"></div>;

    return (
        <div className="container" data-testid="organizations-1">
            <div>
                <h1 className="text-center">
                    Organizations
                </h1>
                <p className="text-center">
                    Here you can see all organizations registered with Delta. Click an organization to view it.
                </p>
            </div>
            <div className="card p-3 mb-3">
                <h5>Create Organization</h5>
                <form onSubmit={onCreateOrg}>
                    <div className="mb-2">
                        <label htmlFor="org_name" className="form-label">Organization Name</label>
                        <input id="org_name" name="name" className="form-control" value={newOrg.name} onChange={onCreateChange} required />
                    </div>
                    <div className="mb-2">
                        <label htmlFor="org_desc" className="form-label">Description</label>
                        <textarea id="org_desc" name="description" className="form-control" value={newOrg.description} onChange={onCreateChange} />
                    </div>
                    <button className="btn btn-primary" type="submit">Create</button>
                    {createMsg && <div className="mt-2">{createMsg}</div>}
                    {generatedKey && (
                        <div className="mt-2 alert alert-warning">
                            <strong>Save this key now:</strong> <code>{generatedKey}</code>
                        </div>
                    )}
                </form>
            </div>
            <div className='row'>
                {orgData.map((item, index) => (
                    <OrganizationCard
                        orgObj={item}
                        key={index}
                    />
                ))}
            </div>
        </div>
    )
}


const mapStateToProps = (state) => ({
    auth: state.auth,
});

export default connect(mapStateToProps, {})(Organizations);

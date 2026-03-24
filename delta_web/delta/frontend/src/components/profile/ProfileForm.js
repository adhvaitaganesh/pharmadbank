import React, { useState, useEffect } from 'react';
import { connect } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { updateUser, loadUser } from "../../actions/auth";
import { joinOrganization, leaveOrganization } from "../../actions/organization";

const ProfileForm = (props) => {
  if (!props.auth.user.username) return null;

  const location = useLocation();

  const [userInfo, setUserInfo] = useState(() => {
    const params = new URLSearchParams(location.search);
    return {
      username: props.auth.user.username,
      first_name: props.auth.user.first_name,
      last_name: props.auth.user.last_name,
      email: props.auth.user.email,
      bio: props.auth.user.bio,
      password: "",
      org_key: params.get('key') || "",
      org_name: params.get('org') || "",
    };
  });

  const [joinMsg, setJoinMsg] = useState(
    new URLSearchParams(location.search).get('org')
      ? 'Invite link detected — review the details below and click Join.'
      : ''
  );

  const onChange = (e) => {
    setUserInfo({ ...userInfo, [e.target.name]: e.target.value });
  };

  const onSubmit = (e) => {
    e.preventDefault();
    props.updateUser(userInfo);
  };

  const onJoinOrg = (e) => {
    e.preventDefault();
    if (!userInfo.org_name || !userInfo.org_key) {
      return;
    }
    setJoinMsg('');
    props.joinOrganization(userInfo.org_name, userInfo.org_key)
      .then(() => {
        setUserInfo({ ...userInfo, org_name: "", org_key: "" });
        setJoinMsg('Successfully joined organization!');
        props.loadUser();
      })
      .catch(() => {
        setJoinMsg('Failed to join organization. Check the name and key.');
      });
  };

  const onLeaveOrg = (orgId) => {
    props.leaveOrganization(orgId)
      .then(() => props.loadUser())
      .catch(() => {});
  };

  return (
    <form onSubmit={onSubmit} data-testid="profile_form-1" className="my-4">
      <div className="row">
        <div className="col-md-6">
          <div className="mb-3">
            <label htmlFor="first_name" className="form-label">First Name</label>
            <input
              type="text"
              className="form-control"
              id="first_name"
              name="first_name"
              value={userInfo.first_name}
              onChange={onChange}
              placeholder="Enter your first name"
            />
          </div>
          <div className="mb-3">
            <label htmlFor="last_name" className="form-label">Last Name</label>
            <input
              type="text"
              className="form-control"
              id="last_name"
              name="last_name"
              value={userInfo.last_name}
              onChange={onChange}
              placeholder="Enter your last name"
            />
          </div>
          <div className="mb-3">
            <label htmlFor="email" className="form-label">Email</label>
            <input
              type="email"
              className="form-control"
              id="email"
              name="email"
              value={userInfo.email}
              onChange={onChange}
              placeholder="Enter your email"
            />
          </div>
          <div className="mb-3">
            <label htmlFor="username" className="form-label">Username</label>
            <input
              type="text"
              className="form-control"
              id="username"
              name="username"
              value={userInfo.username}
              onChange={onChange}
              placeholder="Enter your username"
            />
          </div>
          <div className="mb-3">
            <label htmlFor="password" className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              id="password"
              name="password"
              value={userInfo.password}
              onChange={onChange}
              placeholder="Enter a new password or leave blank for no change"
            />
          </div>
        </div>
        <div className="col-md-6">
          <div className="mb-3">
            <label htmlFor="textareaBio" className="form-label">Bio</label>
            <textarea
              id="textareaBio"
              className="form-control"
              name="bio"
              value={userInfo.bio}
              onChange={onChange}
              placeholder="Write a little bit about yourself, your work, or your interests"
              rows="4"
            ></textarea>
          </div>
          <div className="mb-3">
            <label className="form-label">Currently Followed Organizations</label>
            {props.auth.user.followed_organizations.length === 0 ? (
              <p>Not part of any Organizations</p>
            ) : (
              <div className="row">
                {props.auth.user.followed_organizations.map((orgObj, index) => (
                  <div className="col-md-12 mb-2 d-flex justify-content-between border p-2" key={index}>
                    <span>{orgObj.name}</span>
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => onLeaveOrg(orgObj.id)}
                    >
                      Leave
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mb-3">
            <label htmlFor="org_name" className="form-label">Join Organization via Secret Key</label>
            {joinMsg && (
              <div className={`alert ${joinMsg.startsWith('Successfully') ? 'alert-success' : 'alert-info'} py-1 mb-2`}>
                {joinMsg}
              </div>
            )}
            <input
              className="form-control mb-1"
              id="org_name"
              name="org_name"
              value={userInfo.org_name}
              onChange={onChange}
              autoComplete="new-password"
              placeholder="Organization name"
            />
            <input
              type="password"
              className="form-control"
              id="org_key"
              name="org_key"
              value={userInfo.org_key}
              onChange={onChange}
              autoComplete="new-password"
              placeholder="Organization key"
            />
            <small className="form-text text-muted">
              All organizations have a secret key; admins of the organizations will provide the key to you if you
              are supposed to be in the organization.
            </small>
            <div className="mt-2">
              <button className="btn btn-outline-primary btn-sm" type="button" onClick={onJoinOrg}>
                Join Organization
              </button>
            </div>
          </div>
        </div>
      </div>
      <div>
        <button type="submit" className="btn btn-primary">Update Information</button>
      </div>
    </form>
  );
};

const mapStateToProps = (state) => ({
  auth: state.auth
});

export default connect(mapStateToProps, {
  updateUser,
  loadUser,
  joinOrganization,
  leaveOrganization,
})(ProfileForm);

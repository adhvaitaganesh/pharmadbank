import axios from "axios";
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { connect } from 'react-redux';
import DataSetTable from "../data_transfer/DataSetTable";
import styled from 'styled-components';
import { FaRocket, FaUsers, FaFileAlt, FaChevronLeft, FaCopy, FaSync } from 'react-icons/fa';

const Container = styled.div`
  margin: 0 auto;
  padding: 2rem;
  background-color: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 2rem;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 2rem;
  color: #333;
`;

const IconContainer = styled.div`
  display: flex;
  align-items: center;
  margin-right: 1rem;
`;

const Description = styled.p`
  font-size: 1.2rem;
  line-height: 1.5;
  color: #666;
`;

const StatsContainer = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 2rem;
`;

const Stat = styled.div`
  display: flex;
  align-items: center;
  margin-right: 2rem;
`;

const StatIcon = styled.div`
  margin-right: 0.5rem;
`;

const BackButton = styled(Link)`
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  color: #666;
  font-size: 1rem;
  margin-top: 2rem;

  &:hover {
    color: #333;
  }
`;

const IconBack = styled(FaChevronLeft)`
  margin-right: 0.5rem;
`;

const RoleBadge = styled.span`
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 6px;
  background-color: ${({ role }) =>
    role === 'owner' ? '#6f42c1' : role === 'admin' ? '#0d6efd' : '#6c757d'};
  color: #fff;
`;

const OrganizationDetail = (props) => {
  const [data, setData] = useState(null);
  const [dataPosts, setDataPosts] = useState(null);
  const [members, setMembers] = useState([]);
  const [memberUsername, setMemberUsername] = useState('');
  const [memberMsg, setMemberMsg] = useState('');
  const [orgKey, setOrgKey] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [copyMsg, setCopyMsg] = useState('');
  const { id } = useParams();

  const headers = { 'Content-Type': 'application/json' };
  if (props.auth?.token) {
    headers['Authorization'] = `Token ${props.auth.token}`;
  }

  const isManager = data?.is_owner || data?.is_admin;

  const getData = () => {
    axios.get(`/api/organization/${id}/`, { headers })
      .then((res) => setData(res.data));
  };

  const getPosts = () => {
    axios.get(`/api/organization/${id}/data_posts/`, { headers })
      .then((res) => setDataPosts(res.data));
  };

  const getMembers = () => {
    axios.get(`/api/organization/${id}/members/`, { headers })
      .then((res) => setMembers(res.data.members || []))
      .catch(() => setMembers([]));
  };

  const fetchKey = () => {
    axios.get(`/api/organization/${id}/key/`, { headers })
      .then((res) => {
        const key = res.data.key || '';
        setOrgKey(key);
        if (data?.name) {
          setInviteUrl(
            `${window.location.origin}/profile/settings?org=${encodeURIComponent(data.name)}&key=${encodeURIComponent(key)}`
          );
        }
      })
      .catch((err) => setMemberMsg(err?.response?.data?.detail || 'Failed to get key.'));
  };

  const rotateKey = () => {
    if (!window.confirm('Rotate the organization key? The old key will no longer work for joining.')) return;
    axios.post(`/api/organization/${id}/rotate_key/`, {}, { headers })
      .then((res) => {
        const key = res.data.key || '';
        setOrgKey(key);
        if (data?.name) {
          setInviteUrl(
            `${window.location.origin}/profile/settings?org=${encodeURIComponent(data.name)}&key=${encodeURIComponent(key)}`
          );
        }
        setMemberMsg('Key rotated successfully.');
      })
      .catch((err) => setMemberMsg(err?.response?.data?.detail || 'Failed to rotate key.'));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyMsg('Copied!');
      setTimeout(() => setCopyMsg(''), 2000);
    });
  };

  const addMember = (e) => {
    e.preventDefault();
    setMemberMsg('');
    axios.post(`/api/organization/${id}/members/add/`, { username: memberUsername }, { headers })
      .then((res) => {
        setMemberMsg(res.data.detail || 'Member added.');
        setMemberUsername('');
        getMembers();
      })
      .catch((err) => setMemberMsg(err?.response?.data?.detail || 'Failed to add member.'));
  };

  const removeMember = (username) => {
    setMemberMsg('');
    axios.post(`/api/organization/${id}/members/remove/`, { username }, { headers })
      .then((res) => {
        setMemberMsg(res.data.detail || 'Member removed.');
        getMembers();
      })
      .catch((err) => setMemberMsg(err?.response?.data?.detail || 'Failed to remove member.'));
  };

  const promoteAdmin = (username) => {
    setMemberMsg('');
    axios.post(`/api/organization/${id}/admins/add/`, { username }, { headers })
      .then((res) => {
        setMemberMsg(res.data.detail || 'Promoted to admin.');
        getMembers();
      })
      .catch((err) => setMemberMsg(err?.response?.data?.detail || 'Failed to promote.'));
  };

  const demoteAdmin = (username) => {
    setMemberMsg('');
    axios.post(`/api/organization/${id}/admins/remove/`, { username }, { headers })
      .then((res) => {
        setMemberMsg(res.data.detail || 'Demoted from admin.');
        getMembers();
      })
      .catch((err) => setMemberMsg(err?.response?.data?.detail || 'Failed to demote.'));
  };

  useEffect(() => {
    getData();
    getPosts();
  }, []);

  useEffect(() => {
    if (isManager) {
      getMembers();
    }
  }, [data?.is_owner, data?.is_admin]);

  if (data == null || dataPosts == null) return <div data-testid="organization_detail-1"></div>;

  const memberRole = (member) => {
    if (member.is_owner) return 'owner';
    if (member.is_admin) return 'admin';
    return 'member';
  };

  return (
    <Container data-testid="organization_detail-1">
      <Header>
        <IconContainer>
          <FaRocket size={32} color="#333" />
        </IconContainer>
        <Title>{data.name}</Title>
        {!data.is_public && (
          <span className="badge bg-secondary ms-3" style={{ fontSize: '0.9rem' }}>Private</span>
        )}
      </Header>

      <StatsContainer>
        <Stat>
          <StatIcon><FaUsers size={20} color="#666" /></StatIcon>
          {data.following_user_count} users
        </Stat>
        <Stat>
          <StatIcon><FaFileAlt size={20} color="#666" /></StatIcon>
          {dataPosts.length} Data Sets
        </Stat>
      </StatsContainer>

      <Description>{data.description}</Description>

      <h4>All files under this organization</h4>
      <small>When you upload a file, you can set it to be under any of the organizations you are also a part of.</small>
      <DataSetTable dataSets={dataPosts} textMinLength={3} />

      {isManager && (
        <div className="mt-4">
          <h4>
            {data.is_owner ? 'Owner Management' : 'Admin Management'}
          </h4>

          {/* Key section */}
          <div className="mb-3">
            <button className="btn btn-outline-secondary btn-sm me-2" onClick={fetchKey}>
              Show Organization Key
            </button>
            <button className="btn btn-outline-warning btn-sm" onClick={rotateKey}>
              <FaSync size={12} className="me-1" /> Rotate Key
            </button>
            {orgKey && (
              <div className="mt-2">
                <code>{orgKey}</code>
                <button
                  className="btn btn-link btn-sm ms-2 p-0"
                  onClick={() => copyToClipboard(orgKey)}
                  title="Copy key"
                >
                  <FaCopy size={14} />
                </button>
              </div>
            )}
            {inviteUrl && (
              <div className="mt-2">
                <label className="form-label fw-semibold">Invite Link</label>
                <div className="d-flex align-items-center gap-2">
                  <input
                    className="form-control form-control-sm"
                    readOnly
                    value={inviteUrl}
                    style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                  />
                  <button
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => copyToClipboard(inviteUrl)}
                  >
                    <FaCopy size={12} /> Copy
                  </button>
                </div>
              </div>
            )}
            {copyMsg && <small className="text-success ms-2">{copyMsg}</small>}
          </div>

          {/* Add member */}
          <form onSubmit={addMember} className="mb-3">
            <label className="form-label">Add member by username</label>
            <div className="d-flex gap-2">
              <input
                className="form-control"
                value={memberUsername}
                onChange={(e) => setMemberUsername(e.target.value)}
                placeholder="username"
              />
              <button className="btn btn-primary btn-sm" type="submit">Add</button>
            </div>
          </form>

          {memberMsg && <div className="mb-2 text-info">{memberMsg}</div>}

          {/* Members list */}
          <div>
            <strong>Members</strong>
            {members.length === 0 ? (
              <div>No members found.</div>
            ) : (
              members.map((member) => (
                <div key={member.id} className="d-flex justify-content-between align-items-center border p-2 my-1 rounded">
                  <span>
                    {member.username}
                    <RoleBadge role={memberRole(member)}>
                      {memberRole(member).toUpperCase()}
                    </RoleBadge>
                  </span>
                  <div className="d-flex gap-2">
                    {/* Owner can promote/demote admins */}
                    {data.is_owner && !member.is_owner && (
                      member.is_admin ? (
                        <button
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => demoteAdmin(member.username)}
                        >
                          Demote
                        </button>
                      ) : (
                        <button
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => promoteAdmin(member.username)}
                        >
                          Make Admin
                        </button>
                      )
                    )}
                    {/* Owner can remove anyone; admin can only remove regular members */}
                    {!member.is_owner && (data.is_owner || !member.is_admin) && (
                      <button
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => removeMember(member.username)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Visibility toggle (owner only) */}
          {data.is_owner && (
            <div className="mt-3">
              <label className="form-label fw-semibold">Organization Visibility</label>
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="visibilityToggle"
                  checked={data.is_public}
                  onChange={(e) => {
                    const newVal = e.target.checked;
                    axios.patch(`/api/organization/${id}/`, { is_public: newVal }, { headers })
                      .then(() => setData((prev) => ({ ...prev, is_public: newVal })))
                      .catch(() => setMemberMsg('Failed to update visibility.'));
                  }}
                />
                <label className="form-check-label" htmlFor="visibilityToggle">
                  {data.is_public ? 'Public (visible to everyone)' : 'Private (only members can see this organization)'}
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      <BackButton to="/community/organizations">
        <IconBack />
        Back to Organizations
      </BackButton>
    </Container>
  );
};

const mapStateToProps = state => ({
  auth: state.auth,
});

export default connect(mapStateToProps, {})(OrganizationDetail);

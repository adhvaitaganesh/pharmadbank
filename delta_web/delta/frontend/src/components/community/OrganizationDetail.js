import axios from "axios";
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { connect } from 'react-redux';
import DataSetTable from "../data_transfer/DataSetTable";
import styled from 'styled-components';
import { FaRocket, FaUsers, FaFileAlt, FaChevronLeft } from 'react-icons/fa';

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

const OrganizationDetail = (props) => {
  const [data, setData] = useState(null);
  const [dataPosts, setDataPosts] = useState(null);
  const [members, setMembers] = useState([]);
  const [memberUsername, setMemberUsername] = useState('');
  const [memberMsg, setMemberMsg] = useState('');
  const [orgKey, setOrgKey] = useState('');
  const { id } = useParams();
  const headers = { 'Content-Type': 'application/json' };
  if (props.auth?.token) {
    headers['Authorization'] = `Token ${props.auth.token}`;
  }

  const getData = () => {
    axios.get(`/api/organization/${id}/`, { headers })
      .then((res) => {
        setData(res.data);
      })
  }

  const getPosts = () => {
    axios.get(`/api/organization/${id}/data_posts/`, { headers })
      .then((res) => {
        console.log(res)
        setDataPosts(res.data);
      })
  }

  const getMembers = () => {
    axios.get(`/api/organization/${id}/members/`, { headers })
      .then((res) => setMembers(res.data.members || []))
      .catch(() => setMembers([]));
  };

  const getOrgKey = () => {
    axios.get(`/api/organization/${id}/key/`, { headers })
      .then((res) => setOrgKey(res.data.key || ''))
      .catch((err) => {
        setMemberMsg(err?.response?.data?.detail || 'Failed to get key.');
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
      .catch((err) => {
        setMemberMsg(err?.response?.data?.detail || 'Failed to add member.');
      });
  };

  const removeMember = (username) => {
    setMemberMsg('');
    axios.post(`/api/organization/${id}/members/remove/`, { username }, { headers })
      .then((res) => {
        setMemberMsg(res.data.detail || 'Member removed.');
        getMembers();
      })
      .catch((err) => {
        setMemberMsg(err?.response?.data?.detail || 'Failed to remove member.');
      });
  };

  useEffect(() => {
    getData();
    getPosts();
  }, []);

  useEffect(() => {
    if (data?.is_owner) {
      getMembers();
    }
  }, [data?.is_owner]);

  if (data == null || dataPosts == null) return <div data-testid="organization_detail-1"></div>;

  return (
    <Container data-testid="organization_detail-1">
      <Header>
        <IconContainer>
          <FaRocket size={32} color="#333" />
        </IconContainer>
        <Title>{data.name}</Title>
      </Header>
      <StatsContainer>
        <Stat>
          <StatIcon>
            <FaUsers size={20} color="#666" />
          </StatIcon>
          {data.following_user_count} users
        </Stat>
        <Stat>
          <StatIcon>
            <FaFileAlt size={20} color="#666" />
          </StatIcon>
          {dataPosts.length} Data Sets
        </Stat>
      </StatsContainer>
      <Description>{data.description}</Description>
      <h4>All files under this organization</h4>
      <small>When you upload a file, you can set it to be under any of the organizations you are also a part of.</small>
      <DataSetTable dataSets={dataPosts} textMinLength={3} />
      {data?.is_owner && (
        <div className="mt-4">
          <h4>Owner Management</h4>
          <button className="btn btn-outline-secondary btn-sm mb-2" onClick={getOrgKey}>
            Show Organization Key
          </button>
          {orgKey && <div className="mb-2"><code>{orgKey}</code></div>}
          <form onSubmit={addMember} className="mb-3">
            <label className="form-label">Add member by username</label>
            <input
              className="form-control"
              value={memberUsername}
              onChange={(e) => setMemberUsername(e.target.value)}
              placeholder="username"
            />
            <button className="btn btn-primary btn-sm mt-2" type="submit">Add</button>
          </form>
          {memberMsg && <div className="mb-2">{memberMsg}</div>}
          <div>
            <strong>Members</strong>
            {members.length === 0 ? (
              <div>No members found.</div>
            ) : (
              members.map((member) => (
                <div key={member.id} className="d-flex justify-content-between align-items-center border p-2 my-1">
                  <span>
                    {member.username} {member.is_owner ? '(owner)' : ''}
                  </span>
                  {!member.is_owner && (
                    <button
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => removeMember(member.username)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
      <BackButton to="/community/organizations">
        <IconBack />
        Back to Organizations
      </BackButton>
    </Container>
  );
}

const mapStateToProps = state => ({
  auth: state.auth,
})

export default connect(mapStateToProps, {})(OrganizationDetail);

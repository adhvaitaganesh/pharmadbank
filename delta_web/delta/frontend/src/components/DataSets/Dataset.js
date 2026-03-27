import React from "react";
import { connect } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { downloadDataset, deleteDataset } from "../../actions/datasets";
import { createMessage } from "../../actions/messages";
import { addConversation, getUserConversations } from "../../actions/conversation";
import tag_styles from "../data_transfer/tags.module.css";

const Dataset = (props) => {
  const navigate = useNavigate();

  const clickDelete = () => {
    const dialog = window.confirm(
      "Would you like to delete this file? There is no going back."
    );
    if (dialog) {
      props.deleteDataset(props.data.id);
      navigate("/data/download");
    }
  };

  const clickDownload = () => {
    props.downloadDataset(props.data.id);
  };

  const clickContactOwner = async () => {
    const ownerUsername = props.data.author_username;

    try {
      const existing = await props.getUserConversations(ownerUsername);
      if (existing && existing.length > 0) {
        navigate(`/messages/conversations/${existing[0].id}`);
        return;
      }

      const title = `Access request: ${props.data.name}`;
      const res = await props.addConversation({
        author: props.auth.user.id,
        other_user_username: ownerUsername,
        title,
      });

      if (res && res.data && res.data.id) {
        navigate(`/messages/conversations/${res.data.id}`);
        return;
      }
    } catch (err) {
      console.error(err);
    }

    props.createMessage({
      downloadDatasetError:
        "Unable to start conversation. Please try again or contact the owner manually.",
    });
  };

  return (
    <div className="card m-2 p-3">
      <div className="d-flex justify-content-between">
        <div>
          <p>
            <Link to={`/profile/${props.data.author_username}`}>
              {props.data.author_username}
            </Link>
            -{props.data.formatted_date}
          </p>
        </div>
      </div>
      <div>
        <h4>Dataset Name: {props.data.name}</h4>
        <small>Download count: {props.data.download_count}</small>
        <hr />
        <div>{props.data.description}</div>
      </div>
      <div className="mt-3">
        <h6>Tags</h6>
        <div className="mb-2">
          {props.data.tags.map((objTag, index) => (
            <div className={tag_styles.tag_item} key={index}>
              <span className={tag_styles.text}>{objTag.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3">
        {props.auth.user.id === props.data.author ? (
          <div className="d-flex justify-content-between mt-3">
            <div>
              <Link to={`/datasets/${props.data.id}/edit`} className="btn btn-primary me-2">
                Edit
              </Link>
              <button className="btn btn-success" onClick={clickDownload}>
                Download
              </button>
            </div>
            <button onClick={clickDelete} className="btn btn-danger">
              Delete
            </button>
          </div>
        ) : props.data.is_public || props.data.is_public_orgs ? (
          <button className="btn btn-success" onClick={clickDownload}>
            Download
          </button>
        ) : (
          <button
            className="btn btn-secondary"
            onClick={clickContactOwner}
          >
            Contact Owner (Request Access)
          </button>
        )}
      </div>
    </div>
  );
};

const mapStateToProps = (state) => ({
  auth: state.auth,
});

export default connect(mapStateToProps, {
  deleteDataset,
  downloadDataset,
  createMessage,
  addConversation,
  getUserConversations,
})(Dataset);

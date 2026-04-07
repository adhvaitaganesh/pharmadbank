import React from "react";
import { connect } from "react-redux";

const About = (props) => {
  return (
    <>
      {/* insert logo here */}
      <img
        src="https://www.uni-saarland.de/fileadmin/upload/verwaltung/cd/Website_CD-Bilder-Bereich-Bildmarke-v2.png"
        alt="PharmaDBank Logo"
        style={{ width: "400px" }}
        className="mx-auto d-block mt-4"
      />
      
      <div className="container my-5">
        <section className="mb-5 text-center">
          <h1 className="display-4 mb-4">Welcome, Test User!</h1>
          <p className="lead">
            Thank you for participating in our additional feature testing. Below is a quick overview of the new capabilities available to you in PharmaDBank.
          </p>
        </section>

        <section className="row">
          {/* Data Management Section */}
          <div className="col-md-6 mb-4">
            <div className="card h-100 shadow-sm">
              <div className="card-body">
                <h3 className="card-title text-primary mb-3">Data Management</h3>
                <ul className="card-text" style={{ lineHeight: "1.6" }}>
                  <li><strong>File Handling:</strong> Easily delete individual files via edit mode, or batch download multiple datasets directly from the browse page without using a cart.</li>
                  <li><strong>Preview & Parse:</strong> Upload CSV or Excel files to automatically parse and view them as paginated tables in your browser.</li>
                  <li><strong>Row-Level Editing:</strong> Edit or delete specific rows of data directly within the file preview table, syncing changes instantly.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Organizations Section */}
          <div className="col-md-6 mb-4">
            <div className="card h-100 shadow-sm">
              <div className="card-body">
                <h3 className="card-title text-primary mb-3">Organizations</h3>
                <ul className="card-text" style={{ lineHeight: "1.6" }}>
                  <li><strong>Create & Discover:</strong> Set up public or private organizations (secured by unique Join Keys) and browse existing public communities.</li>
                  <li><strong>Membership:</strong> Join using a key during registration, via your profile, or directly on the org page. Leave at any time.</li>
                  <li><strong>Administration:</strong> Owners and admins can manage members, assign admin roles, rotate Join Keys, and lock dataset visibility to "org-only" access.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

      </div>
    </>
  );
};

const mapStateToProps = (state) => ({
  auth: state.auth,
});

export default connect(mapStateToProps, {})(About);

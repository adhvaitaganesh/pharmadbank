import React from "react";
import { connect } from "react-redux";

const About = (props) => {
  return (
    <>
      {/* insert logo here */}
      <img
        src="https://www.uni-saarland.de/fileadmin/upload/verwaltung/cd/Website_CD-Bilder-Bereich-Bildmarke-v2.png"
        alt="PharmaDBank Logo"
        //className="mb-4"
        style={{ width: "400px" }}
        // center image
        className="mx-auto d-block"
      />
    <div className="container my-5">
      <section className="mb-5">
        <h1 className="display-4 mb-4">About this Data Managment System</h1>
        <p className="lead">
          This is a prototype of a Data Management System we are building for Prof. Yildiz and Prof. Rahmann.
        </p>
      </section>

      <section>
        <p className="lead" style={{ fontSize: ".75rem" }}>
            (this was forked from the <a href="https://github.com/lxaw/DataDock">DataDock repository</a> on GitHub.)
          </p>
      </section>
    </div>
    </>
  );
};

const mapStateToProps = (state) => ({
  auth: state.auth,
});

export default connect(mapStateToProps, {})(About);
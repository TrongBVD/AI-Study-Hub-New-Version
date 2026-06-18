import { Link } from "react-router-dom";
import "./HeroSection.css";
import Logo from "../../../assets/logo/Logo.jsx";

function HeroSection() {
  return (
    <div className="main">
      <section className="hero">
        <nav className="navbar">
          <div className="logo">
            <Logo />
            <span>AI Study Hub</span>
          </div>

          <div className="nav_actions">
            <Link to = "/login" className="login_link">Log in</Link>
            <Link to = "/register" className="nav_btn">Sign up</Link>
          </div>
        </nav>

        <div className="hero_content">
          <div className="hero_text">
            <p className="hero_label">AI-powered study platform</p>

            <h1>
              Study smarter <br />
              with every <br />
              document
            </h1>

            <p className="hero_description">
              Upload your study materials, organize them by subject,
              and ask AI questions based on your own documents.
            </p>

            <div className="hero_buttons">
              <Link to="/register" className="primary_btn">Get started</Link>
              <Link to="/login" className="secondary_btn">Try AI Chat</Link>
            </div>
          </div>

          <div className="main_preview">
            <div className="preview_header">
              <span>AI Study Assistant</span>
              <span className="status_dot"></span>
            </div>

            <div className="preview_message user">
              Summarize this document for my exam.
            </div>

            <div className="preview_message ai">
              This document explains key software engineering concepts,
              including requirements, design, testing, and maintenance.
            </div>

            <div className="preview_input">
              Ask something about your document...
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default HeroSection;
import bookLogo from "../images/StudyHubBookLogo.svg";

function Logo({ className = "" }) {
  return (
    <span className={`github_logo ${className}`.trim()}>
      <img src={bookLogo} alt="Study Hub" />
    </span>
  );
}

export default Logo;

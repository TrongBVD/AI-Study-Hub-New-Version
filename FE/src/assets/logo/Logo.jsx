import currentThemeBookLogo from "../images/StudyHubBookLogo.svg";
import { useTheme } from "../../context/ThemeContext.jsx";

function Logo({ className = "" }) {
  const { theme } = useTheme();
  const isWhiteTheme = theme === "white";

  return (
    <span
      className={`github_logo github_logo_${isWhiteTheme ? "white" : "current"} ${className}`.trim()}
    >
      <img
        src={currentThemeBookLogo}
        alt="Study Hub"
      />
    </span>
  );
}

export default Logo;

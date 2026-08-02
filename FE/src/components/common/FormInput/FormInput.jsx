import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "./FormInput.css";

function FormInput({
  type = "text",
  label,
  className = "",
  name,
  value,
  onChange,
  placeholder = "",
  required = true,
  autoComplete = "off",
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordType = type === "password";
  const inputType = isPasswordType ? (showPassword ? "text" : "password") : type;

  return (
    <div className="form_input_group">
      <input
        className={`form_input ${className} ${isPasswordType ? "form_input_password" : ""}`}
        type={inputType}
        name={name}
        placeholder={placeholder || label || ""}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete={autoComplete}
        aria-label={label || placeholder || name}
      />

      {label && <span className="form_input_label">{label}</span>}

      {isPasswordType && (
        <button
          type="button"
          className="toggle_password_icon_btn"
          onClick={() => setShowPassword((isVisible) => !isVisible)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
        >
          {showPassword ? <FaEyeSlash /> : <FaEye />}
        </button>
      )}
    </div>
  );
}

export default FormInput;

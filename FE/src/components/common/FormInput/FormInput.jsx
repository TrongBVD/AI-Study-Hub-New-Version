import { useState } from "react";
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
  // SỬA TẠI ĐÂY: Mở comment và đưa nó thành một prop thực sự với giá trị mặc định
  autoComplete = "off",
}) {
  // Tạo State ẩn/hiện mật khẩu
  const [showPassword, setShowPassword] = useState(false);

  // Xác định xem Input này có phải là kiểu Password hay không
  const isPasswordType = type === "password";

  // Quyết định type thực tế sẽ render ra HTML
  const inputType = isPasswordType ? (showPassword ? "text" : "password") : type;

  return (
    // Sử dụng LABEL làm container để bọc toàn bộ thành một nhóm
    <label className="form_input_group">
      {/* 1. Ô Input thực tế */}
      <input
        className={`form_input ${className} ${isPasswordType ? 'form_input_password' : ''}`}
        type={inputType}
        name={name}
        placeholder={placeholder || label || ""}
        value={value}
        onChange={onChange}
        required={required}
        // SỬA TẠI ĐÂY: Sử dụng prop autoComplete đúng cách
        autoComplete={autoComplete}
      />

      {/* 2. Phần Label Span (sẽ được căn chỉnh bằng CSS) */}
      {label && <span className="form_input_label">{label}</span>}

      {/* 3. Icon xem mật khẩu (Tích hợp bên trong bên phải ô input) */}
      {isPasswordType && (
        <button
          type="button" // Đảm bảo type="button" để không submit form ngoài ý muốn
          className="toggle_password_icon_btn"
          onClick={() => setShowPassword(!showPassword)}
          // Thuộc tính accessibility: thông báo trạng thái cho trình đọc màn hình
          aria-label={showPassword ? "Ẩn mật khẩu" : "Xem mật khẩu"}
        >
          {showPassword ? "🙈" : "👁️"}
        </button>
      )}
    </label>
  );
}

export default FormInput;
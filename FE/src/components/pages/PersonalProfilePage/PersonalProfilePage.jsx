import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../../utils/api.js";
import "./PersonalProfilePage.css";

function PersonalProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState(null);
  const [publicLibraries, setPublicLibraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Nếu không tồn tại tham số id trên thanh URL -> Đang xem trang cá nhân của chính mình
  const isOwnProfile = !id;

  useEffect(() => {
    async function loadProfileData() {
      setLoading(true);
      setError(null);
      
      try {
        if (!isOwnProfile) {
          // Phòng ngừa lỗi 404 do truyền nhầm chuỗi "undefined" từ kết quả click trước đó
          if (id === "undefined" || !id) {
            setError("Mã định danh người dùng không hợp lệ.");
            setLoading(false);
            return;
          }

          // Gửi request tới đúng endpoint cấu trúc Backend đã tối ưu
          const response = await api.get(`/auth/users/${id}/profile`);
          
          if (response.data && response.data.status === "success") {
            setProfile(response.data.data.profile);
            setPublicLibraries(response.data.data.libraries || []);
          } else {
            setError("Không thể đọc cấu trúc phản hồi từ máy chủ.");
          }
        } else {
          // Đọc dữ liệu tài khoản của chính mình từ LocalStorage hệ thống
          const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
          setProfile(storedUser);
        }
      } catch (err) {
        console.error("Lỗi khi kết nối API profile:", err);
        if (err.response && err.response.status === 404) {
          setError("Tài khoản người dùng này không tồn tại hoặc đã bị ẩn.");
        } else {
          setError("Hệ thống gặp sự cố khi kết nối dữ liệu.");
        }
      } finally {
        setLoading(false);
      }
    }

    loadProfileData();
  }, [id, isOwnProfile]);

  if (loading) {
    return (
      <div style={{ padding: "50px", textAlign: "center", fontFamily: "Arial, sans-serif" }}>
        <p style={{ color: "#4f46e5", fontSize: "16px", fontWeight: "500" }}>Đang đồng bộ dữ liệu tài khoản...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{ padding: "60px", textAlign: "center", fontFamily: "Arial, sans-serif" }}>
        <i className="ti-face-sad" style={{ fontSize: "60px", color: "#ef4444", marginBottom: "15px", display: "block" }}></i>
        <h3 style={{ color: "#111827", fontSize: "20px", margin: "0 0 10px 0" }}>Xảy ra lỗi</h3>
        <p style={{ color: "#6b7280", margin: "0 0 20px 0" }}>{error}</p>
        <button 
          onClick={() => navigate("/dashboard/search-user")}
          style={{ padding: "12px 24px", background: "#4f46e5", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}
        >
          Quay lại trang Tìm Kiếm
        </button>
      </div>
    );
  }

  return (
    <div className="personal_profile_page" style={{ padding: "30px", maxWidth: "900px", margin: "0 auto", fontFamily: "Arial, sans-serif" }}>
      
      {/* KHỐI 1: THÔNG TIN CHI TIẾT USER */}
      <section style={{ display: "flex", alignItems: "center", background: "white", padding: "30px", borderRadius: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: "30px" }}>
        <div style={{ width: "100px", height: "100px", borderRadius: "50%", background: "#e5e7eb", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "40px", color: "#9ca3af", marginRight: "25px", overflow: "hidden" }}>
          <i className="ti-user"></i>
        </div>
        
        <div>
          <h2 style={{ margin: "0 0 6px 0", fontSize: "26px", color: "#111827", fontWeight: "bold" }}>
            {profile.full_name || profile.username}
          </h2>
          <p style={{ margin: "0 0 12px 0", color: "#6b7280", fontSize: "15px" }}>@{profile.username}</p>
          
          {/* Kiểm tra logic hiển thị ngày sinh theo trạng thái bảo mật thông tin */}
          {!isOwnProfile ? (
            profile.is_dob_public && profile.date_of_birth ? (
              <p style={{ margin: 0, color: "#059669", fontSize: "14px", display: "flex", alignItems: "center", fontWeight: "500" }}>
                <i className="ti-calendar" style={{ marginRight: "8px" }}></i> 
                Day of Birth: {new Date(profile.date_of_birth).toLocaleDateString("vi-VN")}
              </p>
            ) : (
              <p style={{ margin: 0, color: "#9ca3af", fontSize: "14px", display: "flex", alignItems: "center", fontStyle: "italic" }}>
                <i className="ti-lock" style={{ marginRight: "8px" }}></i>
                Day of Birth: [Private]
              </p>
            )
          ) : (
            <p style={{ margin: 0, color: "#4f46e5", fontSize: "14px", display: "flex", alignItems: "center" }}>
              <i className="ti-calendar" style={{ marginRight: "8px" }}></i>
              {profile.date_of_birth ? `Day of Birth: ${new Date(profile.date_of_birth).toLocaleDateString("vi-VN")}` : "You haven't set your date of birth"}
            </p>
          )}
        </div>
      </section>

      {/* KHỐI 2: HIỂN THỊ DANH SÁCH THƯ VIỆN CÔNG KHAI CỦA ĐỐI PHƯƠNG */}
      {!isOwnProfile && (
        <section style={{ marginTop: "20px" }}>
          <h3 style={{ fontSize: "20px", color: "#111827", marginBottom: "20px", display: "flex", alignItems: "center", fontWeight: "bold" }}>
            <i className="ti-folder" style={{ marginRight: "10px", color: "#f59e0b" }}></i> 
            Thư viện công khai ({publicLibraries.length})
          </h3>

          {publicLibraries.length === 0 ? (
            <div style={{ background: "white", padding: "50px 20px", borderRadius: "16px", textAlign: "center", border: "2px dashed #e5e7eb" }}>
              <i className="ti-archive" style={{ fontSize: "40px", color: "#d1d5db", marginBottom: "12px", display: "block" }}></i>
              <p style={{ color: "#6b7280", margin: 0, fontSize: "15px" }}>Người dùng này chưa có dữ liệu thư viện nào được chia sẻ công khai.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
              {publicLibraries.map((lib) => (
                <div 
                  key={lib.id} 
                  style={{ background: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid #e5e7eb" }}
                >
                  <div style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
                    <div style={{ width: "35px", height: "35px", borderRadius: "6px", background: "#eef2ff", display: "flex", justifyContent: "center", alignItems: "center", color: "#4f46e5", marginRight: "10px" }}>
                      <i className="ti-bookmark-alt"></i>
                    </div>
                    <h4 style={{ margin: 0, color: "#111827", fontSize: "16px", fontWeight: "bold" }}>{lib.name}</h4>
                  </div>
                  <p style={{ margin: 0, color: "#6b7280", fontSize: "14px", lineHeight: "1.4" }}>
                    {lib.description || "Không có mô tả chi tiết."}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* KHỐI 3: KHU VỰC CẤU HÌNH NẾU LÀ PROFILE CHÍNH MÌNH */}
      {isOwnProfile && (
        <div style={{ background: "white", padding: "30px", borderRadius: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
          <h3 style={{ marginTop: 0, color: "#111827", fontSize: "18px", fontWeight: "bold" }}>Không gian quản lý cá nhân</h3>
          <p style={{ color: "#6b7280", fontSize: "14px", marginBottom: "20px" }}>Bạn đang xem trang cá nhân của chính bạn. Chức năng cập nhật thông tin tài khoản đang được kích hoạt.</p>
          <button style={{ padding: "10px 20px", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}>
            Cài đặt tài khoản
          </button>
        </div>
      )}
    </div>
  );
}

export default PersonalProfilePage;
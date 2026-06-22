import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../utils/api.js"; // Đảm bảo import đúng đường dẫn api.js của anh/chị

function SearchUserPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const keyword = searchQuery.trim();
    
    if (keyword === "") {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    
    // Áp dụng Debounce 500ms: Đợi người dùng gõ xong chữ mới gọi API để tránh sập server
    const delaySearch = setTimeout(async () => {
      try {
        // Gửi API thật xuống Backend
        const response = await api.get(`/auth/search?q=${encodeURIComponent(keyword)}`);
        
        // Mapping dữ liệu từ Supabase trả về
        if (response.data && response.data.status === "success") {
          setSearchResults(response.data.data);
        }
      } catch (error) {
        console.error("Lỗi khi tìm kiếm người dùng:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  return (
    <div style={{ padding: "40px", maxWidth: "600px", margin: "0 auto", minHeight: "100vh" }}>
      <h2 style={{ fontSize: "24px", marginBottom: "10px" }}>Tìm kiếm người dùng</h2>
      <p style={{ color: "#6b7280", marginBottom: "30px" }}>
        Tìm kiếm bạn bè hoặc người dùng khác để xem thư viện công khai của họ.
      </p>
      
      <div style={{ position: "relative", marginBottom: "30px" }}>
        <i className="ti-search" style={{ position: "absolute", left: "15px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}></i>
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Nhập tên hoặc username (VD: Đạt, Hương)..."
          style={{ width: "100%", padding: "14px 14px 14px 45px", borderRadius: "10px", border: "1px solid #d1d5db", fontSize: "16px", outline: "none" }}
          autoFocus
        />
      </div>

      <div className="search_results_container">
        {isSearching ? (
          <p style={{ textAlign: "center", color: "#6b7280" }}>Đang quét dữ liệu...</p>
        ) : searchQuery && searchResults.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#6b7280" }}>
            <i className="ti-face-sad" style={{ fontSize: "40px", marginBottom: "10px", display: "block" }}></i>
            <p>Không tìm thấy người dùng nào khớp với "{searchQuery}"</p>
          </div>
        ) : (
          searchResults.map(user => (
            <div 
              key={user.id} 
              onClick={() => navigate(`/dashboard/profile/${user.id}`)}
              style={{ 
                display: "flex", alignItems: "center", padding: "15px", 
                backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "10px", 
                marginBottom: "15px", cursor: "pointer", transition: "box-shadow 0.2s" 
              }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1)"}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = "none"}
            >
              <div style={{ width: "50px", height: "50px", borderRadius: "50%", backgroundColor: "#f3f4f6", display: "flex", justifyContent: "center", alignItems: "center", marginRight: "15px", fontSize: "20px", color: "#9ca3af" }}>
                <i className="ti-user"></i>
              </div>
              <div>
                {/* Lấy full_name từ Database, nếu null thì lấy username */}
                <h3 style={{ margin: 0, fontSize: "16px", color: "#111827" }}>{user.full_name || user.username}</h3>
                <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#6b7280" }}>@{user.username}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default SearchUserPage;
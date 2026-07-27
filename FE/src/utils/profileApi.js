import api from "./api";

export async function getMyProfile() {
  const response = await api.get("/profile/me");
  return response.data.data;
}

export async function getProfileById(profileId) {
  const response = await api.get(`/auth/users/${profileId}/profile`);
  return response.data.data;
}

export async function updateMyProfile(payload) {
  const response = await api.put("/profile/me", payload);
  return response.data.data;
}

export async function updateMyBio(bio) {
  const response = await api.patch("/users/profile-bio", { bio });
  return response.data.data;
}

export async function updateMyAvatar(file) {
  const formData = new FormData();
  formData.append("avatar", file);

  const response = await api.put("/profile/me/avatar", formData);
  return response.data.data;
}

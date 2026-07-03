const ADMIN_TOKEN_KEY = "performance_admin_token";
const STUDENT_TOKEN_KEY = "performance_student_token";
const STUDENT_NAME_KEY = "performance_student_name";

function getAdminToken() {
  return window.localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

function setAdminToken(token) {
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

function clearAdminToken() {
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
}

function getStudentToken() {
  return window.localStorage.getItem(STUDENT_TOKEN_KEY) || "";
}

function setStudentSession(token, studentName) {
  window.localStorage.setItem(STUDENT_TOKEN_KEY, token);
  window.localStorage.setItem(STUDENT_NAME_KEY, studentName);
}

function clearStudentSession() {
  window.localStorage.removeItem(STUDENT_TOKEN_KEY);
  window.localStorage.removeItem(STUDENT_NAME_KEY);
}

function getStudentName() {
  return window.localStorage.getItem(STUDENT_NAME_KEY) || "";
}

async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const role = options.role || "admin";
  const token = role === "student" ? getStudentToken() : getAdminToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  return response;
}

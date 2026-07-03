const commonLoginForm = document.getElementById("common-login-form");
const commonUsernameInput = document.getElementById("common-username");
const commonPasswordInput = document.getElementById("common-password");
const commonLoginStatus = document.getElementById("common-login-status");

function setCommonLoginStatus(message, isError = false) {
  commonLoginStatus.textContent = message;
  commonLoginStatus.style.color = isError ? "#ff9c9c" : "";
}

function redirectIfLoggedIn() {
  if (getAdminToken()) {
    window.location.href = "/";
    return true;
  }

  if (getStudentToken() && getStudentName()) {
    window.location.href = "/student.html";
    return true;
  }

  return false;
}

commonLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = commonUsernameInput.value.trim();
  const password = commonPasswordInput.value;
  setCommonLoginStatus("Signing in...");

  if (username.toLowerCase() === "coach") {
    const adminResponse = await fetch("/api/auth/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const adminPayload = await adminResponse.json();
    if (!adminResponse.ok) {
      setCommonLoginStatus(adminPayload.error || "Coach login failed.", true);
      return;
    }

    clearStudentSession();
    setAdminToken(adminPayload.token);
    window.location.href = "/";
    return;
  }

  const studentResponse = await fetch("/api/auth/student/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const studentPayload = await studentResponse.json();
  if (!studentResponse.ok) {
    setCommonLoginStatus(studentPayload.error || "Student login failed.", true);
    return;
  }

  clearAdminToken();
  setStudentSession(studentPayload.token, studentPayload.studentName);
  window.location.href = "/student.html";
});

redirectIfLoggedIn();

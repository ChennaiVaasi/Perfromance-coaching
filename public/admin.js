const adminLoginForm = document.getElementById("admin-login-form");
const adminUsernameInput = document.getElementById("admin-username");
const adminPasswordInput = document.getElementById("admin-password");
const adminStatus = document.getElementById("admin-status");
const adminPanel = document.getElementById("admin-panel");
const studentCredentialForm = document.getElementById("student-credential-form");
const credentialStudentName = document.getElementById("credential-student-name");
const credentialUsername = document.getElementById("credential-username");
const credentialPassword = document.getElementById("credential-password");
const credentialStatus = document.getElementById("credential-status");
const adminUserList = document.getElementById("admin-user-list");
const adminLogoutButton = document.getElementById("admin-logout");

function setAdminStatus(message, isError = false) {
  adminStatus.textContent = message;
  adminStatus.style.color = isError ? "#ff9c9c" : "";
}

function setCredentialStatus(message, isError = false) {
  credentialStatus.textContent = message;
  credentialStatus.style.color = isError ? "#ff9c9c" : "";
}

function renderUsers(users) {
  adminUserList.innerHTML = users.length
    ? users
        .map(
          (user) => `
            <article class="report-card">
              <h3>${user.studentName}</h3>
              <div class="report-meta">Username: ${user.username}</div>
              <div class="report-meta">Password: ${user.password}</div>
              <a class="engine-link report-link" href="/student.html">Student login page</a>
            </article>
          `
        )
        .join("")
    : '<article class="report-card"><h3>No student users yet</h3><div class="report-meta">Create the first student login above.</div></article>';
}

async function loadUsers() {
  const response = await apiFetch("/api/admin/users");
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Could not load users.");
  }

  renderUsers(payload.users || []);
  adminPanel.hidden = false;
}

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAdminStatus("Signing in...");

  const response = await fetch("/api/auth/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: adminUsernameInput.value.trim(),
      password: adminPasswordInput.value
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    setAdminStatus(payload.error || "Admin login failed.", true);
    return;
  }

  setAdminToken(payload.token);
  setAdminStatus("Admin login successful.");
  await loadUsers();
});

studentCredentialForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setCredentialStatus("Saving student login...");

  const response = await apiFetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentName: credentialStudentName.value.trim(),
      username: credentialUsername.value.trim(),
      password: credentialPassword.value.trim()
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    setCredentialStatus(payload.error || "Could not save student login.", true);
    return;
  }

  credentialStudentName.value = "";
  credentialUsername.value = "";
  credentialPassword.value = "";
  setCredentialStatus("Student login saved.");
  renderUsers(payload.users || []);
});

adminLogoutButton.addEventListener("click", () => {
  clearAdminToken();
  adminPanel.hidden = true;
  renderUsers([]);
  setAdminStatus("Logged out.");
});

if (getAdminToken()) {
  loadUsers().then(() => setAdminStatus("Admin session restored.")).catch((error) => {
    clearAdminToken();
    setAdminStatus(error.message, true);
  });
}

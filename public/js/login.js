import { icon, brand } from "./icons.js";
import {
  esc,
  modal,
  formError,
  busy,
  notify,
  passwordField,
  passwordChecklist,
} from "./ui.js";

function forgotPassword() {
  modal({
    title: "Let’s get you back in",
    subtitle: "Password help",
    content: `
    <div class="credential-success" style="background:var(--red-soft);color:var(--red)">${icon("key", 24)}</div>
    <p><strong>Employees:</strong> contact your safety administrator and ask for a temporary password reset. Your existing sessions will be signed out, and you’ll choose a new password at your next login.</p>
    <div class="info-callout mt-24">${icon("info", 17)}<span>Self-service email recovery is not configured. Administrators should use the documented server-side recovery command in the project README.</span></div>`,
    footer:
      '<button class="btn btn-primary" data-close-modal>Back to sign in</button>',
  });
}
function privacy() {
  modal({
    title: "Your account, protected",
    subtitle: "Privacy & security",
    content: `<p>Zero Incident stores your name, age, username, employee ID and training progress. Administrators can manage employee accounts and view learning results.</p><div class="help-steps"><div class="help-step"><span>${icon("lock", 13)}</span><div><strong>Passwords are never stored in plain text</strong><p>Passwords are individually salted and hashed. Temporary passwords are shown at creation, not saved as readable text.</p></div></div><div class="help-step"><span>${icon("shield", 13)}</span><div><strong>Access is role-protected</strong><p>Secure server sessions protect account details. Deactivating or resetting an account revokes existing sessions.</p></div></div></div><div class="info-callout mt-24">${icon("info", 17)}<span>This is a prototype. Use fictional data in the shared demo. The deploying organisation must define retention, access and privacy policies before real employee data is entered.</span></div>`,
    footer: '<button class="btn btn-secondary" data-close-modal>Close</button>',
  });
}
export function loginPage(ctx) {
  return {
    title: "Sign in",
    standalone: true,
    html: `<main class="login-page">
    <header class="login-top">${brand()}<span class="secure-label">${icon("lock", 13)}A secure start to a safer workplace</span></header>
    <div class="login-layout"><section class="login-story"><div class="eyebrow"><span class="eyebrow-line"></span>SAFETY STARTS WITH YOU</div><h1>Zero incidents.<span>Zero excuses.</span></h1><p class="login-description">Train your awareness. Identify hazards.<br>Make safe decisions. Protect lives.</p>
      <div class="login-features"><div class="login-feature"><span class="feature-icon">${icon("globe", 19)}</span><div><h3>REALISTIC ENVIRONMENTS</h3><p>Workplace-inspired scenarios. Real-world awareness.</p></div></div><div class="login-feature"><span class="feature-icon">${icon("eye", 20)}</span><div><h3>SHARPEN AWARENESS</h3><p>Spot risks early and make better safety decisions.</p></div></div><div class="login-feature"><span class="feature-icon">${icon("trophy", 19)}</span><div><h3>TRACK & IMPROVE</h3><p>Build your knowledge, one safe decision at a time.</p></div></div></div>
      <div class="login-quote">${icon("quote", 19)}<div><strong>Your awareness today prevents accidents tomorrow.</strong><br>A safer workplace begins with all of us.</div></div>
    </section><section aria-labelledby="login-title"><div class="login-card"><div class="login-card-header"><span class="login-helmet">${icon("helmet", 27)}</span><h2 id="login-title">Welcome back</h2><p>Sign in to continue your safety journey</p></div>
      <form id="login-form"><div class="form-alert" hidden></div><div class="field"><label for="username">Username</label><div class="input-with-icon">${icon("user", 17)}<input id="username" name="username" type="text" autocomplete="username" placeholder="Enter your username" value="${esc(ctx.state.loginUsername)}" required maxlength="40" autocapitalize="none" spellcheck="false"></div></div>
      <div class="field"><label for="password">Password</label><div class="input-wrap input-with-icon">${icon("lock", 17)}<input id="password" name="password" type="password" autocomplete="current-password" placeholder="Enter your password" required maxlength="128"><button class="password-toggle" type="button" data-toggle-password="password" aria-label="Show password" aria-pressed="false">${icon("eye", 17)}</button></div></div>
      <div class="login-options"><label class="check-label"><input type="checkbox" name="remember">Remember me</label><button type="button" class="text-button" id="forgot-password">Forgot password?</button></div><button type="submit" class="btn btn-primary login-submit">Sign in ${icon("arrow", 17)}</button></form>
      <div class="login-trust">${icon("shield", 18)}<span>Safety is everyone’s responsibility.<br>Be aware. Be prepared. Be safe.</span></div>
    </div>${ctx.state.demoMode ? `<div class="demo-access"><span>EXPLORE THE DEMO</span><div class="demo-buttons"><button type="button" data-demo="admin" ${ctx.state.demoCredentials?.adminAvailable ? "" : 'disabled title="Demo admin credentials were changed. Use your updated credentials or the server recovery command."'}>Admin console ${icon("arrow", 10)}</button><button type="button" data-demo="employee" ${ctx.state.demoCredentials?.employeeAvailable ? "" : 'disabled title="Demo employee credentials have been changed. Sign in using the new password, or reset the account from the admin console."'}>New employee ${icon("arrow", 10)}</button><button type="button" data-demo="trainer" ${ctx.state.demoCredentials?.trainerAvailable ? "" : "disabled"}>Trainer workspace ${icon("arrow", 10)}</button></div></div><p class="demo-note" id="demo-note">Demo accounts only. Please don’t enter real employee data.</p>` : ""}</section></div>
    <footer class="login-footer"><span class="footer-motto">${icon("checkCircle", 12)}Building a <span class="red-text">safer</span> tomorrow, today.</span><div class="footer-right"><span>© ${new Date().getFullYear()} Zero Incident. All rights reserved.</span><button class="text-button" id="privacy">Privacy & security</button></div></footer>
  </main>`,
    mount(root) {
      root
        .querySelector("#forgot-password")
        .addEventListener("click", forgotPassword);
      root.querySelector("#privacy").addEventListener("click", privacy);
      root.querySelectorAll("[data-demo]").forEach((b) =>
        b.addEventListener("click", () => {
          const account = ctx.state.demoCredentials[b.dataset.demo];
          root.querySelector("#username").value = account.username;
          root.querySelector("#password").value = account.password;
          root.querySelector("#demo-note").textContent =
            b.dataset.demo === "admin"
              ? "Admin credentials filled. Select Sign in to explore."
              : b.dataset.demo === "trainer"
                ? "Trainer credentials filled. Select Sign in to explore."
                : "Employee credentials filled. First sign-in requires a new password.";
          root.querySelector(".login-submit").focus();
        }),
      );
      root
        .querySelector("#login-form")
        .addEventListener("submit", async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const button = form.querySelector('[type="submit"]');
          busy(button, true, "Signing in…");
          try {
            const data = await ctx.api.post("/auth/login", {
              username: form.username.value,
              password: form.password.value,
              remember: form.remember.checked,
            });
            ctx.state.user = data.user;
            ctx.state.loginUsername = data.user.username;
            form.password.value = "";
            ctx.navigate(
              data.user.mustChangePassword
                ? "/first-password"
                : data.user.role === "admin"
                  ? "/admin/overview"
                  : "/employee/hub",
            );
          } catch (e) {
            formError(form, e);
          } finally {
            busy(button, false);
          }
        });
    },
  };
}
export function firstPasswordPage(ctx) {
  return {
    title: "Set your password",
    standalone: true,
    html: `<main class="first-password-page">${brand()}<section class="first-password-card"><div class="login-card-header"><span class="login-helmet">${icon("key", 25)}</span><div class="eyebrow" style="justify-content:center;margin-bottom:10px;color:var(--red)">ONE QUICK STEP BEFORE YOU BEGIN</div><h1>Make this account yours.</h1><p>Hi ${esc(ctx.state.user.firstName)}. Set a new, private password.</p></div><form id="first-password-form"><div class="form-alert" hidden></div><input class="sr-only" type="text" autocomplete="username" value="${esc(ctx.state.user.username)}" aria-label="Username" readonly>
    ${passwordField("newPassword", "New password", { placeholder: "Create your own password" })}${passwordField("confirmPassword", "Confirm new password", { placeholder: "Enter your new password again" })}${passwordChecklist()}
    <button class="btn btn-primary full-width" type="submit">Set password & return to sign in ${icon("arrow", 16)}</button></form><p>For your security, you’ll sign in again after this step.</p><div class="onboarding-steps"><span>${icon("checkCircle")}Temporary sign-in</span><i></i><span class="active">${icon("key")}Set password</span><i></i><span>${icon("lock")}Sign in again</span></div></section><p class="first-password-note">Your new password must be different from the temporary password provided by your administrator.</p><button class="text-button mt-24" id="cancel-setup">${icon("logout", 14)}Sign out instead</button></main>`,
    mount(root) {
      root
        .querySelector("#cancel-setup")
        .addEventListener("click", () => ctx.logout());
      root
        .querySelector("#first-password-form")
        .addEventListener("submit", async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const button = form.querySelector('[type="submit"]');
          busy(button, true, "Securing your account…");
          try {
            await ctx.api.post("/auth/first-password", {
              newPassword: form.newPassword.value,
              confirmPassword: form.confirmPassword.value,
            });
            ctx.state.loginUsername = ctx.state.user.username;
            await ctx.refreshSession();
            ctx.navigate("/login");
            notify("Password updated. Sign in with your new password.");
          } catch (e) {
            formError(form, e);
          } finally {
            busy(button, false);
          }
        });
    },
  };
}

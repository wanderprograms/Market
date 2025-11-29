// 🔥 Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBBZxCwywnv_ZVXYezOV8IKG6iKWK5sL10",
  authDomain: "studio-ywlo1.firebaseapp.com",
  projectId: "studio-ywlo1",
  storageBucket: "studio-ywlo1.firebasestorage.app",
  messagingSenderId: "791958850921",
  appId: "1:791958850921:web:149be668e7f132e59f41f8"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

// 🖼️ ImgBB config
const IMGBB_API_KEY = "6cd76cd441b1c0779a48c166439c8ffe";

/* =========================================
   AUTH
========================================= */
function showRegister() {
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("registerForm").style.display = "block";
}
function showLogin() {
  document.getElementById("registerForm").style.display = "none";
  document.getElementById("loginForm").style.display = "block";
}

auth.onAuthStateChanged(user => {
  if (user) {
    document.getElementById("authContainer").style.display = "none";
    document.getElementById("app").style.display = "block";
  } else {
    document.getElementById("authContainer").style.display = "block";
    document.getElementById("app").style.display = "none";
  }
});

function login() {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  auth.signInWithEmailAndPassword(email, password)
    .catch(err => alert(err.message));
}

function register() {
  const email = document.getElementById("regEmail").value;
  const password = document.getElementById("regPassword").value;
  const terms = document.getElementById("terms").checked;
  if (!terms) { alert("You must agree to Terms"); return; }
  auth.createUserWithEmailAndPassword(email, password)
    .catch(err => alert(err.message));
}

function logout() {
  auth.signOut();
}

/* =========================================
   UI: Upload form open/close + filenames preview
========================================= */
function openForm() { document.getElementById("uploadPopup").style.display = "flex"; }
function closeForm() { document.getElementById("uploadPopup").style.display = "none"; }

document.addEventListener("DOMContentLoaded", () => {
  const imageInput = document.getElementById("images");
  const fileNamesDisplay = document.getElementById("fileNames");
  if (imageInput && fileNamesDisplay) {
    imageInput.addEventListener("change", () => {
      const files = imageInput.files;
      fileNamesDisplay.textContent = Array.from(files).map(f => `• ${f.name}`).join("\n");
    });
  }
});

/* =========================================
   Helpers (deep correctness)
========================================= */
// WhatsApp normalization (Malawi E.164). Accepts 099…, 088…, +265…, 265…, removes spaces/dashes.
function normalizeWhatsApp(number) {
  let clean = String(number || "").replace(/\D/g, ""); // keep digits only
  // If starts with +265 or 265 already, ensure we don't duplicate
  if (clean.startsWith("265")) return clean;
  if (clean.startsWith("0")) return "265" + clean.substring(1);
  // If user typed 9/8 starting directly (rare), assume local and prefix 265
  if (/^[789]\d{8}$/.test(clean)) return "265" + clean;
  // Fallback: if looks like full intl with leading plus removed
  return clean;
}

// Quick safe text to HTML for non-URL fields (prevent unwanted tags)
function escapeHTML(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Convert URLs inside description into clickable anchors (keeps other text escaped)
function linkifyDescription(raw) {
  const text = String(raw || "");
  // Split on URLs and rebuild safely
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts
    .map(part => {
      if (urlRegex.test(part)) {
        const safeURL = escapeHTML(part);
        return `<a href="${safeURL}" target="_blank" rel="noopener noreferrer">${safeURL}</a>`;
      }
      return escapeHTML(part);
    })
    .join("");
}

/* =========================================
   Submit Product (ImgBB upload + Firebase write)
========================================= */
async function submitProduct() {
  const name = document.getElementById("name").value;
  const condition = document.getElementById("condition").value;
  const description = document.getElementById("description").value;
  // Normalize WhatsApp to E.164 (Malawi)
  const whatsapp = normalizeWhatsApp(document.getElementById("whatsapp").value);
  const email = document.getElementById("email").value;
  const phone = document.getElementById("phone").value;
  const wandernumber = document.getElementById("wandernumber").value;
  const location = document.getElementById("location").value;
  const price = document.getElementById("price").value;
  const files = document.getElementById("images").files;

  if (!name || !price || !files || files.length === 0) {
    alert("Please fill in required fields and select images.");
    return;
  }

  // Basic client validation (optional, non-blocking)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert("Email seems invalid. Please check.");
    return;
  }
  if (phone && !/^\+?\d[\d\s-]{6,}$/.test(phone)) {
    // Not strict: allow local formats too
    // No block, just warn:
    console.warn("Phone might be invalid format:", phone);
  }

  const imageUrls = [];
  for (const file of files) {
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data && data.data && data.data.url) {
        imageUrls.push(data.data.url);
      } else {
        console.error("ImgBB upload failed:", data);
        alert("Uploading failed. Please try again later.");
        return;
      }
    } catch (error) {
      console.error("ImgBB error:", error);
      alert("Network error.");
      return;
    }
  }

  const newRef = db.ref("products").push();
  await newRef.set({
    name, condition, description, whatsapp, email, phone,
    wandernumber, location, price, images: imageUrls
  });

  // Cleanup form
  closeForm();
  document.getElementById("uploadPopup").scrollTop = 0;
  document.querySelectorAll("#uploadPopup input, #uploadPopup textarea, #uploadPopup select").forEach(el => {
    if (el) el.value = "";
  });
  const fileNamesEl = document.getElementById("fileNames");
  if (fileNamesEl) fileNamesEl.textContent = "";
}

/* =========================================
   Load Products (dashboard grid)
========================================= */
const productGrid = document.getElementById("productGrid");
db.ref("products").on("value", (snapshot) => {
  if (!productGrid) return;
  productGrid.innerHTML = "";
  snapshot.forEach((child) => {
    const data = child.val();
    const card = document.createElement("div");
    card.className = "product-card";

    const img = document.createElement("img");
    img.src = (data.images && data.images[0]) ? data.images[0] : "";
    img.alt = escapeHTML(data.name || "Product image");
    card.appendChild(img);

    const name = document.createElement("p");
    name.innerHTML = `<strong>${escapeHTML(data.name || "")}</strong>`;
    card.appendChild(name);

    const price = document.createElement("p");
    price.textContent = `${data.price || ""} MWK`;
    card.appendChild(price);

    const btn = document.createElement("button");
    btn.textContent = "See More";
    btn.className = "see-more-btn";
    btn.onclick = () => showDetails(data.images || [], data);
    card.appendChild(btn);

    productGrid.appendChild(card);
  });
});

/* =========================================
   Search (client-side)
========================================= */
document.getElementById("searchInput")?.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  const grid = document.getElementById("productGrid");
  const cards = grid.querySelectorAll(".product-card");

  let matchCount = 0;
  const oldMessage = grid.querySelector(".no-results-message");
  if (oldMessage) oldMessage.remove();

  cards.forEach(card => {
    const nameEl = card.querySelector("p");
    const nameText = nameEl ? nameEl.textContent.toLowerCase() : "";
    const match = nameText.includes(query);
    card.style.display = match ? "block" : "none";
    if (match) matchCount++;
  });

  if (matchCount === 0 && query !== "") {
    const message = document.createElement("div");
    message.className = "no-results-message";
    message.textContent = "Zomwe mukufuna sizikupezeka";
    message.style.color = "red";
    message.style.fontWeight = "bold";
    message.style.textAlign = "center";
    message.style.marginTop = "10px";
    grid.appendChild(message);
  }
});

/* =========================================
   Details modal (clickable links, linkify, order fixed)
========================================= */
function showDetails(images, data) {
  const box = document.getElementById("detailsBox");
  let currentIndex = 0;

  // Backup normalization in view (in case legacy data is 099… in Firebase)
  function normalizeWhatsAppView(number) {
    return normalizeWhatsApp(number);
  }

  function renderImage() {
    const safeName = escapeHTML(data.name);
    const safeCondition = escapeHTML(data.condition);
    const safePrice = escapeHTML(data.price);
    const safeEmail = escapeHTML(data.email);
    const safePhone = escapeHTML(data.phone);
    const safeWander = escapeHTML(data.wandernumber);
    const safeLocation = escapeHTML(data.location);

    const waForLink = normalizeWhatsAppView(data.whatsapp);

    box.innerHTML = `
      <div style="text-align:center;">
        <img src="${images[currentIndex] || ""}" 
             alt="${safeName}" 
             style="width:100%; max-height:70vh; object-fit:contain; border-radius:10px; cursor:pointer;" 
             onclick="openFullScreen('${images[currentIndex] || ""}')" />
      </div>

      <h3>${safeName}</h3>
      <p><strong>Price:</strong> ${safePrice} MWK</p>
      <p><strong>Condition:</strong> ${safeCondition}</p>

      <p><strong>Description:</strong> ${linkifyDescription(data.description)}</p>

      <p><strong>WhatsApp:</strong> 
        <a href="https://wa.me/${waForLink}" target="_blank" rel="noopener noreferrer">
          ${waForLink}
        </a>
      </p>

      <p><strong>Email:</strong> 
        <a href="mailto:${safeEmail}">${safeEmail}</a>
      </p>

      <p><strong>Phone:</strong> 
        <a href="tel:${safePhone}">${safePhone}</a>
      </p>

      <p><strong>S&R Number:</strong> 
        <a href="https://wanderslapp-sandr-monay.onrender.com/?number=${safeWander}" target="_blank" rel="noopener noreferrer">
          ${safeWander}
        </a>
      </p>

      <p><strong>Location:</strong> ${safeLocation}</p>

      <div style="display:flex; justify-content:space-between; margin-top:10px;">
        <button onclick="prevImage()">⬅️</button>
        <button onclick="nextImage()">➡️</button>
        <button onclick="closeDetails()">✖️ Close</button>
      </div>
    `;
  }

  window.prevImage = () => {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    renderImage();
  };
  window.nextImage = () => {
    currentIndex = (currentIndex + 1) % images.length;
    renderImage();
  };
  window.closeDetails = () => {
    document.getElementById("detailsPopup").style.display = "none";
  };

  renderImage();
  document.getElementById("detailsPopup").style.display = "flex";
}

/* =========================================
   Full-screen image viewer
========================================= */
function openFullScreen(url) {
  const fullScreenDiv = document.createElement("div");
  fullScreenDiv.style.position = "fixed";
  fullScreenDiv.style.top = "0";
  fullScreenDiv.style.left = "0";
  fullScreenDiv.style.width = "100%";
  fullScreenDiv.style.height = "100%";
  fullScreenDiv.style.backgroundColor = "rgba(0,0,0,0.95)";
  fullScreenDiv.style.display = "flex";
  fullScreenDiv.style.alignItems = "center";
  fullScreenDiv.style.justifyContent = "center";
  fullScreenDiv.style.zIndex = "9999";

  const img = document.createElement("img");
  img.src = url;
  img.style.maxWidth = "90%";
  img.style.maxHeight = "90%";
  img.style.borderRadius = "10px";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✖️ Close";
  closeBtn.style.position = "absolute";
  closeBtn.style.top = "20px";
  closeBtn.style.right = "20px";
  closeBtn.style.padding = "10px";
  closeBtn.style.background = "red";
  closeBtn.style.color = "white";
  closeBtn.style.border = "none";
  closeBtn.style.borderRadius = "5px";
  closeBtn.style.cursor = "pointer";
  closeBtn.onclick = () => document.body.removeChild(fullScreenDiv);

  fullScreenDiv.appendChild(img);
  fullScreenDiv.appendChild(closeBtn);
  document.body.appendChild(fullScreenDiv);
}
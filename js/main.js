import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";

// Configuración Firebase
const firebaseConfig = {
  apiKey: "AIzaSyActULR2Fqu4F3A_A1TUOXQbfrORZecqiI",
  authDomain: "ofertassuper-a9841.firebaseapp.com",
  projectId: "ofertassuper-a9841",
  storageBucket: "ofertassuper-a9841.appspot.com",
  messagingSenderId: "29615340161",
  appId: "1:29615340161:web:bbca60564936cdc9e1ab80",
  measurementId: "G-5EZQTLGX26",
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Elementos DOM
const registroSection = document.getElementById("registro-section");
const loginSection = document.getElementById("login-section");
const adminPanel = document.getElementById("admin-panel");

const btnRegistrar = document.getElementById("btn-registrar");
const registroError = document.getElementById("registro-error");
const registroExito = document.getElementById("registro-exito");

const btnLogin = document.getElementById("btn-login");
const loginError = document.getElementById("login-error");

const btnLogout = document.getElementById("btn-logout");

const formOferta = document.getElementById("form-oferta");
const listaOfertas = document.getElementById("lista-ofertas");

const btnCancelarEdicion = document.getElementById("btn-cancelar-edicion");

// Registro de usuario
btnRegistrar.addEventListener("click", () => {
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value.trim();

  registroError.textContent = "";
  registroExito.textContent = "";

  createUserWithEmailAndPassword(auth, email, password)
    .then(() => {
      registroExito.textContent = "Usuario registrado exitosamente. Ya puedes iniciar sesión.";
      document.getElementById("reg-email").value = "";
      document.getElementById("reg-password").value = "";
    })
    .catch((error) => {
      registroError.textContent = "Error al registrar: " + error.message;
    });
});

// Login usuario
btnLogin.addEventListener("click", () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  loginError.textContent = "";

  signInWithEmailAndPassword(auth, email, password)
    .catch((error) => {
      loginError.textContent = "Error al iniciar sesión: " + error.message;
    });
});

// Logout
btnLogout.addEventListener("click", () => {
  signOut(auth);
});

// Estado de autenticación
onAuthStateChanged(auth, (user) => {
  if (user) {
    registroSection.style.display = "none";
    loginSection.style.display = "none";
    adminPanel.style.display = "block";
    cargarOfertas();
    cargarBanners();
  } else {
    registroSection.style.display = "block";
    loginSection.style.display = "block";
    adminPanel.style.display = "none";
    listaOfertas.innerHTML = "";
    listaBanners.innerHTML = "";
    limpiarFormulario();
  }
});

// Variables para edición
let idEditar = null;

// Función para limpiar formulario
function limpiarFormulario() {
  formOferta.reset();
  idEditar = null;
  btnCancelarEdicion.style.display = "none";
  formOferta.querySelector("button[type=submit]").textContent = "Guardar Oferta";
}

// Agregar o actualizar oferta
formOferta.addEventListener("submit", async (e) => {
  e.preventDefault();

  const ofertaData = {
    nombre: document.getElementById("nombre").value.trim(),
    supermercado: document.getElementById("supermercado").value.trim(),
    precio: Number(document.getElementById("precio").value),
    precioOriginal: Number(document.getElementById("precioOriginal").value),
    vence: document.getElementById("vence").value,
    imagen: document.getElementById("imagen").value.trim(),
  };

  try {
    if (idEditar) {
      const docRef = doc(db, "ofertas", idEditar);
      await updateDoc(docRef, ofertaData);
      alert("Oferta actualizada correctamente.");
    } else {
      await addDoc(collection(db, "ofertas"), ofertaData);
      alert("Oferta agregada correctamente.");
    }
    limpiarFormulario();
    cargarOfertas();
  } catch (error) {
    alert("Error al guardar oferta: " + error.message);
  }
});

// Cancelar edición
btnCancelarEdicion.addEventListener("click", () => {
  limpiarFormulario();
});

// Cargar ofertas y mostrarlas
async function cargarOfertas() {
  listaOfertas.innerHTML = "";
  try {
    const querySnapshot = await getDocs(collection(db, "ofertas"));
    querySnapshot.forEach((docSnap) => {
      const oferta = docSnap.data();
      const id = docSnap.id;

      const card = document.createElement("div");
      card.className = "col-12 col-md-6 mb-3";
      card.innerHTML = `
        <div class="card">
          <div style="background-image: url('${oferta.imagen}'); height: 200px; background-size: cover; background-position: center; border-radius: 10px;"></div>
          <div class="card-body">
            <h5>${oferta.nombre}</h5>
            <p>Supermercado: ${oferta.supermercado}</p>
            <p>Precio: <span style="color:#bdaaf7;">$${oferta.precio}</span> <del>$${oferta.precioOriginal}</del></p>
            <p>Vence: <b>${oferta.vence}</b></p>
            <button class="btn btn-primary btn-sm btn-editar" data-id="${id}">Editar</button>
            <button class="btn btn-danger btn-sm btn-eliminar" data-id="${id}">Eliminar</button>
          </div>
        </div>
      `;

      listaOfertas.appendChild(card);
    });

    // Eventos para botones editar
    document.querySelectorAll(".btn-editar").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        await cargarOfertaParaEditar(id);
      });
    });

    // Eventos para botones eliminar
    document.querySelectorAll(".btn-eliminar").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        if (confirm("¿Seguro que quieres eliminar esta oferta?")) {
          try {
            await deleteDoc(doc(db, "ofertas", id));
            cargarOfertas();
          } catch (error) {
            alert("Error al eliminar oferta: " + error.message);
          }
        }
      });
    });
  } catch (error) {
    alert("Error al cargar ofertas: " + error.message);
  }
}

// Cargar oferta para editar
async function cargarOfertaParaEditar(id) {
  const docRef = doc(db, "ofertas", id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const oferta = docSnap.data();
    document.getElementById("nombre").value = oferta.nombre;
    document.getElementById("supermercado").value = oferta.supermercado;
    document.getElementById("precio").value = oferta.precio;
    document.getElementById("precioOriginal").value = oferta.precioOriginal;
    document.getElementById("vence").value = oferta.vence;
    document.getElementById("imagen").value = oferta.imagen;

    idEditar = id;
    btnCancelarEdicion.style.display = "inline-block";
    formOferta.querySelector("button[type=submit]").textContent = "Actualizar Oferta";
  }
}

// Gestión de banners
const formBanner = document.getElementById("form-banner");
const listaBanners = document.getElementById("lista-banners");

formBanner.addEventListener("submit", async (e) => {
  e.preventDefault();
  const imagen = document.getElementById("banner-imagen").value.trim();
  const alt = document.getElementById("banner-alt").value.trim();

  try {
    await addDoc(collection(db, "banners"), { imagen, alt });
    formBanner.reset();
    cargarBanners();
  } catch (error) {
    alert("Error al agregar banner: " + error.message);
  }
});

async function cargarBanners() {
  listaBanners.innerHTML = "";
  try {
    const querySnapshot = await getDocs(collection(db, "banners"));
    querySnapshot.forEach((docSnap) => {
      const banner = docSnap.data();
      const id = docSnap.id;

      const card = document.createElement("div");
      card.className = "col-12 col-md-4 mb-3";
      card.innerHTML = `
        <div class="card">
          <img src="${banner.imagen}" alt="${banner.alt}" class="card-img-top" style="height:150px; object-fit:cover; border-radius:10px;">
          <div class="card-body">
            <p>${banner.alt}</p>
            <button class="btn btn-danger btn-sm btn-eliminar-banner" data-id="${id}">Eliminar</button>
          </div>
        </div>
      `;
      listaBanners.appendChild(card);
    });

    // Eventos eliminar banner
    document.querySelectorAll(".btn-eliminar-banner").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        if (confirm("¿Seguro que quieres eliminar este banner?")) {
          try {
            await deleteDoc(doc(db, "banners", id));
            cargarBanners();
          } catch (error) {
            alert("Error al eliminar banner: " + error.message);
          }
        }
      });
    });
  } catch (error) {
    alert("Error al cargar banners: " + error.message);
  }
}


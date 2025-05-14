import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";

// Configuración Firebase (usa la tuya)
const firebaseConfig = {
  apiKey: "AIzaSyActULR2Fqu4F3A_A1TUOXQbfrORZecqiI",
  authDomain: "ofertassuper-a9841.firebaseapp.com",
  projectId: "ofertassuper-a9841",
  storageBucket: "ofertassuper-a9841.appspot.com",
  messagingSenderId: "29615340161",
  appId: "1:29615340161:web:bbca60564936cdc9e1ab80",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// DOM Elements
const loginSection = document.getElementById("login-section");
const formLogin = document.getElementById("form-login");
const loginAlert = document.getElementById("login-alert");

const adminPanel = document.getElementById("admin-panel");
const userInfo = document.getElementById("user-info");
const formOferta = document.getElementById("form-oferta");
const listaOfertas = document.getElementById("lista-ofertas");
const btnAgregarProducto = document.getElementById("btn-agregar-producto");
const productosBody = document.getElementById("productos-body");
const btnCancelar = document.getElementById("btn-cancelar");
const btnLogout = document.getElementById("btn-logout");

let idEditar = null;
let supermercadoActual = null; // { id, nombre, direccion }

// Mostrar alertas Bootstrap
function mostrarAlerta(contenedor, mensaje, tipo = "danger") {
  contenedor.innerHTML = `
    <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
      ${mensaje}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>
    </div>
  `;
  setTimeout(() => { contenedor.innerHTML = ""; }, 4000);
}

// LOGIN
formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value.trim();

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    mostrarAlerta(loginAlert, "Error al iniciar sesión: " + error.message);
  }
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const userDoc = await getDoc(doc(db, "usuarios", user.uid));
      if (!userDoc.exists()) {
        alert("Usuario no tiene supermercado asignado");
        await signOut(auth);
        return;
      }
      const userData = userDoc.data();

      const supermercadoDoc = await getDoc(doc(db, "supermercados", userData.supermercadoId));
      if (!supermercadoDoc.exists()) {
        alert("Supermercado asignado no existe o fue eliminado");
        await signOut(auth);
        return;
      }
      const supermercadoData = supermercadoDoc.data();

      supermercadoActual = {
        id: userData.supermercadoId,
        nombre: supermercadoData.nombre || "Supermercado",
        direccion: supermercadoData.direccion || "Dirección no disponible",
      };

      userInfo.textContent = `Supermercado: ${supermercadoActual.nombre} - Ubicación: ${supermercadoActual.direccion}`;

      loginSection.style.display = "none";
      adminPanel.style.display = "block";

      limpiarFormulario();
      await desactivarOfertasExpiradas();
      cargarOfertas();
    } catch (error) {
      alert("Error al cargar datos: " + error.message);
      await signOut(auth);
    }
  } else {
    loginSection.style.display = "block";
    adminPanel.style.display = "none";
    userInfo.textContent = "";
    listaOfertas.innerHTML = "";
    limpiarFormulario();
  }
});

// Limpiar formulario y tabla productos
function limpiarFormulario() {
  formOferta.reset();
  idEditar = null;
  btnCancelar.style.display = "none";
  productosBody.innerHTML = "";
  agregarProductoFila();
}

// Agregar fila producto vacía o con datos
function agregarProductoFila(producto = {}) {
  const tr = document.createElement("tr");
  tr.classList.add("producto-row");
  tr.innerHTML = `
    <td><input type="text" class="form-control producto-nombre" placeholder="Nombre" value="${producto.nombre || ''}" required></td>
    <td><input type="text" class="form-control producto-descripcion" placeholder="Descripción" value="${producto.descripcion || ''}"></td>
    <td><input type="number" class="form-control producto-precioOriginal" placeholder="Precio original" min="0" step="0.01" value="${producto.precioOriginal || ''}" required></td>
    <td><input type="number" class="form-control producto-precioOferta" placeholder="Precio oferta" min="0" step="0.01" value="${producto.precioOferta || ''}" required></td>
    <td><input type="text" class="form-control producto-unidad" placeholder="Unidad (kg, unidad...)" value="${producto.unidad || ''}" required></td>
    <td><input type="number" class="form-control producto-stock" placeholder="Stock" min="0" step="1" value="${producto.stockDisponible || ''}" required></td>
    <td><input type="date" class="form-control producto-fechaVencimiento" value="${producto.fechaVencimiento ? producto.fechaVencimiento.split('T')[0] : ''}" required></td>
    <td><button type="button" class="btn btn-danger btn-sm btn-eliminar-producto" title="Eliminar producto"><i class="bi bi-trash"></i></button></td>
  `;
  productosBody.appendChild(tr);

  tr.querySelector(".btn-eliminar-producto").addEventListener("click", () => {
    tr.remove();
  });
}

btnAgregarProducto.addEventListener("click", () => {
  agregarProductoFila();
});

// Función para desactivar ofertas expiradas
async function desactivarOfertasExpiradas() {
  if (!supermercadoActual) return;

  const hoy = new Date();

  try {
    const q = query(
      collection(db, "ofertas"),
      where("supermercadoId", "==", supermercadoActual.id),
      where("activo", "==", true)
    );
    const snapshot = await getDocs(q);

    const updates = [];

    snapshot.forEach((docSnap) => {
      const oferta = docSnap.data();
      let fechaFin;

      if (oferta.fechaFin && oferta.fechaFin.toDate) {
        fechaFin = oferta.fechaFin.toDate();
      } else {
        fechaFin = new Date(oferta.fechaFin);
      }

      if (fechaFin < hoy) {
        const docRef = doc(db, "ofertas", docSnap.id);
        updates.push(updateDoc(docRef, { activo: false }));
      }
    });

    await Promise.all(updates);
  } catch (error) {
    console.error("Error desactivando ofertas expiradas:", error);
  }
}

// Guardar o actualizar oferta
formOferta.addEventListener("submit", async (e) => {
  e.preventDefault();

  const filasProductos = productosBody.querySelectorAll("tr");
  if (filasProductos.length === 0) {
    alert("Debe agregar al menos un producto.");
    return;
  }

  const titulo = document.getElementById("titulo").value.trim();
  const descripcion = document.getElementById("descripcion").value.trim();
  const categoria = document.getElementById("categoria").value.trim();
  const fechaInicio = new Date(document.getElementById("fechaInicio").value).toISOString();
  const fechaFin = new Date(document.getElementById("fechaFin").value).toISOString();
  const imagenURL = document.getElementById("imagenURL").value.trim() || null;

  try {
    if (idEditar) {
      const docRef = doc(db, "ofertas", idEditar);
      const originalDoc = await getDoc(docRef);
      if (!originalDoc.exists()) {
        alert("La oferta a editar no existe.");
        return;
      }
      const fila = filasProductos[0];
      const producto = {
        nombre: fila.querySelector(".producto-nombre").value.trim(),
        descripcion: fila.querySelector(".producto-descripcion").value.trim(),
        precioOriginal: parseFloat(fila.querySelector(".producto-precioOriginal").value),
        precioOferta: parseFloat(fila.querySelector(".producto-precioOferta").value),
        unidad: fila.querySelector(".producto-unidad").value.trim(),
        stockDisponible: parseInt(fila.querySelector(".producto-stock").value),
        fechaVencimiento: new Date(fila.querySelector(".producto-fechaVencimiento").value).toISOString(),
      };
      await updateDoc(docRef, {
        supermercadoId: supermercadoActual.id,
        titulo,
        descripcion,
        categoria,
        fechaInicio,
        fechaFin,
        productos: [producto],
        activo: true,
        imagenURL,
        fechaCreacion: originalDoc.data().fechaCreacion,
        fechaActualizacion: serverTimestamp(),
      });
      alert("Oferta actualizada correctamente.");
    } else {
      for (const fila of filasProductos) {
        const producto = {
          nombre: fila.querySelector(".producto-nombre").value.trim(),
          descripcion: fila.querySelector(".producto-descripcion").value.trim(),
          precioOriginal: parseFloat(fila.querySelector(".producto-precioOriginal").value),
          precioOferta: parseFloat(fila.querySelector(".producto-precioOferta").value),
          unidad: fila.querySelector(".producto-unidad").value.trim(),
          stockDisponible: parseInt(fila.querySelector(".producto-stock").value),
          fechaVencimiento: new Date(fila.querySelector(".producto-fechaVencimiento").value).toISOString(),
        };

        if (!producto.nombre || isNaN(producto.precioOriginal) || isNaN(producto.precioOferta) || !producto.unidad || isNaN(producto.stockDisponible) || !producto.fechaVencimiento) {
          alert("Completa todos los campos requeridos de los productos correctamente.");
          return;
        }

        const ofertaData = {
          supermercadoId: supermercadoActual.id,
          titulo,
          descripcion,
          categoria,
          fechaInicio,
          fechaFin,
          productos: [producto],
          activo: true,
          imagenURL,
          fechaCreacion: serverTimestamp(),
          fechaActualizacion: serverTimestamp(),
        };

        await addDoc(collection(db, "ofertas"), ofertaData);
      }
      alert("Ofertas creadas correctamente.");
    }

    limpiarFormulario();
    cargarOfertas();
  } catch (error) {
    alert("Error al guardar oferta: " + error.message);
  }
});

// Cargar ofertas del supermercado actual
async function cargarOfertas() {
  listaOfertas.innerHTML = "";
  if (!supermercadoActual) return;

  try {
    const q = query(
      collection(db, "ofertas"),
      where("supermercadoId", "==", supermercadoActual.id),
      where("activo", "==", true)
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      listaOfertas.innerHTML = "<p>No hay ofertas registradas.</p>";
      return;
    }

    querySnapshot.forEach((docSnap) => {
      const oferta = docSnap.data();
      const id = docSnap.id;

      const card = document.createElement("div");
      card.className = "col-12";
      card.innerHTML = `
        <div class="card shadow-sm mb-3">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">${oferta.titulo}</h5>
            <div>
              <button class="btn btn-sm btn-primary btn-editar" data-id="${id}" title="Editar"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-danger btn-eliminar" data-id="${id}" title="Eliminar"><i class="bi bi-trash"></i></button>
            </div>
          </div>
          <div class="card-body">
            <p><strong>Descripción:</strong> ${oferta.descripcion}</p>
            <p><strong>Categoría:</strong> ${oferta.categoria}</p>
            <p><strong>Vigencia:</strong> ${new Date(oferta.fechaInicio).toLocaleDateString()} - ${new Date(oferta.fechaFin).toLocaleDateString()}</p>
            ${oferta.imagenURL ? `<img src="${oferta.imagenURL}" alt="Imagen oferta" class="img-fluid rounded mb-3" style="max-height:200px;">` : ""}
            <h6>Producto:</h6>
            <table class="table table-sm table-bordered">
              <thead>
                <tr>
                  <th style="text-align: center;">Producto</th>
                  <th style="text-align: center;">Descripción</th>
                  <th style="text-align: center;">Precio Original</th>
                  <th style="text-align: center;">Precio Oferta</th>
                  <th style="text-align: center;">Por</th>
                  <th style="text-align: center;">Stock</th>
                  <th style="text-align: center;">Fecha Vencimiento</th>
                </tr>
              </thead>
              <tbody>
                ${oferta.productos.map(p => `
                  <tr>
                    <td style="text-align: center;">${p.nombre}</td>
                    <td style="text-align: center;">${p.descripcion || ""}</td>
                    <td style="text-align: center;">Q${p.precioOriginal.toFixed(2)}</td>
                    <td style="text-align: center;">Q${p.precioOferta.toFixed(2)}</td>
                    <td style="text-align: center;">${p.unidad}</td>
                    <td style="text-align: center;">${p.stockDisponible}</td>
                    <td style="text-align: center;">${new Date(p.fechaVencimiento).toLocaleDateString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      listaOfertas.appendChild(card);
    });

    // Eventos editar
    document.querySelectorAll(".btn-editar").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.currentTarget.dataset.id;
        await cargarOfertaParaEditar(id);
      });
    });

    // Eventos eliminar
    document.querySelectorAll(".btn-eliminar").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.currentTarget.dataset.id;
        if (confirm("¿Está seguro de eliminar esta oferta?")) {
          try {
            await deleteDoc(doc(db, "ofertas", id));
            alert("Oferta eliminada.");
            cargarOfertas();
          } catch (error) {
            alert("Error al eliminar oferta: " + error.message);
          }
        }
      });
    });
  } catch (error) {
    listaOfertas.innerHTML = `<p class="text-danger">Error cargando ofertas: ${error.message}</p>`;
  }
}

// Cargar oferta para editar
async function cargarOfertaParaEditar(id) {
  try {
    const docRef = doc(db, "ofertas", id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      alert("Oferta no encontrada");
      return;
    }
    const oferta = docSnap.data();

    document.getElementById("titulo").value = oferta.titulo;
    document.getElementById("descripcion").value = oferta.descripcion;
    document.getElementById("categoria").value = oferta.categoria;
    document.getElementById("fechaInicio").value = oferta.fechaInicio.split("T")[0];
    document.getElementById("fechaFin").value = oferta.fechaFin.split("T")[0];
    document.getElementById("imagenURL").value = oferta.imagenURL || "";

    productosBody.innerHTML = "";
    oferta.productos.forEach(p => agregarProductoFila(p));

    idEditar = id;
    btnCancelar.style.display = "inline-block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    alert("Error cargando oferta: " + error.message);
  }
}

// Cancelar edición
btnCancelar.addEventListener("click", () => {
  limpiarFormulario();
});

// Cerrar sesión
btnLogout.addEventListener("click", async () => {
  await signOut(auth);
  location.reload();
});
